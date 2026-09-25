import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

// Web : page en français, sans traduction automatique du navigateur (« Backlog », « SAFe »… restent tels quels).
// Aussi posé dans public/index.html ; ici pour les pages qui n'utilisent pas ce modèle (démo).
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const html = document.documentElement;
  html.lang = 'fr';
  html.setAttribute('translate', 'no');
  html.classList.add('notranslate');
  if (!document.querySelector('meta[name="google"]')) {
    const meta = document.createElement('meta');
    meta.name = 'google';
    meta.content = 'notranslate';
    document.head.appendChild(meta);
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
