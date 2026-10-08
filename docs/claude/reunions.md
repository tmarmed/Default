# Réunions · repères pour coder (le détail des règles : docs/regles-reunions.html)

- 20 réunions sur un socle commun : `src/components/reunion/base.tsx` (`useReunion`, `FenetreEquipe`, `BlocSuivi`,
  `EtapeConcretisation`, `EtapeCompteRendu`) ; le Daily a son propre fichier `src/components/Daily.tsx`.
- Séries : `src/series.ts`, `src/reunions.ts`, onglet Sheet « Reunions ». Calendrier agile : `CalendrierAgile.tsx`.
- Notes : onglet `PointsReunion` (`ONGLET_POINTS` dans `src/magasin.ts`) ; types Blocage / Décision / Demande
  d'action ; `sous_type` de la Décision (`a_prendre` / `prise`) ; `element` = élément concerné ; libellé :
  `libelleNote` (`src/daily.ts`). Notes à concrétiser reportées : `aReprendre` (`src/suiviEscalade.ts`).
- Concrétisation (une seule feuille partout) : `reunion/Concretiser.tsx` + logique pure `src/concretisation.ts`
  (`choixParDefaut`, `rattachementPour`, `elementACreer`, `patchConcretise`).
- Suivi : `src/pointsSuivi.ts` (statuts, `planSuivi`, `appliquerPlan`, `relierEscalades`) + `reunion/Suivi.tsx`
  (`LignesSuivi`, feuille du point). Escalade : `src/suiviEscalade.ts` ; colonne `echange` relie bas et haut ;
  `Echange.point` = « espace|id[|espaceHaut|idHaut] » (« Valider ? »).
- Chat ↔ réunion (08/10, docs/cycles-de-vie.html) : « ↪ Transmettre » = logique pure `src/echange/transmettre.ts`
  (`planTransmettre`, `planRedescendre`, `liensSuivi`) ; feuilles et actions `components/Transmettre.tsx`
  (`FeuilleTransmettre`, `FeuilleTexte`, `ActionsEchange`) ; branchement `hierarchieEchanges` dans `App.tsx`.
  Échange : colonnes `parent` (maillon d'avant) et `nature` ; statut `transmis`. Plus de note d'office ni de
  réponse recopiée ; « Valider ? » remplacé par le rappel `TITRE_RAPPEL` (`src/pointsSuivi.ts`).
- Fiche d'un élément : `components/PointsElement.tsx` (« 📅 Points de réunion · n »).
- Toute écriture de plusieurs lignes : groupée, avec un test de comptage dans `scripts/verif-sheets.ts`.
- Modales RN-web : monter une feuille seulement quand elle est ouverte (sinon elle passe sous la fenêtre ouverte).
