import { useEffect, useRef, useState } from "react";

export interface Option {
  id: string;
  label: string;
  hint?: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Liste de sélection avec recherche : on choisit un élément, le texte tapé ne sert
 * qu'à filtrer la liste. Cliquer sur le champ rouvre toute la liste, même si un
 * élément est déjà choisi.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  className,
}: {
  options: Option[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.id === value);

  const q = norm(query.trim());
  const filtered = q ? options.filter((o) => norm(o.label).includes(q)) : options;

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openList = () => {
    setQuery("");
    const i = selected ? options.indexOf(selected) : 0;
    setActive(Math.max(i, 0));
    setOpen(true);
  };

  const choose = (o: Option) => {
    onChange(o.id);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={"combo " + (className ?? "")}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        className={selected && !open ? "has-value" : ""}
        placeholder={open && selected ? selected.label : placeholder}
        value={open ? query : (selected?.label ?? "")}
        onFocus={openList}
        onMouseDown={() => !open && document.activeElement === inputRef.current && openList()}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <span className="combo-caret" aria-hidden>
        ▾
      </span>
      {open && (
        <ul className="combo-list" role="listbox" ref={listRef}>
          {filtered.length === 0 && <li className="combo-empty">Aucun résultat</li>}
          {filtered.map((o, i) => (
            <li
              key={o.id}
              role="option"
              data-index={i}
              aria-selected={o.id === value}
              className={(i === active ? "active " : "") + (o.id === value ? "chosen" : "")}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{o.label}</span>
              {o.hint && <span className="combo-hint">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
