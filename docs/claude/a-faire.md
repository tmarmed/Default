# À faire (relais entre sessions · une session par fonctionnalité)

Lire en premier. Mettre à jour avant de fermer une session : rayer ce qui est fait, ajouter ce qui reste.

## Prochaine session : validation (avant le pilotage)
Faire valider par l'utilisateur, écran par écran (captures de la démo + questions/réponses), ce qui a été livré le
08/10 ; noter les remarques ici et les corriger dans cette même session :
1. Feuille Concrétiser : Que faire, Type › et Rattaché à (le parent change avec le type), Qui s'en charge,
   escalader force « Suivre », Validation, Échéance (plus d'« Élément concerné » dans la feuille).
2. Note : « Élément concerné › » à la saisie ; « Notes · n », « Mes notes », « Note oubliée ».
3. Suivis : « 📌 Suivis · n » dans la Situation, « À valider · n », « en retard », feuille du suivi (Fait, Valider,
   Re-concrétiser, À reprendre, Abandonner), re-concrétiser.
4. Chat : « Valider ? » (même suivi qu'en réunion), motif obligatoire ; escalade qui redescend, refus qui rouvre.
5. Compte rendu : Créé, Suivis, Escaladé, Transmis, Clos.
6. Fiche d'un élément : « 📌 Suivis · n » et « 📝 Notes de réunion · n » avec la pastille de la réunion ;
   « Avancement » (fiche tâche) ; onglet « Ma préparation ».
Démo : `?demo`, ACME, daily de l'équipe Mobile (suivis à valider prêts dans la démo).

### Remarques de validation (session du 08/10, en cours)
Validé : feuille Concrétiser (sauf ci-dessous). À corriger :
- [ ] Situation : toutes les lignes de suivi au même format « 📌 Suivi · Responsable : Emma Roy · … » (noms entiers,
      fini « tâche à part · 👤 Emma »).
- [ ] Feuille du suivi : titre en entier (passe à la ligne, pas coupé).
- [ ] Saisie d'une note : vocabulaire Note (« Nouvelle note · Tom Faure », « NOTE », « Écrivez la note… »,
      « Aucun · note générale »).
- [ ] Décision : un seul type, sous-type « à prendre » / « prise » (puces à la saisie, défaut : à prendre). À prendre se
      concrétise comme un blocage (Suivre, Responsable = qui décide, escalade) ; à la réponse elle devient « prise » avec
      la réponse. Blocage : « en cours » / « résolu ». VALIDÉ.
- [ ] Situation, toutes réunions : filtre suivis concrétisés / notes pas encore concrétisées (reportées des réunions
      précédentes). Pas de « Plus tard » : ne pas concrétiser = plus tard. VALIDÉ : « 📌 Suivis · 7 · Notes à
      concrétiser · 2 », « noté le 6/10 », filtre Tout · Suivis · Notes à concrétiser · À valider ; ces notes
      reviennent aussi à l'étape Concrétisation.
- [ ] Feuille Concrétiser : plus de puces Moi / Mon équipe / Niveau du dessus ; un seul « Responsable › » groupé : Moi ·
      Équipe Mobile · autres équipes du train (= transmettre, sans escalader) · Train Clients (RTE, PM = escalade, force
      « Suivre », libellé « Escaladé au train Clients »). Validation inchangée (animateur par défaut, modifiable). VALIDÉ.
Reste à montrer : Chat « Valider ? », Compte rendu, fiche d'un élément, onglet « Ma préparation ».

## Session d'après
- **Pilotage (lot 5)** : reprendre le brainstorm (pilotage et calendrier ; voir docs/mission.html lot 5).

## Décidé, pas encore codé (attendre « on code »)
- Chat → réunions : sur un message ou une carte, trois boutons « ✓ Je m'en occupe » (concrétiser seul sous mes
  tâches), « 📌 Au prochain … » (comme une note de « Ma préparation » ; réunion par défaut selon le rôle,
  modifiable), « ⊘ Rien à faire » ; message déjà suivi en réunion : « Voir dans la réunion › » et la réponse
  attendue ; un message disparaît quand il n'attend plus rien ou que sa trace existe ailleurs.
- « Suivi dans › » (feuille Concrétiser et feuille du point) et, dans « Qui s'en charge ? », envoyer à une autre
  réunion ou à une autre équipe du même niveau (évite d'escalader) ; pastille de réunion dans la Situation alors.
- « 📌 Mes suivis » hors réunion ; tâches liées à une réunion ; « Valider ? » quand une tâche créée est terminée.

## Questions ouvertes à l'utilisateur
- Types de notes en plus de Blocage, Décision, Action : Risque, Dépendance (PI Planning, ART sync), Idée (rétro) ?
- Lot 5 pilotage (brainstorm sans réponse) ; participants modifiables (équipe, train, portfolio) ; onglet Compte
  rendu pour un non-participant ; écrire les décisions des epics.

## Fait récemment (08/10)
- Suivis complets (statuts, validation, Chat « Valider ? », escalade qui redescend), vocabulaire Notes / Suivis partout (plus de « point »), fiche de l'élément en deux blocs, escalader force « Suivre », fichiers .md.
