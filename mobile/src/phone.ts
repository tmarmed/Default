import { Linking } from 'react-native';

/** Ouvre le téléphone sur ce numéro (appli Téléphone sur mobile, application d'appel sur ordinateur). */
export function callNumber(numero: string) {
  const tel = numero.replace(/[^0-9+]/g, '');
  if (tel) Linking.openURL(`tel:${tel}`).catch(() => {});
}
