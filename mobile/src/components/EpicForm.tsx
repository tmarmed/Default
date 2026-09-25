import { useEffect, useState } from 'react';
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { alertesEpic, type Alignement } from '../alerts';
import { addMonths, toDateString } from '../dates';
import { childrenOf, describeCounts, tasksOfEpic } from '../hierarchy';
import { formatEpicDates, progress } from '../roadmap';
import { colors } from '../theme';
import { Epic, EPIC_COULEURS, EpicInput, Item } from '../types';
import { etatEpic, useSafe } from '../safe';
import { ETATS_EPIC } from '../types';
import { Chips } from './Chips';
import { DateField } from './DateField';
import { DeleteSection } from './DeleteSection';
import { ChildActions } from './FormSheet';
import { LinkPicker } from './LinkPicker';
import { HierarchyContext } from '../hierarchyContext';
import { EspaceChoix, useEspaceFiche } from './EspaceChoix';

interface Props {
  visible: boolean;
  /** Epic à afficher / modifier ; absente pour une création. */
  epic: Epic | null;
  items: Item[];
  onClose: () => void;
  onSave: (input: EpicInput) => Promise<void>;
  onDelete: (epic: Epic, cascade: boolean) => Promise<void>;
  onOpenTask: (item: Item) => void;
  /** Valeurs proposées pour une nouvelle epic (ex. objectif) */
  defaults?: Partial<EpicInput>;
  onAddFeature?: (e: Epic) => void;
  onAddTask?: (e: Epic) => void;
  onOpenWizard?: (e: Epic) => void;
  /** Aligner une tâche sur l'epic */
  onAlign?: (a: Alignement) => void;
}

const empty = (): EpicInput => {
  const today = new Date();
  return {
    titre: '',
    description: '',
    debut: toDateString(today),
    fin: toDateString(addMonths(today, 3)),
    couleur: EPIC_COULEURS[0],
    objectif: '',
    domaine: '',
    // Vide = état déduit des dates, tant qu'on n'en choisit pas un
    etat: '',
  };
};

