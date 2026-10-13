# Carte du code (mobile/)

- `App.tsx` : état global, actions (Sheets, échanges, réunions), onglets, contextes fournis.
- `src/` logique pure : `types.ts` (modèle), `magasin.ts` (onglets et validation), `gsheets.ts` + `api.ts`
  (Google, file du quota via `appel`), `demo.ts`, `organisation.ts`, `droits.ts`, `subtasks.ts`, `pi.ts`.
- `src/components/` : fiches (`TaskForm`, `FeatureForm`, `EpicForm`, `ObjectifForm`…), `Choix.tsx` (lignes et
  sections de fiche), `FormSheet.tsx`, Chat, réunions (`reunion/`).
- Ajouts du 13/10 (session 3) : `src/avancement.ts` (photo, comparaison, libellés de l'avancement) +
  `components/reunion/Avancement.tsx` (useAvancement, BlocAvancement ; branché dans `reunion/base.tsx` useReunion,
  `Daily.tsx`, `reunion/Simple.tsx`) ; `src/transverses.ts` (rôles transverses : catalogue, vers le bas, qui donne,
  Suppléant, peutAnimer) + `components/RolesTransverses.tsx` (fiche du niveau et de la personne, dans `OrgForm.tsx`) ;
  enveloppes des trains dans `src/budget.ts` (partTrain, situationEnveloppe, repartitionProposee) et
  `components/Budget.tsx` (RepartitionTrains, LignesEnveloppesTrains).
- `scripts/verif-*.ts` : tests sans réseau (lancés par `npm run verif:*`).
- `maquettes/` : ignoré par git (maquettes HTML locales).
