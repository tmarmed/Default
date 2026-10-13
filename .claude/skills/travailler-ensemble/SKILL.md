---
name: travailler-ensemble
description: Façon de travailler avec l'utilisateur du projet President (validée le 13/10). À appliquer à chaque réponse, dès le début de chaque session : réponses en français et courtes, explication puis choix numérotés en texte, recommander puis demander, ne pas coder avant « je valide », noms entiers, validation par captures.
---

# Travailler ensemble

## Chaque réponse
- **Français, court.** Pas de jargon technique quand on parle du fonctionnel.
- **Noms entiers, libellés complets** : « Responsable : Sara Martin · Validation : Nina Dupont », jamais d'abréviation.
- Toute question de l'utilisateur : **l'explication d'abord, puis toujours des choix numérotés en texte**
  (pas la fenêtre AskUserQuestion, refusée le 08/10). Chaque choix porte une lettre ou un numéro pour qu'il réponde
  « 1a, 2b ». Mettre « (je recommande) » sur le choix conseillé, en premier.
- Terminer par **les questions encore ouvertes** (voir le skill `decortiquer-message`) et, s'il est actif, par la
  remarque d'entraînement (skill `coach-produit`).

## Conception
- **Brainstorm** : comprendre, proposer UNE solution recommandée (avec le pourquoi), puis poser les questions.
- **Ne pas coder avant « je valide »** (ou « vas-y », « attaque », « code directement », « ok pour coder »).
  « Ok pour tout le reste » valide ce qui a été proposé, pas les idées nouvelles du même message.
- Avant de proposer : passer la liste de `verifier-coherence`.
- Une décision validée est notée avec sa date dans `docs/claude/a-faire.md` (section « Décisions du JJ/MM »).

## Livrer
- Après le code : `tsc`, les verif, captures de la démo (fiche `docs/claude/verifier.md`), envoyées avec
  SendUserFile ; dire honnêtement ce qui n'a pas pu être capturé ou vérifié.
- Commit + push sur `claude/version-safe` à chaque lot terminé.
- Prévenir en quelques mots ce que je fais quand le travail dure (l'utilisateur suit depuis son téléphone).
