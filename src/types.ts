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
  /** Rayon (voir FOOD_CATEGORIES). */
  category?: FoodCategoryId;
}

/** Rayons servant à classer les ingrédients dans le choix d'aliment. */
export const FOOD_CATEGORIES = [
  { id: "viande", label: "Viande & charcuterie", icon: "🥩" },
  { id: "poisson", label: "Poisson", icon: "🐟" },
  { id: "oeuf", label: "Œufs & tofu", icon: "🥚" },
  { id: "fromage", label: "Fromage", icon: "🧀" },
  { id: "laitage", label: "Yaourts & laitages", icon: "🥛" },
  { id: "feculent", label: "Féculents & légumineuses", icon: "🍚" },
  { id: "cereales", label: "Céréales du matin", icon: "🥣" },
  { id: "legume", label: "Légumes", icon: "🥦" },
  { id: "fruit", label: "Fruits", icon: "🍎" },
  { id: "graines", label: "Oléagineux & graines", icon: "🥜" },
  { id: "snack", label: "Snacks & desserts", icon: "🍫" },
  { id: "matiere", label: "Matières grasses & sauces", icon: "🫒" },
  { id: "epicerie", label: "Épicerie", icon: "🧂" },
  { id: "complement", label: "Compléments", icon: "💪" },
  { id: "autre", label: "Autres", icon: "🍽️" },
] as const;

export type FoodCategoryId = (typeof FOOD_CATEGORIES)[number]["id"];

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


export interface ScheduleEvent {
  id: string;
  /** Date ISO (AAAA-MM-JJ). */
  date: string;
  /** Heures « HH:MM ». */
  start: string;
  end: string;
  title: string;
  categoryId: string;
}

export interface Schedule {
  categories: Category[];
  events: ScheduleEvent[];
}

/** Les repas d'une journée, dans l'ordre d'affichage. */
export const MEAL_SLOTS = [
  { id: "petitdej", label: "Petit déjeuner", icon: "☕" },
  { id: "dejeuner", label: "Déjeuner", icon: "🍽️" },
  { id: "collation", label: "Collation", icon: "🍌" },
  { id: "diner", label: "Dîner", icon: "🌙" },
] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number]["id"];

/** Plan de repas d'un jour : aliments prévus par repas. */
export interface MealPlan {
  meals: Partial<Record<MealSlot, Entry[]>>;
  /** Repas déjà reportés dans le suivi nutrition. */
  done?: MealSlot[];
}

export interface AppData {
  version: number;
  schedule: Schedule;
  ingredients: Ingredient[];
  recipes: Recipe[];
  /** Clé = date ISO (AAAA-MM-JJ). */
  days: Record<string, Entry[]>;
  /** Clé = date ISO (AAAA-MM-JJ). */
  mealPlans: Record<string, MealPlan>;
  objectives: Record<NutrientKey, Objective>;
}
