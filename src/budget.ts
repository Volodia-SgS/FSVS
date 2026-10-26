import { newId } from "./nutrition";
import type { Budget, BudgetGroup, BudgetLine, BudgetMonth, BudgetOp } from "./types";

/** Mois au format « AAAA-MM ». */
export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const shiftMonth = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (key: string, short = false) => {
  const [y, m] = key.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", short ? { month: "short", year: "2-digit" } : { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** « de juin », « d'août ». */
export const ofMonth = (key: string) => {
  const m = monthLabel(key).toLowerCase();
  return /^[aeiouéè]/.test(m) ? `d'${m}` : `de ${m}`;
};

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const eur = (n: number) => EUR.format(n);

const round = (n: number) => Math.round(n * 100) / 100;

export const lineTotal = (l: BudgetLine) => round(l.ops.reduce((s, o) => s + o.amount, 0));
export const linesTotal = (ls: BudgetLine[]) => round(ls.reduce((s, l) => s + lineTotal(l), 0));
export const groupTotal = (g: BudgetGroup) => linesTotal(g.lines);

export function monthTotals(m: BudgetMonth) {
  const income = linesTotal(m.incomes);
  const spent = round(m.groups.reduce((s, g) => s + groupTotal(g), 0));
  const target = round(m.groups.reduce((s, g) => s + g.target, 0));
  const savings = round(income - spent);
  return {
    income,
    spent,
    target,
    savings,
    targetSavings: round(income - target),
    /** Solde attendu en fin de mois si toutes les dépenses ont été notées. */
    expectedClosing: m.opening != null ? round(m.opening + savings) : undefined,
  };
}

/** Couleur d'un montant dépensé par rapport à sa cible. */
export const spentLevel = (spent: number, target: number) =>
  !target ? (spent ? "warn" : "ok") : spent <= target ? "ok" : spent <= target * 1.1 ? "warn" : "alert";

/** Solde de départ proposé : la fin du mois précédent (réelle si on l'a notée). */
export function suggestedOpening(budget: Budget, key: string) {
  const prev = budget.months[shiftMonth(key, -1)];
  return prev ? (prev.closing ?? monthTotals(prev).expectedClosing) : undefined;
}

export function newMonth(budget: Budget, key: string): BudgetMonth {
  const m = structuredClone(budget.template);
  for (const l of [...m.incomes, ...m.groups.flatMap((g) => g.lines)]) l.ops = l.ops.map((o) => ({ ...o, id: newId("op") }));
  return { ...m, opening: suggestedOpening(budget, key), closing: undefined };
}

/**
 * Lit une saisie comme « 7,90 + 10,90 », « Resto 12,5 » ou « 22,98 - 19,99 » (remboursement).
 * Renvoie null si elle ne contient aucun montant.
 */
export function parseOps(text: string): BudgetOp[] | null {
  const ops: BudgetOp[] = [];
  for (const part of text.split("+")) {
    // Un « - » suivi d'un chiffre démarre un montant négatif ; « Saint-Malo » reste un libellé.
    part.split(/-(?=\s*\d)/).forEach((piece, i) => {
      const nums = [...piece.matchAll(/\d+(?:[.,]\d+)?/g)];
      if (!nums.length) return;
      const last = nums[nums.length - 1];
      const amount = Number(last[0].replace(",", ".")) * (i ? -1 : 1);
      const label = (piece.slice(0, last.index) + piece.slice(last.index! + last[0].length)).replace(/€/g, "").trim();
      ops.push({ id: newId("op"), amount, ...(label ? { label } : {}) });
    });
  }
  return ops.length ? ops : null;
}

/** Parts des donuts, dans l'ordre des lignes (palette du classeur). */
export const DONUT_COLORS = ["#4285F4", "#EA4335", "#FBBC04", "#34A853", "#FF6D01", "#46BDC6", "#7BAAF7"];
export const SAVINGS_COLOR = "#DD7E6B";
const HEAD_COLORS: Record<string, string> = {
  transports: "#FFE599",
  nourriture: "#9FC5E8",
  abonnements: "#B6D7A8",
  divers: "#B4A7D6",
  investissements: "#EAD1DC",
};
const EXTRA_HEAD_COLORS = ["#F9CB9C", "#A2C4C9", "#D5A6BD", "#D9D9D9"];
export const groupColor = (g: BudgetGroup, i: number) => g.color ?? HEAD_COLORS[g.id] ?? EXTRA_HEAD_COLORS[i % EXTRA_HEAD_COLORS.length];

const line = (label: string, ...amounts: number[]): BudgetLine => ({
  id: newId("bl"),
  label,
  ops: amounts.map((amount) => ({ id: newId("op"), amount })),
});

/** Postes de départ ; les montants s'ajustent dans « Modèle » ou en important le classeur. */
export const defaultBudget = (): Budget => ({
  template: {
    incomes: [line("Salaire"), line("Argent famille"), line("Investissements"), line("Dividendes"), line("Activités secondaires")],
    groups: [
      { id: "transports", label: "Transports", icon: "🚇", target: 0, lines: [line("Navigo"), line("Tickets supplémentaires")] },
      { id: "nourriture", label: "Nourriture", icon: "🛒", target: 0, lines: [line("Courses"), line("Repas extérieurs")] },
      { id: "abonnements", label: "Abonnements", icon: "🔁", target: 0, lines: [] },
      {
        id: "divers",
        label: "Dépenses diverses",
        icon: "🛍️",
        target: 0,
        lines: [line("Vêtements"), line("Matériel"), line("Sorties"), line("Jeux"), line("Voyages")],
      },
      {
        id: "investissements",
        label: "Investissements",
        icon: "📈",
        target: 0,
        lines: [line("Actions"), line("Matériel pour projets"), line("Logiciels pour projets")],
      },
    ],
  },
  months: {},
});
