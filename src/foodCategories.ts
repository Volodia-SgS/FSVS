import type { FoodCategoryId } from "./types";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe");

/**
 * Mots-clés par rayon, testés dans l'ordre : le premier qui correspond l'emporte
 * (« Riz au lait » doit tomber dans les laitages avant que « riz » ne l'envoie en féculents).
 */
const RULES: [FoodCategoryId, string[]][] = [
  ["complement", ["whey", "proteine en poudre", "creatine"]],
  ["snack", ["mousse chocolat", "cheesecake", "fondant", "nutella", "biscuit", "pims", "pain au chocolat", "croissant", "barre", "sorbet", "glace", "chips", "chocolat", "bonbon", "gateau", "cookie", "brownie", "nuggets"]],
  ["laitage", ["riz au lait", "skyr", "yaourt", "yoplait", "fromage blanc", "lait", "creme", "petit suisse", "kefir"]],
  ["graines", ["cacahuete", "noix", "amande", "noisette", "cajou", "graines", "chia", "coco rapee", "cacao", "pistache"]],
  ["fromage", ["fromage", "leerdammer", "emmental", "comte", "mozzarella", "parmesan", "feta", "chevre", "camembert", "raclette", "crotin"]],
  ["poisson", ["thon", "saumon", "sardine", "maquereau", "cabillaud", "colin", "crevette", "poisson", "truite"]],
  ["viande", ["poulet", "dinde", "boeuf", "bavette", "steak", "jambon", "porc", "veau", "agneau", "canard", "lardon", "saucisse", "chorizo", "viande"]],
  ["oeuf", ["oeuf", "tofu", "tempeh"]],
  ["cereales", ["bran", "flocons", "son d'avoine", "corn flakes", "granola", "muesli", "cereales"]],
  ["matiere", ["huile", "beurre", "mayonnaise", "sauce", "ketchup", "moutarde", "vinaigrette", "margarine"]],
  ["feculent", ["riz", "pate", "pain", "lentille", "haricots rouges", "pois chiche", "pomme de terre", "patate", "quinoa", "semoule", "boulgour", "farine", "tortilla", "wrap"]],
  ["fruit", ["banane", "poire", "pomme", "clementine", "orange", "fraise", "framboise", "myrtille", "nectarine", "peche", "melon", "pasteque", "avocat", "kiwi", "mangue", "ananas", "raisin", "abricot", "cerise", "citron", "fruit"]],
  ["legume", ["poivron", "oignon", "echalote", "concombre", "tomate", "carotte", "haricots verts", "courgette", "mais", "salade", "brocoli", "epinard", "champignon", "aubergine", "chou", "poireau", "legume"]],
  ["epicerie", ["sucre", "sirop", "miel", "sel", "levure", "confiture"]],
];

/** Devine le rayon d'un ingrédient d'après son nom. */
export function guessCategory(name: string): FoodCategoryId {
  const n = norm(name);
  const hit = RULES.find(([, words]) => words.some((w) => n.includes(w)));
  return hit ? hit[0] : "autre";
}
