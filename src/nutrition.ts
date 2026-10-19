import type { AppData, Entry, Ingredient, Level, Objective, Recipe, RecipeItem, Unit, Values } from "./types";
import { NUTRIENTS } from "./types";

export const zero = (): Values => NUTRIENTS.map(() => 0);
export const add = (a: Values, b: Values): Values => a.map((v, i) => v + (b[i] ?? 0));
export const scale = (a: Values, f: number): Values => a.map((v) => v * f);

/** Coefficient à appliquer aux valeurs de l'ingrédient pour une quantité donnée. */
export function ingredientFactor(ing: Ingredient, qty: number, unit: Unit): number {
  if (ing.basis === "portion") return unit === "g" && ing.unitWeight ? qty / ing.unitWeight : qty;
  if (unit === "g") return qty / 100;
  return (qty * (ing.unitWeight ?? 100)) / 100;
}

export function itemValues(data: AppData, item: RecipeItem): Values {
  const ing = data.ingredients.find((i) => i.id === item.refId);
  return ing ? scale(ing.values, ingredientFactor(ing, item.qty, item.unit)) : zero();
}

/** Valeurs d'une portion calculées à partir des ingrédients. */
export function computedRecipeValues(data: AppData, recipe: Recipe): Values {
  const total = recipe.items.reduce((acc, it) => add(acc, itemValues(data, it)), zero());
  return scale(total, 1 / Math.max(recipe.portions || 1, 1));
}

export function recipeValues(data: AppData, recipe: Recipe): Values {
  return recipe.manualValues ?? computedRecipeValues(data, recipe);
}

export function entryValues(data: AppData, entry: Entry): Values {
  if (entry.kind === "custom") return entry.values;
  if (entry.kind === "recipe") {
    const r = data.recipes.find((x) => x.id === entry.refId);
    return r ? scale(recipeValues(data, r), entry.qty) : zero();
  }
  return itemValues(data, entry);
}

export function dayTotal(data: AppData, entries: Entry[]): Values {
  return entries.reduce((acc, e) => add(acc, entryValues(data, e)), zero());
}

/** Reprend la logique de mise en forme conditionnelle de l'Excel. */
export function levelFor(value: number, obj: Objective | undefined): Level | null {
  if (!obj || (obj.min == null && obj.max == null)) return null;
  if (obj.min != null && value < obj.min) return obj.below ?? "warn";
  if (obj.max != null && value > obj.max) return obj.above ?? "alert";
  return "ok";
}

export function unitLabel(ing: Ingredient | undefined, unit: Unit, qty = 2): string {
  if (unit === "g") return "g";
  if (unit === "portion") return ing?.unitLabel ? ing.unitLabel + (qty > 1 ? "s" : "") : "portion" + (qty > 1 ? "s" : "");
  return qty > 1 ? "unités" : "unité";
}

export function defaultUnit(ing: Ingredient): Unit {
  return ing.basis === "portion" ? "portion" : "g";
}

export function unitsFor(ing: Ingredient): Unit[] {
  if (ing.basis === "portion") return ing.unitWeight ? ["portion", "g"] : ["portion"];
  return ing.unitWeight ? ["g", "unit"] : ["g"];
}

export function fmt(v: number, key?: string): string {
  if (!Number.isFinite(v)) return "–";
  if (key === "kcal") return Math.round(v).toString();
  if (key === "sel") return v.toFixed(2).replace(".", ",");
  return (Math.round(v * 10) / 10).toString().replace(".", ",");
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
