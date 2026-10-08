This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Google Sheets : quota (règle du projet)

Google refuse au-delà d'environ **60 écritures par minute** par utilisateur. Donc :

- Jamais un appel à Google par élément dans une boucle (`createEntity` / `updateEntity` / `saveOrg` en série) :
  grouper avec `ecrireLot` (une lecture et une écriture par onglet), ou ajouter une opération groupée équivalente.
- Toute nouvelle écriture de plusieurs éléments a un test dans `scripts/verif-sheets.ts` qui compte les appels
  (ex. « 110 éléments en 4 appels »).
- Tout passe par `appel` (src/gsheets.ts) : file d'attente du quota (30 lectures et 30 écritures par minute
  glissante, 250 ms d'écart) et attente croissante sur 429 / 5xx. Ne jamais appeler Google sans passer par `appel`.
- Les lectures d'onglets faites en même temps sont groupées (values:batchGet) : lire un espace = 1 appel.
- Même règle pour Claude quand il lit ou écrit lui-même dans un Sheet (connecteur Google Sheets) : lectures et
  écritures groupées (plages multiples en un appel), au plus 50 appels par minute, au moins 1 s entre deux
  appels ; sur refus (429 / quota), attendre 1 s, 2 s, 4 s… (au plus 64 s) avant de réessayer, 6 fois au plus ;
  jamais de suppression de ligne (écrire `pris_en_compte`, l'application supprime).

## Pièces jointes des échanges

Règles et procédé de Claude : `../docs/claude/pieces-jointes.md` (à lire seulement pour ce sujet).
