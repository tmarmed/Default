// Complète app.json selon l'environnement de compilation.
module.exports = ({ config }) => {
  let result = config;

  // Version web publiée dans un sous-dossier (ex. GitHub Pages : /Default).
  const baseUrl = process.env.EXPO_BASE_URL;
  if (baseUrl) {
    result = { ...result, experiments: { ...result.experiments, baseUrl } };
  }

  // Connexion Google quand l'ID client iOS est renseigné (.env).
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (iosClientId) {
    // « 1234-abc.apps.googleusercontent.com » → « com.googleusercontent.apps.1234-abc »
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
    result = {
      ...result,
      plugins: [...(result.plugins ?? []), ['@react-native-google-signin/google-signin', { iosUrlScheme }]],
    };
  }

  return result;
};
