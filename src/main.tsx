import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Ingredients } from "./pages/Ingredients";
import { Objectives } from "./pages/Objectives";
import { Recipes } from "./pages/Recipes";
import { Tracking } from "./pages/Tracking";
import { Login } from "./pages/Login";
import { StoreProvider, useStore, type SyncStatus } from "./store";
import { supabase } from "./supabase";
import "./styles.css";

const TABS = [
  { id: "suivi", label: "Suivi", el: <Tracking /> },
  { id: "recettes", label: "Recettes", el: <Recipes /> },
  { id: "ingredients", label: "Ingrédients", el: <Ingredients /> },
  { id: "objectifs", label: "Objectifs", el: <Objectives /> },
] as const;

const SYNC_LABELS: Record<SyncStatus, string> = {
  local: "Données locales uniquement",
  syncing: "Synchronisation…",
  synced: "Synchronisé",
  offline: "Hors ligne : les modifications seront envoyées au retour du réseau",
  error: "Échec de la synchronisation",
};

function App() {
  const { authReady, session, syncStatus } = useStore();
  const [tab, setTab] = useState<string>(() => location.hash.slice(1) || "suivi");
  const go = (id: string) => {
    setTab(id);
    history.replaceState(null, "", "#" + id);
  };
  if (supabase && !authReady) return null;
  if (supabase && !session) return <Login />;
  return (
    <>
      <header className="top">
        <h1>Nutrition</h1>
        {supabase && <span className={`sync-dot sync-${syncStatus}`} title={SYNC_LABELS[syncStatus]} aria-label={SYNC_LABELS[syncStatus]} />}
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>{TABS.find((t) => t.id === tab)?.el ?? TABS[0].el}</main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
