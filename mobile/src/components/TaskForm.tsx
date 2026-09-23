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
import { colors, prioriteColors, typeColors } from '../theme';
import {
  Item,
  ItemInput,
  ItemType,
  Priorite,
  PRIORITE_LABELS,
  Statut,
  STATUT_LABELS,
  TYPE_LABELS,
} from '../types';
import { Chips } from './Chips';
import { DateField } from './DateField';
import { checkRecurrence, RecurrenceFields } from './RecurrenceFields';

interface Props {
  visible: boolean;
  /** Élément à modifier ; absent pour une création. */
  item: Item | null;
  defaultType: ItemType;
  /** Date proposée pour un nouvel élément (jour affiché), AAAA-MM-JJ ou vide */
  defaultDate: string;
  onClose: () => void;
  onSave: (input: ItemInput) => Promise<void>;
  onDelete: (item: Item) => Promise<void>;
}

const empty = (type: ItemType, date: string): ItemInput => ({
  titre: '',
  type,
  date,
  heure: '',
  lieu: '',
  description: '',
  priorite: 'normale',
  statut: 'a_faire',
  periodicite: '',
  echeance: '',
  debut: '',
  fin: '',
  faits: '',
});

/** Seulement les champs enregistrés (pas ceux calculés pour l'affichage). */
const toInput = (i: Item): ItemInput => ({
  titre: i.titre,
  type: i.type,
  date: i.date,
  heure: i.heure,
  lieu: i.lieu,
  description: i.description,
  priorite: i.priorite,
  statut: i.statut,
  periodicite: i.periodicite,
  echeance: i.echeance,
  debut: i.debut,
  fin: i.fin,
  faits: i.faits,
});

const TYPES = (Object.keys(TYPE_LABELS) as ItemType[]).map((t) => ({
  value: t,
  label: TYPE_LABELS[t],
  color: typeColors[t],
}));
const PRIORITES = (Object.keys(PRIORITE_LABELS) as Priorite[]).map((p) => ({
  value: p,
  label: PRIORITE_LABELS[p],
  color: prioriteColors[p],
}));
const STATUTS = (Object.keys(STATUT_LABELS) as Statut[]).map((s) => ({ value: s, label: STATUT_LABELS[s] }));

export function TaskForm({ visible, item, defaultType, defaultDate, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState<ItemInput>(empty(defaultType, defaultDate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(item ? toInput(item) : empty(defaultType, defaultDate));
      setError(null);
      setConfirmDelete(false);
    }
    // Réinitialiser seulement à l'ouverture, pas si la date affichée change derrière.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item]);

  const set = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.titre.trim()) {
      setError('Donnez un titre à cet élément.');
      return;
    }
    const recurrenceError = checkRecurrence(form);
    if (recurrenceError) {
      setError(recurrenceError);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // Un élément répété n'a pas de date unique : ses échéances sont calculées.
      const input = form.periodicite ? { ...form, date: '', statut: 'a_faire' as const } : form;
      await onSave({ ...input, titre: input.titre.trim() });
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!item) return;
    setBusy(true);
    try {
      await onDelete(item);
    } catch (e) {
      setError(`Échec de la suppression : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!item) return;
    // Le navigateur n'affiche pas les boîtes de dialogue : confirmation par un 2e appui.
    if (Platform.OS === 'web') {
      if (confirmDelete) doDelete();
      else setConfirmDelete(true);
      return;
    }
    Alert.alert('Supprimer ?', `« ${item.titre} » sera supprimé du Google Sheet.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: doDelete,
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} disabled={busy}>
            <Text style={styles.headerBtn}>Annuler</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{item ? 'Modifier' : 'Nouveau'}</Text>
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
            <TextInput
              style={[styles.input, styles.titleInput]}
              placeholder="Titre"
              placeholderTextColor={colors.muted}
              value={form.titre}
              onChangeText={(v) => set('titre', v)}
              autoFocus={!item}
              returnKeyType="done"
            />

            <Text style={styles.label}>Type</Text>
            <Chips options={TYPES} value={form.type} onChange={(v) => set('type', v)} />

            <RecurrenceFields value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />

            {!form.periodicite && (
              <>
                <Text style={styles.label}>Date</Text>
                <DateField mode="date" value={form.date} onChange={(v) => set('date', v)} placeholder="Choisir une date" />
              </>
            )}

            <Text style={styles.label}>Heure</Text>
            <DateField mode="time" value={form.heure} onChange={(v) => set('heure', v)} placeholder="Choisir une heure" />

            <Text style={styles.label}>Lieu</Text>
            <TextInput
              style={styles.input}
              placeholder="Adresse, salle, client…"
              placeholderTextColor={colors.muted}
              value={form.lieu}
              onChangeText={(v) => set('lieu', v)}
            />

            <Text style={styles.label}>Priorité</Text>
            <Chips options={PRIORITES} value={form.priorite} onChange={(v) => set('priorite', v)} />

            {!form.periodicite && (
              <>
                <Text style={styles.label}>Statut</Text>
                <Chips options={STATUTS} value={form.statut} onChange={(v) => set('statut', v)} />
              </>
            )}

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notes]}
              placeholder="Détails, contacts, matériel…"
              placeholderTextColor={colors.muted}
              value={form.description}
              onChangeText={(v) => set('description', v)}
              multiline
              textAlignVertical="top"
            />

            {item && (
              <Pressable style={styles.deleteBtn} onPress={remove} disabled={busy}>
                <Text style={styles.deleteText}>
                  {confirmDelete ? 'Toucher encore pour confirmer' : 'Supprimer'}
                </Text>
              </Pressable>
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
  notes: { minHeight: 110 },
  deleteBtn: {
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#FCE8E6',
  },
  error: {
    color: colors.danger,
    backgroundColor: '#FCE8E6',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  deleteText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
