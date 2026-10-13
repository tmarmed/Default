/**
 * Avancement depuis la réunion précédente (13/10, session 3 ; docs/regles-reunions.html, bloc 13).
 *
 * À l'envoi de chaque réunion, une « photo » de l'état des éléments de son périmètre est enregistrée (lignes `donnee`
 * de PointsReunion, k = 'avancement', découpées pour tenir dans 1000 caractères) ; la réunion suivante compare la
 * situation actuelle à cette photo. Une ligne par élément et par sorte, du départ à l'arrivée : les allers-retours se
 * compensent. Aucune colonne ajoutée dans le Sheet.
 */
import type { DemandeBudget, Enveloppe, Epic, Feature, Item, Objectif, ObjectifPI, PointReunion, ResultatCle, StatutSuivi, TypeReunion } from './types';
import { ETATS_EPIC, STATUT_LABELS, TYPES_REUNION } from './types';

/** Niveau d'un élément (rangée « niveau » du filtre) */
export type NiveauAv = 'element' | 'feature' | 'epic' | 'budget' | 'objectif' | 'suivi';
/** Sorte de changement (rangée « sorte » du filtre) */
export type SorteAv = 'statut' | 'valeur' | 'echeance' | 'planning' | 'responsable' | 'ajoute';

export const NIVEAUX_AV: { v: NiveauAv; l: string }[] = [
  { v: 'element', l: 'Tâche · Story' },
  { v: 'feature', l: 'Feature' },
  { v: 'epic', l: 'Epic' },
  { v: 'budget', l: 'Budget' },
  { v: 'objectif', l: 'Objectif' },
  { v: 'suivi', l: 'Suivi' },
];
export const SORTES_AV: { v: SorteAv; l: string }[] = [
  { v: 'statut', l: 'Statut' },
  { v: 'valeur', l: 'Valeur' },
  { v: 'echeance', l: 'Échéance' },
  { v: 'planning', l: 'Sprint ou PI' },
  { v: 'responsable', l: 'Responsable' },
  { v: 'ajoute', l: 'Ajouté en cours de route' },
];
/** Ordre des champs d'un état (la sorte « ajoute » n'a pas de champ) */
const CHAMPS: SorteAv[] = ['statut', 'valeur', 'echeance', 'planning', 'responsable'];

/** Photo : clé « t:id » (tâche, story), « f:id » (feature), « q:id » (objectif du PI), « e:id » (epic), « v:id »
 * (enveloppe), « d:id » (demande de budget), « o:id » (objectif), « r:id » (résultat clé d'un OKR), « s:id » (point de suivi) → « statut|valeur|échéance|
 * sprint ou PI|responsable » */
export type Photo = Record<string, string>;
export interface FiltreAv {
  /** Sortes, niveaux et types de note (points de suivi : Risque, Blocage…) décochés (vide = tout coché) */
  sortes: SorteAv[];
  niveaux: NiveauAv[];
  types?: string[];
}
export const FILTRE_TOUT: FiltreAv = { sortes: [], niveaux: [], types: [] };
export const estFiltre = (f: FiltreAv) => f.sortes.length > 0 || f.niveaux.length > 0 || (f.types?.length ?? 0) > 0;

const NIVEAU_DE: Record<string, NiveauAv> = { t: 'element', f: 'feature', q: 'feature', e: 'epic', v: 'budget', d: 'budget', o: 'objectif', r: 'objectif', s: 'suivi' };
export const niveauDe = (cle: string): NiveauAv => NIVEAU_DE[cle.split(':')[0]] ?? 'element';
/** Rang d'un niveau : une réunion montre son niveau de focus et ceux au-dessus (règle A3) ; les suivis toujours */
const RANG: Record<NiveauAv, number> = { element: 0, feature: 1, epic: 2, budget: 2, objectif: 3, suivi: -1 };

/** Niveau de focus (rang) de chaque réunion (tableau validé le 13/10) */
export function focusDe(type: TypeReunion): number {
  if (['revue_objectifs', 'revue_trimestre', 'point_annuel', 'revue_mois', 'trimestre_simple', 'bilan_annuel', 'annuel_entreprise', 'revue_okr'].includes(type)) return 3;
  if (['sync_portfolio', 'revue_portfolio', 'budget', 'comite_budget'].includes(type)) return 2;
  if (['pi_planning', 'art_sync', 'system_demo', 'inspect_adapt', 'affinage_train', 'prepa_pi', 'iteration_ip'].includes(type)) return 1;
  return 0;
}
export const dansFocus = (cle: string, focus: number) => {
  const r = RANG[niveauDe(cle)];
  return r < 0 || r >= focus;
};

// ---------- Photo de la situation actuelle ----------

