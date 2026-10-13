---
name: verifier-coherence
description: Liste de contrôle à passer avant de proposer ou coder une conception dans le projet President (réunions, notes, suivis, Chat, budget, modes Simple et SAFe). À utiliser aussi quand l'utilisateur demande « est-ce qu'il y a une incohérence ? » ou « est-ce qu'on a loupé quelque chose ? ».
---

# Vérifier la cohérence

## Avant de proposer
1. **Les mots** : chaque terme est défini dans `docs/claude/glossaire.md` ? Sinon, le définir d'abord et le faire
   valider (ex. affecter ≠ transmettre, 13/10).
2. **Une seule règle** : la nouveauté réutilise-t-elle une règle existante (maillons, notes → concrétisation → point
   de suivi, hors réunion puis Confirmer) au lieu d'en créer une deuxième ?
3. **Simple et SAFe** : mêmes données et mêmes composants ; en Simple, aucun mot du SAFe à l'écran (epic → projet,
   OKR → objectif, feature → étape du projet, story → tâche ; passer par `vocab()`) ; règles fixes, non modifiables
   en Simple.
4. **Cycle de vie** : les états de l'objet du début à la fin (créé, en cours, fait, validé, abandonné, plus suivi,
   supprimé) ; qui fait passer d'un état à l'autre, où (réunion, Chat, fiche) ; que devient la trace.
5. **Cas d'usage** : simples (un acteur, une action) puis composés (plusieurs maillons, réunion liée ou non, Chat).
6. **Effets de bord** : Chat (confidentialité, reformuler ce qui devient public), réunions (compte rendu, suivi),
   budget (enveloppe, demandes), droits et rôles, quota Google Sheets (écritures groupées).
7. **Interdits** : jamais supprimer une ligne d'un Sheet (`pris_en_compte`) ; pas de secret OAuth ; pas de lien public.

## Après le code
- Tests ajoutés dans `mobile/scripts/verif-*.ts` pour chaque règle de gestion nouvelle.
- Documents à jour : `docs/regles-reunions.html`, `docs/mission.html`, `docs/bilan-reunions.html`, et
  `docs/claude/a-faire.md`.
- Dire ce que la vérification a trouvé, même si c'est « rien ».
