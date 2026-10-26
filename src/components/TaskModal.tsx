import { useState } from "react";
import { toHhmm, todayIso, toMinutes } from "../dates";
import { newId } from "../nutrition";
import { useStore } from "../store";
import {
  DEFAULT_DURATION,
  DURATIONS,
  deleteTask,
  fmtDuration,
  scheduleTask,
  slotOf,
  toggleTask,
  unscheduleTask,
} from "../tasks";
import { PRIORITIES, type AppData, type Recurrence, type Task } from "../types";
import { Modal } from "./Modal";

export const newTask = (title = ""): Task => ({ id: "", title, priority: "normale", created: todayIso() });

const REPEAT_UNITS: { id: Recurrence["unit"]; label: string }[] = [
  { id: "day", label: "jour(s)" },
  { id: "week", label: "semaine(s)" },
  { id: "month", label: "mois" },
];

/** Création ou modification d'une tâche, avec son créneau dans l'agenda. */
export function TaskModal({
  task: initial,
  onClose,
  onSaved,
}: {
  task: Task;
  onClose: () => void;
  /** Appelé quand la tâche a été enregistrée (pas si on annule). */
  onSaved?: () => void;
}) {
  const { data, update } = useStore();
  const isNew = !initial.id;
  const [task, setTask] = useState<Task>(() => structuredClone(initial));
  const existing = isNew ? undefined : slotOf(data, initial.id);
  const [slot, setSlot] = useState<{ date: string; start: string } | null>(
    existing ? { date: existing.date, start: existing.start } : null,
  );
  const [newSub, setNewSub] = useState("");
  const set = (patch: Partial<Task>) => setTask((t) => ({ ...t, ...patch }));
  const title = task.title.trim();

  const length =
    task.duration ?? (existing ? toMinutes(existing.end) - toMinutes(existing.start) : DEFAULT_DURATION);
  const slotEnd = slot ? toHhmm(Math.min(toMinutes(slot.start) + length, 24 * 60)) : "";

  const commit = (fn?: (d: AppData, t: Task) => void, target = slot) => {
    const saved: Task = { ...task, id: task.id || newId("task"), title, notes: task.notes?.trim() || undefined };
    if (!saved.subtasks?.length) saved.subtasks = undefined;
    update((d) => {
      const i = d.tasks.findIndex((t) => t.id === saved.id);
      if (i >= 0) d.tasks[i] = saved;
      else d.tasks.push(saved);
      if (target) scheduleTask(d, saved, target.date, target.start, length);
      else unscheduleTask(d, saved.id);
      fn?.(d, saved);
    });
    onSaved?.();
    onClose();
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (title) commit();
  };

  const remove = () => {
    if (!confirm(`Supprimer « ${initial.title} » ?`)) return;
    update((d) => deleteTask(d, initial.id));
    onClose();
  };

  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    set({ subtasks: [...(task.subtasks ?? []), { id: newId("sub"), title: t, done: false }] });
    setNewSub("");
  };
  const setSub = (id: string, patch: Partial<{ title: string; done: boolean }>) =>
    set({ subtasks: task.subtasks?.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  return (
    <Modal title={isNew ? "Nouvelle tâche" : "Modifier la tâche"} onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-grid">
          <label className="wide">
            Tâche
            <input
              autoFocus={isNew}
              placeholder="ex. Appeler le garage, Faire la déclaration d'impôts…"
              value={task.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </label>
          <div className="wide field">
            Priorité
            <div className="cat-choice">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={p.id === task.priority ? "active" : ""}
                  style={{ ["--cat" as string]: p.color }}
                  onClick={() => set({ priority: p.id })}
                >
                  <span className="legend-dot" style={{ background: p.color }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <label>
            Échéance
            <input type="date" value={task.due ?? ""} onChange={(e) => set({ due: e.target.value || undefined })} />
          </label>
          <label>
            Durée estimée
            <select
              value={task.duration ?? ""}
              onChange={(e) => set({ duration: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">—</option>
              {DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {fmtDuration(m)}
                </option>
              ))}
            </select>
          </label>
          <div className="wide field">
            Répéter
            <div className="repeat-row">
              <select
                value={task.recurrence ? "oui" : ""}
                onChange={(e) => set({ recurrence: e.target.value ? { every: 1, unit: "week" } : undefined })}
              >
                <option value="">Ne pas répéter</option>
                <option value="oui">Tous les…</option>
              </select>
              {task.recurrence && (
                <>
                  <input
                    type="number"
                    className="num short"
                    min={1}
                    value={task.recurrence.every}
                    onChange={(e) => set({ recurrence: { ...task.recurrence!, every: Math.max(1, Number(e.target.value) || 1) } })}
                  />
                  <select
                    value={task.recurrence.unit}
                    onChange={(e) => set({ recurrence: { ...task.recurrence!, unit: e.target.value as Recurrence["unit"] } })}
                  >
                    {REPEAT_UNITS.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          <div className="wide field">
            Dans l'agenda
            {slot ? (
              <div className="slot-row">
                <input type="date" value={slot.date} onChange={(e) => e.target.value && setSlot({ ...slot, date: e.target.value })} />
                <input type="time" step={15 * 60} value={slot.start} onChange={(e) => e.target.value && setSlot({ ...slot, start: e.target.value })} />
                <span className="muted">→ {slotEnd}</span>
                <button
                  type="button"
                  className="ghost small danger"
                  title="La tâche reste dans la liste, sans créneau"
                  // Un créneau déjà enregistré est retiré tout de suite ; un créneau juste ajouté est simplement annulé.
                  onClick={() => (existing && title ? commit(undefined, null) : setSlot(null))}
                >
                  Retirer de l'agenda
                </button>
              </div>
            ) : (
              <div className="slot-row">
                <button type="button" className="small" onClick={() => setSlot({ date: task.due ?? todayIso(), start: "09:00" })}>
                  📅 Planifier un créneau
                </button>
              </div>
            )}
          </div>

          <div className="wide field">
            Sous-tâches
            {!!task.subtasks?.length && (
              <ul className="subtasks">
                {task.subtasks.map((s) => (
                  <li key={s.id}>
                    <input type="checkbox" checked={s.done} onChange={(e) => setSub(s.id, { done: e.target.checked })} />
                    <input className={s.done ? "done" : ""} value={s.title} onChange={(e) => setSub(s.id, { title: e.target.value })} />
                    <button
                      type="button"
                      className="ghost small"
                      aria-label="Retirer"
                      onClick={() => set({ subtasks: task.subtasks?.filter((x) => x.id !== s.id) })}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              placeholder="+ Ajouter une sous-tâche (Entrée)"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                addSub();
              }}
              onBlur={addSub}
            />
          </div>

          <label className="wide">
            Notes
            <textarea rows={3} value={task.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
          </label>
        </div>

        <div className="modal-foot">
          {!isNew && (
            <button type="button" className="ghost danger" onClick={remove} style={{ marginRight: "auto" }}>
              Supprimer
            </button>
          )}
          {!isNew && (
            <button type="button" disabled={!title} onClick={() => commit((d, t) => toggleTask(d, t.id))}>
              {initial.done ? "Remettre à faire" : "✓ Marquer comme faite"}
            </button>
          )}
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={!title}>
            {isNew ? "Créer" : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
