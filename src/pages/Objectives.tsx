import { useRef } from "react";
import { exportJson, seedData, useStore } from "../store";
import { supabase } from "../supabase";
import type { AppData, Level, Objective } from "../types";
import { NUTRIENTS } from "../types";
import { NumberInput } from "./Tracking";

const LEVELS: { value: Level; label: string }[] = [
  { value: "ok", label: "Vert (OK)" },
  { value: "warn", label: "Jaune (à surveiller)" },
  { value: "alert", label: "Orange (à corriger)" },
];

export function Objectives() {
  const { data, update, replace, session } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const edit = (key: string, fn: (o: Objective) => void) =>
    update((d) => {
      const k = key as keyof AppData["objectives"];
      d.objectives[k] = d.objectives[k] ?? {};
      fn(d.objectives[k]);
    });

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppData;
      if (!parsed.ingredients || !parsed.days) throw new Error();
      if (confirm("Remplacer toutes les données actuelles par ce fichier ?")) replace(parsed);
    } catch {
      alert("Fichier invalide.");
    }
  };

  return (
    <>
      <section className="card">
        <h2>Objectifs journaliers</h2>
        <p className="muted small">
          Une valeur entre le min et le max est verte. En dessous ou au-dessus, choisis la couleur selon la gravité (comme la mise en
          forme conditionnelle de l'Excel). Laisse vide pour ne pas colorer.
        </p>
        <div className="table-wrap">
          <table className="grid objectives">
            <thead>
              <tr>
                <th>Nutriment</th>
                <th>Min</th>
                <th>Objectif</th>
                <th>Max</th>
                <th>Si en dessous</th>
                <th>Si au-dessus</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {NUTRIENTS.map((n) => {
                const o = data.objectives[n.key] ?? {};
                const num = (field: "min" | "target" | "max") => (
                  <NumberInput
                    value={o[field]}
                    onChange={(v) => edit(n.key, (x) => void (x[field] = v))}
                  />
                );
                const lvl = (field: "below" | "above", fallback: Level) => (
                  <select
                    className={"lv-" + (o[field] ?? fallback)}
                    value={o[field] ?? fallback}
                    onChange={(e) => edit(n.key, (x) => void (x[field] = e.target.value as Level))}
                  >
                    {LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                );
                return (
                  <tr key={n.key}>
                    <td className="name">
                      {n.label} <span className="muted">({n.unit})</span>
                    </td>
                    <td>{num("min")}</td>
                    <td>{num("target")}</td>
                    <td>{num("max")}</td>
                    <td>{lvl("below", "warn")}</td>
                    <td>{lvl("above", "alert")}</td>
                    <td>
                      <button
                        className="ghost small"
                        onClick={() => update((d) => void (d.objectives[n.key] = {}))}
                        title="Effacer l'objectif"
                      >
                        Effacer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Données</h2>
        {session ? (
          <p className="muted small">
            Connecté en tant que <b>{session.user.email}</b>. Tes données sont synchronisées entre tes appareils.{" "}
            <button className="link" onClick={() => supabase?.auth.signOut()}>
              Se déconnecter
            </button>
          </p>
        ) : (
          <p className="muted small">
            Tout est enregistré dans ce navigateur. Exporte régulièrement un fichier de sauvegarde, il sert aussi à transférer tes
            données sur un autre appareil.
          </p>
        )}
        <div className="row-actions">
          <button className="primary" onClick={() => exportJson(data)}>
            Exporter (JSON)
          </button>
          <button onClick={() => fileRef.current?.click()}>Importer un fichier…</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
          />
          <button
            className="ghost danger"
            onClick={() => confirm("Revenir aux données importées de l'Excel ? Tes modifications seront perdues.") && replace(seedData())}
          >
            Réinitialiser depuis l'Excel
          </button>
        </div>
      </section>
    </>
  );
}
