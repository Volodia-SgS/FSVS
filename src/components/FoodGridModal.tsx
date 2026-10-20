import { useMemo, useRef, useState, type ReactNode } from "react";
import { guessCategory } from "../foodCategories";
import { defaultUnit, fmt, recipeValues, unitLabel, unitsFor } from "../nutrition";
import { useStore } from "../store";
import type { Unit } from "../types";
import { FOOD_CATEGORIES } from "../types";
import type { Pick } from "./FoodPicker";
import { Modal } from "./Modal";

interface Card {
  id: string;
  group: string;
  kind: "ingredient" | "recipe";
  name: string;
  kcal: number;
  prot: number;
  per: string;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

/** Rubriques du choix : les recettes d'abord, puis les rayons. */
const GROUPS = [{ id: "recette", label: "Mes recettes", icon: "⭐" }, ...FOOD_CATEGORIES];

/** Choix d'un aliment : cartes classées par rayon, puis quantité. */
export function FoodGridModal({
  onAdd,
  onClose,
  title = "Ajouter un aliment",
  left,
  right,
  compact,
}: {
  onAdd: (p: Pick) => void;
  onClose: () => void;
  title?: string;
  /** Panneaux latéraux (grand écran) et leur résumé d'une ligne (petit écran). */
  left?: ReactNode;
  right?: ReactNode;
  compact?: ReactNode;
}) {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<Unit>("g");
  const [added, setAdded] = useState<string[]>([]);
  const qtyRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const cards: Card[] = [
      ...data.ingredients.map((i) => ({
        id: i.id,
        kind: "ingredient" as const,
        group: i.category ?? guessCategory(i.name),
        name: i.name,
        kcal: i.values[0],
        prot: i.values[1],
        per: i.basis === "portion" ? `/ ${i.unitLabel || "portion"}` : "/ 100 g",
      })),
      ...data.recipes.map((r) => {
        const v = recipeValues(data, r);
        return { id: r.id, kind: "recipe" as const, group: "recette", name: r.name, kcal: v[0], prot: v[1], per: "/ repas" };
      }),
    ];
    const nq = norm(q.trim());
    const shown = cards.filter((c) => norm(c.name).includes(nq)).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return GROUPS.map((g) => ({ ...g, cards: shown.filter((c) => c.group === g.id) })).filter((g) => g.cards.length);
  }, [data, q]);

  const ing = data.ingredients.find((i) => i.id === selectedId);
  const rec = data.recipes.find((r) => r.id === selectedId);
  const units = ing ? unitsFor(ing) : [];

  const select = (c: Card) => {
    setSelectedId(c.id);
    const i = data.ingredients.find((x) => x.id === c.id);
    if (i) {
      setUnit(defaultUnit(i));
      setQty(i.basis === "portion" ? "1" : "");
    } else setQty("1");
    setTimeout(() => qtyRef.current?.select());
  };

  const n = parseFloat(qty.replace(",", "."));
  const valid = (ing || rec) && Number.isFinite(n) && n !== 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onAdd(rec ? { kind: "recipe", refId: rec.id, qty: n } : { kind: "ingredient", refId: ing!.id, qty: n, unit });
    setAdded((a) => [...a, (rec ?? ing)!.name]);
    setSelectedId(null);
    setQty("");
  };

  return (
    <Modal title={title} onClose={onClose} wide left={left} right={right}>
      {compact != null && <div className="picker-compact small">{compact}</div>}
      <div className="grid-tools">
        <input autoFocus placeholder="Filtrer…" value={q} onChange={(e) => setQ(e.target.value)} />
        <nav className="group-nav">
          {groups.map((g) => (
            <button
              key={g.id}
              className="small"
              onClick={() => document.getElementById("group-" + g.id)?.scrollIntoView({ block: "start" })}
            >
              <span aria-hidden>{g.icon}</span> {g.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="food-groups">
        {groups.length === 0 && <p className="muted">Aucun aliment ne correspond.</p>}
        {groups.map((g) => (
          <section key={g.id} id={"group-" + g.id} className="food-group">
            <h3>
              <span aria-hidden>{g.icon}</span> {g.label}
            </h3>
            <div className="food-cards">
              {g.cards.map((c) => (
                <button
                  key={c.id}
                  className={"food-card" + (c.id === selectedId ? " selected" : "") + (c.kind === "recipe" ? " recipe" : "")}
                  onClick={() => select(c)}
                >
                  {c.kind === "recipe" && <span className="tag">recette</span>}
                  <span className="food-card-name">{c.name}</span>
                  <span className="food-card-meta">
                    <b>{fmt(c.kcal, "kcal")}</b> kcal · {fmt(c.prot)} g P
                    <br />
                    {c.per}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <form className="food-qty" onSubmit={submit}>
        {ing || rec ? (
          <>
            <span className="food-qty-name">{(rec ?? ing)!.name}</span>
            <input
              ref={qtyRef}
              className="picker-qty"
              inputMode="decimal"
              placeholder="Qté"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            {units.length > 1 ? (
              <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {unitLabel(ing, u)}
                    {u === "unit" && ing?.unitWeight ? ` (${ing.unitWeight} g)` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span className="muted">{rec ? "repas" : unitLabel(ing, units[0])}</span>
            )}
            <button className="primary" type="submit" disabled={!valid}>
              Ajouter
            </button>
          </>
        ) : (
          <span className="muted food-qty-name">
            {added.length ? `Ajouté : ${added.join(", ")}` : "Choisis un aliment pour indiquer la quantité."}
          </span>
        )}
        <button type="button" onClick={onClose}>
          Terminé
        </button>
      </form>
    </Modal>
  );
}
