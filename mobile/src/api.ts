import type { SerieReunion } from './series';
import { DEMO, demoApiFor } from './demo';
import type { EntiteOrg, KindOrg, Org } from './organisation';
import { adopterFichier, corbeille, creerFichierEspace, effacerFichier, fichierBudget, fichiersCorbeille, fichiersEspaces, magasinSheets, poidsFichiers, quotaDrive, renommerFichier } from './gsheets';
import type { Conge, CoutPersonne, Depense, JoursReels } from './types';
import type { Data, DeletionCounts } from './hierarchy';
import type { EquipeEspace, Magasin, PieceEntree, PieceJointe } from './magasin';
export type { PieceEntree, PieceJointe } from './magasin';
export type { EquipeEspace, RoleEquipe } from './magasin';
import {
  Domaine,
  ModeleDomaine,
  EntityKind,
  Epic,
  Feature,
  Ignoree,
  Item,
  ItemInput,
  Objectif,
  ObjectifPI,
  PointReunion,
  ResultatCle,
  Echange,
  ValueStream,
  RECURRENCE_DEFAUTS,
  Settings,
} from './types';

// ---------------------------------------------------------------------------
// Espaces : chaque espace est un Google Sheet. Chaque élément chargé est marqué de son espace (champ
// `espace`) et chaque écriture part vers le Sheet de son espace ; une création va vers l'espace indiqué
// (sinon l'espace par défaut). Pas de lien entre deux espaces.
// ---------------------------------------------------------------------------
const fichiers = new Map<string, string>();
const origine = new Map<string, string>();
let espaceParDefaut = 'moi';

/** Google Sheet de chaque espace, et espace des nouvelles créations sans espace précisé */
export function definirEspaces(list: { id: string; fichier?: string }[], parDefaut = 'moi') {
  fichiers.clear();
  for (const e of list) if (e.fichier) fichiers.set(e.id, e.fichier);
  espaceParDefaut = parDefaut;
}
export function definirEspaceParDefaut(id: string) {
  espaceParDefaut = id;
}
/** Retient l'espace d'éléments venus de la copie locale (hors connexion) */
export function retenirEspaces(list: { id: string; espace?: string }[]) {
  for (const x of list) if (x.espace) origine.set(x.id, x.espace);
}
/** Espace d'un élément déjà chargé */
export const espaceDe = (id: string | undefined) => (id ? origine.get(id) : undefined);

/** Espace d'une opération, et son magasin : démo (sur l'appareil) ou Google Sheet de l'espace */
const route = (_settings: Settings, espace: string | undefined) => {
  const e = espace || espaceParDefaut;
  if (DEMO) return { e, m: demoApiFor(e) };
  const f = fichiers.get(e);
  if (!f) throw new Error("Cet espace de travail n'est relié à aucun Google Sheet.");
  return { e, m: magasinSheets(f) };
};

export { adopterFichier, corbeille, creerFichierEspace, effacerFichier, fichiersCorbeille, fichiersEspaces, poidsFichiers, quotaDrive, renommerFichier };
function marquer<T extends { id: string }>(x: T, espace: string): T & { espace: string } {
  origine.set(x.id, espace);
  return { ...x, espace };
}
const LIENS_ITEM = ['parent', 'feature', 'epic', 'objectif', 'domaine', 'equipe', 'responsable'] as const;
/** Espace d'un rattachement (le premier trouvé) */
const espaceDesLiens = (data: Record<string, unknown>, champs: readonly string[]) =>
  champs.map((k) => (typeof data[k] === 'string' ? origine.get(data[k] as string) : undefined)).find(Boolean);
const LIENS_ENTITE = ['epic', 'objectif', 'domaine', 'portfolio', 'train', 'equipe'] as const;
/** Pas de lien vers un élément d'un autre espace */
function verifierLiens(espace: string, data: Record<string, unknown>, champs: readonly string[]) {
  for (const k of champs) {
    const v = data[k];
    const autre = typeof v === 'string' && v ? origine.get(v) : undefined;
    if (autre && autre !== espace) throw new Error('Rattachement impossible : cet élément est dans un autre espace de travail.');
  }
}

