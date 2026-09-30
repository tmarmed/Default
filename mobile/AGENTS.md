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
- Tout passe par `appel` (src/gsheets.ts) : file d'attente du quota (50 lectures et 50 écritures par minute
  glissante, 250 ms d'écart) et attente croissante sur 429 / 5xx. Ne jamais appeler Google sans passer par `appel`.
- Les lectures d'onglets faites en même temps sont groupées (values:batchGet) : lire un espace = 1 appel.
- Même règle pour Claude quand il lit ou écrit lui-même dans un Sheet (connecteur Google Sheets) : lectures et
  écritures groupées (plages multiples en un appel), au plus 50 appels par minute, au moins 1 s entre deux
  appels ; sur refus (429 / quota), attendre 1 s, 2 s, 4 s… (au plus 64 s) avant de réessayer, 6 fois au plus ;
  jamais de suppression de ligne (écrire `pris_en_compte`, l'application supprime).

## Pièces jointes des échanges (Synchronisation)

Une image ne peut pas être « collée » dans une cellule (Google ne la rend pas lisible par l'API) ni stockée entière
(50 000 caractères au plus par cellule). Elle est rangée en texte base64 dans l'onglet `PiecesJointes` du Sheet de
l'espace, découpée en morceaux de 45 000 caractères au plus :
`id` (`<piece>-<k>`), `piece`, `nom`, `type` (ex. image/jpeg), `taille` (octets), `partie` (0, 1…), `total`,
`donnees`, `cree_le`. L'échange cite ses pièces dans sa colonne `pieces_jointes` (ids séparés par « ; »).
Limites : 5 pièces par échange, 1 Mo par fichier ; images réduites à 1000 px (JPEG). Pas d'historique : quand
l'échange disparaît, l'application efface les pièces qu'aucun échange ne cite plus (après 10 minutes).
Claude (connecteur Google Sheets) suit le même cas d'usage standard qu'une personne : ses échanges et leurs pièces
jointes vont dans le Sheet de **l'espace concerné** (celui de l'élément, ex. President pour une mission), jamais dans
Moi par défaut. Colonne `controle` de chaque morceau : « longueurxsomme » (somme des codes des caractères × leur
rang, « x » pour que Google ne le prenne pas pour une durée) ; l'application écarte une pièce dont un morceau ne
correspond pas (« pièce illisible »), au lieu d'afficher une image cassée.

Procédé de Claude (une image recopiée caractère par caractère peut être fausse) :
1. `python3 scripts/piece-claude.py capture.png <piece-id> [largeur] [qualité] [1000]` : image réduite, morceaux de
   1000 caractères avec leur `controle` ;
2. écrire les lignes dans `PiecesJointes` (un appel) ;
3. poser dans une colonne libre la formule de contrôle (Sheet en français : « ; »)
   `=IF(LEN(Hn)&"x"&SUMPRODUCT(CODE(MID(Hn;SEQUENCE(LEN(Hn));1))*SEQUENCE(LEN(Hn)))=Jn;"ok";"faux")`, relire ;
4. réécrire chaque morceau « faux » (seulement lui), revérifier ; effacer la colonne de formules ;
   Un morceau qui reste faux (passage répétitif, ex. « AAAA… » ou motifs qui se répètent) : l'écrire en 10 lignes
   de 100 caractères dans une colonne libre, vérifier `=LEN()` de chaque ligne, recoller avec `=JOIN("";…)` puis
   copier la **valeur** dans `donnees` (copyPaste PASTE_VALUES) ;
5. écrire l'échange avec `pieces_jointes`.
