# Mes tâches — application mobile iPhone & Android reliée à Google Sheets

Application pour gérer une liste de **tâches**, **missions** et **rendez-vous**.
Toutes les données sont lues et enregistrées dans un **Google Sheet** (onglet `Taches`),
qu'on peut donc aussi consulter et modifier depuis un ordinateur.

- `mobile/` : l'application (Expo / React Native, un seul code pour iOS et Android)
- `google-apps-script/Code.gs` : la petite API à installer dans le Google Sheet

## Fonctionnalités

- 4 vues : **Liste** (En retard, Aujourd'hui, Demain, dates suivantes, Sans date), **Jour**, **Semaine**, **Mois**
- Glisser le doigt à gauche / à droite pour passer au jour, à la semaine ou au mois suivant / précédent ;
  bouton « Aujourd'hui » pour revenir à la période en cours
- Filtres : Tous / Tâches / Missions / Rendez-vous
- Ajout, modification, suppression ; titre, type, date, heure, lieu, priorité, statut, notes
- Case à cocher pour marquer « terminé » ; les terminés sont masqués (affichables en bas de liste)
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
   `id | titre | type | date | heure | lieu | description | priorite | statut | cree_le | modifie_le`
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

Valeurs acceptées dans la feuille si vous saisissez à la main :
`type` = `tache` / `mission` / `rendez-vous` · `priorite` = `basse` / `normale` / `haute` ·
`statut` = `a_faire` / `en_cours` / `termine` · `date` = `AAAA-MM-JJ` · `heure` = `HH:MM`.
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

### Version web et démo

```bash
cd mobile
npx expo start --web                                   # version web reliée au Google Sheet
EXPO_PUBLIC_DEMO=1 npx expo export --platform web      # démo avec données d'exemple, sans Google Sheet
```

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
