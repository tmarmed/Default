import { useCallback, useEffect, useMemo, useState } from 'react';
import { aConcretiser, libelleNote, TYPES_NOTE } from '../../daily';
import { useHierarchy } from '../../hierarchyContext';
import { echeanceParDefaut } from '../../pointsSuivi';
import { aReprendre } from '../../suiviEscalade';
import { type Echange, estTechnique, type PointReunion, type Reunion, type SousType, type TypePoint } from '../../types';
import { SectionFiche } from '../Choix';
import type { ActionsDaily } from '../Daily';
import { TitreFiche } from '../FormSheet';
import { type CtxSuivi, LignesSuivi, pointsDeSuivi } from './Suivi';
import { changementsSuivi, ModeAffichage, nbSuivisChanges } from './Arbre';
import { BlocBrique } from './Brique';
import type { Avancement } from './Avancement';
import { SaisiePoint, Vide } from './ui';

/**
 * Suivis et notes du mode Simple (validation du 08/10) : les mêmes composants que les réunions d'équipe (LignesSuivi,
 * feuille Concrétiser, lien privé avec le Chat), sur la série du rituel (« point_perso-perso- »), dans l'espace 🔒 Moi.
 * Seul : vous êtes responsable et validateur ; une note se concrétise tout de suite (pas de compte rendu). Les notes
 * venues du Chat (« 📌 Suivre en réunion », « 📌 Suivre à ») arrivent ici.
 */
export function SuivisPerso({ reunion, moi, echanges, actions, onInfo, avancement }: { reunion: Reunion; moi: string; echanges: Echange[]; actions: ActionsDaily; onInfo?: (t: string) => void; avancement?: Avancement }) {
  const h = useHierarchy();
  const espace = reunion.espace || 'moi';
  const jour = reunion.debut.slice(0, 10);
  const prefixe = reunion.id.slice(0, -10);
  const [points, setPoints] = useState<PointReunion[]>([]);
  const [arbo, setArbo] = useState(false);
  const lire = useCallback(() => {
    actions
      .lirePoints(espace, prefixe)
      .then((l) => setPoints(l.filter((p) => !estTechnique(p))))
      .catch(() => {});
  }, [actions, espace, prefixe]);
  useEffect(lire, [lire]);
  const suivis = pointsDeSuivi(points, reunion.id);
  // Notes pas encore concrétisées : celles du jour et celles reportées des rituels précédents
  const notes = useMemo(() => [...points.filter((p) => p.reunion === reunion.id && aConcretiser(p) && !p.concretisation), ...aReprendre(points, reunion.id).filter(aConcretiser)], [points, reunion.id]);
  const nomDe = (m: string) => (m.toLowerCase() === moi.toLowerCase() ? 'Vous' : m.split('@')[0]);
  const vous = { email: moi.toLowerCase(), nom: 'Vous', meta: 'seul' };
  const ctx: CtxSuivi = {
    espace,
    jour,
    moi,
    animateur: moi.toLowerCase(),
    nomDe,
    h,
    items: h.items,
    echanges,
    niveau: '',
    lecture: false,
    actions,
    onPoints: (l) => setPoints((avant) => avant.map((x) => ({ ...x, ...(l.find((y) => y.id === x.id) ?? {}) }))),
    concret: { moi: vous, equipe: [vous], validateurs: [vous], contexte: [] },
    echeance: echeanceParDefaut(reunion),
    ctxCreer: (pt) => ({ espace, iteration: '', equipe: '', idDe: () => '', description: `${libelleNote(pt)} noté au ${reunion.titre} du ${jour}.`, h, moi }),
    onInfo,
    // 14/10 : changements des suivis depuis la réunion précédente (même affichage que l'arbre des éléments)
    changements: avancement ? (p) => changementsSuivi(avancement, p.id, nomDe) : undefined,
  };
  const ajouter = async (type: TypePoint, texte: string, element: string, sous_type: SousType = '', partagee = false) => {
    const { crees } = await actions.ecrirePoints(espace, [{ reunion: reunion.id, personne: moi.toLowerCase(), auteur: moi.toLowerCase(), type, sous_type, texte, element, concretisation: partagee ? 'rien' : '', tache: '', responsable: '' }], [], []);
    setPoints((l) => [...l, ...crees]);
  };
  return (
    <>
      <TitreFiche icone="📌" titre="Suivis et notes" vide="" sous="Vos suivis, et les notes venues du Chat ou d’un rituel précédent" />
      {/* Coque commune des briques (14/10) : carte blanche, titre « Suivis (n) (m changés) », Arborescence décochée */}
      <BlocBrique
        titre="📌 Suivis"
        n={suivis.length}
        nChanges={avancement ? nbSuivisChanges(avancement, suivis) : null}
        suffixe={notes.length ? ` · Notes à concrétiser (${notes.length})` : ''}
        arborescence={{ valeur: arbo, changer: setArbo }}
        filtres={avancement?.lignes ? { actif: avancement.filtre.mode !== 'elements', contenu: <ModeAffichage av={avancement} /> } : undefined}
      >
        <LignesSuivi parElement={arbo} points={suivis} notes={notes} ctx={ctx} />
        {!suivis.length && !notes.length && <Vide texte="✓ Rien à suivre." />}
        <SaisiePoint types={TYPES_NOTE} typeDefaut="information" jour={jour} placeholder="＋ Nouvelle note" onAjouter={(type, texte, element, c, sous) => void ajouter(type, texte, element, sous, c?.c === 'rien')} />
      </BlocBrique>
    </>
  );
}
