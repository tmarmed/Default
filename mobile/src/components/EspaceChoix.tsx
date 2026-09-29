import { useEffect, useMemo, useState } from 'react';
import { espaceDe } from '../api';
import { espaceParId, ICONE_ESPACE, libelleEspace, useEspaces } from '../espaces';
import { filtrerEspace, useHierarchy } from '../hierarchyContext';
import { LigneChoix, SectionFiche } from './Choix';

/** Espace d'un rattachement proposé (objectif, domaine, epic, feature), s'il y en a un */
const espaceLie = (d?: Record<string, unknown>) =>
  d ? (['feature', 'epic', 'objectif', 'domaine'] as const).map((k) => espaceDe(d[k] as string | undefined)).find(Boolean) : undefined;

/**
 * Espace d'une fiche (epic, objectif, domaine, feature, objectif du PI) :
 * - élément existant : son espace (il ne change pas) ;
 * - nouvel élément : l'espace imposé, sinon celui de son rattachement proposé, sinon le premier espace affiché.
 * `h` : la hiérarchie de cet espace seulement (les choix de rattachement ne montrent que cet espace).
 */
export function useEspaceFiche(visible: boolean, existant: { espace?: string } | null, defaults?: Record<string, unknown>) {
  const esp = useEspaces();
  const hTous = useHierarchy();
  const [espace, setEspace] = useState('moi');
  useEffect(() => {
    if (visible) setEspace(existant ? existant.espace || 'moi' : ((defaults?.espace as string | undefined) ?? espaceLie(defaults) ?? esp.visibles[0] ?? 'moi'));
    // Réinitialiser seulement à l'ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, existant]);
  const h = useMemo(() => filtrerEspace(hTous, espace), [hTous, espace]);
  return { espace, setEspace, h };
}

/** Espace de travail en tête du fil d'Ariane (« 🏢 ACME ») : seulement quand plusieurs espaces sont affichés */
export function useEspaceFil(espace: string): string | undefined {
  const esp = useEspaces();
  if (esp.visibles.length < 2) return undefined;
  const e = espaceParId(esp.liste, espace || 'moi');
  return e ? `${ICONE_ESPACE[e.type]} ${libelleEspace(e)}` : undefined;
}

/** Ligne « Espace » d'une fiche : choix pour un nouvel élément (si plusieurs espaces affichés), rappel sinon. */
export function EspaceChoix({ espace, onChange, fige }: { espace: string; onChange: (v: string) => void; fige: boolean }) {
  const esp = useEspaces();
  if (esp.visibles.length < 2 && esp.visibles[0] === espace) return null;
  // Élément enregistré : son espace est déjà en tête du fil d'Ariane
  if (fige) return null;
  const nom = (id: string) => {
    const e = espaceParId(esp.liste, id);
    return e ? `${ICONE_ESPACE[e.type]} ${libelleEspace(e)}` : id;
  };
  return (
    <SectionFiche titre="Espace de travail">
      <LigneChoix
        label="Espace"
        value={espace}
        fige={fige}
        libelle={nom}
        groupes={[{ options: esp.liste.filter((x) => esp.visibles.includes(x.id) || x.id === espace).map((x) => ({ value: x.id, label: nom(x.id) })) }]}
        onChange={(v) => v && onChange(v)}
      />
    </SectionFiche>
  );
}
