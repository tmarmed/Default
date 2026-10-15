# Carte du code (mobile/)

- `App.tsx` : état global, actions (Sheets, échanges, réunions), onglets, contextes fournis.
- `src/` logique pure : `types.ts` (modèle), `magasin.ts` (onglets et validation), `gsheets.ts` + `api.ts`
  (Google, file du quota via `appel`), `demo.ts`, `organisation.ts`, `droits.ts`, `subtasks.ts`, `pi.ts`,
  `avancement.ts` (photo, comparaison, filtre), `transverses.ts` (rôles transverses), `budget.ts` (enveloppes,
  demandes), `concretisation.ts` (choix, créations, texte du compte rendu).
- `src/components/` : fiches (`TaskForm`, `FeatureForm`, `EpicForm`, `ObjectifForm`…), Chat, réunions (`reunion/`).
- `scripts/verif-*.ts` : tests sans réseau (`npm run verif:*`) ; `scripts/parcours-reunions.mjs` : parcours des
  réunions de la démo avec captures (voir `verifier.md`).
- `maquettes/` : ignoré par git (maquettes HTML locales).

## Pièces communes (à réutiliser ; en créer une dès qu'un morceau existe deux fois)
| Besoin | Pièce | Fichier |
|---|---|---|
| Dates, euros, pluriels, nom tiré d'une adresse | `jourMois`, `euros`, `pluriel`, `nomDepuisEmail`… | `src/format.ts` |
| Nom d'une personne (identifiant ou adresse) | `nomPersonne`, `optionsPersonnes` | `src/organisation.ts` |
| Fenêtre d'une fiche ou d'une réunion | `FormSheet` (+ `TitreFiche`, `AlertList`) | `components/FormSheet.tsx` |
| État d'une fiche (en cours, erreur, « Échec de … ») | `useEtatFiche` | `components/FormSheet.tsx` |
| Sections et champs d'une **fiche** | `SectionFiche`, `ChampFiche`, `LigneChoix`, `ListeEnfants` | `components/Choix.tsx` |
| Fenêtres de choix | `ChoiceSheet`, `FeuilleChoix`, `FeuilleMulti` | `components/ChoiceSheet.tsx`, `Choix.tsx` |
| Rangée de pastilles de filtre | `RangeePastilles`, `Pastille` | `components/RangeePastilles.tsx` |
| Pastille « Filtres ▾ / ▴ » | `PastilleFiltres` | `components/PastilleFiltres.tsx` |
| Barre de filtres des onglets | `BarreFiltres`, `Filtres…` | `components/BarreFiltres.tsx` |
| Choix du domaine | `useChoixDomaine` | `components/DomainFilter.tsx` |
| **Bloc d'une réunion** (carte blanche, ▸ / ▾, « Nom (n) », 🌳, filtres) | `BlocBrique` | `components/reunion/Brique.tsx` |
| Arbre des éléments (Epic › Feature › Story › Tâche) | `BlocArbre` | `components/reunion/Arbre.tsx` |
| Notes et suivis d'une réunion | `BlocPoints`, `LignesSuivi` | `reunion/base.tsx`, `reunion/Suivi.tsx` |
| Compteurs (accordés : « 1 participant ») | `Compteur`, `Compteurs` | `reunion/ui.tsx`, `reunion/base.tsx` |
| Lecture des points d'une réunion | `usePointsLus`, `lirePlusieurs` | `reunion/usePointsLus.ts` |
| Données et opérations d'une réunion d'équipe | `useReunion` | `reunion/base.tsx` |
| Règles communes (concrétisation, créations, compte rendu, messages) | `moteur.ts` | `reunion/moteur.ts` |
| Avancement depuis la réunion précédente | `useAvancement`, `FiltreAvancement` | `reunion/Avancement.tsx` |
| Blocs du budget dans les réunions | `BlocDemandesBudget`, `BlocEnveloppes`, `BlocEcarts`… | `components/Budget.tsx` |

Règles : un bloc de réunion passe par `BlocBrique` (le style `SectionFiche` est réservé aux fiches et au Pilotage) ;
une variante = une option de la pièce commune, pas une copie.
