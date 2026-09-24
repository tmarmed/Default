import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface Props {
  /** « Supprimer l'epic » */
  label: string;
  /** Nom de l'élément, pour la confirmation */
  name: string;
  /** Description de ce qui est rattaché, ex. « 2 epics et 5 tâches » ; vide si rien */
  children?: string;
  /** Ce qui arrive aux éléments rattachés sans cascade, ex. « rattachés à l'objectif » */
  keepText?: string;
  disabled?: boolean;
  onDelete: (cascade: boolean) => void;
}

/** Suppression avec option « supprimer aussi tout ce qui est rattaché ». */
export function DeleteSection({ label, name, children, keepText, disabled, onDelete }: Props) {
  const [cascade, setCascade] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const consequence = children
    ? cascade
      ? `${children} seront aussi supprimé(e)s.`
      : `${children} seront conservé(e)s${keepText ? `, ${keepText}` : ''}.`
    : '';

  const press = () => {
    // Le navigateur n'affiche pas les boîtes de dialogue : confirmation par un 2e appui.
    if (Platform.OS === 'web') {
      if (confirm) onDelete(cascade);
      else setConfirm(true);
      return;
    }
    Alert.alert(`${label} ?`, `« ${name} » sera supprimé(e) du Google Sheet. ${consequence}`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(cascade) },
    ]);
  };

  return (
    <View style={styles.box}>
      {!!children && (
        <Pressable
          style={styles.checkRow}
          onPress={() => {
            setCascade((v) => !v);
            setConfirm(false);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: cascade }}
        >
          <View style={[styles.check, cascade && styles.checkOn]}>{cascade && <Text style={styles.checkMark}>✓</Text>}</View>
          <Text style={styles.checkText}>Supprimer aussi tout ce qui est rattaché ({children})</Text>
        </Pressable>
      )}
      <Pressable style={[styles.btn, cascade && styles.btnStrong]} onPress={press} disabled={disabled}>
        <Text style={[styles.btnText, cascade && styles.btnTextStrong]}>
          {confirm ? 'Toucher encore pour confirmer' : cascade ? `${label} et tout son contenu` : label}
        </Text>
      </Pressable>
      {!!consequence && <Text style={[styles.note, cascade && { color: colors.danger }]}>{consequence}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 28, gap: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.danger },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkText: { flex: 1, fontSize: 14, color: colors.text },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#FCE8E6' },
  btnStrong: { backgroundColor: colors.danger },
  btnText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
  btnTextStrong: { color: '#fff' },
  note: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});
