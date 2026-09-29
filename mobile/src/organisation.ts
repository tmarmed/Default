import { createContext, useContext, useMemo } from 'react';
import { useHierarchy } from './hierarchyContext';

/**
 * Organisation d'une entreprise (espace de travail 🏢), enregistrée dans son Google Sheet :
 * - vue Entreprise (hiérarchie) : unités (directions, services) et personnes, chacune avec son service et son manager ;
 * - vue Delivery SAFe : portfolios (et leurs epics) › trains (et leurs features) › équipes agiles (stories, tâches),
 *   avec leurs rôles (Epic Owner, RTE, Product Manager, Product Owner, Scrum Master) et leurs membres.
 * Les deux vues sont indépendantes : une personne a un manager dans la hiérarchie et une équipe dans le delivery.
 * Ajouter une personne ne donne aucun accès (le partage automatique viendra des rôles delivery).
 */

export interface Personne {
  espace?: string;
  id: string;
  nom: string;
  /** Compte Google */
  email: string;
  /** Unité (service) de la hiérarchie */
  unite: string;
  /** Manager (personne) */
  manager: string;
  /** Jours disponibles par itération, vide = non renseigné */
  capacite: string;
  cree_le: string;
  modifie_le: string;
}

export type TypeUnite = 'direction' | 'service';
export interface Unite {
  espace?: string;
  id: string;
  nom: string;
  type: TypeUnite;
  /** Unité au-dessus, vide = premier niveau */
  parent: string;
  /** Responsable (personne) */
  responsable: string;
  cree_le: string;
  modifie_le: string;
}

export interface Portfolio {
  espace?: string;
  id: string;
  nom: string;
  /** Epic Owner (personne) */
  epic_owner: string;
  cree_le: string;
  modifie_le: string;
}

export interface Train {
  espace?: string;
  id: string;
  nom: string;
  portfolio: string;
  /** Release Train Engineer (personne) */
  rte: string;
  /** Product Manager (personne) */
  pm: string;
  cree_le: string;
  modifie_le: string;
}

export interface EquipeAgile {
  espace?: string;
  id: string;
  nom: string;
  train: string;
  /** Product Owner et Scrum Master (personnes) : les rôles delivery qui pilotent le travail de l'équipe */
  po: string;
  sm: string;
  /** Membres : ids de personnes séparés par « ; » */
  membres: string;
  cree_le: string;
  modifie_le: string;
}

export type KindOrg = 'personne' | 'unite' | 'portfolio' | 'train' | 'equipeagile';
export type EntiteOrg<K extends KindOrg> = K extends 'personne'
  ? Personne
  : K extends 'unite'
    ? Unite
    : K extends 'portfolio'
      ? Portfolio
      : K extends 'train'
        ? Train
        : EquipeAgile;

export interface Org {
  personnes: Personne[];
  unites: Unite[];
  portfolios: Portfolio[];
  trains: Train[];
  equipes: EquipeAgile[];
}
export const ORG_VIDE: Org = { personnes: [], unites: [], portfolios: [], trains: [], equipes: [] };
export const CLE_ORG: Record<KindOrg, keyof Org> = { personne: 'personnes', unite: 'unites', portfolio: 'portfolios', train: 'trains', equipeagile: 'equipes' };

export const membresDe = (e: Pick<EquipeAgile, 'membres'>) => (e.membres ? e.membres.split(';').filter(Boolean) : []);

/** Libellés des éléments de l'organisation */
export const ICONE_ORG: Record<KindOrg, string> = { personne: '👤', unite: '🏛️', portfolio: '💼', train: '🚆', equipeagile: '👥' };
export const NOM_ORG: Record<KindOrg, string> = { personne: 'Personne', unite: 'Unité', portfolio: 'Portfolio', train: 'Train', equipeagile: 'Équipe' };

/** Organisation affichée (entreprises visibles), avec des accès rapides par id */
export interface OrgValue extends Org {
  personne: Map<string, Personne>;
  unite: Map<string, Unite>;
  portfolio: Map<string, Portfolio>;
  train: Map<string, Train>;
  equipe: Map<string, EquipeAgile>;
  /** Vrai si au moins un portfolio, un train ou une équipe existe (liaison avec le travail utile) */
  delivery: boolean;
}

export function makeOrgValue(o: Org): OrgValue {
  return {
    ...o,
    personne: new Map(o.personnes.map((x) => [x.id, x])),
    unite: new Map(o.unites.map((x) => [x.id, x])),
    portfolio: new Map(o.portfolios.map((x) => [x.id, x])),
    train: new Map(o.trains.map((x) => [x.id, x])),
    equipe: new Map(o.equipes.map((x) => [x.id, x])),
    delivery: o.portfolios.length + o.trains.length + o.equipes.length > 0,
  };
}

