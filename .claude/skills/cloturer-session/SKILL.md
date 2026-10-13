---
name: cloturer-session
description: À utiliser quand l'utilisateur veut fermer la session ou en ouvrir une nouvelle (projet President) : mettre à jour la liste à faire et les documents, commit et push, puis donner le message de démarrage de la session suivante.
---

# Clôturer une session

1. **Rien en cours** : le dernier lot est vérifié (tsc, verif), commité et poussé sur `claude/version-safe`.
2. **`docs/claude/a-faire.md`** :
   - ce qui a été codé (avec la date) ;
   - les décisions prises, datées ;
   - les questions encore ouvertes ;
   - la suite proposée, par ordre de priorité.
3. **Documents** : `docs/regles-reunions.html`, `docs/mission.html`, `docs/bilan-reunions.html` reflètent ce qui a été
   codé ; les fiches `docs/claude/*.md` et `glossaire.md` sont à jour.
4. **Skills** : noter dans le skill concerné ce qu'on a appris sur la façon de travailler (nouveau mot mal dicté,
   nouvelle règle de réponse, progrès de l'entraînement dans `coach-produit`).
5. **Message de démarrage** de la prochaine session, à copier, par exemple :
   « Branche claude/version-safe. Lis CLAUDE.md puis docs/claude/a-faire.md (section Prochaine session) et
   commence par : … ». Rappeler que la session doit partir de la branche `claude/version-safe` pour avoir les skills.
6. Commit + push, puis dire en une ligne que tout est prêt pour fermer.
