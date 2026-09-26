# President — application mobile iPhone & Android reliée à Google Sheets

Application pour gérer une liste de **tâches**, **missions** et **rendez-vous**.
Toutes les données sont lues et enregistrées dans des **Google Sheets** de votre Google Drive (un par espace),
qu'on peut donc aussi consulter depuis un ordinateur.

- `mobile/` : l'application (Expo / React Native, un seul code pour iOS, Android et le web)
- Sur cette branche (version SAFe), **plus de script** : l'application se connecte avec le compte Google et lit /
  écrit elle-même les Google Sheets (connexion Google directe).

## Fonctionnalités

### Version SAFe (branche `claude/version-safe`) : espaces

**En ligne : <https://tmarmed.github.io/Default/safe/>**, publiée automatiquement à chaque modification (seule version
publiée ; <https://tmarmed.github.io/Default/> y renvoie).

- **Espaces de travail** (« espaces » ci-dessous) : chaque espace de travail est un Google Sheet, d'un type choisi à sa création : 🔒 **Moi** (un seul, jamais
  partagé), 👥 **Équipe** (équipe indépendante), 🏢 **Entreprise** (avec ses équipes). Nom du fichier :
  `President | Moi`, `President | Équipe | Mobile`, `President | Entreprise | ACME` (séparateur `|`).
