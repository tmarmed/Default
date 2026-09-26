import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { espaceDe } from '../api';
import { espaceParId, ICONE_ESPACE, libelleEspace, useEspaces } from '../espaces';
import { filtrerEspace, useHierarchy } from '../hierarchyContext';
import { colors } from '../theme';
import { Chips } from './Chips';
import { Label } from './FormSheet';

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

/** Ligne « Espace » d'une fiche : choix pour un nouvel élément (si plusieurs espaces affichés), rappel sinon. */
export function EspaceChoix({ espace, onChange, fige }: { espace: string; onChange: (v: string) => void; fige: boolean }) {
  const esp = useEspaces();
  if (esp.visibles.length < 2 && esp.visibles[0] === espace) return null;
  const e = espaceParId(esp.liste, espace);
  return (
    <>
      <Label>Espace de travail</Label>
      {fige ? (
        <Text style={s.fige}>{e ? `${ICONE_ESPACE[e.type]} ${libelleEspace(e)}` : espace}</Text>
      ) : (
        <Chips
          options={esp.liste
            .filter((x) => esp.visibles.includes(x.id) || x.id === espace)
            .map((x) => ({ value: x.id, label: `${ICONE_ESPACE[x.type]} ${libelleEspace(x)}` }))}
          value={espace}
          onChange={onChange}
          compact
          wrap
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  fige: { fontSize: 15, color: colors.text },
});
