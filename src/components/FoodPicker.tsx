import { useMemo, useRef, useState } from "react";
import { defaultUnit, unitLabel, unitsFor } from "../nutrition";
import { useStore } from "../store";
import type { Unit } from "../types";
import { Combobox, type Option } from "./Combobox";

export type Pick =
  | { kind: "ingredient"; refId: string; qty: number; unit: Unit }
  | { kind: "recipe"; refId: string; qty: number };

/** Sélection d'un aliment + quantité, façon « une ligne de formule Excel ». */
export function FoodPicker({ onAdd, allowRecipes = true }: { onAdd: (p: Pick) => void; allowRecipes?: boolean }) {
  const { data } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<Unit>("g");
  const qtyRef = useRef<HTMLInputElement>(null);

  const options = useMemo<Option[]>(() => {
    const ings = data.ingredients.map((i) => ({ id: i.id, label: i.name }));
    const recs = allowRecipes ? data.recipes.map((r) => ({ id: r.id, label: r.name, hint: "recette" })) : [];
    return [...recs, ...ings].sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [data.ingredients, data.recipes, allowRecipes]);

  const ing = data.ingredients.find((i) => i.id === selectedId);
  const rec = data.recipes.find((r) => r.id === selectedId);

  const select = (id: string) => {
    setSelectedId(id);
    const i = data.ingredients.find((x) => x.id === id);
    if (i) {
      setUnit(defaultUnit(i));
      setQty(i.basis === "portion" ? "1" : "");
    } else {
      setQty("1");
    }
    setTimeout(() => qtyRef.current?.select());
  };

  const n = parseFloat(qty.replace(",", "."));
  const valid = (ing || rec) && Number.isFinite(n) && n !== 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onAdd(rec ? { kind: "recipe", refId: rec.id, qty: n } : { kind: "ingredient", refId: ing!.id, qty: n, unit });
    setSelectedId(null);
    setQty("");
  };

  const units = ing ? unitsFor(ing) : [];

  return (
    <form className="picker" onSubmit={submit}>
      <Combobox
        className="picker-name"
        options={options}
        value={selectedId}
        onChange={select}
        placeholder={allowRecipes ? "Choisir un ingrédient ou une recette…" : "Choisir un ingrédient…"}
      />
      <input
        ref={qtyRef}
        className="picker-qty"
        inputMode="decimal"
        placeholder="Qté"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
      />
      {units.length > 1 ? (
        <select className="picker-unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
          {units.map((u) => (
            <option key={u} value={u}>
              {unitLabel(ing, u)}
              {u === "unit" && ing?.unitWeight ? ` (${ing.unitWeight} g)` : ""}
            </option>
          ))}
        </select>
      ) : (
        <span className="picker-unit">{rec ? "portion(s)" : unitLabel(ing, units[0] ?? "g")}</span>
      )}
      <button type="submit" className="primary" disabled={!valid}>
        Ajouter
      </button>
    </form>
  );
}
