import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { avecLive, type EtatReunion, intervalleRelecture, ligneEtat, lireEtat, pointEtat } from '../etatReunion';
import type { PointReunion, Reunion } from '../types';

/** Lecture et écriture des points d'une réunion (fournies par l'application) */
export interface ActionsLive {
  lirePoints: (espace: string, prefixe: string) => Promise<PointReunion[]>;
  ecrirePoints: (
    espace: string,
    creer: Omit<PointReunion, 'id' | 'cree_le'>[],
    modifier: (Partial<PointReunion> & { id: string })[],
    retirer: string[],
  ) => Promise<{ crees: PointReunion[]; modifies: PointReunion[] }>;
}

/**
 * Live d'une réunion (07/10), seulement à plusieurs (`nbParticipants` > 1) :
 * - l'animateur publie la ligne d'état : « lancée » à l'ouverture de sa fenêtre (sauf si le compte rendu est déjà
 *   envoyé), puis à chaque étape ou élément (`publier`), « finie » à l'envoi du compte rendu (`terminer`). Une seule
 *   écriture à la fois : la dernière demande gagne ;
 * - le participant relit les points de la réunion (une lecture) toutes les 10 s pendant un vote, 15 s sinon, en pause
 *   quand l'application n'est pas à l'écran ; `onPoints` reçoit ce qui a été lu (le participant voit aussi ce que
 *   l'animateur note), `etat` l'état de l'animateur, mis à jour seulement si sa version a changé.
 */
export function useLive(o: {
  visible: boolean;
  reunion: Pick<Reunion, 'id'>;
  espace: string;
  anime: boolean;
  nbParticipants: number;
  moi: string;
  actions: ActionsLive;
  /** Points lus à l'ouverture (la ligne d'état est dedans) : rien n'est publié avant */
  charge: boolean;
  pointsInitiaux: PointReunion[];
  onPoints?: (l: PointReunion[]) => void;
}) {
  const { visible, reunion, espace, anime, nbParticipants, moi, actions, charge } = o;
  const live = avecLive(nbParticipants);
  const [etat, setEtat] = useState<EtatReunion | null>(null);
  const ligne = useRef<PointReunion | undefined>(undefined);
  const courant = useRef<EtatReunion | null>(null);
  const enCours = useRef(false);
  const enAttente = useRef<EtatReunion | null>(null);
  const onPoints = useRef(o.onPoints);
  onPoints.current = o.onPoints;

  // Ouverture : état lu avec les points
  useEffect(() => {
    if (!visible || !charge) return;
    ligne.current = ligneEtat(o.pointsInitiaux, reunion.id);
    courant.current = lireEtat(ligne.current);
    setEtat(courant.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, charge, reunion.id]);

  /** Écrit la ligne d'état (création, puis modification) ; une écriture à la fois, la dernière gagne */
  const ecrire = async (e: EtatReunion) => {
    if (enCours.current) {
      enAttente.current = e;
      return;
    }
    enCours.current = true;
    try {
      const p = pointEtat(reunion, moi, e);
      if (ligne.current) {
        const r = await actions.ecrirePoints(espace, [], [{ id: ligne.current.id, texte: p.texte }], []);
        ligne.current = r.modifies[0] ?? ligne.current;
      } else {
        const r = await actions.ecrirePoints(espace, [p], [], []);
        ligne.current = r.crees[0];
      }
    } catch {
      // Live au mieux : une écriture manquée est rattrapée par la suivante
    } finally {
      enCours.current = false;
      const suite = enAttente.current;
      enAttente.current = null;
      if (suite) ecrire(suite);
    }
  };
  /** L'animateur publie où il en est (étape, élément, vote) */
  const publier = (x: Partial<EtatReunion>) => {
    if (!anime || !live || !charge) return;
    if (courant.current?.fin && !x.fin) return;
    const e: EtatReunion = { etape: '', libelle: '', ...courant.current, ...x, v: (courant.current?.v ?? 0) + 1, anim: moi.toLowerCase(), lance: courant.current?.lance || new Date().toISOString() };
    courant.current = e;
    setEtat(e);
    ecrire(e);
  };
  const terminer = () => publier({ fin: new Date().toISOString(), vote: undefined });

  // Participant : relecture régulière tant que la fenêtre est ouverte et l'application à l'écran
  useEffect(() => {
    if (!visible || anime || !live || !charge) return;
    let actif = true;
    let minuterie: ReturnType<typeof setTimeout> | null = null;
    let vu = courant.current?.v ?? -1;
    const tour = async () => {
      if (!actif) return;
      if (AppState.currentState === 'active') {
        try {
          const l = await actions.lirePoints(espace, reunion.id);
          if (!actif) return;
          onPoints.current?.(l);
          const lg = ligneEtat(l, reunion.id);
          const e = lireEtat(lg);
          if (e && e.v !== vu) {
            vu = e.v;
            ligne.current = lg;
            courant.current = e;
            setEtat(e);
          }
        } catch {
          // Quota ou réseau : on réessaie au tour suivant
        }
      }
      if (actif) minuterie = setTimeout(tour, intervalleRelecture(courant.current));
    };
    minuterie = setTimeout(tour, intervalleRelecture(courant.current));
    return () => {
      actif = false;
      if (minuterie) clearTimeout(minuterie);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, anime, live, charge, reunion.id, espace]);

  return { live, etat, publier, terminer };
}
