import { useMemo } from 'react';
import { photos } from '../../avancement';
import { useConges } from '../../conges';
import { useHierarchy } from '../../hierarchyContext';
import { bruit, duSprint, ecartEstimation, engagesDePhoto, type Indicateur, retouche, stabilite } from '../../indicateurs';
import { facteurJours, iterationByKey } from '../../pi';
import type { PointReunion } from '../../types';
import type { ActionsDaily } from '../Daily';
import { BlocBrique } from './Brique';
import { SectionFiche } from '../Choix';
import { Ligne } from './ui';
import { usePointsLus } from './usePointsLus';

/**
 * Bloc « 📏 Qualité du sprint » (lot 9 du 16/10, B3 et B4) : pièce commune de la Rétrospective, de la Revue, de la
 * Planification (sprint précédent), de l'Inspect & Adapt et du Pilotage ; à l'Affinage, seulement l'écart.
 * Stabilité : d'après la photo de la Planification du sprint (lue dans le Sheet de l'équipe).
 */
export function BlocIndicateurs({ equipes, sprint, espace, actions, points, seulEcart, fiche, titre = '📏 Qualité du sprint' }: { equipes: string[]; sprint: string; espace: string; actions?: Pick<ActionsDaily, 'lirePoints'>; /** Points déjà lus (Pilotage) : la photo de la Planification y est cherchée */ points?: PointReunion[]; seulEcart?: boolean; /** Pilotage : présenté en section de fiche (variante de la même pièce) */ fiche?: boolean; titre?: string }) {
  const h = useHierarchy();
  const { joursReels } = useConges();
  // Photo de la Planification du sprint (élements engagés), une lecture par équipe
  const lus = usePointsLus(actions && !points && !seulEcart ? () => Promise.all(equipes.map((eq) => actions.lirePoints(espace, `planification-equipeagile:${eq}-`))).then((l) => l.flat()) : null, `${espace}|${equipes.join(',')}|${sprint}`);
  const l = useMemo(() => duSprint(h.items, equipes, sprint), [h.items, equipes, sprint]);
  const engages = useMemo(() => {
    const it = iterationByKey(sprint);
    const source = points ?? lus.points;
    if (!source || !it) return null;
    const dans = photos(source.filter((x) => x.reunion.startsWith('planification-') && equipes.some((eq) => x.reunion.includes(`:${eq}-`)))).filter((p) => p.reunion.slice(-10) >= it.start && p.reunion.slice(-10) <= it.end).sort((a, b) => a.reunion.localeCompare(b.reunion));
    const set = new Set<string>();
    for (const p of dans) for (const id of engagesDePhoto(p.photo, sprint)) set.add(id);
    return dans.length ? set : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lus.points, points, sprint]);
  const jours = joursReels.filter((j) => equipes.includes(j.equipe) && j.sprint === sprint).reduce((n, j) => n + (Number(j.jours) || 0), 0);
  const jpp = facteurJours({ equipe: equipes[0] }) || 1;
  const liste: Indicateur[] = seulEcart ? [ecartEstimation(l, jours, jpp)] : [bruit(l), ecartEstimation(l, jours, jpp), retouche(l), stabilite(engages, l, h.items)];
  const ton = (x: Indicateur) => (x.ton === 'gris' ? 'gris' : x.ton);
  const lignes = liste.map((x, i) => (
    <Ligne key={x.nom} premiere={i === 0} texte={x.nom} sous={x.detail} pastille={{ texte: x.pct === null ? '—' : `${x.nom === 'Écart d’estimation' && x.pct > 0 ? '+' : ''}${x.pct} %`, ton: ton(x) }} />
  ));
  return fiche ? <SectionFiche titre={titre}>{lignes}</SectionFiche> : <BlocBrique titre={titre}>{lignes}</BlocBrique>;
}
