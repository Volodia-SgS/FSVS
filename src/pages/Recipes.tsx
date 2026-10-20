import { useState } from "react";
import { FoodPicker } from "../components/FoodPicker";
import { Modal } from "../components/Modal";
import { computedRecipeValues, fmt, itemValues, newId, recipeValues, unitLabel, unitsFor } from "../nutrition";
import { useStore } from "../store";
import type { Recipe, Unit } from "../types";
import { NUTRIENTS } from "../types";
import { NumberInput } from "./Tracking";

export function Recipes() {
  const { data, update } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(data.recipes[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const list = data.recipes
    .filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const selected = data.recipes.find((r) => r.id === selectedId);

  const save = (next: Recipe) => update((d) => void (d.recipes = d.recipes.map((r) => (r.id === next.id ? next : r))));

  const remove = (recipe: Recipe) => {
    const usedIn = Object.values(data.days).filter((es) => es.some((e) => e.kind === "recipe" && e.refId === recipe.id)).length;
    const msg = usedIn
      ? `Cette recette est utilisée dans ${usedIn} jour(s) du suivi : ces entrées seront supprimées. Continuer ?`
      : "Supprimer cette recette ?";
    if (!confirm(msg)) return;
    update((d) => {
      d.recipes = d.recipes.filter((r) => r.id !== recipe.id);
      for (const k of Object.keys(d.days)) d.days[k] = d.days[k].filter((e) => !(e.kind === "recipe" && e.refId === recipe.id));
      for (const plan of Object.values(d.mealPlans))
        for (const slot of Object.keys(plan.meals) as (keyof typeof plan.meals)[])
          plan.meals[slot] = plan.meals[slot]!.filter((e) => !(e.kind === "recipe" && e.refId === recipe.id));
    });
    setSelectedId(null);
  };

  return (
    <div className="split">
      <aside className="card list">
        <div className="list-head">
          <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="primary" onClick={() => setCreating(true)}>
            + Recette
          </button>
        </div>
        <ul>
          {list.map((r) => {
            const v = recipeValues(data, r);
            return (
              <li key={r.id} className={r.id === selectedId ? "active" : ""} onClick={() => setSelectedId(r.id)}>
                <span>{r.name}</span>
                <span className="muted small">
                  {fmt(v[0], "kcal")} kcal · {fmt(v[1])} g P
                </span>
              </li>
            );
          })}
        </ul>
      </aside>
      {selected ? (
        <section className="card editor">
          <RecipeForm key={selected.id} recipe={selected} onChange={save} />
          <div className="row-actions end">
            <button className="ghost danger" onClick={() => remove(selected)}>
              Supprimer la recette
            </button>
          </div>
        </section>
      ) : (
        <section className="card muted">Choisis ou crée une recette.</section>
      )}
      {creating && (
        <NewRecipeModal
          onClose={() => setCreating(false)}
          onCreate={(r) => {
            update((d) => void d.recipes.push(r));
            setSelectedId(r.id);
            setQ("");
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function NewRecipeModal({ onClose, onCreate }: { onClose: () => void; onCreate: (r: Recipe) => void }) {
  const [draft, setDraft] = useState<Recipe>(() => ({ id: newId("rec"), name: "", portions: 1, items: [] }));
  const valid = draft.name.trim() !== "";
  return (
    <Modal title="Nouvelle recette" onClose={onClose}>
      <RecipeForm recipe={draft} onChange={setDraft} autoFocus />
      <div className="modal-foot">
        <button onClick={onClose}>Annuler</button>
        <button className="primary" disabled={!valid} onClick={() => onCreate({ ...draft, name: draft.name.trim() })}>
          Créer la recette
        </button>
      </div>
    </Modal>
  );
}

function RecipeForm({ recipe, onChange, autoFocus }: { recipe: Recipe; onChange: (r: Recipe) => void; autoFocus?: boolean }) {
  const { data } = useStore();
  const edit = (fn: (r: Recipe) => void) => {
    const next = structuredClone(recipe);
    fn(next);
    onChange(next);
  };
  const computed = computedRecipeValues(data, recipe);

  return (
    <>
      <div className="editor-head">
        <input
          className="title-input"
          placeholder="Nom de la recette"
          autoFocus={autoFocus}
          value={recipe.name}
          onChange={(e) => edit((r) => void (r.name = e.target.value))}
        />
        <label className="inline">
          Donne
          <NumberInput className="short" value={recipe.portions} onChange={(n) => edit((r) => void (r.portions = Math.max(n, 1)))} />
          repas
        </label>
      </div>

      <h3>Ingrédients (recette complète)</h3>
      {recipe.items.length === 0 && <p className="muted">Aucun ingrédient.</p>}
      <ul className="entries">
        {recipe.items.map((it, idx) => {
          const ing = data.ingredients.find((i) => i.id === it.refId);
          const v = itemValues(data, it);
          return (
            <li className="entry" key={idx}>
              <div className="entry-name">{ing?.name ?? "(supprimé)"}</div>
              <div className="entry-qty">
                <NumberInput value={it.qty} onChange={(n) => edit((r) => void (r.items[idx].qty = n))} />
                {ing && unitsFor(ing).length > 1 ? (
                  <select value={it.unit} onChange={(e) => edit((r) => void (r.items[idx].unit = e.target.value as Unit))}>
                    {unitsFor(ing).map((u) => (
                      <option key={u} value={u}>
                        {unitLabel(ing, u, it.qty)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="muted">{unitLabel(ing, it.unit, it.qty)}</span>
                )}
              </div>
              <div className="entry-macros">
                <b>{fmt(v[0], "kcal")}</b> kcal · P {fmt(v[1])} · G {fmt(v[2])} · L {fmt(v[4])}
              </div>
              <button className="ghost danger" onClick={() => edit((r) => void r.items.splice(idx, 1))} aria-label="Retirer">
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <FoodPicker
        allowRecipes={false}
        onAdd={(p) => p.kind === "ingredient" && edit((r) => void r.items.push({ refId: p.refId, qty: p.qty, unit: p.unit }))}
      />

      <h3>Valeurs pour 1 repas</h3>
      <label className="inline">
        <input
          type="checkbox"
          checked={!!recipe.manualValues}
          onChange={(e) => edit((r) => void (r.manualValues = e.target.checked ? [...computed] : undefined))}
        />
        Saisir les valeurs à la main plutôt que les calculer
      </label>
      <div className="table-wrap">
        <table className="grid values">
          <thead>
            <tr>
              <th />
              {NUTRIENTS.map((n) => (
                <th key={n.key}>{n.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className={recipe.manualValues ? "dim" : ""}>
              <td>Calculé</td>
              {computed.map((v, i) => (
                <td key={i}>{fmt(v, NUTRIENTS[i].key)}</td>
              ))}
            </tr>
            {recipe.manualValues && (
              <tr>
                <td>Utilisé</td>
                {recipe.manualValues.map((v, i) => (
                  <td key={i}>
                    <NumberInput
                      value={Math.round(v * 100) / 100}
                      onChange={(n) => edit((r) => void (r.manualValues![i] = n))}
                    />
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {recipe.manualValues && (
        <p className="muted small">
          Ces valeurs priment sur le calcul. Une fois les ingrédients complets, décoche la case pour passer au calcul automatique.
        </p>
      )}

      <h3>Notes</h3>
      <textarea value={recipe.notes ?? ""} rows={2} onChange={(e) => edit((r) => void (r.notes = e.target.value))} />
    </>
  );
}
