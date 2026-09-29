import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface Props<T extends string> {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Version resserrée sur une seule ligne */
  compact?: boolean;
  /** Avec compact : autoriser plusieurs lignes */
  wrap?: boolean;
  /** Choix du départ (parent avant un déplacement) : marqué en pointillés quand un autre est choisi */
  depart?: T;
}

/** Rangée de boutons à choix unique. */
export function Chips<T extends string>({ options, value, onChange, compact, wrap, depart }: Props<T>) {
  return (
    <View style={[styles.row, compact && styles.rowCompact, wrap && styles.rowWrap]}>
      {options.map((o) => {
        const active = o.value === value;
        const color = o.color ?? colors.primary;
        const ancien = !!depart && o.value === depart && !active;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, compact && styles.chipCompact, active && { backgroundColor: color, borderColor: color }, ancien && { borderColor: color, borderStyle: 'dashed', borderWidth: 1.5 }]}
          >
            <Text style={[styles.label, compact && styles.labelCompact, active && styles.labelActive, ancien && { color }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rowCompact: { flexWrap: 'nowrap', gap: 6 },
  rowWrap: { flexWrap: 'wrap' },
  chipCompact: { paddingHorizontal: 11, paddingVertical: 6 },
  label: { color: colors.text, fontSize: 14 },
  labelCompact: { fontSize: 13 },
  labelActive: { color: '#fff', fontWeight: '600' },
});
