/** Dates en ISO local (AAAA-MM-JJ) et heures « HH:MM ». */

export const toIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const todayIso = () => toIso(new Date());

export const shiftDate = (iso: string, days: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toIso(d);
};

/** Lundi de la semaine contenant la date. */
export const weekStart = (iso: string) => {
  const day = new Date(iso + "T12:00:00").getDay();
  return shiftDate(iso, -((day + 6) % 7));
};

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export const toHhmm = (minutes: number) => {
  const m = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
