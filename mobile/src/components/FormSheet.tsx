import { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Alerte, Alignement } from '../alerts';
import { colors } from '../theme';
import { EPIC_COULEURS } from '../types';

interface Props {
  visible: boolean;
  title: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}

/** Fenêtre de formulaire : Annuler / titre / Enregistrer, message d'erreur, contenu défilant. */
export function FormSheet({ visible, title, busy, error, onClose, onSave, children }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} disabled={busy}>
            <Text style={styles.headerBtn}>Annuler</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <Pressable onPress={onSave} hitSlop={10} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.headerBtn, styles.bold]}>Enregistrer</Text>}
          </Pressable>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {error && <Text style={styles.error}>{error}</Text>}
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />;
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={styles.swatches}>
      {EPIC_COULEURS.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === c }}
          accessibilityLabel={`Couleur ${c}`}
          style={[styles.swatch, { backgroundColor: c }, value === c && styles.swatchOn]}
        />
      ))}
    </View>
  );
}

/**
 * Alertes de dates avec deux boutons : ajuster le parent (champs du formulaire) ou aligner l'élément
 * (tâche, epic) sur le parent, enregistré tout de suite.
 */
export function AlertList({
  alertes,
  onFix,
  onAlign,
}: {
  alertes: Alerte[];
  onFix: (a: Alerte) => void;
  onAlign?: (a: Alignement) => void;
}) {
  return (
    <>
      {alertes.map((a) => (
        <View key={a.key} style={styles.alert}>
          <Text style={styles.alertText}>⚠ {a.message}</Text>
          <View style={styles.alertBtns}>
            <Pressable style={styles.alertBtn} onPress={() => onFix(a)} accessibilityRole="button">
              <Text style={styles.alertBtnText}>{a.bouton}</Text>
            </Pressable>
            {a.aligner && onAlign && (
              <Pressable style={[styles.alertBtn, styles.alertBtn2]} onPress={() => onAlign(a.aligner!)} accessibilityRole="button">
                <Text style={[styles.alertBtnText, styles.alertBtnText2]}>{a.aligner.bouton}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </>
  );
}

/** Boutons « + niveau suivant » et « Ouvrir dans l'assistant » d'une fiche existante. */
export function ChildActions({ actions }: { actions: { label: string; onPress: () => void; primary?: boolean }[] }) {
  return (
    <View style={styles.actions}>
      {actions.map((a) => (
        <Pressable key={a.label} style={[styles.action, a.primary && styles.actionPrimary]} onPress={a.onPress} accessibilityRole="button">
          <Text style={[styles.actionText, a.primary && styles.actionTextPrimary]}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Progress({ ratio, color }: { ratio: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

export const formStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  // minWidth 0 : sinon un champ texte garde sa largeur naturelle et déborde
  flex: { flex: 1, minWidth: 0 },
  notes: { minHeight: 90, textAlignVertical: 'top' },
  hint: { marginTop: 6, fontSize: 12, lineHeight: 17, color: colors.muted },
  muted: { fontSize: 13, color: colors.muted },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  linkTitle: { flex: 1, fontSize: 15, color: colors.text },
  preview: { borderRadius: 12, padding: 14, marginBottom: 16 },
  previewTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  previewSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 },
  titleInput: { fontSize: 18, fontWeight: '500' },
  pickBtn: { alignSelf: 'flex-start', marginTop: 8, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.primary },
  pickText: { color: colors.primary, fontSize: 13.5, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  headerBtn: { fontSize: 16, color: colors.primary },
  bold: { fontWeight: '600' },
  content: { padding: 16, paddingBottom: 48 },
  error: { color: colors.danger, backgroundColor: '#FCE8E6', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 14 },
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
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  swatchOn: { borderWidth: 3, borderColor: colors.text },
  alert: { marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: '#FCE8E6', gap: 8 },
  alertText: { color: '#A50E0E', fontSize: 13.5, lineHeight: 19 },
  alertBtn: { maxWidth: '100%', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.danger },
  alertBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  // Boutons l'un sous l'autre : leur texte (avec les noms) peut passer à la ligne
  alertBtns: { gap: 8, alignItems: 'flex-start' },
  alertBtn2: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.danger },
  alertBtnText2: { color: colors.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  action: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.primary },
  actionPrimary: { backgroundColor: colors.primary },
  actionText: { color: colors.primary, fontSize: 13.5, fontWeight: '700' },
  actionTextPrimary: { color: '#fff' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginVertical: 8 },
  progressFill: { height: 8, borderRadius: 4 },
});
