import { type Alerte, alertesEpic, alertesObjectif, fmtDate } from './alerts';
import { addDays, addMonths, parseDate, toDateString } from './dates';
import { domaineOf, progressObjectif, tasksOfEpic } from './hierarchy';
import { inDomain, makeHierarchyValue } from './hierarchyContext';
import { nomDomaine } from './nomsEspaces';
import type { HierarchyValue } from './hierarchyContext';
import { iterationByKey, iterationOf, iterationOfItem, iterationsOf, piEnd, piLabel, piStart, pointsOf, shiftIteration, shiftPi } from './pi';
import { occurrencesBetween, recurrenceState } from './recurrence';
import { etatEpic } from './safe';
import { chargeOf, pointsCheck, subtaskMap } from './subtasks';
import { aDateFin, aHeureFin, ETATS_EPIC, type Item } from './types';

/**
 * Alertes de chaque écran, calculées à partir des données (rien n'est modifié tout seul) :
 * chaque alerte propose des actions, exécutées par l'application quand on touche un bouton.
 */
export type Ecran = 'taches' | 'iteration' | 'pi' | 'roadmap' | 'portefeuille';

export type Action =
  | { kind: 'task'; id: string; patch: Partial<Item> }
  | { kind: 'tasks'; patches: (Partial<Item> & { id: string })[] }
  | { kind: 'entity'; entity: 'epic' | 'objectif' | 'feature'; id: string; patch: Record<string, string> }
  | { kind: 'open'; target: 'task' | 'epic' | 'objectif' | 'feature' | 'objectifpi'; id: string }
  | { kind: 'new'; target: 'task'; defaults: Partial<Item> }
  | { kind: 'new'; target: 'epic'; defaults: { objectif?: string; domaine?: string } }
  | { kind: 'iteration'; itKey: string };

