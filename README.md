# Mes tâches — application mobile iPhone & Android reliée à Google Sheets

Application pour gérer une liste de **tâches**, **missions** et **rendez-vous**.
Toutes les données sont lues et enregistrées dans un **Google Sheet** (onglet `Taches`),
qu'on peut donc aussi consulter et modifier depuis un ordinateur.

- `mobile/` : l'application (Expo / React Native, un seul code pour iOS et Android)
- `google-apps-script/Code.gs` : la petite API à installer dans le Google Sheet

## Fonctionnalités

- **8 types**, les mêmes en mode Simple et SAFe : ✓ Tâche, 📅 Rendez-vous, 📞 Appel (numéro + bouton
  **Appeler** dans la fiche et dans la liste), 🗂️ Démarche administrative, 🚩 Mission, 📖 User story,
  🔍 Exploration, 🐞 Bug. Filtre de la liste : « Tous » ou un type (liste déroulante, avec 🔁 Répétés).
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
- **Mode SAFe** (sélecteur *Simple | SAFe* en haut, mémorisé sur l'appareil). Simple = Tâches + Roadmap ;
  SAFe ajoute trois écrans, de l'exécution à la stratégie :
  - **🏃 Itération** : Kanban À faire / En cours / Fait, charge face à la capacité, burndown ;
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
  prévisibilité se calcule alors pour le domaine filtré. Supprimer un domaine ne supprime jamais ses objectifs
  du PI (historique) : ils passent « sans domaine ».
  Dans le tableau du PI, les **tâches hors feature** ont chacune leur ligne (comme les features) avec un
  bloc dans la colonne de leur itération (cocher, ouvrir, groupe repliable). Un **seul « + »** (coin du
  tableau, ou bouton bleu) ouvre une fenêtre : on choisit l'**itération** (ou « Sans itération » pour une
  feature), puis **Nouvelle feature** (epic existante choisie dans la fiche), **Feature existante** (toutes
  les epics, avec recherche), **Nouvelle tâche hors feature** ou **Tâche existante** (sans feature ni date).
  On ne crée pas d'epic depuis le PI. Toucher IT1, IT2… ouvre l'itération. Dans la fiche d'une feature, même nouvelle : **+ Nouvelle tâche**
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
- Tirer vers le bas pour synchroniser avec le Google Sheet
- Dernière copie gardée sur le téléphone : la liste reste lisible sans réseau

## 1. Préparer le Google Sheet (5 minutes)

1. Créez (ou ouvrez) un Google Sheet.
2. Menu **Extensions › Apps Script**. Remplacez le contenu de `Code.gs` par celui de
   [`google-apps-script/Code.gs`](google-apps-script/Code.gs), puis enregistrez.
3. Dans la liste des fonctions, choisissez **`installer`** puis **Exécuter**. Acceptez les autorisations.
   Si l'onglet est vide, 2 exemples sont ajoutés (un rendez-vous et une mission). Un modèle
   à importer est aussi disponible : [`modele/Taches.xlsx`](modele/Taches.xlsx).
   Le **journal d'exécution** affiche la **clé d'accès** : copiez-la.
   L'onglet `Taches` est créé avec les colonnes :
   `id | titre | type | date | heure | lieu | description | priorite | statut | cree_le | modifie_le | periodicite | echeance | debut | fin | faits | epic | objectif | domaine | points | iteration | feature | telephone`
   et les onglets `Epics` (`id | titre | description | debut | fin | couleur | cree_le | modifie_le | objectif | domaine | etat`),
   `Features` (`id | titre | description | epic | pi | iteration | points | couleur | cree_le | modifie_le`),
   `ObjectifsPI` (`id | titre | pi | type | valeur_prevue | valeur_obtenue | cree_le | modifie_le | domaine`),
   `Objectifs` (`id | titre | description | domaine | debut | fin | couleur | cible | actuel | unite | cree_le | modifie_le`)
   et `Domaines` (`id | nom | icone | couleur | cree_le | modifie_le`).
4. **Déployer › Nouveau déploiement** → type **Application Web** :
   - *Exécuter en tant que* : **Moi**
   - *Qui a accès* : **Tout le monde**
5. Copiez l'**URL de l'application Web** (se termine par `/exec`).

> La clé d'accès protège l'API : sans elle, personne ne peut lire ni écrire dans la feuille,
> même avec l'URL. Pour la changer, supprimez la propriété `API_KEY`
> (Paramètres du projet › Propriétés du script) et relancez `installer`.
>
> Après toute modification de `Code.gs`, faites **Déployer › Gérer les déploiements › Modifier ›
> Nouvelle version** pour garder la même URL.

> **Mise à jour depuis une ancienne version** : recollez `Code.gs`, puis **Déployer › Gérer les déploiements
> › Modifier › Nouvelle version**. Les nouvelles colonnes (répétition, epic) sont ajoutées automatiquement
> à la fin de l'onglet `Taches` et l'onglet `Epics` est créé, sans toucher aux données.

Valeurs acceptées dans la feuille si vous saisissez à la main :
`type` = `tache` / `rendez-vous` / `appel` / `demarche` / `mission` / `story` / `exploration` / `bug` ·
`telephone` = numéro d'un appel · `priorite` = `basse` / `normale` / `haute` ·
`statut` = `a_faire` / `en_cours` / `termine` · `date` = `AAAA-MM-JJ` · `heure` = `HH:MM` ·
`periodicite` = vide / `hebdomadaire` / `mensuelle` / `trimestrielle` / `annuelle` ·
`echeance` = semaine `1` (lundi) à `7`, mois `1` à `31`, trimestre `m` ou `m-j`, année `MM` ou `MM-JJ`
(vide = « dans la période ») · `debut` / `fin` = `AAAA-MM-JJ` · `faits` = périodes cochées,
ex. `2026-08;2026-09` (mois), `2026-T3` (trimestre), `2026` (année), `2026-09-21` (semaine du lundi 21) ·
`feature` / `epic` / `objectif` / `domaine` = `id` du rattachement (un seul, le plus précis) ·
`points` = nombre · `iteration` = `2026-T4-IT3` ou `2026-T4-IP`. Epics : `etat` = `idee` / `analyse` / `pret` /
`en_cours` / `termine` (vide = déduit des dates). Features : `pi` = `2026-T4`. ObjectifsPI : `type` = `engage` /
`bonus`, valeurs de 0 à 10. Epics : `couleur` = `#RRGGBB`, `fin` vide = epic sans fin.
Chaque ligne doit avoir un `id` unique : le plus simple est de créer les lignes depuis l'application.

## Connexion avec Google (optionnel)

Pour remplacer l'URL et la clé d'accès par un simple bouton **« Se connecter avec Google »**,
suivez le guide [`docs/connexion-google.md`](docs/connexion-google.md). Seuls les comptes
listés dans l'onglet `Utilisateurs` du Google Sheet peuvent se connecter.

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
```
