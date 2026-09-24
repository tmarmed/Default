import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { alertesEpic } from '../alerts';
import { addMonths, toDateString } from '../dates';
import { formatEpicDates, progress } from '../roadmap';
import { colors } from '../theme';
import { Epic, EPIC_COULEURS, EpicInput, Item } from '../types';
import { DateField } from './DateField';

interface Props {
  visible: boolean;
  /** Epic à afficher / modifier ; absente pour une création. */
  epic: Epic | null;
  items: Item[];
  onClose: () => void;
  onSave: (input: EpicInput) => Promise<void>;
  onDelete: (epic: Epic) => Promise<void>;
  onOpenTask: (item: Item) => void;
}

const empty = (): EpicInput => {
  const today = new Date();
  return {
    titre: '',
    description: '',
    debut: toDateString(today),
    fin: toDateString(addMonths(today, 3)),
    couleur: EPIC_COULEURS[0],
  };
};

/** Fiche d'une epic : dates, couleur, description, tâches rattachées. */
export function EpicForm({ visible, epic, items, onClose, onSave, onDelete, onOpenTask }: Props) {
  const [form, setForm] = useState<EpicInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(
        epic
          ? { titre: epic.titre, description: epic.description, debut: epic.debut, fin: epic.fin, couleur: epic.couleur }
          : empty(),
      );
      setError(null);
      setConfirmDelete(false);
    }
  }, [visible, epic]);

  const set = <K extends keyof EpicInput>(key: K, value: EpicInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const tasks = epic ? items.filter((i) => i.epic === epic.id) : [];
  const stats = epic ? progress(epic.id, items) : null;
  // Alertes calculées sur les dates en cours de saisie : le bouton ajuste les champs, puis on enregistre.
  const alertes = epic && form.debut ? alertesEpic({ id: epic.id, debut: form.debut, fin: form.fin }, items) : [];

  const save = async () => {
    if (!form.titre.trim()) return setError("Donnez un titre à l'epic.");
    if (!form.debut) return setError('Choisissez une date de début.');
    if (form.fin && form.fin < form.debut) return setError('La date de fin est avant la date de début.');
    setError(null);
    setBusy(true);
    try {
      await onSave({ ...form, titre: form.titre.trim() });
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!epic) return;
    setBusy(true);
    try {
      await onDelete(epic);
    } catch (e) {
      setError(`Échec de la suppression : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!epic) return;
    const suite = tasks.length
      ? `Ses ${tasks.length} tâche(s) sont conservées, sans epic.`
      : "Aucune tâche n'y est rattachée.";
    // Le navigateur n'affiche pas les boîtes de dialogue : confirmation par un 2e appui.
    if (Platform.OS === 'web') {
      if (confirmDelete) doDelete();
      else setConfirmDelete(true);
      return;
    }
    Alert.alert("Supprimer l'epic ?", `« ${epic.titre} » sera supprimée du Google Sheet. ${suite}`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} disabled={busy}>
            <Text style={styles.headerBtn}>Annuler</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{epic ? 'Epic' : 'Nouvelle epic'}</Text>
          <Pressable onPress={save} hitSlop={10} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.headerBtn, styles.bold]}>Enregistrer</Text>
            )}
          </Pressable>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {error && <Text style={styles.error}>{error}</Text>}

            {alertes.map((a) => (
              <View key={a.key} style={styles.alert}>
                <Text style={styles.alertText}>⚠ {a.message}</Text>
                <Pressable
                  style={styles.alertBtn}
                  onPress={() => setForm((f) => ({ ...f, ...a.patch }))}
                  accessibilityRole="button"
                >
                  <Text style={styles.alertBtnText}>{a.bouton}</Text>
                </Pressable>
              </View>
            ))}

            <View style={[styles.preview, { backgroundColor: form.couleur }]}>
              <Text style={styles.previewTitle} numberOfLines={2}>
                {form.titre || 'Titre de l’epic'}
              </Text>
              {!!form.debut && (!form.fin || form.fin >= form.debut) && (
                <Text style={styles.previewDates}>{formatEpicDates(form)}</Text>
              )}
            </View>

            <TextInput
              style={[styles.input, styles.titleInput]}
              placeholder="Titre (ex. Refonte du site web)"
              placeholderTextColor={colors.muted}
              value={form.titre}
              onChangeText={(v) => set('titre', v)}
              autoFocus={!epic}
            />

            <Text style={styles.label}>Début</Text>
            <DateField mode="date" value={form.debut} onChange={(v) => set('debut', v)} placeholder="Date de début" />
            <Text style={styles.label}>Fin</Text>
            <DateField mode="date" value={form.fin} onChange={(v) => set('fin', v)} placeholder="Sans fin (epic infinie)" />
            <Text style={styles.hint}>
              Vide = epic sans fin. Si une tâche de l'epic sort de ces dates, une alerte le signale avec un bouton
              pour ajuster.
            </Text>

            <Text style={styles.label}>Couleur</Text>
            <View style={styles.swatches}>
              {EPIC_COULEURS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => set('couleur', c)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: form.couleur === c }}
                  accessibilityLabel={`Couleur ${c}`}
                  style={[styles.swatch, { backgroundColor: c }, form.couleur === c && styles.swatchOn]}
                />
              ))}
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.notes]}
              placeholder="Objectif, périmètre, contacts…"
              placeholderTextColor={colors.muted}
              value={form.description}
              onChangeText={(v) => set('description', v)}
              multiline
              textAlignVertical="top"
            />

            {epic && stats && (
              <>
                <Text style={styles.label}>
                  Tâches · {stats.done}/{stats.total} terminée(s)
                  {stats.repeated ? ` · ${stats.repeated} répétée(s)` : ''}
                </Text>
                {stats.total > 0 && (
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${(stats.done / stats.total) * 100}%`, backgroundColor: epic.couleur },
                      ]}
                    />
                  </View>
                )}
                {tasks.length === 0 ? (
                  <Text style={styles.muted}>
                    Aucune tâche. Pour en rattacher une, ouvrez-la et choisissez cette epic.
                  </Text>
                ) : (
                  tasks.map((t) => (
                    <Pressable key={t.id} style={styles.task} onPress={() => onOpenTask(t)}>
                      <Text style={[styles.taskCheck, t.statut === 'termine' && { color: colors.success }]}>
                        {t.periodicite ? '🔁' : t.statut === 'termine' ? '✓' : '○'}
                      </Text>
                      <Text
                        style={[styles.taskTitle, t.statut === 'termine' && !t.periodicite && styles.taskDone]}
                        numberOfLines={1}
                      >
                        {t.titre}
                      </Text>
                      {!!t.date && <Text style={styles.muted}>{t.date.split('-').reverse().join('/')}</Text>}
                    </Pressable>
                  ))
                )}

                <Pressable style={styles.deleteBtn} onPress={remove} disabled={busy}>
                  <Text style={styles.deleteText}>
                    {confirmDelete ? 'Toucher encore pour confirmer' : "Supprimer l'epic"}
                  </Text>
                </Pressable>
                {confirmDelete && tasks.length > 0 && (
                  <Text style={[styles.muted, styles.center]}>
                    Ses {tasks.length} tâche(s) seront conservées, sans epic.
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

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
  error: {
    color: colors.danger,
    backgroundColor: '#FCE8E6',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  preview: { borderRadius: 12, padding: 14, marginBottom: 16 },
  previewTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  previewDates: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 },
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
  titleInput: { fontSize: 18, fontWeight: '500' },
  notes: { minHeight: 90 },
  alert: { marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: '#FCE8E6', gap: 8 },
  alertText: { color: '#A50E0E', fontSize: 13.5, lineHeight: 19 },
  alertBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.danger },
  alertBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  hint: { marginTop: 6, fontSize: 12, lineHeight: 17, color: colors.muted },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  swatchOn: { borderWidth: 3, borderColor: colors.text },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: 8, borderRadius: 4 },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 6,
  },
  taskCheck: { fontSize: 16, color: colors.muted, width: 22, textAlign: 'center' },
  taskTitle: { flex: 1, fontSize: 15, color: colors.text },
  taskDone: { textDecorationLine: 'line-through', color: colors.muted },
  muted: { fontSize: 13, color: colors.muted },
  center: { textAlign: 'center', marginTop: 6 },
  deleteBtn: {
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#FCE8E6',
  },
  deleteText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
