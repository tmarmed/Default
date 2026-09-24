import { alertesEpic, alertesObjectif, fmtDate } from './alerts';
import { addDays, addMonths, parseDate, toDateString } from './dates';
import { domaineOf, progressObjectif, tasksOfEpic } from './hierarchy';
import { makeHierarchyValue } from './hierarchyContext';
import type { HierarchyValue } from './hierarchyContext';
import { iterationByKey, iterationOf, iterationOfItem, iterationsOf, piEnd, piLabel, piStart, pointsOf, shiftIteration } from './pi';
import { recurrenceState } from './recurrence';
import { etatEpic } from './safe';
import { chargeOf, pointsCheck, subtaskMap } from './subtasks';
import type { Item } from './types';

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
  icone: string;
  message: string;
  actions: { label: string; action: Action; principal?: boolean }[];
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const court = (d: string) => {
  const [, m, j] = d.split('-').map(Number);
  return `${j === 1 ? '1er' : j} ${MOIS[m - 1]}`;
};
const mot = (t: Item) => (t.type === 'rendez-vous' ? 'le rendez-vous' : t.type === 'demarche' ? 'la démarche' : t.parent ? 'la sous-tâche' : 'la tâche');
const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
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
  const ok = (id: string | undefined) => (id ?? '') === dom;
  const epics = h.epicList.filter((e) => ok(domaineOf({ epic: e.id }, h)?.id));
  const epicIds = new Set(epics.map((e) => e.id));
  return makeHierarchyValue(
    epics,
    h.objectifList.filter((o) => ok(o.domaine)),
    h.domaineList.filter((d) => d.id === dom),
    h.items.filter((t) => ok(domaineOf(t, h)?.id)),
    h.featureList.filter((f) => epicIds.has(f.epic) || (!f.epic && dom === '')),
    h.objectifsPI.filter((o) => ok(o.domaine)),
  );
}

/** Types qu'on estime en points (pas les rendez-vous ni les appels) */
const avecPoints = (t: Item) => t.type !== 'rendez-vous' && t.type !== 'appel';