/** Complète les éléments d'un fichier ancien (sans colonnes de répétition). */
export function normalize(item: Item): Item {
  return { ...RECURRENCE_DEFAUTS, ...item };
}

/** Version des règles des données (les règles sont dans l'application : toujours la dernière) */
export const API_VERSION_SUPPR_SOUS_DOMAINES = 16;

const normalizeDomaine = (d: Domaine): Domaine => ({ ...d, parent: d.parent ?? '' });

const normalizeEpic = (e: Epic): Epic => ({ ...e, objectif: e.objectif ?? '', domaine: e.domaine ?? '', etat: e.etat ?? '', portfolio: e.portfolio ?? '', value_streams: e.value_streams ?? '', okrs: e.okrs ?? '' });
const normalizeFeature = (f: Feature): Feature => ({ ...f, train: f.train ?? '', equipe: f.equipe ?? '' });

/** Charge un espace (par défaut : Moi) ; chaque élément est marqué de son espace. */
export async function listItems(settings: Settings, espace = 'moi'): Promise<Data & { version: number }> {
  const { m: d } = route(settings, espace);
  const m = <T extends { id: string }>(l: T[]) => l.map((x) => marquer(x, espace));
  const [items, all] = await Promise.all([d.list(), d.listAll()]);
  return {
    items: m(items.map(normalize)),
    epics: m(all.epics.map(normalizeEpic)),
    objectifs: m(all.objectifs),
    domaines: m(all.domaines.map(normalizeDomaine)),
    features: m(all.features.map(normalizeFeature)),
    objectifsPI: m(all.objectifsPI.map((o) => ({ ...o, domaine: o.domaine ?? '', epic: o.epic ?? '' }))),
    ignorees: m(all.ignorees ?? []),
    valueStreams: m(all.valueStreams ?? []),
    resultats: m(all.resultats ?? []),
    echanges: m(all.echanges ?? []),
    series: m(all.series ?? []),
    version: API_VERSION_SUPPR_SOUS_DOMAINES,
  };
}

type EntityMap = { epic: Epic; objectif: Objectif; domaine: Domaine; feature: Feature; objectifpi: ObjectifPI; ignoree: Ignoree; valuestream: ValueStream; resultat: ResultatCle; echange: Echange };

export async function createEntity<K extends EntityKind>(
  settings: Settings,
  kind: K,
  data: Omit<EntityMap[K], 'id' | 'cree_le' | 'modifie_le'>,
): Promise<EntityMap[K]> {
  // Les alertes ignorées sont personnelles : toujours dans l'espace Moi
  const { e, m } = route(
    settings,
    kind === 'ignoree' ? 'moi' : ((data as { espace?: string }).espace ?? espaceDesLiens(data as Record<string, unknown>, LIENS_ENTITE)),
  );
  verifierLiens(e, data as Record<string, unknown>, LIENS_ENTITE);
  return marquer(await m.createEntity(kind, data as never), e) as unknown as EntityMap[K];
}

/** Plusieurs créations et modifications d'une même table dans un espace, en un seul passage (quota Google) */
export async function ecrireLot<K extends EntityKind>(
  settings: Settings,
  espace: string,
  kind: K,
  creer: Omit<EntityMap[K], 'id' | 'cree_le' | 'modifie_le'>[],
  modifier: (Partial<EntityMap[K]> & { id: string })[],
): Promise<{ crees: EntityMap[K][]; modifies: EntityMap[K][] }> {
  const { e, m } = route(settings, espace);
  for (const d of [...creer, ...modifier]) verifierLiens(e, d as Record<string, unknown>, LIENS_ENTITE);
  const r = await m.ecrireLot(kind, creer as never, modifier as never);
  return { crees: r.crees.map((x) => marquer(x, e)) as unknown as EntityMap[K][], modifies: r.modifies.map((x) => marquer(x, e)) as unknown as EntityMap[K][] };
}

export async function updateEntity<K extends EntityKind>(
  settings: Settings,
  kind: K,
  data: Partial<EntityMap[K]> & { id: string },
): Promise<EntityMap[K]> {
  const { e, m } = route(settings, espaceDe(data.id));
  verifierLiens(e, data as Record<string, unknown>, LIENS_ENTITE);
  return marquer(await m.updateEntity(kind, data as never), e) as unknown as EntityMap[K];
}

