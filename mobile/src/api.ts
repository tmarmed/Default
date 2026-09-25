import { DEMO, demoApiFor } from './demo';
import { adopterFichier, corbeille, creerFichierEspace, fichiersCorbeille, fichiersEspaces, magasinSheets, renommerFichier } from './gsheets';
import type { Data, DeletionCounts } from './hierarchy';
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
  if (!f) throw new Error("Cet espace n'est relié à aucun Google Sheet.");
  return { e, m: magasinSheets(f) };
};

export { adopterFichier, corbeille, creerFichierEspace, fichiersCorbeille, fichiersEspaces, renommerFichier };
function marquer<T extends { id: string }>(x: T, espace: string): T & { espace: string } {
  origine.set(x.id, espace);
  return { ...x, espace };
}
const LIENS_ITEM = ['parent', 'feature', 'epic', 'objectif', 'domaine'] as const;
/** Espace d'un rattachement (le premier trouvé) */
const espaceDesLiens = (data: Record<string, unknown>, champs: readonly string[]) =>
  champs.map((k) => (typeof data[k] === 'string' ? origine.get(data[k] as string) : undefined)).find(Boolean);
const LIENS_ENTITE = ['epic', 'objectif', 'domaine'] as const;
/** Pas de lien vers un élément d'un autre espace */
function verifierLiens(espace: string, data: Record<string, unknown>, champs: readonly string[]) {
  for (const k of champs) {
    const v = data[k];
    const autre = typeof v === 'string' && v ? origine.get(v) : undefined;
    if (autre && autre !== espace) throw new Error('Rattachement impossible : cet élément est dans un autre espace.');
  }
}

/** Complète les éléments d'un fichier ancien (sans colonnes de répétition). */
export function normalize(item: Item): Item {
  return { ...RECURRENCE_DEFAUTS, ...item };
}

/** Version des règles des données (les règles sont dans l'application : toujours la dernière) */
export const API_VERSION_SUPPR_SOUS_DOMAINES = 16;

const normalizeDomaine = (d: Domaine): Domaine => ({ ...d, parent: d.parent ?? '' });

const normalizeEpic = (e: Epic): Epic => ({ ...e, objectif: e.objectif ?? '', domaine: e.domaine ?? '', etat: e.etat ?? '' });

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
    features: m(all.features),
    objectifsPI: m(all.objectifsPI.map((o) => ({ ...o, domaine: o.domaine ?? '', epic: o.epic ?? '' }))),
    ignorees: m(all.ignorees ?? []),
    version: API_VERSION_SUPPR_SOUS_DOMAINES,
  };
}

type EntityMap = { epic: Epic; objectif: Objectif; domaine: Domaine; feature: Feature; objectifpi: ObjectifPI; ignoree: Ignoree };

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

export async function updateEntity<K extends EntityKind>(
  settings: Settings,
  kind: K,
  data: Partial<EntityMap[K]> & { id: string },
): Promise<EntityMap[K]> {
  const { e, m } = route(settings, espaceDe(data.id));
  verifierLiens(e, data as Record<string, unknown>, LIENS_ENTITE);
  return marquer(await m.updateEntity(kind, data as never), e) as unknown as EntityMap[K];
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
/** Supprime une tâche ; ses sous-tâches sont supprimées (cascade) ou deviennent des tâches normales. */
export async function deleteItem(settings: Settings, id: string, cascade = false): Promise<void> {
  await route(settings, espaceDe(id)).m.remove(id, cascade);
}
