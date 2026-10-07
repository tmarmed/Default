import type { PointReunion, Reunion } from './types';

/**
 * Ligne d'état d'une réunion (07/10) : une ligne `etat` de PointsReunion, écrite par l'animateur seulement, relue par
 * les participants. Elle dit si la réunion est lancée (de l'ouverture par l'animateur jusqu'à l'envoi du compte
 * rendu, sans condition d'horaire), où en est l'animateur (étape, élément) et l'état du vote.
 * - `v` augmente à chaque écriture : un participant ne change son écran que si `v` a changé ;
 * - relecture toutes les 10 s pendant un vote, 15 s sinon, en pause quand l'application n'est pas à l'écran
 *   (`intervalleRelecture`) ; « ↻ Actualiser » en plus ;
 * - live seulement à plusieurs (`avecLive`) : seul, ni ligne d'état ni relecture.
 */
export interface VoteEtat {
  /** Vote ouvert (sinon : fermé, ou révélé si `revele`) */
  ouvert: boolean;
  revele: boolean;
  tour: number;
  /** Éléments soumis au vote (ids de stories, d'idées…) */
  elements: string[];
}
export interface EtatReunion {
  v: number;
  /** Lancée le (ISO) */
  lance: string;
  /** Terminée le (ISO) : compte rendu envoyé */
  fin?: string;
  /** Animateur (e-mail) */
  anim: string;
  /** Onglet et étape de l'animateur (clé et libellé) */
  etape: string;
  libelle: string;
  /** Élément en cours (membre du tour de table, story…) et son libellé */
  element?: string;
  detail?: string;
  vote?: VoteEtat;
}

/** Ligne d'état d'une réunion parmi des points lus (la plus récente si plusieurs) */
export function ligneEtat(points: PointReunion[], reunionId: string): PointReunion | undefined {
  return points.filter((p) => p.type === 'etat' && p.reunion === reunionId).sort((a, b) => b.cree_le.localeCompare(a.cree_le))[0];
}
export function lireEtat(p: Pick<PointReunion, 'texte'> | undefined): EtatReunion | null {
  if (!p) return null;
  try {
    const e = JSON.parse(p.texte) as EtatReunion;
    return e && typeof e.v === 'number' ? e : null;
  } catch {
    return null;
  }
}
export const etatDe = (points: PointReunion[], reunionId: string) => lireEtat(ligneEtat(points, reunionId));
/** Lancée : ouverte par l'animateur, compte rendu pas encore envoyé (sans condition d'horaire) */
export const estLancee = (e: EtatReunion | null) => !!e && !!e.lance && !e.fin;
/** Live seulement à plusieurs : au moins un autre participant que vous */
export const avecLive = (nbParticipants: number) => nbParticipants > 1;
/** Relecture : 10 s pendant un vote ouvert, 15 s sinon */
export const intervalleRelecture = (e: EtatReunion | null) => (e?.vote?.ouvert ? 10_000 : 15_000);

/** Point à écrire pour une ligne d'état */
export function pointEtat(r: Pick<Reunion, 'id'>, anim: string, e: EtatReunion): Omit<PointReunion, 'id' | 'cree_le'> {
  return {
    reunion: r.id,
    personne: anim.toLowerCase(),
    auteur: anim.toLowerCase(),
    type: 'etat',
    texte: JSON.stringify(e),
    element: '',
    concretisation: '',
    tache: '',
    responsable: '',
  };
}

/** Texte du bandeau « En direct » : « Nina anime · Tour de table · Tom » */
export const texteDirect = (e: EtatReunion, prenomAnim: string) => [`${prenomAnim} anime`, e.libelle, e.detail].filter(Boolean).join(' · ');

/** Données propres à une réunion (ligne `donnee`) : `k` dit de quoi il s'agit (absence, stories, idée…) */
export function lireDonnee<T = Record<string, unknown>>(p: Pick<PointReunion, 'texte'>): (T & { k: string }) | null {
  try {
    const d = JSON.parse(p.texte);
    return d && typeof d.k === 'string' ? d : null;
  } catch {
    return null;
  }
}
/** Vote d'une personne (ligne `vote`) : élément, valeur, tour */
export interface Vote {
  el: string;
  val: string;
  tour: number;
}
export function lireVote(p: Pick<PointReunion, 'texte'>): Vote | null {
  try {
    const v = JSON.parse(p.texte) as Vote;
    return v && typeof v.el === 'string' ? v : null;
  } catch {
    return null;
  }
}
