import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import donnees from './fil.json';

/**
 * 💬 Échange (lot 20) : le fil d'échange avec Claude, dans President.
 * - les missions sont suivies comme des epics : lot = epic, étape = feature, point de validation = story ;
 * - lots, étapes et points sont publiés par Claude avec l'application (fil.json, lecture seule) ;
 * - seules vos réponses se saisissent ; elles restent sur l'appareil jusqu'à « 📋 Copier et vider ».
 */

export interface EtapeFil {
  id: string;
  titre: string;
  fait: boolean;
}
export interface LotFil {
  num: number;
  titre: string;
  etat: string;
  etapes: EtapeFil[];
}
export interface PointFil {
  id: string;
  espace: 'projet' | 'format';
  lot: number | null;
  etape: string | null;
  titre: string;
  statut: 'a_valider' | 'tranche';
  objectif?: string;
  explication?: string;
  decision?: string;
  images?: { src: string; label: string }[];
  lien?: { url: string; label: string };
  options?: { id: string; label: string }[];
}
export interface Fil {
  maj: string;
  lots: LotFil[];
  points: PointFil[];
}

export const FIL = donnees as Fil;

export const ESPACES_FIL = [
  { id: 'projet', titre: 'Projet President' },
  { id: 'format', titre: "Format d'échange" },
] as const;

export const ouvert = (p: PointFil) => p.statut !== 'tranche';
export const pointsOuverts = (f: Fil = FIL) => f.points.filter(ouvert);

/** Avancement d'un lot (epic) : étapes terminées ÷ total */
export function avancementLot(l: LotFil): { faites: number; total: number; ratio: number } {
  const faites = l.etapes.filter((e) => e.fait).length;
  const total = l.etapes.length;
  return { faites, total, ratio: total ? faites / total : 0 };
}

export const lotDe = (p: PointFil, f: Fil = FIL) => (p.lot === null ? undefined : f.lots.find((l) => l.num === p.lot));
export const etapeDe = (p: PointFil, f: Fil = FIL) => lotDe(p, f)?.etapes.find((e) => e.id === p.etape);

/** « Lot 4 › Développement » ou « Format d'échange » */
export function cheminPoint(p: PointFil, f: Fil = FIL): string {
  if (p.espace === 'format') return "Format d'échange";
  const l = lotDe(p, f);
  const e = etapeDe(p, f);
  return [l ? `Lot ${l.num}` : '', e?.titre ?? ''].filter(Boolean).join(' › ');
}

// ---------------------------------------------------------------------------
// Vos réponses (sur l'appareil) : liées à la version du point (titre + statut), vidées après copie
// ---------------------------------------------------------------------------
export interface Reponse {
  choix: string;
  note: string;
  sig: string;
}
const REPONSES_KEY = 'president:echange-reponses';
export const signature = (p: PointFil) => `${p.titre}|${p.statut}`;

export async function chargerReponses(): Promise<Record<string, Reponse>> {
  try {
    const raw = await AsyncStorage.getItem(REPONSES_KEY);
    const r: Record<string, Reponse> = raw ? JSON.parse(raw) : {};
    // Une réponse à une ancienne version d'un point n'est pas recopiée
    const actuels = new Map(FIL.points.map((p) => [p.id, signature(p)]));
    return Object.fromEntries(Object.entries(r).filter(([id, x]) => actuels.get(id) === x.sig));
  } catch {
    return {};
  }
}
export async function enregistrerReponses(r: Record<string, Reponse>) {
  try {
    await AsyncStorage.setItem(REPONSES_KEY, JSON.stringify(r));
  } catch {
    /* appareil sans stockage : les réponses restent en mémoire */
  }
}

export const LIBELLE_CHOIX: Record<string, string> = { valide: 'Validé', revoir: 'À revoir' };

/** Texte à coller dans la discussion avec Claude */
export function resumeReponses(r: Record<string, Reponse>, f: Fil = FIL): string {
  const lignes = f.points
    .filter((p) => r[p.id] && (r[p.id].choix || r[p.id].note.trim()))
    .map((p) => {
      const x = r[p.id];
      const choix = p.options?.find((o) => o.id === x.choix)?.label ?? LIBELLE_CHOIX[x.choix] ?? '';
      const espace = p.espace === 'format' ? 'Format' : 'Projet';
      return `${espace} · ${cheminPoint(p, f)} · ${p.titre} : ${[choix, x.note.trim()].filter(Boolean).join(' — ')}`;
    });
  return lignes.length ? [`Réponses du fil d'échange (${lignes.length})`, ...lignes].join('\n') : '';
}

// ---------------------------------------------------------------------------
// Visible seulement pour vous : activé sur l'appareil par votre lien (?echange), jamais par défaut
// ---------------------------------------------------------------------------
const ACTIF_KEY = 'president:echange';

export function useEchangeActif(): boolean {
  const [actif, setActif] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const q = new URLSearchParams(window.location.search);
          if (q.has('echange')) {
            const on = q.get('echange') !== '0';
            await (on ? AsyncStorage.setItem(ACTIF_KEY, '1') : AsyncStorage.removeItem(ACTIF_KEY));
            // Le lien a servi : on l'efface de l'adresse
            q.delete('echange');
            const reste = q.toString();
            window.history.replaceState(null, '', window.location.pathname + (reste ? `?${reste}` : '') + window.location.hash);
          }
        }
        setActif((await AsyncStorage.getItem(ACTIF_KEY)) === '1');
      } catch {
        setActif(false);
      }
    })();
  }, []);
  return actif;
}
