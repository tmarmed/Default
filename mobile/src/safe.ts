import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext } from 'react';
import type { Epic, EtatEpic } from './types';

/** Réglages SAFe, gardés sur l'appareil. */
export interface SafeSettings {
  /** Mode SAFe (5 onglets) ou Simple (Tâches + Roadmap) */
  actif: boolean;
  /** Capacité par itération, en points */
  capacite: number;
  /** Afficher les points comme des jours */
  pointsJours: boolean;
}

export const SAFE_DEFAUT: SafeSettings = { actif: false, capacite: 10, pointsJours: true };
const KEY = 'mes-taches:safe';

export async function loadSafe(): Promise<SafeSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...SAFE_DEFAUT, ...JSON.parse(raw) } : SAFE_DEFAUT;
  } catch {
    return SAFE_DEFAUT;
  }
}

export async function saveSafe(s: SafeSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Stockage indisponible : réglage gardé le temps de la session.
  }
}

export const SafeContext = createContext<SafeSettings>(SAFE_DEFAUT);
export const useSafe = () => useContext(SafeContext);

/** État d'une epic ; s'il n'a pas été choisi, il est déduit des dates. */
export function etatEpic(e: Pick<Epic, 'etat' | 'debut' | 'fin'>, today: string): EtatEpic {
  if (e.etat) return e.etat;
  if (e.fin && e.fin < today) return 'termine';
  if (e.debut > today) return 'pret';
  return 'en_cours';
}
