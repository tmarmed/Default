# Activer la connexion avec Google

Une fois activée, l'application affiche **« Se connecter avec Google »** : plus d'URL ni de clé
d'accès à saisir. Le script du Google Sheet vérifie auprès de Google l'identité du compte, puis
regarde s'il figure dans l'onglet **`Utilisateurs`**.

Comptez environ 45 minutes la première fois. Tout est gratuit, sauf le compte Apple Developer
nécessaire pour installer l'application sur un iPhone.

> Tant que ces étapes ne sont pas faites, l'application continue de fonctionner avec la clé d'accès
> (et avec Expo Go).

## 1. Déclarer l'application chez Google (Google Cloud Console)

1. Ouvrez <https://console.cloud.google.com/> avec votre compte Google et créez un projet
   (menu en haut › **Nouveau projet**), par exemple « Mes tâches ».
2. **API et services › Écran de consentement OAuth** (ou « Google Auth Platform ») :
   - Type d'utilisateur : **Externe**
   - Nom de l'application : *Mes tâches*, e-mail d'assistance : le vôtre
   - Champs d'application (scopes) : **n'en ajoutez aucun** (nom et e-mail suffisent)
   - **Utilisateurs de test** : ajoutez votre adresse Gmail
3. **API et services › Identifiants › Créer des identifiants › ID client OAuth**, trois fois :

| Type d'application | Réglage | À noter |
|---|---|---|
| **Application Web** | Nom : *Mes tâches web* (rien d'autre à remplir) | l'ID client → **ID client Web** |
| **iOS** | ID du bundle : `com.mestaches.app` | l'ID client → **ID client iOS** |
| **Android** | Nom du package : `com.mestaches.app` + empreinte **SHA-1** (voir étape 5) | rien |

Les ID clients se terminent par `.apps.googleusercontent.com`. Ce ne sont pas des secrets.

## 2. Mettre à jour le script du Google Sheet

1. Dans Apps Script, remplacez le contenu de `Code.gs` par la nouvelle version
   ([`google-apps-script/Code.gs`](../google-apps-script/Code.gs)).
2. En haut du fichier, collez l'**ID client Web** :
   ```js
   var GOOGLE_WEB_CLIENT_ID = '1234-abcd.apps.googleusercontent.com';
   ```
3. Lancez **`installer`**. Google demande une nouvelle autorisation (« se connecter à un service
   externe ») : c'est pour vérifier les connexions auprès de Google. Acceptez.
4. Un onglet **`Utilisateurs`** apparaît avec votre adresse. Pour autoriser quelqu'un d'autre plus
   tard, ajoutez son adresse sur une nouvelle ligne.
5. **Déployer › Gérer les déploiements › ✏️ Modifier › Version : Nouvelle version › Déployer**
   (l'URL `…/exec` ne change pas).

## 3. Renseigner l'application

Dans le dossier `mobile`, copiez `.env.example` en `.env` et remplissez-le (rien de secret dedans ;
gardez-le dans le projet : EAS en a besoin pour compiler) :

```
EXPO_PUBLIC_API_URL=https://script.google.com/macros/s/…/exec
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=….apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=….apps.googleusercontent.com
```

## 4. Compiler l'application pour votre téléphone

La connexion Google ne fonctionne pas dans Expo Go : il faut une **version de développement**,
compilée dans le cloud par EAS (Expo). Elle s'installe une fois ; ensuite les modifications du code
arrivent comme avant avec `npx expo start`.

```bash
cd mobile
npx eas-cli@latest login                     # compte Expo gratuit
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios   # compte Apple Developer requis
```

- **Android** : à la fin, EAS donne un lien / QR code pour installer l'application.
- **iPhone** : enregistrez d'abord votre iPhone avec `npx eas-cli@latest device:create`.

## 5. Empreinte SHA-1 pour Android

Après le premier build Android :

```bash
npx eas-cli@latest credentials --platform android
```

Choisissez le profil `development` et copiez l'empreinte **SHA-1** du keystore. Collez-la dans l'ID
client **Android** (étape 1). Pas besoin de recompiler.

## 6. Première connexion

```bash
cd mobile
npx expo start
```

Ouvrez l'application installée, touchez **Se connecter avec Google**, choisissez votre compte.
La liste s'affiche. Ensuite, l'application reste connectée (Google renouvelle la session tout seul).

La roue ⚙︎ affiche le compte connecté et permet de se déconnecter.

## 7. Désactiver la clé d'accès

Quand la connexion Google fonctionne : Apps Script › **Paramètres du projet › Propriétés du script**
› supprimez `API_KEY`. L'ancienne clé ne marche alors plus du tout.

## En cas de problème

| Message | Cause probable |
|---|---|
| « Le compte … n'est pas autorisé » | L'adresse n'est pas dans l'onglet `Utilisateurs` (vérifiez l'orthographe) |
| « Connexion Google refusée : jeton invalide » | `GOOGLE_WEB_CLIENT_ID` du script différent de `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| « Réponse inattendue du serveur » | Nouvelle version du script non déployée, ou mauvaise URL |
| Android : `DEVELOPER_ERROR` | SHA-1 ou nom de package de l'ID client Android incorrect |
| « Connexion Google impossible : … access_denied » | Votre adresse n'est pas dans les « Utilisateurs de test » de l'écran de consentement |
