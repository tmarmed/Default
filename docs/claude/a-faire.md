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
- [ ] Compte rendu (étape 4 et onglet) : 4 sections toujours affichées, même à 0 : Créé, Suivis, Transmis (escalade
      fusionnée dans Transmis : notion déjà fusionnée par l'utilisateur), Clos ; noms entiers (« Tom Faure → Paul Leroy »).
- [ ] Fiche d'un élément : suivis au format de la Situation (Responsable, Validation, Échéance) ; corriger « Sa sous-tâche
      seront conservé(e)s » ; « Sprint » partout au lieu de « IT1 » / « itération » (toute l'application).
- [ ] Fusion Escalader → « Transmettre » (demande de l'utilisateur, 08/10) : un seul mot et un seul ensemble de règles,
      réunions ET Chat ; garde la logique multi-niveaux de l'escalade (suivi chez celui qui transmet, réponse qui
      redescend) ; vertical et horizontal (autres équipes), plusieurs chaînes en parallèle. Incohérences relevées dans le
      code, à faire trancher : transmettre (Chat) ne crée ni suivi ni retour de réponse ; destinataires limités à « vos
      équipes » ; seules les questions se transmettent ; un seul destinataire ; valeur `escalade` dans le Sheet (garder en
      interne, changer les libellés).
  Proposition faite (à valider) : un seul verbe « ↪ Transmettre » ; chaque transmission = un maillon de chaîne (suivi
  chez celui qui transmet, réponse qui redescend) ; haut / côté / parallèle. Cas 1 : mon message hors équipe (« À › »
  groupé, suivi + « Valider ? » au retour si question). Cas 2 : message reçu → « ↪ Transmettre › » + motif rapide (Pas
  mon périmètre, Pas le droit de répondre, Absent, Autre), l'expéditeur voit « Transmis par … à … ». Règles : toute
  l'organisation, un maillon par destinataire, pas de boucle, valeur `escalade` gardée en interne. Tranché (08/10) :
  tout message se transmet (question ou information) ; dans le Chat, transmettre ne crée JAMAIS de suivi (relais, la
  réponse va à l'expéditeur) : le suivi vient de la réunion (concrétisation, ou « 📌 Au prochain … » du Chat) ;
  plusieurs destinataires en parallèle, fait quand tous ont répondu.
- [ ] Types (option A validée, 08/10) : un seul vocabulaire pour les messages du Chat et les notes de réunion :
      Information (lire), Question (répondre), Blocage (en cours / résolu), Décision (à prendre / prise), Action (à faire /
      faite ; dans le Chat = demande d'action, réponse « Fait »). Défaut à l'envoi : Question. « Valider ? » reste une
      question à choix de l'application. Libellé : « Demande d'action » (choisi).
- Principe (08/10) : Chat = privé, jamais suivi ; Note = devant tout le monde, suivie en réunion. Concrétiser existe des
  deux côtés. Plus de bandes de questions (AskUserQuestion) : poser les questions dans le texte.
- [ ] Écran 7 (Chat « Valider ? ») : avis en attente (« Faire suivre » → « ↪ Transmettre › »).
- [ ] Écran 8 (Ma préparation) : remplir la démo (une story en cours et une note préparée pour « Vous »), puis remontrer.
- Décisions Chat ↔ réunion (08/10, suite) :
  - les suivis se rattachent toujours à une réunion (pas de « Mes suivis » hors réunion) ;
  - « Valider ? » d'une tâche créée depuis le Chat → information « Terminé ✓ » à l'expéditeur ;
  - c'est celui qui reçoit qui décide de lier ou non à une réunion ; s'il répond, rien n'est proposé ; s'il transmet,
    « 📌 Suivre à <sa réunion par défaut> » est proposé (modifiable, décochable). Une chaîne mélange des maillons liés et
    non liés à une réunion ;
  - confidentialité : le message reste privé ; la note de réunion est reformulée (texte à écrire) et liée à l'échange
    (noms visibles, contenu non) ;
  - plusieurs destinataires : dès une réponse, l'expéditeur peut relancer ou clôturer ; clôturé = disparaît chez tous ;
  - méthode : étudier le diagramme d'états (1. possibilités à la réception, 2. boucle répondre / transmettre,
    3. finalisation).
  - proposé (à valider) : la réponse redescend par un geste explicite. Le maillon non lié reçoit « ↩ Réponse de … à
    faire redescendre » (↩ Renvoyer à … · ✎ Compléter · ↪ Re-transmettre · ↩ À reprendre) ; à la transmission,
    « Je reste dans la boucle » (défaut) ou « Je me retire » (la réponse saute ce maillon) ; « À reprendre » va au
    voisin du dessus, celui qui m'a renvoyé la réponse (règle du voisin).
  - Principe confirmé : deux cycles de vie, Message (Chat, privé, éphémère : disparaît une fois fini) et Note (réunion,
    publique, durable : trace jamais supprimée, c'est là qu'on concrétise et qu'on suit). Indépendants ou liés ; liés
    par un seul lien note ↔ maillon (noms visibles, contenu non) ; points de contact : lier (message → note
    reformulée), réponse reçue (maillon → note « Fait · réponse reçue »), validation (note validée → le maillon fait
    redescendre), clôture par l'expéditeur (→ note « Clos par l'expéditeur », la note reste).
  - Confirmé : aucune note créée automatiquement ; tout passe par un bouton ; en transmettant, « 📌 Suivre à … » est
    précoché (décochable) et demande un texte reformulé. Reformuler est obligatoire à chaque passage Chat → réunion
    (note, dernier mot, décision). Proposé : entre deux maillons du Chat, le texte suit tel quel (✎ Compléter possible),
    sauf si l'expéditeur a coché « 🔒 Confidentiel » (alors reformuler pour transmettre). Code actuel à changer :
    pointsEscalade / pointsReponse (src/suiviEscalade.ts) recopient le texte et créent les notes d'office.
  - Décidé : même parcours pour transmettre et concrétiser : case « 📌 Suivre à <réunion> » précochée, modifiable,
    décochable (plus de « Où le suivre ? »). Reformuler obligatoire dans les 3 passages du Chat : lier à la réunion,
    transmettre (monter ou sur le côté), faire redescendre. Cas ajoutés par Claude : pièces jointes (ne suivent jamais
    d'office), réunion → Chat et réunion → réunion (texte déjà public, pas de reformulation), « Valider ? » dans le Chat
    (dernier mot reformulé). « 🔒 Confidentiel » devient inutile.
  - Décidé : « Valider » dans le Chat = validation personnelle 1 à 1 d'une réponse entre deux maillons ; n'agit jamais
    sur une note de réunion. La validation d'une note se fait en réunion (« À valider · n »). Proposé : le « Valider ? »
    envoyé aujourd'hui par l'application devient un simple rappel « À valider au daily Mobile › » (ouvre la réunion).
    Change ce qui a été livré le 08/10 (repondreEchange → planSuivi dans App.tsx).
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
