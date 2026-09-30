import { createContext, useContext } from 'react';
import { membresDe, type OrgValue, type Personne } from './organisation';

/**
 * Droits d'après les rôles (lot 3, étape 2) — les données d'une équipe restent invisibles (pas de mot « Sheet ») :
 * - opérationnel (dev, testeur, designer…) : voit tout le travail de l'équipe, modifie le sien ;
 * - Scrum Master : tout sur l'équipe (tâches, itérations, capacité, membres, attribution) ;
 * - Product Owner : le backlog (crée, priorise, attribue les stories) ;
 * - manager : lecture ; RTE (et Product Manager) : les features du train, lecture du reste ;
 * - supprimer : le responsable (à défaut du créateur) ou le Scrum Master ;
 * - plusieurs rôles : le plus large gagne ; hors de son équipe : lecture des features et des équipes du train.
 * Sans personne connue (pas d'Organisation, espace Moi) : tous les droits.
 */

export type Metier = 'dev' | 'testeur' | 'designer' | 'analyste' | 'autre';
export const METIERS: { value: Metier; label: string }[] = [
  { value: 'dev', label: 'Dev' },
  { value: 'testeur', label: 'Testeur' },
  { value: 'designer', label: 'Designer' },
  { value: 'analyste', label: 'Analyste' },
  { value: 'autre', label: 'Autre' },
];
export const libelleMetier = (m: string | undefined) => METIERS.find((x) => x.value === m)?.label ?? 'Membre';

/** Personne de l'Organisation qui utilise l'application (null : tous les droits) */
export const MoiContext = createContext<string | null>(null);
export const useMoi = () => useContext(MoiContext);

/** Rôle d'une personne dans une équipe, et ce qu'il permet (texte court sous le membre) */
export function roleDansEquipe(p: Pick<Personne, 'id'> & { metier?: string }, e: { po: string; sm: string }): { role: string; droits: string } {
  if (e.sm === p.id) return { role: 'Scrum Master', droits: 'tout' };
  if (e.po === p.id) return { role: 'Product Owner', droits: 'backlog' };
  return { role: libelleMetier(p.metier), droits: 'son travail' };
}

type Travail = { equipe?: string; responsable?: string; feature?: string };

/** Ce que la personne `moi` peut faire sur une tâche / story */
export function droitsTache(moi: string | null, t: Travail, org: OrgValue): { modifier: boolean; supprimer: boolean; raison?: string } {
  if (!moi || !org.personne.has(moi)) return { modifier: true, supprimer: true };
  const eq = t.equipe ? org.equipe.get(t.equipe) : undefined;
  // Sans équipe : travail personnel ou pas encore rattaché, rien à protéger
  if (!eq) return { modifier: true, supprimer: true };
  const sm = eq.sm === moi;
  const po = eq.po === moi;
  const sien = !!t.responsable && t.responsable === moi;
  const libre = !t.responsable && membresDe(eq).includes(moi);
  const modifier = sm || po || sien || libre;
  const supprimer = sm || sien;
  if (modifier) return { modifier, supprimer };
  return {
    modifier: false,
    supprimer: false,
    raison: '🔒 Lecture seule',
  };
}

/** Ce que la personne `moi` peut faire sur une feature : RTE et Product Manager du train, SM et PO de l'équipe */
export function droitsFeature(moi: string | null, f: { train?: string; equipe?: string }, org: OrgValue): { modifier: boolean; raison?: string } {
  if (!moi || !org.personne.has(moi)) return { modifier: true };
  const train = f.train ? org.train.get(f.train) : undefined;
  const eq = f.equipe ? org.equipe.get(f.equipe) : undefined;
  if (!train && !eq) return { modifier: true };
  if (train && (train.rte === moi || train.pm === moi)) return { modifier: true };
  if (eq && (eq.sm === moi || eq.po === moi)) return { modifier: true };
  return { modifier: false, raison: '🔒 Lecture seule' };
}

/** Libellé court de la personne pour « Voir en tant que » */
export function libelleMoi(id: string, org: OrgValue): string {
  const p = org.personne.get(id) as (Personne & { metier?: string }) | undefined;
  if (!p) return '';
  const roles: string[] = [];
  for (const e of org.equipes) {
    if (e.sm === id) roles.push(`SM ${e.nom}`);
    else if (e.po === id) roles.push(`PO ${e.nom}`);
    else if (membresDe(e).includes(id)) roles.push(`${libelleMetier(p.metier)} ${e.nom}`);
  }
  for (const t of org.trains) {
    if (t.rte === id) roles.push(`RTE ${t.nom}`);
    if (t.pm === id) roles.push(`PM ${t.nom}`);
  }
  if (!roles.length && org.personnes.some((x) => x.manager === id)) roles.push('Manager');
  return roles.join(', ') || 'Sans rôle';
}
