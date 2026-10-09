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

## Fait aussi le 08/10 (suite)
Rappel « 📌 À valider » (✅ Valider dans le Chat ou en réunion, sans « Lu ») ; mode Simple : étape « Suivis » toujours
affichée dans chaque rituel (mêmes composants) ; « Suivre à » : réunions des espaces affichés seulement, point perso
et revue de la semaine en mode Simple ; pièces jointes à cocher ; « ✓ Terminé » / « ⊘ Pas fait » au demandeur ;
plusieurs destinataires (n réponses sur m, Relancer, Clôturer chez tous) ; « Clos par l'expéditeur » ; notes
Information (concrétisées comme les autres), Risque et Dépendance au train ; revue des OKR (Arrêter clôt l'OKR,
Ajuster ajoute une note à concrétiser) ; participants repris de l'Organisation ; Compte rendu visible de l'équipe.

## Reste à faire
1. Faire voir à l'utilisateur, en captures, ce qui a été codé après la validation (Chat : Transmettre, Accepter et
   renvoyer, rappel ✅ Valider ; mode Simple « Suivis » ; types Information, Risque, Dépendance ; revue des OKR).
2. Revue de sprint : inviter les parties prenantes hors équipe.
3. Onglet « Compte rendu » pour le destinataire hors équipe (le RTE le reçoit déjà dans le Chat).
4. Plus tard : ajouter des participants à une réunion (aujourd'hui repris de l'Organisation).
5. **Chantier à part (mode Simple)** : modèle des réunions du mode Simple pour une personne, une équipe, une
   entreprise (réunion mensuelle, annuelle…), qui animent ; adapter alors les suivis et le Chat (déjà branchés).
6. Rôle transverse ou droits transverses (demandé le 09/10, à concevoir).
7. « Ne plus suivre » un point de suivi, depuis la réunion correspondante, possible dans toutes les réunions
   (demandé le 09/10).

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
dans la réunion ou le Chat). Reste du lot 5 : « Ma préparation » de l'Epic Owner (dossiers à compléter), filtre
« Fermées » dans les réunions, marque « validé hors réunion » des suivis, Mode Simple budget (à préciser : pas de
Sheet Budget dans 🔒 Moi).
Mode Simple (validé le 09/10, maquette à faire avant de coder) : trois cadres Seul / Équipe / Entreprise, mêmes
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