const val = (...c: (string | undefined)[]) => c.map((x) => (x ?? '').replace(/\|/g, '/')).join('|');
/** Statut d'une feature, déduit de ses stories (elle n'a pas de statut propre) */
export function statutFeature(f: Pick<Feature, 'id'>, items: Item[]): string {
  const st = items.filter((t) => t.feature === f.id && !t.parent);
  if (!st.length) return '';
  if (st.every((t) => t.statut === 'termine')) return 'termine';
  return st.some((t) => t.statut !== 'a_faire') ? 'en_cours' : 'a_faire';
}

/** Périmètre d'une réunion, assemblé par l'écran (règle A4) ; la photo est ensuite réduite au focus (règle A3) */
export interface Perimetre {
  items?: Item[];
  features?: Feature[];
  epics?: Epic[];
  objectifs?: Objectif[];
  /** Résultats clés des OKR (valeur actuelle) */
  resultats?: ResultatCle[];
  objectifsPI?: ObjectifPI[];
  enveloppes?: Enveloppe[];
  demandes?: DemandeBudget[];
  suivis?: PointReunion[];
  /** Tous les éléments (pour le statut des features) */
  tousItems?: Item[];
}

export function photoDe(p: Perimetre, focus: number): Photo {
  const out: Photo = {};
  const mettre = (cle: string, v: string) => {
    if (dansFocus(cle, focus)) out[cle] = v;
  };
  for (const t of p.items ?? []) mettre(`t:${t.id}`, val(t.statut, '', t.date_fin || t.date, t.iteration, t.responsable));
  for (const f of p.features ?? []) mettre(`f:${f.id}`, val(statutFeature(f, p.tousItems ?? p.items ?? []), '', '', f.pi, ''));
  for (const o of p.objectifsPI ?? []) mettre(`q:${o.id}`, val('', o.valeur_obtenue, '', o.pi, ''));
  for (const e of p.epics ?? []) mettre(`e:${e.id}`, val(e.etat, e.budget, e.fin, '', ''));
  for (const e of p.enveloppes ?? []) mettre(`v:${e.id}`, val('', e.montant, '', '', ''));
  for (const d of p.demandes ?? []) mettre(`d:${d.id}`, val(d.statut, d.statut === 'accordee' ? d.montant_accorde || d.montant : d.montant, '', '', ''));
  for (const o of p.objectifs ?? []) mettre(`o:${o.id}`, val('', o.actuel, o.fin, '', ''));
  for (const r of p.resultats ?? []) mettre(`r:${r.id}`, val('', r.actuel, '', '', ''));
  for (const s of p.suivis ?? []) mettre(`s:${s.id}`, val(s.statut || 'ouvert', '', s.echeance, '', s.responsable || s.personne));
  return out;
}

// ---------- Comparaison ----------

export interface LigneAv {
  cle: string;
  niveau: NiveauAv;
  sorte: SorteAv;
  /** Valeurs brutes (vides pour « ajouté ») */
  de: string;
  a: string;
}

/** Une ligne par élément et par sorte (règle A1) ; un élément entré dans le périmètre : « ajouté en cours de route » */
export function comparer(avant: Photo, apres: Photo, focus: number): LigneAv[] {
  const out: LigneAv[] = [];
  for (const [cle, v] of Object.entries(apres)) {
    if (!dansFocus(cle, focus)) continue;
    const niveau = niveauDe(cle);
    const ancien = avant[cle];
    if (ancien === undefined) {
      out.push({ cle, niveau, sorte: 'ajoute', de: '', a: '' });
      continue;
    }
    const a = v.split('|');
    const d = ancien.split('|');
    CHAMPS.forEach((sorte, i) => {
      if ((d[i] ?? '') !== (a[i] ?? '')) out.push({ cle, niveau, sorte, de: d[i] ?? '', a: a[i] ?? '' });
    });
  }
  const ordre = (l: LigneAv) => NIVEAUX_AV.findIndex((n) => n.v === l.niveau) * 10 + SORTES_AV.findIndex((s) => s.v === l.sorte);
  return out.sort((x, y) => ordre(x) - ordre(y));
}

/** `typeDe` : type de note d'un point de suivi (clé « s: »), pour la rangée « Type de note » */
export const filtrer = (lignes: LigneAv[], f: FiltreAv, typeDe?: (cle: string) => string) =>
  lignes.filter((l) => !f.sortes.includes(l.sorte) && !f.niveaux.includes(l.niveau) && !(l.niveau === 'suivi' && typeDe && f.types?.includes(typeDe(l.cle))));

// ---------- Enregistrement (lignes `donnee` de PointsReunion) ----------

export const K_AVANCEMENT = 'avancement';
const TAILLE = 900;

