import { shiftDate, toHhmm, todayIso, toMinutes, toIso } from "./dates";
import { newId } from "./nutrition";
import { TASK_CATEGORY } from "./store";
import { PRIORITIES, type AppData, type Recurrence, type ScheduleEvent, type Task } from "./types";

export const DEFAULT_DURATION = 60;

export const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

export const fmtDuration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
};

export const priorityOf = (t: Task) => PRIORITIES.find((p) => p.id === t.priority) ?? PRIORITIES[1];

/** Créneau de l'agenda où la tâche est planifiée. */
export const slotOf = (data: AppData, taskId: string) => data.schedule.events.find((e) => e.taskId === taskId);

/** Date qui compte pour le classement : la plus proche entre l'échéance et le créneau prévu. */
export const taskDate = (task: Task, slot?: ScheduleEvent) =>
  [task.due, slot?.date].filter((d): d is string => !!d).sort()[0];

const RANK = Object.fromEntries(PRIORITIES.map((p, i) => [p.id, i]));

export const compareTasks = (data: AppData) => (a: Task, b: Task) =>
  (taskDate(a, slotOf(data, a.id)) ?? "9999").localeCompare(taskDate(b, slotOf(data, b.id)) ?? "9999") ||
  RANK[a.priority] - RANK[b.priority] ||
  a.created.localeCompare(b.created);

export function nextDue(from: string, r: Recurrence) {
  if (r.unit === "day") return shiftDate(from, r.every);
  if (r.unit === "week") return shiftDate(from, r.every * 7);
  const d = new Date(from + "T12:00:00");
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + r.every);
  // 31 janvier + 1 mois = dernier jour de février.
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toIso(d);
}

export const recurrenceLabel = (r: Recurrence) => {
  const unit = { day: ["jour", "jours"], week: ["semaine", "semaines"], month: ["mois", "mois"] }[r.unit];
  return r.every === 1 ? `Chaque ${unit[0]}` : `Tous les ${r.every} ${unit[1]}`;
};

/** Coche ou décoche une tâche ; une tâche répétée crée la suivante au moment où on la coche. */
export function toggleTask(d: AppData, id: string) {
  const task = d.tasks.find((t) => t.id === id);
  if (!task) return;
  if (task.done) {
    task.done = undefined;
    return;
  }
  task.done = todayIso();
  if (task.recurrence) {
    d.tasks.push({
      ...structuredClone(task),
      id: newId("task"),
      created: todayIso(),
      done: undefined,
      due: nextDue(task.due ?? todayIso(), task.recurrence),
      subtasks: task.subtasks?.map((s) => ({ ...s, done: false })),
    });
    // Elle ne se répète plus elle-même : c'est la suivante qui porte la répétition.
    task.recurrence = undefined;
  }
}

/** Place la tâche dans l'agenda, en remplaçant son créneau précédent. */
export function scheduleTask(d: AppData, task: Task, date: string, start: string, length?: number) {
  const old = slotOf(d, task.id);
  const len = length ?? task.duration ?? (old ? toMinutes(old.end) - toMinutes(old.start) : DEFAULT_DURATION);
  const categoryId =
    old?.categoryId ?? (d.schedule.categories.find((c) => c.id === TASK_CATEGORY.id) ?? d.schedule.categories[0]).id;
  const startMin = Math.min(toMinutes(start), 24 * 60 - 15);
  const ev: ScheduleEvent = {
    id: old?.id ?? newId("ev"),
    date,
    start: toHhmm(startMin),
    end: toHhmm(startMin + len),
    title: task.title,
    categoryId,
    taskId: task.id,
  };
  d.schedule.events = [...d.schedule.events.filter((e) => e.taskId !== task.id), ev];
}

export const unscheduleTask = (d: AppData, id: string) =>
  void (d.schedule.events = d.schedule.events.filter((e) => e.taskId !== id));

export function deleteTask(d: AppData, id: string) {
  d.tasks = d.tasks.filter((t) => t.id !== id);
  unscheduleTask(d, id);
}
