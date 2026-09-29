import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { childrenOf, describeCounts, domaineOf, objectifOf } from '../hierarchy';
import { HierarchyContext } from '../hierarchyContext';
import { EspaceChoix, useEspaceFiche, useEspaceFil } from './EspaceChoix';
import { fmtPoints, iterationNom, piLabel, pointsOf } from '../pi';
import { useSafe } from '../safe';
import { colors } from '../theme';
import type { Feature, FeatureInput, Item } from '../types';
import { chargeOf, subtaskMap } from '../subtasks';
import { DeleteSection } from './DeleteSection';
import { ChildActions, Field, FormSheet, TitreFiche, formStyles as f, type Injection, type PileProps, Progress } from './FormSheet';
import { LiaisonOrg } from './LiaisonOrg';
import { ChoiceSheet } from './ChoiceSheet';
import { ChampEstimation, ChampFiche, FeuilleMulti, LigneChoix, LigneEnfant, SaisieFiche, SectionFiche } from './Choix';
import { filTravail, listeEpics, listeIterations, listePI, metaTache } from '../choixTravail';

interface Props {
  visible: boolean;
  feature: Feature | null;
  /** PI proposé pour une nouvelle feature (écran PI) */
  defaultPi: string;
  onClose: () => void;
  /** Enregistre la feature, puis ses tâches choisies pendant la création */
  onSave: (input: FeatureInput, taches: { nouvelles: string[]; existantes: string[] }, rester?: boolean) => Promise<Feature | void | undefined>;
  pile?: PileProps;
  injection?: Injection;
  /** « ＋ Nouvelle epic » depuis le choix de l'epic */
  onNouvelleEpic?: (defauts?: Record<string, string | undefined>) => void;
  /** « ＋ Tâche » : fiche complète d'une nouvelle tâche de la feature, par-dessus */
  onAddTask?: (f: Feature) => void;
  /** « ＋ Nouveau train / Nouvelle équipe » (section Delivery) */
  onNouveauOrg?: (kind: 'train' | 'equipeagile', champ: 'train' | 'equipe', espace: string) => void;
  onDelete: (x: Feature, cascade: boolean) => Promise<void>;
  onOpenTask: (t: Item) => void;
  /** Case à cocher d'une tâche de la liste : la terminer (ou la rouvrir) */
  onCocherTache?: (t: Item) => void;
  defaults?: Partial<FeatureInput>;
  /** Saisie rapide : crée une tâche dans la feature (avec son itération) */
  onQuickAddTask?: (f: Feature, titre: string) => Promise<void>;
  /** Rattache tout de suite une tâche existante (feature déjà enregistrée) */
  onLinkTask?: (f: Feature, t: Item) => Promise<void>;
  onOpenWizard?: (f: Feature) => void;
  /** Nouvelle feature : domaine présélectionné (les epics proposées sont celles de ce domaine) */
  defaultDomaine?: string;
}