export interface Check {
  key: string;
  /** Alerte qui regroupe d'autres alertes (« Tout reporter ») : pas comptée dans le chiffre de l'onglet */
  groupe?: boolean;
  /** 'rappel' = jaune (rien n'est encore raté : rappel avant une échéance) ; sinon rouge */
  niveau?: 'rappel';
  /**
   * Situation stable, pour « Ignorer » : une alerte ignorée revient quand sa situation change. Par défaut le
   * message ; à préciser quand le message contient des chiffres qui bougent chaque jour (« dans 2 jours », %…).
   */
  situation?: string;
  icone: string;
  message: string;
  actions: { label: string; action: Action; principal?: boolean }[];
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const court = (d: string) => {
  const [, m, j] = d.split('-').map(Number);
  return `${j === 1 ? '1er' : j} ${MOIS[m - 1]}`;
};
const mot = (t: Item) =>
  t.type === 'rendez-vous'
    ? 'le rendez-vous'
    : t.type === 'appel'
      ? "l'appel"
      : t.type === 'mission'
        ? 'la mission'
        : t.type === 'demarche'
          ? 'la démarche'
          : t.parent
            ? 'la sous-tâche'
            : 'la tâche';
const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Accord : « prévu / prévue », « commencé / commencée » */
const e = (t: Item) => (t.type === 'appel' || t.type === 'rendez-vous' ? '' : 'e');
/** 5.5 → « 5,5 » */
const nb = (n: number) => String(+n.toFixed(1)).replace('.', ',');
const ouvert = (t: Item) => t.statut !== 'termine' && !t.periodicite;
/** Ordre des itérations : comparer leurs dates de début */
const itStart = (key: string) => iterationByKey(key)?.start ?? '';
/** 690 → « 11:30 » */
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/** 30 → « 30 min », 90 → « 1 h 30 » */
const dureeTxt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`);
const minutes = (h: string) => {
  const [a, b] = h.split(':').map(Number);
  return a * 60 + b;
};

/**
 * Données limitées au domaine filtré ('tous' = tout ; '' = sans domaine), pour que les alertes suivent le
 * filtre de domaine comme le reste de l'écran. La capacité, elle, reste commune (voir `complet`).
 */
export function filtrerDomaine(h: HierarchyValue, dom: string): HierarchyValue {
  if (dom === 'tous') return h;
  const ok = (id: string | undefined) => inDomain(dom, id, h);
  const epics = h.epicList.filter((e) => ok(domaineOf({ epic: e.id }, h)?.id));
  const epicIds = new Set(epics.map((e) => e.id));
  return makeHierarchyValue(
    epics,
    h.objectifList.filter((o) => ok(o.domaine)),
    h.domaineList.filter((d) => d.id !== '' && ok(d.id)),
    h.items.filter((t) => ok(domaineOf(t, h)?.id)),
    h.featureList.filter((f) => epicIds.has(f.epic) || (!f.epic && dom === '')),
    h.objectifsPI.filter((o) => ok(o.domaine)),
  );
}

/** Types qu'on estime en points (pas les rendez-vous ni les appels) */
const avecPoints = (t: Item) => t.type !== 'rendez-vous' && t.type !== 'appel';
/** Date limite d'un élément : sa date de fin (démarche) ou celle de sa démarche parente ('' = aucune). */
function limiteDe(t: Item, items: Item[]): string {
  if (aDateFin(t.type) && t.date_fin) return t.date_fin;
  const p = t.parent ? items.find((x) => x.id === t.parent) : undefined;
  return p && aDateFin(p.type) && p.date_fin ? p.date_fin : '';
}
/** Élément qui porte la date limite : la démarche elle-même, ou la démarche parente d'une sous-tâche. */
function porteurLimite(t: Item, items: Item[]): Item | undefined {
  if (aDateFin(t.type) && t.date_fin) return t;
  const p = t.parent ? items.find((x) => x.id === t.parent) : undefined;
  return p && aDateFin(p.type) && p.date_fin ? p : undefined;
}
/**
 * Reporter des éléments à une date en repoussant, si besoin, la date de fin qui les bloque
 * (patches fusionnés par élément : la démarche peut être à la fois reportée et repoussée).
 */
function reporterEtRepousser(ts: { t: Item; date: string }[], items: Item[]): (Partial<Item> & { id: string })[] {
  const m = new Map<string, Partial<Item> & { id: string }>();
  const ajoute = (id: string, patch: Partial<Item>) => m.set(id, { ...(m.get(id) ?? { id }), ...patch });
  for (const { t, date } of ts) {
    const porteur = porteurLimite(t, items);
    if (porteur && porteur.date_fin < date) ajoute(porteur.id, { date_fin: date });
    ajoute(t.id, { date });
  }
  return [...m.values()];
}
const titresPorteurs = (ts: Item[], items: Item[]) => [...new Set(ts.map((t) => porteurLimite(t, items)?.titre).filter(Boolean))];

/** Nouvelle date d'un report, sans dépasser la date limite (sauf si elle est déjà passée). */
function borne(t: Item, cible: string, items: Item[], today: string): string {
  const l = limiteDe(t, items);
  return l && l >= today && cible > l ? l : cible;
}

/** Ce qui identifie la situation d'une alerte ignorée (voir Check.situation). */
export const situationDe = (c: Check) => c.situation ?? c.message;

/** Unité choisie dans les réglages : « 5 j » ou « 5 pts » */
const unite = (jours: boolean) => (n: number) => (jours ? `${nb(n)} j` : `${nb(n)} pt${n > 1 ? 's' : ''}`);
const prevu = (n: number) => `prévu${n > 1 ? 's' : ''}`;

/** Points d'un parent ≠ total de ses sous-tâches (même alerte dans l'Itération et le PI) */
function checkPoints(p: Item, kids: Item[] | undefined, u: (n: number) => string): Check | null {
  const c = pointsCheck(p, kids);
  if (!c.alerte) return null;
  return {
    key: `points:${p.id}`,
    icone: '🔢',
    message: `La tâche « ${p.titre} » : ${u(c.parent)} ${prevu(c.parent)}, ${u(c.sous)} dans ses sous-tâches.`,
    actions: [
      { label: `Passer la tâche à ${u(c.sous)}`, action: { kind: 'task', id: p.id, patch: { points: String(c.sous) } }, principal: true },
      { label: 'Ouvrir la tâche', action: { kind: 'open', target: 'task', id: p.id } },
    ],
  };
}

// ---------------------------------------------------------------------------
// 1. Tâches : « qu'est-ce qui cloche aujourd'hui ? »
// ---------------------------------------------------------------------------
export function checksTaches(
  h: HierarchyValue,
  today: string,
  opts: {
    complet?: HierarchyValue;
    /** Heure actuelle en minutes : les créneaux d'aujourd'hui déjà finis ne comptent plus dans l'agenda */
    maintenant?: number;
  } = {},
): Check[] {
  const out: Check[] = [];
  const items = h.items;
  const complet = opts.complet ?? h;
  const demain = toDateString(addDays(parseDate(today), 1));

  // En retard. Rendez-vous passés à part (on ne « reporte » pas un rendez-vous qui a eu lieu) ;
  // une tâche et ses sous-tâches en retard forment une seule alerte.
  // (un parent dont toutes les sous-tâches sont faites n'est pas « en retard » : l'alerte propose de le terminer)
  const subs = subtaskMap(items);
  const toutFait = (t: Item) => {
    const k = subs.get(t.id) ?? [];
    return k.length > 0 && k.every((x) => x.statut === 'termine');
  };
  // (une démarche dont la date de fin est dépassée a son alerte à part, plus importante)
  const finDepassee = (t: Item) => aDateFin(t.type) && !!t.date_fin && t.date_fin < today;
  // (sous-tâche ouverte d'un parent terminé : c'est l'alerte « terminée, mais des sous-tâches ne sont pas faites » qui s'en occupe)
  const parentTermine = (t: Item) => !!t.parent && items.some((p) => p.id === t.parent && p.statut === 'termine');
  const enRetard = (t: Item) => ouvert(t) && !!t.date && t.date < today && !finDepassee(t) && !parentTermine(t);
  const rdvPasses = items.filter((t) => enRetard(t) && t.type === 'rendez-vous');
  const retard = items.filter((t) => enRetard(t) && t.type !== 'rendez-vous' && !toutFait(t)).sort((a, b) => a.date.localeCompare(b.date));
  const familles = new Map<string, Item[]>();
  for (const t of retard) familles.set(t.parent || t.id, [...(familles.get(t.parent || t.id) ?? []), t]);
  // Raccourci « Tout reporter » quand il y a plusieurs alertes de retard (il ne compte pas comme une alerte de plus)
  // Reporter à demain, sans dépasser une date de fin de démarche (sinon le report crée l'alerte « après sa date de fin »)
  const report = (t: Item) => borne(t, demain, items, today);
  const libelleTout = (ts: Item[]) =>
    ts.some((t) => report(t) !== demain) ? 'Tout reporter (demain, ou la date de fin si elle est avant)' : 'Tout reporter à demain';
  if (familles.size > 1)
    out.push({
      key: 'retard:tout',
      groupe: true,
      icone: '⏰',
      message: `${familles.size} retards à traiter${retard.length > familles.size ? ` (${retard.length} tâches avec les sous-tâches)` : ''}.`,
      actions: [{ label: libelleTout(retard), action: { kind: 'tasks', patches: retard.map((t) => ({ id: t.id, date: report(t) })) }, principal: true }],
    });
  for (const [id, groupe] of familles) {
    const parent = items.find((x) => x.id === id);
    const parentEnRetard = groupe.some((t) => t.id === id);
    const sous = groupe.filter((t) => t.id !== id);
    if (!sous.length) {
      const t = groupe[0];
      out.push({
        key: `retard:${t.id}`,
        icone: '⏰',
        message: `${maj(mot(t))} « ${t.titre} » est en retard (prévu${e(t)} le ${court(t.date)}).`,
        actions: [
          {
            label: report(t) === demain ? 'Reporter à demain' : report(t) === today ? "Reporter à aujourd'hui (date de fin)" : `Reporter au ${court(report(t))} (date de fin)`,
            action: { kind: 'task', id: t.id, patch: { date: report(t) } },
            principal: true,
          },
          // Date de fin qui bloque : on peut aussi la repousser
          ...(report(t) !== demain
            ? [
                {
                  label: `Repousser la date de fin au ${court(demain)} et reporter à demain`,
                  action: { kind: 'tasks', patches: reporterEtRepousser([{ t, date: demain }], items) } as Action,
                },
              ]
            : []),
          { label: 'Choisir une date', action: { kind: 'open', target: 'task', id: t.id } },
        ],
      });
      continue;
    }
    const nom = parent ? `${mot(parent)} « ${parent.titre} »` : 'une tâche';
    out.push({
      key: `retard:famille:${id}`,
      icone: '⏰',
      message: parentEnRetard
        ? `${maj(nom)} et ${sous.length} de ses sous-tâches sont en retard.`
        : `${sous.length} sous-tâche${sous.length > 1 ? 's' : ''} de ${nom} ${sous.length > 1 ? 'sont' : 'est'} en retard : ${sous.map((t) => `« ${t.titre} »`).join(', ')}.`,
      actions: [
        { label: libelleTout(groupe), action: { kind: 'tasks', patches: groupe.map((t) => ({ id: t.id, date: report(t) })) }, principal: true },
        ...(groupe.some((t) => report(t) !== demain)
          ? [
              {
                label: `Repousser la date de fin au ${court(demain)} et tout reporter à demain`,
                action: { kind: 'tasks', patches: reporterEtRepousser(groupe.map((t) => ({ t, date: demain })), items) } as Action,
              },
            ]
          : []),
        ...(parent ? [{ label: `Ouvrir « ${parent.titre} »`, action: { kind: 'open', target: 'task', id: parent.id } as Action }] : []),
      ],
    });
  }
  for (const t of rdvPasses)
    out.push({
      key: `rdvpasse:${t.id}`,
      icone: '📅',
      message: `Le rendez-vous « ${t.titre} » du ${court(t.date)} est passé et n'est pas coché.`,
      actions: [
        { label: 'Marquer fait', action: { kind: 'task', id: t.id, patch: { statut: 'termine' } }, principal: true },
        { label: 'Reprogrammer', action: { kind: 'open', target: 'task', id: t.id } },
      ],
    });

  // Éléments répétés avec des périodes oubliées : cocher la plus ancienne, ou tout rattraper.
  // Un rendez-vous répété passé n'est pas « en retard » : il a eu lieu (ou pas), on le marque fait, comme un rendez-vous ponctuel.
  for (const t of items.filter((x) => x.periodicite && x.statut !== 'termine')) {
    const { missed } = recurrenceState(t, today);
    if (!missed.length) continue;
    const faits = (keys: string[]) => [...new Set([...t.faits.split(';').filter(Boolean), ...keys])].sort().join(';');
    const rdv = t.type === 'rendez-vous';
    const periodes = missed.map((o) => o.label).join(', ');
    out.push({
      key: `repete:${t.id}`,
      icone: '🔁',
      message: (rdv
        ? `Le rendez-vous répété « ${t.titre} » n'est pas coché : ${periodes}.`
        : `${maj(mot(t))} répété${e(t)} « ${t.titre} » est en retard : ${periodes}.`
      ).replace(/\.\.$/, '.'),
      actions: [
        {
          label: `${rdv ? 'Marquer fait' : 'Cocher'} ${missed[0].label}`,
          action: { kind: 'task', id: t.id, patch: { faits: faits([missed[0].key]) } },
          principal: true,
        },
        ...(missed.length > 1
          ? [
              {
                label: `${rdv ? 'Tout marquer fait' : 'Tout rattraper'} (${missed.length})`,
                action: { kind: 'task', id: t.id, patch: { faits: faits(missed.map((o) => o.key)) } } as Action,
              },
            ]
          : []),
      ],
    });
  }

  // Agenda : créneaux qui se recouvrent le même jour. On regarde TOUT l'agenda (le temps est commun à tous
  // les domaines) : rendez-vous et missions (fin indiquée, sinon 1 h), appels avec une heure (30 min),
  // rendez-vous répétés sur les 30 prochains jours. L'alerte s'affiche si l'un des deux est dans le domaine filtré.
  const visibles = new Set(items.map((t) => t.id));
  const dans30 = toDateString(addDays(parseDate(today), 30));
  type Creneau = { t: Item; date: string; repete: boolean; debut: number; fin: number; estime: boolean };
  const creneaux: Creneau[] = [];
  const minutesDe = (t: Item) => {
    const d = minutes(t.heure);
    if (aHeureFin(t.type) && t.heure_fin && t.heure_fin > t.heure) return { debut: d, fin: minutes(t.heure_fin), estime: false };
    return { debut: d, fin: d + (aHeureFin(t.type) ? 60 : 30), estime: true };
  };
  for (const t of complet.items) {
    if (!t.heure || t.statut === 'termine' || !['rendez-vous', 'appel', 'mission'].includes(t.type)) continue;
    if (!t.periodicite) {
      if (t.date >= today) creneaux.push({ t, date: t.date, repete: false, ...minutesDe(t) });
    } else if (t.type === 'rendez-vous') {
      const faits = new Set(t.faits.split(';'));
      for (const o of occurrencesBetween(t, today, dans30, today))
        if (o.date && o.date >= today && !faits.has(o.key)) creneaux.push({ t, date: o.date, repete: true, ...minutesDe(t) });
    }
  }
  // Aujourd'hui : un créneau déjà fini ne peut plus en chevaucher un autre
  if (opts.maintenant !== undefined) {
    const m = opts.maintenant;
    for (let i = creneaux.length - 1; i >= 0; i--) if (creneaux[i].date === today && creneaux[i].fin <= m) creneaux.splice(i, 1);
  }
  creneaux.sort((a, b) => (a.date + hhmm(a.debut)).localeCompare(b.date + hhmm(b.debut)));
  const libelle = (c: Creneau) =>
    `${c.repete ? `${mot(c.t)} répété` : mot(c.t)} « ${c.t.titre} » (${hhmm(c.debut)}${c.estime ? `, fin non indiquée : ${c.fin - c.debut >= 60 ? '1 h' : '30 min'} estimée` : ` → ${hhmm(c.fin)}`})`;
  for (let i = 0; i < creneaux.length; i++)
    for (let j = i + 1; j < creneaux.length && creneaux[j].date === creneaux[i].date; j++) {
      const [a, b] = [creneaux[i], creneaux[j]];
      if (b.debut >= a.fin || a.t.id === b.t.id) continue;
      // Une sous-tâche pendant sa propre tâche (ex. un appel pendant la mission) : normal
      if (a.t.parent === b.t.id || b.t.parent === a.t.id) continue;
      if (!visibles.has(a.t.id) && !visibles.has(b.t.id)) continue;
      const recouvre = Math.min(a.fin, b.fin) - Math.max(a.debut, b.debut);
      // Proposition : décaler le 2e juste après le 1er (seulement s'il est ponctuel : décaler un répété changerait toutes ses dates)
      const duree = b.fin - b.debut;
      const decaler =
        !b.repete && a.fin + duree <= 23 * 60 + 59
          ? [
              {
                label: `Décaler « ${b.t.titre} » à ${hhmm(a.fin)}`,
                action: {
                  kind: 'task',
                  id: b.t.id,
                  patch: { heure: hhmm(a.fin), ...(b.t.type === 'rendez-vous' ? { heure_fin: hhmm(a.fin + duree) } : {}) },
                } as Action,
                principal: true,
              },
            ]
          : [];
      out.push({
        key: `rdv:${a.t.id}:${b.t.id}:${a.date}`,
        icone: '📅',
        message:
          recouvre === b.fin - b.debut && recouvre < a.fin - a.debut
            ? `Le ${court(a.date)}, ${libelle(b)} a lieu pendant ${libelle(a)}.`
            : `Le ${court(a.date)}, ${libelle(a)} et ${libelle(b)} se chevauchent${recouvre < b.fin - b.debut || recouvre < a.fin - a.debut ? ` de ${dureeTxt(recouvre)}` : ''}.`,
        actions: [
          ...decaler,
          { label: `Ouvrir « ${a.t.titre} »`, action: { kind: 'open', target: 'task', id: a.t.id } },
          { label: `Ouvrir « ${b.t.titre} »`, action: { kind: 'open', target: 'task', id: b.t.id } },
        ],
      });
    }

  // Démarches : date de fin (date limite) dépassée, proche (3 jours), ou date prévue après la date de fin
  const dans3 = toDateString(addDays(parseDate(today), 3));
  for (const t of items.filter((x) => aDateFin(x.type) && ouvert(x) && !!x.date_fin)) {
    const quand = (d: string) => {
      const n = Math.round((parseDate(d).getTime() - parseDate(today).getTime()) / 86400000);
      return n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : `dans ${n} jours`;
    };
    const ouvrir = { label: 'Ouvrir', action: { kind: 'open', target: 'task', id: t.id } as Action };
    if (t.date_fin < today)
      out.push({
        key: `dfin:${t.id}`,
        icone: '⏳',
        // (sous-tâches toutes faites : une seule alerte, pas en plus « toutes les sous-tâches sont faites »)
        message: `${maj(mot(t))} « ${t.titre} » a dépassé sa date de fin (${court(t.date_fin)})${toutFait(t) ? ' et toutes ses sous-tâches sont faites' : ''}.`,
        actions: [
          { label: `Terminer « ${t.titre} »`, action: { kind: 'task', id: t.id, patch: { statut: 'termine' } }, principal: true },
          // Nouvelle date de fin à choisir dans la fiche (impossible de deviner le délai)
          { label: 'Repousser la date de fin…', action: { kind: 'open', target: 'task', id: t.id } },
        ],
      });
    // Rappel (jaune) : seulement si la démarche n'a pas déjà une alerte rouge (en retard, sous-tâches en retard,
    // prévue après sa date de fin) : c'est la même situation, l'alerte rouge suffit
    else if (t.date_fin <= dans3 && !familles.has(t.id) && !(t.date && t.date > t.date_fin))
      out.push({
        key: `drappel:${t.id}`,
        niveau: 'rappel',
        situation: `Date de fin le ${t.date_fin}`,
        icone: '⏳',
        message: `${maj(mot(t))} « ${t.titre} » doit être finie ${quand(t.date_fin)} (date de fin : ${court(t.date_fin)}).`,
        actions: [{ ...ouvrir, principal: true }, { label: 'Marquer terminée', action: { kind: 'task', id: t.id, patch: { statut: 'termine' } } }],
      });
    if (t.date && t.date > t.date_fin && t.date_fin >= today)
      out.push({
        key: `dapres:${t.id}`,
        icone: '⏳',
        message: `${maj(mot(t))} « ${t.titre} » est prévue le ${court(t.date)}, après sa date de fin (${court(t.date_fin)}).`,
        actions: [
          { label: `Ramener au ${court(t.date_fin)}`, action: { kind: 'task', id: t.id, patch: { date: t.date_fin } }, principal: true },
          { label: `Repousser la date de fin au ${court(t.date)}`, action: { kind: 'task', id: t.id, patch: { date_fin: t.date } } },
          ouvrir,
        ],
      });
  }

  // Sous-tâche prévue après la date de fin de sa démarche (date de fin pas encore passée : sinon l'alerte « dépassée » suffit)
  for (const k of items.filter((x) => x.parent && ouvert(x) && !!x.date)) {
    const p = items.find((x) => x.id === k.parent);
    if (!p || !aDateFin(p.type) || !p.date_fin || p.statut === 'termine' || p.date_fin < today || k.date <= p.date_fin) continue;
    out.push({
      key: `dsous:${k.id}`,
      icone: '⏳',
      message: `La sous-tâche « ${k.titre} » est prévue le ${court(k.date)}, après la date de fin de ${mot(p)} « ${p.titre} » (${court(p.date_fin)}).`,
      actions: [
        { label: `Ramener au ${court(p.date_fin)}`, action: { kind: 'task', id: k.id, patch: { date: p.date_fin } }, principal: true },
        { label: `Repousser la date de fin de « ${p.titre} » au ${court(k.date)}`, action: { kind: 'task', id: p.id, patch: { date_fin: k.date } } },
        { label: 'Ouvrir', action: { kind: 'open', target: 'task', id: k.id } },
      ],
    });
  }

  // Parent terminé alors que des sous-tâches ne sont pas faites (ex. « Non, seulement la tâche ») : comme pour une epic
  for (const [pid, kids] of subs) {
    const p = items.find((t) => t.id === pid);
    const ouvertes = kids.filter((k) => k.statut !== 'termine');
    if (!p || p.statut !== 'termine' || !ouvertes.length) continue;
    const n = ouvertes.length;
    out.push({
      key: `parentouvert:${p.id}`,
      icone: '✅',
      message: `${maj(mot(p))} « ${p.titre} » est terminée, mais ${n} sous-tâche${n > 1 ? 's ne sont pas faites' : " n'est pas faite"} : ${ouvertes.map((k) => `« ${k.titre} »`).join(', ')}.`,
      actions: [
        {
          label: `Terminer aussi ${n > 1 ? `les ${n} sous-tâches` : 'la sous-tâche'}`,
          action: { kind: 'tasks', patches: ouvertes.map((k) => ({ id: k.id, statut: 'termine' as const })) },
          principal: true,
        },
        { label: `Rouvrir « ${p.titre} »`, action: { kind: 'task', id: p.id, patch: { statut: 'en_cours' } } },
      ],
    });
  }

  // Sous-tâches : tout est fait mais le parent ne l'est pas (les points sont vérifiés dans l'Itération et le PI, en mode SAFe)
  for (const [pid, kids] of subs) {
    const p = items.find((t) => t.id === pid);
    if (!p) continue;
    if (p.statut !== 'termine' && kids.every((k) => k.statut === 'termine') && !finDepassee(p))
      out.push({
        key: `parent:${p.id}`,
        icone: '✓',
        message: `Toutes les sous-tâches de ${mot(p).replace('la sous-tâche', 'la tâche')} « ${p.titre} » sont faites.`,
        actions: [{ label: `Terminer « ${p.titre} »`, action: { kind: 'task', id: p.id, patch: { statut: 'termine' } }, principal: true }],
      });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Itération : « est-ce que je tiens mon itération ? »
// ---------------------------------------------------------------------------
export function checksIteration(
  h: HierarchyValue,
  itKey: string,
  today: string,
  capacite: number,
  complet: HierarchyValue = h,
  jours = true,
): Check[] {
  const out: Check[] = [];
  const u = unite(jours);
  const it = iterationByKey(itKey);
  if (!it) return out;
  const subs = subtaskMap(h.items);

  // Surcharge : la capacité est commune à tous les domaines
  const subsAll = subtaskMap(complet.items);
  const chargeAll = complet.items.filter((t) => iterationOfItem(t) === itKey).reduce((n, t) => n + chargeOf(t, subsAll), 0);
  if (it.code !== 'IP' && chargeAll > capacite)
    out.push({
      key: `surcharge:${itKey}`,
      icone: '🔴',
      message: `${it.code} est surchargée : ${u(chargeAll)} pour ${u(capacite)} de capacité.`,
      actions: [],
    });

  // Points incohérents : parent ≠ total de ses sous-tâches (parents présents dans l'itération)
  const parents = new Set<string>();
  for (const t of h.items) if (iterationOfItem(t) === itKey) parents.add(t.parent || t.id);
  for (const pid of parents) {
    const p = h.items.find((t) => t.id === pid);
    const c = p && checkPoints(p, subs.get(pid), u);
    if (c) out.push(c);
  }
  const tasks = h.items.filter((t) => iterationOfItem(t) === itKey);
  const total = tasks.reduce((n, t) => n + chargeOf(t, subs), 0);
  const done = tasks.filter((t) => t.statut === 'termine').reduce((n, t) => n + chargeOf(t, subs), 0);

  // Burndown : reste > idéal (de plus d'un demi-point) dans l'itération en cours
  if (it.code !== 'IP' && it.start <= today && today <= it.end && total > 0) {
    const jours = (parseDate(it.end).getTime() - parseDate(it.start).getTime()) / 86400000;
    const ecoule = (parseDate(today).getTime() - parseDate(it.start).getTime()) / 86400000;
    const ideal = total * (1 - ecoule / Math.max(jours, 1));
    const reste = total - done;
    if (reste > ideal + 0.5)
      out.push({
        key: `burndown:${itKey}`,
        // (les chiffres bougent chaque jour : ignorer vaut pour toute l'itération)
        situation: 'En retard sur le burndown',
        icone: '📉',
        message: `En retard sur le burndown : il reste ${u(reste)}, l'idéal à cette date serait ${u(ideal)}.`,
        actions: [],
      });
  }

  // Fin d'itération (terminée, ou dans 3 jours au plus : même délai que les autres rappels) avec des tâches non faites
  const bientotFinie = toDateString(addDays(parseDate(today), 3)) >= it.end;
  // (sans les rendez-vous : un rendez-vous passé a son alerte « passé et pas coché », on ne le déplace pas)
  const nonFaites = tasks.filter((t) => ouvert(t) && t.type !== 'rendez-vous');
  if (bientotFinie && nonFaites.length) {
    const suivante = shiftIteration(itKey, 1);
    const code = iterationByKey(suivante)!.code;
    const sansDate = nonFaites.filter((t) => !t.date);
    const datees = nonFaites.filter((t) => t.date);
    // Tâches datées : itération finie → demain ; sinon → premier jour de l'itération suivante (sans dépasser une date de fin)
    const nouvelleDate = it.end < today ? toDateString(addDays(parseDate(today), 1)) : iterationByKey(suivante)!.start;
    const borneAu = (t: Item) => borne(t, nouvelleDate, h.items, today);
    // Une tâche et ses sous-tâches comptent pour une (comme partout ailleurs)
    const nbFamilles = new Set(nonFaites.map((t) => t.parent || t.id)).size;
    const nbSous = nonFaites.filter((t) => t.parent).length;
    const bloquees = datees.filter((t) => borneAu(t) !== nouvelleDate);
    const porteurs = titresPorteurs(bloquees, h.items);
    const lesTaches = (n: number, datee = false) => (n > 1 ? `les ${n} tâches${datee ? ' datées' : ''}` : `la tâche${datee ? ' datée' : ''}`);
    out.push({
      key: `fin:${itKey}`,
      // Itération pas encore finie : rappel (jaune) ; finie : alerte (rouge)
      ...(it.end < today ? {} : { niveau: 'rappel' as const }),
      icone: '↪️',
      message: `${it.end < today ? 'Itération terminée' : `Fin de l'itération le ${court(it.end)}`} : ${nbFamilles} tâche${nbFamilles > 1 ? 's' : ''} non faite${nbFamilles > 1 ? 's' : ''}${nbSous ? `, avec ${nbSous} sous-tâche${nbSous > 1 ? 's' : ''}` : ''}.`,
      actions: [
        ...(sansDate.length
          ? [
              {
                label: `Reporter ${lesTaches(sansDate.length)} en ${code}`,
                action: { kind: 'tasks', patches: sansDate.map((t) => ({ id: t.id, iteration: suivante })) } as Action,
                principal: true,
              },
            ]
          : []),
        ...(datees.length
          ? [
              {
                label: `Décaler ${lesTaches(datees.length, true)} au ${court(nouvelleDate)}${datees.some((t) => borneAu(t) !== nouvelleDate) ? ' (ou à leur date de fin)' : ''}`,
                action: { kind: 'tasks', patches: datees.map((t) => ({ id: t.id, date: borneAu(t) })) } as Action,
                principal: !sansDate.length,
              },
              // Des dates de fin bloquent : on peut aussi les repousser pour sortir ces tâches de l'itération
              ...(bloquees.length
                ? [
                    {
                      label: `Décaler au ${court(nouvelleDate)} en repoussant ${porteurs.length > 1 ? `${porteurs.length} dates de fin` : `la date de fin de « ${porteurs[0]} »`}`,
                      action: { kind: 'tasks', patches: reporterEtRepousser(datees.map((t) => ({ t, date: nouvelleDate })), h.items) } as Action,
                    },
                  ]
                : []),
            ]
          : []),
      ],
    });
  }

  // Tâches sans points (on ignore un parent dont les sous-tâches ont des points, et une sous-tâche dont le
  // parent porte la charge : parent avec des points et aucune sous-tâche avec des points)
  const aDesPoints = (id: string) => (subs.get(id) ?? []).some((c) => pointsOf(c) > 0);
  const parentPorte = (t: Item) => {
    const p = t.parent ? h.items.find((x) => x.id === t.parent) : undefined;
    return !!p && pointsOf(p) > 0 && !aDesPoints(p.id);
  };
  const sansPoints = tasks.filter((t) => ouvert(t) && avecPoints(t) && !pointsOf(t) && !aDesPoints(t.id) && !parentPorte(t));
  if (sansPoints.length && capacite > 0)
    out.push({
      key: `sanspoints:${itKey}`,
      icone: '❔',
      message: `${sansPoints.length} tâche${sansPoints.length > 1 ? 's' : ''} sans points : la charge est sous-estimée.`,
      actions: sansPoints.slice(0, 3).map((t) => ({ label: `Ouvrir « ${t.titre} »`, action: { kind: 'open', target: 'task', id: t.id } as Action })),
    });
  return out;
}

// ---------------------------------------------------------------------------
// 3. PI : « mon plan du trimestre est-il réaliste et cohérent ? »
// ---------------------------------------------------------------------------
export function checksPI(h: HierarchyValue, piKey: string, today: string, capacite: number, complet: HierarchyValue = h, jours = true): Check[] {
  const out: Check[] = [];
  const u = unite(jours);
  const subs = subtaskMap(h.items);
  const its = iterationsOf(piKey);

  // Itérations surchargées (capacité commune à tous les domaines)
  const subsAll = subtaskMap(complet.items);
  for (const it of its) {
    if (it.code === 'IP') continue;
    const charge = complet.items.filter((t) => iterationOfItem(t) === it.key).reduce((n, t) => n + chargeOf(t, subsAll), 0);
    if (charge > capacite)
      out.push({
        key: `surcharge:${it.key}`,
        icone: '🔴',
        message: `${it.code} est surchargée : ${u(charge)} pour ${u(capacite)} de capacité.`,
        actions: [{ label: `Ouvrir ${it.code}`, action: { kind: 'iteration', itKey: it.key }, principal: true }],
      });
  }

  const features = h.featureList.filter((f) => f.pi === piKey);
  for (const f of features) {
    const tasks = h.items.filter((t) => t.feature === f.id && !t.periodicite);
    // Dates de la feature (son itération, sinon tout le PI) hors des dates de son epic
    const epic = h.epics.get(f.epic);
    if (epic) {
      const itf = f.iteration ? iterationByKey(f.iteration) : undefined;
      const [fd, ff] = itf ? [itf.start, itf.end] : [toDateString(piStart(piKey)), toDateString(piEnd(piKey))];
      const periode = itf ? `son itération ${itf.code} (${court(fd)} → ${court(ff)})` : `le PI ${piLabel(piKey)}`;
      // Sans itération, le PI entier ne fait que « chevaucher » : on ne signale qu'un PI complètement en dehors
      const avant = epic.debut && (itf ? fd < epic.debut : ff < epic.debut);
      const apres = epic.fin && (itf ? ff > epic.fin : fd > epic.fin);
      if (avant)
        out.push({
          key: `fdebut:${f.id}`,
          icone: '📆',
          message: `La feature « ${f.titre} » est prévue dans ${periode}, avant le début de l'epic « ${epic.titre} » (${fmtDate(epic.debut)}).`,
          actions: [
            { label: `Avancer le début de l'epic au ${fmtDate(fd)}`, action: { kind: 'entity', entity: 'epic', id: epic.id, patch: { debut: fd } }, principal: true },
            { label: 'Ouvrir la feature', action: { kind: 'open', target: 'feature', id: f.id } },
          ],
        });
      if (apres)
        out.push({
          key: `ffin:${f.id}`,
          icone: '📆',
          message: `La feature « ${f.titre} » est prévue dans ${periode}, après la fin de l'epic « ${epic.titre} » (${fmtDate(epic.fin)}).`,
          actions: [
            { label: `Repousser la fin de l'epic au ${fmtDate(ff)}`, action: { kind: 'entity', entity: 'epic', id: epic.id, patch: { fin: ff } }, principal: true },
            { label: 'Ouvrir la feature', action: { kind: 'open', target: 'feature', id: f.id } },
          ],
        });
    }
    // Feature sans itération
    if (!f.iteration)
      out.push({
        key: `sansit:${f.id}`,
        icone: '🧩',
        message: `La feature « ${f.titre} » n'a pas d'itération prévue dans ce PI.`,
        actions: [{ label: 'Ouvrir la feature', action: { kind: 'open', target: 'feature', id: f.id }, principal: true }],
      });
    // Feature en retard sur son plan : des tâches tombent après son itération prévue
    if (f.iteration) {
      const tard = tasks.filter((t) => ouvert(t) && iterationOfItem(t) && itStart(iterationOfItem(t)) > itStart(f.iteration));
      if (tard.length) {
        const derniere = tard.map(iterationOfItem).sort((a, b) => itStart(a).localeCompare(itStart(b))).pop()!;
        const sansDate = tard.filter((t) => !t.date);
        const code = (k: string) => iterationByKey(k)?.code ?? k;
        out.push({
          key: `tard:${f.id}`,
          icone: '🧩',
          message: `La feature « ${f.titre} » est prévue en ${code(f.iteration)}, mais ${tard.length} de ses tâches ${tard.length > 1 ? 'tombent' : 'tombe'} après (jusqu'en ${code(derniere)}).`,
          actions: [
            {
              label: `Décaler la feature en ${code(derniere)}`,
              action: { kind: 'entity', entity: 'feature', id: f.id, patch: { iteration: derniere, pi: iterationByKey(derniere)!.pi } },
              principal: true,
            },
            ...(sansDate.length
              ? [
                  {
                    label: `Ramener ${sansDate.length > 1 ? `les ${sansDate.length} tâches` : 'la tâche'} en ${code(f.iteration)}`,
                    action: { kind: 'tasks', patches: sansDate.map((t) => ({ id: t.id, iteration: f.iteration })) } as Action,
                  },
                ]
              : []),
          ],
        });
      }
    }
    // Points de la feature ≠ total de ses tâches (sans compter deux fois un parent)
    const fp = pointsOf(f);
    const tp = tasks.reduce((n, t) => n + chargeOf(t, subs), 0);
    if (fp > 0 && tp > 0 && Math.abs(fp - tp) > 1e-9)
      out.push({
        key: `fpoints:${f.id}`,
        icone: '🔢',
        message: `La feature « ${f.titre} » : ${u(fp)} ${prevu(fp)}, ${u(tp)} dans ses tâches.`,
        actions: [
          { label: `Passer la feature à ${u(tp)}`, action: { kind: 'entity', entity: 'feature', id: f.id, patch: { points: String(+tp.toFixed(1)) } }, principal: true },
          { label: 'Ouvrir la feature', action: { kind: 'open', target: 'feature', id: f.id } },
        ],
      });
  }

  // Points d'une tâche ≠ total de ses sous-tâches, pour toutes les itérations du PI
  const keys = new Set(its.map((it) => it.key));
  const parents = new Set<string>();
  for (const t of h.items) if (keys.has(iterationOfItem(t))) parents.add(t.parent || t.id);
  for (const pid of parents) {
    const p = h.items.find((t) => t.id === pid);
    const c = p && checkPoints(p, subs.get(pid), u);
    if (c) out.push(c);
  }

  // Objectif du PI engagé sans rien pour le porter : aucune feature ni tâche de son epic (si elle est
  // précisée), sinon de son domaine (sinon de n'importe quel domaine) n'est prévue dans ce PI.
  // Tâche prévue dans le PI : datée ou rangée dans une de ses itérations, ou répétée avec une échéance dans le PI.
  const [debutPI, finPI] = [toDateString(piStart(piKey)), toDateString(piEnd(piKey))];
  const itsPI = new Set(its.map((it) => it.key));
  const tachesPI = complet.items.filter((t) =>
    t.periodicite
      ? t.statut !== 'termine' && occurrencesBetween(t, debutPI, finPI, today).length > 0
      : itsPI.has(iterationOfItem(t)),
  );
  const featuresPI = complet.featureList.filter((f) => f.pi === piKey);
  const domDe = (x: { epic?: string; feature?: string }) => domaineOf(x, complet)?.id ?? '';
  // Nouvelle tâche : dans l'itération en cours si elle est dans ce PI, sinon la première du PI
  const itDuPI = itsPI.has(iterationOf(today).key) ? iterationOf(today).key : its[0].key;
  for (const o of h.objectifsPI.filter((x) => x.pi === piKey && x.type === 'engage')) {
    const epic = o.epic ? complet.epics.get(o.epic) : undefined;
    const porte = epic
      ? featuresPI.some((f) => f.epic === epic.id) || tasksOfEpic(epic.id, tachesPI, complet.featureList).length > 0
      : featuresPI.some((f) => !o.domaine || domDe({ epic: f.epic }) === o.domaine) ||
        tachesPI.some((t) => !o.domaine || domDe(t) === o.domaine);
    if (!porte)
      out.push({
        key: `opi:${o.id}`,
        icone: '🤝',
        message: `L'objectif du PI « ${o.titre} » est engagé, mais aucune feature ou tâche${epic ? ` de l'epic « ${epic.titre} »` : o.domaine ? ' de son domaine' : ''} n'est prévue dans ce PI.`,
        actions: [
          ...(epic
            ? [{ label: `+ Tâche dans l'epic « ${epic.titre} »`, action: { kind: 'new', target: 'task', defaults: { epic: epic.id, iteration: itDuPI } } as Action, principal: true }]
            : []),
          { label: "Ouvrir l'objectif du PI", action: { kind: 'open', target: 'objectifpi', id: o.id } },
        ],
      });
  }

  // PI terminé : valeur obtenue à noter
  if (toDateString(piEnd(piKey)) < today)
    for (const o of h.objectifsPI.filter((x) => x.pi === piKey && x.type === 'engage' && !x.valeur_obtenue))
      out.push({
        key: `note:${o.id}`,
        icone: '🏁',
        message: `Le PI ${piLabel(piKey)} est terminé : notez la valeur obtenue de l'objectif « ${o.titre} ».`,
        actions: [{ label: 'Noter', action: { kind: 'open', target: 'objectifpi', id: o.id }, principal: true }],
      });
  return out;
}

