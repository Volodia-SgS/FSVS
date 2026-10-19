/** Ordre fixe des nutriments : tous les tableaux `values` suivent cet ordre. */
export const NUTRIENTS = [
  { key: "kcal", label: "Calories", short: "Kcal", unit: "kcal" },
  { key: "proteines", label: "Protéines", short: "Prot.", unit: "g" },
  { key: "glucides", label: "Glucides", short: "Gluc.", unit: "g" },
  { key: "sucres", label: "dont sucres", short: "Sucres", unit: "g" },
  { key: "lipides", label: "Lipides", short: "Lip.", unit: "g" },
  { key: "satures", label: "dont AG saturés", short: "AGS", unit: "g" },
  { key: "fibres", label: "Fibres", short: "Fibres", unit: "g" },
  { key: "sel", label: "Sel", short: "Sel", unit: "g" },
] as const;

export type NutrientKey = (typeof NUTRIENTS)[number]["key"];
export type Values = number[];

export interface Ingredient {
  id: string;
  name: string;
  /** Valeurs données pour 100 g, ou pour une portion (ex. 1 scoop de whey). */
  basis: "100g" | "portion";
  values: Values;
  /** Poids d'une unité en g (ex. 1 œuf = 60 g) : permet de saisir « 3 œufs ». */
  unitWeight?: number;
  /** Nom de la portion quand basis = "portion" (scoop, barre…). */
  unitLabel?: string;
}

export type Unit = "g" | "unit" | "portion";

export interface RecipeItem {
  refId: string;
  qty: number;
  unit: Unit;
}

export interface Recipe {
  id: string;
  name: string;
  /** Nombre de repas que donne la recette. */
  portions: number;
  items: RecipeItem[];
  /** Valeurs d'une portion saisies à la main ; prioritaires sur le calcul. */
  manualValues?: Values;
  notes?: string;
}

export type Entry =
  | { id: string; kind: "ingredient"; refId: string; qty: number; unit: Unit }
  | { id: string; kind: "recipe"; refId: string; qty: number }
  | { id: string; kind: "custom"; label: string; values: Values };

/** Couleur d'une valeur hors fourchette. */
export type Level = "ok" | "warn" | "alert";

export interface Objective {
  target?: number;
  min?: number;
  max?: number;
  below?: Level;
  above?: Level;
}

/** Type d'item de l'emploi du temps, avec sa couleur. */
export interface Category {
  id: string;
  label: string;
  color: string;
}

/** Catégorie réservée aux repas planifiés (aliments + quantités). */
export const MEAL_CATEGORY = "repas";

export interface ScheduleEvent {
  id: string;
  /** Date ISO (AAAA-MM-JJ). */
  date: string;
  /** Heures « HH:MM ». */
  start: string;
  end: string;
  title: string;
  categoryId: string;
  /** Repas planifié : aliments prévus. */
  foods?: Entry[];
  /** Repas planifié déjà reporté dans le suivi nutrition. */
  eaten?: boolean;
}

export interface Schedule {
  categories: Category[];
  events: ScheduleEvent[];
}

export interface AppData {
  version: number;
  schedule: Schedule;
  ingredients: Ingredient[];
  recipes: Recipe[];
  /** Clé = date ISO (AAAA-MM-JJ). */
  days: Record<string, Entry[]>;
  objectives: Record<NutrientKey, Objective>;
}