/** Fiche d'une feature (sous-epic) : epic, PI, itération prévue, points, tâches. */
export function FeatureForm({
  visible,
  feature,
  defaultPi,
  onClose,
  onSave,
  onDelete,
  onOpenTask,
  onCocherTache,
  defaults,
  onQuickAddTask,
  onOpenWizard,
  pile,
  injection,
  onNouvelleEpic,
  onAddTask,
  onNouveauOrg,
}: Props) {
  // Espace de la fiche ; les rattachements proposés ne viennent que de cet espace
  const { espace, setEspace, h } = useEspaceFiche(visible, feature, defaults);
  const espaceFil = useEspaceFil(espace);
  const safe = useSafe();
  const empty = (): FeatureInput => ({ titre: '', description: '', epic: '', pi: defaultPi, iteration: '', points: '', couleur: '' });
  const [form, setForm] = useState<FeatureInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quick, setQuick] = useState('');
  const [adding, setAdding] = useState(false);
  /** Nouvelle feature : tâches à créer / à rattacher à l'enregistrement */
  const [nouvelles, setNouvelles] = useState<string[]>([]);
  const [existantes, setExistantes] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [menuPlus, setMenuPlus] = useState(false);

  useEffect(() => {
    if (visible) {
      if (feature) {
        const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = feature;
        setForm(rest);
      } else setForm({ ...empty(), ...defaults });
      setError(null);
      setNouvelles([]);
      setExistantes([]);
      setPicking(false);
      setQuick('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, feature]);

  const set = <K extends keyof FeatureInput>(k: K, v: FeatureInput[K]) => setForm((x) => ({ ...x, [k]: v }));
  const tasks = feature ? h.items.filter((t) => t.feature === feature.id) : [];
  const sousDe = (p: Item) => {
    const k = tasks.filter((t) => t.parent === p.id);
    return { faites: k.filter((t) => t.statut === 'termine').length, total: k.length };
  };
  const doneTasks = tasks.filter((t) => t.statut === 'termine');
  // Total des tâches : un parent ne compte pas en plus de ses sous-tâches
  const subsTasks = subtaskMap(tasks);
  const ptsTasks = tasks.reduce((n, t) => n + chargeOf(t, subsTasks), 0);
  const kids = feature ? childrenOf('feature', feature.id, h.data) : null;
  const epic = form.epic ? h.epics.get(form.epic) : undefined;
  // Tâches qu'on peut rattacher : ni répétées, ni terminées, pas déjà dans cette feature
  const candidats = h.items
    // Les sous-tâches suivent leur parent : on ne les rattache pas seules
    .filter((t) => !t.periodicite && !t.parent && t.statut !== 'termine' && (!feature || t.feature !== feature.id) && !existantes.includes(t.id))
    .map((t) => {
      const ft = h.features.get(t.feature);
      const where = ft ? `🧩 ${ft.titre}` : h.epics.get(t.epic)?.titre ?? h.objectifs.get(t.objectif)?.titre ?? h.domaines.get(t.domaine)?.nom ?? 'sans rattachement';
      const quand = t.date ? `${t.date.slice(8)}/${t.date.slice(5, 7)}` : t.iteration ? t.iteration.split('-').pop() : '';
      return { id: t.id, title: t.titre, sub: [where, quand].filter(Boolean).join(' · '), dans: !!ft };
    });

  const save = async (rester = false): Promise<Feature | undefined> => {
    if (!form.titre.trim()) return void setError('Donnez un titre à la feature.');
    setError(null);
    setBusy(true);
    try {
      // L'itération doit appartenir au PI choisi
      const iteration = form.iteration && form.pi && form.iteration.startsWith(form.pi) ? form.iteration : '';
      const saved = await onSave({ ...form, espace, iteration, titre: form.titre.trim() }, { nouvelles, existantes }, rester);
      if (rester) {
        setNouvelles([]);
        setExistantes([]);
      }
      return saved || undefined;
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  /** Nouvelle feature : enregistrée d'abord, puis la tâche s'ouvre par-dessus */
  const enregistrerPuis = async (suite: (x: Feature) => void) => {
    const x = feature ?? (await save(true));
    if (x) suite(x);
  };
  // Epic créée dans la fiche du dessus : choisie ici
  useEffect(() => {
    if (injection?.champ === 'epic') setForm((x) => ({ ...x, epic: injection.id }));
    if (injection?.champ === 'train') setForm((x) => ({ ...x, train: injection.id }));
    if (injection?.champ === 'equipe') setForm((x) => ({ ...x, equipe: injection.id }));
  }, [injection]);

  return (
    <HierarchyContext.Provider value={h}>
    <FormSheet
      visible={visible}
      title={feature ? 'Feature' : 'Nouvelle feature'}
      couleurTitre={epic?.couleur}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={() => save()}
      retour={pile?.retour}
      espaceFil={espaceFil}
      fil={filTravail({ epic: form.epic }, h)}
      chemin={pile?.chemin}
      onFermerTout={pile?.onFermerTout}
    >
      <TitreFiche
        icone="🧩"
        titre={form.titre}
        vide="Titre de la feature"
        sous={[form.pi ? `PI ${piLabel(form.pi)}` : '', form.iteration ? form.iteration.split('-').pop() : ''].filter(Boolean).join(' · ') || undefined}
        couleur={epic?.couleur}
      />
      <Field style={f.titleInput} placeholder="Titre (ex. Prise de rendez-vous en ligne)" value={form.titre} onChangeText={(v) => set('titre', v)} autoFocus={!feature} />
      <EspaceChoix
        espace={espace}
        fige={!!feature}
        onChange={(v) => {
          setEspace(v);
          setForm((x) => ({ ...x, epic: '', train: '', equipe: '' }));
        }}
      />

      <SectionFiche titre="Rattachement" aDefinir={safe.actif && !form.epic ? 1 : 0}>
        <LigneChoix
          label="Epic"
          value={form.epic}
          depart={feature?.epic}
          parent
          attendu={safe.actif}
          {...listeEpics(h, form.epic || feature?.epic)}
          nouveau={
            onNouvelleEpic
              ? {
                  label: 'Nouvelle epic',
                  // Une nouvelle epic à la place de l'actuelle : sous le même objectif (ou domaine)
                  onPress: () => onNouvelleEpic(epic ? (epic.objectif ? { objectif: epic.objectif } : { domaine: epic.domaine }) : undefined),
                }
              : undefined
          }
          sans="Sans epic"
          onChange={(v) => set('epic', v)}
        />
      </SectionFiche>

      <LiaisonOrg
        espace={espace}
        niveau="feature"
        valeurs={{ train: form.train, equipe: form.equipe, epic: form.epic }}
        initial={feature ? { train: feature.train, equipe: feature.equipe } : undefined}
        onChange={(p) => setForm((x) => ({ ...x, ...p }))}
        onNouveau={onNouveauOrg ? (k, champ) => (k === 'train' || k === 'equipeagile') && (champ === 'train' || champ === 'equipe') && onNouveauOrg(k, champ, espace) : undefined}
      />

      <SectionFiche titre="Planification">
        <LigneChoix
          label="PI"
          value={form.pi}
          depart={feature?.pi}
          {...listePI(form.pi)}
          libelle={(v) => `PI ${piLabel(v)}`}
          sans="Sans PI"
          onChange={(v) => setForm((x) => ({ ...x, pi: v, iteration: '' }))}
        />
        {!!form.pi && (
          <LigneChoix
            label="Itération prévue"
            value={form.iteration}
            depart={feature?.iteration}
            groupes={listeIterations(form.pi).groupes}
            libelle={(v) => iterationNom(v)}
            vide="Non planifiée"
            sans="Non planifiée"
            onChange={(v) => set('iteration', v)}
          />
        )}
        <ChampEstimation value={form.points} onChange={(v) => set('points', v)} jours={safe.pointsJours} placeholder="Facultatif (globale, ex. 8)" />
      </SectionFiche>

      <SectionFiche titre="Détails">
        <ChampFiche label="Description" colonne>
          <SaisieFiche placeholder="Résultat attendu, critères d'acceptation…" value={form.description} onChangeText={(v) => set('description', v)} multiline />
        </ChampFiche>
      </SectionFiche>

      <SectionFiche
        titre={`Tâches · ${tasks.filter((t) => !t.parent).length + existantes.length + nouvelles.length}${feature && tasks.length ? ` · ${doneTasks.length} terminée${doneTasks.length > 1 ? 's' : ''}` : ''}${feature && ptsTasks ? ` · ${fmtPoints(ptsTasks, safe.pointsJours)}` : ''}`}
        onAjouter={() => setMenuPlus(true)}
        ajouterLabel="Ajouter une tâche"
      >
        {feature && tasks.length > 0 && (
          <View style={{ paddingHorizontal: 12 }}>
            <Progress ratio={doneTasks.length / tasks.length} color={epic?.couleur ?? '#1A73E8'} />
          </View>
        )}
        {tasks
          .filter((t) => !t.parent)
          .map((t) => (
            <LigneEnfant
              key={t.id}
              texte={t.titre}
              coche={{ fait: t.statut === 'termine', enCours: t.statut === 'en_cours', onPress: onCocherTache ? () => onCocherTache(t) : undefined }}
              meta={metaTache(t, safe.pointsJours, sousDe(t))}
              onPress={() => onOpenTask(t)}
            />
          ))}
        {existantes.map((id) => {
          const t = h.items.find((x) => x.id === id);
          const avant = t?.feature ? h.features.get(t.feature) : undefined;
          return (
            <LigneEnfant
              key={id}
              texte={t?.titre ?? '?'}
              coche={{ fait: false }}
              ajoute
              avant={avant ? `🧩 ${avant.titre}` : undefined}
              onAnnuler={() => setExistantes((l) => l.filter((x) => x !== id))}
            />
          );
        })}
        {nouvelles.map((titre, i) => (
          <LigneEnfant key={`n${i}`} texte={titre} coche={{ fait: false }} ajoute onAnnuler={() => setNouvelles((l) => l.filter((_, k) => k !== i))} />
        ))}
        {!tasks.length && !existantes.length && !nouvelles.length && <Text style={[f.muted, { padding: 12 }]}>Aucune tâche pour l'instant.</Text>}
        {(!feature || onQuickAddTask) && (
          <TextInput
            style={styles.saisie}
            placeholder={adding ? 'Ajout…' : '＋ Nouvelle tâche'}
            placeholderTextColor={colors.muted}
            value={quick}
            onChangeText={setQuick}
            editable={!adding}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={async () => {
              const titre = quick.trim();
              if (!titre) return;
              if (!feature) {
                setNouvelles((l) => [...l, titre]);
                setQuick('');
                return;
              }
              setAdding(true);
              try {
                await onQuickAddTask!(feature, titre);
                setQuick('');
              } catch (e) {
                setError(`Tâche non ajoutée : ${(e as Error).message}`);
              } finally {
                setAdding(false);
              }
            }}
          />
        )}
        {(!feature || onQuickAddTask) && (
          <Text style={styles.entree}>{`Entrée pour ajouter${form.iteration ? ` · en ${form.iteration.split('-').pop()}` : ''}`}</Text>
        )}
      </SectionFiche>
      {(existantes.length > 0 || nouvelles.length > 0) && <Text style={f.hint}>Ajoutées à la feature à l'enregistrement.</Text>}
      <ChoiceSheet
        key={`plus-${menuPlus}`}
        visible={menuPlus}
        title="Ajouter une tâche"
        choices={[
          ...(onAddTask ? [{ label: '＋ Nouvelle tâche', principal: true, onPress: () => enregistrerPuis(onAddTask) }] : []),
          { label: '☑ Choisir des tâches', suite: true, onPress: () => setPicking(true) },
        ]}
        onClose={() => setMenuPlus(false)}
      />
      {picking && (
        <FeuilleMulti
          titre="Ajouter à la feature"
          groupes={[{ titre: 'Sans feature', options: candidats.filter((c) => !c.dans).map((c) => ({ value: c.id, label: c.title, meta: c.sub })) }]}
          autres={{ titre: 'Dans une autre feature', groupes: [{ options: candidats.filter((c) => c.dans).map((c) => ({ value: c.id, label: c.title, meta: c.sub })) }] }}
          selection={[]}
          vide="Aucune tâche à ajouter."
          libelleValider={(n) => (n ? `Ajouter ${n} tâche${n > 1 ? 's' : ''}` : 'Ajouter')}
          onValider={(l) => {
            setExistantes((x) => [...x, ...l.filter((id) => !x.includes(id))]);
            setPicking(false);
          }}
          onFermer={() => setPicking(false)}
        />
      )}

      {feature && (
        <>
          {onOpenWizard && <ChildActions actions={[{ label: "🚀 Ouvrir dans l'assistant", onPress: () => onOpenWizard(feature), primary: true }]} />}
          <DeleteSection
            label="Supprimer la feature"
            name={feature.titre}
            children={kids && kids.taskIds.size ? describeCounts({ objectifs: 0, epics: 0, taches: kids.taskIds.size }) : ''}
            keepText={epic ? `rattachées à l'epic « ${epic.titre} »` : 'sans rattachement'}
            disabled={busy}
            onDelete={async (cascade) => {
              setBusy(true);
              try {
                await onDelete(feature, cascade);
              } catch (e) {
                setError(`Échec de la suppression : ${(e as Error).message}`);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </FormSheet>
    </HierarchyContext.Provider>
  );
}

const styles = StyleSheet.create({
  entree: { fontSize: 11.5, color: colors.muted, paddingHorizontal: 12, paddingBottom: 10 },
  saisie: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, fontSize: 15, color: colors.text, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
