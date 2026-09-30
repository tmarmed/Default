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

// ---------------------------------------------------------------------------
// Missions dans votre Google Sheet (espace Équipe « President ») : lot = epic, étape = feature, rien en dessous.
// Retrouvées par leur titre (« Lot 4 · … », étape sans « ✓ ») ; seuls titre, description et état sont réécrits :
// dates, priorité et tout ce que vous ajoutez restent tels quels.
// ---------------------------------------------------------------------------
export const NOM_ESPACE_MISSIONS = 'President';
const COULEURS_LOTS = ['#1A73E8', '#188038', '#8E24AA', '#E37400', '#00897B', '#C2185B', '#795548'];
export const couleurLot = (n: number) => COULEURS_LOTS[(n - 1) % COULEURS_LOTS.length];

type EpicLu = { id: string; titre: string; description: string; etat: string; espace?: string };
type FeatureLue = { id: string; titre: string; description: string; epic: string; espace?: string };

const prefixeLot = (n: number) => `Lot ${n} · `;
const sansCoche = (t: string) => t.replace(/^✓\s*/, '').trim();

function etatEpicDe(l: LotFil): string {
  const a = avancementLot(l);
  if (a.faites === a.total) return 'termine';
  if (a.faites > 0) return 'en_cours';
  return /DÉCIDÉ/.test(l.etat) ? 'pret' : 'idee';
}
function voulueEpic(l: LotFil) {
  const a = avancementLot(l);
  return {
    titre: `${prefixeLot(l.num)}${l.titre}`,
    description: `Mission ${l.num} · ${l.etat} · ${a.faites}/${a.total} étapes (publiée par Claude, fil d'échange)`,
    etat: etatEpicDe(l),
  };
}
const voulueFeature = (e: EtapeFil) => ({ titre: `${e.fait ? '✓ ' : ''}${e.titre}`, description: e.fait ? 'Étape terminée' : 'Étape à faire' });

export const epicDuLot = <T extends EpicLu>(l: LotFil, epics: T[]): T | undefined => epics.find((e) => e.titre.startsWith(prefixeLot(l.num)));
export const featureDeEtape = <T extends FeatureLue>(e: EtapeFil, epicId: string, features: T[]): T | undefined =>
  features.find((f) => f.epic === epicId && sansCoche(f.titre) === e.titre);

/** Changement à écrire pour l'epic d'un lot : null s'il est déjà à jour */
export function changementEpic(l: LotFil, existante: EpicLu | undefined): Record<string, string> | null {
  const v = voulueEpic(l);
  if (!existante) return { ...v, couleur: couleurLot(l.num) };
  const patch = Object.fromEntries(Object.entries(v).filter(([k, x]) => (existante as Record<string, unknown>)[k] !== x));
  return Object.keys(patch).length ? patch : null;
}
export function changementFeature(e: EtapeFil, existante: FeatureLue | undefined): Record<string, string> | null {
  const v = voulueFeature(e);
  if (!existante) return v;
  const patch = Object.fromEntries(Object.entries(v).filter(([k, x]) => (existante as Record<string, unknown>)[k] !== x));
  return Object.keys(patch).length ? patch : null;
}

/** Nombre de changements à écrire dans l'espace (epics et features manquantes ou différentes) */
export function compterChangements(epics: EpicLu[], features: FeatureLue[], f: Fil = FIL): number {
  let n = 0;
  for (const l of f.lots) {
    const ep = epicDuLot(l, epics);
    if (changementEpic(l, ep)) n++;
    for (const e of l.etapes) if (changementFeature(e, ep ? featureDeEtape(e, ep.id, features) : undefined)) n++;
  }
  return n;
}
