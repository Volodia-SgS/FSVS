import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BudgetMonthPage, BudgetOverview, BudgetTemplate } from "./pages/Budget";
import { Ingredients } from "./pages/Ingredients";
import { Login } from "./pages/Login";
import { Objectives } from "./pages/Objectives";
import { Recipes } from "./pages/Recipes";
import { Schedule } from "./pages/Schedule";
import { Tasks } from "./pages/Tasks";
import { Tracking } from "./pages/Tracking";
import { StoreProvider, useStore, type SyncStatus } from "./store";
import { supabase } from "./supabase";
import "./styles.css";

interface Tab {
  id: string;
  label: string;
  el: ReactNode;
}

interface Section {
  id: string;
  label: string;
  icon: string;
  tabs: Tab[];
}

const SECTIONS: Section[] = [
  {
    id: "nutrition",
    label: "Nutrition",
    icon: "🥗",
    tabs: [
      { id: "suivi", label: "Suivi", el: <Tracking /> },
      { id: "recettes", label: "Recettes", el: <Recipes /> },
      { id: "ingredients", label: "Ingrédients", el: <Ingredients /> },
      { id: "objectifs", label: "Objectifs", el: <Objectives /> },
    ],
  },
  { id: "agenda", label: "Emploi du temps", icon: "📅", tabs: [{ id: "semaine", label: "Semaine", el: <Schedule /> }] },
  { id: "taches", label: "Tâches", icon: "✅", tabs: [{ id: "liste", label: "À faire", el: <Tasks /> }] },
  { id: "projets", label: "Projets", icon: "🗂️", tabs: [{ id: "accueil", label: "Projets", el: <ComingSoon name="Projets" /> }] },
  {
    id: "finance",
    label: "Finance",
    icon: "💶",
    tabs: [
      { id: "mois", label: "Mois", el: <BudgetMonthPage /> },
      { id: "bilan", label: "Bilan", el: <BudgetOverview /> },
      { id: "modele", label: "Modèle", el: <BudgetTemplate /> },
    ],
  },
];

const SYNC_LABELS: Record<SyncStatus, string> = {
  local: "Données locales uniquement",
  syncing: "Synchronisation…",
  synced: "Synchronisé",
  offline: "Hors ligne : les modifications seront envoyées au retour du réseau",
  error: "Échec de la synchronisation",
};

/** Lit « #section/onglet » ; les anciens liens « #suivi » renvoient vers la Nutrition. */
function parseHash(): [string, string] {
  const [a, b] = location.hash.slice(1).split("/");
  const section = SECTIONS.find((s) => s.id === a);
  if (section) return [section.id, b && section.tabs.some((t) => t.id === b) ? b : section.tabs[0].id];
  const nutrition = SECTIONS[0];
  return [nutrition.id, nutrition.tabs.some((t) => t.id === a) ? a : nutrition.tabs[0].id];
}

function ComingSoon({ name }: { name: string }) {
  return (
    <section className="card coming-soon">
      <h2>{name}</h2>
      <p className="muted">Cette partie arrive bientôt.</p>
    </section>
  );
}

function App() {
  const { authReady, session, syncStatus } = useStore();
  const [[sectionId, tabId], setRoute] = useState<[string, string]>(parseHash);
  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];
  const tab = section.tabs.find((t) => t.id === tabId) ?? section.tabs[0];

  // Thème de couleur de la section, repris aussi par la barre du navigateur sur mobile.
  useEffect(() => {
    document.documentElement.dataset.section = section.id;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", accent);
  }, [section.id]);

  const go = (s: Section, t: Tab = s.tabs[0]) => {
    setRoute([s.id, t.id]);
    history.replaceState(null, "", `#${s.id}/${t.id}`);
  };

  if (supabase && !authReady) return null;
  if (supabase && !session) return <Login />;
  return (
    <>
      <header className="top">
        {supabase && <span className={`sync-dot sync-${syncStatus}`} title={SYNC_LABELS[syncStatus]} aria-label={SYNC_LABELS[syncStatus]} />}
        <nav className="sections">
          {SECTIONS.map((s) => (
            <button key={s.id} className={s.id === section.id ? "active" : ""} onClick={() => go(s)}>
              <span aria-hidden>{s.icon}</span> {s.label}
            </button>
          ))}
        </nav>
      </header>
      {section.tabs.length > 1 && (
        <nav className="subnav">
          {section.tabs.map((t) => (
            <button key={t.id} className={t.id === tab.id ? "active" : ""} onClick={() => go(section, t)}>
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <main key={section.id}>{tab.el}</main>
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
