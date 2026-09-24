import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { childrenOf, describeCounts } from '../hierarchy';
import { useHierarchy } from '../hierarchyContext';
import { fmtPoints, iterationsOf, piLabel, piOf, pointsOf, shiftPi } from '../pi';
import { useSafe } from '../safe';
import type { Feature, FeatureInput, Item } from '../types';
import { Chips } from './Chips';
import { DeleteSection } from './DeleteSection';
import { Field, FormSheet, formStyles as f, Label, Progress } from './FormSheet';

interface Props {
  visible: boolean;
  feature: Feature | null;
  /** PI proposé pour une nouvelle feature (écran PI) */
  defaultPi: string;
  onClose: () => void;
  onSave: (input: FeatureInput) => Promise<void>;
  onDelete: (x: Feature, cascade: boolean) => Promise<void>;
  onOpenTask: (t: Item) => void;
}

/** Fiche d'une feature (sous-epic) : epic, PI, itération prévue, points, tâches. */
export function FeatureForm({ visible, feature, defaultPi, onClose, onSave, onDelete, onOpenTask }: Props) {
  const h = useHierarchy();
  const safe = useSafe();
  const empty = (): FeatureInput => ({ titre: '', description: '', epic: '', pi: defaultPi, iteration: '', points: '', couleur: '' });
  const [form, setForm] = useState<FeatureInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (feature) {
        const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = feature;
        setForm(rest);
      } else setForm(empty());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, feature]);

  const set = <K extends keyof FeatureInput>(k: K, v: FeatureInput[K]) => setForm((x) => ({ ...x, [k]: v }));
  const current = piOf(new Date());
  const pis = [-1, 0, 1, 2, 3].map((n) => shiftPi(current, n));
  if (form.pi && !pis.includes(form.pi)) pis.push(form.pi);
  const tasks = feature ? h.items.filter((t) => t.feature === feature.id) : [];
  const doneTasks = tasks.filter((t) => t.statut === 'termine');
  const ptsTasks = tasks.reduce((n, t) => n + pointsOf(t), 0);
  const kids = feature ? childrenOf('feature', feature.id, h.data) : null;
  const epic = form.epic ? h.epics.get(form.epic) : undefined;

  const save = async () => {
    if (!form.titre.trim()) return setError('Donnez un titre à la feature.');
    setError(null);
    setBusy(true);
    try {
      // L'itération doit appartenir au PI choisi
      const iteration = form.iteration && form.pi && form.iteration.startsWith(form.pi) ? form.iteration : '';
      await onSave({ ...form, iteration, titre: form.titre.trim() });
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
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

      <Label>Epic</Label>
      <Chips
        options={[{ value: '', label: 'Aucune' }, ...h.epicList.map((e) => ({ value: e.id, label: e.titre, color: e.couleur }))]}
        value={form.epic}
        onChange={(v) => set('epic', v)}
      />

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

      {feature && (
        <>
          <Label>
            Tâches · {doneTasks.length}/{tasks.length} terminée(s)
            {ptsTasks ? ` · ${fmtPoints(ptsTasks, safe.pointsJours)} estimés` : ''}
          </Label>
          {tasks.length > 0 && <Progress ratio={doneTasks.length / tasks.length} color={epic?.couleur ?? '#1A73E8'} />}
          {tasks.length === 0 ? (
            <Text style={f.muted}>Aucune tâche. Pour en rattacher une, ouvrez-la et choisissez cette feature.</Text>
          ) : (
            tasks.map((t) => (
              <Pressable key={t.id} style={f.link} onPress={() => onOpenTask(t)}>
                <Text style={f.muted}>{t.statut === 'termine' ? '✓' : t.statut === 'en_cours' ? '▶' : '○'}</Text>
                <Text style={f.linkTitle} numberOfLines={1}>
                  {t.titre}
                </Text>
                {!!pointsOf(t) && <Text style={f.muted}>{fmtPoints(pointsOf(t), safe.pointsJours)}</Text>}
              </Pressable>
            ))
          )}
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
  );
}
