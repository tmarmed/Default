import { useMemo, useRef, useState } from 'react';
import { ChoiceSheet } from '../ChoiceSheet';
import { libelleNote } from '../../daily';
import { surElements } from '../../elementConcerne';
import { useHierarchy } from '../../hierarchyContext';
import { ajouterHistorique, type CibleDeplacement, type CtxImpact, estNote, estPerso, lignePartage, lignesHistorique, rappelPreparation, reunionsCibles } from '../../notes';
import { nomPersonne, type OrgValue, useOrg } from '../../organisation';
import { participantsReunion } from '../../reunions';
import { niveauxDessous, peutCommuniquer, responsablesNiveau } from '../../liens';
import type { CibleCommunication } from '../../parentEnfants';
import { libelleNiveau, lireNiveau, personneParEmail } from '../../echange/hierarchieEchange';
import { iterationOf } from '../../pi';
import type { PointReunion, Reunion } from '../../types';
import type { ActionsDaily } from '../Daily';
import { Ligne, tonType } from './ui';

/**
 * Notes (lot 1 du 16/10, docs/regles-reunions.html bloc 16) : pièces communes du Daily et des autres réunions.
 * - `useCtxImpact` : ce qu'il faut pour repérer un impact sur l'équipe (N2, V2) ;
 * - `usePreparationMoi` : une note pas encore partagée est gardée dans 🔒 Moi (« En préparation », N1) ; une note
 *   « 🔒 Perso » y reste (V1) ; partagée à l'envoi, elle en sort ;
 * - `LigneNote` : une note, avec ses éléments, son état (En préparation, 🔒 Perso, rappel 🟡) et son historique.
 */

/** Contexte d'impact d'une réunion (vous, le sprint du jour de la réunion) */
export function useCtxImpact(moi: string, jour: string): CtxImpact {
  const h = useHierarchy();
  const org = useOrg();
  return useMemo(
    () => ({ moi, items: h.items, sprint: iterationOf(jour).key, emailDe: (id: string) => org.personne.get(id)?.email ?? '', nomDe: (e: string) => nomPersonne(org, e) }),
    [moi, jour, h.items, org],
  );
}

/** Ligne d'écriture d'un point (sans id, date ni champs locaux) */
type Ecrit = Omit<PointReunion, 'id' | 'cree_le'>;
const versEcrit = ({ id: _i, cree_le: _c, espace: _e, onglet: _o, ...x }: PointReunion & { onglet?: string }): Ecrit => x;

/**
 * Notes gardées dans 🔒 Moi pour une réunion d'équipe : lues à l'ouverture (celles de la série, pour la réunion
 * suivante aussi), écrites dès qu'on les ajoute, retirées quand on les envoie (partagées) ou les supprime. Rien
 * pour une réunion déjà rangée dans 🔒 Moi (Point perso, rituels du mode Simple).
 */
export function usePreparationMoi(o: { actions: ActionsDaily; reunion: Pick<Reunion, 'id' | 'espace'>; mail: string; onInfo?: (t: string) => void }) {
  const { actions, reunion, mail, onInfo } = o;
  const actif = (reunion.espace || 'moi') !== 'moi';
  const prefixe = reunion.id.slice(0, -10);
  /** Note de l'écran (id local) → sa ligne dans 🔒 Moi et la réunion pour laquelle elle a été écrite */
  const lien = useRef(new Map<string, { moi: string; reunion: string }>());
  // Le lien change après l'écriture dans 🔒 Moi : l'écran se redessine (pastille « En préparation »)
  const [, setVersion] = useState(0);
  const redessiner = () => setVersion((v) => v + 1);
  return {
    actif,
    /** Notes de la série gardées dans 🔒 Moi (les vôtres, pas encore concrétisées), ramenées à cette réunion */
    async charger(idLocal: () => string): Promise<PointReunion[]> {
      lien.current.clear();
      if (!actif) return [];
      try {
        const l = (await actions.lirePoints('moi', prefixe)).filter((x) => estNote(x) && x.auteur.toLowerCase() === mail && !x.concretisation && x.reunion <= reunion.id);
        return l.map((x) => {
          const id = idLocal();
          lien.current.set(id, { moi: x.id, reunion: x.reunion });
          return { ...x, id, reunion: reunion.id, espace: undefined };
        });
      } catch (e) {
        onInfo?.(`Notes en préparation non lues : ${(e as Error).message}`);
        return [];
      }
    },
    /** Garde une note dans 🔒 Moi (« En préparation », ou « 🔒 Perso ») dès qu'elle est écrite */
    async garder(x: PointReunion & { onglet?: string }) {
      if (!actif || !estNote(x)) return;
      try {
        const { crees } = await actions.ecrirePoints('moi', [versEcrit(x)], [], []);
        if (crees[0]) lien.current.set(x.id, { moi: crees[0].id, reunion: x.reunion });
        redessiner();
      } catch (e) {
        onInfo?.(`Note non gardée en préparation : ${(e as Error).message}`);
      }
    },
    /** Notes envoyées (partagées) ou supprimées : retirées de 🔒 Moi, en un seul passage */
    async oublier(ids: string[]) {
      const moi = ids.map((id) => lien.current.get(id)?.moi).filter((x): x is string => !!x);
      ids.forEach((id) => lien.current.delete(id));
      if (!moi.length) return;
      redessiner();
      try {
        await actions.ecrirePoints('moi', [], [], moi);
      } catch (e) {
        onInfo?.(`Préparation non mise à jour : ${(e as Error).message}`);
      }
    },
    /** Note gardée modifiée (V3 : une note perso devient « à partager ») */
    async modifier(id: string, patch: Partial<PointReunion>) {
      const m = lien.current.get(id)?.moi;
      if (!m) return;
      try {
        await actions.ecrirePoints('moi', [], [{ ...patch, id: m }], []);
      } catch (e) {
        onInfo?.(`Préparation non mise à jour : ${(e as Error).message}`);
      }
    },
    /** La note est-elle gardée dans 🔒 Moi (pas encore partagée) ? */
    enPreparation: (id: string) => lien.current.has(id),
    /** N1 · Rappel 🟡 : écrite pour une réunion déjà passée de la série */
    rappel: (id: string) => {
      const x = lien.current.get(id);
      return x ? rappelPreparation(x.reunion, reunion.id) : '';
    },
  };
}
export type PreparationMoi = ReturnType<typeof usePreparationMoi>;

