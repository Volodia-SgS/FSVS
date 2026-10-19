import { useMemo, useState } from "react";
import { FoodGridModal } from "../components/FoodGridModal";
import { add, dayTotal, entryValues, fmt, levelFor, newId, scale, unitLabel, unitsFor, zero } from "../nutrition";
import { shiftDate, todayIso } from "../dates";
import { useStore } from "../store";
import type { Entry, Unit, Values } from "../types";
import { MEAL_CATEGORY, NUTRIENTS } from "../types";

const longDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

const shortDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });

export function Tracking() {
  const [date, setDate] = useState(todayIso);

  return (
    <div className="tracking">
      <DayEditor date={date} setDate={setDate} />
      <History selected={date} onSelect={setDate} />
    </div>
  );
}

function DayEditor({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const { data, update } = useStore();
  const entries = data.days[date] ?? [];
  const total = dayTotal(data, entries);
  const [customOpen, setCustomOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const setEntries = (fn: (list: Entry[]) => Entry[]) =>
    update((d) => {
      const next = fn(d.days[date] ?? []);
      if (next.length) d.days[date] = next;
      else delete d.days[date];
    });

  const previousDay = Object.keys(data.days)
    .filter((k) => k < date && data.days[k].length)
    .sort()
    .pop();

  return (
    <section className="card day">
      <header className="day-head">
        <button className="ghost" onClick={() => setDate(shiftDate(date, -1))} aria-label="Jour précédent">
          ‹
        </button>
        <div className="day-title">
          <h2>{longDate(date)}</h2>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <button className="ghost" onClick={() => setDate(shiftDate(date, 1))} aria-label="Jour suivant">
          ›
        </button>
        {date !== todayIso() && (
          <button className="ghost small" onClick={() => setDate(todayIso())}>
            Aujourd'hui
          </button>
        )}
      </header>

      <Summary total={total} />

      <PlannedMeals date={date} onEat={(foods) => setEntries((l) => [...l, ...foods.map((f) => ({ ...structuredClone(f), id: newId("e") }))])} />

      <h3>Ce que j'ai mangé</h3>
      {entries.length === 0 && (
        <p className="muted">
          Rien de saisi pour ce jour.
          {previousDay && (
            <>
              {" "}
              <button
                className="link"
                onClick={() =>
                  setEntries(() => data.days[previousDay].map((e) => ({ ...structuredClone(e), id: newId("e") })))
                }
              >
                Copier le {shortDate(previousDay)}
              </button>
            </>
          )}
        </p>
      )}
      <ul className="entries">
        {entries.map((e) => (
          <EntryRow
            key={e.id}
            entry={e}
            onChange={(next) => setEntries((l) => l.map((x) => (x.id === e.id ? next : x)))}
            onDelete={() => setEntries((l) => l.filter((x) => x.id !== e.id))}
          />
        ))}
      </ul>

      <button className="add-food" onClick={() => setPickerOpen(true)}>
        + Ajouter un aliment
      </button>
      {pickerOpen && (
        <FoodGridModal
          onClose={() => setPickerOpen(false)}
          onAdd={(p) => setEntries((l) => [...l, { ...p, id: newId("e") } as Entry])}
        />
      )}
      <div className="row-actions">
        <button className="link" onClick={() => setCustomOpen((o) => !o)}>
          {customOpen ? "Fermer la saisie libre" : "+ Saisie libre (restaurant, plat sans recette…)"}
        </button>
      </div>
      {customOpen && (
        <CustomForm
          onAdd={(label, values) => {
            setEntries((l) => [...l, { id: newId("e"), kind: "custom", label, values }]);
            setCustomOpen(false);
          }}
        />
      )}
    </section>
  );
}

function Summary({ total }: { total: Values }) {
  const { data } = useStore();
  return (
    <div className="summary">
      {NUTRIENTS.map((n, i) => {
        const obj = data.objectives[n.key];
        const v = total[i];
        const level = levelFor(v, obj);
        const ref = obj?.target ?? obj?.max ?? obj?.min;
        const pct = ref ? Math.min((v / ref) * 100, 130) : 0;
        let hint = "";
        if (obj?.min != null && v < obj.min) hint = `encore ${fmt(obj.min - v, n.key)} pour le min.`;
        else if (obj?.max != null && v > obj.max) hint = `${fmt(v - obj.max, n.key)} au-dessus du max.`;
        else if (obj?.target != null) {
          const d = obj.target - v;
          hint = Math.abs(d) < (n.key === "kcal" ? 25 : 2) ? "objectif atteint" : d > 0 ? `${fmt(d, n.key)} avant l'objectif` : `objectif +${fmt(-d, n.key)}`;
        }
        return (
          <div key={n.key} className={`stat ${level ? "lv-" + level : ""}`}>
            <div className="stat-label">{n.label}</div>
            <div className="stat-value">
              {fmt(v, n.key)}
              <span className="stat-unit">
                {ref ? ` / ${fmt(ref, n.key)}` : ""} {n.unit}
              </span>
            </div>
            {ref ? (
              <div className="bar">
                <div style={{ width: `${(pct / 130) * 100}%` }} />
                <span className="bar-mark" style={{ left: `${(100 / 130) * 100}%` }} />
              </div>
            ) : null}
            {obj && (obj.min != null || obj.max != null) && (
              <div className="stat-hint">
                {obj.min != null && obj.max != null
                  ? `${fmt(obj.min, n.key)}–${fmt(obj.max, n.key)}`
                  : obj.min != null
                    ? `≥ ${fmt(obj.min, n.key)}`
                    : `≤ ${fmt(obj.max!, n.key)}`}
                {hint && ` · ${hint}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EntryRow({ entry, onChange, onDelete }: { entry: Entry; onChange: (e: Entry) => void; onDelete: () => void }) {
  const { data } = useStore();
  const v = entryValues(data, entry);
  const ing = entry.kind === "ingredient" ? data.ingredients.find((i) => i.id === entry.refId) : undefined;
  const rec = entry.kind === "recipe" ? data.recipes.find((r) => r.id === entry.refId) : undefined;
  const name = entry.kind === "custom" ? entry.label : (ing?.name ?? rec?.name ?? "(supprimé)");

  return (
    <li className="entry">
      <div className="entry-name">
        {name}
        {rec && <span className="tag">recette</span>}
        {entry.kind === "custom" && <span className="tag">libre</span>}
      </div>
      <div className="entry-qty">
        {entry.kind !== "custom" && (
          <>
            <NumberInput value={entry.qty} onChange={(qty) => onChange({ ...entry, qty })} />
            {entry.kind === "recipe" ? (
              <span className="muted">portion{entry.qty > 1 ? "s" : ""}</span>
            ) : ing && unitsFor(ing).length > 1 ? (
              <select value={entry.unit} onChange={(e) => onChange({ ...entry, unit: e.target.value as Unit })}>
                {unitsFor(ing).map((u) => (
                  <option key={u} value={u}>
                    {unitLabel(ing, u, entry.qty)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="muted">{unitLabel(ing, entry.unit, entry.qty)}</span>
            )}
          </>
        )}
      </div>
      <div className="entry-macros">
        <b>{fmt(v[0], "kcal")}</b> kcal · P {fmt(v[1])} · G {fmt(v[2])} · L {fmt(v[4])}
      </div>
      <button className="ghost danger" onClick={onDelete} aria-label="Supprimer">
        ×
      </button>
    </li>
  );
}

export function NumberInput({ value, onChange, className }: { value: number | undefined; onChange: (n: number) => void; className?: string }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      className={"num " + (className ?? "")}
      inputMode="decimal"
      value={text ?? (value == null ? "" : String(value).replace(".", ","))}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value.replace(",", "."));
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setText(null)}
    />
  );
}

function CustomForm({ onAdd }: { onAdd: (label: string, values: Values) => void }) {
  const [label, setLabel] = useState("");
  const [values, setValues] = useState<Values>(zero);
  return (
    <form
      className="custom-form"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(label.trim() || "Saisie libre", values);
      }}
    >
      <input placeholder="Libellé (ex. Burger King)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="values-grid">
        {NUTRIENTS.map((n, i) => (
          <label key={n.key}>
            <span>{n.short}</span>
            <NumberInput value={values[i] || undefined} onChange={(x) => setValues((v) => v.map((y, j) => (j === i ? x : y)))} />
          </label>
        ))}
      </div>
      <button className="primary" type="submit">
        Ajouter
      </button>
    </form>
  );
}

function History({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const { data } = useStore();
  const rows = useMemo(
    () =>
      Object.keys(data.days)
        .filter((k) => data.days[k].length)
        .sort()
        .reverse()
        .map((k) => ({ date: k, total: dayTotal(data, data.days[k]) })),
    [data],
  );
  // La journée en cours fausserait la moyenne : on ne garde que les jours passés.
  const last7 = rows.filter((r) => r.date < todayIso()).slice(0, 7);
  const avg = last7.length ? scale(last7.reduce((a, r) => add(a, r.total), zero()), 1 / last7.length) : null;

  return (
    <section className="card history">
      <h2>Historique</h2>
      <p className="muted">
        Couleurs : <span className="pill lv-ok">dans l'objectif</span> <span className="pill lv-warn">un peu bas / haut</span>{" "}
        <span className="pill lv-alert">à corriger</span>
      </p>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Date</th>
              {NUTRIENTS.map((n) => (
                <th key={n.key}>{n.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {avg && (
              <tr className="avg">
                <td>Moy. {last7.length} j</td>
                {NUTRIENTS.map((n, i) => (
                  <Cell key={n.key} value={avg[i]} nkey={n.key} />
                ))}
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.date} className={r.date === selected ? "selected" : ""} onClick={() => onSelect(r.date)}>
                <td className="date">{shortDate(r.date)}</td>
                {NUTRIENTS.map((n, i) => (
                  <Cell key={n.key} value={r.total[i]} nkey={n.key} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="muted">Aucun jour suivi pour l'instant.</p>}
    </section>
  );
}

function Cell({ value, nkey }: { value: number; nkey: (typeof NUTRIENTS)[number]["key"] }) {
  const { data } = useStore();
  const level = levelFor(value, data.objectives[nkey]);
  return <td className={level ? "lv-" + level : ""}>{fmt(value, nkey)}</td>;
}

/** Repas planifiés dans l'emploi du temps pour ce jour, à reporter dans le suivi. */
function PlannedMeals({ date, onEat }: { date: string; onEat: (foods: Entry[]) => void }) {
  const { data, update } = useStore();
  const meals = data.schedule.events
    .filter((e) => e.date === date && e.categoryId === MEAL_CATEGORY && e.foods?.length)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!meals.length) return null;

  return (
    <>
      <h3>Repas prévus</h3>
      <ul className="planned">
        {meals.map((m) => {
          const v = dayTotal(data, m.foods!);
          return (
            <li key={m.id} className={m.eaten ? "done" : ""}>
              <div>
                <span className="planned-time">{m.start}</span> <b>{m.title}</b>
                <div className="muted small">
                  {fmt(v[0], "kcal")} kcal · P {fmt(v[1])} · G {fmt(v[2])} · L {fmt(v[4])}
                </div>
              </div>
              {m.eaten ? (
                <span className="muted small">✓ dans le suivi</span>
              ) : (
                <button
                  className="small"
                  onClick={() => {
                    onEat(m.foods!);
                    update((d) => {
                      const ev = d.schedule.events.find((x) => x.id === m.id);
                      if (ev) ev.eaten = true;
                    });
                  }}
                >
                  Ajouter au suivi
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
