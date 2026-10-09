import { addDays, toDateString } from './dates';
import { aConcretiser, storiesBloquees } from './daily';
import type { HierarchyValue } from './hierarchyContext';
import { membresDe, type OrgValue } from './organisation';
import { iterationOf, iterationOfItem, lireCalendrier, piOf, pointsBruts, pointsOf } from './pi';
import { enRetardSuivi, estFini, statutEffectif } from './pointsSuivi';
import { pointsFaits, velocite } from './reunionsEquipe';
import type { Echange, Epic, Item, PointReunion } from './types';

/**
 * 📊 Pilotage (lot 5, maquette validée le 09/10, docs/maquette-pilotage.html) : calculs purs, sans écriture.
 * Un écran par niveau (équipe, train, portfolio ; 🔒 Moi en mode Simple), proposé selon vos rôles. Point ↔ jour :
 * « 1 point = jpp jour(s) » du calendrier agile (réglé à la main, 1 par défaut) ; capacité d'une équipe = somme de
 * la capacité (en jours par sprint) de ses membres, convertie en points.
 */

export type KindPilotage = 'equipeagile' | 'train' | 'portfolio' | 'perso';
export interface NiveauPilotage {
  kind: KindPilotage;
  id: string;
  nom: string;
  espace: string;
}
type H = Pick<HierarchyValue, 'items' | 'featureList' | 'epicList' | 'objectifList' | 'objectifsPI' | 'resultats' | 'domaineList'>;

/** Niveaux proposés selon vos rôles : vos équipes ; RTE ou PM : le train et ses équipes ; Epic Owner : le portfolio */
export function niveauxDeRoles(org: OrgValue, moi: string, simple: boolean): NiveauPilotage[] {
  if (simple) return [{ kind: 'perso', id: 'moi', nom: '🔒 Moi', espace: 'moi' }];
  const ids = new Set(org.personnes.filter((p) => p.email?.toLowerCase() === moi.toLowerCase()).map((p) => p.id));
  const out: NiveauPilotage[] = [];
  const vus = new Set<string>();
  const ajouter = (n: NiveauPilotage) => !vus.has(`${n.kind}:${n.id}`) && (vus.add(`${n.kind}:${n.id}`), out.push(n));
  for (const p of org.portfolios.filter((x) => ids.has(x.epic_owner))) ajouter({ kind: 'portfolio', id: p.id, nom: `💼 ${p.nom}`, espace: p.espace || 'moi' });
  for (const t of org.trains.filter((x) => ids.has(x.rte) || ids.has(x.pm))) {
    ajouter({ kind: 'train', id: t.id, nom: `🚆 ${t.nom}`, espace: t.espace || 'moi' });
    for (const e of org.equipes.filter((x) => x.train === t.id)) ajouter({ kind: 'equipeagile', id: e.id, nom: `👥 ${e.nom}`, espace: e.espace || 'moi' });
  }
  for (const e of org.equipes.filter((x) => ids.has(x.sm) || ids.has(x.po) || membresDe(x).some((m) => ids.has(m)))) ajouter({ kind: 'equipeagile', id: e.id, nom: `👥 ${e.nom}`, espace: e.espace || 'moi' });
  // Ordre : équipes d'abord (le plus proche), puis train, puis portfolio
  const rang = { equipeagile: 0, train: 1, portfolio: 2, perso: 3 };
  return out.sort((a, b) => rang[a.kind] - rang[b.kind]);
}

/** Calendrier d'une équipe : le sien, sinon celui de son train */
export const calendrierEquipe = (equipeId: string, org: OrgValue) => {
  const e = org.equipe.get(equipeId);
  return lireCalendrier(e?.calendrier || (e?.train ? org.train.get(e.train)?.calendrier : '') || '');
};

/** Capacité d'une équipe par sprint, en points : somme des membres (jours) ÷ jours par point */
export function chargeEquipe(equipeId: string, org: OrgValue, items: Item[], itKey: string) {
  const e = org.equipe.get(equipeId);
  const cal = calendrierEquipe(equipeId, org);
  const jpp = cal.jpp ?? 1;
  const ids = e ? [...new Set([...membresDe(e), e.po, e.sm].filter(Boolean))] : [];
  const sprint = items.filter((t) => !t.parent && t.equipe === equipeId && iterationOfItem(t) === itKey);
  const personnes = ids
    .map((id) => {
      const p = org.personne.get(id);
      const jours = Number(String(p?.capacite ?? '').replace(',', '.')) || 0;
      return { id, nom: p?.nom ?? id, capacite: Math.round((jours / jpp) * 10) / 10, engage: sprint.filter((t) => t.responsable === id).reduce((s, t) => s + pointsOf(t), 0), jours };
    })
    .filter((x) => x.nom);
  return { jpp, capacite: personnes.reduce((s, x) => s + x.capacite, 0), engage: sprint.reduce((s, t) => s + pointsOf(t), 0), personnes, joursParSprint: personnes.reduce((s, x) => s + x.jours, 0) };
}

