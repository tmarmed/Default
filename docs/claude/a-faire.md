# À faire (relais entre sessions · une session par fonctionnalité)

Lire en premier. Mettre à jour avant de fermer une session : rayer ce qui est fait, ajouter ce qui reste.

## Session 4 (14/10) : avancement visible dans toutes les réunions de la démo — FAIT
Démo (src/demo.ts, photosSeries) : pour chaque série (équipes Mobile et Web, trains Clients et Paiements, portfolio
Digital, Comité budgétaire, réunions perso), une photo de la réunion précédente avec un changement de chaque sorte au
niveau de la réunion, un par niveau au-dessus, et un suivi « En cours → Fait ». Vérifié à l'écran (texte) : Daily
Mobile et Web, Revue de sprint, Rétrospective, Planification, Affinage, System demo, ART sync, Affinage du train,
Semaine IP, Préparation du PI, Synchronisation et Revue du portfolio, Point perso, Bilan du soir, Revue de la semaine,
Revue des objectifs, Point annuel. Lien republié.
Questions ouvertes (à reprendre avec l'utilisateur, une à la fois) :
1. Filtre de l'avancement : par famille (Sorte, Niveau, Type de note) garder tout, enlever, ou en garder certaines.
2. Avancement au tour de table du Daily : déplacer (recommandé : chaque membre voit l'avancement de ses éléments ; la
   Situation garde features, epics, suivis et un compteur) ou dupliquer. Bilan de la 1re étape de chaque réunion
   fait en séance (seul le Daily a un tour de table).
3. Seuil réglable des changements de valeur.

## Prochaine session (préparée le 13/10, fin de session 3)
Skills chargés (`.claude/skills/`, copie dans `tmarmed/mes-skills`, branche main) : les appliquer dès la première
réponse ; fenêtre à cocher, un point à la fois, jamais de choix par défaut ; **pendant une tâche : « ⏱ temps passé /
estimé · n % » d'après l'horloge (`date`), jamais au jugé**.
Fait en session 3 (13/10) : Avancement depuis la réunion précédente (bloc 13), enveloppes des trains (bloc 14), rôles
transverses (bloc 15), estimations de la démo, deuxième train dans la démo, vérification du cloisonnement des données.
Sujets proposés, au choix de l'utilisateur (dans cet ordre conseillé) :
1. Chapters (conception commencée, voir « Reste à faire » : qui crée, qui est membre).
2. Partage automatique du Sheet « 💶 Budget » avec les seules personnes qui ont « Gérer le budget » (point 10), lié
   aux rôles transverses (Contrôleur de gestion, Suppléant).
3. Avancement : seuil réglable des valeurs et filtre pré-rempli gardé (Reste à faire).
4. Le reste de la liste « Reste à faire » (Revue de sprint : parties prenantes hors équipe — en partie couvert par la
   Partie prenante ; affectations d'une personne ; fermetures de l'entreprise…).

## Session 3 (13/10) : Avancement depuis la réunion précédente — CODÉ (règles : docs/regles-reunions.html, bloc 13)
Fait : src/avancement.ts (photo, comparaison, libellés ; tests verif:reunions), reunion/Avancement.tsx (useAvancement,
BlocAvancement) ; branché dans useReunion (toutes les réunions du socle : Situation via BlocSuivi, compte rendu,
photo dans l'écriture de envoyerCompteRendu), Daily (Situation, compte rendu, envoi), rituels perso (1re étape,
photo à « Terminer » ; Point perso et Bilan du soir se suivent) ; démo : photo du Daily d'hier (Mobile).
Vérifié dans la démo (texte de l'écran) : Daily (6 lignes, filtre, compte rendu filtré ouvert d'office), ART sync,
Point perso et Bilan du soir (message de première réunion ; après « Terminer » du Point perso : « Rien n'a bougé »).
Limites corrigées (13/10) : toucher une feature, une epic ou un objectif ouvre sa fiche (onOpenEntite, d'App aux
réunions) ; en perso, la photo du Daily du jour de mes équipes, plus récente, complète ma réunion précédente
(photoPrecedenteAvec). Restent sans fiche depuis l'avancement : objectif du PI, enveloppe, demande, suivi (le suivi
est juste en dessous, dans « 📌 Suivis »).
Démo (13/10) : photos d'hier aussi pour l'ART sync (feature avancée d'un PI, budget d'epic, demande accordée en partie,
demande nouvelle) et la Revue du portfolio (epic Analyse → Prêt, enveloppe relevée, résultat clé d'OKR 78 → 82) ;
vérifié à l'écran. Résultats clés des OKR ajoutés (clé « r: »). Points de suivi affichés avec leur type de note
(« 📌 Risque · … ») + rangée « Type de note » dans le filtre (13/10) ; démo : risque suivi à l'ART sync.
Démo : objectif du PI du train (ART sync, 4 → 6 sur 10) et Revue des objectifs de 🔒 Moi du mois dernier
(« Doubler le nombre de clients · 5 → 8 ») ; vérifié à l'écran. Toutes les sortes d'avancement sont vues à l'écran.
Décidé (validé par l'utilisateur) :
- Bilan du soir = même affichage que « Hier » (éléments du plan + statut modifiable + notes) ; la section
  « Changé depuis ce matin » disparaît.
- Les changements repérés automatiquement ne sont PLUS des « notes Information » : ils s'appellent « Avancement »
  (section « Avancement depuis le Daily du 12/10 »).
- Affichage : bloc en tête de la 1re étape (Situation, Hier, Prévu / fait…) avec le filtre + section du compte rendu ;
  réunions perso (sans compte rendu) : 1re étape seulement.
- Toucher un avancement ouvre la fiche de l'élément (pas de note créée).
- 1re étape : bloc à part, dans l'ordre 1. éléments (compteurs ou plan), 2. « Avancement depuis le … » avec son filtre
  (s'ouvre / se ferme, 1re étape seulement : sorte + niveau), 3. « 📌 Suivis » (notes) inchangé.
- Toucher un avancement : comme l'existant (ligne → fiche de l'élément ›, pastille de statut touchable).
- Filtre : pastille qui ouvre / ferme ; rangée par sorte (Statut · Valeur · Échéance · Sprint ou PI · Responsable ·
  Ajouté en cours de route) + rangée par niveau ; tout coché au départ. Même filtre (partagé) en 1re étape ET dans le
  compte rendu ; le compte rendu envoyé = ce que le filtre affiche. Compte rendu : fermé, ouvert d'office si filtré.
- Première réunion (pas de photo) : « L'avancement sera visible à partir du prochain Daily » (« de la prochaine
  ART sync »… : nom de la réunion, accord du genre, sans date).
- Périmètre : celui que la réunion montre déjà (moi / équipe / train / portfolio) + features et epics rattachées
  au-dessus. Toutes les questions sont répondues : écrire les règles puis coder. (proposé : pastilles par sorte, tout coché, compte rendu = ce que le filtre affiche),
  puis : première réunion sans photo, périmètre (éléments de qui).
- Une entrée par élément (tâche, story, feature, epic…), départ → arrivée sur la période ; allers-retours compensés ;
  revenu à son départ = rien.
- Période : depuis la réunion précédente (même type ; perso : ma réunion précédente Point perso / Bilan / Daily).
- Calcul : photo à l'envoi de chaque réunion, comparée à la suivante (pas de nouvelles colonnes dans le Sheet).
- Chaque réunion repère les changements de son élément de focus et des niveaux au-dessus (tableau du focus par
  réunion donné en séance : perso = tâches / objectifs ; équipe = stories ; train = features ; portfolio = epics).
- Tout repérer : A statuts (éléments, features, epics, suivis, demandes de budget) ; B valeurs (budget d'epic,
  enveloppes, objectifs, objectifs du PI), sans seuil pour l'instant ; C échéance repoussée, déplacé de sprint / PI,
  changement de responsable, ajouté en cours de route.
- Tout est calculé ; l'affichage se règle par un filtre (par sorte de changement).
- Tout faire en un seul lot, en profondeur, en posant les questions au fur et à mesure (ping-pong).

## Prochaine session (préparée le 13/10, fin de session 2)
Skills chargés (`.claude/skills/`, copie dans le dépôt `tmarmed/mes-skills`, branche main) : les appliquer dès la
première réponse ; questions dans la fenêtre à cocher (AskUserQuestion), un point à la fois, jamais de choix par défaut.
Fait le 13/10 : plan du jour complet (voir « Décisions du 13/10 » ci-dessous et docs/regles-reunions.html bloc 12),
remplacer = affecter, Transmettre hors de l'équipe, coche « À concrétiser » des Informations, documents à jour.
Vérification moins coûteuse : lire le texte de l'écran (Playwright innerText) plutôt que des captures ; démo en ligne
publiée après chaque lot (docs/claude/livraison.md).
Sujets proposés, au choix de l'utilisateur :
1. ~~Enveloppes des trains au Budget participatif~~ CODÉ (13/10, session 3 ; règles : bloc 14) : partTrain, Engagé
   train / portfolio (budget.ts), RepartitionTrains (Budget.tsx), étape Répartition (Niveau.tsx), Pilotages ; démo :
   2 trains (Clients 150 000 €, Paiements 80 000 € ; feature « Paiement sécurisé » : l'Application client
   payée moitié-moitié), portfolio 2027 280 000 €, demandes et votes des deux trains au prochain Budget participatif.
2. ~~Droits transverses~~ CODÉ (13/10, session 3 ; règles bloc 15) : src/transverses.ts (catalogue, vers le bas, qui
   donne, Suppléant), branché dans participants, séries, animation, budget, droits du travail, Pilotage ;
   RolesTransverses.tsx (fiche du niveau, fiche de la personne) ; démo : Karim Haddad coach du train Clients, Claire
   Vidal direction du portfolio. Vérifié à l'écran (13/10) : fiche de la personne, ajout de bout en bout (Marc Petit
   Contrôleur de gestion du train Clients, gardé après rechargement). Chapters : reportés.
3. ~~Corriger les estimations de la démo~~ FAIT (13/10) : historique de stories terminées aux 3 sprints précédents
   (Mobile ≈ 18 points par sprint, Web 10), et depuis janvier une story par équipe et par sprint sur l'epic terminée
   « Site e-commerce v1 » (230 000 € prévus, 226 148 € consommés) ; Hors epics 10 412 € ; coût d'un point 559 €
   (avant : 3 978 €) ; Application client prévue à 100 000 €, 110 655 € à la fin (écart volontaire pour l'étape Écarts).
4. Bilan du soir : dater aussi les autres changements de statut (aujourd'hui seuls les passages à « terminé »).

## Décisions du 13/10 (session 2, plan du jour) — à écrire dans docs/regles-reunions.html puis coder (pas encore validé pour coder)
- Plan du jour : au tour de table et dans « Ma préparation », tous les éléments pas terminés de la personne (stories et
  tâches du sprint : à faire, en cours, bloqués ; en cours en haut). On coche « aujourd'hui » : ça remplit le plan du
  jour et la réunion, **jamais le statut**. La pastille de statut reste et peut être changée (seul changement d'élément).
- Réunions concernées : Daily, Point perso (mode Simple), Bilan du soir, « Hier » du Daily du lendemain (pas la Revue
  de la semaine).
- « Hier » (revu le 13/10) : plan de la veille avec le statut de chaque élément, modifiable (plus de fait / pas fait) + notes.
  Les notes d'« Hier » ne réapparaissent pas dans « Aujourd'hui » ; elles se concrétisent à l'étape Concrétisation.
- Créneaux (facultatif, dans la préparation) : Matin, Après-midi, et « avant / entre … et … / après » calculés depuis
  les réunions de l'application + événements perso ajoutés à la main ; agenda Google plus tard (nouvelle autorisation
  Google = accord explicite de l'utilisateur, cf. interdits). Créneaux visibles par la personne seulement.
- Notes Information : décision du 08/10 maintenue (se concrétisent) ; en plus, coche « À concrétiser » cochée d'office,
  seulement pour le type Information, partout où on ajoute une note. Décochée : va au compte rendu, se clôt sans
  concrétisation, absente de l'étape Concrétisation.
- Façon de travailler : ne jamais appliquer de choix par défaut ; une question sans réponse est reposée (à ajouter au
  skill travail-ensemble, dans les deux dépôts). Questions avec la fenêtre à cocher (AskUserQuestion), un point à la fois.
- Point 4 fait : « percée de compréhension » (conception-coherence point 8, glossaire) ; travail-ensemble : fenêtre à
  cocher, un point à la fois, jamais de choix par défaut. À recopier dans tmarmed/mes-skills.
- Point 5, décidé (pas encore codé) : **remplacer = affecter**. L'alerte d'absence propose « Choisir un remplaçant », qui
  ouvre la ligne Responsable (équipe, sans la personne absente ; les autres absents restent, marqués « absent le … »).
  « ↪ Transmettre » ne contient plus le groupe « remplaçant » (autres équipes + niveau du dessus seulement) et le bouton
  ouvre directement la liste : jamais de ligne « Transmettre à » vide. Affecter et transmettre restent exclusifs.
- Point 5 codé et validé en captures (13/10).
- Point 6 : plan du jour choisi ; règles écrites (docs/regles-reunions.html, bloc 12, R1 à R9). Prochaine étape :
  maquette validée (docs/maquette-plan-du-jour.html). Plus tard : plusieurs projets perso dans 🔒 Moi ; agenda Google.
- Plan du jour, lot 1 codé (13/10) : tour de table « ⏪ Hier · plan du … » (statut des éléments) et
  « ▶️ Aujourd'hui · n cochés sur m » (tous ses éléments pas terminés, cases selon son plan, statut modifiable à part) ;
  préparation : « Plan du … » avec statuts, « Mon plan du jour ».
  Helpers src/daily.ts (elementsDuPlan, planDe, reunionPrecedenteAvecPlan, faitDe) + tests verif:reunions.
  Lot 2 codé (13/10) : « Ma journée · vue par moi seul » (réunions du jour + événements perso) et « Mes créneaux »
  (deux niveaux : Matin / Après-midi, puis « Affiner » : créneau libre ≥ 30 min ; journée 9:00 → 18:00 et
  déjeuner 12:00 → 14:00 réglables, ligne plan_reglage-moi-2000-01-01 ; événement perso avec début et fin) ; rangés dans 🔒 Moi (points « donnee » de
  plan_jour-moi-AAAA-MM-JJ), écrits avec « Mon point ». Jamais affichés au tour de table.
  13/10 (refait) : étape « Plan du jour » (3ᵉ de la préparation, src/components/reunion/PlanDuJour.tsx) : deux vues
  (Matin / Après-midi · Emploi du temps), « À placer », moment libre touché → élément placé sur tout le moment, durée
  à ajuster aussitôt ; ↕ Déplacer (moment libre, échange, À placer) au toucher ; réunions + éléments déjà à l'heure
  fixes ; événements perso ; places rangées dans 🔒 Moi ({k:'place', d, h, f}). Restent : glisser (au lieu de
  toucher), tâche nouvelle → « À placer » d'office + ouverture directe sur le Plan du jour, plan commun multi-espaces.
  FAIT ensuite (13/10) : frise à glisser (Frise.tsx : glisser vers un moment libre, sur un autre = échange, en haut =
  À placer) ; tâche nouvelle (🆕) cochée d'office + ouverture directe (etapeInitiale de FenetreReunion) ; Point perso :
  même Plan du jour (usePlanJour partagé) ; coche « À concrétiser » des Informations (SaisiePoint, décochée →
  concretisation « rien »). Plan commun FAIT (usePlanJour.planAilleurs : éléments cochés à mes autres Dailies du
  jour, places gardées). Onglet « Plan · nom » protégé FAIT (Persistance.lirePlans / ecrirePlan, gsheets : créé +
  addProtectedRange pour la personne seule ; lu dans le même batchGet que PointsReunion ; anciens points Hier et
  Aujourd'hui restés dans PointsReunion relus normalement). Une préparation pour plusieurs Dailies FAIT : dans
  « Aujourd'hui », une section par autre Daily du jour (👥 Web · Daily 9:30) ; à l'envoi, chaque Daily reçoit sa part.
  « Hier » des autres équipes FAIT (plan d'hier de chaque équipe avec statuts) + sélecteur « Espaces » à chaque étape
  (enlever un Daily le cache, le sort du Plan du jour et rien ne lui est envoyé). Bilan du soir FAIT (Prévu ce matin + statut modifiable,
  « Changé depuis ce matin » = terminé aujourd'hui hors plan ; les autres changements de statut ne sont pas datés). RESTE : docs/mission.html et docs/bilan-reunions.html à mettre à jour. (ancien : onglet
  « Plan · nom » protégé par personne) ; Bilan du soir sur les places du plan
  Restent (lots suivants) : 3 plan entre espaces + onglet « Plan · nom »
  protégé par personne (aujourd'hui : onglet des points de la réunion) ; 4 Point perso / Bilan du soir ; 5 coche
  « À concrétiser » des Informations.
  Dépôt mes-skills : REMPLI le 13/10 (branche main, 9 skills + README). Toute amélioration d’un skill : dans les deux dépôts.

- DÉCISION REMPLACÉE (13/10, choix conscient) : plus de « fait / pas fait » ; une seule donnée, le statut (élément ou
  point de suivi), revue au Bilan du soir et à « Hier » (même affichage ; Bilan fait → Hier déjà à jour).

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

## Fait aussi le 08/10 (suite)
Rappel « 📌 À valider » (✅ Valider dans le Chat ou en réunion, sans « Lu ») ; mode Simple : étape « Suivis » toujours
affichée dans chaque rituel (mêmes composants) ; « Suivre à » : réunions des espaces affichés seulement, point perso
et revue de la semaine en mode Simple ; pièces jointes à cocher ; « ✓ Terminé » / « ⊘ Pas fait » au demandeur ;
plusieurs destinataires (n réponses sur m, Relancer, Clôturer chez tous) ; « Clos par l'expéditeur » ; notes
Information (concrétisées comme les autres), Risque et Dépendance au train ; revue des OKR (Arrêter clôt l'OKR,
Ajuster ajoute une note à concrétiser) ; participants repris de l'Organisation ; Compte rendu visible de l'équipe.

## Reste à faire
- CRA, compte rendu d'activité (14/10, demandé par l'utilisateur, à concevoir) : savoir sur quoi chacun a travaillé,
  pour le budget (consommé réel). Sources possibles, à choisir : ce que la personne dit au Daily (« Hier »), ou le plan
  du jour validé le soir (Bilan du soir) ou le matin (Point perso). Si le Daily ne l'a pas bien rempli : estimer à
  partir des tâches et du sprint (méthodes d'estimation à proposer).
- Jours passés sur une story (14/10) : saisir une estimation ou le nombre réel de jours d'une personne sur une user
  story ; suivi avec le CRA et les estimations.
- Calcul automatique des niveaux au-dessus (14/10) : les valeurs des features et des epics se calculent depuis le
  dessous. Case « Calcul automatique » sur chaque feature et chaque epic, cochée par défaut ; décochée, la valeur mise
  à la main est forcée (ex. epic à 60 jours). La dernière valeur mise à la main est gardée, pour la remettre sur demande.
- Chapters (13/10, reporté par l'utilisateur) : regroupement transverse par métier (SAFe seulement, pas en mode Simple),
  Chapter lead ; décidé : réunion « Réunion du chapter » mensuelle (Situation · Pratiques avec vote étoiles · Compétences
  · Concrétisation · Compte rendu), animée par le Chapter lead. Ouvert : qui crée (proposé : RTE ou Epic Owner) et qui
  est membre (proposé : calculé par métier + ajouts / retraits par le Chapter lead).
- Changements depuis la dernière réunion : seuil réglable pour les valeurs (budget, objectifs), dans le filtre ;
  filtre pré-rempli gardé quelque part (où ? à décider) (demandé le 13/10, session 3).
1. Faire voir à l'utilisateur, en captures, ce qui a été codé après la validation (Chat : Transmettre, Accepter et
   renvoyer, rappel ✅ Valider ; mode Simple « Suivis » ; types Information, Risque, Dépendance ; revue des OKR).
2. Revue de sprint : inviter les parties prenantes hors équipe.
3. Onglet « Compte rendu » pour le destinataire hors équipe (le RTE le reçoit déjà dans le Chat).
4. Plus tard : ajouter des participants à une réunion (aujourd'hui repris de l'Organisation).
5. **Chantier à part (mode Simple)** : modèle des réunions du mode Simple pour une personne, une équipe, une
   entreprise (réunion mensuelle, annuelle…), qui animent ; adapter alors les suivis et le Chat (déjà branchés).
6. Rôle transverse ou droits transverses (demandé le 09/10, à concevoir). Y compris (demandé le 09/10) : affiner les
   rôles du mode Simple pour l'accès aux réunions (aujourd'hui par défaut : équipe = Scrum Master, sinon Product
   Owner, anime, les membres participent ; entreprise = responsable de la direction de premier niveau anime, les
   responsables des équipes participent ; budget : le responsable de l'équipe demande, celui de l'entreprise décide).
7. « Ne plus suivre » : FAIT (13/10) — statut « Plus suivi » (fermé, filtre « Fermées ») ; l'élément lié continue sa
   vie ; message « Pour information » au responsable ; bouton « 👁 Ne plus suivre » pour le valideur.

8. Congés déclarés par chacun dans l'application (demandé le 09/10) : capacité de l'équipe calculée d'avance
   (Planification, PI Planning, Préparation du PI, Pilotage), affinée à chaque sprint et validée en Rétrospective.
Retours maquette budget (09/10) : congés modifiables ; Accorder en partie (montant ≤ demandé) ; « Réparti / Non
réparti » à renommer plus clair ; message « Pour information » sans aperçu du contenu avant l'appui ; seule une
personne qui a le droit « Gérer le budget » crée une Demande de budget. Validé : écran « Mes suivis » (rouvert
le 09/10) et trace des notes fermées (validées / abandonnées) jusqu'à leur suppression (Rétrospective, Inspect &
Adapt, Revue du portfolio), dans les réunions (filtre « Fermés ») et dans « Mes suivis ». Libellés de l'enveloppe :
« Enveloppe · Engagé · Disponible » (validé 09/10). Validation : on garde « ✅ Valider » hors réunion (Chat) ; ce
qui est décidé hors réunion porte la marque « décidé hors réunion » et est mis en avant à la réunion suivante ;
valideur par défaut = animateur. Même règle pour le budget (validé 09/10) : décision depuis le Chat par la personne qui a le droit
(message « À décider », mêmes choix qu'en séance : Accorder en totalité ou en partie, À reprendre, Refuser), ou en séance (le message disparaît alors) ; décidé hors réunion = mis en avant à la réunion
suivante (Confirmer / Corriger par ligne d'ajustement). Maquette à jour (13 écrans) : docs/maquette-budget.html.
Lot 1 codé (09/10) : Sheet « Budget » à part par entreprise (src/budget.ts, api lireBudget / ecrireDepense / ecrireCout ;
démo « budget@demo-entreprise »), coût annuel sorti de l'Organisation (fiche Personne, ÷ jours ouvrés réels de
l'année), « 💶 Dépenses » dans les fiches entreprise (vue Entreprise), portfolio, train, équipe, epic, feature, avec
répartition (effectif / parts égales / % à la main). Reste : le Budget prévu de l'epic est encore dans le Sheet de
l'entreprise (à déplacer au lot 5, dossier d'investissement).
Lot 2 codé (09/10) : congés déclarés (menu du compte « 📅 Mes congés », fiche Personne ; onglet Conges du Sheet de
l'espace), fermetures de l'entreprise (vue Entreprise), Planification les compte dans les disponibilités, Daily
« Absents aujourd'hui », Rétrospective 1re étape « Jours réels » (prévus = ouvrés − fermetures − congés, corrigés,
« ✅ Valider » → onglet JoursReels) puis « Ajuster à … j / Garder » (calendrier de l'équipe). src/conges.ts.
Capacité par sprint du PI (PI Planning, Préparation du PI : étape Capacité, calculée avec les congés) : faite.
Lot 3 codé (09/10) : src/consomme.ts — Consommé réel par période (depuis le 1/01) = personnes (coût annuel ÷ jours
ouvrés × jours ; équipe : sprint par sprint en % des points réalisés ; RTE/PM → train, Epic Owner → portfolio,
autres → portfolios) + dépenses (au prorata, réparties, seulement pendant la vie de l'epic) + frais généraux (dont
« en % » du coût des personnes) ; coût réel d'un point ; reste à faire (features > stories, stories sans
estimation) ; dépenses à venir ; Estimation à la fin. Pilotage portfolio (Budget prévu · Consommé réel · Estimation
à la fin, écart, Hors epics, d'où vient le consommé) et fiche de l'epic. Sans accès au Sheet Budget : pas de bloc.
À revoir : « Hors epics » (sprints sans point réalisé, dépenses avant les epics) peut être gros.
Lot 4 codé (09/10) : demandes de budget (onglet DemandesBudget du Sheet Budget). Bloc « 💶 Demandes de budget »
à l'étape Concrétisation de toutes les réunions du socle (équipe, train, portfolio) : ＋ Nouvelle demande (seulement
le droit « Gérer le budget » : SM, RTE/PM, Epic Owner) → soumise au niveau du dessus ; « À décider » dans le Chat
des personnes qui décident (mêmes choix : Accorder en totalité ou en partie, À reprendre, Refuser) ; en séance :
Accorder (montant), À reprendre / Refuser (motif), Soumettre plus haut ; décidé hors réunion → « Confirmer » à la
réunion suivante ; accordée → dépense créée sur l'élément ; « ℹ️ Pour information » au demandeur (contenu caché
dans la liste) ; « 💶 Demandes de budget » dans le Pilotage. Reste : Daily sans ce bloc ; Comité budgétaire
(réunion entreprise) à créer ; enveloppes Engagé / Disponible ; message « Pour information » lu en un appui.
Lot 5 (09/10), partie 1 codée : 💼 Dossier d'investissement (onglet Dossiers du Sheet Budget, une ligne par epic :
hypothèse, estimation en points, budget prévu, budget du MVP ≤ prévu, décision) dans la fiche de l'epic (enregistré
à la sortie de chaque champ ; l'ancien « Budget prévu » de l'epic sert de repli) ; étape « Dossiers » de la Revue du
portfolio : à décider (✅ Lancer seulement si complet → état Prêt, ⏸ Pas maintenant, ✖ Abandonner), budget du MVP
atteint (consommé réel ≥ MVP : ▶ Continuer, ↪ Changer de direction, ⏹ Arrêter → Terminé), décidés. Reste à faire
estimé = max(epic, features, stories). Une epic en Idée / Analyse ne reçoit pas de dépenses réparties. Pilotage :
« MVP … atteint ». Partie 2 codée : 📌 Mes suivis (onglet Réunions, en tête) : notes où je suis responsable, valideur ou auteur,
dans toutes mes réunions (une lecture par espace) ; Ouvertes (à concrétiser, en cours, à valider, en retard, à
reprendre) / Fermées (validées, abandonnées avec motif, gardées jusqu'à leur suppression) ; lecture seule (on traite
dans la réunion ou le Chat). Lot 5 terminé (13/10) : « Ma préparation » de l'Epic Owner (Revue du portfolio, « Mes dossiers » à compléter) ;
filtre « Fermées » des suivis (Daily et autres réunions : validés, abandonnés) ; suivi décidé depuis le Chat =
colonne hors_reunion « 1 » de PointsReunion, mis en avant en tête de la Situation (« Décidé hors réunion »,
« Confirmer » par l'animateur → « 2 »). Composants communs : repartirSuivis, BlocHorsReunion (reunion/Suivi.tsx).
Mode Simple (validé le 09/10, codé le 09/10 sans maquette à la demande de l'utilisateur) : trois cadres Seul / Équipe / Entreprise, mêmes
réunions simplifiées (notes, suivis, Chat), même moteur que le SAFe avec des réglages fixés et affichés (« Réglé par
le mode Simple »), mêmes données dans les mêmes Sheets (basculer ne perd rien). Projet (Simple) = epic (SAFe) ;
Objectif (Simple) = OKR (SAFe), même élément et mêmes champs (résultats clés). Entreprise → objectifs → projets ;
équipes d'un projet = celles qui ont des tâches dessus ; pas de portfolio ni de train (en SAFe : portfolio « Principal »).
Budget simplifié : Sheet Budget par cadre (aussi 🔒 Moi) ; Prévu · Dépensé · Reste ; coût des personnes compté si
un coût annuel est saisi (jours des tâches terminées × coût d'un jour) ; dépenses ponctuelles ou par mois sur un seul
élément ; Estimation à la fin calculée si tout le reste est estimé en jours, sinon saisie à la main (facultative) ;
demandes : équipe → Revue du mois de l'entreprise, décidées par le responsable. Réunions Simple : Équipe = Point
d'équipe (chaque jour), Revue de la semaine, Revue du mois (💶 Budget), Revue du trimestre, Bilan annuel ;
Entreprise = Revue du mois (💶 Budget, demandes), Revue du trimestre (révision du budget, pas de réunion semestrielle),
Point annuel (budget de l'année) ; Moi : étape 💶 Budget à la Revue des objectifs et au Point annuel.
Vocabulaire (09/10) : aucun mot du SAFe en Simple (src/vocabulaire.ts, vocab() dans les composants communs) : epic →
projet, feature → étape du projet, story → tâche, ni OKR, ni PI, ni sprint. Reste : « SM / PO » et « j par sprint »
de l'Organisation → avec les rôles du Simple (point 6). Lien objectif ↔ projet plusieurs à plusieurs dans les deux
modes (types.ts lieAObjectif) : objectif principal (champ objectif, Roadmap) + liés aussi (champ okrs) ; fiche Projet
« 🎯 Objectifs · n », fiche Objectif (liés aussi), avancement et alertes sur tous les projets liés, Roadmap « 🔗 lié aussi ».
Codé (09/10) : types point_equipe, semaine_equipe, revue_mois, trimestre_simple, bilan_annuel, annuel_entreprise
(src/types.ts, séries dans src/reunions.ts seriesDe, étapes dans reunion/Niveau.tsx CONFIGS) ; entreprise = niveau
« unite:<direction de premier niveau> » (🏢) ; escalade et compte rendu de l'équipe vers le responsable de
l'entreprise ; demandes : niveauDessus / gerantsBudget / reunionDuNiveau avec « simple » ; BlocBudgetSimple
(Budget.tsx) dans les réunions, le Pilotage (Moi, équipes, entreprise) et la fiche « Projet (epic) » (budget prévu,
estimation à la fin saisie, colonne estimation_fin de l'onglet Dossiers) ; dépenses ponctuelles ou par mois sans
répartition ; budget lu pour chaque espace (Moi, Équipe, Entreprise). Reste : Revue du trimestre de l'équipe au
trimestre de janvier remplacée par le Bilan annuel (règle « sauf année ») ; vérifier en vrai le Sheet Budget de 🔒 Moi.
Suite : coder en 5 lots (1 Sheet Budget + dépenses ; 2 congés + jours réels ; 3 calculs + Pilotage ;
4 demandes de budget en réunion + messages ; 5 dossier d'investissement + mode Simple + Mes suivis).
10. Sécurité du Sheet « 💶 Budget » (demandé le 09/10) : aujourd'hui partagé à la main dans Google Drive ; à
   concevoir : partage automatique avec les seules personnes qui ont le droit « Gérer le budget » (retrait quand le
   droit disparaît), sans lien public ni autorisation plus large ; lié aux droits transverses (point 6).
11. Revoir les « Fermetures de l'entreprise » (demandé le 09/10) : d'où vient ce point, qui les saisit, à quoi elles
   servent (aujourd'hui : section de la vue Entreprise, déduites des jours de chacun) ; à reprendre en brainstorm.
12. Affectations d'une personne (demandé le 09/10, à concevoir puis coder) : une personne partagée entre plusieurs
   équipes et un client (ex. lundi-mardi-mercredi chez un client, jeudi-vendredi équipe A, jeudi-vendredi équipe B),
   modifiable « à partir du … » (passe à 100 % dans une équipe). Aujourd'hui : comptée en entier dans chaque équipe
   (capacité doublée) et coût partagé à parts égales. Proposé : lignes « Affectation » dans la fiche Personne
   (équipe ou « hors équipes / client », jours de la semaine ou %, à partir du), historique gardé ; capacité de chaque
   sprint = jours affectés à l'équipe ; coût réparti selon l'affectation (le client : « Hors epics » ou un porteur).
   Validé (09/10) : affectation obligatoire, en jours de la semaine (demi-journées possibles), pas en %.
   « Hors epics » : gardé tel quel (c'est la réalité du sprint).
9. Renforcer la confidentialité du Chat : « prive » n'est qu'à l'affichage, l'onglet Echanges reste lisible par qui
   ouvre le Sheet de l'espace (sujet à part, 09/10).
## Fait (09/10) : Pilotage (lot 5)
Onglet 📊 Pilotage, lecture seule, niveaux selon les rôles (équipes, train, portfolio ; 🔒 Moi en mode Simple) :
Avancement (sprint, burndown ; features et objectifs du PI, risques et dépendances ; epics par état, OKR), Charge
(capacité = somme des membres, engagé par personne, surcharge en rouge), Prévisibilité (vélocité 3 sprints, engagé
tenu, « 1 point = … j »), Suivis (en retard, à valider, notes à concrétiser), Gouvernance (décisions prises), Alertes
(lien vers l'écran). Réglage « 1 point = » (½, 1, 1½, 2, 3 j) dans le calendrier agile, 1 par défaut, valeur calculée
proposée. Code : src/pilotage.ts, src/components/PilotageView.tsx ; tests dans verif:reunions. Maquette :
docs/maquette-pilotage.html.
Fait aussi (09/10) : budget du portfolio (fiche de l'epic : Prévu, Consommé vide = calculé ; coût annuel
dans la fiche Personne, coût d'une journée = coût annuel ÷ 218 ; consommé = points terminés × jours par point × coût
d'une journée du responsable ; bloc Budget du Pilotage portfolio, dépassement en rouge) ; conversion des estimations
(le Sheet garde des points ; en mode Simple, jours = points × « 1 point = … j » de l'équipe, saisie en jours
reconvertie ; src/pi.ts reglerConversion / pointsOf). Capacité d'une personne : en jours partout.
Niveaux affichés en haut en puces (un appui, sans fenêtre) quand on a plusieurs casquettes ; un seul niveau : pas de
choix, titre « Pilotage · Mobile ». « Salaire » renommé « Coût annuel » (colonne cout_annuel).
Budget affiné : conception validée le 09/10 (coder après « je valide » du plan de lots) :
- « 💶 Dépenses » à chaque niveau (entreprise, portfolio, train, équipe, epic), modèle générique : motif, catégorie,
  montant, période (ponctuel / par jour / par mois / par an / en %), du … au ; répartition à parts égales par
  défaut, modifiable en % ; entreprise → portfolios → epics ; équipe / train / portfolio → leurs epics.
- Personnes = dépense par an (managers SAFe et hiérarchiques compris, parts égales entre leurs rattachements) ;
  prestataire = par jour. Coût d'un salarié sur un sprint = coût annuel × jours ouvrés du sprint ÷ jours ouvrés de
  l'année (feriesFrance, plus de 218). Jours réels = jours ouvrés − fermetures de l'entreprise − congés (déclarés à
  la Planification, validés par le Scrum Master à la clôture : 1re étape de la Rétrospective).
- Trois montants : Budget prévu (objectif, proposé d'après les points) · Consommé réel (par période) ·
  Estimation à la fin = consommé réel + Reste à faire estimé (points restants × coût réel d'un point). Écart rouge.
- Pas de correction des stories : à la clôture, « 1 point a pris 1,4 j réel (réglé à 1 j) », proposition d'ajuster.
- Précisions (09/10) : changement de coût = recalcul des projets ouverts, projets clôturés figés (on compense) ;
  dépense rattachable à epic, feature, story ou tâche (remonte au-dessus) ; coût des personnes d'une équipe réparti
  en % des points réalisés par epic (modifiable à la main) ; frais généraux par effectif (ou parts égales, ou %) ;
  autres dépenses à parts égales (ou %) ; budget portfolio / train par semestre (Budget participatif), epic sur sa
  vie ; epic : Estimation en points, Budget prévu = coût estimé du dossier d'investissement ; reste à faire :
  epic > features > stories, alerte si dépassé ; droit « Gérer le budget » ; mode Simple : budget par domaine →
  objectifs → epics, dépenses simples. Toute répartition modifiable à la main en %. Budget du MVP validé (alerte → décision Continuer / Changer de
  direction / Arrêter à la Revue du portfolio). Dossier d'investissement (hypothèse, estimation, budget prévu, budget du MVP)
  préparé par l'Epic Owner, décidé à la Revue du portfolio (Lancer / Pas maintenant / Abandonner). Maquette :
  docs/maquette-budget.html (à valider).
- Validation des budgets (09/10, en conception) : mêmes notes, suivis, maillons « Transmettre » et Chat que les
  réunions (note « 💶 Demande de budget ») ; aucune escalade automatique (reportée à la réunion suivante du niveau,
  transmise à la main) ; tout passe par le portfolio pour l'instant ; nouvelle réunion « Comité budgétaire »
  (entreprise) ; carte des réunions budget par niveau à valider. Reste à faire : exceptions « sans passer par le
  portfolio » (seuils), à étudier plus tard. Bouton « Ajuster à 1 point = … j » à la Rétrospective (Scrum Master).
  Validé aussi : Comité budgétaire annuel + révision à mi-année ; Budget participatif semestriel ; calculé
  automatiquement (coût des personnes, dépenses engagées, besoin prévu) vs « Demande de budget » réservée à l'argent
  nouveau ou imprévu ; décision Accorder (crée une allocation) / À reprendre / Refuser, en réunion ou depuis la fiche
  (droit « Gérer le budget »), jamais depuis le Chat ; Chat relié (proposé : naître d'un message, discuter, être
  prévenu de la décision).
  Revu le 09/10 : demande de budget née seulement en réunion ; soumise par l'animateur ; arrive dans la réunion de
  suivi du dessus (ART sync, Synchronisation du portfolio, Comité budgétaire) ; décision Accorder / À reprendre /
  Refuser / Soumettre plus haut. Validé : message « ℹ️ Pour information » (disparaît à la lecture, montant et
  décision possibles, toujours « À traiter à : <réunion> ») ; Sheet « 💶 Budget » séparé, partagé seulement avec le droit « Gérer le
  budget » (coûts annuels, allocations, dépenses, demandes). Validé aussi.
Reste (pilotage) : coûts annuels visibles de ceux qui lisent l'Organisation (à revoir avec les droits transverses).

## Questions ouvertes à l'utilisateur
- Pilotage : faire valider les captures (équipe, train, portfolio, Simple).
- Abandonné le 08/10 : « Suivi dans › » (« Mes suivis » rouvert le 09/10), « Valider ? » d'une tâche terminée.

## Fait récemment (08/10)
- Suivis complets (statuts, validation, Chat « Valider ? », escalade qui redescend), vocabulaire Notes / Suivis partout (plus de « point »), fiche de l'élément en deux blocs, escalader force « Suivre », fichiers .md.

## Décisions du 13/10 — codées le 13/10
Fait : Information par défaut et fermée d'office (toutes réunions) ; Daily (Mes notes sous Hier et Aujourd'hui, Résumé
à la place de Blocages) ; 💡 Proposition (Rétro, Inspect & Adapt ; reportée = sous_type « reportee ») ; demande de
budget = choix de concrétisation d'une note (soumise au compte rendu ; plus de bouton « Nouvelle demande ») ;
dossiers d'investissement soumis dans le Chat (« 📨 Soumettre pour décision », décidé hors réunion, Confirmer à la
Revue du portfolio) ; décisions directes en séance → note « Décision prise » (close). Plus suivi : fait.
Fait aussi (13/10) : notes fermées hors sprint supprimées à l'envoi du compte rendu de la réunion suivante de la même
série (base.tsx, pointsFinis) ; Daily « Aujourd'hui » : tâches en cours reprises d'office (cochées, décochables) et en tête, « Blocages toujours ouverts » des dailies précédents rappelés.
Codé (13/10) : enveloppes (onglet Enveloppes du Sheet Budget, situationEnveloppe : Engagé = budgets prévus des
epics lancées + demandes accordées sur l'année ; entreprise = enveloppes des portfolios ; affichées au Pilotage du
portfolio et dans « Accorder », alerte si dépassement) ; réunion 🏛️ Comité budgétaire (comite_budget, niveau
« unite:<direction> », janvier et juillet, responsable anime, Epic Owners participent : Enveloppes, Écarts,
Concrétisation avec les demandes des portfolios) ; étape « 📈 Écarts budgétaires » (BlocEcarts) dans le Comité, la
Synchronisation du portfolio et la Revue du mois (Simple). Reste : enveloppes des trains au Budget participatif.
Étape « 📈 Écarts budgétaires »
(Synchronisation du portfolio à chaque sprint, Comité budgétaire à la révision de mi-année ; Simple : Revue du mois de
l'entreprise) : par epic en écart, Réviser le budget prévu (→ demande), Réduire le périmètre (→ note d'action),
Accepter l'écart (motif). Codé (13/10) : refonte de la feuille « Concrétiser » : Type (Rien · Créer un élément · ⚡ Action rapide, valeur
enregistrée « suivre » · Demande de budget) → À qui (affectation Moi / équipe ; « ↪ Transmettre » à part : remplaçant,
autre équipe, niveau du dessus, toujours suivi) → Suivi (oui : validation + échéance ; non : statut plus_suivi).
Alerte d'absence (congés) avec « Transmettre à un remplaçant ». ChoixConcret.suivi / transmis, estSuivi().
13. Extensions (validées le 13/10, à concevoir) : relances automatiques dans le Chat (suivi proche ou après son
    échéance) ; vie des risques (ROAM suivi dans le temps) et des dépendances entre équipes ; indicateurs des réunions
    (suivis tenus à l'échéance, décisions hors réunion confirmées, notes jamais concrétisées).
## Décisions du 13/10 (détail)
- Notes : ℹ️ Information = type par défaut dans toutes les réunions, fermée d'office (rien à concrétiser) sauf si on
  choisit de la concrétiser. Daily : Hier et Aujourd'hui gardent les tâches + un bloc de notes en bas (Information,
  Blocage, Décision, Demande d'action ; pas Proposition) ; écran Blocages à remplacer (proposition en cours).
- Rétro : type 💡 Proposition (amélioration continue) ; retenue au vote → Concrétisation directe ; reportée → rétro
  suivante ; non retenue → fermée ; étape « Actions » supprimée ; même type pour les Problèmes de l'Inspect & Adapt.
- Enveloppes : Engagé = budgets prévus des epics lancées + demandes accordées ; Disponible = Enveloppe − Engagé.
- Comparaison consommé réel / prévu pour affiner le budget : à placer dans une réunion budget (proposition en cours).