export const OrgContext = createContext<OrgValue>(makeOrgValue(ORG_VIDE));
export const useOrg = () => useContext(OrgContext);

/** Nom court d'une personne (vide si inconnue) */
export const nomPersonne = (o: Pick<OrgValue, 'personne'>, id: string | undefined) => (id ? (o.personne.get(id)?.nom ?? '') : '');

// ---------------------------------------------------------------------------
// Filtre Portfolio / Train / Équipe (bloc Filtres) et liaison organisation ↔ travail
// ---------------------------------------------------------------------------
export type OrgFiltre = { kind: 'portfolio' | 'train' | 'equipeagile'; id: string } | null;

type Lien = { epic?: string; feature?: string; equipe?: string; train?: string; portfolio?: string };
type Travail = {
  features: Map<string, { epic: string; train?: string; equipe?: string }>;
  epics: Map<string, { portfolio?: string }>;
};

/** Équipe, train et portfolio d'un élément de travail (story, tâche, feature, epic), déduits de ses liens */
export function porteurs(x: Lien, h: Travail, o: Pick<OrgValue, 'equipe' | 'train'>): { equipe: string; train: string; portfolio: string } {
  const f = x.feature ? h.features.get(x.feature) : undefined;
  const equipe = x.equipe || f?.equipe || '';
  const train = x.train || f?.train || (equipe ? (o.equipe.get(equipe)?.train ?? '') : '');
  const epicId = x.epic || f?.epic || '';
  const portfolio = x.portfolio || (epicId ? (h.epics.get(epicId)?.portfolio ?? '') : '') || (train ? (o.train.get(train)?.portfolio ?? '') : '');
  return { equipe, train, portfolio };
}

/** L'élément passe-t-il le filtre Portfolio / Train / Équipe ? */
export function dansOrgFiltre(x: Lien, filtre: OrgFiltre, h: Travail, o: Pick<OrgValue, 'equipe' | 'train'>): boolean {
  if (!filtre) return true;
  const p = porteurs(x, h, o);
  return filtre.kind === 'equipeagile' ? p.equipe === filtre.id : filtre.kind === 'train' ? p.train === filtre.id : p.portfolio === filtre.id;
}

/** Epic dans le filtre : son portfolio, ou une de ses features dans le train / l'équipe filtrés */
export function epicDansOrgFiltre(
  e: { id: string; portfolio?: string },
  filtre: OrgFiltre,
  features: { epic: string; train?: string; equipe?: string }[],
  o: Pick<OrgValue, 'equipe' | 'train'>,
): boolean {
  if (!filtre) return true;
  if (filtre.kind === 'portfolio') return e.portfolio === filtre.id;
  return features.some((f) => {
    if (f.epic !== e.id) return false;
    const train = f.train || (f.equipe ? (o.equipe.get(f.equipe)?.train ?? '') : '');
    return filtre.kind === 'equipeagile' ? f.equipe === filtre.id : train === filtre.id;
  });
}

export const OrgFiltreContext = createContext<OrgFiltre>(null);
export const useOrgFiltre = () => useContext(OrgFiltreContext);

/** « 💼 Digital », « 🚆 Clients », « 👥 Mobile » */
export function libelleOrgFiltre(f: OrgFiltre, o: OrgValue): string {
  if (!f) return '';
  const nom = f.kind === 'portfolio' ? o.portfolio.get(f.id)?.nom : f.kind === 'train' ? o.train.get(f.id)?.nom : o.equipe.get(f.id)?.nom;
  return `${ICONE_ORG[f.kind]} ${nom ?? '?'}`;
}

/**
 * Filtre Portfolio / Train / Équipe prêt à l'emploi pour les écrans de travail : tâche ou story, feature, epic.
 * Sans filtre, tout passe.
 */
export function useFiltreOrg() {
  const f = useOrgFiltre();
  const o = useOrg();
  const h = useHierarchy();
  return useMemo(
    () => ({
      actif: !!f,
      item: (t: Lien) => dansOrgFiltre(t, f, h, o),
      feature: (x: { id: string; epic: string; train?: string; equipe?: string }) => dansOrgFiltre({ feature: x.id, epic: x.epic, train: x.train, equipe: x.equipe }, f, h, o),
      epic: (e: { id: string; portfolio?: string }) => epicDansOrgFiltre(e, f, h.featureList, o),
    }),
    [f, o, h],
  );
}