// ---------------------------------------------------------------------------
// 1. Tâches : « qu'est-ce qui cloche aujourd'hui ? »
// ---------------------------------------------------------------------------
export function checksTaches(h: HierarchyValue, today: string): Check[] {
  const out: Check[] = [];
  const items = h.items;
  const demain = toDateString(addDays(parseDate(today), 1));

  // En retard : reporter à demain, ou choisir une date
  const retard = items.filter((t) => ouvert(t) && t.date && t.date < today).sort((a, b) => a.date.localeCompare(b.date));
  if (retard.length > 1)
    out.push({
      key: 'retard:tout',
      icone: '⏰',
      message: `${retard.length} tâches sont en retard.`,
      actions: [{ label: 'Tout reporter à demain', action: { kind: 'tasks', patches: retard.map((t) => ({ id: t.id, date: demain })) }, principal: true }],
    });
  for (const t of retard)
    out.push({
      key: `retard:${t.id}`,
      icone: '⏰',
      message: `${maj(mot(t))} « ${t.titre} » est en retard (${t.type === 'rendez-vous' ? 'prévu' : 'prévue'} le ${court(t.date)}).`,
      actions: [
        { label: 'Reporter à demain', action: { kind: 'task', id: t.id, patch: { date: demain } }, principal: true },
        { label: 'Choisir une date', action: { kind: 'open', target: 'task', id: t.id } },
      ],
    });

  // Tâches répétées avec des périodes oubliées : cocher la plus ancienne, ou tout rattraper
  for (const t of items.filter((x) => x.periodicite && x.statut !== 'termine')) {
    const { missed } = recurrenceState(t, today);
    if (!missed.length) continue;
    const faits = (keys: string[]) => [...new Set([...t.faits.split(';').filter(Boolean), ...keys])].sort().join(';');
    out.push({
      key: `repete:${t.id}`,
      icone: '🔁',
      message: `La tâche répétée « ${t.titre} » est en retard : ${missed.map((o) => o.label).join(', ')}.`,
      actions: [
        { label: `Cocher ${missed[0].label}`, action: { kind: 'task', id: t.id, patch: { faits: faits([missed[0].key]) } }, principal: true },
        ...(missed.length > 1
          ? [{ label: `Tout rattraper (${missed.length})`, action: { kind: 'task', id: t.id, patch: { faits: faits(missed.map((o) => o.key)) } } as Action }]
          : []),
      ],
    });
  }

  // Rendez-vous qui se chevauchent : même jour, créneaux qui se recouvrent (sans heure de fin : 1 h estimée)
  const rdv = items
    .filter((t) => ouvert(t) && t.type === 'rendez-vous' && t.date >= today && t.heure)
    .sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
  const debut = (t: Item) => minutes(t.heure);
  const fin = (t: Item) => (t.heure_fin && t.heure_fin > t.heure ? minutes(t.heure_fin) : debut(t) + 60);
  const creneau = (t: Item) => (t.heure_fin && t.heure_fin > t.heure ? `${t.heure} → ${t.heure_fin}` : `${t.heure}, fin non indiquée : 1 h estimée`);
  for (let i = 0; i < rdv.length; i++)
    for (let j = i + 1; j < rdv.length && rdv[j].date === rdv[i].date; j++) {
      const [a, b] = [rdv[i], rdv[j]];
      if (debut(b) >= fin(a)) continue;
      const recouvre = Math.min(fin(a), fin(b)) - Math.max(debut(a), debut(b));
      // Proposition : décaler le 2e rendez-vous juste après le 1er, en gardant sa durée
      const duree = fin(b) - debut(b);
      const nouveau = fin(a);
      const decaler =
        nouveau + duree <= 23 * 60 + 59
          ? [
              {
                label: `Décaler « ${b.titre} » à ${hhmm(nouveau)}`,
                action: { kind: 'task', id: b.id, patch: { heure: hhmm(nouveau), heure_fin: hhmm(nouveau + duree) } } as Action,
                principal: true,
              },
            ]
          : [];
      out.push({
        key: `rdv:${a.id}:${b.id}`,
        icone: '📅',
        message:
          recouvre === fin(b) - debut(b) && recouvre < fin(a) - debut(a)
            ? `Le ${court(a.date)}, le rendez-vous « ${b.titre} » (${creneau(b)}) a lieu pendant le rendez-vous « ${a.titre} » (${creneau(a)}).`
            : `Le ${court(a.date)}, le rendez-vous « ${a.titre} » (${creneau(a)}) et le rendez-vous « ${b.titre} » (${creneau(b)}) se chevauchent${recouvre < fin(b) - debut(b) || recouvre < fin(a) - debut(a) ? ` de ${dureeTxt(recouvre)}` : ''}.`,
        actions: [
          ...decaler,
          { label: `Ouvrir « ${a.titre} »`, action: { kind: 'open', target: 'task', id: a.id } },
          { label: `Ouvrir « ${b.titre} »`, action: { kind: 'open', target: 'task', id: b.id } },
        ],
      });
    }

  // Démarche ou tâche importante due dans moins de 3 jours et pas commencée
  const limite = toDateString(addDays(parseDate(today), 3));
  for (const t of items)
    // (pas les rendez-vous : ils ont lieu à leur date, on ne les « commence » pas)
    if (t.statut === 'a_faire' && !t.periodicite && t.type !== 'rendez-vous' && t.date && t.date >= today && t.date <= limite && (t.type === 'demarche' || t.priorite === 'haute'))
      out.push({
        key: `bientot:${t.id}`,
        icone: '🗂️',
        message: `${maj(mot(t))} « ${t.titre} »${t.priorite === 'haute' ? ' (priorité haute)' : ''} est prévue le ${court(t.date)} et n'est pas encore commencée.`,
        actions: [
          { label: 'Commencer', action: { kind: 'task', id: t.id, patch: { statut: 'en_cours' } }, principal: true },
          { label: 'Ouvrir', action: { kind: 'open', target: 'task', id: t.id } },
        ],
      });

  // Sous-tâches : tout est fait mais le parent ne l'est pas ; points incohérents
  const subs = subtaskMap(items);
  for (const [pid, kids] of subs) {
    const p = items.find((t) => t.id === pid);
    if (!p) continue;
    if (p.statut !== 'termine' && kids.every((k) => k.statut === 'termine'))
      out.push({
        key: `parent:${p.id}`,
        icone: '✓',
        message: `Toutes les sous-tâches de ${mot(p).replace('la sous-tâche', 'la tâche')} « ${p.titre} » sont faites.`,
        actions: [{ label: `Terminer « ${p.titre} »`, action: { kind: 'task', id: p.id, patch: { statut: 'termine' } }, principal: true }],
      });
    const c = pointsCheck(p, kids);
    if (c.alerte)
      out.push({
        key: `points:${p.id}`,
        icone: '🔢',
        message: `La tâche « ${p.titre} » : ${nb(c.parent)} j prévus, ${nb(c.sous)} j dans ses sous-tâches.`,
        actions: [
          { label: `Passer la tâche à ${nb(c.sous)} j`, action: { kind: 'task', id: p.id, patch: { points: String(c.sous) } }, principal: true },
          { label: 'Ouvrir la tâche', action: { kind: 'open', target: 'task', id: p.id } },
        ],
      });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Itération : « est-ce que je tiens mon itération ? »
// ---------------------------------------------------------------------------
export function checksIteration(h: HierarchyValue, itKey: string, today: string, capacite: number, complet: HierarchyValue = h): Check[] {
  const out: Check[] = [];
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
      message: `${it.code} est surchargée : ${nb(chargeAll)} j pour ${capacite} j de capacité.`,
      actions: [],
    });

  // Points incohérents : parent ≠ total de ses sous-tâches (parents présents dans l'itération)
  const parents = new Set<string>();
  for (const t of h.items) if (iterationOfItem(t) === itKey) parents.add(t.parent || t.id);
  for (const pid of parents) {
    const p = h.items.find((t) => t.id === pid);
    const c = p ? pointsCheck(p, subs.get(pid)) : undefined;
    if (p && c?.alerte)
      out.push({
        key: `points:${p.id}`,
        icone: '🔢',
        message: `La tâche « ${p.titre} » : ${nb(c.parent)} j prévus, ${nb(c.sous)} j dans ses sous-tâches.`,
        actions: [
          { label: `Passer la tâche à ${nb(c.sous)} j`, action: { kind: 'task', id: p.id, patch: { points: String(c.sous) } }, principal: true },
          { label: 'Ouvrir la tâche', action: { kind: 'open', target: 'task', id: p.id } },
        ],
      });
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
        icone: '📉',
        message: `En retard sur le burndown : il reste ${nb(reste)} j, l'idéal à cette date serait ${nb(ideal)} j.`,
        actions: [],
      });
  }

  // Fin d'itération (terminée, ou dans 2 jours au plus) avec des tâches non faites
  const bientotFinie = toDateString(addDays(parseDate(today), 2)) >= it.end;
  const nonFaites = tasks.filter((t) => ouvert(t));
  if (bientotFinie && nonFaites.length) {
    const suivante = shiftIteration(itKey, 1);
    const code = iterationByKey(suivante)!.code;
    const sansDate = nonFaites.filter((t) => !t.date);
    const datees = nonFaites.length - sansDate.length;
    out.push({
      key: `fin:${itKey}`,
      icone: '↪️',
      message: `${it.end < today ? 'Itération terminée' : `Fin de l'itération le ${court(it.end)}`} : ${nonFaites.length} tâche${nonFaites.length > 1 ? 's' : ''} non faite${nonFaites.length > 1 ? 's' : ''}${datees ? ` (dont ${datees} datée${datees > 1 ? 's' : ''} : changez leur date)` : ''}.`,
      actions: sansDate.length
        ? [
            {
              label: `Reporter ${sansDate.length > 1 ? `les ${sansDate.length} tâches` : 'la tâche'} en ${code}`,
              action: { kind: 'tasks', patches: sansDate.map((t) => ({ id: t.id, iteration: suivante })) },
              principal: true,
            },
          ]
        : [],
    });
  }

  // Tâches sans points (on ignore un parent dont les sous-tâches ont des points)
  const sansPoints = tasks.filter((t) => ouvert(t) && avecPoints(t) && !pointsOf(t) && !(subs.get(t.id) ?? []).some((c) => pointsOf(c) > 0));
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
export function checksPI(h: HierarchyValue, piKey: string, today: string, capacite: number, complet: HierarchyValue = h): Check[] {
  const out: Check[] = [];
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
        message: `${it.code} est surchargée : ${nb(charge)} j pour ${capacite} j de capacité.`,
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
        message: `La feature « ${f.titre} » : ${nb(fp)} j prévus, ${nb(tp)} j dans ses tâches.`,
        actions: [
          { label: `Passer la feature à ${nb(tp)} j`, action: { kind: 'entity', entity: 'feature', id: f.id, patch: { points: String(+tp.toFixed(1)) } }, principal: true },
          { label: 'Ouvrir la feature', action: { kind: 'open', target: 'feature', id: f.id } },
        ],
      });
  }

  // Objectif du PI engagé sans feature pour le porter (même domaine, ou aucune feature dans le PI)
  const featDom = (fid: string) => domaineOf({ feature: fid }, h)?.id ?? '';
  for (const o of h.objectifsPI.filter((x) => x.pi === piKey && x.type === 'engage')) {
    const porteuses = features.filter((f) => !o.domaine || featDom(f.id) === o.domaine);
    if (!porteuses.length)
      out.push({
        key: `opi:${o.id}`,
        icone: '🤝',
        message: `L'objectif du PI « ${o.titre} » est engagé, mais aucune feature${o.domaine ? ` de son domaine` : ''} n'est prévue dans ce PI.`,
        actions: [{ label: "Ouvrir l'objectif du PI", action: { kind: 'open', target: 'objectifpi', id: o.id } }],
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
    if (!toutes.length && !terminee && (!e.fin || e.fin >= today))
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
    if (!epics.length && !directes.length && (!o.fin || o.fin >= today))
      out.push({
        key: `ovide:${o.id}`,
        icone: '🕳️',
        message: `L'objectif « ${o.titre} » n'a aucune epic.`,
        actions: [{ label: '+ Epic', action: { kind: 'new', target: 'epic', defaults: { objectif: o.id } }, principal: true }],
      });
  }
  return out;
}

/** Nombre d'alertes de dates affichées sur les barres de la roadmap. */
export const nbAlertesDates = (h: HierarchyValue) =>
  h.epicList.reduce((n, e) => n + alertesEpic(e, h.items, h.featureList).length, 0) +
  h.objectifList.reduce((n, o) => n + alertesObjectif(o, h.epicList, h.items).length, 0);

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
        icone: '📈',
        message: `L'objectif « ${o.titre} » : ${Math.round(temps * 100)} % du temps écoulé, ${Math.round(resultat * 100)} % du résultat (${o.actuel || 0}/${o.cible}${o.unite ? ` ${o.unite}` : ''}).`,
        actions: [{ label: "Mettre à jour l'objectif", action: { kind: 'open', target: 'objectif', id: o.id }, principal: true }],
      });
  }

  // Domaine délaissé : aucune epic en cours et aucune tâche terminée depuis 60 jours
  const il60 = toDateString(addDays(parseDate(today), -60));
  for (const d of h.domaineList) {
    const epics = h.epicList.filter((e) => domaineOf({ epic: e.id }, h)?.id === d.id);
    const actif = epics.some((e) => etatEpic(e, today) === 'en_cours');
    const recent = h.items.some(
      (t) => domaineOf(t, h)?.id === d.id && (t.statut !== 'termine' ? !!t.date && t.date >= today : (t.modifie_le || '').slice(0, 10) >= il60),
    );
    if (!actif && !recent)
      out.push({
        key: `domaine:${d.id}`,
        icone: '⚖️',
        message: `Le domaine ${d.icone} ${d.nom} est délaissé : aucune epic en cours ni rien de fait depuis 2 mois.`,
        actions: [{ label: '+ Epic dans ce domaine', action: { kind: 'new', target: 'epic', defaults: { domaine: d.id } }, principal: true }],
      });
  }
  return out;
}

/** Itération / PI examinés pour les pastilles des onglets : ceux d'aujourd'hui (et l'itération qui vient de finir). */
export function checksParEcran(complet: HierarchyValue, today: string, capacite: number, safe: boolean, dom = 'tous') {
  const h = filtrerDomaine(complet, dom);
  const it = iterationOf(today).key;
  const precedente = shiftIteration(it, -1);
  return {
    taches: checksTaches(h, today),
    roadmap: checksRoadmap(h, today),
    iteration: safe
      ? [...checksIteration(h, precedente, today, capacite, complet).filter((c) => c.key.startsWith('fin:')), ...checksIteration(h, it, today, capacite, complet)]
      : [],
    pi: safe ? checksPI(h, iterationOf(today).pi, today, capacite, complet) : [],
    portefeuille: safe ? checksPortefeuille(h, today) : [],
  };
}

/** Nombre d'alertes de dates des barres de la roadmap, dans le domaine filtré. */
export const nbAlertesDatesDomaine = (complet: HierarchyValue, dom = 'tous') => nbAlertesDates(filtrerDomaine(complet, dom));
