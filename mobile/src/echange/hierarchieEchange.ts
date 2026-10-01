import { ICONE_ORG, membresDe, type OrgValue } from '../organisation';

/**
 * Échanges et hiérarchie (lot 21) : un échange entre personnes d'une entreprise vit à un **niveau** de
 * l'Organisation — équipe agile, train (équipe englobante du delivery), portfolio, ou unité (service, direction).
 * - à la création : le niveau le plus proche commun aux deux personnes (même équipe, sinon même train, sinon même
 *   portfolio, sinon l'unité commune la plus basse) ;
 * - « Escalader » : l'échange monte d'un niveau et part au responsable du niveau au-dessus (équipe → RTE du train →
 *   Epic Owner du portfolio ; unité → responsable de l'unité parente) ;
 * - « Transmettre » : à une personne de l'équipe actuelle, du train englobant, de l'unité parente ou d'une équipe
 *   partenaire (même train, ou autre train).
 * Niveau noté « kind:id » (ex. « equipeagile:acmeqmob »), vide hors entreprise.
 */
export type KindNiveau = 'equipeagile' | 'train' | 'portfolio' | 'unite';
export interface Niveau {
  kind: KindNiveau;
  id: string;
}
export const lireNiveau = (v: string | undefined): Niveau | null => {
  const [kind, id] = (v ?? '').split(':');
  return id && ['equipeagile', 'train', 'portfolio', 'unite'].includes(kind) ? { kind: kind as KindNiveau, id } : null;
};
export const ecrireNiveau = (n: Niveau | null) => (n ? `${n.kind}:${n.id}` : '');

/** Personne de l'Organisation d'après son e-mail */
export const personneParEmail = (email: string, org: OrgValue) => org.personnes.find((p) => p.email && p.email.toLowerCase() === email.toLowerCase());

/** Équipes d'une personne (membre, PO ou SM) */
const equipesDe = (pid: string, org: OrgValue) => org.equipes.filter((e) => e.po === pid || e.sm === pid || membresDe(e).includes(pid));
/** Trains d'une personne (par ses équipes, ou RTE / PM) */
const trainsDe = (pid: string, org: OrgValue) => {
  const ids = new Set([...equipesDe(pid, org).map((e) => e.train), ...org.trains.filter((t) => t.rte === pid || t.pm === pid).map((t) => t.id)]);
  return org.trains.filter((t) => ids.has(t.id));
};
const portfoliosDe = (pid: string, org: OrgValue) => {
  const ids = new Set([...trainsDe(pid, org).map((t) => t.portfolio), ...org.portfolios.filter((p) => p.epic_owner === pid).map((p) => p.id)]);
  return org.portfolios.filter((p) => ids.has(p.id));
};
/** Unité d'une personne puis ses unités parentes (de bas en haut) */
const unitesDe = (pid: string, org: OrgValue) => {
  const out: string[] = [];
  for (let u = org.personne.get(pid)?.unite ?? '', n = 0; u && n < 30; u = org.unite.get(u)?.parent ?? '', n++) out.push(u);
  return out;
};

/** Niveau le plus proche commun à deux personnes (ids de l'Organisation) */
export function niveauCommun(a: string, b: string, org: OrgValue): Niveau | null {
  const eqB = new Set(equipesDe(b, org).map((e) => e.id));
  const eq = equipesDe(a, org).find((e) => eqB.has(e.id));
  if (eq) return { kind: 'equipeagile', id: eq.id };
  const trB = new Set(trainsDe(b, org).map((t) => t.id));
  const tr = trainsDe(a, org).find((t) => trB.has(t.id));
  if (tr) return { kind: 'train', id: tr.id };
  const pfB = new Set(portfoliosDe(b, org).map((p) => p.id));
  const pf = portfoliosDe(a, org).find((p) => pfB.has(p.id));
  if (pf) return { kind: 'portfolio', id: pf.id };
  const uB = new Set(unitesDe(b, org));
  const u = unitesDe(a, org).find((x) => uB.has(x));
  return u ? { kind: 'unite', id: u } : null;
}

/** Niveau au-dessus et son responsable (à qui part l'échange escaladé) */
export function niveauSuperieur(n: Niveau | null, org: OrgValue): { niveau: Niveau; responsable: string } | null {
  if (!n) return null;
  if (n.kind === 'equipeagile') {
    const t = org.train.get(org.equipe.get(n.id)?.train ?? '');
    const r = t?.rte || t?.pm;
    return t && r ? { niveau: { kind: 'train', id: t.id }, responsable: r } : null;
  }
  if (n.kind === 'train') {
    const p = org.portfolio.get(org.train.get(n.id)?.portfolio ?? '');
    return p?.epic_owner ? { niveau: { kind: 'portfolio', id: p.id }, responsable: p.epic_owner } : null;
  }
  if (n.kind === 'unite') {
    const parent = org.unite.get(org.unite.get(n.id)?.parent ?? '');
    return parent?.responsable ? { niveau: { kind: 'unite', id: parent.id }, responsable: parent.responsable } : null;
  }
  return null;
}

