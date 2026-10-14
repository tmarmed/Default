/**
 * Pastille « Filtres ▾ / ▴ » (14/10) : la même partout, en-tête des onglets et blocs de réunion. Entonnoir, « Filtres »,
 * flèche ▾ (fermée) / ▴ (ouverte) ; bleue avec un rond rouge du nombre de filtres actifs.
 */
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { colors } from '../theme';

/** Entonnoir des filtres (dessiné, sans image) */
export function Entonnoir({ couleur }: { couleur: string }) {
  return (
    <View style={{ alignItems: 'center', width: 12 }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: couleur }} />
      <View style={{ width: 2.5, height: 5, backgroundColor: couleur, marginTop: -1 }} />
    </View>
  );
}

export function PastilleFiltres({
  nb,
  ouvert,
  onPress,
  resume,
  onLayout,
  onBulle,
}: {
  /** Nombre de filtres actifs (0 : pastille blanche, sans rond) */
  nb: number;
  ouvert: boolean;
  onPress: () => void;
  /** Résumé des filtres, lu par le lecteur d'écran */
  resume?: string;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Bulle « Filtres » au doigt (appui long) ou au survol */
  onBulle?: (montrer: boolean) => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      onLongPress={onBulle ? () => onBulle(true) : undefined}
      onHoverIn={onBulle ? () => onBulle(true) : undefined}
      onHoverOut={onBulle ? () => onBulle(false) : undefined}
      hitSlop={6}
      style={[s.pastille, !!nb && s.active]}
      accessibilityRole="button"
      accessibilityHint={resume}
      accessibilityLabel={`${ouvert ? 'Replier' : 'Déplier'} les filtres${nb ? ` (${nb} actif${nb > 1 ? 's' : ''})` : ''}`}
    >
      <Entonnoir couleur={nb ? colors.primary : colors.text} />
      <Text style={[s.texte, !!nb && { color: colors.primary }]}>Filtres {ouvert ? '▴' : '▾'}</Text>
      {!!nb && (
        <View style={s.nb}>
          <Text style={s.nbTexte}>{nb}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  pastille: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 8, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexShrink: 0 },
  active: { backgroundColor: '#EAF2FE', borderColor: '#CFE0FB' },
  texte: { fontSize: 12, fontWeight: '700', color: colors.text },
  nb: { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  nbTexte: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
