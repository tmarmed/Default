import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext } from 'react';
import { ScrollView, StyleProp, ViewStyle } from 'react-native';
import { useHierarchy } from '../hierarchyContext';
import { Chips } from './Chips';

/**
 * Filtre de domaine partagé par tous les écrans (Tâches, Itération, PI, Roadmap, Portefeuille)
 * et mémorisé sur l'appareil : 'tous', l'id d'un domaine, ou '' (sans domaine).
 */
export const DOMAINE_KEY = 'mes-taches:domaine';

export async function loadDomainFilter(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(DOMAINE_KEY)) ?? 'tous';
  } catch {
    return 'tous';
  }
}
export const saveDomainFilter = (v: string) => AsyncStorage.setItem(DOMAINE_KEY, v).catch(() => {});

export const DomainFilterContext = createContext<{ value: string; set: (v: string) => void }>({ value: 'tous', set: () => {} });
export const useDomainFilter = () => useContext(DomainFilterContext);

/** Vrai si l'élément de domaine `dom` ('' = sans domaine) passe le filtre. */
export const inDomain = (filter: string, dom: string | undefined) => filter === 'tous' || (dom ?? '') === filter;

/** Puces du filtre (rien si aucun domaine n'existe). */
export function DomainChips({ style, label = 'Tous domaines' }: { style?: StyleProp<ViewStyle>; label?: string }) {
  const h = useHierarchy();
  const { value, set } = useDomainFilter();
  if (!h.domaineList.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={style}>
      <Chips
        options={[
          { value: 'tous', label },
          ...h.domaineList.map((d) => ({ value: d.id, label: `${d.icone} ${d.nom}`, color: d.couleur })),
          { value: '', label: 'Sans domaine' },
        ]}
        value={value}
        onChange={set}
        compact
      />
    </ScrollView>
  );
}
