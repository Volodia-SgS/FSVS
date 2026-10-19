# Nutrition

Webapp de suivi des macronutriments, reprise du classeur Excel « Nutrition 2 ».

- **Suivi** : saisie du jour (ingrédients en g / unités / portions, recettes en repas, saisie libre), écart aux objectifs, historique coloré comme la mise en forme conditionnelle de l'Excel.
- **Recettes** : ingrédients de la recette complète + nombre de repas → valeurs d'un repas. Les recettes importées gardent les valeurs de l'Excel (« saisies à la main ») tant que la liste d'ingrédients n'est pas complète.
- **Ingrédients** : valeurs pour 100 g, ou pour une portion (whey, barre…). Le poids d'une unité (ex. 1 œuf = 60 g) permet de saisir des unités.
- **Objectifs** : min / objectif / max et couleur hors fourchette, plus export / import JSON des données.

Les données sont enregistrées dans le navigateur (localStorage) et, une fois connecté, synchronisées avec Supabase (une ligne JSON par compte, table `user_data`, protégée par RLS : voir `supabase/schema.sql`). Sans configuration Supabase, l'app fonctionne en local uniquement.

## Lancer

Copier `.env.example` en `.env.local` et y mettre l'URL et la clé publishable du projet Supabase, puis :

```bash
pnpm install
npx vite
```

## Mise en ligne

Hébergé sur Vercel (import du dépôt GitHub, préréglage Vite) avec les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`. Chaque push sur `main` redéploie.

Puis ouvrir http://localhost:5180.

## Réimporter l'Excel

```bash
python scripts/import_excel.py "C:/Users/Volodia S/Desktop/Nutrition 2.xlsx"
```

Régénère `src/seed.json` (données de départ) et compare, jour par jour, les totaux recalculés à ceux d'Excel.