/** Modifie un échange s'il n'est pas encore lu, sinon l'envoie en nouvel échange (voir magasin) */
export async function modifierEchange(settings: Settings, data: Partial<Echange> & { id: string; espace: string }): Promise<{ e: Echange; nouveau: boolean }> {
  const { e, m } = route(settings, data.espace);
  const r = await m.modifierEchange(data);
  return { e: marquer(r.e, e) as unknown as Echange, nouveau: r.nouveau };
}

/**
 * Crée des domaines (et leurs sous-domaines) dans un espace : domaines de base de Moi, ou copie à la création
 * d'un espace. Ceux que l'espace a déjà (même nom) ne sont pas recréés.
 */
export async function copierDomaines(settings: Settings, espace: string, modeles: ModeleDomaine[], existants: Domaine[] = []): Promise<Domaine[]> {
  const crees: Domaine[] = [];
  const meme = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  for (const m of modeles) {
    let p = existants.find((d) => !d.parent && meme(d.nom, m.nom));
    if (!p) {
      p = await createEntity(settings, 'domaine', { nom: m.nom, icone: m.icone, couleur: m.couleur, parent: '', espace });
      crees.push(p);
    }
    for (const x of m.sous ?? []) {
      if (existants.some((d) => d.parent === p.id && meme(d.nom, x.nom))) continue;
      crees.push(await createEntity(settings, 'domaine', { nom: x.nom, icone: x.icone, couleur: x.couleur, parent: p.id, espace }));
    }
  }
  return crees.map(normalizeDomaine);
}

/** Supprime un domaine / objectif / epic ; `cascade` supprime aussi ce qui est en dessous. */
export async function deleteEntity(settings: Settings, kind: EntityKind, id: string, cascade: boolean): Promise<DeletionCounts> {
  return route(settings, espaceDe(id)).m.deleteEntity(kind, id, cascade);
}

export async function createItem(settings: Settings, item: ItemInput): Promise<Item> {
  const { e, m } = route(settings, item.espace || espaceDesLiens(item as unknown as Record<string, unknown>, LIENS_ITEM));
  verifierLiens(e, item as unknown as Record<string, unknown>, LIENS_ITEM);
  return marquer(normalize(await m.create(item)), e);
}
export async function updateItem(settings: Settings, item: Partial<Item> & { id: string }): Promise<Item> {
  const { e, m } = route(settings, espaceDe(item.id));
  verifierLiens(e, item as unknown as Record<string, unknown>, LIENS_ITEM);
  return marquer(normalize(await m.update(item)), e);
}
/** Plusieurs tâches créées dans un espace en un seul passage (une lecture, une écriture : quota Google) */
export async function creerItems(settings: Settings, espace: string, inputs: ItemInput[]): Promise<Item[]> {
  const { e, m } = route(settings, espace);
  for (const i of inputs) verifierLiens(e, i as unknown as Record<string, unknown>, LIENS_ITEM);
  return (await m.creerItems(inputs.map((i) => ({ ...i, espace: e })))).map((x) => marquer(normalize(x), e));
}
/** Supprime une tâche ; ses sous-tâches sont supprimées (cascade) ou deviennent des tâches normales. */
/** Plusieurs tâches d'un même espace modifiées en un seul passage (une lecture, une écriture) */
export async function modifierItems(settings: Settings, espace: string, patches: (Partial<Item> & { id: string })[]): Promise<Item[]> {
  const { e, m } = route(settings, espace);
  return (await m.modifierItems(patches)).map((x) => marquer(normalize(x), e));
}
export async function deleteItem(settings: Settings, id: string, cascade = false): Promise<void> {
  await route(settings, espaceDe(id)).m.remove(id, cascade);
}

/** Stockage : supprime d'un espace les tâches terminées avant `avant` ; renvoie les tâches supprimées */
export async function purgerTerminees(settings: Settings, espace: string, avant: string): Promise<Item[]> {
  return route(settings, espace).m.purgerTerminees(avant);
}

