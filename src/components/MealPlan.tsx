import { useState } from "react";
import { dayTotal, fmt, newId } from "../nutrition";
import { EntryRow, Summary } from "../pages/Tracking";
import { useStore } from "../store";
import type { AppData, Entry, MealPlan, MealSlot, Values } from "../types";
import { MEAL_SLOTS, NUTRIENTS } from "../types";
import { FoodGridModal } from "./FoodGridModal";

export const planEntries = (plan: MealPlan | undefined): Entry[] =>
  MEAL_SLOTS.flatMap((s) => plan?.meals[s.id] ?? []);

export const planTotal = (data: AppData, date: string): Values => dayTotal(data, planEntries(data.mealPlans[date]));

export function Macros({ v }: { v: Values }) {
  return (
    <>
      <b>{fmt(v[0], "kcal")}</b> kcal · P {fmt(v[1])} · G {fmt(v[2])} · L {fmt(v[4])}
    </>
  );
}

/** Colonnes du tableau des repas : kcal, protéines, glucides, lipides. */
const MAIN = [0, 1, 2, 4];

/** Valeur de référence d'un objectif (cible, sinon max, sinon min). */
const refOf = (data: AppData, i: number) => {
  const o = data.objectives[NUTRIENTS[i].key];
  return o?.target ?? o?.max ?? o?.min;
};

/** Macros de chaque repas du jour en chiffres, le repas en cours mis en avant. */
function MealsTable({ date, current }: { date: string; current: MealSlot }) {
  const { data } = useStore();
  const plan = data.mealPlans[date];
  const total = planTotal(data, date);
  return (
    <>
      <h3>Macros par repas</h3>
      <table className="meals-table">
        <thead>
          <tr>
            <th />
            <th>Kcal</th>
            <th>P</th>
            <th>G</th>
            <th>L</th>
          </tr>
        </thead>
        <tbody>
          {MEAL_SLOTS.map((s) => {
            const v = dayTotal(data, plan?.meals[s.id] ?? []);
            return (
              <tr key={s.id} className={s.id === current ? "current" : ""}>
                <td>
                  <span aria-hidden>{s.icon}</span> {s.label}
                </td>
                {MAIN.map((i) => (
                  <td key={i}>{fmt(v[i], NUTRIENTS[i].key)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="total">
            <td>Total</td>
            {MAIN.map((i) => (
              <td key={i}>{fmt(total[i], NUTRIENTS[i].key)}</td>
            ))}
          </tr>
          <tr className="muted">
            <td>Objectif</td>
            {MAIN.map((i) => {
              const ref = refOf(data, i);
              return <td key={i}>{ref != null ? fmt(ref, NUTRIENTS[i].key) : "–"}</td>;
            })}
          </tr>
          <tr className="rest">
            <td>Reste</td>
            {MAIN.map((i) => {
              const ref = refOf(data, i);
              return <td key={i}>{ref != null ? fmt(ref - total[i], NUTRIENTS[i].key) : "–"}</td>;
            })}
          </tr>
        </tfoot>
      </table>
    </>
  );
}

/** Édition du plan de repas d'un jour : un bloc par repas, avec ses macros et le total du jour. */
export function MealPlanEditor({ date }: { date: string }) {
  const { data, update } = useStore();
  const [pickerFor, setPickerFor] = useState<MealSlot | null>(null);
  const plan = data.mealPlans[date];

  const setSlot = (slot: MealSlot, fn: (list: Entry[]) => Entry[]) =>
    update((d) => {
      const p = (d.mealPlans[date] ??= { meals: {} });
      const next = fn(p.meals[slot] ?? []);
      if (next.length) p.meals[slot] = next;
      else delete p.meals[slot];
      if (!planEntries(p).length) delete d.mealPlans[date];
    });

  return (
    <div className="meal-plan">
      <Summary total={planTotal(data, date)} />
      {MEAL_SLOTS.map((s) => {
        const foods = plan?.meals[s.id] ?? [];
        const done = plan?.done?.includes(s.id);
        return (
          <section key={s.id} className="meal-slot">
            <header>
              <h3>
                <span aria-hidden>{s.icon}</span> {s.label}
                {done && <span className="tag">dans le suivi</span>}
              </h3>
              {foods.length > 0 && (
                <span className="small muted">
                  <Macros v={dayTotal(data, foods)} />
                </span>
              )}
            </header>
            {foods.length > 0 && (
              <ul className="entries">
                {foods.map((f) => (
                  <EntryRow
                    key={f.id}
                    entry={f}
                    onChange={(next) => setSlot(s.id, (l) => l.map((x) => (x.id === f.id ? next : x)))}
                    onDelete={() => setSlot(s.id, (l) => l.filter((x) => x.id !== f.id))}
                  />
                ))}
              </ul>
            )}
            <button className="add-food small" onClick={() => setPickerFor(s.id)}>
              + Ajouter un aliment
            </button>
          </section>
        );
      })}
      {pickerFor && (
        <FoodGridModal
          title={`Ajouter au ${MEAL_SLOTS.find((s) => s.id === pickerFor)!.label.toLowerCase()}`.replace("au collation", "à la collation")}
          left={
            <>
              <h3>Journée</h3>
              <Summary total={planTotal(data, date)} className="vertical" />
            </>
          }
          right={<MealsTable date={date} current={pickerFor} />}
          compact={<CompactDay date={date} />}
          onClose={() => setPickerFor(null)}
          onAdd={(p) => setSlot(pickerFor, (l) => [...l, { ...p, id: newId("e") } as Entry])}
        />
      )}
    </div>
  );
}

/** Résumé d'une ligne des macros du jour, pour les petits écrans. */
function CompactDay({ date }: { date: string }) {
  const { data } = useStore();
  const total = planTotal(data, date);
  return (
    <>
      Journée :{" "}
      {MAIN.map((i, k) => {
        const ref = refOf(data, i);
        return (
          <span key={i}>
            {k > 0 && " · "}
            {i === 0 ? "" : NUTRIENTS[i].short.charAt(0) + " "}
            <b>{fmt(total[i], NUTRIENTS[i].key)}</b>
            {ref != null && `/${fmt(ref, NUTRIENTS[i].key)}`}
            {i === 0 ? " kcal" : ""}
          </span>
        );
      })}
    </>
  );
}