// ---------------------------------------------------------------------------
// 4. Roadmap : « mes dates tiennent-elles ? » (les alertes de dates sont affichées sur chaque barre)
// ---------------------------------------------------------------------------
export function checksRoadmap(h: HierarchyValue, today: string): Check[] {
  const out: Check[] = [];
  const unMois = (d: string) => toDateString(addMonths(parseDate(d < today ? today : d), 1));
  for (const e of h.epicList) {
    const toutes = tasksOfEpic(e.id, h.items, h.featureList);
    const tasks = toutes.filter((t) => !t.periodicite);
    const faites = tasks.filter((t) => t.statut === 'termine').length;
    const terminee = e.etat === 'termine';
    // Epic en retard : fin passée, pas tout fait
    if (e.fin && e.fin < today && !terminee && tasks.length && faites < tasks.length)
      out.push({
        key: `eretard:${e.id}`,
        icone: '⌛',
        message: `L'epic « ${e.titre} » devait finir le ${fmtDate(e.fin)} : ${faites}/${tasks.length} tâches faites.`,
        actions: [
          { label: `Repousser la fin de l'epic au ${fmtDate(unMois(e.fin))}`, action: { kind: 'entity', entity: 'epic', id: e.id, patch: { fin: unMois(e.fin) } }, principal: true },
          // Pas de « Marquer terminée » : des tâches sont encore ouvertes (elle réapparaîtrait en alerte dans le Portefeuille)
          { label: 'Voir les tâches ouvertes', action: { kind: 'open', target: 'epic', id: e.id } },
        ],
      });
    // Epic sans tâche
    const bientot = toDateString(addDays(parseDate(today), 30));
    if (!toutes.length && !terminee && e.etat !== 'idee' && e.debut <= bientot && (!e.fin || e.fin >= today))
      out.push({
        key: `evide:${e.id}`,
        icone: '🕳️',
        message: `L'epic « ${e.titre} » n'a aucune tâche.`,
        actions: [{ label: '+ Tâche', action: { kind: 'new', target: 'task', defaults: { epic: e.id } }, principal: true }],
      });
  }
  for (const o of h.objectifList) {
    const epics = h.epicList.filter((e) => e.objectif === o.id);
    const directes = h.items.filter((t) => t.objectif === o.id);
    const prog = progressObjectif(o, { items: h.items, epics: h.epicList, features: h.featureList });
    // Objectif en retard : échéance passée, pas atteint
    if (o.fin && o.fin < today && prog.label && prog.ratio < 1)
      out.push({
        key: `oretard:${o.id}`,
        icone: '⌛',
        message: `L'objectif « ${o.titre} » avait pour échéance le ${fmtDate(o.fin)} : ${prog.label}.`,
        actions: [
          { label: `Repousser l'échéance au ${fmtDate(unMois(o.fin))}`, action: { kind: 'entity', entity: 'objectif', id: o.id, patch: { fin: unMois(o.fin) } }, principal: true },
          { label: "Ouvrir l'objectif", action: { kind: 'open', target: 'objectif', id: o.id } },
        ],
      });
    // Objectif sans epic (ni tâche directe)
    if (!epics.length && !directes.length && (!o.debut || o.debut <= toDateString(addDays(parseDate(today), 30))) && (!o.fin || o.fin >= today))
      out.push({
        key: `ovide:${o.id}`,
        icone: '🕳️',
        message: `L'objectif « ${o.titre} » n'a aucune epic.`,
        actions: [{ label: '+ Epic', action: { kind: 'new', target: 'epic', defaults: { objectif: o.id } }, principal: true }],
      });
  }
  return out;
}

