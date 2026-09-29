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
import { Epic, EPIC_COULEURS, EpicInput, Feature, Item } from '../types';
import { etatEpic, useSafe } from '../safe';
import { ETATS_EPIC } from '../types';
import { Chips } from './Chips';
import { DateField } from './DateField';
import { DeleteSection } from './DeleteSection';
import { BoutonRetour, ChildActions, CheminPile, type Injection, type PileProps } from './FormSheet';
import { LinkPicker } from './LinkPicker';
import { HierarchyContext } from '../hierarchyContext';
import { EspaceChoix, useEspaceFiche } from './EspaceChoix';
import { LiaisonOrg } from './LiaisonOrg';
import { filTravail } from '../choixTravail';
import { ChoiceSheet } from './ChoiceSheet';
import { FeuilleMulti, LigneEnfant, ListeEnfants, SectionFiche } from './Choix';

interface Props {
  visible: boolean;
  /** Epic à afficher / modifier ; absente pour une création. */
  epic: Epic | null;
  items: Item[];
  onClose: () => void;
  /** `rester` : epic enregistrée avant d'ouvrir un enfant (la fiche reste ouverte) ; renvoie l'epic enregistrée */
  onSave: (input: EpicInput, rester?: boolean, ranger?: string[], rangerFeatures?: string[]) => Promise<Epic | void | undefined>;
  onDelete: (epic: Epic, cascade: boolean) => Promise<void>;
  /** Pile de fiches (ouverte depuis une autre fiche) */
  pile?: PileProps;
  /** Élément créé dans une fiche du dessus (« ＋ Nouvel objectif ») : choisi ici */
  injection?: Injection;
  /** « ＋ Nouvel objectif / domaine » depuis le choix du rattachement */
  onNouveau?: (niveau: 'objectif' | 'domaine', defauts?: Record<string, string | undefined>) => void;
  /** Consulter une feature de l'epic (par-dessus) */
  onOpenFeature?: (f: Feature) => void;
  /** « ＋ Nouveau portfolio » (section Delivery) */
  onNouveauOrg?: (espace: string) => void;
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
  pile,
  injection,
  onNouveau,
  onOpenFeature,
  onNouveauOrg,
}: Props) {
  const [form, setForm] = useState<EpicInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Tâches existantes rangées dans l'epic (« Ranger une tâche existante ») : faites à l'enregistrement */
  const [ranger, setRanger] = useState<string[]>([]);
  const [rangerF, setRangerF] = useState<string[]>([]);
  const [menuPlus, setMenuPlus] = useState(false);
  const [picking, setPicking] = useState(false);
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
              portfolio: epic.portfolio ?? '',
              // État enregistré seulement s'il a été choisi à la main (vide = déduit des dates)
              etat: epic.etat,
            }
          : { ...empty(), ...defaults },
      );
      setError(null);
      setRanger([]);
      setRangerF([]);
      setPicking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, epic]);

  const set = <K extends keyof EpicInput>(key: K, value: EpicInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const tasks = epic ? tasksOfEpic(epic.id, items, h.featureList) : [];
  const kids = epic ? childrenOf('epic', epic.id, h.data) : null;
  // Tâches qu'on peut ranger dans l'epic : ni répétées, ni terminées, ni sous-tâches, pas déjà dans l'epic
  const dansEpic = new Set(tasks.map((t) => t.id));
  const candidats = h.items
    .filter((t) => !t.periodicite && !t.parent && t.statut !== 'termine' && !dansEpic.has(t.id) && !ranger.includes(t.id))
    .map((t) => {
      const ft = t.feature ? h.features.get(t.feature) : undefined;
      const ep = !ft && t.epic ? h.epics.get(t.epic) : undefined;
      const ailleurs = ft ? `🧩 ${ft.titre}` : ep ? `🗂️ ${ep.titre}` : t.objectif ? `🎯 ${h.objectifs.get(t.objectif)?.titre ?? ''}` : t.domaine ? (h.domaines.get(t.domaine)?.nom ?? '') : '';
      return { id: t.id, titre: t.titre, sub: ailleurs, dans: !!ailleurs };
    });
  const stats = epic ? progress(epic.id, items, h.featureList) : null;
  // Alertes calculées sur les dates en cours de saisie : le bouton ajuste les champs, puis on enregistre.
  const alertes = epic && form.debut ? alertesEpic({ id: epic.id, titre: form.titre || epic.titre, debut: form.debut, fin: form.fin }, items, h.featureList) : [];

  const save = async (rester = false): Promise<Epic | undefined> => {
    if (!form.titre.trim()) return void setError("Donnez un titre à l'epic.");
    if (!form.debut) return void setError('Choisissez une date de début.');
    if (form.fin && form.fin < form.debut) return void setError('La date de fin est avant la date de début.');
    setError(null);
    setBusy(true);
    try {
      const saved = (await onSave({ ...form, espace, titre: form.titre.trim() }, rester, ranger, rangerF)) || undefined;
      if (rester) {
        setRanger([]);
        setRangerF([]);
      }
      return saved;
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  /** Nouvelle epic : enregistrée d'abord, puis l'enfant s'ouvre par-dessus (il a besoin d'elle) */
  const enregistrerPuis = async (suite: (e: Epic) => void) => {
    const e = epic ?? (await save(true));
    if (e) suite(e);
  };

  // Élément créé dans une fiche du dessus (« ＋ Nouvel objectif ») : choisi ici
  useEffect(() => {
    if (!injection) return;
    if (injection.champ === 'objectif') setForm((x) => ({ ...x, objectif: injection.id, domaine: '' }));
    if (injection.champ === 'domaine') setForm((x) => ({ ...x, domaine: injection.id, objectif: '' }));
    if (injection.champ === 'portfolio') setForm((x) => ({ ...x, portfolio: injection.id }));
  }, [injection]);

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

  // Fil d'Ariane en haut : où est rangée l'epic
  const fil = filTravail({ objectif: form.objectif, domaine: form.domaine }, h);

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
        <View style={[styles.header, (!!pile?.chemin || !!fil) && { borderBottomWidth: 0, paddingBottom: 6 }]}>
          <BoutonRetour pile={pile} onPress={onClose} disabled={busy} style={styles.headerBtn} />
          <Text style={styles.headerTitle}>{epic ? 'Epic' : 'Nouvelle epic'}</Text>
          <Pressable onPress={() => save()} hitSlop={10} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.headerBtn, styles.bold]}>Enregistrer</Text>
            )}
          </Pressable>
        </View>
        <CheminPile pile={pile} fil={fil} />
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
              onNouveau={onNouveau ? (n, d) => (n === 'objectif' || n === 'domaine') && onNouveau(n, d) : undefined}
              initial={epic ? { objectif: epic.objectif, domaine: epic.domaine } : undefined}
              attendu={safe.actif ? 'un' : undefined}
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
                <LiaisonOrg
                  espace={espace}
                  niveau="epic"
                  valeurs={{ portfolio: form.portfolio, epic: epic?.id }}
                  initial={epic ? { portfolio: epic.portfolio ?? '' } : undefined}
                  attendu
                  onChange={(p) => setForm((x) => ({ ...x, ...p }))}
                  onNouveau={onNouveauOrg ? () => onNouveauOrg(espace) : undefined}
                />
              </>
            )}
            {/* Mode Simple : état choisi en lecture seule */}
            {!safe.actif && !!form.etat && (
              <Text style={styles.hint}>
                État : {ETATS_EPIC.find((e) => e.value === form.etat)?.label ?? form.etat} — modifiable en mode SAFe.
              </Text>
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

            {safe.actif && (
              <ListeEnfants
                titre={`Features · ${features.length}`}
                enfants={features.map((f) => ({ id: f.id, texte: `🧩 ${f.titre}`, onPress: onOpenFeature ? () => onOpenFeature(f) : undefined }))}
                candidats={h.featureList
                  .filter((f) => !epic || f.epic !== epic.id)
                  .map((f) => ({ id: f.id, titre: `🧩 ${f.titre}`, ailleurs: f.epic ? `🗂️ ${h.epics.get(f.epic)?.titre ?? '?'}` : undefined }))}
                ranger={rangerF}
                setRanger={setRangerF}
                nouveau={onAddFeature ? () => enregistrerPuis(onAddFeature) : undefined}
                mots={{
                  nouveau: 'Nouvelle feature',
                  ranger: 'Ranger une feature existante',
                  feuille: "Ranger dans l'epic",
                  libres: 'Sans epic',
                  autres: 'Dans une autre epic',
                  un: "Rangée dans l'epic à l'enregistrement.",
                  plusieurs: "Rangées dans l'epic à l'enregistrement.",
                }}
                vide="Aucune feature pour l'instant."
              />
            )}

            <SectionFiche
              titre={`Tâches · ${stats ? `${stats.done}/${stats.total} terminée${stats.done > 1 ? 's' : ''}` : ranger.length}${stats?.repeated ? ` · ${stats.repeated} répétée${stats.repeated > 1 ? 's' : ''}` : ''}`}
              onAjouter={() => setMenuPlus(true)}
              ajouterLabel="Ajouter une tâche"
            >
              {!!stats && stats.total > 0 && (
                <View style={[styles.progressTrack, { marginHorizontal: 12 }]}>
                  <View style={[styles.progressFill, { width: `${(stats.done / stats.total) * 100}%`, backgroundColor: form.couleur }]} />
                </View>
              )}
              {tasks
                .filter((t) => !t.parent)
                .map((t) => {
                  const k = tasks.filter((c) => c.parent === t.id);
                  return (
                    <LigneEnfant
                      key={t.id}
                      texte={`${t.periodicite ? '🔁' : t.statut === 'termine' ? '✓' : '○'} ${t.titre}${k.length ? `  (${k.filter((c) => c.statut === 'termine').length}/${k.length})` : ''}${t.date ? ` · ${t.date.split('-').reverse().join('/')}` : ''}`}
                      onPress={() => onOpenTask(t)}
                    />
                  );
                })}
              {ranger.map((id) => {
                const t = items.find((x) => x.id === id);
                const avant = t ? (t.feature ? h.features.get(t.feature) : undefined) : undefined;
                const avantEpic = t && !t.feature && t.epic ? h.epics.get(t.epic) : undefined;
                return (
                  <LigneEnfant
                    key={id}
                    texte={`○ ${t?.titre ?? '?'}`}
                    ajoute
                    avant={avant ? `🧩 ${avant.titre}` : avantEpic ? `🗂️ ${avantEpic.titre}` : undefined}
                    onAnnuler={() => setRanger((l) => l.filter((x) => x !== id))}
                  />
                );
              })}
              {!tasks.length && !ranger.length && <Text style={[styles.muted, { padding: 12 }]}>Aucune tâche pour l'instant.</Text>}
            </SectionFiche>
            {ranger.length > 0 && <Text style={styles.hint}>Rangées dans l'epic à l'enregistrement.</Text>}
            <ChoiceSheet
              key={`plus-${menuPlus}`}
              visible={menuPlus}
              title="Ajouter une tâche"
              choices={[
                ...(onAddTask ? [{ label: '＋ Nouvelle tâche', principal: true, onPress: () => enregistrerPuis(onAddTask) }] : []),
                { label: '↘ Ranger une tâche existante', onPress: () => setPicking(true) },
              ]}
              onClose={() => setMenuPlus(false)}
            />
            {picking && (
              <FeuilleMulti
                titre="Ranger dans l'epic"
                groupes={[{ titre: 'Sans rattachement', options: candidats.filter((c) => !c.dans).map((c) => ({ value: c.id, label: c.titre, meta: c.sub })) }]}
                autres={{ titre: 'Rangées ailleurs', groupes: [{ options: candidats.filter((c) => c.dans).map((c) => ({ value: c.id, label: c.titre, meta: c.sub })) }] }}
                selection={[]}
                vide="Aucune tâche à ranger."
                libelleValider={(n) => (n ? `Ranger ${n} tâche${n > 1 ? 's' : ''}` : 'Ranger')}
                onValider={(l) => {
                  setRanger((x) => [...x, ...l.filter((id) => !x.includes(id))]);
                  setPicking(false);
                }}
                onFermer={() => setPicking(false)}
              />
            )}

            {epic && stats && (
              <>
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
