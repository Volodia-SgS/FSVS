import { useMemo, useState } from "react";
import { MealPlanEditor, planTotal } from "../components/MealPlan";
import { Modal } from "../components/Modal";
import { TaskModal } from "../components/TaskModal";
import { shiftDate, toHhmm, todayIso, toMinutes, weekStart } from "../dates";
import { fmt, newId } from "../nutrition";
import { useStore } from "../store";
import { compareTasks, DEFAULT_DURATION, priorityOf, scheduleTask, unscheduleTask } from "../tasks";
import type { Category, ScheduleEvent, Task } from "../types";
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

/** Items qu'un créneau occupe en partie de l'intérieur (ex. un repas au milieu d'une journée de travail). */
function containersOf(events: ScheduleEvent[], d: Draft) {
  const s = toMinutes(d.start);
  const e = toMinutes(d.end);
  return events.filter((x) => {
    if (x.id === d.id || x.taskId || x.date !== d.date) return false;
    const xs = toMinutes(x.start);
    const xe = toMinutes(x.end);
    return xs <= s && e <= xe && (xs < s || e < xe);
  });
}

/** Retire le créneau [start, end] de chaque item englobant, qui devient un ou deux morceaux. */
function cutContainers(events: ScheduleEvent[], d: Draft) {
  for (const x of containersOf(events, d)) {
    const after: ScheduleEvent = { ...x, id: newId("ev"), start: d.end };
    const i = events.indexOf(x);
    const pieces = [{ ...x, end: d.start }, after].filter((p) => toMinutes(p.end) > toMinutes(p.start));
    events.splice(i, 1, ...pieces);
  }
}

/** Ce qu'on est en train de glisser sur la grille. */
interface Drag {
  kind: "task" | "event";
  id: string;
  /** Tâche liée, pour pouvoir la renvoyer dans « À planifier ». */
  taskId?: string;
  length: number;
  /** Écart entre le haut de l'item et le point saisi. */
  offsetMin: number;
}