/** Textes JSON des lignes de la photo, découpés pour tenir dans la limite d'une cellule (1000 caractères) */
export function textesPhoto(photo: Photo, filtre: FiltreAv): string[] {
  const morceaux: Photo[] = [];
  let courant: Photo = {};
  let taille = 0;
  for (const [cle, v] of Object.entries(photo)) {
    const t = cle.length + v.length + 6;
    if (taille + t > TAILLE && Object.keys(courant).length) {
      morceaux.push(courant);
      courant = {};
      taille = 0;
    }
    courant[cle] = v;
    taille += t;
  }
  morceaux.push(courant);
  return morceaux.map((e, n) => JSON.stringify(n === 0 ? { k: K_AVANCEMENT, n, f: filtre, e } : { k: K_AVANCEMENT, n, e }));
}

interface MorceauPhoto {
  k: string;
  n: number;
  f?: FiltreAv;
  e: Photo;
}
function morceau(p: PointReunion): MorceauPhoto | null {
  if (p.type !== 'donnee') return null;
  try {
    const o = JSON.parse(p.texte) as MorceauPhoto;
    return o && o.k === K_AVANCEMENT && o.e && typeof o.e === 'object' ? o : null;
  } catch {
    return null;
  }
}
export const estLignePhoto = (p: PointReunion) => !!morceau(p);

export interface PhotoLue {
  reunion: string;
  photo: Photo;
  filtre: FiltreAv;
  /** Moment de l'envoi (cree_le le plus récent) */
  le: string;
  ids: string[];
}

/** Photos enregistrées, par réunion */
export function photos(points: PointReunion[]): PhotoLue[] {
  const par = new Map<string, PhotoLue>();
  for (const p of points) {
    const m = morceau(p);
    if (!m) continue;
    const x = par.get(p.reunion) ?? { reunion: p.reunion, photo: {}, filtre: FILTRE_TOUT, le: '', ids: [] };
    Object.assign(x.photo, m.e);
    if (m.f) x.filtre = { sortes: m.f.sortes ?? [], niveaux: m.f.niveaux ?? [], types: m.f.types ?? [] };
    if ((p.cree_le ?? '') > x.le) x.le = p.cree_le ?? '';
    x.ids.push(p.id);
    par.set(p.reunion, x);
  }
  return [...par.values()];
}

/**
 * Photo de la réunion précédente : la plus récente des réunions des séries données (`prefixes`), autre que celle-ci
 * et pas après son jour (en perso : ma réunion précédente, Point perso ou Bilan du soir, le même jour compris).
 */
export function photoPrecedente(points: PointReunion[], reunion: string, prefixes: string[]): PhotoLue | null {
  const jour = reunion.slice(-10);
  const ok = photos(points).filter((x) => x.reunion !== reunion && prefixes.some((p) => x.reunion.startsWith(p)) && x.reunion.slice(-10) <= jour);
  ok.sort((a, b) => (a.reunion.slice(-10) + a.le < b.reunion.slice(-10) + b.le ? -1 : 1));
  return ok.pop() ?? null;
}
/**
 * En perso (13/10) : ma réunion précédente peut aussi être un Daily de mon équipe, plus récent que mon dernier rituel.
 * La base reste la photo de mon rituel ; les photos des Dailies plus récentes (le même jour ou avant) la complètent
 * pour les éléments qu'elles contiennent. Sans photo de rituel : rien (première réunion).
 */
export function photoPrecedenteAvec(points: PointReunion[], reunion: string, prefixes: string[], complements: PointReunion[]): PhotoLue | null {
  const base = photoPrecedente(points, reunion, prefixes);
  if (!base || !complements.length) return base;
  const jour = reunion.slice(-10);
  const plusRecentes = photos(complements)
    .filter((x) => x.reunion.slice(-10) <= jour && x.le > base.le)
    .sort((a, b) => (a.le < b.le ? -1 : 1));
  if (!plusRecentes.length) return base;
  const photo: Photo = { ...base.photo };
  for (const x of plusRecentes) for (const [cle, v] of Object.entries(x.photo)) if (cle in photo) photo[cle] = v;
  const derniere = plusRecentes[plusRecentes.length - 1];
  return { ...base, reunion: derniere.reunion, le: derniere.le, photo };
}

export const photoDeLaReunion = (points: PointReunion[], reunion: string) => photos(points).find((x) => x.reunion === reunion) ?? null;

// ---------- Libellés ----------