// ---------------------------------------------------------------------------
// Organisation d'une entreprise (vue Entreprise et vue Delivery SAFe) : dans le Google Sheet de l'entreprise
// ---------------------------------------------------------------------------
/** Organisation d'un espace de travail Entreprise ; chaque élément est marqué de son espace */
export async function listOrg(settings: Settings, espace: string): Promise<Org> {
  const o = await route(settings, espace).m.listOrg();
  const m = <T extends { id: string }>(l: T[]) => l.map((x) => marquer(x, espace));
  return { personnes: m(o.personnes), unites: m(o.unites), portfolios: m(o.portfolios), trains: m(o.trains), equipes: m(o.equipes) };
}
/** Crée (sans id) ou modifie (avec id) un élément de l'Organisation de l'entreprise `espace` */
export async function saveOrg<K extends KindOrg>(settings: Settings, espace: string, kind: K, data: Partial<EntiteOrg<K>> & { id?: string }): Promise<EntiteOrg<K>> {
  const { espace: _e, ...propre } = data as Record<string, unknown>;
  return marquer(await route(settings, espace).m.saveOrg(kind, propre as never), espace) as unknown as EntiteOrg<K>;
}
/** Changer sa réponse tant que l'autre ne l'a pas prise en compte */
export async function changerReponse(settings: Settings, espace: string, id: string, reponse: string, note: string): Promise<Echange> {
  return marquer(await route(settings, espace).m.changerReponse(id, reponse, note), espace) as unknown as Echange;
}
/** Pièces jointes d'un échange, rangées dans le Sheet de son espace (renvoie les ids) */
export async function ajouterPieces(settings: Settings, espace: string, pieces: PieceEntree[]): Promise<string[]> {
  return route(settings, espace).m.ajouterPieces(pieces);
}
export async function lirePieces(settings: Settings, espace: string, ids: string[]): Promise<PieceJointe[]> {
  return route(settings, espace).m.lirePieces(ids);
}
/** Efface les pièces qu'aucun échange ne cite plus */
export async function purgerPieces(settings: Settings, espace: string): Promise<number> {
  return route(settings, espace).m.purgerPieces();
}
/** Espace Équipe : ses personnes et sa ligne d'équipe (rôles, membres) */
export async function listEquipe(settings: Settings, espace: string): Promise<EquipeEspace> {
  const o = await route(settings, espace).m.listEquipe();
  return { personnes: o.personnes.map((x) => marquer(x, espace)), equipes: o.equipes.map((x) => marquer(x, espace)) };
}
/** Espace Équipe : ajoute, modifie ou retire un membre (et son rôle) */
export async function ecrireMembre(settings: Settings, espace: string, nomEquipe: string, m: Parameters<Magasin['ecrireMembre']>[1]): Promise<EquipeEspace> {
  const o = await route(settings, espace).m.ecrireMembre(nomEquipe, m);
  return { personnes: o.personnes.map((x) => marquer(x, espace)), equipes: o.equipes.map((x) => marquer(x, espace)) };
}
/** Supprime un élément de l'Organisation (ce qui le désignait est vidé, rien d'autre n'est supprimé) */
export async function deleteOrg(settings: Settings, espace: string, kind: KindOrg, id: string): Promise<void> {
  await route(settings, espace).m.deleteOrg(kind, id);
}

// ---------------------------------------------------------------------------
// Réunions (lot 6) : points notés (onglet PointsReunion du Sheet de l'espace de l'équipe)
// ---------------------------------------------------------------------------
/** Points des réunions dont l'id commence par `prefixe` (ex. tous les dailies d'une équipe) : une lecture */
/** Séries de réunions créées ou modifiées dans l'espace (une lecture, une écriture pour tout le lot) */
export async function ecrireSeries(settings: Settings, espace: string, lot: SerieReunion[]): Promise<SerieReunion[]> {
  const propres = lot.map(({ espace: _e, ...x }) => x as SerieReunion);
  return (await route(settings, espace).m.ecrireSeries(propres)).map((x) => marquer(x, espace));
}
export async function lirePoints(settings: Settings, espace: string, prefixe: string): Promise<PointReunion[]> {
  return (await route(settings, espace).m.lirePoints(prefixe)).map((x) => ({ ...x, espace }));
}
/**
 * « ↻ Actualiser » d'une réunion : ses points, les tâches et les échanges de l'espace de l'équipe, en une seule
 * lecture groupée ; chaque élément est marqué de son espace
 */