/** Équipe : sprint en cours, burndown, charge, prévisibilité */
export function piloteEquipe(equipeId: string, org: OrgValue, h: H, points: PointReunion[], echanges: Echange[], today: string) {
  const cal = calendrierEquipe(equipeId, org);
  const it = iterationOf(today, cal);
  const dans = (t: Item) => t.equipe === equipeId;
  const sprint = h.items.filter((t) => !t.parent && dans(t) && iterationOfItem(t) === it.key);
  const prevus = sprint.reduce((s, t) => s + pointsOf(t), 0);
  const faits = sprint.filter((t) => t.statut === 'termine').reduce((s, t) => s + pointsOf(t), 0);
  const bloquees = storiesBloquees(points, h.items, echanges);
  const nbBloquees = sprint.filter((t) => t.type === 'story' && bloquees.has(t.id) && t.statut !== 'termine').length;
  const retard = sprint.filter((t) => t.statut !== 'termine' && !!t.date && t.date < today).length;
  // Burndown : points restants chaque jour du sprint (jusqu'à aujourd'hui), et la droite idéale
  const debut = it.start;
  const fin = it.end;
  const jours: string[] = [];
  for (let d = new Date(`${debut}T12:00`); toDateString(d) <= fin && jours.length < 40; d = addDays(d, 1)) jours.push(toDateString(d));
  const reste = jours.map((j) => (j > today ? null : prevus - sprint.filter((t) => t.statut === 'termine' && !!t.termine_le && t.termine_le <= j).reduce((s, t) => s + pointsOf(t), 0)));
  const ideal = jours.map((_, k) => (jours.length > 1 ? prevus * (1 - k / (jours.length - 1)) : 0));
  const charge = chargeEquipe(equipeId, org, h.items, it.key);
  const v = velocite(h.items, dans, it.key, 3);
  const dernier = v.iterations[v.iterations.length - 1];
  const prevusDernier = dernier ? h.items.filter((t) => !t.parent && dans(t) && iterationOfItem(t) === dernier.key).reduce((s, t) => s + pointsOf(t), 0) : 0;
  const tenu = dernier && prevusDernier ? Math.round((100 * pointsFaits(h.items, dans, dernier.key)) / prevusDernier) : null;
  // Valeur calculée d'après l'historique : jours disponibles ÷ points faits (proposée, jamais imposée)
  const faits3 = v.iterations.reduce((s, x) => s + x.points, 0);
  const nbSprints = v.iterations.filter((x) => x.points > 0).length;
  const jppCalcule = faits3 > 0 && charge.joursParSprint > 0 && nbSprints ? Math.round(((charge.joursParSprint * nbSprints) / faits3) * 10) / 10 : null;
  return { it, prevus, faits, nbBloquees, retard, jours, reste, ideal, charge, velocite: v.moyenne, tenu, jppCalcule };
}

const avancementFeature = (items: Item[], featureId: string) => {
  const st = items.filter((t) => t.feature === featureId && t.type === 'story');
  return st.length ? Math.round((100 * st.filter((t) => t.statut === 'termine').length) / st.length) : 0;
};

/** Train : features et objectifs du PI, charge par équipe, valeur obtenue, risques et dépendances ouverts */
export function piloteTrain(trainId: string, org: OrgValue, h: H, points: PointReunion[], today: string) {
  const t = org.train.get(trainId);
  const cal = lireCalendrier(t?.calendrier || '');
  const pi = piOf(today, cal);
  const it = iterationOf(today, cal);
  const features = h.featureList.filter((f) => (f.train ?? '') === trainId && f.pi === pi).map((f) => ({ f, pct: avancementFeature(h.items, f.id) }));
  const pct = features.length ? Math.round(features.reduce((s, x) => s + x.pct, 0) / features.length) : 0;
  const objectifs = h.objectifsPI.filter((o) => o.pi === pi && (o.espace || 'moi') === (t?.espace || 'moi'));
  const prevue = objectifs.reduce((s, o) => s + (Number(o.valeur_prevue) || 0), 0);
  const obtenue = objectifs.reduce((s, o) => s + (Number(o.valeur_obtenue) || 0), 0);
  const equipes = org.equipes.filter((e) => e.train === trainId).map((e) => ({ e, charge: chargeEquipe(e.id, org, h.items, iterationOf(today, calendrierEquipe(e.id, org)).key), velocite: velocite(h.items, (x) => x.equipe === e.id, iterationOf(today, calendrierEquipe(e.id, org)).key, 3).moyenne }));
  const ouverts = (type: string) => points.filter((p) => p.type === type && p.concretisation !== 'rien' && !estFini(statutEffectif(p, h.items)));
  return { pi, it, features, pct, objectifs, prevue, obtenue, equipes, velocite: equipes.reduce((s, x) => s + x.velocite, 0), risques: ouverts('risque'), dependances: ouverts('dependance') };
}

