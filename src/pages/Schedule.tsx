import { useEffect, useMemo, useRef, useState } from "react";
import { FoodGridModal } from "../components/FoodGridModal";
import { Modal } from "../components/Modal";
import { shiftDate, toHhmm, todayIso, toMinutes, weekStart } from "../dates";
import { dayTotal, fmt, newId } from "../nutrition";
import { useStore } from "../store";
import type { Category, Entry, ScheduleEvent } from "../types";
import { MEAL_CATEGORY } from "../types";
import { EntryRow } from "./Tracking";

const HOUR_PX = 48;
const SNAP_MIN = 15;
const FIRST_VISIBLE_HOUR = 7;

const dayHeader = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return {
    weekday: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""),
    day: d.getDate(),
  };
};

const weekLabel = (monday: string) => {
  const a = new Date(monday + "T12:00:00");
  const b = new Date(shiftDate(monday, 6) + "T12:00:00");
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString("fr-FR", sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  const right = b.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return `${left} – ${right}`;
};

/** Place côte à côte les items qui se chevauchent. */
function layout(events: ScheduleEvent[]) {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const pos = new Map<string, { col: number; cols: number }>();
  let cluster: ScheduleEvent[] = [];
  let columns: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const e of cluster) pos.get(e.id)!.cols = columns.length;
    cluster = [];
    columns = [];
  };
  for (const e of sorted) {
    const s = toMinutes(e.start);
    const end = Math.max(toMinutes(e.end), s + SNAP_MIN);
    if (s >= clusterEnd) flush();
    let col = columns.findIndex((c) => c <= s);
    if (col === -1) col = columns.push(end) - 1;
    else columns[col] = end;
    pos.set(e.id, { col, cols: 1 });
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return pos;
}

type Draft = Omit<ScheduleEvent, "id"> & { id?: string };

