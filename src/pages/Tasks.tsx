import { useMemo, useState } from "react";
import { newTask, TaskModal } from "../components/TaskModal";
import { shiftDate, todayIso, weekStart } from "../dates";
import { newId } from "../nutrition";
import { useStore } from "../store";
import { compareTasks, fmtDuration, priorityOf, recurrenceLabel, slotOf, taskDate, toggleTask } from "../tasks";
import type { AppData, Task } from "../types";

const shortDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

/** Rubriques de la liste, dans l'ordre. */
function groupOf(date: string | undefined, today: string) {
  if (!date) return "none";
  if (date < today) return "late";
  if (date === today) return "today";
  if (date === shiftDate(today, 1)) return "tomorrow";
  if (date <= shiftDate(weekStart(today), 6)) return "week";
  return "later";
}

const GROUPS = [
  { id: "late", label: "En retard" },
  { id: "today", label: "Aujourd'hui" },
  { id: "tomorrow", label: "Demain" },
  { id: "week", label: "Cette semaine" },
  { id: "later", label: "Plus tard" },
  { id: "none", label: "Sans date" },
];

export function Tasks() {
  const { data, update } = useStore();
  const [view, setView] = useState<"todo" | "done">("todo");
  const [quick, setQuick] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const today = todayIso();

  const todo = useMemo(() => data.tasks.filter((t) => !t.done).sort(compareTasks(data)), [data]);
  const done = useMemo(
    () => data.tasks.filter((t) => t.done).sort((a, b) => b.done!.localeCompare(a.done!)),
    [data.tasks],
  );

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    update((d) => void d.tasks.push({ ...newTask(title), id: newId("task") }));
    setQuick("");
  };

  const clearDone = () => {
    if (!confirm(`Supprimer définitivement les ${done.length} tâches faites ?`)) return;
    const ids = new Set(done.map((t) => t.id));
    update((d) => {
      d.tasks = d.tasks.filter((t) => !ids.has(t.id));
      d.schedule.events = d.schedule.events.filter((e) => !e.taskId || !ids.has(e.taskId));
    });
  };

  return (
    <section className="card tasks">
      <header className="tasks-head">
        <form className="quick-add" onSubmit={add}>
          <input
            placeholder="Ajouter une tâche… (Entrée)"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            aria-label="Nouvelle tâche"
          />
          <button className="primary" type="submit" disabled={!quick.trim()}>
            Ajouter
          </button>
        </form>
        <button className="ghost small" onClick={() => setEditing(newTask(quick.trim()))}>
          + Avec détails
        </button>
        <div className="seg">
          <button className={view === "todo" ? "active" : ""} onClick={() => setView("todo")}>
            À faire <span className="muted">{todo.length}</span>
          </button>
          <button className={view === "done" ? "active" : ""} onClick={() => setView("done")}>
            Faites <span className="muted">{done.length}</span>
          </button>
        </div>
      </header>

      {view === "todo" &&
        (todo.length ? (
          GROUPS.map((g) => {
            const items = todo.filter((t) => groupOf(taskDate(t, slotOf(data, t.id)), today) === g.id);
            if (!items.length) return null;
            return (
              <div key={g.id} className={"task-group" + (g.id === "late" ? " late" : "")}>
                <h3>
                  {g.label} <span className="muted">{items.length}</span>
                </h3>
                <ul className="task-list">
                  {items.map((t) => (
                    <TaskRow key={t.id} task={t} data={data} onOpen={() => setEditing(t)} />
                  ))}
                </ul>
              </div>
            );
          })
        ) : (
          <p className="muted empty">Rien à faire.</p>
        ))}

      {view === "done" &&
        (done.length ? (
          <>
            <ul className="task-list">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} data={data} onOpen={() => setEditing(t)} />
              ))}
            </ul>
            <div className="row-actions end">
              <button className="ghost small danger" onClick={clearDone}>
                Supprimer les tâches faites
              </button>
            </div>
          </>
        ) : (
          <p className="muted empty">Aucune tâche faite.</p>
        ))}

      {editing && (
        <TaskModal task={editing} onClose={() => setEditing(null)} onSaved={() => !editing.id && setQuick("")} />
      )}
    </section>
  );
}

function TaskRow({ task, data, onOpen }: { task: Task; data: AppData; onOpen: () => void }) {
  const { update } = useStore();
  const slot = slotOf(data, task.id);
  const p = priorityOf(task);
  const subs = task.subtasks ?? [];
  const late = !task.done && !!task.due && task.due < todayIso();

  return (
    <li className={"task" + (task.done ? " done" : "")} style={{ ["--cat" as string]: p.color }}>
      <input
        type="checkbox"
        className="task-check"
        checked={!!task.done}
        onChange={() => update((d) => toggleTask(d, task.id))}
        aria-label={task.done ? "Remettre à faire" : "Marquer comme faite"}
      />
      <div className="task-main">
        <button className="task-body" onClick={onOpen}>
          <span className="task-title">{task.title}</span>
          <span className="task-meta">
            {task.done && <span>Faite le {shortDate(task.done)}</span>}
            {!task.done && task.due && <span className={late ? "late" : ""}>⏰ {shortDate(task.due)}</span>}
            {!task.done && slot && (
              <span className="planned-chip">
                📅 {shortDate(slot.date)} {slot.start}
              </span>
            )}
            {task.duration && <span>⏱ {fmtDuration(task.duration)}</span>}
            {!!subs.length && (
              <span>
                ☑ {subs.filter((s) => s.done).length}/{subs.length}
              </span>
            )}
            {task.recurrence && <span>🔁 {recurrenceLabel(task.recurrence)}</span>}
          </span>
        </button>
        {!!subs.length && (
          <ul className="task-subs">
            {subs.map((s) => (
              <li key={s.id} className={s.done ? "done" : ""}>
                <label>
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) =>
                      update((d) => {
                        const sub = d.tasks.find((t) => t.id === task.id)?.subtasks?.find((x) => x.id === s.id);
                        if (sub) sub.done = e.target.checked;
                      })
                    }
                  />
                  {s.title}
                </label>
              </li>
            ))}
          </ul>
        )}
        {task.notes && (
          <p className="task-notes" onClick={onOpen}>
            {task.notes}
          </p>
        )}
      </div>
      {task.priority !== "normale" && !task.done && <span className="task-prio">{p.label}</span>}
    </li>
  );
}