/** Portfolio : epics par état et leur avancement, OKR et leurs résultats clés */
export function pilotePortfolio(portfolioId: string, org: OrgValue, h: H, today: string) {
  const pf = org.portfolio.get(portfolioId);
  const epics = h.epicList.filter((e) => e.portfolio === portfolioId).map((e) => {
    const fs = h.featureList.filter((f) => f.epic === e.id);
    const st = h.items.filter((t) => t.type === 'story' && fs.some((f) => f.id === t.feature));
    return { e, pct: st.length ? Math.round((100 * st.filter((t) => t.statut === 'termine').length) / st.length) : 0, budget: budgetEpic(e, org, h) };
  });
  const parEtat = (v: string) => epics.filter((x) => (x.e.etat || 'idee') === v).length;
  const okrs = h.objectifList
    .filter((o) => (o.espace || 'moi') === (pf?.espace || 'moi') && h.resultats.some((k) => k.objectif === o.id))
    .map((o) => {
      const krs = h.resultats.filter((k) => k.objectif === o.id);
      const pcts = krs.map((k) => {
        const c = Number(k.cible) || 0;
        return c ? Math.max(0, Math.min(100, Math.round((100 * (Number(k.actuel) || 0)) / c))) : 0;
      });
      return { o, nbKr: krs.length, pct: pcts.length ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length) : 0, clos: !!o.fin && o.fin < today };
    });
  const avecBudget = epics.filter((x) => x.budget.prevu || x.budget.consomme);
  const budget = { prevu: avecBudget.reduce((s, x) => s + x.budget.prevu, 0), consomme: avecBudget.reduce((s, x) => s + x.budget.consomme, 0), epics: avecBudget };
  return { epics, budget, idee: parEtat('idee'), analysePret: parEtat('analyse') + parEtat('pret'), enCours: parEtat('en_cours'), termine: parEtat('termine'), okrs };
}

/** Jours travaillés par an : coût d'une journée = coût annuel ÷ 218 */
export const JOURS_PAR_AN = 218;
const nombre = (v?: string) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0;
export const coutJour = (coutAnnuel?: string) => Math.round(nombre(coutAnnuel) / JOURS_PAR_AN);

/**
 * Consommé d'une epic (09/10), calculé : pour chaque tâche ou story terminée de l'epic (directement ou par sa
 * feature), points × jours par point de l'équipe × coût d'une journée du responsable (son coût annuel ÷ 218).
 * `sansCout` : jours terminés dont le responsable n'a pas de coût annuel (non comptés).
 */
export function consommeCalcule(epicId: string, org: OrgValue, h: Pick<H, 'items' | 'featureList'>) {
  const fs = new Map(h.featureList.filter((f) => f.epic === epicId).map((f) => [f.id, f]));
  let euros = 0;
  let jours = 0;
  let sansCout = 0;
  for (const t of h.items) {
    if (t.parent || t.statut !== 'termine' || !(t.epic === epicId || fs.has(t.feature))) continue;
    const equipe = t.equipe || fs.get(t.feature)?.equipe || '';
    const j = pointsBruts(t) * (equipe ? (calendrierEquipe(equipe, org).jpp ?? 1) : 1);
    const cout = coutJour(org.personne.get(t.responsable ?? '')?.cout_annuel);
    jours += j;
    if (cout) euros += j * cout;
    else sansCout += j;
  }
  return { euros: Math.round(euros), jours: Math.round(jours * 10) / 10, sansCout: Math.round(sansCout * 10) / 10 };
}

