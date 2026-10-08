# Réunions · repères pour coder (le détail des règles : docs/regles-reunions.html)

- 20 réunions sur un socle commun : `src/components/reunion/base.tsx` (`useReunion`, `FenetreEquipe`, `BlocSuivi`,
  `EtapeConcretisation`, `EtapeCompteRendu`) ; le Daily a son propre fichier `src/components/Daily.tsx`.
- Séries : `src/series.ts`, `src/reunions.ts`, onglet Sheet « Reunions ». Calendrier agile : `CalendrierAgile.tsx`.
- Points : onglet `PointsReunion` (`ONGLET_POINTS` dans `src/magasin.ts`) ; types Blocage / Décision / Action ;
  `element` = élément concerné.
- Concrétisation (une seule feuille partout) : `reunion/Concretiser.tsx` + logique pure `src/concretisation.ts`
  (`choixParDefaut`, `rattachementPour`, `elementACreer`, `patchConcretise`).
- Suivi : `src/pointsSuivi.ts` (statuts, `planSuivi`, `appliquerPlan`, `relierEscalades`) + `reunion/Suivi.tsx`
  (`LignesSuivi`, feuille du point). Escalade : `src/suiviEscalade.ts` ; colonne `echange` relie bas et haut ;
  `Echange.point` = « espace|id[|espaceHaut|idHaut] » (« Valider ? »).
- Chat : `ChatEchanges.tsx`, `EchangesView.tsx` ; réponse « Valider ? » traitée dans `App.tsx` (`repondreEchange`).
- Fiche d'un élément : `components/PointsElement.tsx` (« 📅 Points de réunion · n »).
- Toute écriture de plusieurs lignes : groupée, avec un test de comptage dans `scripts/verif-sheets.ts`.
- Modales RN-web : monter une feuille seulement quand elle est ouverte (sinon elle passe sous la fenêtre ouverte).
