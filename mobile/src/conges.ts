import { createContext, useContext } from 'react';
import { joursOuvres } from './budget';
import { addDays, toDateString } from './dates';
import { estOuvre } from './series';
import type { Conge, JoursReels } from './types';

/**
 * 📅 Congés et jours réels (lot 2 du budget, conception validée le 09/10, docs/maquette-budget.html écrans 4 et 11).
 * Chacun déclare ses congés (modifiables) ; l'entreprise déclare ses fermetures. La capacité se calcule d'avance :
 * jours prévus = jours ouvrés (fériés déduits) − fermetures − congés. À la clôture du sprint, le Scrum Master corrige
 * et valide les jours réels en Rétrospective (1re étape) ; l'application propose alors d'ajuster « 1 point = … j ».
 */

export interface CongesValue {
  conges: Conge[];
  joursReels: JoursReels[];
  ecrireConge: (espace: string, c: Partial<Conge> & { id?: string }) => Promise<void>;
  supprimerConge: (espace: string, id: string) => Promise<void>;
  validerJoursReels: (espace: string, lignes: Omit<JoursReels, 'id' | 'espace'>[]) => Promise<void>;
  /** Règle « 1 point = … j » d'une équipe (calendrier agile) */
  ajusterJpp: (espace: string, equipe: string, jpp: number) => Promise<void>;
}
export const CONGES_VIDE: CongesValue = { conges: [], joursReels: [], ecrireConge: async () => {}, supprimerConge: async () => {}, validerJoursReels: async () => {}, ajusterJpp: async () => {} };
export const CongesContext = createContext<CongesValue>(CONGES_VIDE);
export const useConges = () => useContext(CongesContext);

/** Jours ouvrés d'absence d'une personne entre deux dates : ses congés et les fermetures de l'entreprise (sans compter deux fois) */
export function joursAbsence(conges: Conge[], personne: string, du: string, au: string): string[] {
  const p = personne.toLowerCase();
  const jours = new Set<string>();
  for (const c of conges) {
    if (c.personne && c.personne !== p) continue;
    const debut = c.du > du ? c.du : du;
    const fin = c.au < au ? c.au : au;
    for (let d = new Date(`${debut}T12:00`); toDateString(d) <= fin; d = addDays(d, 1)) if (estOuvre(toDateString(d))) jours.add(toDateString(d));
  }
  return [...jours].sort();
}

/** Jours prévus d'une personne sur une période : jours ouvrés − congés − fermetures */
export const joursPrevus = (conges: Conge[], personne: string, du: string, au: string) => Math.max(0, joursOuvres(du, au) - joursAbsence(conges, personne, du, au).length);

/** Congés d'une personne qui touchent une période (pour les afficher) */
export const congesDe = (conges: Conge[], personne: string, du: string, au: string) => conges.filter((c) => (!c.personne || c.personne === personne.toLowerCase()) && c.au >= du && c.du <= au);

/** Personnes absentes un jour donné (congés, maladie, formation ; fermeture : tout le monde) */
export function absentsLe(conges: Conge[], jour: string): { fermeture: boolean; personnes: string[] } {
  const ce = conges.filter((c) => c.du <= jour && c.au >= jour);
  return { fermeture: ce.some((c) => !c.personne), personnes: [...new Set(ce.filter((c) => c.personne).map((c) => c.personne))] };
}

/** Jours réels validés d'une personne pour un sprint d'une équipe (undefined : pas encore validés) */
export const joursReelsDe = (jr: JoursReels[], equipe: string, sprint: string, personne: string) => jr.find((x) => x.id === `${equipe}|${sprint}|${personne.toLowerCase()}`);

/**
 * « 1 point a pris … j » : jours réels de l'équipe ÷ points réalisés, arrondi au quart de jour (comme le réglage) ;
 * null sans points réalisés.
 */
export function jppConstate(joursReelsTotal: number, pointsFaits: number): number | null {
  if (!pointsFaits || !joursReelsTotal) return null;
  return Math.max(0.25, Math.min(5, Math.round((joursReelsTotal / pointsFaits) * 4) / 4));
}