/** Budget d'une epic : prévu, consommé (saisi à la main, sinon calculé), reste */
export function budgetEpic(e: Epic, org: OrgValue, h: Pick<H, 'items' | 'featureList'>) {
  const calc = consommeCalcule(e.id, org, h);
  const manuel = (e.consomme ?? '') !== '';
  const consomme = manuel ? nombre(e.consomme) : calc.euros;
  const prevu = nombre(e.budget);
  return { prevu, consomme, manuel, calcule: calc, depasse: prevu > 0 && consomme > prevu };
}

/** « 12 300 € » */
export const euros = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} €`;

/** Compteur court : « 200 k€ » à partir de 10 000 € */
export const eurosCourt = (n: number) => (Math.abs(n) >= 10000 ? `${Math.round(n / 1000).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} k€` : euros(n));

/** Mode Simple (🔒 Moi) : la semaine (heures planifiées / 35 h disponibles), retards, objectifs, domaines délaissés */
export function pilotePerso(h: H, today: string) {
  const d = new Date(`${today}T12:00`);
  const lundi = toDateString(addDays(d, -((d.getDay() + 6) % 7)));
  const vendredi = toDateString(addDays(new Date(`${lundi}T12:00`), 4));
  const taches = h.items.filter((t) => (t.espace || 'moi') === 'moi' && !t.parent && !t.periodicite && t.type !== 'story');
  const duree = (t: Item) => {
    if (t.heure && t.heure_fin) {
      const [a, b] = [t.heure, t.heure_fin].map((x) => Number(x.slice(0, 2)) + Number(x.slice(3)) / 60);
      return Math.max(0.25, b - a);
    }
    return 1;
  };
  const semaine = taches.filter((t) => !!t.date && t.date >= lundi && t.date <= vendredi);
  const planifiees = Math.round(semaine.reduce((s, t) => s + duree(t), 0) * 10) / 10;
  const parJour = Array.from({ length: 5 }, (_, k) => {
    const j = toDateString(addDays(new Date(`${lundi}T12:00`), k));
    return { j, h: Math.round(semaine.filter((t) => t.date === j).reduce((s, t) => s + duree(t), 0) * 10) / 10 };
  });
  const retard = taches.filter((t) => t.statut !== 'termine' && !!t.date && t.date < today).length;
  const objectifs = h.objectifList
    .filter((o) => (o.espace || 'moi') === 'moi' && (!o.fin || o.fin >= today))
    .map((o) => {
      const l = taches.filter((t) => t.objectif === o.id);
      return { o, faites: l.filter((t) => t.statut === 'termine').length, total: l.length };
    });
  const il30 = toDateString(addDays(d, -30));
  const delaisses = h.domaineList.filter((dm) => (dm.espace || 'moi') === 'moi' && !taches.some((t) => t.domaine === dm.id && ((t.termine_le && t.termine_le >= il30) || (t.statut !== 'termine' && t.date >= today))));
  return { lundi, planifiees, disponibles: 35, parJour, retard, objectifs, delaisses };
}

/** Clé d'un niveau dans l'id des réunions (« equipeagile:acmeqmob- », « -perso- ») */
export const cleNiveau = (n: Pick<NiveauPilotage, 'kind' | 'id'>) => (n.kind === 'perso' ? '-perso-' : `${n.kind}:${n.id}-`);

/** Suivis de toutes les réunions du niveau : en retard, à valider, en cours ; notes à concrétiser */
export function suivisDuNiveau(points: PointReunion[], n: Pick<NiveauPilotage, 'kind' | 'id'>, items: Item[], today: string) {
  const cle = cleNiveau(n);
  const ici = points.filter((p) => p.reunion.includes(cle));
  const suivis = ici.filter((p) => !!p.statut).map((p) => ({ p, s: statutEffectif(p, items) })).filter((x) => !estFini(x.s));
  return {
    enRetard: suivis.filter((x) => enRetardSuivi(x.p, x.s, today)).map((x) => x.p),
    aValider: suivis.filter((x) => x.s === 'fait').map((x) => x.p),
    enCours: suivis.filter((x) => x.s !== 'fait' && !enRetardSuivi(x.p, x.s, today)).map((x) => x.p),
    notes: ici.filter((p) => aConcretiser(p) && !p.concretisation),
  };
}

/** Gouvernance : décisions prises dans les réunions du niveau (les plus récentes d'abord) */
export const decisionsDuNiveau = (points: PointReunion[], n: Pick<NiveauPilotage, 'kind' | 'id'>) =>
  points
    .filter((p) => p.reunion.includes(cleNiveau(n)) && p.type === 'decision' && (p.sous_type === 'prise' || (!p.sous_type && p.concretisation === 'rien')))
    .sort((a, b) => b.reunion.slice(-10).localeCompare(a.reunion.slice(-10)));
