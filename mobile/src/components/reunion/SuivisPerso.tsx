import { useCallback, useEffect, useMemo, useState } from 'react';
import { aConcretiser, libelleNote } from '../../daily';
import { useHierarchy } from '../../hierarchyContext';
import { echeanceParDefaut } from '../../pointsSuivi';
import { aReprendre } from '../../suiviEscalade';
import { type Echange, estTechnique, type PointReunion, type Reunion, type SousType, type TypePoint } from '../../types';
import { SectionFiche } from '../Choix';
import type { ActionsDaily } from '../Daily';
import { TitreFiche } from '../FormSheet';
import { type CtxSuivi, LignesSuivi, pointsDeSuivi } from './Suivi';
import { SaisiePoint, Vide } from './ui';

/**
 * Suivis et notes du mode Simple (validation du 08/10) : les mêmes composants que les réunions d'équipe (LignesSuivi,
 * feuille Concrétiser, lien privé avec le Chat), sur la série du rituel (« point_perso-perso- »), dans l'espace 🔒 Moi.
 * Seul : vous êtes responsable et validateur ; une note se concrétise tout de suite (pas de compte rendu). Les notes
 * venues du Chat (« 📌 Suivre en réunion », « 📌 Suivre à ») arrivent ici.
 */
export function SuivisPerso({ reunion, moi, echanges, actions, onInfo }: { reunion: Reunion; moi: string; echanges: Echange[]; actions: ActionsDaily; onInfo?: (t: string) => void }) {
  const h = useHierarchy();
  const espace = reunion.espace || 'moi';
  const jour = reunion.debut.slice(0, 10);
  const prefixe = reunion.id.slice(0, -10);
  const [points, setPoints] = useState<PointReunion[]>([]);
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
  };
  const ajouter = async (type: TypePoint, texte: string, element: string, sous_type: SousType = '') => {
    const { crees } = await actions.ecrirePoints(espace, [{ reunion: reunion.id, personne: moi.toLowerCase(), auteur: moi.toLowerCase(), type, sous_type, texte, element, concretisation: '', tache: '', responsable: '' }], [], []);
    setPoints((l) => [...l, ...crees]);
  };
  return (
    <>
      <TitreFiche icone="📌" titre="Suivis et notes" vide="" sous="Vos suivis, et les notes venues du Chat ou d’un rituel précédent" />
      <SectionFiche titre={`📌 Suivis · ${suivis.length}${notes.length ? ` · Notes à concrétiser · ${notes.length}` : ''}`}>
        <LignesSuivi points={suivis} notes={notes} ctx={ctx} />
        {!suivis.length && !notes.length && <Vide texte="✓ Rien à suivre." />}
        <SaisiePoint types={['blocage', 'decision', 'action']} typeDefaut="action" jour={jour} placeholder="＋ Nouvelle note" onAjouter={(type, texte, element, _c, sous) => void ajouter(type, texte, element, sous)} />
      </SectionFiche>
    </>
  );
}
