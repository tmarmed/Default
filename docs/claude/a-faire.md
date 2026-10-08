# À faire (relais entre sessions · une session par fonctionnalité)

Lire en premier. Mettre à jour avant de fermer une session : rayer ce qui est fait, ajouter ce qui reste.

## Fait (session du 08/10, validation de la démo)
Validation écran par écran, puis les deux blocs codés (captures vérifiées dans la démo, verif:* au vert) :
- Bloc 1 : noms entiers partout ; suivis au même format (Situation, fiche) avec Validation et Échéance ; titre du
  suivi en entier ; vocabulaire Note ; Décision à prendre / prise (`sous_type`) ; « Demande d'action » ; Notes à
  concrétiser reportées + filtre Tout · Suivis · Notes à concrétiser (toutes réunions) ; « Responsable › » groupé
  (moi, équipe, autres équipes du train, train) ; compte rendu en 4 sections ; « Sprint » partout ; phrase de
  suppression ; démo : story et note préparée de Vous, note à concrétiser d'hier.
- Bloc 2 : « ↪ Transmettre » unique (maillons reformulés, boucle / je me retire, plusieurs destinataires, « 📌 Suivre
  à » précoché) ; Accepter / À reprendre / Accepter et renvoyer / Re-transmettre ; « 📌 Suivre en réunion » ;
  « ✓ Je m'en occupe » ; nature des messages ; lien privé sur la note ; plus de note d'office ni de réponse
  recopiée ; rappel « À valider en réunion » au lieu de « Valider ? ». Diagramme : docs/cycles-de-vie.html.

## Prochaine session : faire valider les deux blocs, puis le reste
- Montrer à l'utilisateur (captures) : Situation et filtre, note Décision, Responsable groupé, compte rendu, Chat
  (Transmettre, Accepter et renvoyer, Suivre en réunion), Ma préparation.
- Reste à coder : « Terminé ✓ » / « Pas fait » à l'expéditeur quand la tâche « Je m'en occupe » est finie ou
  supprimée ; « fait quand tous ont répondu » (plusieurs destinataires : compteur « 2 réponses sur 3 », Relancer,
  Clôturer chez tous) ; « Clos par l'expéditeur » sur la note liée ; supprimer un rappel « À valider » perd le lien
  du refus (À reprendre au-dessus) ; Responsable d'une autre équipe en réunion : envoyer un message à son Chat ;
  Information (type de note) en réunion ; dailies des espaces Équipe non affichés : pas proposés dans « Suivre à ».
- Demandé le 08/10 : pièces jointes à cocher quand on transmet (« Pièces jointes transmises » : chaque pièce du
  message reçu cochable, décochée par défaut ; seules les cochées partent avec le maillon ; jamais vers une note de
  réunion).

## Session d'après
- **Pilotage (lot 5)** : reprendre le brainstorm (pilotage et calendrier ; voir docs/mission.html lot 5).

## Décidé, pas encore codé (attendre « on code »)
- « Suivi dans › » (feuille Concrétiser) : suivre une note dans une autre réunion ; pastille de réunion dans la
  Situation alors. (Abandonné le 08/10 : « Mes suivis » hors réunion, « Valider ? » d'une tâche terminée.)

## Questions ouvertes à l'utilisateur
- Types de notes en plus de Blocage, Décision, Demande d'action : Risque, Dépendance (PI Planning, ART sync), Idée (rétro) ?
- Lot 5 pilotage (brainstorm sans réponse) ; participants modifiables (équipe, train, portfolio) ; onglet Compte
  rendu pour un non-participant ; écrire les décisions des epics.

## Fait récemment (08/10)
- Suivis complets (statuts, validation, Chat « Valider ? », escalade qui redescend), vocabulaire Notes / Suivis partout (plus de « point »), fiche de l'élément en deux blocs, escalader force « Suivre », fichiers .md.
