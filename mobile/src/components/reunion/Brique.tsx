/**
 * Coque commune des briques de réunion (14/10, catalogue des briques, docs/regles-reunions.html bloc 13) : carte
 * blanche qui s'ouvre et se ferme en touchant le titre, titre « Nom (12) (5 changés) », case « Arborescence » (☐ 🌳)
 * (blocs dont les lignes ont un rattachement), pastille « Filtres » et ses rangées. Toute brique (Éléments, Budget,
 * Suivis, Notes…) passe par ici : une correction se fait une seule fois.
 */
import { useState, type ReactNode } from 'react';
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
  /** À droite du titre, avant la case et les filtres (ex. « À valider · 2 ») */
  droite?: ReactNode;
  /** Pastille « Filtres » : réglage actif et rangées affichées quand elle est ouverte */
  filtres?: { actif: boolean; contenu: ReactNode };
  children?: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(!fermeAuDepart);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const nombres = `${n !== undefined ? ` (${n})` : ''}${nChanges != null ? ` (${nChanges} changé${nChanges > 1 ? 's' : ''})` : ''}`;
  return (
    <SectionFiche
      titre={`${ouvert ? '▾' : '›'} ${titre}${nombres}${suffixe ?? ''}`}
      onTitre={() => setOuvert((o) => !o)}
      boite
      // Boutons sur la ligne du titre ; s'il n'y a pas la place, ils passent dessous (le titre garde une largeur lisible)
      droite={
        ouvert && (droite || arborescence || filtres) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            {droite}
            {arborescence && (
              <Pressable onPress={() => arborescence.changer(!arborescence.valeur)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} accessibilityRole="checkbox" accessibilityState={{ checked: arborescence.valeur }} accessibilityLabel="Arborescence">
                <Text style={[st.caseACocher, { width: 18, height: 18, lineHeight: 16, fontSize: 12 }, arborescence.valeur && st.caseCochee]}>{arborescence.valeur ? '✓' : ''}</Text>
                <Text style={{ fontSize: 13 }}>🌳</Text>
              </Pressable>
            )}
            {filtres && <PastilleFiltres compact actif={filtres.actif} ouvert={filtresOuverts} onPress={() => setFiltresOuverts((x) => !x)} />}
          </View>
        ) : undefined
      }
      entete={ouvert && filtres && filtresOuverts ? filtres.contenu : undefined}
    >
      {ouvert ? children : null}
    </SectionFiche>
  );
}
