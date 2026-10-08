import { lireNiveau, type Niveau, niveauDe, niveauSuperieur, personneParEmail } from './echange/hierarchieEchange';
import type { OrgValue } from './organisation';
import type { Echange, PointReunion, TypeReunion } from './types';

/**
 * Suivi des escalades (lot 6, deux cas d'usage fixés le 06/10). Le **point de suivi** (ligne de PointsReunion) est le
 * dossier qui reste ; l'**échange** 🔄 Synchro n'est qu'un canal, supprimé une fois pris en compte.
 * - Cas 1, l'escalade commence en réunion ; cas 2, elle commence dans Synchro (« ↪ Faire suivre › Escalader »).
 * - Validation du 08/10 (docs/cycles-de-vie.html) : un seul verbe « Transmettre » (src/echange/transmettre.ts) ; une
 *   note seulement dans la réunion de celui qui transmet et l'a choisi ; rien d'office chez celui qui reçoit ; la
 *   réponse n'est plus recopiée en « Décision » (elle reste privée, le validateur écrit le dernier mot).
 * Tous les points d'une même escalade portent l'id de l'échange (colonne « tache ») : pas de colonne en plus.
 */

/** Marque d'un échange escaladé, en tête de son titre (visible dans Synchro) */
export const MARQUE_ESCALADE = '⤴ ';
export const estEscalade = (e: Pick<Echange, 'titre'>) => e.titre.startsWith(MARQUE_ESCALADE);
export const titreEscalade = (titre: string) => `${MARQUE_ESCALADE}${titre.replace(MARQUE_TRANSMIS, '').replace(MARQUE_ESCALADE, '')}`.slice(0, 200);
/** Marque d'un échange transmis depuis une réunion (« Transmettre à ») : sa réponse revient aussi dans la réunion */
export const MARQUE_TRANSMIS = '↪ ';
export const titreTransmis = (titre: string) => (titre.startsWith(MARQUE_TRANSMIS) ? titre : `${MARQUE_TRANSMIS}${titre}`).slice(0, 200);
/** Échange suivi dans des réunions : escaladé, ou transmis depuis une réunion */
export const estSuiviReunion = (e: Pick<Echange, 'titre'>) => estEscalade(e) || e.titre.startsWith(MARQUE_TRANSMIS);

/** Réunion d'un niveau : où vivent ses points de suivi (série = id sans la date) et dans quel Sheet */
export interface ReunionDeNiveau {
  type: TypeReunion;
  niveau: string;
  espace: string;
  /** Préfixe des ids de la série : « daily-equipeagile:acmeqmob- » */
  serie: string;
}

/**
 * Réunion correspondante d'un niveau : équipe → Daily ; train → ART sync (parties SM et PO) ; portfolio → Revue du
 * portfolio ; unité (hiérarchie) → aucune, l'escalade reste dans Synchro.
 */
export function reunionDeNiveau(n: Niveau | null, org: OrgValue): ReunionDeNiveau | null {
  if (!n) return null;
  const faire = (type: TypeReunion, espace: string | undefined) => {
    const niveau = `${n.kind}:${n.id}`;
    return { type, niveau, espace: espace || 'moi', serie: `${type}-${niveau}-` };
  };
  if (n.kind === 'equipeagile') {
    const e = org.equipe.get(n.id);
    return e ? faire('daily', e.espace) : null;
  }
  if (n.kind === 'train') {
    const t = org.train.get(n.id);
    return t ? faire('art_sync', t.espace) : null;
  }
  if (n.kind === 'portfolio') {
    const p = org.portfolio.get(n.id);
    return p ? faire('revue_portfolio', p.espace) : null;
  }
  return null;
}

/** Niveau de départ d'une personne (e-mail) : son équipe, sinon son train, sinon son unité */
const niveauPersonne = (email: string, org: OrgValue) => {
  const pid = personneParEmail(email, org)?.id;
  return pid ? niveauDe(pid, org) : null;
};
const meme = (a: Niveau | null, b: Niveau | null) => !!a && !!b && a.kind === b.kind && a.id === b.id;