/** Alerte de dates d'une barre de la roadmap, sous forme d'alerte (pour la compter et pouvoir l'ignorer). */
export const dateCheck = (kind: 'epic' | 'objectif', parentId: string, a: Alerte): Check => ({
  key: `dates:${kind}:${parentId}:${a.key}`,
  icone: '📆',
  message: a.message,
  actions: [],
});
/** Toutes les alertes de dates affichées sur les barres de la roadmap. */
export const checksDates = (h: HierarchyValue): Check[] => [
  ...h.epicList.flatMap((e) => alertesEpic(e, h.items, h.featureList).map((a) => dateCheck('epic', e.id, a))),
  ...h.objectifList.flatMap((o) => alertesObjectif(o, h.epicList, h.items).map((a) => dateCheck('objectif', o.id, a))),
];

// ---------------------------------------------------------------------------
// 5. Portefeuille : « est-ce que je m'éparpille ? »
// ---------------------------------------------------------------------------
export function checksPortefeuille(h: HierarchyValue, today: string): Check[] {
  const out: Check[] = [];
  for (const e of h.epicList) {
    const tasks = tasksOfEpic(e.id, h.items, h.featureList).filter((t) => !t.periodicite);
    const ouvertes = tasks.filter((t) => t.statut !== 'termine').length;
    const etat = etatEpic(e, today);
    // État « Terminé » choisi à la main (une epic seulement arrivée à sa fin est traitée dans la Roadmap)
    if (e.etat === 'termine' && ouvertes)
      out.push({
        key: `etat1:${e.id}`,
        icone: '✅',
        message: `L'epic « ${e.titre} » est « Terminée », mais ${ouvertes} tâche${ouvertes > 1 ? 's sont' : ' est'} encore ouverte${ouvertes > 1 ? 's' : ''}.`,
        actions: [
          { label: "Remettre l'epic en cours", action: { kind: 'entity', entity: 'epic', id: e.id, patch: { etat: 'en_cours' } }, principal: true },
          { label: "Ouvrir l'epic", action: { kind: 'open', target: 'epic', id: e.id } },
        ],
      });
    // Epic pas encore lancée (Idée, Analyse, Prêt) alors que des tâches sont commencées ou faites
    // (toutes faites : c'est « Marquer l'epic terminée » qui s'applique, pas « Passer en cours »)
    const commencees = tasks.filter((t) => t.statut !== 'a_faire').length;
    if ((etat === 'idee' || etat === 'analyse' || etat === 'pret') && commencees && ouvertes)
      out.push({
        key: `etat3:${e.id}`,
        icone: '▶️',
        message: `L'epic « ${e.titre} » est à l'état ${ETATS_EPIC.find((x) => x.value === etat)?.label ?? etat}, mais ${commencees} tâche${commencees > 1 ? 's sont commencées' : ' est commencée'}.`,
        actions: [
          { label: "Passer l'epic En cours", action: { kind: 'entity', entity: 'epic', id: e.id, patch: { etat: 'en_cours' } }, principal: true },
          { label: "Ouvrir l'epic", action: { kind: 'open', target: 'epic', id: e.id } },
        ],
      });
    if (etat !== 'termine' && tasks.length && !ouvertes)
      out.push({
        key: `etat2:${e.id}`,
        icone: '✅',
        message: `Toutes les tâches de l'epic « ${e.titre} » sont faites, mais elle n'est pas « Terminée ».`,
        actions: [{ label: "Marquer l'epic terminée", action: { kind: 'entity', entity: 'epic', id: e.id, patch: { etat: 'termine' } }, principal: true }],
      });
  }

  // Objectif dont l'indicateur prend du retard sur le temps écoulé
  for (const o of h.objectifList) {
    const cible = parseFloat(o.cible);
    // (échéance passée : l'alerte « en retard » est dans la Roadmap)
    if (!(cible > 0) || !o.debut || !o.fin || o.debut > today || o.fin < today) continue;
    const duree = parseDate(o.fin).getTime() - parseDate(o.debut).getTime();
    if (duree <= 0) continue;
    const temps = Math.min(1, (parseDate(today).getTime() - parseDate(o.debut).getTime()) / duree);
    const resultat = Math.min(1, (parseFloat(o.actuel) || 0) / cible);
    if (temps >= 0.2 && resultat < temps - 0.25)
      out.push({
        key: `indic:${o.id}`,
        // (le % de temps bouge chaque jour : l'alerte ignorée revient si le résultat ou l'objectif change)
        situation: `Résultat ${o.actuel || 0}/${o.cible} · du ${o.debut} au ${o.fin}`,
        icone: '📈',
        message: `L'objectif « ${o.titre} » : ${Math.round(temps * 100)} % du temps écoulé, ${Math.round(resultat * 100)} % du résultat (${o.actuel || 0}/${o.cible}${o.unite ? ` ${o.unite}` : ''}).`,
        actions: [{ label: "Mettre à jour l'objectif", action: { kind: 'open', target: 'objectif', id: o.id }, principal: true }],
      });
  }

  // Domaine délaissé : rien de fait depuis 2 mois et rien de prévu. Une epic « en cours » ne suffit pas :
  // elle ne compte que par ses tâches (faites récemment ou prévues).
  const il60 = toDateString(addDays(parseDate(today), -60));
  const itNow = itStart(iterationOf(today).key);
  const prevue = (t: Item) =>
    t.periodicite
      ? !t.fin || t.fin >= today
      : (!!t.date && t.date >= today) || (!!t.date_fin && t.date_fin >= today) || (!t.date && !!t.iteration && itStart(t.iteration) >= itNow);
  for (const d of h.domaineList) {
    // Un domaine créé il y a moins de 2 mois n'est pas « délaissé »
    if ((d.cree_le || '').slice(0, 10) > il60) continue;
    // Un domaine vit aussi par ses sous-domaines (Perso n'est pas délaissé si Santé est actif)
    const dansD = (t: Item) => {
      const x = domaineOf(t, h);
      return !!x && (x.id === d.id || x.parent === d.id);
    };
    const vivant = h.items.some(
      (t) => dansD(t) && (t.statut === 'termine' ? (t.termine_le || (t.modifie_le || '').slice(0, 10)) >= il60 : prevue(t)),
    );
    if (!vivant)
      out.push({
        key: `domaine:${d.id}`,
        icone: '⚖️',
        message: `Le domaine ${nomDomaine(d, h.domaines)} est délaissé : rien de fait depuis 2 mois et rien de prévu.`,
        actions: [
          { label: '+ Tâche dans ce domaine', action: { kind: 'new', target: 'task', defaults: { domaine: d.id } }, principal: true },
          { label: '+ Epic dans ce domaine', action: { kind: 'new', target: 'epic', defaults: { domaine: d.id } } },
        ],
      });
  }
  return out;
}

