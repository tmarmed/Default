/**
 * Coque commune des briques de réunion (14/10, catalogue des briques, docs/regles-reunions.html bloc 13) : carte
 * blanche qui s'ouvre et se ferme en touchant le titre, titre « Nom (12) (5 changés) », case « Arborescence » (☐ 🌳)
 * (blocs dont les lignes ont un rattachement), pastille « Filtres » et ses rangées. Toute brique (Éléments, Budget,
 * Suivis, Notes…) passe par ici : une correction se fait une seule fois.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SectionFiche } from '../Choix';
import { colors } from '../../theme';
import { PastilleFiltres, st } from './ui';

export function BlocBrique({
  titre,
  n,
  nChanges,
  suffixe,
  fermeAuDepart,
  arborescence,
  aValider,
  droite,
  filtres,
  children,
}: {
  titre: string;
  /** Nombre de lignes (entre parenthèses) */
  n?: number;
  /** Nombre de lignes changées depuis la réunion précédente ; null : pas encore de réunion précédente */
  nChanges?: number | null;
  /** Après les nombres (ex. « · Notes à concrétiser (1) ») */
  suffixe?: string;
  fermeAuDepart?: boolean;
  /** Case « Arborescence » : sa valeur et son changement (absente : pas de case) */
  arborescence?: { valeur: boolean; changer: (v: boolean) => void };
  /** Pastille « ✓ n » des suivis à valider (bulle « À valider ») */
  aValider?: { n: number; actif: boolean; onPress: () => void };
  /** À droite du titre, avant la case et les filtres */
  droite?: ReactNode;
  /** Pastille « Filtres » : réglage actif et rangées affichées quand elle est ouverte */
  filtres?: { actif: boolean; contenu: ReactNode };
  children?: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(!fermeAuDepart);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  // Bulle (14/10) : le nom complet d'une icône, au doigt (appui long) ou au survol, effacée après 1,5 s
  const [bulle, setBulle] = useState('');
  useEffect(() => {
    if (!bulle) return;
    const t = setTimeout(() => setBulle(''), 1500);
    return () => clearTimeout(t);
  }, [bulle]);
  const avecBulle = (texte: string) => ({ onLongPress: () => setBulle(texte), onHoverIn: () => setBulle(texte), onHoverOut: () => setBulle('') });
  const nombres = `${n !== undefined ? ` (${n})` : ''}${nChanges != null ? ` (${nChanges} changé${nChanges > 1 ? 's' : ''})` : ''}`;
  return (
    <SectionFiche
      titre={`${ouvert ? '▾' : '›'} ${titre}${nombres}${suffixe ?? ''}`}
      onTitre={() => setOuvert((o) => !o)}
      boite
      // Boutons sur la ligne du titre ; s'il n'y a pas la place, ils passent dessous (le titre garde une largeur lisible)
      droite={
        ouvert && (droite || arborescence || filtres || (aValider && aValider.n > 0)) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            {!!bulle && (
              <View style={{ backgroundColor: colors.text, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }} accessibilityLiveRegion="polite">
                <Text style={{ color: '#fff', fontSize: 12 }}>{bulle}</Text>
              </View>
            )}
            {aValider && aValider.n > 0 && (
              <Pressable onPress={aValider.onPress} {...avecBulle('À valider')} style={[st.puceValider, aValider.actif && st.puceValiderOn]} accessibilityRole="button" accessibilityState={{ selected: aValider.actif }} accessibilityLabel={`À valider : ${aValider.n}`}>
                <Text style={[st.puceValiderTexte, aValider.actif && st.puceValiderTexteOn]}>✓ {aValider.n}</Text>
              </Pressable>
            )}
            {droite}
            {arborescence && (
              <Pressable onPress={() => arborescence.changer(!arborescence.valeur)} {...avecBulle('Arborescence')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} accessibilityRole="checkbox" accessibilityState={{ checked: arborescence.valeur }} accessibilityLabel="Arborescence">
                <Text style={[st.caseACocher, { width: 18, height: 18, lineHeight: 16, fontSize: 12 }, arborescence.valeur && st.caseCochee]}>{arborescence.valeur ? '✓' : ''}</Text>
                <Text style={{ fontSize: 13 }}>🌳</Text>
              </Pressable>
            )}
            {filtres && <PastilleFiltres compact actif={filtres.actif} ouvert={filtresOuverts} onPress={() => setFiltresOuverts((x) => !x)} onBulle={(m) => setBulle(m ? 'Filtres' : '')} />}
          </View>
        ) : undefined
      }
      entete={ouvert && filtres && filtresOuverts ? filtres.contenu : undefined}
    >
      {ouvert ? children : null}
    </SectionFiche>
  );
}

/** Titre d'un groupe quand la case « Arborescence » est cochée (Suivis, Notes) : « 🗂️ Epic › 🧩 Feature › 📖 Story » */
export function TitreGroupe({ texte }: { texte: string }) {
  return <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.muted, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 }}>{texte || 'Sans élément'}</Text>;
}
