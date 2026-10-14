/**
 * Rangée de pastilles de filtre (14/10, refactoring lot 2) : le style des filtres des onglets (contour bleu, pleine
 * quand elle est choisie), « Tous » puis un seul choix. Une seule version pour les onglets, les réunions et l'avancement.
 */
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

export function RangeePastilles<T extends string>({
  options,
  value,
  onChange,
  defile = true,
  inactif,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Rangée qui défile (par défaut) ; sinon les pastilles seules, à placer dans une rangée qui défile déjà */
  defile?: boolean;
  inactif?: boolean;
}) {
  const pastilles = options.map((o) => <Pastille key={o.value || 'tous'} label={o.label} on={o.value === value} onPress={() => onChange(o.value)} inactif={inactif} />);
  return defile ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={stylesPastille.ligne}>
      {pastilles}
    </ScrollView>
  ) : (
    <>{pastilles}</>
  );
}

/** Une pastille ; `bascule` : interrupteur (« 🏃 Sprint en cours », « 📎 Avec pièces jointes ») */
export function Pastille({ label, on, onPress, bascule, inactif }: { label: string; on: boolean; onPress: () => void; bascule?: boolean; inactif?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={inactif} style={[stylesPastille.pastille, on && stylesPastille.on]} accessibilityRole={bascule ? 'switch' : 'button'} accessibilityState={bascule ? { checked: on } : { selected: on }}>
      <Text style={[stylesPastille.texte, on && stylesPastille.texteOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export const stylesPastille = StyleSheet.create({
  ligne: { gap: 6, alignItems: 'center' },
  pastille: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card },
  on: { backgroundColor: colors.primary },
  texte: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  texteOn: { color: '#fff' },
});
