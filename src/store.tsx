import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import renames from "./renames.json";
import seed from "./seed.json";
import { supabase } from "./supabase";
import { defaultBudget } from "./budget";
import { guessCategory } from "./foodCategories";
import type { AppData, Entry, MealSlot } from "./types";

const STORAGE_KEY = "nutrition-data-v1";
const SYNC_KEY = "nutrition-sync-v1";
const PUSH_DELAY_MS = 800;
const PULL_INTERVAL_MS = 60_000;

/** Type d'item de l'agenda utilisé par défaut pour les tâches planifiées. */
export const TASK_CATEGORY = { id: "tache", label: "Tâche", color: "#8e7cc3" };

export const seedData = (): AppData => migrate(structuredClone(seed) as unknown as AppData);

function migrate(data: AppData): AppData {
  // v2 : le suivi repart de zéro, l'historique importé de l'Excel est effacé.
  if ((data.version ?? 1) < 2) data = { ...data, version: 2, days: {} };
  // v3 : corrections de noms (uniquement si le nom n'a pas été modifié à la main).
  if (data.version < 3) {
    const fix = <T extends { id: string; name: string }>(list: T[], map: Record<string, string[]>) =>
      list.map((x) => (map[x.id]?.[0] === x.name.trim() ? { ...x, name: map[x.id][1] } : x));
    data = {
      ...data,
      version: 3,
      ingredients: fix(data.ingredients, renames.ingredients),
      recipes: fix(data.recipes, renames.recipes),
    };
  }
  // v4 : ajout de l'emploi du temps.
  if (data.version < 4) {
    data = {
      ...data,
      version: 4,
      schedule: data.schedule ?? {
        categories: [
          { id: "loisir", label: "Loisir", color: "#6aa84f" },
          { id: "travail", label: "Travail", color: "#e69138" },
          { id: "repas", label: "Repas", color: "#3d85c6" },
        ],
        events: [],
      },
    };
  }
  // v5 : rayons des ingrédients, et les repas planifiés dans l'agenda deviennent des plans de repas par jour.
  if (data.version < 5) {
    const mealPlans: AppData["mealPlans"] = { ...(data.mealPlans ?? {}) };
    type OldEvent = AppData["schedule"]["events"][number] & { foods?: Entry[]; eaten?: boolean };
    const events = (data.schedule.events as OldEvent[]).filter((ev) => {
      if (!ev.foods?.length) return true;
      const m = Number(ev.start.slice(0, 2)) * 60 + Number(ev.start.slice(3, 5));
      const slot: MealSlot = m < 10.5 * 60 ? "petitdej" : m < 15 * 60 ? "dejeuner" : m < 18.5 * 60 ? "collation" : "diner";
      const plan = (mealPlans[ev.date] ??= { meals: {} });
      plan.meals[slot] = [...(plan.meals[slot] ?? []), ...ev.foods];
      if (ev.eaten && !plan.done?.includes(slot)) plan.done = [...(plan.done ?? []), slot];
      return false;
    });
    data = {
      ...data,
      version: 5,
      mealPlans,
      schedule: { ...data.schedule, events: events.map(({ foods: _f, eaten: _e, ...ev }) => ev) },
      ingredients: data.ingredients.map((i) => (i.category ? i : { ...i, category: guessCategory(i.name) })),
    };
  }
  // v6 : liste de tâches, planifiables dans l'agenda avec leur propre type.
  if (data.version < 6) {
    const categories = data.schedule.categories.some((c) => c.id === TASK_CATEGORY.id)
      ? data.schedule.categories
      : [...data.schedule.categories, TASK_CATEGORY];
    data = { ...data, version: 6, tasks: data.tasks ?? [], schedule: { ...data.schedule, categories } };
  }
  // v7 : budget mensuel.
  if (data.version < 7) data = { ...data, version: 7, budget: data.budget ?? defaultBudget() };
  return data;
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw) as AppData);
  } catch {
    /* stockage indisponible : on repart des données de l'Excel */
  }
  return seedData();
}