/** Fiche d'une epic : dates, couleur, description, tâches rattachées. */
export function EpicForm({
  visible,
  epic,
  items,
  onClose,
  onSave,
  onDelete,
  onOpenTask,
  defaults,
  onAddFeature,
  onAddTask,
  onOpenWizard,
  onAlign,
}: Props) {
  const [form, setForm] = useState<EpicInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Espace de la fiche ; les rattachements proposés ne viennent que de cet espace
  const { espace, setEspace, h } = useEspaceFiche(visible, epic, defaults);
  const safe = useSafe();
  const features = epic ? h.featureList.filter((f) => f.epic === epic.id) : [];

  useEffect(() => {
    if (visible) {
      setForm(
        epic
          ? {
              titre: epic.titre,
              description: epic.description,
              debut: epic.debut,
              fin: epic.fin,
              couleur: epic.couleur,
              objectif: epic.objectif,
              domaine: epic.domaine,
              // État enregistré seulement s'il a été choisi à la main (vide = déduit des dates)
              etat: epic.etat,
            }
          : { ...empty(), ...defaults },
      );
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, epic]);

  const set = <K extends keyof EpicInput>(key: K, value: EpicInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const tasks = epic ? tasksOfEpic(epic.id, items, h.featureList) : [];
  const kids = epic ? childrenOf('epic', epic.id, h.data) : null;
  const stats = epic ? progress(epic.id, items, h.featureList) : null;
  // Alertes calculées sur les dates en cours de saisie : le bouton ajuste les champs, puis on enregistre.
  const alertes = epic && form.debut ? alertesEpic({ id: epic.id, titre: form.titre || epic.titre, debut: form.debut, fin: form.fin }, items, h.featureList) : [];

  const save = async () => {
    if (!form.titre.trim()) return setError("Donnez un titre à l'epic.");
    if (!form.debut) return setError('Choisissez une date de début.');
    if (form.fin && form.fin < form.debut) return setError('La date de fin est avant la date de début.');
    setError(null);
    setBusy(true);
    try {
      await onSave({ ...form, espace, titre: form.titre.trim() });
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (cascade: boolean) => {
    if (!epic) return;
    setBusy(true);
    try {
      await onDelete(epic, cascade);
    } catch (e) {
      setError(`Échec de la suppression : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // Où vont les tâches si l'epic est supprimée sans cascade
  const parentObj = form.objectif ? h.objectifs.get(form.objectif) : undefined;
  const parentDom = !parentObj && form.domaine ? h.domaines.get(form.domaine) : undefined;
  const keepText = parentObj
    ? `rattachées à l'objectif « ${parentObj.titre} »`
    : parentDom
      ? `rattachées au domaine ${parentDom.icone} ${parentDom.nom}`
      : 'sans rattachement';

  return (
    <HierarchyContext.Provider value={h}>
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
                <View style={styles.alertBtns}>
                  <Pressable
                    style={styles.alertBtn}
                    onPress={() => setForm((f) => ({ ...f, ...a.patch }))}
                    accessibilityRole="button"
                  >
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
            <EspaceChoix
              espace={espace}
              fige={!!epic}
              onChange={(v) => {
                setEspace(v);
                setForm((x) => ({ ...x, objectif: '', domaine: '' }));
              }}
            />

            <LinkPicker
              levels={['objectif', 'domaine']}
              value={form}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            />

            {safe.actif && (
              <>
                <Text style={styles.label}>État (portefeuille)</Text>
                <Chips
                  options={ETATS_EPIC.map((e) => ({ value: e.value, label: e.label, color: e.color }))}
                  value={form.etat || etatEpic(form, toDateString(new Date()))}
                  onChange={(v) => set('etat', v)}
                />
                {!form.etat && <Text style={styles.hint}>Déduit des dates tant que vous n'en choisissez pas un.</Text>}
              </>
            )}

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
                {safe.actif && features.length > 0 && (
                  <Text style={styles.muted}>
                    🧩 {features.length} feature{features.length > 1 ? 's' : ''} : {features.map((f) => f.titre).join(' · ')}
                  </Text>
                )}
                {tasks.length === 0 ? (
                  <Text style={styles.muted}>
                    Aucune tâche. Pour en rattacher une, ouvrez-la et choisissez cette epic.
                  </Text>
                ) : (
                  tasks.filter((t) => !t.parent).map((t) => (
                    <Pressable key={t.id} style={styles.task} onPress={() => onOpenTask(t)}>
                      <Text style={[styles.taskCheck, t.statut === 'termine' && { color: colors.success }]}>
                        {t.periodicite ? '🔁' : t.statut === 'termine' ? '✓' : '○'}
                      </Text>
                      <Text
                        style={[styles.taskTitle, t.statut === 'termine' && !t.periodicite && styles.taskDone]}
                        numberOfLines={1}
                      >
                        {t.titre}
                        {tasks.some((c) => c.parent === t.id)
                          ? `  (${tasks.filter((c) => c.parent === t.id && c.statut === 'termine').length}/${tasks.filter((c) => c.parent === t.id).length})`
                          : ''}
                      </Text>
                      {!!t.date && <Text style={styles.muted}>{t.date.split('-').reverse().join('/')}</Text>}
                    </Pressable>
                  ))
                )}

                <ChildActions
                  actions={[
                    ...(safe.actif && onAddFeature ? [{ label: '+ Feature', onPress: () => onAddFeature(epic) }] : []),
                    ...(onAddTask ? [{ label: '+ Tâche', onPress: () => onAddTask(epic) }] : []),
                    ...(onOpenWizard ? [{ label: "🚀 Ouvrir dans l'assistant", onPress: () => onOpenWizard(epic), primary: true }] : []),
                  ]}
                />
                <DeleteSection
                  label="Supprimer l'epic"
                  name={epic.titre}
                  children={
                    kids && kids.featIds.size + kids.taskIds.size
                      ? describeCounts({ objectifs: 0, epics: 0, features: kids.featIds.size, taches: kids.taskIds.size })
                      : ''
                  }
                  keepText={keepText}
                  disabled={busy}
                  onDelete={doDelete}
                />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
    </HierarchyContext.Provider>
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
  alertBtn: { maxWidth: '100%', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.danger },
  alertBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  // Boutons l'un sous l'autre : leur texte (avec les noms) peut passer à la ligne
  alertBtns: { gap: 8, alignItems: 'flex-start' },
  alertBtn2: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.danger },
  alertBtnText2: { color: colors.danger },
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
});