export function Schedule() {
  const { data, update } = useStore();
  const [monday, setMonday] = useState(() => weekStart(todayIso()));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ date: string; minutes: number } | null>(null);
  const [overTray, setOverTray] = useState(false);
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

  const taskOf = (id?: string) => (id ? data.tasks.find((t) => t.id === id) : undefined);
  const scheduled = new Set(data.schedule.events.map((e) => e.taskId));
  const toPlan = data.tasks.filter((t) => !t.done && !scheduled.has(t.id)).sort(compareTasks(data));

  /** Minute visée dans une colonne, calée sur le quart d'heure. */
  const minuteAt = (e: React.DragEvent<HTMLElement>, d: Drag) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const m = START_MIN + (y / HOUR_PX) * 60 - d.offsetMin;
    return Math.max(START_MIN, Math.min(Math.round(m / SNAP_MIN) * SNAP_MIN, 24 * 60 - SNAP_MIN));
  };

  const drop = (date: string, minutes: number, d: Drag) =>
    update((draft) => {
      if (d.kind === "task") {
        const task = draft.tasks.find((t) => t.id === d.id);
        if (task) scheduleTask(draft, task, date, toHhmm(minutes), d.length);
        return;
      }
      const ev = draft.schedule.events.find((x) => x.id === d.id);
      if (!ev) return;
      ev.date = date;
      ev.start = toHhmm(minutes);
      ev.end = toHhmm(minutes + d.length);
    });

  const endDrag = () => {
    setDrag(null);
    setHover(null);
    setOverTray(false);
  };

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
              <span className="legend-dot" style={{ ["--cat" as string]: c.color }} />
              {c.label}
            </span>
          ))}
        </div>
        <button className="primary" onClick={() => createAt(days.includes(today) ? today : monday, Math.max(nowMin, 8 * 60))}>
          + Nouvel item
        </button>
      </header>

      {data.tasks.some((t) => !t.done) && (
        <div
          className={"task-tray" + (drag?.taskId ? " droppable" : "") + (overTray ? " over" : "")}
          onDragOver={(e) => {
            if (!drag?.taskId) return;
            e.preventDefault();
            setOverTray(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverTray(false);
          }}
          onDrop={(e) => {
            if (!drag?.taskId) return;
            e.preventDefault();
            const id = drag.taskId;
            update((d) => unscheduleTask(d, id));
            endDrag();
          }}
        >
          <span className="muted small">
            {drag?.taskId ? "Dépose ici pour retirer de l'agenda" : toPlan.length ? "À planifier :" : "Toutes les tâches sont planifiées"}
          </span>
          {toPlan.map((t) => (
            <button
              key={t.id}
              className="tray-task"
              draggable
              style={{ ["--cat" as string]: priorityOf(t).color }}
              title="Glisse la tâche sur l'agenda, ou clique pour la modifier"
              onClick={() => setOpenTask(t)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", t.title);
                setDrag({ kind: "task", id: t.id, length: t.duration ?? DEFAULT_DURATION, offsetMin: 0 });
              }}
              onDragEnd={endDrag}
            >
              <span>{t.title}</span>
              {t.due && <span className="muted">⏰ {dayHeader(t.due).day}/{t.due.slice(5, 7)}</span>}
            </button>
          ))}
        </div>
      )}

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
                  className={"day-plan" + (planned ? " has-plan" : "")}
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
                className={"week-col" + (d === today ? " today" : "") + (hover?.date === d ? " drop-target" : "")}
                style={{ height: GRID_PX, backgroundSize: `100% ${HOUR_PX}px` }}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  const minutes = minuteAt(e, drag);
                  if (hover?.date !== d || hover.minutes !== minutes) setHover({ date: d, minutes });
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setHover(null);
                }}
                onDrop={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  drop(d, minuteAt(e, drag), drag);
                  endDrag();
                }}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  createAt(d, START_MIN + (y / HOUR_PX) * 60);
                }}
              >
                {d === today && nowMin >= START_MIN && <div className="now-line" style={{ top: ((nowMin - START_MIN) / 60) * HOUR_PX }} />}
                {drag && hover?.date === d && (
                  <div
                    className="drop-preview"
                    style={{
                      top: ((hover.minutes - START_MIN) / 60) * HOUR_PX,
                      height: (Math.min(drag.length, 24 * 60 - hover.minutes) / 60) * HOUR_PX - 2,
                    }}
                  >
                    {toHhmm(hover.minutes)}
                  </div>
                )}
                {events.map((ev) => {
                  // Ce qui commence avant 6 h est ramené en haut de la grille.
                  const s = Math.max(toMinutes(ev.start), START_MIN);
                  const len = Math.max(toMinutes(ev.end) - s, SNAP_MIN);
                  const p = pos.get(ev.id)!;
                  const c = catOf(ev.categoryId);
                  const task = taskOf(ev.taskId);
                  const title = task?.title ?? ev.title;
                  return (
                    <button
                      key={ev.id}
                      className={"event" + (len < 45 ? " short" : "") + (task ? " task-event" : "") + (task?.done ? " done" : "")}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", title);
                        const grabbed = ((e.clientY - e.currentTarget.getBoundingClientRect().top) / HOUR_PX) * 60;
                        setDrag({
                          kind: "event",
                          id: ev.id,
                          taskId: ev.taskId,
                          length: toMinutes(ev.end) - toMinutes(ev.start),
                          offsetMin: Math.floor(grabbed / SNAP_MIN) * SNAP_MIN,
                        });
                      }}
                      onDragEnd={endDrag}
                      style={{
                        top: ((s - START_MIN) / 60) * HOUR_PX,
                        height: (len / 60) * HOUR_PX - 2,
                        left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
                        width: `calc(${100 / p.cols}% - 4px)`,
                        ["--cat" as string]: c.color,
                      }}
                      onClick={() => (task ? setOpenTask(task) : setDraft(structuredClone(ev)))}
                      title={`${ev.start}–${ev.end} · ${title}`}
                    >
                      <span className="event-title">{title}</span>
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
      {openTask && <TaskModal task={openTask} onClose={() => setOpenTask(null)} />}
      {openDay && <DayModal date={openDay} onClose={() => setOpenDay(null)} />}
    </section>
  );
}

function EventModal({ draft: initial, categories, onClose }: { draft: Draft; categories: Category[]; onClose: () => void }) {
  const { data, update } = useStore();
  const [draft, setDraft] = useState<Draft>(initial);
  const [cut, setCut] = useState(true);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const timeOk = toMinutes(draft.end) > toMinutes(draft.start);
  const containers = timeOk ? containersOf(data.schedule.events, draft) : [];
  const title = draft.title.trim();
  const valid = !!title && !!draft.date && timeOk;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const ev: ScheduleEvent = { ...draft, id: draft.id ?? newId("ev"), title };
    update((d) => {
      if (cut) cutContainers(d.schedule.events, ev);
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
          {containers.length > 0 && (
            <label className="wide cut-option">
              <input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} />
              <span>
                Couper {containers.map((x) => `« ${x.title} »`).join(", ")}
                <span className="muted small">
                  {" "}
                  →{" "}
                  {containers
                    .map((x) =>
                      [x.start < draft.start && `${x.start}–${draft.start}`, draft.end < x.end && `${draft.end}–${x.end}`]
                        .filter(Boolean)
                        .join(" et "),
                    )
                    .join(" ; ")}
                </span>
              </span>
            </label>
          )}
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