/** Où en est la copie locale par rapport à Supabase. */
interface SyncMeta {
  userId?: string;
  /** updated_at de la ligne distante lors de la dernière synchro réussie. */
  remoteUpdatedAt?: string;
  /** Modifications locales pas encore envoyées. */
  dirty?: boolean;
}

function readMeta(): SyncMeta {
  try {
    return JSON.parse(localStorage.getItem(SYNC_KEY) ?? "{}") as SyncMeta;
  } catch {
    return {};
  }
}

function writeMeta(meta: SyncMeta) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(meta));
  } catch {
    /* ignoré */
  }
}

export type SyncStatus = "local" | "syncing" | "synced" | "offline" | "error";

interface Store {
  data: AppData;
  update: (fn: (draft: AppData) => void) => void;
  replace: (data: AppData) => void;
  session: Session | null;
  authReady: boolean;
  syncStatus: SyncStatus;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(supabase ? "syncing" : "local");
  const meta = useRef<SyncMeta>(readMeta());
  const dataRef = useRef(data);
  const fromRemote = useRef(false);
  const pushTimer = useRef<number>();
  const userId = session?.user.id;

  const setMeta = (patch: SyncMeta) => {
    meta.current = { ...meta.current, ...patch };
    writeMeta(meta.current);
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const push = useCallback(async () => {
    if (!supabase || !userId) return;
    setSyncStatus("syncing");
    const { data: row, error } = await supabase
      .from("user_data")
      .upsert({ user_id: userId, data: dataRef.current })
      .select("updated_at")
      .single();
    if (error) {
      setSyncStatus(navigator.onLine ? "error" : "offline");
      return;
    }
    setMeta({ userId, remoteUpdatedAt: row.updated_at, dirty: false });
    setSyncStatus("synced");
  }, [userId]);

  const pull = useCallback(async () => {
    if (!supabase || !userId) return;
    setSyncStatus("syncing");
    const { data: row, error } = await supabase
      .from("user_data")
      .select("data, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      setSyncStatus(navigator.onLine ? "error" : "offline");
      return;
    }
    const sameUser = meta.current.userId === userId;
    if (!row) {
      // Premier appareil connecté : on envoie ce qu'on a en local.
      await push();
      return;
    }
    const remoteChanged = !sameUser || row.updated_at !== meta.current.remoteUpdatedAt;
    if (sameUser && meta.current.dirty && !remoteChanged) {
      // Modifs faites hors ligne sur cet appareil, rien de neuf ailleurs : on les envoie.
      await push();
      return;
    }
    if (remoteChanged) {
      fromRemote.current = true;
      setData(migrate(row.data as AppData));
    }
    setMeta({ userId, remoteUpdatedAt: row.updated_at, dirty: false });
    setSyncStatus("synced");
  }, [userId, push]);

  // Sauvegarde locale + envoi différé des modifications faites ici.
  useEffect(() => {
    dataRef.current = data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignoré */
    }
    if (fromRemote.current) {
      fromRemote.current = false;
      return;
    }
    if (!supabase || !userId) return;
    setMeta({ dirty: true });
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(push, PUSH_DELAY_MS);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Récupère les modifs des autres appareils à la connexion, au retour sur l'app et régulièrement.
  useEffect(() => {
    if (!userId) return;
    const initial = window.setTimeout(pull, 0);
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (meta.current.dirty) push();
      else pull();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    const timer = window.setInterval(refresh, PULL_INTERVAL_MS);
    return () => {
      window.clearTimeout(initial);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      window.clearInterval(timer);
    };
  }, [userId, pull, push]);

  const update = (fn: (draft: AppData) => void) =>
    setData((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });

  return (
    <Ctx.Provider value={{ data, update, replace: setData, session, authReady, syncStatus }}>{children}</Ctx.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore hors du StoreProvider");
  return s;
}

export function exportJson(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nutrition-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
