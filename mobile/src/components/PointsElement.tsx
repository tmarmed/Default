import { createContext, useContext, useEffect, useState } from 'react';
import { LIBELLE_TYPE_POINT } from '../daily';
import { useHierarchy } from '../hierarchyContext';
import { personneParEmail } from '../echange/hierarchieEchange';
import { useOrg } from '../organisation';
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
 * Fiche d'un élément (08/10) : « 📌 Points de suivi · n » (notes concrétisées, avec leur statut) et « 📝 Notes de
 * réunion · n » (encore à concrétiser), chaque ligne avec la pastille de sa réunion. Une lecture du Sheet de l'espace
 * à l'ouverture de la fiche ; rien si aucun.
 */
export function SectionPointsReunion({ id, espace }: { id?: string; espace?: string }) {
  const lire = useContext(LirePointsContext);
  const h = useHierarchy();
  const org = useOrg();
  const nomDe = (m: string) => personneParEmail(m, org)?.nom ?? m.split('@')[0];
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
  const recents = [...points].sort((a, b) => b.reunion.slice(-10).localeCompare(a.reunion.slice(-10)));
  // Points de suivi : notes concrétisées (sauf « Rien ») ; notes de réunion : pas encore concrétisées
  const suivis = recents.filter((p) => !!p.statut || (!!p.concretisation && p.concretisation !== 'rien'));
  const notes = recents.filter((p) => !p.concretisation);
  const pastilleReunion = (p: PointReunion) => ({ texte: reunionDuPoint(p.reunion), ton: 'gris' as const });
  return (
    <>
      {suivis.length > 0 && (
        <SectionFiche titre={`📌 Points de suivi · ${suivis.length}`}>
          {suivis.map((p, i) => {
            const a = statutAffiche(p, h.items, jour);
            return (
              <Ligne
                key={p.id}
                premiere={i === 0}
                texte={p.texte}
                sous={[LIBELLE_TYPE_POINT[p.type], `Responsable : ${nomDe(p.responsable || p.personne)}`].join(' · ')}
                pastille={{ texte: a.texte || 'En cours', ton: a.texte ? a.ton : 'bleu', avant: pastilleReunion(p) }}
              />
            );
          })}
        </SectionFiche>
      )}
      {notes.length > 0 && (
        <SectionFiche titre={`📝 Notes de réunion · ${notes.length}`}>
          {notes.map((p, i) => (
            <Ligne
              key={p.id}
              premiere={i === 0}
              texte={p.texte}
              sous={`Notée par ${nomDe(p.personne)} · à concrétiser`}
              pastille={{ texte: LIBELLE_TYPE_POINT[p.type], ton: tonType(p.type), avant: pastilleReunion(p) }}
            />
          ))}
        </SectionFiche>
      )}
    </>
  );
}
