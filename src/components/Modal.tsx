import { useEffect, useRef, type ReactNode } from "react";

/** Fenêtres ouvertes, de la plus ancienne à la plus récente : Échap ne ferme que la dernière. */
const stack: symbol[] = [];

export function Modal({
  title,
  onClose,
  children,
  wide,
  left,
  right,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** Panneaux affichés de part et d'autre de la fenêtre (masqués sur petit écran). */
  left?: ReactNode;
  right?: ReactNode;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const me = Symbol(title);
    stack.push(me);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stack[stack.length - 1] === me && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(me), 1);
    };
  }, [title]);

  const modal = (
    <div className={"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="ghost" onClick={onClose} aria-label="Fermer">
          ×
        </button>
      </div>
      {children}
    </div>
  );
  const sided = left != null || right != null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("modal-row")) && onClose()}
    >
      {sided ? (
        <div className="modal-row">
          {left != null && <aside className="modal-side">{left}</aside>}
          {modal}
          {right != null && <aside className="modal-side">{right}</aside>}
        </div>
      ) : (
        modal
      )}
    </div>
  );
}