export function Schedule() {
  const { data } = useStore();
  const [monday, setMonday] = useState(() => weekStart(todayIso()));
  const [draft, setDraft] = useState<Draft | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
  const cats = data.schedule.categories;
  const catOf = (id: string) => cats.find((c) => c.id === id) ?? cats[0];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = FIRST_VISIBLE_HOUR * HOUR_PX;
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, ScheduleEvent[]>();
    for (const e of data.schedule.events) if (days.includes(e.date)) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [data.schedule.events, monday]); // eslint-disable-line react-hooks/exhaustive-deps

  const createAt = (date: string, minutes: number) => {
    const start = Math.floor(minutes / 30) * 30;
    setDraft({ date, start: toHhmm(start), end: toHhmm(Math.min(start + 60, 24 * 60)), title: "", categoryId: cats[0].id });
  };

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <section className="card schedule">
      <header className="schedule-head">
        <div className="week-nav">
          <button className="ghost" onClick={() => setMonday(shiftDate(monday, -7))} aria-label="Semaine précédente">
            ‹
          </button>
          <h2>{weekLabel(monday)}</h2>
          <button className="ghost" onClick={() => setMonday(shiftDate(monday, 7))} aria-label="Semaine suivante">
            ›
          </button>
          {monday !== weekStart(today) && (
            <button className="ghost small" onClick={() => setMonday(weekStart(today))}>
              Cette semaine
            </button>
          )}
        </div>
        <div className="legend">
          {cats.map((c) => (
            <span key={c.id} className="legend-item">
              <span className="legend-dot" style={{ background: c.color }} />
              {c.label}
            </span>
          ))}
        </div>
        <button className="primary" onClick={() => createAt(days.includes(today) ? today : monday, Math.max(nowMin, 8 * 60))}>
          + Nouvel item
        </button>
      </header>

      <div className="week-scroll" ref={scrollRef}>
        <div className="week-grid">
          <div className="week-corner" />
          {days.map((d) => {
            const h = dayHeader(d);
            return (
              <div key={d} className={"week-day-head" + (d === today ? " today" : "")}>
                <span>{h.weekday}</span>
                <b>{h.day}</b>
              </div>
            );
          })}

          <div className="week-hours" style={{ height: 24 * HOUR_PX }}>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ top: h * HOUR_PX }}>
                {h ? `${h}h` : ""}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const events = byDay.get(d) ?? [];
            const pos = layout(events);
            return (
              <div
                key={d}
                className={"week-col" + (d === today ? " today" : "")}
                style={{ height: 24 * HOUR_PX, backgroundSize: `100% ${HOUR_PX}px` }}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  createAt(d, (y / HOUR_PX) * 60);
                }}
              >
                {d === today && <div className="now-line" style={{ top: (nowMin / 60) * HOUR_PX }} />}
                {events.map((ev) => {
                  const s = toMinutes(ev.start);
                  const len = Math.max(toMinutes(ev.end) - s, SNAP_MIN);
                  const p = pos.get(ev.id)!;
                  const c = catOf(ev.categoryId);
                  const kcal = ev.foods?.length ? dayTotal(data, ev.foods)[0] : null;
                  return (
                    <button
                      key={ev.id}
                      className={"event" + (len < 45 ? " short" : "") + (ev.eaten ? " eaten" : "")}
                      style={{
                        top: (s / 60) * HOUR_PX,
                        height: (len / 60) * HOUR_PX - 2,
                        left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
                        width: `calc(${100 / p.cols}% - 4px)`,
                        ["--cat" as string]: c.color,
                      }}
                      onClick={() => setDraft(structuredClone(ev))}
                      title={`${ev.start}–${ev.end} · ${ev.title}`}
                    >
                      <span className="event-title">{ev.title}</span>
                      <span className="event-time">
                        {ev.start}–{ev.end}
                        {kcal != null && ` · ${fmt(kcal, "kcal")} kcal`}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {draft && <EventModal draft={draft} categories={cats} onClose={() => setDraft(null)} />}
    </section>
  );
}

function EventModal({ draft: initial, categories, onClose }: { draft: Draft; categories: Category[]; onClose: () => void }) {
  const { data, update } = useStore();
  const [draft, setDraft] = useState<Draft>(initial);
  const [pickerOpen, setPickerOpen] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const isMeal = draft.categoryId === MEAL_CATEGORY;
  const foods = draft.foods ?? [];
  const total = dayTotal(data, foods);
  const timeOk = toMinutes(draft.end) > toMinutes(draft.start);
  const title = draft.title.trim() || (isMeal ? "Repas" : "");
  const valid = !!title && !!draft.date && timeOk;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const ev: ScheduleEvent = {
      ...draft,
      id: draft.id ?? newId("ev"),
      title,
      foods: isMeal ? foods : undefined,
      eaten: isMeal ? draft.eaten : undefined,
    };
    update((d) => {
      const i = d.schedule.events.findIndex((x) => x.id === ev.id);
      if (i >= 0) d.schedule.events[i] = ev;
      else d.schedule.events.push(ev);
    });
    onClose();
  };

  const remove = () => {
    if (!confirm(`Supprimer « ${draft.title} » ?`)) return;
    update((d) => void (d.schedule.events = d.schedule.events.filter((x) => x.id !== draft.id)));
    onClose();
  };

  return (
    <Modal title={draft.id ? "Modifier l'item" : "Nouvel item"} onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-grid">
          <label className="wide">
            Nom
            <input
              autoFocus
              placeholder={isMeal ? "Repas (ex. Déjeuner)" : "ex. Footing, Réunion…"}
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </label>
          <div className="wide field">
            Type
            <div className="cat-choice">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={c.id === draft.categoryId ? "active" : ""}
                  style={{ ["--cat" as string]: c.color }}
                  onClick={() => set({ categoryId: c.id })}
                >
                  <span className="legend-dot" style={{ background: c.color }} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <label className="wide">
            Jour
            <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
          </label>
          <label>
            Début
            <input type="time" step={SNAP_MIN * 60} value={draft.start} onChange={(e) => set({ start: e.target.value })} />
          </label>
          <label>
            Fin
            <input type="time" step={SNAP_MIN * 60} value={draft.end} onChange={(e) => set({ end: e.target.value })} />
          </label>
          {!timeOk && <p className="login-error wide">L'heure de fin doit être après l'heure de début.</p>}
        </div>

        {isMeal && (
          <>
            <h3>Aliments prévus</h3>
            {foods.length === 0 && <p className="muted small">Aucun aliment pour l'instant.</p>}
            <ul className="entries">
              {foods.map((f) => (
                <EntryRow
                  key={f.id}
                  entry={f}
                  onChange={(next) => set({ foods: foods.map((x) => (x.id === f.id ? next : x)) })}
                  onDelete={() => set({ foods: foods.filter((x) => x.id !== f.id) })}
                />
              ))}
            </ul>
            {foods.length > 0 && (
              <p className="small">
                Total : <b>{fmt(total[0], "kcal")} kcal</b> · P {fmt(total[1])} g · G {fmt(total[2])} g · L {fmt(total[4])} g
              </p>
            )}
            <button type="button" className="add-food" onClick={() => setPickerOpen(true)}>
              + Ajouter un aliment
            </button>
            <p className="muted small">
              Le jour venu, ce repas apparaît dans Nutrition › Suivi avec un bouton pour l'ajouter à ce que tu as mangé.
            </p>
          </>
        )}

        <div className="modal-foot">
          {draft.id && (
            <button type="button" className="ghost danger" onClick={remove} style={{ marginRight: "auto" }}>
              Supprimer
            </button>
          )}
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={!valid}>
            {draft.id ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </form>
      {pickerOpen && (
        <FoodGridModal
          onClose={() => setPickerOpen(false)}
          onAdd={(p) => setDraft((d) => ({ ...d, foods: [...(d.foods ?? []), { ...p, id: newId("e") } as Entry] }))}
        />
      )}
    </Modal>
  );
}