- **En haut** : une barre fixe « President » avec, à droite, l'icône standard du compte (silhouette, point vert =
  connecté ; menu : Stockage Google Drive, Se déconnecter — en démo : Stockage Google Drive, Réinitialiser la démo).
  Juste après « President », la **pastille des espaces de travail** (« 🔒 Moi · 👥 Mobile ② ▾ » ; jamais coupée
  « … » : le texte rapetisse, puis les derniers noms deviennent « +N ») : la toucher déplie la **carte des espaces de travail** sous la barre (ouverte par défaut, avec son titre
  « ESPACES DE TRAVAIL » ; ▴ la replie ; mémorisé) : petit filtre **Tous · 👥 · 🏢** (seulement s'il y a à la fois des équipes et des entreprises), pilule
  **＋ | −**, puis les espaces (un ou plusieurs affichés ; noms longs coupés « … », la ligne défile).
  - **＋** : créer un espace (type, nom, **domaines rapides** « + Domaine », Entrée), un seul bouton « Créer l'espace
    de travail » ; un message « Espace de travail créé » confirme, **OK** referme. Aussi : **Rétablir** un espace retiré, **Restaurer** un espace de la corbeille (30 jours).
  - **−** : **Retirer** (l'espace quitte l'application, son Google Sheet est gardé) ou **Supprimer** (le Google Sheet
    part à la corbeille de Google Drive, récupérable 30 jours ; un espace partagé disparaît aussi pour les autres),
    chaque espace sauf Moi. Raccourci : appui long sur un espace.
- **Alerte de stockage Google Drive** : à chaque ouverture, President mesure le stockage du compte Google. Dès
  **85 %**, une carte rouge sous la carte des espaces montre la jauge et l'espace à libérer pour repasser sous 80 %,
  puis les solutions, la meilleure marquée **Recommandé** : 🗑️ **Vider la corbeille de President** (espaces supprimés,
  effacés pour de bon) si cela suffit ; sinon 📦 **Supprimer les tâches terminées avant <mois>** : la plus courte
  période ancienne qui suffit (jamais les 3 derniers mois, ni les tâches répétées, ni un parent dont une sous-tâche
  reste ; **copie CSV** proposée avant) ; sinon ☁️ **Voir le stockage Google** (l'espace est pris par d'autres
  fichiers). Son titre la replie en une ligne (« ⚠ Stockage Drive presque plein · 87 % ▾ ») et la déplie ; « Revoir
  demain » la cache jusqu'à la fin de la journée (elle revient le lendemain si le Drive est encore à 85 %). Menu du compte › **Stockage Google Drive** : l'état à
  tout moment et « Vérifier maintenant », et un **Drive simulé** pour tester (Plein : autres fichiers, Plein :
  President ; démo : Normal 41 % ; vraie version : Réel = le vrai Drive, et en test **rien n'est effacé**, le test
  s'arrête en quittant l'application). Calcul vérifié par `npm run verif:stockage`.
- **Bloc de l'écran** : titre (« ✓ Tâches · 27 », le nombre suit les filtres ; jamais coupé « … » : il rapetisse si la place manque), juste après la **pastille
  Filtres** (entonnoir ; bleue avec le nombre de filtres actifs), et à droite le mode **Simple | SAFe** (pour tous
  les espaces affichés). La pastille Filtres (tous les écrans à données : Tâches, Itération, PI, Roadmap,
  Portefeuille) déplie **sous le titre le sous-bloc Filtres** (▴ le replie ; mémorisé) : 🔍 recherche par titre (le
  champ s'ouvre dans l'en-tête ; il se referme en changeant d'écran), ↺ réinitialiser (pastille rouge : nombre de
  filtres actifs) ; puis les domaines (et, sur Tâches, les
  types et 🏃 itération en cours en SAFe). Sur Tâches, la **barrette d'affichage** Liste · Jour · Semaine · Mois vient
  ensuite (ce n'est pas un filtre). Seul le contenu du bloc défile.
- **Cloisonnement** : chaque élément reste dans l'espace où il est créé, y compris les rendez-vous, appels et
  démarches.
- **Domaines** : au démarrage, Moi reçoit les domaines de base qui lui manquent : 💼 Pro (sous-domaines 📁 Projets
  et 🛠️ Travail), 🏠 Perso (sous-domaine 🩺 Santé), 👪 Famille, 🎨 Loisirs (une fois par liste : un domaine supprimé
  ensuite ne revient pas). Un domaine peut avoir des **sous-domaines** (un seul niveau, facultatif) ; un sous-domaine n'est proposé qu'une fois son domaine choisi (seul, il est choisi d'office). Supprimer un
  domaine en cascade supprime aussi ses sous-domaines, sinon ils deviennent des domaines principaux. À la
  création d'un espace, on saisit rapidement ses domaines (champ « + Domaine », Entrée) : ils sont créés dans son
  Google Sheet. Chaque espace a ses propres domaines, aucun n'est partagé (deux domaines peuvent avoir le même nom) : avec plusieurs espaces affichés, ils sont préfixés de leur espace (« 🏢 ACME · 💼 Pro »). Filtrer un
  domaine montre aussi ses sous-domaines.
- **Pas de lien entre deux espaces** (une tâche de Moi ne peut pas être rattachée à une epic d'une entreprise).
- **Mode Simple / SAFe** : choisi à la volée (à droite du titre de chaque écran), pour tous les espaces affichés.
- **Onglets** : dernière ligne du bloc de l'écran (une seule carte, du titre jusqu'aux onglets ; le ＋ flotte
  au-dessus).
- **Onglets par type d'espace et par mode** (au-delà de 5, la barre des onglets défile ; colonne « suite » = après les 5 premiers) :

  | Cas | 5 premiers | Suite |
  |---|---|---|
  | Moi · Simple | Tâches · Roadmap | — |
  | Moi · SAFe | Tâches · Itération · PI · Stratégie · Roadmap | Backlog · Portefeuille · Pilotage |
  | Équipe · Simple | Tâches · Roadmap · Équipe · Pilotage | — |
  | Équipe · SAFe | Tâches · Itération · Backlog · PI · Équipe | Roadmap · Stratégie · Pilotage |
  | Entreprise · Simple | Tâches · Roadmap · Organisation · Pilotage | — |
  | Entreprise · SAFe | Tâches · Stratégie · Portefeuille · PI · Pilotage | Backlog · Itération · Roadmap · Organisation |

  Plusieurs espaces affichés : l'union de leurs écrans, dans l'ordre Tâches → Itération → PI → Stratégie →
  Backlog → Portefeuille → Roadmap → Équipe → Organisation → Pilotage.
- **Écrans à venir** (Stratégie, Backlog, Équipe, Organisation, Pilotage) : cachés des onglets tant que leur lot
  n'est pas fait (voir docs/mission.html). Au-delà de 5 onglets, la barre défile (fondu à droite).
- Toutes les règles de gestion de la version précédente s'appliquent à chaque espace.
- **Connexion Google directe** : l'application crée le Google Sheet de chaque espace dans le Drive du compte
  connecté et retrouve ceux créés sur un autre appareil (un espace retiré n'est plus ajouté). À venir :
  invitation des membres d'un espace, ouverture d'un Google Sheet créé par quelqu'un d'autre (fenêtre Google).

#### Décisions et travaux à venir (branche `claude/version-safe`)

Décisions prises :
- **Espaces isolés** : chaque élément reste dans l'espace où il est créé (y compris rendez-vous, appels,
  démarches) ; on ne déplace jamais un élément d'un espace à un autre.
- **Mode Simple / SAFe** : il ne change que la présentation, jamais les données. En Simple, aucune feature n'est
  affichée, mais le lien tâche → epic est toujours conservé ; itération, points et état d'epic sont en lecture seule ;
  les objectifs du PI restent propres au mode SAFe.
- **Alertes ignorées** : personnelles (enregistrées dans Moi), chacun ignore pour soi.

Lot 1 (cohérence) — fait :
- **Alertes ignorées** : la « situation » d'une alerte ne dépend que des données, jamais de l'affichage (espaces
  affichés, préfixe d'espace, unité jours / points, mode) ; calcul « neutre » commun à toutes les alertes. Test
  automatique de garde : `cd mobile && npm run verif:alertes` (à lancer avant chaque mise en ligne).
- **Capacité d'itération par espace** : une capacité par espace (réglée sur l'appareil), charge et surcharge
  calculées espace par espace ; une jauge par espace dans l'Itération et une ligne de charge par espace dans le PI
  quand plusieurs espaces sont affichés.

Lot 2 (connexion Google directe) — fait (web ; application iPhone / Android : identifiants à créer) :
- Fait : connexion avec le compte Google, l'application lit, écrit et crée elle-même les Google Sheets des espaces ;
  plus de script Code.gs ni de clé sur cette branche. Projet Google Cloud gratuit, mode production avec accès limité aux
  fichiers créés ou ouverts par l'application (pas de validation Google, pas de reconnexion toutes les semaines) ;
  un fichier existant s'ajoute en le choisissant dans la fenêtre Google.
  État actuel du projet Google Cloud « Mes taches » : API Sheets, Drive et Picker activées, écran d'autorisation
  créé (accès drive.file, openid, email, profile), publication laissée **en test** (comptes de test seulement ;
  à publier en production avant l'usage réel ou l'invitation d'une équipe).

Ensuite (nouveaux écrans : Stratégie, Backlog, Équipe, Organisation, Pilotage), à prendre en compte dès leur
conception :
- **Calendrier PI / itérations** : commun à tous les espaces pour l'instant ; à décider avec l'écran Équipe.
- **Entreprise et ses équipes** : à concevoir avec l'écran Organisation.
- **Qui voit quoi dans un espace partagé** (rôles, « casquettes ») : à ne pas oublier ; en attendant, tout le
  contenu d'un espace est visible par ceux qui partagent son Google Sheet.

- **8 types**, les mêmes en mode Simple et SAFe : ✓ Tâche, 📅 Rendez-vous et 🚩 Mission avec **heure de fin** (proposée 1 h
  après le début, et durée affichée), 📞 Appel (numéro + bouton
  **Appeler** dans la fiche et dans la liste), 🗂️ Démarche (démarche administrative, avec **date de fin** facultative =
  date limite, affichée « ⏳ fin … » dans la liste, rouge si dépassée ; script v12 ; sans date, c'est sa date de fin
  qui la range dans la liste, le calendrier et l'itération, avec l'étiquette « Date de fin dépassée » une fois passée ; avec une date ET une date de fin, le calendrier la montre aussi
  le jour de sa date de fin : « ⏳ Fin : … », jusqu'à ce qu'elle soit terminée), 🚩 Mission, 📖 Story (user story),
  🔍 Exploration, 🐞 Bug. Filtre de la liste : « Tous » ou un type (liste déroulante, avec 🔁 Répétés).
- **Statut unique** (`statut` dans le Google Sheet), le même dans les deux modes : cocher = « Terminé » =
  colonne « Terminé » du Kanban. Décocher remet le statut d'avant (« En cours » s'il l'était ; gardé par le
  script dans la colonne `statut_avant`, v14, donc valable sur tous les appareils). Cocher (ou passer en « Terminé ») un parent dont des sous-tâches sont ouvertes demande :
  « Terminer aussi les sous-tâches ? » (tout terminer / seulement le parent) ; même question dans la fiche
  quand on choisit « Terminé ». Un parent suit ses sous-tâches : une sous-tâche commencée ou finie fait passer
  un parent « À faire » en « En cours », une sous-tâche rouverte, ajoutée ou rattachée fait repasser un parent
  « Terminé » en « En cours ». Les boutons « Terminer » / « Marquer fait » des alertes suivent les mêmes règles. Rendez-vous et appels n'ont pas d'« En cours » (À faire ⇄ Terminé ; passer une tâche « En cours » en
  rendez-vous ou appel la remet « À faire »). Le jour de fin réel est
  noté par le script (colonne `termine_le`, v13) et sert au burndown et à « domaine délaissé ».
- **Sous-tâches** (un seul niveau) pour les Story, Démarche, Mission et Exploration : chaque sous-tâche a son
  type, sa date, ses points, son statut et son itération, et le même rangement que son parent. Dans la
  **liste**, le parent se déplie (bouton ▸ 1/3, mémorisé ; déplié tout seul si une sous-tâche est due ou en
  retard), avec cases à cocher et « + Sous-tâche » ; il se range à la date la plus proche de ses sous-tâches.
  **Jour / Semaine / Mois** : une sous-tâche datée apparaît à sa date (« ↳ parent »). **Itération** : la carte
  du parent se déplie (sous-tâches d'une autre itération en gris), bouton « terminer » quand tout est fait.
  **Charge** : si les sous-tâches ont des points, ce sont elles qui comptent (dans leur itération) ; si
  seules la tâche en a, la tâche l'emporte ; si les deux diffèrent, **alerte** dans la fiche (bouton
  « Passer la tâche à … » et points modifiables sur chaque sous-tâche), ⚠ sur la ligne et dans l'Itération.
  Supprimer un parent : avec ses sous-tâches (case à cocher) ou en les gardant comme tâches normales.
- 4 vues : **Liste** (En retard, Aujourd'hui, Demain, dates suivantes, Sans date), **Jour**, **Semaine**, **Mois**
- Glisser le doigt à gauche / à droite pour passer au jour, à la semaine ou au mois suivant / précédent ;
  bouton « Aujourd'hui » pour revenir à la période en cours
- Filtres : Tous ou un type (liste déroulante)
- Ajout, modification, suppression ; titre, type, date, heure, lieu, priorité, statut, notes
- Case à cocher pour marquer « terminé » ; les terminés sont masqués (affichables en bas de liste)
- **Répétition** chaque semaine, mois, trimestre ou année, à jour précis ou « dans la période »,
  avec date de début et de fin. Cocher valide la période en cours ; l'élément revient à la suivante.
  Les périodes oubliées restent à rattraper, regroupées sur une ligne « En retard ».
- **Roadmap** (onglet en bas) : les **epics** (grands projets avec début, fin, couleur, description)
  sur un schéma à barres, échelle **3 ans / Année / Trimestre / Mois**, glisser pour changer de période,
  trait « aujourd'hui » et avancement (tâches terminées / total). Chaque tâche peut être rattachée à une
  epic ; supprimer une epic conserve ses tâches, sans epic.
- **Hiérarchie Domaine → Objectif → Epic → Tâche** : domaines permanents (💼 Pro, 🏠 Perso…), objectifs
  datés ou permanents avec indicateur facultatif (ex. 8/20 clients). Chaque élément est rattaché à son
  niveau le plus précis ; les niveaux au-dessus s'en déduisent. Filtre par domaine dans la liste.
- **Roadmap regroupée** par domaine puis objectif, sections repliables (mémorisées), filtre par domaine,
  « alertes seulement », « tout replier / déplier ». Bouton + : epic, objectif ou domaine.
- **Suppression** d'un domaine, objectif ou epic avec la case « Supprimer aussi tout ce qui est rattaché » :
  cochée, tout ce qui est en dessous est supprimé ; décochée, les éléments sont conservés et remontent d'un
  niveau (tâches d'une epic → son objectif ou son domaine ; epics d'un objectif → son domaine).
- **Alertes de dates** dans la roadmap et les fiches (voir règles ci-dessous).
- **Alertes par écran** : une carte « ⚠ Alertes » en tête de la zone qui défile de chaque écran, repliée sur une ligne
  par défaut (choix mémorisé par écran ; dépliée : 3 visibles, « voir les
  autres »), avec des boutons d'action, et deux **pastilles sur chaque onglet** (itération et PI en cours) : 🔴 alertes et 🟡 rappels. **Rappels (jaune)** :
  démarche à finir dans 3 jours au plus (sauf si elle a déjà une alerte rouge : en retard, sous-tâches en retard,
  prévue après sa date de fin), fin d'itération dans 3 jours au plus avec des tâches non faites ; tout le reste est
  en rouge. Mêmes règles d'affichage pour les deux : **deux cartes séparées**, rouge « ⚠ N alertes » puis jaune
  « 🟡 N rappels », chacune repliée par défaut et ouverte / fermée indépendamment (mémorisé par écran), 3 visibles
  et « Voir les N autres », alertes ignorées de sa couleur, fond de couleur par alerte, Ignorer…). Les alertes suivent le **filtre de domaine** ;
  la capacité reste commune. Rien n'est modifié tout seul.
  **Ignorer** une alerte (lien discret sous chaque alerte) : elle disparaît de la carte et du chiffre de l'onglet,
  enregistrée dans le Google Sheet (onglet `Ignorees`, partagé entre vos appareils) avec la situation du moment ;
  si la situation change (dates, heures, nombre…), l'alerte revient. Pour les alertes dont le texte bouge chaque
  jour (rappel « dans 2 jours », burndown, % de temps écoulé), c'est une situation stable qui compte (date de fin,
  itération, résultat de l'objectif) : l'alerte ignorée ne revient pas le lendemain. Nettoyage automatique : à chaque chargement depuis le Google Sheet, les alertes ignorées dont la situation n'existe plus (problème corrigé ou situation changée) sont effacées de l'onglet `Ignorees` — calculé sur tous les domaines, les deux modes, les itérations et PI précédent, en cours et suivant, pour ne rien effacer à tort. Les alertes de dates
  des barres de la Roadmap s'ignorent aussi (lien « Ignorer » sous l'alerte ; « Ne plus ignorer » dans la carte). « N alertes ignorées · les revoir » →
  « Ne plus ignorer ». Agenda : chevauchements calculés sur tout l'agenda (tous domaines), y compris rendez-vous
  répétés (30 jours), rendez-vous et missions (heure de fin, sinon 1 h estimée), appels avec une heure (30 min
  estimées), sans les créneaux d'aujourd'hui déjà finis ; rendez-vous passé non coché :
  « Marquer fait » ou « Reprogrammer » ; une tâche et ses sous-tâches en retard = une seule alerte (le raccourci « Tout reporter », affiché
  quand il y a plusieurs retards, ne compte pas dans le chiffre de l'onglet) ; un parent dont toutes les
  sous-tâches sont faites propose seulement « Terminer » (pas « Reporter ») ; les points, la charge et la
  capacité s'affichent dans l'unité choisie (j ou pts) ; pas
  d'alerte « vide » pour une epic à l'état Idée ou qui commence dans plus d'un mois, ni « délaissé » pour un
  domaine de moins de 2 mois.
  - **Tâches** : en retard (reporter à demain, tout reporter, choisir une date) ; élément répété en retard
    (cocher la période, tout rattraper ; rendez-vous répété : « n'est pas coché », marquer fait) ; rendez-vous et missions qui se
    chevauchent (pas une sous-tâche pendant sa propre tâche) (d'après l'heure de fin ; sans elle, 1 h estimée), avec « Décaler … juste après » ;
    toutes les sous-tâches faites (terminer la tâche) ; tâche terminée alors que des sous-tâches ne sont pas faites
    (terminer aussi les sous-tâches, ou rouvrir la tâche ; ces sous-tâches ne sont alors plus signalées en retard) ; démarche : date de fin dépassée (terminer ; remplace
    l'alerte « en retard », et « toutes les sous-tâches faites » s'il y a lieu), date de fin dans 3 jours au plus (rappel), date prévue après la date de fin (ramener), sous-tâche prévue après la
    date de fin de sa démarche (ramener). Un report (« Reporter à demain », « Tout reporter », fin d'itération) ne
    dépasse jamais une date de fin pas encore passée : « Reporter à aujourd'hui (date de fin) ». Deuxième choix partout où la
    date de fin bloque : la repousser (« Repousser la date de fin au … et reporter à demain », « Décaler au … en
    repoussant la date de fin de … », « Repousser la date de fin… » pour une date de fin dépassée, qui ouvre la fiche).
  - **Itération** (l'itération affichée, nommée dans la carte) : surcharge ; points du parent ≠ sous-tâches ;
    retard sur le burndown ; fin d'itération avec des tâches non faites, hors rendez-vous (une tâche et ses sous-tâches comptent pour une ; reporter les non datées dans
    l'itération suivante, décaler les datées) ; tâches sans points (hors rendez-vous et appels, et hors
    sous-tâches dont le parent porte la charge).
  - **PI** : itération surchargée ; dates de la feature hors de son epic (étendre l'epic) ; feature sans itération ; feature en retard sur son plan (décaler la
    feature ou ramener ses tâches) ; points de la feature ≠ ses tâches ; points d'une tâche ≠ ses sous-tâches (toutes les itérations du PI) ; objectif du PI engagé sans feature
    ni tâche prévue dans le PI (de son epic si elle est choisie, sinon de son domaine ; tâche datée ou rangée
    dans une itération du PI, ou répétée avec une échéance dans le PI), avec « + Tâche dans l'epic » ; PI terminé sans valeur obtenue notée (aussi
    pour le PI qui vient de finir, dans la carte et le chiffre de l'onglet).
  - **Roadmap** : alertes de dates (sur les barres) ; epic ou objectif en retard (repousser d'un mois,
    voir les tâches ouvertes) ; epic sans tâche, objectif sans epic.
  - **Portefeuille** : epic encore à l'état Idée / Analyse / Prêt alors que des tâches sont commencées et d'autres
    encore ouvertes (la passer En cours) ; epic « Terminée » avec des tâches ouvertes, ou toutes ses tâches faites sans être
    terminée ; indicateur d'objectif en retard sur le temps écoulé ; domaine délaissé : rien de fait depuis 2 mois et rien de prévu (une epic
    « en cours » ne compte que par ses tâches).
- **Mode SAFe** (sélecteur *Simple | SAFe* en haut, mémorisé sur l'appareil). Simple = Tâches + Roadmap ;
  SAFe ajoute trois écrans, de l'exécution à la stratégie :
  - **🏃 Itération** : Kanban À faire / En cours / Terminé, charge face à la capacité, burndown ;
  - **🗓️ PI** : objectifs du PI (engagés / bonus, valeur prévue → obtenue, prévisibilité), tableau des
    features par itération, charge par itération ;
  - **🧭 Portefeuille** : Kanban des epics (Idée → Analyse → Prêt → En cours → Terminé), objectifs,
    répartition par domaine, alertes.
  Pile : Domaine → Objectif → Epic → **Feature** (facultative) → Tâche. Un **PI** = un trimestre civil,
  6 **itérations** de 14 jours à partir du 1er jour + semaine **IP** (innovation & planification).
  Une tâche est dans l'itération de sa date, sinon dans celle choisie à la main. **Points** facultatifs
  (« 1 point = 1 jour » en option), **capacité** de 10 par itération par défaut (réglable).
  **Filtre de domaine partagé** par tous les écrans (Tâches, Itération, PI, Roadmap, Portefeuille) et mémorisé :
  on ne voit que le domaine choisi, mais la **capacité reste commune** (charge du domaine + total / capacité ;
  dans l'Itération, les autres domaines en gris). Un **objectif du PI** peut être rattaché à un domaine : la
  prévisibilité se calcule alors pour le domaine filtré. Il peut aussi être rattaché à une **epic** (script v11) :
  choisir l'epic range l'objectif dans son domaine. Supprimer un domaine ou une epic ne supprime jamais ses
  objectifs du PI (historique) : ils passent « sans domaine » / perdent l'epic (en gardant le domaine).
  Dans le tableau du PI, les **tâches hors feature** ont chacune leur ligne (comme les features) avec un
  bloc dans la colonne de leur itération (cocher, ouvrir, groupe repliable). Un **seul « + »** (coin du
  tableau, ou bouton bleu) ouvre une fenêtre : on choisit l'**itération** (ou « Sans itération » pour une
  feature), puis **Nouvelle feature** (epic existante choisie dans la fiche), **Feature existante** (toutes
  les epics, avec recherche), **Nouvelle tâche hors feature** ou **Tâche existante** (sans feature ni date).
  On ne crée pas d'epic depuis le PI. Toucher IT1, IT2… ouvre l'itération.
  **Déplacer** : toucher une case vide de la ligne d'une feature ou d'une tâche hors feature propose de la
  déplacer dans cette itération (confirmation) ; pour une tâche datée, une nouvelle date est proposée
  (même place dans l'itération), modifiable, avec un avertissement si elle tombe dans une autre itération.
  On change de PI avec les flèches (le tableau ne bascule pas de PI quand on le fait glisser). Dans la fiche d'une feature, même nouvelle : **+ Nouvelle tâche**
  (titre + Entrée) ou **+ Tâche existante** (recherche) ; pour une nouvelle feature, elles sont rattachées à
  l'enregistrement.
- **🚀 Assistant projet** (modes Simple et SAFe ; bouton +, fiches « Ouvrir dans l'assistant », écrans vides) :
  crée un **nouveau projet** (en partant de zéro ou d'un domaine / objectif existant) ou **complète / modifie**
  un projet existant en entrant au niveau voulu (domaine, objectif, epic, feature). Étape par étape :
  ajouter (titre + Entrée), modifier (✎ dates, état, PI, itération, points), **déplacer** (↪ ce qui est
  dessous suit), **supprimer** (🗑 marqué « à supprimer », annulable, case « tout ce qui est rattaché »)
  ou passer ; l'étape Features est facultative (on peut aussi mettre des tâches directement sur l'epic).
  Rien n'est enregistré avant le **récapitulatif** (nouveau / modifié / déplacé / supprimé, alertes de
  dates) et le bouton *Enregistrer les changements*.
- **Raccourcis dans les fiches** : « + Objectif » (domaine), « + Epic » (objectif), « + Feature » et
  « + Tâche » (epic) ouvrent une fiche déjà rangée. Dans une feature, **saisie rapide** de tâches
  (titre + Entrée) ; une tâche sans date rangée dans une feature prend l'itération prévue de la feature.

### Règles de gestion des dates (epics et objectifs)

1. **Aucune date n'est modifiée automatiquement.** Si une tâche sort des dates de son epic, une **⚠ alerte**
   s'affiche (roadmap et fiche) avec un **bouton** pour ajuster l'epic : avancer le début, repousser la fin,
   ou rendre l'epic sans fin.
2. Une epic **sans date de fin est infinie** : pas d'alerte de fin.
3. Une **tâche répétée sans date de fin** dans une epic datée déclenche une alerte (« Rendre l'epic sans fin »).
4. Dates retenues : tâche ponctuelle → sa date (sans date : ignorée) ; tâche répétée → son « À partir du »
   (sinon sa création) pour le début, son « Jusqu'au » pour la fin. Les tâches terminées comptent.
5. Mêmes règles entre un **objectif** et ses epics / tâches directes : l'échéance n'est jamais modifiée
   automatiquement ; alerte + bouton « Repousser l'échéance » ou « Rendre l'objectif permanent »
   (objectif sans échéance = permanent, pas d'alerte de fin).
6. La roadmap affiche le nombre d'alertes et peut n'afficher que les éléments en alerte.
7. Chaque alerte propose **deux boutons** : ajuster le parent (ci-dessus) **ou aligner l'élément** sur les
   dates du parent : « Ramener / Décaler la tâche au … » (tâche datée), « Arrêter la répétition le … » ou
   « Faire commencer la répétition le … » (tâche répétée), « Faire finir / commencer l'epic le … » ou
   « Donner une fin à l'epic » (epic d'un objectif). L'élément est enregistré tout de suite. Une démarche avec
   une date de fin va de sa date à sa date de fin : « Ramener la date de fin de la démarche … au … ». Les messages
   et boutons nomment chaque élément par son type (la démarche, le rendez-vous répété, la mission…).
- Tirer vers le bas pour synchroniser avec le Google Sheet
- Dernière copie gardée sur le téléphone : la liste reste lisible sans réseau

## 1. Connexion Google (rien à installer)

1. Ouvrez l'application et touchez **« Se connecter avec Google »**, puis autorisez l'accès aux fichiers de
   l'application (case « Google Drive »).
2. Au premier lancement, l'application crée dans votre Google Drive le fichier **« President | Moi »**, avec ses
   onglets et les domaines de base. Chaque espace créé ensuite a son propre fichier
   (« President | Équipe | Mobile »… ; les fichiers de l'ancien nom « Mes tâches » sont renommés). Sur un autre appareil, ces fichiers sont retrouvés automatiquement.
   **Règle de nommage imposée** : à chaque démarrage, un fichier d'espace qui ne s'appelle pas « President | Moi »,
   « President | Équipe | Nom » ou « President | Entreprise | Nom » est renommé (message si le renommage échoue). Un
   fichier créé par l'application et resté sans titre (création interrompue) est repris comme fichier de Moi.
3. Accès limité : l'application ne voit **que les fichiers qu'elle a créés** (ou ouverts avec elle). Les Google
   Sheets de l'ancienne version (avec script) ne sont pas repris automatiquement.

Projet Google Cloud « Mes taches » : API Google Sheets, Drive et Picker activées ; écran d'autorisation avec les accès
`drive.file`, `openid`, `userinfo.email`, `userinfo.profile` ; ID client « Application Web » pour
`https://tmarmed.github.io` (intégré à l'application, voir `mobile/src/config.ts`). Tant que l'application Google est
**en test**, seuls les comptes listés dans « Utilisateurs test » peuvent se connecter.

Onglets de chaque fichier (mêmes colonnes que l'ancienne version ; une colonne ajoutée à la main est gardée, une
colonne manquante est ajoutée à la fin) :
`Taches` (`id | titre | type | date | heure | lieu | description | priorite | statut | cree_le | modifie_le | periodicite | echeance | debut | fin | faits | epic | objectif | domaine | points | iteration | feature | telephone | parent | heure_fin | date_fin | termine_le | statut_avant`),
`Epics` (`id | titre | description | debut | fin | couleur | cree_le | modifie_le | objectif | domaine | etat`),
`Features` (`id | titre | description | epic | pi | iteration | points | couleur | cree_le | modifie_le`),
`ObjectifsPI` (`id | titre | pi | type | valeur_prevue | valeur_obtenue | cree_le | modifie_le | domaine | epic`),
`Objectifs` (`id | titre | description | domaine | debut | fin | couleur | cible | actuel | unite | cree_le | modifie_le`),
`Domaines` (`id | nom | icone | couleur | cree_le | modifie_le | parent`) et `Ignorees` (`id | cle | signature | cree_le | modifie_le`).

Valeurs acceptées dans la feuille si vous saisissez à la main :
`type` = `tache` / `rendez-vous` / `appel` / `demarche` / `mission` / `story` / `exploration` / `bug` ·
`telephone` = numéro d'un appel · `parent` = id de la tâche parente (sous-tâche) · `heure_fin` = `HH:MM`, après `heure` (rendez-vous, mission) · `date_fin` = `AAAA-MM-JJ`, date limite d'une démarche · `termine_le`, `statut_avant` = remplis par l'application (ne pas saisir) · `priorite` = `basse` / `normale` / `haute` ·
`statut` = `a_faire` / `en_cours` / `termine` · `date` = `AAAA-MM-JJ` · `heure` = `HH:MM` ·
`periodicite` = vide / `hebdomadaire` / `mensuelle` / `trimestrielle` / `annuelle` ·
`echeance` = semaine `1` (lundi) à `7`, mois `1` à `31`, trimestre `m` ou `m-j`, année `MM` ou `MM-JJ`
(vide = « dans la période ») · `debut` / `fin` = `AAAA-MM-JJ` · `faits` = périodes cochées,
ex. `2026-08;2026-09` (mois), `2026-T3` (trimestre), `2026` (année), `2026-09-21` (semaine du lundi 21) ·
`feature` / `epic` / `objectif` / `domaine` = `id` du rattachement (un seul, le plus précis) ·
`points` = nombre · `iteration` = `2026-T4-IT3` ou `2026-T4-IP`. Epics : `etat` = `idee` / `analyse` / `pret` /
`en_cours` / `termine` (vide = déduit des dates ; la fiche n'enregistre un état que s'il a été choisi à la main). Features : `pi` = `2026-T4`. ObjectifsPI : `type` = `engage` /
`bonus`, valeurs de 0 à 10. Epics : `couleur` = `#RRGGBB`, `fin` vide = epic sans fin.
Chaque ligne doit avoir un `id` unique : le plus simple est de créer les lignes depuis l'application.

## 2. Lancer l'application

Prérequis : Node.js 20+ et l'app **Expo Go** sur le téléphone (App Store / Play Store).

```bash
cd mobile
npm install
npx expo start
```

Scannez le QR code avec l'appareil photo (iPhone) ou avec Expo Go (Android).
Expo Go fonctionne avec la clé d'accès ; la connexion Google demande une version de développement
(voir le guide ci-dessus).
Au premier lancement, collez l'**URL** et la **clé d'accès**, puis *Se connecter*.

### Version web (PC, Mac, tablette)

La même application fonctionne dans un navigateur (connexion par clé d'accès).

**En ligne : <https://tmarmed.github.io/Default/>** — publiée automatiquement par GitHub Pages
à chaque modification (voir [`.github/workflows/publier-web.yml`](.github/workflows/publier-web.yml)).

**Autre hébergement possible, Netlify, mis à jour automatiquement :**
1. Créez un compte sur <https://app.netlify.com> (gratuit).
2. **Add new site › Import an existing project › GitHub** et choisissez ce dépôt et la branche.
   Le fichier [`netlify.toml`](netlify.toml) règle tout (compilation dans `mobile`, dossier `dist`).
3. Netlify donne une adresse `https://….netlify.app`. Chaque modification poussée sur GitHub
   est republiée toute seule.

**Ou à la main (Netlify Drop) :** `cd mobile && npx expo export --platform web --clear`, puis
glissez le dossier `mobile/dist` sur <https://app.netlify.com/drop>.

Sur le PC, dans Edge : **⋯ › Applications › Installer ce site en tant qu'application** (icône dans le
menu Démarrer). Dans Chrome : **⋯ › Caster, enregistrer et partager › Installer la page en tant
qu'application**.

Démo sans Google Sheet (données d'exemple) :
`EXPO_PUBLIC_DEMO=1 npx expo export --platform web --clear`

## 3. Installer l'application pour de bon (App Store / Play Store ou installation directe)

Avec [EAS Build](https://docs.expo.dev/build/introduction/) (compilation dans le cloud, pas besoin de Mac pour Android) :

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android   # fichier .apk / .aab
npx eas-cli@latest build --platform ios       # nécessite un compte Apple Developer
```

Les identifiants d'application sont `com.mestaches.app` (dans `mobile/app.json`) : changez-les
pour les vôtres avant de publier.

## Vérifications

```bash
cd mobile
npx tsc --noEmit
npm run verif:alertes   # « Ignorer » ne dépend pas de l'affichage
npm run verif:sheets    # connexion Google directe, avec un faux Google en mémoire
```
