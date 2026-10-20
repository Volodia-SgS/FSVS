import { useMemo, useState } from "react";
import { MealPlanEditor, planTotal } from "../components/MealPlan";
import { Modal } from "../components/Modal";
import { shiftDate, toHhmm, todayIso, toMinutes, weekStart } from "../dates";
import { fmt, newId } from "../nutrition";
import { useStore } from "../store";
import type { Category, ScheduleEvent } from "../types";
import { longDate } from "./Tracking";

const HOUR_PX = 48;
const SNAP_MIN = 15;
/** Plage affichée : la nuit ne sert à rien. */
const START_HOUR = 6;
const END_HOUR = 24;
const START_MIN = START_HOUR * 60;
const GRID_PX = (END_HOUR - START_HOUR) * HOUR_PX;

/** Blocs qu'on ajoute souvent, en un clic. */
const PRESETS = [{ title: "Temps partiel", start: "09:30", end: "17:30", categoryId: "travail" }];

/** Catégorie d'un préréglage, ou la première si elle a été supprimée. */
const presetCategory = (cats: Category[], id: string) => (cats.find((c) => c.id === id) ?? cats[0]).id;

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
  const [openDay, setOpenDay] = useState<string | null>(null);
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
  const cats = data.schedule.categories;
  const catOf = (id: string) => cats.find((c) => c.id === id) ?? cats[0];

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

      <div className="week-scroll">
        <div className="week-grid">
          <div className="week-corner" />
          {days.map((d) => {
            const h = dayHeader(d);
            const planned = !!data.mealPlans[d];
            return (
              <div key={d} className={"week-day-head" + (d === today ? " today" : "")}>
                <span>{h.weekday}</span>
                <b>{h.day}</b>
                <button
                  className={"day-plan" + (planned ? " planned" : "")}
                  onClick={() => setOpenDay(d)}
                  title={planned ? `${fmt(planTotal(data, d)[0], "kcal")} kcal prévues` : "Repas et ajouts rapides du jour"}
                >
                  {planned ? "Modifier le plan" : "+ Planifier"}
                </button>
              </div>
            );
          })}

          <div className="week-hours" style={{ height: GRID_PX }}>
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
              <span key={i} className={i ? "" : "first"} style={{ top: i * HOUR_PX }}>
                {START_HOUR + i}h
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
                style={{ height: GRID_PX, backgroundSize: `100% ${HOUR_PX}px` }}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  createAt(d, START_MIN + (y / HOUR_PX) * 60);
                }}
              >
                {d === today && nowMin >= START_MIN && <div className="now-line" style={{ top: ((nowMin - START_MIN) / 60) * HOUR_PX }} />}
                {events.map((ev) => {
                  // Ce qui commence avant 6 h est ramené en haut de la grille.
                  const s = Math.max(toMinutes(ev.start), START_MIN);
                  const len = Math.max(toMinutes(ev.end) - s, SNAP_MIN);
                  const p = pos.get(ev.id)!;
                  const c = catOf(ev.categoryId);
                  return (
                    <button
                      key={ev.id}
                      className={"event" + (len < 45 ? " short" : "")}
                      style={{
                        top: ((s - START_MIN) / 60) * HOUR_PX,
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
      {openDay && <DayModal date={openDay} onClose={() => setOpenDay(null)} />}
    </section>
  );
}

function EventModal({ draft: initial, categories, onClose }: { draft: Draft; categories: Category[]; onClose: () => void }) {
  const { update } = useStore();
  const [draft, setDraft] = useState<Draft>(initial);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const timeOk = toMinutes(draft.end) > toMinutes(draft.start);
  const title = draft.title.trim();
  const valid = !!title && !!draft.date && timeOk;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const ev: ScheduleEvent = { ...draft, id: draft.id ?? newId("ev"), title };
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
        {!draft.id && (
          <div className="presets">
            <span className="muted small">Préremplir :</span>
            {PRESETS.map((p) => (
              <button
                key={p.title}
                type="button"
                className="small"
                onClick={() => set({ ...p, categoryId: presetCategory(categories, p.categoryId) })}
              >
                {p.title} {p.start.replace(":", "h")}–{p.end.replace(":", "h")}
              </button>
            ))}
          </div>
        )}
        <div className="form-grid">
          <label className="wide">
            Nom
            <input
              autoFocus
              placeholder="ex. Footing, Réunion…"
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
    </Modal>
  );
}

/** Une journée : ajouts rapides à l'agenda et plan de repas. */
function DayModal({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, update } = useStore();
  const cats = data.schedule.categories;
  const events = data.schedule.events.filter((e) => e.date === date);

  const addPreset = (p: (typeof PRESETS)[number]) =>
    update((d) => void d.schedule.events.push({ ...p, id: newId("ev"), date, categoryId: presetCategory(cats, p.categoryId) }));
  const title = longDate(date);

  return (
    <Modal title={title.charAt(0).toUpperCase() + title.slice(1)} onClose={onClose} wide>
      <div className="presets">
        <span className="muted small">Ajout rapide :</span>
        {PRESETS.map((p) => {
          const exists = events.some((e) => e.title === p.title && e.start === p.start && e.end === p.end);
          return (
            <button key={p.title} className="small" disabled={exists} onClick={() => addPreset(p)}>
              {exists ? "✓ " : "+ "}
              {p.title} {p.start.replace(":", "h")}–{p.end.replace(":", "h")}
            </button>
          );
        })}
      </div>
      <h2 className="meal-plan-title">Plan de repas</h2>
      <MealPlanEditor date={date} />
    </Modal>
  );
}
