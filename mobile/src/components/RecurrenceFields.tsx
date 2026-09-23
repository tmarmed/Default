import { StyleSheet, Text, TextInput, View } from 'react-native';
import { describeRecurrence } from '../recurrence';
import { colors } from '../theme';
import type { ItemInput, Periodicite } from '../types';
import { Chips } from './Chips';
import { DateField } from './DateField';

type Value = Pick<ItemInput, 'periodicite' | 'echeance' | 'debut' | 'fin'>;

interface Props {
  value: Value;
  onChange: (patch: Partial<Value>) => void;
}

const REPETITIONS: { value: Periodicite | 'aucune'; label: string }[] = [
  { value: 'aucune', label: 'Aucune' },
  { value: 'hebdomadaire', label: 'Semaine' },
  { value: 'mensuelle', label: 'Mois' },
  { value: 'trimestrielle', label: 'Trimestre' },
  { value: 'annuelle', label: 'Année' },
];
const JOURS = ['Libre', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((label, i) => ({
  value: i === 0 ? '' : String(i),
  label,
}));
const MOIS_TRIMESTRE = ['Libre', '1er mois', '2e mois', '3e mois'].map((label, i) => ({
  value: i === 0 ? '' : String(i),
  label,
}));
const MOIS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'].map((label, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label,
}));

/** Réglages de répétition du formulaire. */
export function RecurrenceFields({ value, onChange }: Props) {
  const p = value.periodicite;
  const [a = '', b = ''] = value.echeance.split('-');
  const compose = (x: string, y: string) => (x ? (y ? `${x}-${y}` : x) : '');
  const dayOnly = (t: string) => t.replace(/\D/g, '').slice(0, 2);

  return (
    <View>
      <Text style={styles.label}>Répétition</Text>
      <Chips
        options={REPETITIONS}
        value={p || 'aucune'}
        onChange={(v) => {
          const periodicite = v === 'aucune' ? '' : v;
          // L'année demande un mois : on propose le mois en cours.
          const echeance = periodicite === 'annuelle' ? String(new Date().getMonth() + 1).padStart(2, '0') : '';
          onChange({ periodicite, echeance });
        }}
        compact
      />

      {p === 'hebdomadaire' && (
        <>
          <Text style={styles.label}>Jour de la semaine</Text>
          <Chips options={JOURS} value={a} onChange={(v) => onChange({ echeance: v })} compact wrap />
        </>
      )}

      {p === 'mensuelle' && (
        <>
          <Text style={styles.label}>Jour du mois</Text>
          <TextInput
            style={styles.input}
            value={a}
            onChangeText={(t) => onChange({ echeance: dayOnly(t) })}
            placeholder="Libre : à faire dans le mois"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={2}
          />
        </>
      )}

      {p === 'trimestrielle' && (
        <>
          <Text style={styles.label}>Moment dans le trimestre</Text>
          <Chips options={MOIS_TRIMESTRE} value={a} onChange={(v) => onChange({ echeance: compose(v, v ? b : '') })} compact wrap />
          {!!a && (
            <TextInput
              style={[styles.input, styles.spaced]}
              value={b}
              onChangeText={(t) => onChange({ echeance: compose(a, dayOnly(t)) })}
              placeholder="Jour (libre : dans le mois)"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={2}
            />
          )}
        </>
      )}

      {p === 'annuelle' && (
        <>
          <Text style={styles.label}>Mois</Text>
          <Chips options={MOIS} value={a} onChange={(v) => onChange({ echeance: compose(v, b) })} compact wrap />
          <TextInput
            style={[styles.input, styles.spaced]}
            value={b}
            onChangeText={(t) => onChange({ echeance: compose(a, dayOnly(t)) })}
            placeholder="Jour (libre : dans le mois)"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={2}
          />
        </>
      )}

      {!!p && (
        <>
          <Text style={styles.summary}>🔁 {describeRecurrence(value)}</Text>
          <Text style={styles.label}>À partir du</Text>
          <DateField mode="date" value={value.debut} onChange={(v) => onChange({ debut: v })} placeholder="Aujourd'hui" />
          <Text style={styles.label}>Jusqu'au</Text>
          <DateField mode="date" value={value.fin} onChange={(v) => onChange({ fin: v })} placeholder="Sans fin" />
        </>
      )}
    </View>
  );
}

/** Message d'erreur si les réglages sont incomplets, sinon null. */
export function checkRecurrence(v: Value): string | null {
  const [a, b] = v.echeance.split('-');
  const day = (s?: string) => !s || (Number(s) >= 1 && Number(s) <= 31);
  if (v.periodicite === 'mensuelle' && !day(a)) return 'Jour du mois : entre 1 et 31.';
  if (v.periodicite === 'annuelle' && !a) return 'Choisissez le mois de la répétition.';
  if ((v.periodicite === 'annuelle' || v.periodicite === 'trimestrielle') && !day(b)) return 'Jour : entre 1 et 31.';
  if (v.debut && v.fin && v.fin < v.debut) return 'La date de fin est avant la date de début.';
  return null;
}

const styles = StyleSheet.create({
  label: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  spaced: { marginTop: 10 },
  summary: { marginTop: 14, fontSize: 14, fontWeight: '600', color: colors.primary },
});
