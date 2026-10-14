import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, typeColors } from '../theme';
import { ItemType, TYPE_ICONS, TYPE_LABELS } from '../types';

export type TypeFiltre = 'tous' | ItemType | 'recurrents';

/** Filtre par type : « Tous » + liste déroulante des 8 types (et des éléments répétés). */
export function TypeFilter({ value, onChange }: { value: TypeFiltre; onChange: (v: TypeFiltre) => void }) {
  const [open, setOpen] = useState(false);
  const label =
    value === 'tous' ? 'Tous les types' : value === 'recurrents' ? '🔁 Répétés' : `${TYPE_ICONS[value]} ${TYPE_LABELS[value]}`;
  const options: { value: TypeFiltre; label: string; color?: string }[] = [
    { value: 'tous', label: 'Tous les types' },
    ...(Object.keys(TYPE_LABELS) as ItemType[]).map((t) => ({ value: t, label: `${TYPE_ICONS[t]} ${TYPE_LABELS[t]}`, color: typeColors[t] })),
    { value: 'recurrents', label: '🔁 Répétés' },
  ];
  return (
    <View style={s.row}>
      <Pressable
        style={[s.chip, value === 'tous' && s.chipOn]}
        onPress={() => onChange('tous')}
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'tous' }}
      >
        <Text style={[s.chipText, value === 'tous' && s.chipTextOn]}>Tous</Text>
      </Pressable>
      <Pressable
        style={[s.chip, s.drop, value !== 'tous' && s.chipOn]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choisir un type"
      >
        <Text style={[s.chipText, value !== 'tous' && s.chipTextOn]} numberOfLines={1}>
          {value === 'tous' ? 'Type' : label} ▾
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.title}>Afficher</Text>
            <ScrollView style={{ maxHeight: 480 }}>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  style={s.item}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: value === o.value }}
                >
                  <View style={[s.dot, { backgroundColor: o.color ?? 'transparent' }]} />
                  <Text style={[s.itemText, value === o.value && s.itemOn]}>{o.label}</Text>
                  {value === o.value && <Text style={s.itemOn}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  drop: { flexShrink: 1 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13.5, color: colors.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  itemText: { flex: 1, fontSize: 15.5, color: colors.text },
  itemOn: { color: colors.primary, fontWeight: '700', fontSize: 15.5 },
});
