---
name: conception-specifier
description: Méthode pour spécifier une fonctionnalité (famille « conception », générale, tous projets) : définir les mots, écrire les règles de gestion, décrire le cycle de vie, lister les cas d'usage et les critères d'acceptation. À utiliser dès qu'on conçoit ou change une règle de gestion.
---

# Spécifier une fonctionnalité

La spécification s'écrit **dans le document de règles du projet** (indiqué dans son CLAUDE.md), une section par
fonctionnalité. Une page de lecture par fonctionnalité pourra être un livrable plus tard (décision du 13/10/2026).

## Plan, dans cet ordre
1. **But** : pour qui, quel problème, en une ou deux phrases.
2. **Mots** : chaque terme qui porte une règle, défini en une phrase (glossaire du projet). Deux mots = deux règles
   différentes ; un même mot ne change pas de sens d'un écran à l'autre.
3. **Règles de gestion** : numérotées, une idée par règle, avec les valeurs par défaut et qui peut modifier quoi.
4. **Cycle de vie** : les états de l'objet du début à la fin, qui fait passer d'un état à l'autre, où, et ce que
   devient la trace (suppression, archive). Un diagramme d'états si plus de trois états.
5. **Cas d'usage** : d'abord les simples (un acteur, une action), puis les composés (plusieurs acteurs ou niveaux,
   aller-retour, absence, refus). Pour chacun : point de départ → étapes → résultat.
6. **Critères d'acceptation** : « Quand …, alors … », un par règle et par cas limite ; ils deviennent les tests.
7. **Hors périmètre** : ce qu'on ne fait pas maintenant (va dans la liste à faire, skill `projet-prioriser`).

## Bonnes pratiques
- Recommander une solution, puis poser les questions ; valider avant d'écrire la version définitive.
- Préférer étendre une règle existante plutôt qu'en créer une deuxième (skill `conception-coherence`).
- Chaque critère d'acceptation a son test automatique quand la fonctionnalité est codée.