const FEMININ: TypeReunion[] = ['planification', 'revue', 'retro', 'system_demo', 'revue_portfolio', 'revue_okr', 'prepa_pi', 'sync_portfolio', 'iteration_ip', 'revue_semaine', 'revue_objectifs', 'revue_trimestre', 'semaine_equipe', 'revue_mois', 'trimestre_simple', 'reunion', 'art_sync'];
const voyelle = (s: string) => /^[aeiouyéèêàâîïôûAEIOUYÉÈÊÀÂÎÏÔÛ]/.test(s);
const libelle = (type: TypeReunion) => TYPES_REUNION[type]?.libelle ?? 'Réunion';
/** « L'avancement sera visible à partir du prochain Daily » / « de la prochaine ART sync » (première réunion, A8) */
export const messagePremiere = (type: TypeReunion) => `L’avancement sera visible à partir ${FEMININ.includes(type) ? 'de la prochaine' : 'du prochain'} ${libelle(type)}.`;
/** « depuis le Daily du 12/10 », « depuis l'ART sync du 06/10 » */
export function depuis(reunionPrecedente: string): string {
  const type = reunionPrecedente.split('-')[0] as TypeReunion;
  const l = libelle(type);
  const art = voyelle(l) ? 'l’' : FEMININ.includes(type) ? 'la ' : 'le ';
  const j = reunionPrecedente.slice(-10);
  return `depuis ${art}${l} du ${j.slice(8, 10)}/${j.slice(5, 7)}`;
}

const LIB_SUIVI: Record<StatutSuivi | 'ouvert', string> = {
  '': 'Ouvert',
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  fait: 'Fait',
  valide: 'Validé',
  a_reprendre: 'À reprendre',
  abandonne: 'Abandonné',
  plus_suivi: 'Plus suivi',
};
const LIB_DEMANDE: Record<string, string> = { soumise: 'Soumise', accordee: 'Accordée', a_reprendre: 'À reprendre', refusee: 'Refusée' };
const euros = (s: string) => {
  const n = Number(String(s).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) && s !== '' ? `${n.toLocaleString('fr-FR')} €` : s;
};
const dateFr = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s);

/** Valeur lisible d'un champ, selon le niveau et la sorte */
export function valeurLisible(l: Pick<LigneAv, 'cle' | 'sorte'>, v: string, nom: (idOuMail: string) => string): string {
  const k = l.cle.split(':')[0];
  if (!v) return l.sorte === 'responsable' ? 'personne' : l.sorte === 'echeance' ? 'sans date' : l.sorte === 'planning' ? 'aucun' : '—';
  switch (l.sorte) {
    case 'statut':
      if (k === 'e') return ETATS_EPIC.find((x) => x.value === v)?.label ?? v;
      if (k === 's') return LIB_SUIVI[v as StatutSuivi] ?? v;
      if (k === 'd') return LIB_DEMANDE[v] ?? v;
      return STATUT_LABELS[v as keyof typeof STATUT_LABELS] ?? v;
    case 'valeur':
      if (k === 'e' || k === 'v' || k === 'd') return euros(v);
      if (k === 'q') return `${v} sur 10`;
      return v;
    case 'echeance':
      return dateFr(v);
    case 'planning':
      return /^\d{4}-T\d-IT\d+$/.test(v) ? `Sprint ${v.split('-IT')[1]} (${v.slice(0, 7)})` : /^\d{4}-T\d-IP$/.test(v) ? `Semaine IP (${v.slice(0, 7)})` : /^\d{4}-T\d$/.test(v) ? `PI ${v}` : v;
    case 'responsable':
      return nom(v);
    default:
      return v;
  }
}

/** Sous-ligne : « Statut : À faire → En cours », « Ajouté en cours de route » */
export function phrase(l: LigneAv, nom: (idOuMail: string) => string): string {
  if (l.sorte === 'ajoute') return 'Ajouté en cours de route';
  const s = SORTES_AV.find((x) => x.v === l.sorte)?.l ?? l.sorte;
  return `${s} : ${valeurLisible(l, l.de, nom)} → ${valeurLisible(l, l.a, nom)}`;
}

const ICONE: Record<NiveauAv, string> = { element: '', feature: '🧩 ', epic: '🗂️ ', budget: '💶 ', objectif: '🎯 ', suivi: '📌 ' };
export const iconeNiveau = (n: NiveauAv) => ICONE[n];

/** Lignes `donnee` de la photo à écrire avec l'envoi de la réunion (une seule écriture groupée, règle du quota) */
export function pointsPhoto(reunion: string, personne: string, photo: Photo, filtre: FiltreAv): Omit<PointReunion, 'id' | 'cree_le'>[] {
  const p = personne.toLowerCase();
  return textesPhoto(photo, filtre).map((texte) => ({ reunion, personne: p, auteur: p, type: 'donnee' as const, texte, element: '', concretisation: '' as const, tache: '', responsable: '' }));
}
