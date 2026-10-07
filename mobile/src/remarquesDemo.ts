import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Remarques de la démo (07/10) : en version démo seulement, on regarde l'application et on note une remarque sur
 * l'écran affiché ; l'écran, la fenêtre ouverte et l'étape sont pris automatiquement. Rangées dans l'appareil
 * (jamais dans un Sheet), puis « Copier le compte rendu » pour l'envoyer à Claude Code.
 * Contexte : l'onglet de l'application (`poserEcran`), puis la pile des fenêtres ouvertes (chaque FormSheet visible
 * s'y ajoute avec son titre, et l'étape d'une réunion avec `contexte`).
 */

export interface Remarque {
  id: string;
  /** ISO */
  quand: string;
  ecran: string;
  /** Fenêtres ouvertes, de la plus basse à celle du dessus (« Daily · Mobile ») */
  fenetre: string;
  /** Étape ou détail de la fenêtre du dessus (« Mon point · étape 2 sur 3 : Aujourd'hui ») */
  etape: string;
  texte: string;
}

const CLE = 'president:demo-remarques';
let ecran = '';
let suivant = 1;
const couches: { id: number; libelle: string; detail: string }[] = [];

export const poserEcran = (libelle: string) => void (ecran = libelle);
/** Fenêtre visible : elle s'ajoute en haut de la pile ; renvoie de quoi la mettre à jour ou la retirer */
export function ouvrirCouche(libelle: string, detail = '') {
  const id = suivant++;
  couches.push({ id, libelle, detail });
  return {
    maj: (l: string, d = '') => {
      const c = couches.find((x) => x.id === id);
      if (c) Object.assign(c, { libelle: l, detail: d });
    },
    fermer: () => {
      const i = couches.findIndex((x) => x.id === id);
      if (i >= 0) couches.splice(i, 1);
    },
  };
}
/** Écran, fenêtres et étape au moment où l'on note */
export function contexteActuel() {
  const haut = couches[couches.length - 1];
  return { ecran, fenetre: couches.map((c) => c.libelle).filter(Boolean).join(' › '), etape: haut?.detail ?? '' };
}

export async function lireRemarques(): Promise<Remarque[]> {
  try {
    const l = JSON.parse((await AsyncStorage.getItem(CLE)) || '[]');
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}
export const ecrireRemarques = (l: Remarque[]) => AsyncStorage.setItem(CLE, JSON.stringify(l)).catch(() => {});

const heure = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/** Compte rendu à coller dans Claude Code : regroupé par écran, dans l'ordre de la visite */
export function compteRenduRemarques(l: Remarque[]): string {
  if (!l.length) return '';
  const lignes = [`# Remarques sur la démo President (${l.length})`, ''];
  let groupe = '';
  for (const r of l) {
    const g = [r.ecran, r.fenetre].filter(Boolean).join(' › ') || 'Écran inconnu';
    if (g !== groupe) {
      lignes.push(`## ${g}`);
      groupe = g;
    }
    lignes.push(`- ${r.etape ? `[${r.etape}] ` : ''}${r.texte.trim().replace(/\n+/g, ' / ')} _(${heure(r.quand)})_`);
  }
  return lignes.join('\n');
}
