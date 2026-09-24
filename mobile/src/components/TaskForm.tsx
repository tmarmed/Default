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
import { LinkPicker } from './LinkPicker';
import { useHierarchy } from '../hierarchyContext';
import { useSafe } from '../safe';
import { iterationByKey, iterationOf, shiftIteration } from '../pi';
import { toDateString } from '../dates';

interface Props {
  visible: boolean;
  /** Élément à modifier ; absent pour une création. */
  item: Item | null;
  defaultType: ItemType;
  /** Date proposée pour un nouvel élément (jour affiché), AAAA-MM-JJ ou vide */
  defaultDate: string;
  /** Itération proposée pour un nouvel élément sans date (écran Itération) */
  defaultIteration?: string;
  /** Autres valeurs proposées pour un nouvel élément (ex. epic, feature) */
  defaults?: Partial<ItemInput>;
  onClose: () => void;
  onSave: (input: ItemInput) => Promise<void>;
  onDelete: (item: Item) => Promise<void>;
}

const empty = (type: ItemType, date: string, defaultIteration = ''): ItemInput => ({
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
  epic: '',
  objectif: '',
  domaine: '',
  points: '',
  iteration: defaultIteration,
  feature: '',
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
  epic: i.epic,
  objectif: i.objectif,
  domaine: i.domaine,
  points: i.points,
  iteration: i.iteration,
  feature: i.feature,
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

export function TaskForm({ visible, item, defaultType, defaultDate, defaultIteration, defaults, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState<ItemInput>(empty(defaultType, defaultDate, defaultIteration));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const safe = useSafe();
  const h = useHierarchy();
  // Itérations proposées pour une tâche sans date : la courante et les 5 suivantes
  const itCourante = iterationOf(toDateString(new Date())).key;
  const itOptions = [0, 1, 2, 3, 4, 5].map((n) => {
    const key = n ? shiftIteration(itCourante, n) : itCourante;
    return { value: key, label: `${key.split('-')[1]} ${iterationByKey(key)!.code}` };
  });

  useEffect(() => {
    if (visible) {
      setForm(item ? toInput(item) : { ...empty(defaultType, defaultDate, defaultIteration), ...defaults });
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

            {safe.actif && (
              <>
                <Text style={styles.label}>{safe.pointsJours ? 'Points (jours)' : 'Points'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Estimation, ex. 2"
                  placeholderTextColor={colors.muted}
                  value={form.points}
                  onChangeText={(v) => set('points', v.replace(/[^0-9.,]/g, ''))}
                  keyboardType="decimal-pad"
                />
                {!form.periodicite &&
                  (form.date ? (
                    <Text style={styles.hint}>Itération : {iterationOf(form.date).label} (d'après la date)</Text>
                  ) : (
                    <>
                      <Text style={styles.label}>Itération</Text>
                      <Chips
                        options={[
                          { value: '', label: 'Aucune' },
                          ...itOptions,
                          ...(form.iteration && !itOptions.some((o) => o.value === form.iteration)
                            ? [{ value: form.iteration, label: form.iteration }]
                            : []),
                        ]}
                        value={form.iteration}
                        onChange={(v) => set('iteration', v)}
                      />
                    </>
                  ))}
              </>
            )}

            <LinkPicker
              levels={safe.actif ? ['feature', 'epic', 'objectif', 'domaine'] : ['epic', 'objectif', 'domaine']}
              value={form}
              onChange={(patch) =>
                setForm((f) => {
                  const next = { ...f, ...patch };
                  // Tâche sans date rangée dans une feature : elle prend l'itération prévue de la feature
                  const feat = patch.feature ? h.features.get(patch.feature) : undefined;
                  if (feat?.iteration && !next.date && !next.periodicite && !f.iteration) next.iteration = feat.iteration;
                  return next;
                })
              }
            />

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
  hint: { marginTop: 10, fontSize: 13, color: colors.muted },
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
