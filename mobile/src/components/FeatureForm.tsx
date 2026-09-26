import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { childrenOf, describeCounts } from '../hierarchy';
import { HierarchyContext, inDomain } from '../hierarchyContext';
import { domaineOf } from '../hierarchy';
import { DomaineChoix } from './DomaineChoix';
import { EspaceChoix, useEspaceFiche } from './EspaceChoix';
import { fmtPoints, iterationsOf, piLabel, piOf, pointsOf, shiftPi } from '../pi';
import { useSafe } from '../safe';
import type { Feature, FeatureInput, Item } from '../types';
import { Chips } from './Chips';
import { ItemPicker } from './ItemPicker';
import { DeleteSection } from './DeleteSection';
import { ChildActions, Field, FormSheet, formStyles as f, Label, Progress } from './FormSheet';
import { LiaisonOrg } from './LiaisonOrg';

interface Props {
  visible: boolean;
  feature: Feature | null;
  /** PI proposé pour une nouvelle feature (écran PI) */
  defaultPi: string;
  onClose: () => void;
  /** Enregistre la feature, puis ses tâches choisies pendant la création */
  onSave: (input: FeatureInput, taches: { nouvelles: string[]; existantes: string[] }) => Promise<void>;
  onDelete: (x: Feature, cascade: boolean) => Promise<void>;
  onOpenTask: (t: Item) => void;
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
  defaults,
  onQuickAddTask,
  onLinkTask,
  onOpenWizard,
  defaultDomaine,
}: Props) {
  // Espace de la fiche ; les rattachements proposés ne viennent que de cet espace
  const { espace, setEspace, h } = useEspaceFiche(visible, feature, defaults);
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
  /** Nouvelle feature : domaine (une feature n'a pas de domaine à elle : il sert à choisir l'epic) */
  const [dom, setDom] = useState('');
  const domEpic = (id: string) => domaineOf({ epic: id }, h)?.id ?? '';
  const epicsProposees = h.epicList.filter((e) => e.id === form.epic || !dom || inDomain(dom, domEpic(e.id), h));

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
      setDom(feature ? '' : (defaultDomaine ?? ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, feature]);

  const set = <K extends keyof FeatureInput>(k: K, v: FeatureInput[K]) => setForm((x) => ({ ...x, [k]: v }));
  const current = piOf(new Date());
  const pis = [-1, 0, 1, 2, 3].map((n) => shiftPi(current, n));
  if (form.pi && !pis.includes(form.pi)) pis.push(form.pi);
  const tasks = feature ? h.items.filter((t) => t.feature === feature.id) : [];
  const sousTitre = (p: Item) => {
    const k = tasks.filter((t) => t.parent === p.id);
    return k.length ? `  (${k.filter((t) => t.statut === 'termine').length}/${k.length})` : '';
  };
  const doneTasks = tasks.filter((t) => t.statut === 'termine');
  const ptsTasks = tasks.reduce((n, t) => n + pointsOf(t), 0);
  const kids = feature ? childrenOf('feature', feature.id, h.data) : null;
  const epic = form.epic ? h.epics.get(form.epic) : undefined;
  // Tâches qu'on peut rattacher : ni répétées, ni terminées, pas déjà dans cette feature
  const candidats = h.items
    // Les sous-tâches suivent leur parent : on ne les rattache pas seules
    .filter((t) => !t.periodicite && !t.parent && t.statut !== 'termine' && (!feature || t.feature !== feature.id) && !existantes.includes(t.id))
    .map((t) => {
      const ft = h.features.get(t.feature);
      const where = ft ? `🧩 ${ft.titre}` : h.epics.get(t.epic)?.titre ?? h.objectifs.get(t.objectif)?.titre ?? h.domaines.get(t.domaine)?.nom ?? 'non rangée';
      const quand = t.date ? `${t.date.slice(8)}/${t.date.slice(5, 7)}` : t.iteration ? t.iteration.split('-').pop() : '';
      return { id: t.id, title: t.titre, sub: [where, quand].filter(Boolean).join(' · ') };
    });

  const save = async () => {
    if (!form.titre.trim()) return setError('Donnez un titre à la feature.');
    setError(null);
    setBusy(true);
    try {
      // L'itération doit appartenir au PI choisi
      const iteration = form.iteration && form.pi && form.iteration.startsWith(form.pi) ? form.iteration : '';
      await onSave({ ...form, espace, iteration, titre: form.titre.trim() }, { nouvelles, existantes });
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HierarchyContext.Provider value={h}>
    <FormSheet visible={visible} title={feature ? 'Feature' : 'Nouvelle feature'} busy={busy} error={error} onClose={onClose} onSave={save}>
      <View style={[f.preview, { backgroundColor: epic?.couleur ?? '#5E6B7D' }]}>
        <Text style={f.previewTitle} numberOfLines={2}>
          🧩 {form.titre || 'Titre de la feature'}
        </Text>
        <Text style={f.previewSub}>
          {epic ? epic.titre : 'Sans epic'}
          {form.pi ? ` · PI ${piLabel(form.pi)}` : ''}
          {form.iteration ? ` · ${form.iteration.split('-').pop()}` : ''}
        </Text>
      </View>
      <Field style={f.titleInput} placeholder="Titre (ex. Prise de rendez-vous en ligne)" value={form.titre} onChangeText={(v) => set('titre', v)} autoFocus={!feature} />
      <EspaceChoix
        espace={espace}
        fige={!!feature}
        onChange={(v) => {
          setEspace(v);
          setDom('');
          setForm((x) => ({ ...x, epic: '' }));
        }}
      />

      {!feature && (
        <DomaineChoix
          value={dom}
          onChange={(v) => {
            setDom(v);
            // Un autre domaine : l'epic choisie n'en fait plus partie
            setForm((x) => ({ ...x, epic: x.epic && v && !inDomain(v, domEpic(x.epic), h) ? '' : x.epic }));
          }}
        />
      )}
      <Label>Epic</Label>
      <Chips
        options={[{ value: '', label: 'Aucune' }, ...epicsProposees.map((e) => ({ value: e.id, label: e.titre, color: e.couleur }))]}
        value={form.epic}
        onChange={(v) => set('epic', v)}
      />

      <LiaisonOrg espace={espace} niveau="feature" valeurs={{ train: form.train, equipe: form.equipe, epic: form.epic }} onChange={(p) => setForm((x) => ({ ...x, ...p }))} />

      <Label>PI (trimestre)</Label>
      <Chips
        options={[{ value: '', label: 'Aucun' }, ...pis.map((p) => ({ value: p, label: piLabel(p) }))]}
        value={form.pi}
        onChange={(v) => setForm((x) => ({ ...x, pi: v, iteration: '' }))}
        compact
        wrap
      />

      {!!form.pi && (
        <>
          <Label>Itération prévue</Label>
          <Chips
            options={[{ value: '', label: 'Non planifiée' }, ...iterationsOf(form.pi).map((it) => ({ value: it.key, label: it.code }))]}
            value={form.iteration}
            onChange={(v) => set('iteration', v)}
            compact
            wrap
          />
        </>
      )}

      <Label>{safe.pointsJours ? 'Points (jours)' : 'Points'}</Label>
      <Field placeholder="Estimation globale, ex. 8" value={form.points} onChangeText={(v) => set('points', v.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" />

      <Label>Description</Label>
      <Field style={f.notes} placeholder="Résultat attendu, critères d'acceptation…" value={form.description} onChangeText={(v) => set('description', v)} multiline />

      <Label>
        Tâches{feature ? ` · ${doneTasks.length}/${tasks.length} terminée(s)` : ''}
        {feature && ptsTasks ? ` · ${fmtPoints(ptsTasks, safe.pointsJours)} estimés` : ''}
      </Label>
      {feature && tasks.length > 0 && <Progress ratio={doneTasks.length / tasks.length} color={epic?.couleur ?? '#1A73E8'} />}
      {(!feature || onQuickAddTask) && (
        <Field
          placeholder={adding ? 'Ajout…' : `+ Nouvelle tâche (Entrée pour ajouter${form.iteration ? `, en ${form.iteration.split('-').pop()}` : ''})`}
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
      {(!feature || onLinkTask) && (
        <Pressable onPress={() => setPicking((v) => !v)} style={f.pickBtn} accessibilityRole="button">
          <Text style={f.pickText}>{picking ? '▾ Fermer' : '+ Tâche existante'}</Text>
        </Pressable>
      )}
      {picking && (
        <ItemPicker
          options={candidats}
          empty="Aucune tâche à rattacher."
          maxHeight={260}
          onPick={async (id) => {
            if (!feature) return setExistantes((l) => [...l, id]);
            const t = h.items.find((x) => x.id === id);
            if (!t) return;
            try {
              await onLinkTask!(feature, t);
            } catch (e) {
              setError(`Tâche non rattachée : ${(e as Error).message}`);
            }
          }}
        />
      )}
      {!feature && (
        <>
          {[...existantes.map((id) => ({ key: id, titre: h.items.find((t) => t.id === id)?.titre ?? '?', nouvelle: false })),
            ...nouvelles.map((titre, i) => ({ key: `n${i}`, titre, nouvelle: true }))].map((x) => (
            <View key={x.key} style={f.link}>
              <Text style={f.muted}>{x.nouvelle ? '＋' : '↪'}</Text>
              <Text style={f.linkTitle} numberOfLines={1}>
                {x.titre}
              </Text>
              <Text style={f.muted}>{x.nouvelle ? 'nouvelle' : 'existante'}</Text>
              <Pressable
                hitSlop={8}
                accessibilityLabel={`Retirer ${x.titre}`}
                onPress={() =>
                  x.nouvelle
                    ? setNouvelles((l) => l.filter((_, i) => `n${i}` !== x.key))
                    : setExistantes((l) => l.filter((id) => id !== x.key))
                }
              >
                <Text style={f.muted}>✕</Text>
              </Pressable>
            </View>
          ))}
          {nouvelles.length + existantes.length > 0 && (
            <Text style={f.hint}>Ces tâches seront rattachées à la feature à l'enregistrement.</Text>
          )}
        </>
      )}
      {feature &&
        (tasks.length === 0 ? (
          <Text style={f.muted}>Aucune tâche pour l'instant.</Text>
        ) : (
          tasks.filter((t) => !t.parent).map((t) => (
            <Pressable key={t.id} style={f.link} onPress={() => onOpenTask(t)}>
              <Text style={f.muted}>{t.statut === 'termine' ? '✓' : t.statut === 'en_cours' ? '▶' : '○'}</Text>
              <Text style={f.linkTitle} numberOfLines={1}>
                {t.titre}
                {sousTitre(t)}
              </Text>
              {!!pointsOf(t) && <Text style={f.muted}>{fmtPoints(pointsOf(t), safe.pointsJours)}</Text>}
            </Pressable>
          ))
        ))}

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
