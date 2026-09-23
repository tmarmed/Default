import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDate, parseDate, toDateString, toTimeString } from '../dates';
import { colors } from '../theme';

interface Props {
  mode: 'date' | 'time';
  /** AAAA-MM-JJ ou HH:MM, vide si non renseigné */
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

/** Champ date ou heure utilisant le sélecteur natif d'iOS / Android. */
export function DateField({ mode, value, onChange, placeholder }: Props) {
  const current = value
    ? mode === 'date'
      ? parseDate(value)
      : parseDate(toDateString(new Date()), value)
    : new Date();

  const handle = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type !== 'set' || !date) return;
    onChange(mode === 'date' ? toDateString(date) : toTimeString(date));
  };

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: current, mode, is24Hour: true, onChange: handle });
    } else if (!value) {
      // Sur iOS, le sélecteur compact n'apparaît qu'une fois la valeur initialisée.
      onChange(mode === 'date' ? toDateString(current) : toTimeString(current));
    }
  };

  return (
    <View style={styles.row}>
      {Platform.OS === 'ios' && value ? (
        <DateTimePicker
          value={current}
          mode={mode}
          display="compact"
          locale="fr-FR"
          onChange={handle}
          style={styles.iosPicker}
        />
      ) : (
        <Pressable style={styles.field} onPress={open} accessibilityRole="button">
          <Text style={value ? styles.value : styles.placeholder}>
            {value ? (mode === 'date' ? formatDate(value) : value) : placeholder}
          </Text>
        </Pressable>
      )}
      {!!value && (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Effacer">
          <Text style={styles.clear}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  iosPicker: { flex: 1, alignSelf: 'flex-start' },
  value: { fontSize: 16, color: colors.text },
  placeholder: { fontSize: 16, color: colors.muted },
  clear: { fontSize: 18, color: colors.muted, paddingHorizontal: 4 },
});
