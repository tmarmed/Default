# Carte du code (mobile/)

- `App.tsx` : état global, actions (Sheets, échanges, réunions), onglets, contextes fournis.
- `src/` logique pure : `types.ts` (modèle), `magasin.ts` (onglets et validation), `gsheets.ts` + `api.ts`
  (Google, file du quota via `appel`), `demo.ts`, `organisation.ts`, `droits.ts`, `subtasks.ts`, `pi.ts`.
- `src/components/` : fiches (`TaskForm`, `FeatureForm`, `EpicForm`, `ObjectifForm`…), `Choix.tsx` (lignes et
  sections de fiche), `FormSheet.tsx`, Chat, réunions (`reunion/`).
- `scripts/verif-*.ts` : tests sans réseau (lancés par `npm run verif:*`).
- `maquettes/` : ignoré par git (maquettes HTML locales).
