# Décisions fonctionnelles prises pendant le développement des 9 lots (16/10, en l'absence de l'utilisateur)

À valider au retour de l'utilisateur. Chaque ligne : la règle, la décision prise quand la spécification
(docs/regles-reunions.html, blocs 16 et 17) laissait un choix, et la raison. « À revoir » = je recommande d'en reparler.

| Lot | Règle | Décision prise | Pourquoi |
|---|---|---|---|
| 1 | N1 | Une note pas encore envoyée est gardée tout de suite dans 🔒 Moi (« En préparation »), pas seulement sur l'écran ; elle sort de 🔒 Moi quand on envoie son point. | Elle n'est plus perdue si on ferme ; personne d'autre ne la voit. |
| 1 | N1 | Le rappel 🟡 s'affiche dans la sous-ligne : « Pas encore partagée · écrite pour « Daily du 15/10 » ». | Pas de pastille en plus (le texte devenait illisible). |
| 1 | N2 | L'impact se calcule pour l'**auteur** de la note (pas pour le Scrum Master qui concrétise) : travail d'un autre, nouvel élément du sprint, autre équipe ou niveau du dessus, blocage / risque / dépendance sur un élément du sprint. Sous-tâche pour soi : perso. | « Ne touche que moi » parle de l'auteur. |
| 1 | N3 | « Autre élément… » ne propose que les éléments de l'équipe (features et epics restent proposées). | Un élément d'une autre équipe passe par l'escalade ou Transmettre. |
| 1 | V1-V2 | Case « 🔒 Perso » dans la saisie d'une note de préparation ; retirée avec la raison quand un impact est repéré. Une note perso n'apparaît jamais à la séance (tour de table, concrétisation). | Spécification V2. |
| 1 | V3 | « Partager avec l'équipe » (toucher la note perso) : elle redevient « à partager », part avec le point, une ligne d'historique « Note perso de …, partagée le … ». La confirmation par un responsable = sa concrétisation en séance. | Pas de nouvel écran de confirmation. |
| 1 | D1 | « ➜ Déplacer vers une autre réunion » dans la fiche d'un suivi : animateur, responsable ou validateur ; vers la prochaine réunion de chaque série où le responsable participe, **dans le même espace** (même Sheet). | Un déplacement vers un autre Sheet demanderait une copie : écarté pour l'instant. |
| 2 | R1 | « 📌 Suivre en réunion » devient « 📌 Mettre en réunion » ; il crée une **note** (concrétisée ensuite en séance), pas un suivi déjà concrétisé. | Un seul chemin : tout entre par une note. |
| 2 | R1 | Une demande de budget reçue attend au Chat ; « 📌 Mettre en réunion » la fait entrer dans le bloc 💶 de la réunion ; le bloc dit « 💬 n demandes reçues au Chat, pas encore mises en réunion ». Décider depuis le Chat reste possible. | Régression voulue (bloc 16, « Changements à vérifier »). |
| 2 | R1 | « 📌 Suivre à <réunion> » de Transmettre n'est plus coché d'office. | Spécification. |
| 2 | R3 | L'envoyeur voit sur son point : « Reçu · pas encore traité », puis « Pris en compte · réponse prévue le 18/10 » (lot 5), puis « Suivi à Daily 👥 Mobile ». | Spécification ; deux colonnes ajoutées aux échanges (`suivi_a`, `rappel_le`). |
| 2 | Q1-Q2 | « Escalader » n'est proposé qu'à un responsable du niveau (PO, SM, ou suppléant) et jamais au niveau le plus haut. Un Coach agile qui anime n'escalade pas. | Q1. |
| 2 | Q3 | Dans « Responsable › », le PO / PM est proposé en premier pour une décision ou une note qui parle de priorité, budget, exigence, périmètre ; sinon le SM / RTE. | Q3 : « le partage dit à qui l'application envoie en premier ». |
| 2 | — | Le message « 📌 Nouveau suivi » s'appelle « 📌 Suivi reçu ». | Spécification R1. |
