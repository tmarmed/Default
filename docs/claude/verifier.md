# Vérifier

Dans `mobile/` :
- `npx tsc --noEmit`
- `npm run -s verif:reunions|sheets|alertes|organisation|stockage` (sheets compte les appels à Google)
- `npx expo lint` : pas de configuration ESLint, l'installation est bloquée par le réseau.

## Démo et captures
- Build : `EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir <scratchpad>/web-rNN`
- Servir **dans la même commande** que la capture (sinon le serveur meurt) :
  `cd web-rNN && (python3 -m http.server 88NN >/dev/null 2>&1 &) ; sleep 1; node cap.mjs`
- Playwright : `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`,
  `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`, viewport 390×844.
- Entrée démo : Fermer · Autoriser (×2) · SAFe · 🏢 ACME · Fermer ; puis onglets Tâches / Sprint / Réunions / PI.
- Profil démo « Vous (tous les rôles) » = `vous@demo` ; données dans `src/demo.ts` (ACME, équipe Mobile).
- Navigation (13/10) : onglets du bas par leur icône, `getByRole('tab').filter({ hasText: '📅' })` (Réunions), '📊'
  (Pilotage), '🏛️' (Organisation : « 🏢 Entreprise » pour les personnes, « 🚆 Delivery SAFe » pour trains et équipes) ;
  une réunion : `getByRole('button').filter({ hasText: 'Daily' }).filter({ hasText: 'Mobile' })` ; étapes : « Suivant »
  (le tour de table passe chaque personne) ; rituels perso (Point perso, Bilan du soir, Revue des objectifs) : mode
  « Simple ». Bouton ＋ d'une section : `getByRole('button', { name: '<ajouterLabel>' })`.
- Augmenter `DEMO_DATA_VERSION` de 1 à chaque changement des données de démo (sinon le navigateur garde les anciennes).
