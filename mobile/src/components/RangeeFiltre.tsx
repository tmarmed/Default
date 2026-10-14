import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export interface OptionFiltre<T extends string> {
  value: T;
  label: string;
  /** Pastille de couleur dans la liste */
  color?: string;
}

/** Au-delà de ce nombre de choix, la rangée passe en liste déroulante (« Famille ▾ ») */
export const MAX_PASTILLES = 4;

/**
 * Rangée de filtre standard (14/10, sur le modèle de l'écran Tâches) : « Tous » puis un seul choix ; jusqu'à
 * MAX_PASTILLES choix, une pastille par choix ; au-delà, une pastille « Famille ▾ » qui ouvre la liste.
 * `tous` : la valeur « Tous » ('' par défaut) ; `libelleTous` : son libellé.
 */
export function RangeeFiltre<T extends string>({
  famille,
  options,
  value,
  onChange,
  tous = '' as T,
  libelleTous = 'Tous',
  sansTous,
  liste,
  disabled,
}: {
  famille: string;
  options: OptionFiltre<T>[];
  value: T;
  onChange: (v: T) => void;
  tous?: T;
  libelleTous?: string;
  /** Pas de « Tous » (un choix est toujours fait) */
  sansTous?: boolean;
  /** Toujours en liste déroulante */
  liste?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const enListe = liste || options.length > MAX_PASTILLES;
  const choisi = options.find((o) => o.value === value);
  const pastille = (on: boolean, label: string, onPress: () => void, key: string, drop = false) => (
    <Pressable key={key} disabled={disabled} onPress={onPress} style={[s.chip, drop && s.drop, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={drop ? `Choisir : ${famille}` : undefined}>
      <Text style={[s.chipText, on && s.chipTextOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {!sansTous && pastille(value === tous, libelleTous, () => onChange(tous), 'tous')}
      {enListe
        ? pastille(value !== tous && !!choisi, `${value !== tous && choisi ? choisi.label : famille} ▾`, () => setOpen(true), 'liste', true)
        : options.map((o) => pastille(value === o.value, o.label, () => onChange(o.value), o.value))}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.title}>{famille}</Text>
            <ScrollView style={{ maxHeight: 480 }}>
              {[...(sansTous ? [] : [{ value: tous, label: libelleTous } as OptionFiltre<T>]), ...options].map((o) => (
                <Pressable
                  key={`v-${o.value}`}
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
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
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
