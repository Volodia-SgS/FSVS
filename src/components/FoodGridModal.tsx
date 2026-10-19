import { useMemo, useRef, useState } from "react";
import { defaultUnit, fmt, recipeValues, unitLabel, unitsFor } from "../nutrition";
import { useStore } from "../store";
import type { Unit } from "../types";
import type { Pick } from "./FoodPicker";
import { Modal } from "./Modal";

interface Card {
  id: string;
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

const letterOf = (name: string) => {
  const c = norm(name.trim()).charAt(0);
  return c >= "A" && c <= "Z" ? c : "#";
};

/** Choix d'un aliment : cartes classées par lettre, puis quantité. */
export function FoodGridModal({ onAdd, onClose }: { onAdd: (p: Pick) => void; onClose: () => void }) {
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
        name: i.name,
        kcal: i.values[0],
        prot: i.values[1],
        per: i.basis === "portion" ? `/ ${i.unitLabel || "portion"}` : "/ 100 g",
      })),
      ...data.recipes.map((r) => {
        const v = recipeValues(data, r);
        return { id: r.id, kind: "recipe" as const, name: r.name, kcal: v[0], prot: v[1], per: "/ repas" };
      }),
    ];
    const nq = norm(q.trim());
    const map = new Map<string, Card[]>();
    for (const c of cards.filter((c) => norm(c.name).includes(nq)).sort((a, b) => a.name.localeCompare(b.name, "fr"))) {
      const l = letterOf(c.name);
      map.set(l, [...(map.get(l) ?? []), c]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)));
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
    <Modal title="Ajouter un aliment" onClose={onClose} wide>
      <div className="grid-tools">
        <input autoFocus placeholder="Filtrer…" value={q} onChange={(e) => setQ(e.target.value)} />
        <nav className="letters">
          {groups.map(([l]) => (
            <button
              key={l}
              className="ghost small"
              onClick={() => document.getElementById("letter-" + l)?.scrollIntoView({ block: "start" })}
            >
              {l}
            </button>
          ))}
        </nav>
      </div>

      <div className="food-groups">
        {groups.length === 0 && <p className="muted">Aucun aliment ne correspond.</p>}
        {groups.map(([letter, cards]) => (
          <section key={letter} id={"letter-" + letter} className="food-group">
            <h3>{letter}</h3>
            <div className="food-cards">
              {cards.map((c) => (
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
