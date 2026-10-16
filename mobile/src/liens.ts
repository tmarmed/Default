import { type Niveau, niveauSuperieur } from './echange/hierarchieEchange';
import { membresDe, type OrgValue } from './organisation';
import { participantsReunion } from './reunions';
import { reunionDeNiveau } from './suiviEscalade';
import { remplaces } from './transverses';
import { estCommunication, LIBELLE_LIE } from './parentEnfants';
import type { Echange, PointReunion } from './types';

/**
 * Liens entre niveaux (docs/regles-reunions.html bloc 16, lots 2 à 5 du 16/10) : pièce commune des droits et des
 * destinataires (Q1-Q5). Un niveau : équipe, train, portfolio, unité (direction). Rien ici n'appelle Google.
 */

/** Responsables d'un niveau (ids) : équipe PO + Scrum Master ; train PM + RTE ; portfolio Epic Owner ; direction son responsable */
export function responsablesNiveau(n: Niveau | null, org: OrgValue): { contenu: string; deroulement: string; tous: string[] } {
  const r = (contenu = '', deroulement = '') => ({ contenu, deroulement, tous: [...new Set([deroulement, contenu].filter(Boolean))] });
  if (!n) return r();
  if (n.kind === 'equipeagile') {
    const e = org.equipe.get(n.id);
    return r(e?.po, e?.sm);
  }
  if (n.kind === 'train') {
    const t = org.train.get(n.id);
    return r(t?.pm, t?.rte);
  }
  if (n.kind === 'portfolio') {
    const p = org.portfolio.get(n.id);
    return r(p?.epic_owner, p?.epic_owner);
  }
  const u = org.unite.get(n.id);
  return r(u?.responsable, u?.responsable);
}

/** Q5 · Responsable du niveau, ou son suppléant pendant la suppléance */
export function estResponsable(pid: string, n: Niveau | null, org: OrgValue, jour: string): boolean {
  if (!pid) return false;
  const tous = responsablesNiveau(n, org).tous;
  return tous.includes(pid) || remplaces(pid, org, jour).some((x) => tous.includes(x));
}

/** Niveaux du dessous (équipes d'un train, trains d'un portfolio, unités filles d'une direction) */
export function niveauxDessous(n: Niveau | null, org: OrgValue): Niveau[] {
  if (!n) return [];
  if (n.kind === 'train') return org.equipes.filter((e) => e.train === n.id).map((e) => ({ kind: 'equipeagile' as const, id: e.id }));
  if (n.kind === 'portfolio') return org.trains.filter((t) => t.portfolio === n.id).map((t) => ({ kind: 'train' as const, id: t.id }));
  if (n.kind === 'unite') return org.unites.filter((u) => u.parent === n.id).map((u) => ({ kind: 'unite' as const, id: u.id }));
  return [];
}

/** Personnes d'un niveau (ids) : équipe = PO, SM, membres ; sinon les participants de sa réunion régulière */
export function personnesNiveau(n: Niveau | null, org: OrgValue): string[] {
  if (!n) return [];
  if (n.kind === 'equipeagile') {
    const e = org.equipe.get(n.id);
    return e ? [...new Set([e.po, e.sm, ...membresDe(e)].filter(Boolean))] : [];
  }
  const r = reunionDeNiveau(n, org);
  return [...new Set([...responsablesNiveau(n, org).tous, ...(r ? participantsReunion({ type: r.type, niveau: r.niveau }, org) : [])])];
}

/** Personnes de liaison entre un niveau et un niveau du dessous : elles font partie des deux (ex. SM de Mobile à l'ART sync) */
export function personnesLiaison(dessus: Niveau, dessous: Niveau, org: OrgValue): string[] {
  const bas = new Set(personnesNiveau(dessous, org));
  return personnesNiveau(dessus, org).filter((p) => bas.has(p));
}

/** Q1 / Q2 · Escalader : un responsable du niveau (ou son suppléant), jamais au niveau le plus haut */
export function peutEscalader(pid: string, n: Niveau | null, org: OrgValue, jour: string): boolean {
  return !!niveauSuperieur(n, org) && estResponsable(pid, n, org, jour);
}

/**
 * Q1 / Q2 · Communiquer vers un niveau du dessous : le responsable du dessus et la personne de liaison ; sans
 * personne de liaison, n'importe qui du dessus ; jamais au niveau le plus bas (pas de dessous)
 */
export function peutCommuniquer(pid: string, dessus: Niveau | null, dessous: Niveau | null, org: OrgValue, jour: string): boolean {
  if (!dessus || !dessous || !niveauxDessous(dessus, org).some((x) => x.kind === dessous.kind && x.id === dessous.id)) return false;
  if (estResponsable(pid, dessus, org, jour)) return true;
  const liaison = personnesLiaison(dessus, dessous, org);
  return liaison.length ? liaison.includes(pid) : personnesNiveau(dessus, org).includes(pid);
}

/** Q3 · Ce qui est du contenu (PO, PM) ; le reste est du déroulement (Scrum Master, RTE) */
export type SujetLien = 'contenu' | 'deroulement';
export function sujetDe(type: string, texte = ''): SujetLien {
  if (type === 'decision' || type === 'proposition' || /budget|priorit|exigence|périmètre|perimetre|accept/i.test(texte)) return 'contenu';
  return 'deroulement';
}
/** Q3 · À qui l'application envoie en premier : PO / PM pour le contenu, Scrum Master / RTE pour le déroulement */
export function premierDestinataire(n: Niveau | null, org: OrgValue, sujet: SujetLien): string {
  const r = responsablesNiveau(n, org);
  return (sujet === 'contenu' ? r.contenu || r.deroulement : r.deroulement || r.contenu) ?? '';
}

/**
 * R3 · Ce que voit l'envoyeur d'un élément parti au Chat d'un autre : « Reçu · pas encore traité » → « Pris en
 * compte · réponse prévue le 18/10 » → « Suivi à Daily 👥 Mobile » ; '' une fois répondu
 */
export function etatChezReceveur(e: { statut: string; suivi_a?: string; rappel_le?: string }): string {
  if (e.statut !== 'envoye' && e.statut !== 'transmis') return '';
  if (e.suivi_a) return `Suivi à ${e.suivi_a}`;
  if (e.rappel_le) return `Pris en compte · réponse prévue le ${Number(e.rappel_le.slice(8, 10))}/${e.rappel_le.slice(5, 7)}`;
  return 'Reçu · pas encore traité';
}

/**
 * Note liée à un message du Chat (validation du 08/10) : les noms sont visibles, pas le contenu ; le message disparu,
 * la note reste avec « 🔒 Échange privé terminé »
 */
export function lienPrive(p: Pick<PointReunion, 'echange'>, echanges: Echange[], nomDe: (e: string) => string): string {
  if (!p.echange) return '';
  const e = echanges.find((x) => x.id === p.echange);
  // L2 (16/10) : chez l'enfant d'une communication, « lié » sans dire à quoi
  if (e && estCommunication(e)) return LIBELLE_LIE;
  // R3 (16/10) : chez l'envoyeur, où en est celui qui l'a reçu (Reçu · pas encore traité, Pris en compte, Suivi à …)
  return e ? [`🔒 Échange privé · ${nomDe(e.de)} → ${nomDe(e.a)}`, etatChezReceveur(e)].filter(Boolean).join(' · ') : '🔒 Échange privé terminé';
}
