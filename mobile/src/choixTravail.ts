import type { AutresChoix, GroupeChoix, OptionChoix } from './components/Choix';
import type { Domaine } from './types';
import { iterationOf, iterationsOf, piLabel, piOf, shiftPi } from './pi';
import { toDateString } from './dates';

/**
 * Listes des feuilles de choix (fiches de travail et Organisation) : le groupe du parent actuel d'abord, les
 * autres groupes repliés dans « Autres … » (un choix rare n'est jamais ouvert tout seul). Sans parent connu, tous
 * les groupes sont affichés.
 */
export interface Listes {
  groupes: GroupeChoix[];
  autres?: AutresChoix;
}

/** Range des éléments par groupe ; `prefere` : le groupe montré d'abord, les autres repliés */
export function grouper<T>(
  items: T[],
  cle: (x: T) => string,
  titre: (k: string) => string,
  opt: (x: T) => OptionChoix,
  prefere: string | undefined,
  titreAutres: string,
): Listes {
  const ordre: string[] = [];
  const par = new Map<string, OptionChoix[]>();
  for (const x of items) {
    const k = cle(x);
    if (!par.has(k)) {
      par.set(k, []);
      ordre.push(k);
    }
    par.get(k)!.push(opt(x));
  }
  // Groupe « sans parent » en dernier
  ordre.sort((a, b) => (a === '' ? 1 : 0) - (b === '' ? 1 : 0));
  const g = (k: string): GroupeChoix => ({ titre: titre(k), options: par.get(k)! });
  if (prefere !== undefined && par.has(prefere)) {
    const autres = ordre.filter((k) => k !== prefere).map(g);
    return { groupes: [g(prefere)], autres: autres.length ? { titre: titreAutres, groupes: autres } : undefined };
  }
  return { groupes: ordre.map(g) };
}

type H = {
  featureList: { id: string; titre: string; epic: string }[];
  epicList: { id: string; titre: string; objectif: string; domaine: string }[];
  objectifList: { id: string; titre: string; domaine: string }[];
  domaineList: Domaine[];
  features: Map<string, { epic: string }>;
  epics: Map<string, { titre: string; objectif: string; domaine: string }>;
  objectifs: Map<string, { titre: string; domaine: string }>;
  domaines: Map<string, Domaine>;
};

const nomDom = (h: H, id: string) => {
  const d = h.domaines.get(id);
  return d ? `${d.icone} ${d.nom}` : 'Sans domaine';
};

/** Features rangées par epic ; `ref` : feature actuelle ou de départ (son epic d'abord) */
export function listeFeatures(h: H, ref?: string, epicPrefere?: string): Listes {
  const e = (ref ? h.features.get(ref)?.epic : undefined) ?? epicPrefere;
  return grouper(
    h.featureList,
    (f) => f.epic || '',
    (k) => (k ? `🗂️ ${h.epics.get(k)?.titre ?? '?'}` : 'Sans epic'),
    (f) => ({ value: f.id, label: `🧩 ${f.titre}` }),
    e || undefined,
    'Autres epics',
  );
}

/** Epics rangées par objectif (ou domaine) */
export function listeEpics(h: H, ref?: string, objectifPrefere?: string): Listes {
  const cle = (e: { objectif: string; domaine: string }) => (e.objectif ? `o:${e.objectif}` : e.domaine ? `d:${e.domaine}` : '');
  const e = ref ? h.epics.get(ref) : undefined;
  const pref = e ? cle(e) : objectifPrefere ? `o:${objectifPrefere}` : undefined;
  return grouper(
    h.epicList,
    cle,
    (k) => (k.startsWith('o:') ? `🎯 ${h.objectifs.get(k.slice(2))?.titre ?? '?'}` : k.startsWith('d:') ? nomDom(h, k.slice(2)) : 'Sans objectif'),
    (x) => ({ value: x.id, label: `🗂️ ${x.titre}` }),
    pref,
    'Autres objectifs',
  );
}

/** Objectifs rangés par domaine */
export function listeObjectifs(h: H, ref?: string, domainePrefere?: string): Listes {
  const o = ref ? h.objectifs.get(ref) : undefined;
  return grouper(
    h.objectifList,
    (x) => x.domaine || '',
    (k) => (k ? nomDom(h, k) : 'Sans domaine'),
    (x) => ({ value: x.id, label: `🎯 ${x.titre}` }),
    o ? o.domaine || '' : domainePrefere,
    'Autres domaines',
  );
}

/** Domaines : les principaux, chacun suivi de ses sous-domaines (en retrait) ; `sauf` : exclus (lui-même…) */
export function listeDomaines(h: H, sauf: string[] = [], principauxSeulement = false): Listes {
  const principaux = h.domaineList.filter((d) => (!d.parent || !h.domaines.has(d.parent)) && !sauf.includes(d.id));
  const options: OptionChoix[] = [];
  for (const d of principaux) {
    options.push({ value: d.id, label: `${d.icone} ${d.nom}` });
    if (!principauxSeulement)
      for (const s of h.domaineList.filter((x) => x.parent === d.id && !sauf.includes(x.id))) options.push({ value: s.id, label: `${s.icone} ${s.nom}`, retrait: true });
  }
  return { groupes: [{ options }] };
}

/** PI proposés : le précédent, le courant et les 3 suivants (plus celui déjà choisi) */
export function listePI(courantChoisi?: string): Listes {
  const pi = piOf(new Date());
  const l = [-1, 0, 1, 2, 3].map((n) => shiftPi(pi, n));
  if (courantChoisi && !l.includes(courantChoisi)) l.push(courantChoisi);
  return {
    groupes: [
      {
        options: l.map((p) => ({ value: p, label: `PI ${piLabel(p)}`, badge: p === pi ? { texte: 'en cours', ton: 'vert' as const } : undefined })),
      },
    ],
  };
}

const fmtCourt = (d: string) => {
  const [, m, j] = d.split('-').map(Number);
  const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][m - 1];
  return `${j === 1 ? '1er' : j} ${mois}`;
};

/**
 * Itérations : celles du PI de la feature (sinon du PI en cours) d'abord, avec leurs dates, « en cours » et
 * « prévue » (itération prévue pour la feature) ; les autres PI repliés.
 */
export function listeIterations(piPrefere?: string, prevue?: string, choisie?: string): Listes {
  const courante = iterationOf(toDateString(new Date())).key;
  const piCourant = piOf(new Date());
  const pi = piPrefere || piCourant;
  const groupe = (p: string): GroupeChoix => ({
    titre: `PI ${piLabel(p)}${p === piPrefere ? ' · PI de la feature' : ''}`,
    options: iterationsOf(p).map((it) => ({
      value: it.key,
      label: it.code,
      meta: `${fmtCourt(it.start)} → ${fmtCourt(it.end)}`,
      badge: it.key === courante ? { texte: 'en cours', ton: 'vert' as const } : it.key === prevue ? { texte: 'prévue', ton: 'bleu' as const } : undefined,
    })),
  });
  const autres = [-1, 0, 1, 2].map((n) => shiftPi(piCourant, n)).filter((p) => p !== pi);
  const choisiePi = choisie ? choisie.split('-').slice(0, 2).join('-') : '';
  if (choisiePi && choisiePi !== pi && !autres.includes(choisiePi)) autres.push(choisiePi);
  return { groupes: [groupe(pi)], autres: { titre: 'Autres PI', groupes: autres.map(groupe) } };
}
