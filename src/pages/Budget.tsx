import { useEffect, useRef, useState } from "react";
import {
  currentMonth,
  DONUT_COLORS,
  eur,
  groupColor,
  groupTotal,
  lineTotal,
  monthLabel,
  monthTotals,
  newMonth,
  ofMonth,
  parseOps,
  SAVINGS_COLOR,
  shiftMonth,
  spentLevel,
  suggestedOpening,
} from "../budget";
import { newId } from "../nutrition";
import { useStore } from "../store";
import type { Budget, BudgetLine, BudgetMonth } from "../types";

type Edit = (fn: (m: BudgetMonth) => void) => void;

const parseMoney = (s: string) => {
  const n = Number(s.replace(/\s|€/g, "").replace(",", "."));
  return s.trim() && Number.isFinite(n) ? n : undefined;
};

/** Champ de montant : accepte la virgule, enregistre en quittant le champ ou avec Entrée. */
function MoneyInput({
  value,
  onChange,
  className = "",
  autoFocus,
  onDone,
}: {
  value?: number;
  onChange: (v?: number) => void;
  className?: string;
  autoFocus?: boolean;
  /** Appelé après l'enregistrement, quand on quitte le champ. */
  onDone?: () => void;
}) {
  const shown = value == null ? "" : String(value).replace(".", ",");
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    const v = parseMoney(text);
    if (v !== value) onChange(v);
    else setText(shown);
    onDone?.();
  };
  return (
    <input
      className={"num money " + className}
      inputMode="decimal"
      placeholder="—"
      autoFocus={autoFocus}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

// ---- Mois

export function BudgetMonthPage() {
  const { data, update } = useStore();
  const [key, setKey] = useState(currentMonth);
  const [editing, setEditing] = useState(false);
  const month = data.budget.months[key];
  const edit: Edit = (fn) => update((d) => fn(d.budget.months[key]));

  const remove = () => {
    if (!confirm(`Supprimer le budget ${ofMonth(key)} ?`)) return;
    update((d) => void delete d.budget.months[key]);
  };

  return (
    <section className="card sheet-card">
      <header className="sheet-nav">
        <div className="week-nav">
          <button className="ghost" onClick={() => setKey(shiftMonth(key, -1))} aria-label="Mois précédent">
            ‹
          </button>
          <h2>{monthLabel(key)}</h2>
          <button className="ghost" onClick={() => setKey(shiftMonth(key, 1))} aria-label="Mois suivant">
            ›
          </button>
          {key !== currentMonth() && (
            <button className="ghost small" onClick={() => setKey(currentMonth())}>
              Ce mois-ci
            </button>
          )}
        </div>
        {month && (
          <>
            <button className={"small" + (editing ? " primary" : "")} onClick={() => setEditing(!editing)}>
              {editing ? "Terminer" : "✎ Modifier les postes"}
            </button>
            {editing && (
              <button className="ghost small danger" onClick={remove}>
                Supprimer le mois
              </button>
            )}
          </>
        )}
      </header>

      {month ? (
        <Sheet month={month} edit={edit} editing={editing} account={{ suggested: suggestedOpening(data.budget, key) }} />
      ) : (
        <div className="coming-soon">
          <button className="primary" onClick={() => update((d) => void (d.budget.months[key] = newMonth(d.budget, key)))}>
            Créer le budget {ofMonth(key)}
          </button>
        </div>
      )}
    </section>
  );
}

// ---- Feuille du mois (mise en page du classeur)

function Sheet({
  month,
  edit,
  editing,
  account,
}: {
  month: BudgetMonth;
  edit: Edit;
  editing: boolean;
  /** Absent pour le modèle, qui n'a pas de compte. */
  account?: { suggested?: number };
}) {
  const t = monthTotals(month);
  const [newGroup, setNewGroup] = useState("");
  const addGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newGroup.trim();
    if (!label) return;
    edit((m) => void m.groups.push({ id: newId("poste"), label, icon: "💶", target: 0, lines: [] }));
    setNewGroup("");
  };

  const spending = [
    ...month.groups.map((g, i) => ({ label: g.label, value: groupTotal(g), color: DONUT_COLORS[i % DONUT_COLORS.length] })),
    { label: "Économies", value: Math.max(t.savings, 0), color: DONUT_COLORS[month.groups.length % DONUT_COLORS.length] },
  ];
  const incomes = month.incomes.map((l, i) => ({ label: l.label, value: lineTotal(l), color: DONUT_COLORS[i % DONUT_COLORS.length] }));

  return (
    <div className="sheet">
      <div className="sheet-top">
        <section className="xl-table">
          <header className="xl-head dark">Revenus</header>
          <div className="xl-sub">
            <span>Type de revenus</span>
            <span>Montant</span>
          </div>
          <Lines lines={month.incomes} edit={(fn) => edit((m) => fn(m.incomes))} editing={editing} />
          <div className="xl-total">
            <span>Total</span>
            <span>{eur(t.income)}</span>
          </div>
        </section>

        <div className="donuts">
          <Donut title="Revenus" items={incomes} />
          <Donut title="Dépenses" items={spending} />
        </div>

        <section className="xl-table">
          <header className="xl-head dark">Dépenses</header>
          <div className="xl-sub">
            <span>Type de dépenses</span>
            <span>Montant</span>
          </div>
          {month.groups.map((g) => {
            const spent = groupTotal(g);
            return (
              <div key={g.id} className="xl-row">
                <span>{g.label}</span>
                <span className={g.target && spent > g.target ? "over" : ""} title={`cible ${eur(g.target)}`}>
                  {eur(spent)}
                </span>
              </div>
            );
          })}
          <div className="xl-row">
            <span>Économies</span>
            <span className={t.savings < 0 ? "over" : ""}>{eur(t.savings)}</span>
          </div>
          <div className="xl-total">
            <span>Total dépenses</span>
            <span>{eur(t.spent)}</span>
          </div>
          <div className="xl-total">
            <span>Total</span>
            <span>{eur(t.spent + t.savings)}</span>
          </div>
        </section>
      </div>

      <div className={"sheet-mid" + (account ? "" : " no-account")}>
        {account && (
          <div className="accounts">
            <div className="xl-box">
              <header>Montant compte initial</header>
              <MoneyInput value={month.opening} onChange={(v) => edit((m) => void (m.opening = v))} />
              {month.opening == null && account.suggested != null && (
                <button className="link small" onClick={() => edit((m) => void (m.opening = account.suggested))}>
                  Reprendre {eur(account.suggested)}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="group-grid">
          {month.groups.map((g, gi) => (
            <section key={g.id} className="xl-table" style={{ ["--head" as string]: groupColor(g, gi) }}>
              <header className="xl-head">
                {editing ? (
                  <input value={g.label} aria-label="Nom du poste" onChange={(e) => edit((m) => void (m.groups[gi].label = e.target.value))} />
                ) : (
                  g.label
                )}
                {editing && (
                  <button
                    className="ghost small"
                    aria-label="Supprimer le poste"
                    onClick={() => confirm(`Supprimer le poste « ${g.label} » ?`) && edit((m) => void m.groups.splice(gi, 1))}
                  >
                    ×
                  </button>
                )}
              </header>
              {account && <TargetBar spent={groupTotal(g)} target={g.target} />}
              <Lines lines={g.lines} edit={(fn) => edit((m) => fn(m.groups[gi].lines))} editing={editing} />
              <GroupTotal
                spent={groupTotal(g)}
                target={g.target}
                tracked={!!account}
                onTarget={(v) => edit((m) => void (m.groups[gi].target = v))}
              />
            </section>
          ))}
          <section className="xl-table" style={{ ["--head" as string]: SAVINGS_COLOR }}>
            <header className="xl-head">Économies</header>
            {account && <TargetBar spent={t.savings} target={t.targetSavings} reverse />}
            <div className="xl-total">
              <span>Total</span>
              <span>
                {eur(t.savings)}
                <span className="target-of"> / {eur(t.targetSavings)}</span>
              </span>
            </div>
          </section>
          {editing && (
            <form className="xl-table new-group" onSubmit={addGroup}>
              <input placeholder="+ Nouveau poste" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
            </form>
          )}
        </div>

        {account && (
          <div className="accounts">
            <div className="xl-box">
              <header>Montant compte final</header>
              <b>{t.expectedClosing != null ? eur(t.expectedClosing) : "—"}</b>
            </div>
            <div className="xl-box">
              <header>Montant réel</header>
              <MoneyInput value={month.closing} onChange={(v) => edit((m) => void (m.closing = v))} />
              {month.closing != null && t.expectedClosing != null && Math.abs(month.closing - t.expectedClosing) >= 0.01 && (
                <span className="gap">écart {eur(Math.round((month.closing - t.expectedClosing) * 100) / 100)}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Barre fine sous l'en-tête d'un poste : part de la cible déjà dépensée. */
function TargetBar({ spent, target, reverse }: { spent: number; target: number; reverse?: boolean }) {
  if (target <= 0) return <div className="target-bar empty" />;
  const pct = Math.max(0, Math.min(spent / target, 1)) * 100;
  // Pour les économies, atteindre la cible est le bon côté.
  const level = reverse ? (spent >= target ? "ok" : spent >= 0 ? "warn" : "alert") : spentLevel(spent, target);
  return (
    <div className={`target-bar lv-text-${level}`} title={`${Math.round((spent / target) * 100)} % de la cible`}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Ligne Total d'un poste : « dépensé / cible », la cible se modifie d'un clic. */
function GroupTotal({
  spent,
  target,
  tracked,
  onTarget,
}: {
  spent: number;
  target: number;
  /** Faux pour le modèle : pas de dépenses à comparer. */
  tracked: boolean;
  onTarget: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const left = Math.round((target - spent) * 100) / 100;
  return (
    <>
      <div className="xl-total">
        <span>Total</span>
        <span className="total-target">
          <span className={tracked ? `lv-text-${spentLevel(spent, target)}` : ""}>{eur(spent)}</span>
          {editing ? (
            <MoneyInput value={target || undefined} onChange={(v) => onTarget(v ?? 0)} onDone={() => setEditing(false)} className="cell" autoFocus />
          ) : (
            <button className="target-of" onClick={() => setEditing(true)} title="Modifier la cible">
              {target ? `/ ${eur(target)}` : "+ cible"}
            </button>
          )}
        </span>
      </div>
      {tracked && target > 0 && (
        <div className={"xl-left" + (left < 0 ? " over" : "")}>{left >= 0 ? `reste ${eur(left)}` : `dépassé de ${eur(-left)}`}</div>
      )}
    </>
  );
}

/** Donut avec la légende en dessous ; les parts nulles n'apparaissent pas. */
function Donut({ title, items }: { title: string; items: { label: string; value: number; color: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((s, i) => s + i.value, 0);
  const R = 15.9155; // circonférence 100
  const GAP = items.filter((i) => i.value > 0).length > 1 ? 0.6 : 0;
  let offset = 0;
  const shown = hover != null ? items[hover] : null;

  return (
    <figure className="donut">
      <figcaption>{title}</figcaption>
      <svg viewBox="0 0 42 42" role="img" aria-label={`${title} : ${eur(total)}`}>
        <circle cx="21" cy="21" r={R} fill="none" className="donut-track" strokeWidth="7" />
        {total > 0 &&
          items.map((it, i) => {
            if (it.value <= 0) return null;
            const pct = (it.value / total) * 100;
            const seg = (
              <circle
                key={i}
                cx="21"
                cy="21"
                r={R}
                fill="none"
                stroke={it.color}
                strokeWidth={hover === i ? 8.5 : 7}
                strokeDasharray={`${Math.max(pct - GAP, 0.01)} ${100 - Math.max(pct - GAP, 0.01)}`}
                strokeDashoffset={25 - offset}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${it.label} : ${eur(it.value)} (${Math.round(pct)} %)`}</title>
              </circle>
            );
            offset += pct;
            return seg;
          })}
        <text x="21" y="20.2" className="donut-value">
          {eur(shown ? shown.value : total).replace(/,\d\d/, "")}
        </text>
        <text x="21" y="25" className="donut-label">
          {shown ? shown.label : "total"}
        </text>
      </svg>
      <ul className="donut-legend">
        {items
          .map((it, i) => ({ ...it, i }))
          .filter((it) => it.value > 0)
          .map((it) => (
            <li key={it.i} className={hover === it.i ? "active" : ""} onMouseEnter={() => setHover(it.i)} onMouseLeave={() => setHover(null)}>
              <span className="legend-dot" style={{ background: it.color }} />
              <span className="donut-name">{it.label}</span>
              <span className="muted">{Math.round((it.value / total) * 100)} %</span>
            </li>
          ))}
      </ul>
    </figure>
  );
}

function Lines({ lines, edit, editing }: { lines: BudgetLine[]; edit: (fn: (ls: BudgetLine[]) => void) => void; editing: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [newLine, setNewLine] = useState("");
  const addLine = () => {
    const label = newLine.trim();
    if (!label) return;
    edit((ls) => void ls.push({ id: newId("bl"), label, ops: [] }));
    setNewLine("");
  };

  return (
    <>
      {lines.map((l, li) => (
        <LineRow
          key={l.id}
          line={l}
          open={open === l.id}
          editing={editing}
          onToggle={() => setOpen(open === l.id ? null : l.id)}
          edit={(fn) => edit((ls) => fn(ls[li]))}
          onRemove={() => edit((ls) => void ls.splice(li, 1))}
        />
      ))}
      {editing && (
        <input
          className="xl-add"
          placeholder="+ Ligne"
          value={newLine}
          onChange={(e) => setNewLine(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            addLine();
          }}
          onBlur={addLine}
        />
      )}
    </>
  );
}

function LineRow({
  line,
  open,
  editing,
  onToggle,
  edit,
  onRemove,
}: {
  line: BudgetLine;
  open: boolean;
  editing: boolean;
  onToggle: () => void;
  edit: (fn: (l: BudgetLine) => void) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState(false);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const ops = parseOps(text);
    if (!ops) return setError(!!text.trim());
    edit((l) => void l.ops.push(...ops));
    setText("");
    setError(false);
  };

  if (editing)
    return (
      <div className="xl-row editing">
        <input value={line.label} aria-label="Nom de la ligne" onChange={(e) => edit((l) => void (l.label = e.target.value))} />
        <button className="ghost small" aria-label="Supprimer la ligne" onClick={() => confirm(`Supprimer « ${line.label} » ?`) && onRemove()}>
          ×
        </button>
      </div>
    );

  return (
    <>
      <button className={"xl-row line" + (open ? " open" : "")} onClick={onToggle}>
        <span>{line.label}</span>
        <span>{eur(lineTotal(line))}</span>
      </button>
      {open && (
        <div className="xl-detail">
          <form onSubmit={add}>
            <input
              autoFocus
              className={error ? "invalid" : ""}
              inputMode="decimal"
              placeholder="+ montant"
              title="12,50 · Resto 12,50 · 4 + 6,20 · 22,98 - 19,99"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(false);
              }}
            />
          </form>
          {line.ops.map((o, oi) => (
            <div key={o.id} className={"op" + (o.amount < 0 ? " refund" : "")}>
              <span>{o.label ?? ""}</span>
              <span>{eur(o.amount)}</span>
              <button className="ghost small" aria-label="Retirer" onClick={() => edit((l) => void l.ops.splice(oi, 1))}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---- Bilan

export function BudgetOverview() {
  const { data } = useStore();
  const keys = Object.keys(data.budget.months).sort();
  if (!keys.length)
    return (
      <section className="card coming-soon">
        <p className="muted">Aucun mois.</p>
      </section>
    );

  // Colonnes : les postes du modèle, puis ceux qui n'existent que dans certains mois.
  const cols: { id: string; label: string }[] = [];
  for (const g of [...data.budget.template.groups, ...keys.flatMap((k) => data.budget.months[k].groups)])
    if (!cols.some((c) => c.id === g.id)) cols.push(g);

  const rows = keys.map((k) => ({ key: k, m: data.budget.months[k], t: monthTotals(data.budget.months[k]) }));
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const groupOf = (m: BudgetMonth, id: string) => m.groups.find((g) => g.id === id);
  const colTotal = (id: string) => rows.reduce((s, r) => s + (groupOf(r.m, id) ? groupTotal(groupOf(r.m, id)!) : 0), 0);
  const colCount = (id: string) => rows.filter((r) => groupOf(r.m, id)).length;

  return (
    <section className="card">
      <div className="table-wrap">
        <table className="grid budget-overview">
          <thead>
            <tr>
              <th>Mois</th>
              <th>Revenus</th>
              {cols.map((c) => (
                <th key={c.id}>{c.label}</th>
              ))}
              <th>Dépenses</th>
              <th>Économies</th>
              <th>Solde fin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, m, t }) => (
              <tr key={key}>
                <td>{monthLabel(key)}</td>
                <td>{eur(t.income)}</td>
                {cols.map((c) => {
                  const g = groupOf(m, c.id);
                  if (!g) return <td key={c.id} className="muted">—</td>;
                  const spent = groupTotal(g);
                  return (
                    <td key={c.id} className={`lv-${spentLevel(spent, g.target)}`} title={`cible ${eur(g.target)}`}>
                      {eur(spent)}
                    </td>
                  );
                })}
                <td className={`lv-${spentLevel(t.spent, t.target)}`}>{eur(t.spent)}</td>
                <td className={t.savings >= t.targetSavings ? "lv-ok" : t.savings >= 0 ? "lv-warn" : "lv-alert"}>{eur(t.savings)}</td>
                <td>{m.closing != null ? eur(m.closing) : t.expectedClosing != null ? <i title="prévu">{eur(t.expectedClosing)}</i> : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="avg">
              <td>Moyenne</td>
              <td>{eur(sum((r) => r.t.income) / rows.length)}</td>
              {cols.map((c) => (
                <td key={c.id}>{colCount(c.id) ? eur(colTotal(c.id) / colCount(c.id)) : "—"}</td>
              ))}
              <td>{eur(sum((r) => r.t.spent) / rows.length)}</td>
              <td>{eur(sum((r) => r.t.savings) / rows.length)}</td>
              <td />
            </tr>
            <tr className="avg">
              <td>Total</td>
              <td>{eur(sum((r) => r.t.income))}</td>
              {cols.map((c) => (
                <td key={c.id}>{eur(colTotal(c.id))}</td>
              ))}
              <td>{eur(sum((r) => r.t.spent))}</td>
              <td>{eur(sum((r) => r.t.savings))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// ---- Modèle

export function BudgetTemplate() {
  const { data, update } = useStore();
  const [editing, setEditing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const edit: Edit = (fn) => update((d) => fn(d.budget.template));

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Budget;
      if (!parsed.template?.groups || !parsed.months) throw new Error();
      const keys = Object.keys(parsed.months).sort();
      const clash = keys.filter((k) => data.budget.months[k]);
      const msg =
        `Importer le modèle et ${keys.length} mois (${keys.map((k) => monthLabel(k, true)).join(", ")}) ?` +
        (clash.length ? `\nDéjà présents, ils seront remplacés : ${clash.map((k) => monthLabel(k, true)).join(", ")}.` : "");
      if (!confirm(msg)) return;
      update((d) => void (d.budget = { template: parsed.template, months: { ...d.budget.months, ...parsed.months } }));
    } catch {
      alert("Fichier de budget invalide.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="card sheet-card">
      <header className="sheet-nav">
        <h2>Modèle</h2>
        <button className={"small" + (editing ? " primary" : "")} onClick={() => setEditing(!editing)}>
          {editing ? "Terminer" : "✎ Modifier les postes"}
        </button>
        <button className="small" onClick={() => fileRef.current?.click()}>
          Importer…
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </header>
      <Sheet month={data.budget.template} edit={edit} editing={editing} />
    </section>
  );
}
