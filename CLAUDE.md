# President · directeur du projet (lu à chaque session : rester court)

Application Expo « President » (tâches, réunions agiles et SAFe, Google Sheets). Code : `mobile/` (son propre
CLAUDE.md s'y charge). Branche de travail : `claude/version-safe` ; toujours commit + push dessus.

## Façon de travailler avec l'utilisateur
- Répondre **en français, court**. Valider par captures d'écran et questions/réponses (AskUserQuestion).
- Libellés complets, noms entiers (« Responsable : Sara Martin · Validation : Nina Dupont »), jamais d'abréviations.
- Brainstorm : recommander une solution, puis poser les questions ; ne pas coder avant « je valide ».
- **Chaque question de l'utilisateur** : l'explication, puis toujours les choix (AskUserQuestion), pour qu'il relise
  l'explication s'il l'a manquée.
- Garder à jour : `docs/regles-reunions.html`, `docs/mission.html`, `docs/bilan-reunions.html`.

## Fiches à lire seulement quand le sujet arrive (ne pas les charger d'avance)
| Sujet | Fiche |
|---|---|
| Livrer / publier, lien en ligne, dépôt privé | `docs/claude/livraison.md` |
| Vérifier, démo, captures Playwright | `docs/claude/verifier.md` |
| Réunions, points, concrétisation, suivi, escalade, Chat | `docs/claude/reunions.md` |
| Google Sheets (quota, écritures groupées, Claude dans un Sheet) | `mobile/AGENTS.md` (section Sheets) |
| Pièces jointes du Chat | `docs/claude/pieces-jointes.md` |
| Sécurité, confidentialité | `docs/claude/securite.md` |
| Carte du code (où est quoi) | `docs/claude/code.md` |

## Interdits (toujours)
- Jamais de secret OAuth dans le dépôt (seul l'identifiant client public est utilisé).
- Jamais supprimer une ligne d'un Sheet : écrire `pris_en_compte`, l'application supprime.
- Pas de lien public ni d'autorisation Google/Drive plus large que celle accordée.