/**
 * Chaîne d'une escalade : les niveaux traversés, de celui de l'auteur de l'échange jusqu'au niveau actuel de
 * l'échange (bas en haut), et leurs réunions correspondantes (sans doublon, sans niveau sans réunion).
 */
export function chaineEscalade(e: Pick<Echange, 'de' | 'niveau' | 'transmis_par'>, org: OrgValue): ReunionDeNiveau[] {
  const haut = lireNiveau(e.niveau);
  const depart = niveauPersonne(e.de, org) ?? niveauPersonne(e.transmis_par, org);
  const niveaux: Niveau[] = [];
  for (let n = depart, k = 0; n && k < 10; n = niveauSuperieur(n, org)?.niveau ?? null, k++) {
    niveaux.push(n);
    if (meme(n, haut)) break;
  }
  if (haut && !niveaux.some((n) => meme(n, haut))) niveaux.push(haut);
  const vues = new Set<string>();
  return niveaux
    .map((n) => reunionDeNiveau(n, org))
    .filter((r): r is ReunionDeNiveau => !!r && !vues.has(r.serie) && !!vues.add(r.serie));
}

/** Point à créer, avec le Sheet où l'écrire */
export type PointAEcrire = Omit<PointReunion, 'id' | 'cree_le'> & { espace: string };

/**
 * Escalade d'un échange (cas 2, et chaque nouvelle escalade du cas 1) : `par` (e-mail) l'envoie à `vers` (e-mail),
 * l'échange passe du niveau `avant` à `apres`. Points de suivi créés le jour `jour` (AAAA-MM-JJ) :
 * - dans la réunion du niveau `avant` (celle de celui qui escalade) : « escaladé », responsable = `vers` ;
 * - dans la réunion du niveau `apres` (celle de celui qui reçoit) : « Escalade reçue », à concrétiser.
 * `dejaNote` : le point « escaladé » existe déjà (escalade décidée en réunion, cas 1).
 */
export function pointsEscalade(o: {
  echange: Pick<Echange, 'id' | 'titre' | 'texte' | 'element'>;
  par: string;
  vers: string;
  avant: Niveau | null;
  apres: Niveau | null;
  jour: string;
  org: OrgValue;
  dejaNote?: boolean;
}): PointAEcrire[] {
  const texte = (o.echange.titre.replace(MARQUE_ESCALADE, '').replace(MARQUE_TRANSMIS, '').replace(/^Blocage · /, '') || o.echange.texte).slice(0, 300);
  const base = { type: 'blocage' as const, texte, element: o.echange.element, tache: o.echange.id, echange: o.echange.id, personne: o.par.toLowerCase(), auteur: o.par.toLowerCase() };
  const out: PointAEcrire[] = [];
  const bas = reunionDeNiveau(o.avant, o.org);
  const recu = reunionDeNiveau(o.apres, o.org);
  if (bas && !o.dejaNote && bas.serie !== recu?.serie)
    out.push({ ...base, reunion: `${bas.serie}${o.jour}`, concretisation: 'escalade', responsable: o.vers.toLowerCase(), espace: bas.espace });
  // Plus de note créée d'office chez celui qui reçoit (validation du 08/10) : il choisit « 📌 Suivre en réunion »
  return out;
}


/** Regroupe des points à écrire par Sheet : une écriture par espace */
export function parEspace(l: PointAEcrire[]): Map<string, Omit<PointReunion, 'id' | 'cree_le'>[]> {
  const m = new Map<string, Omit<PointReunion, 'id' | 'cree_le'>[]>();
  for (const { espace, ...p } of l) m.set(espace, [...(m.get(espace) ?? []), p]);
  return m;
}

/**
 * Notes à concrétiser (validation du 08/10) : toute note d'une réunion précédente de la série pas encore concrétisée
 * (« plus tard » = ne pas concrétiser), transmis reçus compris ; elles reviennent à la Situation et à la Concrétisation.
 */
export const aReprendre = (points: PointReunion[], reunionId: string) => {
  const serie = reunionId.slice(0, -10);
  return points.filter((p) => p.reunion.startsWith(serie) && p.reunion < reunionId && !p.concretisation);
};
