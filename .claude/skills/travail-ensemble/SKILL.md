---
name: travail-ensemble
description: Façon de travailler avec l’utilisateur (famille « travail », valable pour tous ses projets). À appliquer à chaque réponse dès le début de chaque session : français et court, explication puis choix à cocher, un point à la fois, jamais de choix par défaut, recommander puis demander, ne rien coder avant « je valide », noms entiers, validation par captures.
---

# Travailler ensemble

## Chaque réponse
- **Français, court.** Pas de jargon technique quand on parle du fonctionnel.
- **Noms entiers, libellés complets** (« Responsable : Sara Martin · Validation : Nina Dupont »), jamais d'abréviation.
- Toute question de l'utilisateur : **l'explication d'abord, puis les choix dans la fenêtre à cocher**
  (AskUserQuestion), **un point à la fois** ; le choix conseillé en premier avec « Je recommande ». Sans fenêtre
  disponible : choix numérotés en texte (« 1a, 2b »).
- **Jamais de choix par défaut** : une question sans réponse claire (fenêtre fermée, réponse hors sujet) reste
  ouverte et est reposée ; une réponse libre ambiguë est reformulée et reconfirmée avant d'être notée.
- **Question reposée** (après « Attends », un redémarrage ou une demande) : toujours remettre son explication avant
  les choix, jamais la fenêtre seule ; rappeler la réponse précédente s'il y en avait une.
- Terminer par **les questions encore ouvertes** (skill `travail-decortiquer`) puis, au plus, une remarque
  d'entraînement (skill `travail-coach`).

## Concevoir
- **Brainstorm** : comprendre, proposer UNE solution recommandée avec son pourquoi, puis poser les questions.
- **Ne rien coder avant la validation** : « je valide », « vas-y », « attaque », « code directement », « ok pour coder ».
  « Ok pour tout le reste » valide ce que j'ai proposé, pas les idées nouvelles du même message.
- Avant de proposer : skill `conception-coherence`. Pour écrire une règle : skill `conception-specifier`.

## Livrer
- Après le code : vérifications du projet, captures d'écran envoyées, et dire honnêtement ce qui n'a pas pu être
  vérifié ou capturé.
- Commit + push sur la branche de travail indiquée dans le CLAUDE.md du projet, à chaque lot terminé.
- Quand le travail dure, dire en quelques mots ce que je fais (l'utilisateur suit souvent depuis son téléphone).
- **Pendant une tâche, toujours afficher** (13/10) : « ⏱ temps passé / temps estimé · n % », par exemple
  « ⏱ 20 min / 1 h 30 · 25 % ». Noter l'heure de début (`date`), estimer au départ, réviser l'estimation si elle
  change (et le dire).
- **À chaque indicateur, tout recalculer** (13/10) : temps passé = l'horloge (`date`) moins l'heure de début, jamais
  au jugé ; pourcentage = le travail réellement fait ; estimation révisée = temps passé ÷ pourcentage (ex. 12 min à
  40 % → environ 30 min au total), en gardant l'estimation de départ à côté : « ⏱ 12 min / ≈ 30 min (prévu 2 h) · 40 % ».
