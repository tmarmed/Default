import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Petit format (ligne du titre : Simple | SAFe) */
  compact?: boolean;
}

/** Sélecteur à segments de même largeur (Liste / Jour / Semaine / Mois). */
export function Segmented<T extends string>({ options, value, onChange, compact }: Props<T>) {
  return (
    <View style={[styles.bar, compact && styles.barCompact]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={[styles.segment, compact && styles.segmentCompact, active && styles.active]}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, compact && styles.labelCompact, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: '#E4E8EF', borderRadius: 10, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  active: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  barCompact: { padding: 2, borderRadius: 9 },
  segmentCompact: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', paddingVertical: 5, paddingHorizontal: 7, borderRadius: 7 },
  label: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  labelCompact: { fontSize: 12.5 },
  labelActive: { color: colors.text, fontWeight: '700' },
});
