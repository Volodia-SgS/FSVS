import { useState } from "react";
import { Modal } from "../components/Modal";
import { guessCategory } from "../foodCategories";
import { fmt, newId, zero } from "../nutrition";
import { useStore } from "../store";
import type { FoodCategoryId, Ingredient } from "../types";
import { FOOD_CATEGORIES, NUTRIENTS } from "../types";

const categoryOf = (ing: Ingredient) => FOOD_CATEGORIES.find((c) => c.id === (ing.category ?? guessCategory(ing.name)))!;

function CategorySelect({ value, onChange }: { value: FoodCategoryId; onChange: (c: FoodCategoryId) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as FoodCategoryId)}>
      {FOOD_CATEGORIES.map((c) => (
        <option key={c.id} value={c.id}>
          {c.icon} {c.label}
        </option>
      ))}
    </select>
  );
}
import { NumberInput } from "./Tracking";

export function Ingredients() {
  const { data, update } = useStore();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const list = data.ingredients
    .filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const edit = (id: string, fn: (i: Ingredient) => void) =>
    update((d) => {
      const i = d.ingredients.find((x) => x.id === id);
      if (i) fn(i);
    });

  const create = (ing: Ingredient) => {
    update((d) => void d.ingredients.push(ing));
    setCreating(false);
    setQ("");
    setFlash(ing.id);
    setTimeout(() => document.getElementById(ing.id)?.scrollIntoView({ block: "center" }), 50);
  };

  const remove = (ing: Ingredient) => {
    const used =
      data.recipes.some((r) => r.items.some((it) => it.refId === ing.id)) ||
      [...Object.values(data.days), ...Object.values(data.mealPlans).flatMap((p) => Object.values(p.meals))].some((es) =>
        es?.some((e) => e.kind === "ingredient" && e.refId === ing.id),
      );
    if (used) return alert("Cet ingrédient est utilisé dans une recette, un jour du suivi ou un plan de repas : retire-le d'abord.");
    if (confirm(`Supprimer « ${ing.name} » ?`)) update((d) => void (d.ingredients = d.ingredients.filter((x) => x.id !== ing.id)));
  };

  return (
    <section className="card">
      <div className="list-head">
        <input placeholder="Rechercher un ingrédient…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="primary" onClick={() => setCreating(true)}>
          + Ingrédient
        </button>
      </div>
      <p className="muted small">
        Valeurs pour 100 g, sauf les ingrédients marqués « portion » (ex. 1 scoop de whey). Le poids d'une unité permet de saisir
        « 3 œufs » au lieu de grammes.
      </p>
      <div className="table-wrap">
        <table className="grid ingredients">
          <thead>
            <tr>
              <th>Nom</th>
              <th className="cat">Rayon</th>
              <th>Pour</th>
              {NUTRIENTS.map((n) => (
                <th key={n.key}>{n.short}</th>
              ))}
              <th>1 unité</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((ing) =>
              editing === ing.id ? (
                <tr key={ing.id} className="editing">
                  <td>
                    <input value={ing.name} onChange={(e) => edit(ing.id, (i) => void (i.name = e.target.value))} />
                  </td>
                  <td>
                    <CategorySelect value={categoryOf(ing).id} onChange={(c) => edit(ing.id, (i) => void (i.category = c))} />
                  </td>
                  <td>
                    <select
                      value={ing.basis}
                      onChange={(e) => edit(ing.id, (i) => void (i.basis = e.target.value as Ingredient["basis"]))}
                    >
                      <option value="100g">100 g</option>
                      <option value="portion">portion</option>
                    </select>
                    {ing.basis === "portion" && (
                      <input
                        className="short"
                        placeholder="nom"
                        value={ing.unitLabel ?? ""}
                        onChange={(e) => edit(ing.id, (i) => void (i.unitLabel = e.target.value || undefined))}
                      />
                    )}
                  </td>
                  {ing.values.map((v, k) => (
                    <td key={k}>
                      <NumberInput value={v} onChange={(n) => edit(ing.id, (i) => void (i.values[k] = n))} />
                    </td>
                  ))}
                  <td>
                    <NumberInput
                      value={ing.unitWeight}
                      onChange={(n) => edit(ing.id, (i) => void (i.unitWeight = n > 0 ? n : undefined))}
                    />
                  </td>
                  <td className="actions">
                    <button className="primary small" onClick={() => setEditing(null)}>
                      OK
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={ing.id} id={ing.id} className={flash === ing.id ? "flash" : ""} onClick={() => setEditing(ing.id)}>
                  <td className="name">{ing.name}</td>
                  <td className="cat" title={categoryOf(ing).label}>
                    {categoryOf(ing).icon} {categoryOf(ing).label}
                  </td>
                  <td>{ing.basis === "portion" ? <span className="tag">{ing.unitLabel || "portion"}</span> : "100 g"}</td>
                  {ing.values.map((v, k) => (
                    <td key={k}>{fmt(v, NUTRIENTS[k].key)}</td>
                  ))}
                  <td>{ing.unitWeight ? `${fmt(ing.unitWeight)} g` : ""}</td>
                  <td className="actions">
                    <button
                      className="ghost danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(ing);
                      }}
                      aria-label="Supprimer"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {creating && <NewIngredientModal initialName={q.trim()} onClose={() => setCreating(false)} onCreate={create} />}
    </section>
  );
}