/** État d'une note de ma préparation, en tête de sa sous-ligne : 🔒 Perso, rappel 🟡, En préparation */
export function etatNote(y: PointReunion, prep?: PreparationMoi): string {
  if (estPerso(y)) return '🔒 Perso · visible par vous seul';
  if (!prep) return '';
  return prep.rappel(y.id) || (prep.enPreparation(y.id) ? 'En préparation · pas encore partagée' : '');
}

/** Une note : son état (🔒 Perso, rappel 🟡, En préparation), « par … », éléments concernés, historique ; pastille du type */
export function LigneNote({ y, par, premiere, prep, onRetirer, onOuvrir, onPartager }: { y: PointReunion; par?: string; premiere?: boolean; prep?: PreparationMoi; onRetirer?: () => void; onOuvrir?: () => void; onPartager?: () => void }) {
  const [choix, setChoix] = useState(false);
  const h = useHierarchy();
  const histo = lignesHistorique(y.historique);
  const sous = [etatNote(y, prep), par, surElements(y, h), histo[histo.length - 1] ?? ''].filter(Boolean).join(' · ');
  // V3 : une note perso se partage (elle part avec votre point, un responsable la concrétise)
  const partager = estPerso(y) && onPartager ? () => setChoix(true) : undefined;
  return (
    <>
      <Ligne premiere={premiere} texte={y.texte} sous={sous} pastille={{ texte: libelleNote(y), ton: tonType(y.type) }} onRetirer={onRetirer} onOuvrir={onOuvrir ?? partager} />
      {choix && (
        <ChoiceSheet
          visible
          title={y.texte}
          message="Note 🔒 Perso, visible par vous seul"
          choices={[{ label: '👥 Partager avec l’équipe', principal: true, onPress: () => (setChoix(false), onPartager?.()) }]}
          onClose={() => setChoix(false)}
        />
      )}
    </>
  );
}

/**
 * D1 · « Déplacer » d'une réunion (pièce commune du Daily et des réunions d'équipe) : vos réunions à venir où le
 * responsable du point participe ; undefined si l'application ne connaît pas vos réunions
 */
export function optionsDeplacement(o: { reunion: Pick<Reunion, 'id' | 'espace'>; org: OrgValue; actions: ActionsDaily; aujourdhui: string; par: string }): { cibles: (pt: PointReunion) => CibleDeplacement[]; par: string } | undefined {
  const lire = o.actions.reunionsAVenir;
  if (!lire) return undefined;
  return {
    par: o.par,
    cibles: (pt) => {
      const resp = (pt.responsable || pt.personne).toLowerCase();
      const id = personneParEmail(resp, o.org)?.id;
      const participe = (r: Reunion) => r.organisateur.toLowerCase() === resp || (r.participants ?? []).includes(resp) || (!!id && participantsReunion(r, o.org).includes(id));
      return reunionsCibles(lire(), o.reunion, o.aujourdhui, participe, (r) => (r.niveau ? libelleNiveau(lireNiveau(r.niveau), o.org) : ''));
    },
  };
}

/** V3 · Changement d'une note perso partagée : plus perso, une ligne d'historique */
export const patchPartage = (y: Pick<PointReunion, 'historique'>, par: string, jour: string) => ({ perso: '', historique: ajouterHistorique(y.historique, lignePartage(par, jour)) });

/**
 * Lot 3 · « ⤵ Communiquer » d'une réunion (train, portfolio, direction) : les niveaux du dessous à qui vous pouvez
 * communiquer (Q1 : responsable du dessus, personne de liaison), reçu au Chat de leur Scrum Master (ou responsable)
 */
export function optionsCommuniquer(o: { reunion: Pick<Reunion, 'niveau'>; org: OrgValue; mail: string; jour: string }): { cibles: CibleCommunication[]; nomNiveau: (n: string) => string } | undefined {
  const dessus = lireNiveau(o.reunion.niveau);
  const pid = personneParEmail(o.mail, o.org)?.id ?? '';
  const nomNiveau = (n: string) => libelleNiveau(lireNiveau(n), o.org);
  const cibles = niveauxDessous(dessus, o.org)
    .filter((n) => peutCommuniquer(pid, dessus, n, o.org, o.jour))
    .map((n) => ({ niveau: `${n.kind}:${n.id}`, libelle: libelleNiveau(n, o.org), a: o.org.personne.get(responsablesNiveau(n, o.org).deroulement)?.email ?? '' }))
    .filter((c) => !!c.a);
  return { cibles, nomNiveau };
}
