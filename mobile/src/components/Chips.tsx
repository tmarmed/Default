import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface Props<T extends string> {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Version resserrée sur une seule ligne */
  compact?: boolean;
}

/** Rangée de boutons à choix unique. */
export function Chips<T extends string>({ options, value, onChange, compact }: Props<T>) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {options.map((o) => {
        const active = o.value === value;
        const color = o.color ?? colors.primary;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, compact && styles.chipCompact, active && { backgroundColor: color, borderColor: color }]}
          >
            <Text style={[styles.label, compact && styles.labelCompact, active && styles.labelActive]}>{o.label}</Text>
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
  chipCompact: { paddingHorizontal: 11, paddingVertical: 6 },
  label: { color: colors.text, fontSize: 14 },
  labelCompact: { fontSize: 13 },
  labelActive: { color: '#fff', fontWeight: '600' },
});