function NewIngredientModal({
  initialName,
  onClose,
  onCreate,
}: {
  initialName: string;
  onClose: () => void;
  onCreate: (ing: Ingredient) => void;
}) {
  const [draft, setDraft] = useState<Ingredient>(() => ({ id: newId("ing"), name: initialName, basis: "100g", values: zero() }));
  // Tant que le rayon n'a pas été choisi à la main, on le devine d'après le nom.
  const category = draft.category ?? guessCategory(draft.name);
  const set = (patch: Partial<Ingredient>) => setDraft((d) => ({ ...d, ...patch }));
  const valid = draft.name.trim() !== "";

  return (
    <Modal title="Nouvel ingrédient" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onCreate({ ...draft, name: draft.name.trim(), category });
        }}
      >
        <div className="form-grid">
          <label className="wide">
            Nom
            <input autoFocus value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="wide">
            Rayon
            <CategorySelect value={category} onChange={(c) => set({ category: c })} />
          </label>
          <label>
            Valeurs indiquées pour
            <select value={draft.basis} onChange={(e) => set({ basis: e.target.value as Ingredient["basis"] })}>
              <option value="100g">100 g</option>
              <option value="portion">1 portion (scoop, barre…)</option>
            </select>
          </label>
          {draft.basis === "portion" ? (
            <label>
              Nom de la portion
              <input
                placeholder="ex. scoop"
                value={draft.unitLabel ?? ""}
                onChange={(e) => set({ unitLabel: e.target.value || undefined })}
              />
            </label>
          ) : (
            <label>
              Poids d'une unité en g (facultatif)
              <NumberInput value={draft.unitWeight} onChange={(n) => set({ unitWeight: n > 0 ? n : undefined })} />
            </label>
          )}
        </div>
        <h3>Valeurs nutritionnelles {draft.basis === "portion" ? "pour 1 portion" : "pour 100 g"}</h3>
        <div className="values-grid">
          {NUTRIENTS.map((n, i) => (
            <label key={n.key}>
              <span>
                {n.label} ({n.unit})
              </span>
              <NumberInput
                value={draft.values[i] || undefined}
                onChange={(x) => set({ values: draft.values.map((y, j) => (j === i ? x : y)) })}
              />
            </label>
          ))}
        </div>
        <div className="modal-foot">
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={!valid}>
            Créer l'ingrédient
          </button>
        </div>
      </form>
    </Modal>
  );
}
