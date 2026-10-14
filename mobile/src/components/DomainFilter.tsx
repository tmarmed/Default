import AsyncStorage from '@react-native-async-storage/async-storage';
import { RangeeFiltre } from './RangeeFiltre';
import { createContext, useCallback, useContext } from 'react';
import { ScrollView, StyleProp, ViewStyle } from 'react-native';
import { inDomain, useHierarchy } from '../hierarchyContext';
import { nomDomaine } from '../nomsEspaces';
import type { Domaine } from '../types';

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

export { inDomain };

/** Recherche par titre du sous-bloc Filtres (vide : tout passe), partagée par les écrans */
export const RechercheContext = createContext('');
/** Le titre correspond-il à la recherche en cours ? */
export function useRecherche(): (titre: string) => boolean {
  const q = useContext(RechercheContext).trim().toLowerCase();
  return useCallback((titre: string) => !q || titre.toLowerCase().includes(q), [q]);
}

/**
 * Filtre à deux niveaux (même règle que dans les fiches) : les domaines principaux, puis — une fois un domaine
 * choisi et s'il en a — ses sous-domaines. Un seul sous-domaine : choisi d'office (« Tout <domaine> » pour revenir).
 */
export function useFiltreDomaine() {
  const h = useHierarchy();
  const { value, set } = useDomainFilter();
  const principal = (d: Domaine) => !d.parent || !h.domaines.has(d.parent);
  // Un bouton par domaine et par espace (préfixe de l'espace quand plusieurs sont affichés)
  const principaux = h.domaineList.filter(principal);
  const courant = value && value !== 'tous' ? h.domaines.get(value) : undefined;
  const parent = courant && !principal(courant) ? h.domaines.get(courant.parent) : courant;
  const sousDe = (p: Domaine) => h.domaineList.filter((d) => d.parent === p.id);
  const sous = parent ? sousDe(parent) : [];
  const choisir = (v: string) => {
    const p = v && v !== 'tous' ? h.domaines.get(v) : undefined;
    const s2 = p ? sousDe(p) : [];
    set(s2.length === 1 ? s2[0].id : v);
  };
  return {
    vide: !h.domaineList.length,
    principaux: principaux.map((d) => ({ value: d.id, label: nomDomaine(d, h.domaines), color: d.couleur })),
    valeurPrincipale: parent ? parent.id : value,
    choisir,
    sous: parent && sous.length
      ? { tout: { value: parent.id, label: `Tout ${parent.nom}` }, options: sous.map((d) => ({ value: d.id, label: `${d.icone} ${d.nom}`, color: d.couleur })) }
      : null,
    value,
    set,
  };
}

/** Ligne des sous-domaines du domaine filtré (rien si ce domaine n'en a pas). */
export function SousDomaineChips({ style }: { style?: StyleProp<ViewStyle> }) {
  const f = useFiltreDomaine();
  if (!f.sous) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={style}>
      <RangeeFiltre famille={f.sous.tout.label.replace(/^Tout /, '')} tous={f.sous.tout.value} libelleTous={f.sous.tout.label} options={f.sous.options} value={f.value} onChange={f.set} />
    </ScrollView>
  );
}

/** Puces des domaines principaux du filtre (sans défilement : à placer dans une ligne qui défile). */
export function DomainesPrincipauxChips({ label = 'Tous les domaines' }: { label?: string }) {
  const f = useFiltreDomaine();
  if (f.vide) return null;
  return <RangeeFiltre famille="Domaine" tous="tous" libelleTous={label} options={[...f.principaux, { value: '', label: 'Sans domaine' }]} value={f.valeurPrincipale} onChange={f.choisir} />;
}

/** Puces du filtre (rien si aucun domaine n'existe). */
export function DomainChips({ style, label = 'Tous les domaines' }: { style?: StyleProp<ViewStyle>; label?: string }) {
  const f = useFiltreDomaine();
  if (f.vide) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={style}>
        <RangeeFiltre famille="Domaine" tous="tous" libelleTous={label} options={[...f.principaux, { value: '', label: 'Sans domaine' }]} value={f.valeurPrincipale} onChange={f.choisir} />
      </ScrollView>
      <SousDomaineChips style={[style, { paddingTop: 0 }]} />
    </>
  );
}
