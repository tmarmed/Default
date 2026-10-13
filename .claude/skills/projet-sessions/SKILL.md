---
name: projet-sessions
description: Bonne pratique de gestion de projet avec Claude (famille « projet », tous projets) : une session par fonctionnalité, relais par fichier, livraison par lots vérifiés, clôture propre et message de démarrage de la session suivante. À utiliser au début et à la fin de chaque session.
---

# Sessions

## Début
- Lire le CLAUDE.md du projet puis son fichier de relais (liste à faire, section « Prochaine session »).
- Rappeler en trois lignes où on en est et proposer par quoi commencer.

## Pendant
- **Une session par fonctionnalité** : une session trop longue coûte cher et perd le fil.
- Livrer par lots : coder → vérifier (tests, captures) → commit + push → résumer.
- Un point « non vérifié » (écran pas ouvert, cas pas joué) n'est jamais laissé tel quel : proposer aussitôt de le
  vérifier, avant de passer au sujet suivant.

## Clôture (quand l'utilisateur veut fermer)
1. Le dernier lot est vérifié, commité et poussé.
2. Fichier de relais à jour : codé (daté), décisions datées, questions ouvertes, suite proposée dans l'ordre.
3. Documents du projet à jour ; glossaire à jour.
4. Skills : noter ce qu'on a appris (nouveau mot mal dicté, progrès dans `travail-coach`) dans le dépôt
   `tmarmed/mes-skills` et dans la copie du projet.
5. Donner le message de démarrage de la session suivante (branche, fichiers à lire, par quoi commencer).
6. La nouvelle session doit partir de la branche qui contient `.claude/skills/`, sinon les skills ne sont pas chargés.