export async function lireReunion(settings: Settings, espace: string, prefixe: string): Promise<{ points: PointReunion[]; items: Item[]; echanges: Echange[] }> {
  const r = await route(settings, espace).m.lireReunion(prefixe);
  return {
    points: r.points.map((x) => ({ ...x, espace })),
    items: r.items.map((x) => marquer(normalize(x), espace)),
    echanges: r.echanges.map((x) => marquer(x, espace)),
  };
}
/** Points créés, modifiés et retirés en un seul passage (une lecture, une écriture) */
export async function ecrirePoints(
  settings: Settings,
  espace: string,
  creer: Omit<PointReunion, 'id' | 'cree_le'>[],
  modifier: (Partial<PointReunion> & { id: string })[],
  retirer: string[] = [],
): Promise<{ crees: PointReunion[]; modifies: PointReunion[] }> {
  const r = await route(settings, espace).m.ecrirePoints(creer, modifier, retirer);
  return { crees: r.crees.map((x) => ({ ...x, espace })), modifies: r.modifies.map((x) => ({ ...x, espace })) };
}

// ---------------------------------------------------------------------------
// 💶 Budget (09/10) : Google Sheet « Budget » à part, un par entreprise (« budget@<espace> » en démo). Sans ce
// fichier (pas encore créé, ou pas partagé avec vous), le budget est vide : aucun montant n'est montré.
// ---------------------------------------------------------------------------
const fichiersBudget = new Map<string, string | null>();
async function routeBudget(espace: string, titre: string, creer: boolean) {
  if (DEMO) return demoApiFor(`budget@${espace}`);
  let f = fichiersBudget.get(espace);
  if (f === undefined || (!f && creer)) {
    const ent = fichiers.get(espace);
    if (!ent) throw new Error("Cet espace de travail n'est relié à aucun Google Sheet.");
    f = await fichierBudget(ent, titre, creer);
    fichiersBudget.set(espace, f);
  }
  return f ? magasinSheets(f) : null;
}
export async function lireBudget(espace: string): Promise<{ depenses: Depense[]; couts: CoutPersonne[]; accessible: boolean }> {
  const m = await routeBudget(espace, '', false);
  if (!m) return { depenses: [], couts: [], accessible: false };
  const r = await m.lireBudget();
  return { depenses: r.depenses.map((x) => ({ ...x, espace })), couts: r.couts.map((x) => ({ ...x, espace })), accessible: true };
}
export async function ecrireDepense(espace: string, titre: string, d: Partial<Depense> & { id?: string }): Promise<Depense> {
  const m = await routeBudget(espace, titre, true);
  return { ...(await m!.ecrireDepense(d)), espace };
}
export async function supprimerDepense(espace: string, id: string): Promise<void> {
  const m = await routeBudget(espace, '', false);
  if (m) await m.supprimerDepense(id);
}
export async function ecrireCout(espace: string, titre: string, personne: string, cout: string): Promise<CoutPersonne | null> {
  const m = await routeBudget(espace, titre, !!cout);
  return m ? m.ecrireCout(personne, cout) : null;
}

// 📅 Congés et jours réels (lot 2, 09/10) : dans le Google Sheet de l'espace
export async function lireConges(settings: Settings, espace: string): Promise<{ conges: Conge[]; joursReels: JoursReels[] }> {
  const { e, m } = route(settings, espace);
  const r = await m.lireConges();
  return { conges: r.conges.map((x) => ({ ...x, espace: e })), joursReels: r.joursReels.map((x) => ({ ...x, espace: e })) };
}
export async function ecrireConge(settings: Settings, espace: string, c: Partial<Conge> & { id?: string }): Promise<Conge> {
  const { e, m } = route(settings, espace);
  return { ...(await m.ecrireConge(c)), espace: e };
}
export async function supprimerConge(settings: Settings, espace: string, id: string): Promise<void> {
  await route(settings, espace).m.supprimerConge(id);
}
export async function validerJoursReels(settings: Settings, espace: string, lignes: Omit<JoursReels, 'id' | 'espace'>[]): Promise<JoursReels[]> {
  const { e, m } = route(settings, espace);
  return (await m.validerJoursReels(lignes)).map((x) => ({ ...x, espace: e }));
}