/** Itération / PI examinés pour les pastilles des onglets : ceux d'aujourd'hui (et l'itération qui vient de finir). */
export function checksParEcran(
  complet: HierarchyValue,
  today: string,
  capacite: number,
  safe: boolean,
  dom = 'tous',
  opts: { jours?: boolean; maintenant?: number } = {},
) {
  const jours = opts.jours ?? true;
  const h = filtrerDomaine(complet, dom);
  const it = iterationOf(today).key;
  const precedente = shiftIteration(it, -1);
  return {
    taches: checksTaches(h, today, { complet, maintenant: opts.maintenant }),
    roadmap: checksRoadmap(h, today),
    iteration: safe
      ? [
          ...checksIteration(h, precedente, today, capacite, complet, jours).filter((c) => c.key.startsWith('fin:')),
          ...checksIteration(h, it, today, capacite, complet, jours),
        ]
      : [],
    // PI : celui d'aujourd'hui, plus « noter la valeur obtenue » du PI qui vient de finir
    pi: safe
      ? [
          ...checksPI(h, shiftPi(iterationOf(today).pi, -1), today, capacite, complet, jours).filter((c) => c.key.startsWith('note:')),
          ...checksPI(h, iterationOf(today).pi, today, capacite, complet, jours),
        ]
      : [],
    portefeuille: safe ? checksPortefeuille(h, today) : [],
  };
}

