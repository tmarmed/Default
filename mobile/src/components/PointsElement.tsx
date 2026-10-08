import { createContext, useContext, useEffect, useState } from 'react';
import { LIBELLE_TYPE_POINT } from '../daily';
import { useHierarchy } from '../hierarchyContext';
import { jourCourt } from '../pointsSuivi';
import { type PointReunion, TYPES_REUNION } from '../types';
import { SectionFiche } from './Choix';
import { statutAffiche } from './reunion/Suivi';
import { Ligne, tonType } from './reunion/ui';

/** Points des réunions d'un espace (onglet PointsReunion), fournis par l'application ; null hors connexion */
export const LirePointsContext = createContext<((espace: string) => Promise<PointReunion[]>) | null>(null);

/** « Daily du 7/10 » d'après l'id de réunion (« daily-equipeagile:id-2026-10-07 ») */
function reunionDuPoint(id: string): string {
  const type = id.split('-')[0] as keyof typeof TYPES_REUNION;
  const lib = TYPES_REUNION[type]?.libelle ?? 'Réunion';
  return `${lib} du ${jourCourt(id.slice(-10))}`;
}

/**
 * « 📅 Points de réunion · n » de la fiche d'un élément (08/10) : les blocages, décisions et actions notés sur lui en
 * réunion, avec leur statut de suivi. Une lecture du Sheet de l'espace à l'ouverture de la fiche ; rien si aucun.
 */
export function SectionPointsReunion({ id, espace }: { id?: string; espace?: string }) {
  const lire = useContext(LirePointsContext);
  const h = useHierarchy();
  const [points, setPoints] = useState<PointReunion[]>([]);
  useEffect(() => {
    let vivant = true;
    if (!lire || !id) return setPoints([]);
    lire(espace || 'moi')
      .then((l) => vivant && setPoints(l.filter((p) => p.element === id && (p.type === 'blocage' || p.type === 'decision' || p.type === 'action'))))
      .catch(() => vivant && setPoints([]));
    return () => {
      vivant = false;
    };
  }, [lire, id, espace]);
  if (!points.length) return null;
  const jour = new Date().toISOString().slice(0, 10);
  const tries = [...points].sort((a, b) => b.reunion.slice(-10).localeCompare(a.reunion.slice(-10)));
  return (
    <SectionFiche titre={`📅 Points de réunion · ${points.length}`}>
      {tries.map((p, i) => {
        const a = statutAffiche(p, h.items, jour);
        return (
          <Ligne
            key={p.id}
            premiere={i === 0}
            texte={p.texte}
            sous={`${LIBELLE_TYPE_POINT[p.type]} · ${reunionDuPoint(p.reunion)}${p.statut ? '' : p.concretisation ? '' : ' · à concrétiser'}`}
            pastille={a.texte ? { texte: a.texte, ton: a.ton } : { texte: LIBELLE_TYPE_POINT[p.type], ton: tonType(p.type) }}
          />
        );
      })}
    </SectionFiche>
  );
}