/** « 👥 Mobile », « 🚆 Clients », « 💼 Digital », « 🏛️ Développement » */
export function libelleNiveau(n: Niveau | null, org: OrgValue): string {
  if (!n) return '';
  const nom =
    n.kind === 'equipeagile' ? org.equipe.get(n.id)?.nom : n.kind === 'train' ? org.train.get(n.id)?.nom : n.kind === 'portfolio' ? org.portfolio.get(n.id)?.nom : org.unite.get(n.id)?.nom;
  return nom ? `${ICONE_ORG[n.kind]} ${nom}` : '';
}

/** Niveau d'une personne pour un échange transmis (son équipe, sinon son train, sinon son unité) */
export function niveauDe(pid: string, org: OrgValue): Niveau | null {
  const eq = equipesDe(pid, org)[0];
  if (eq) return { kind: 'equipeagile', id: eq.id };
  const tr = trainsDe(pid, org)[0];
  if (tr) return { kind: 'train', id: tr.id };
  const u = org.personne.get(pid)?.unite;
  return u ? { kind: 'unite', id: u } : null;
}

/**
 * Personnes à qui transmettre un échange (e-mails) : seulement **votre** équipe (décidé 01/10), jamais une autre
 * équipe (un SM ne passe pas à un autre SM). Les équipes au-dessus sont calculées depuis les rôles de l'Organisation,
 * rien n'est créé en plus dans le Sheet : un membre transmet dans son équipe ; le SM ou le PO l'affecte à un membre de
 * son équipe ; le RTE / PM (équipe du train = SM et PO de ses équipes) l'affecte au SM ou au PO d'une équipe ;
 * l'Epic Owner (équipe du portfolio) au RTE d'un train. Hors delivery : votre unité. Sans `exclure` (vous et l'auteur).
 */
export function destinatairesTransfert(moi: string, _niveau: Niveau | null, org: OrgValue, exclure: string[]): { titre: string; emails: string[] }[] {
  const pid = personneParEmail(moi, org)?.id ?? '';
  if (!pid) return [];
  const email = (id: string) => org.personne.get(id)?.email?.toLowerCase() ?? '';
  const sans = new Set(exclure.map((x) => x.toLowerCase()));
  const vus = new Set<string>();
  const groupe = (titre: string, ids: string[]) => {
    const emails = [...new Set(ids.map(email))].filter((e) => e && !sans.has(e) && !vus.has(e));
    emails.forEach((e) => vus.add(e));
    return { titre, emails };
  };
  // Vos équipes agiles (membre, SM ou PO)
  const equipes = equipesDe(pid, org).map((e) => groupe(`Équipe · ${e.nom}`, [e.sm, e.po, ...membresDe(e)]));
  // Équipe que vous pilotez au-dessus : RTE / PM → SM et PO des équipes du train ; Epic Owner → RTE et PM de ses trains
  const trains = org.trains.filter((t) => t.rte === pid || t.pm === pid).map((t) => groupe(`Équipe du train · ${t.nom}`, [t.rte, t.pm, ...org.equipes.filter((e) => e.train === t.id).flatMap((e) => [e.sm, e.po])]));
  const portfolios = org.portfolios.filter((p) => p.epic_owner === pid).map((p) => groupe(`Équipe du portfolio · ${p.nom}`, [p.epic_owner, ...org.trains.filter((t) => t.portfolio === p.id).flatMap((t) => [t.rte, t.pm])]));
  // Hiérarchie (hors delivery seulement) : votre unité
  const u = equipes.length || trains.length || portfolios.length ? undefined : org.unite.get(org.personne.get(pid)?.unite ?? '');
  const unite = u ? [groupe(`Unité · ${u.nom}`, [u.responsable, ...org.personnes.filter((p) => p.unite === u.id).map((p) => p.id)])] : [];
  return [...equipes, ...trains, ...portfolios, ...unite].filter((g) => g.emails.length);
}

/**
 * Escalade (décidée) : un membre escalade à son Scrum Master ou à son Product Owner (au choix, même équipe) ; le SM
 * ou le PO au RTE du train ; le RTE (ou le PM) à l'Epic Owner du portfolio ; dans la hiérarchie, au responsable de
 * l'unité parente. Renvoie les personnes possibles (ids), avec leur rôle et le niveau où l'échange arrive.
 */
export function ciblesEscalade(moi: string, n: Niveau | null, org: OrgValue): { pid: string; role: string; niveau: Niveau }[] {
  if (!n) return [];
  const sans = (l: { pid: string; role: string; niveau: Niveau }[]) => l.filter((c) => c.pid && c.pid !== moi);
  if (n.kind === 'equipeagile') {
    const eq = org.equipe.get(n.id);
    if (!eq) return [];
    const pilote = eq.sm === moi || eq.po === moi;
    if (!pilote) return sans([{ pid: eq.sm, role: 'Scrum Master', niveau: n }, { pid: eq.po, role: 'Product Owner', niveau: n }]);
    const t = org.train.get(eq.train);
    return t ? sans([{ pid: t.rte || t.pm, role: t.rte ? 'RTE' : 'Product Manager', niveau: { kind: 'train', id: t.id } }]) : [];
  }
  const sup = niveauSuperieur(n, org);
  if (!sup) return [];
  const role = sup.niveau.kind === 'portfolio' ? 'Epic Owner' : sup.niveau.kind === 'unite' ? 'Responsable' : 'RTE';
  return sans([{ pid: sup.responsable, role, niveau: sup.niveau }]);
}