/** Alertes de dates des barres de la roadmap, dans le domaine filtré. */
export const checksDatesDomaine = (complet: HierarchyValue, dom = 'tous') => checksDates(filtrerDomaine(complet, dom));

/**
 * Toutes les alertes qui existent aujourd'hui (clé + message), pour nettoyer les alertes ignorées dont la
 * situation n'existe plus. Large exprès pour ne rien effacer à tort : chaque filtre de domaine possible,
 * modes Simple et SAFe, toutes les itérations du PI en cours et du suivant (et l'itération qui vient de finir).
 */
export function signaturesExistantes(complet: HierarchyValue, today: string, capacite: number, jours = true): Set<string> {
  const out = new Set<string>();
  const add = (cs: Check[]) => cs.forEach((c) => out.add(`${c.key}\u0000${situationDe(c)}`));
  const pi = iterationOf(today).pi;
  const pis = [shiftPi(pi, -1), pi, shiftPi(pi, 1)];
  const its = [shiftIteration(iterationOf(today).key, -1), ...pis.flatMap((p) => iterationsOf(p).map((it) => it.key))];
  for (const dom of ['tous', '', ...complet.domaineList.map((d) => d.id)]) {
    const h = filtrerDomaine(complet, dom);
    add(checksTaches(h, today, { complet }));
    add(checksRoadmap(h, today));
    add(checksPortefeuille(h, today));
    add(checksDates(h));
    for (const p of pis) add(checksPI(h, p, today, capacite, complet, jours));
    for (const k of its) add(checksIteration(h, k, today, capacite, complet, jours));
  }
  return out;
}
