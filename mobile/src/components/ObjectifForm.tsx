import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { alertesObjectif } from '../alerts';
import { addMonths, toDateString } from '../dates';
import { childrenOf, describeCounts, progressObjectif } from '../hierarchy';
import { useHierarchy } from '../hierarchyContext';
import { formatEpicDates } from '../roadmap';
import { EPIC_COULEURS, Epic, Objectif, ObjectifInput } from '../types';
import { DateField } from './DateField';
import { DeleteSection } from './DeleteSection';
import { AlertList, ChildActions, ColorPicker, Field, FormSheet, formStyles as f, Label, Progress } from './FormSheet';
import { LinkPicker } from './LinkPicker';
import { View } from 'react-native';

interface Props {
  visible: boolean;
  objectif: Objectif | null;
  onClose: () => void;
  onSave: (input: ObjectifInput) => Promise<void>;
  onDelete: (o: Objectif, cascade: boolean) => Promise<void>;
  onOpenEpic: (e: Epic) => void;
  /** Valeurs proposées pour un nouvel objectif (ex. domaine) */
  defaults?: Partial<ObjectifInput>;
  onAddEpic?: (o: Objectif) => void;
  onOpenWizard?: (o: Objectif) => void;
}

const empty = (): ObjectifInput => {
  const today = new Date();
  return {
    titre: '',
    description: '',
    domaine: '',
    debut: toDateString(today),
    fin: toDateString(addMonths(today, 12)),
    couleur: EPIC_COULEURS[0],
    cible: '',
    actuel: '',
    unite: '',
  };
};

const number = (t: string) => t.replace(/[^0-9.,-]/g, '');

/** Fiche d'un objectif : échéance (ou permanent), indicateur, epics, alertes. */
export function ObjectifForm({ visible, objectif, onClose, onSave, onDelete, onOpenEpic, defaults, onAddEpic, onOpenWizard }: Props) {
  const h = useHierarchy();
  const [form, setForm] = useState<ObjectifInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (objectif) {
        const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = objectif;
        setForm(rest);
      } else setForm({ ...empty(), ...defaults });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, objectif]);

  const set = <K extends keyof ObjectifInput>(k: K, v: ObjectifInput[K]) => setForm((x) => ({ ...x, [k]: v }));
  const epics = objectif ? h.epicList.filter((e) => e.objectif === objectif.id) : [];
  const alertes = objectif && form.debut ? alertesObjectif({ id: objectif.id, debut: form.debut, fin: form.fin }, h.epicList, h.items) : [];
  const progress = objectif ? progressObjectif({ ...objectif, ...form }, h.data) : null;
  const children = objectif
    ? childrenOf('objectif', objectif.id, h.data)
    : null;
  const dom = form.domaine ? h.domaines.get(form.domaine) : undefined;

  const save = async () => {
    if (!form.titre.trim()) return setError("Donnez un titre à l'objectif.");
    if (!form.debut) return setError('Choisissez une date de début.');
    if (form.fin && form.fin < form.debut) return setError("L'échéance est avant la date de début.");
    if ((form.cible && isNaN(parseFloat(form.cible))) || (form.actuel && isNaN(parseFloat(form.actuel)))) {
      return setError("L'indicateur doit être un nombre.");
    }
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

  return (
    <FormSheet
      visible={visible}
      title={objectif ? 'Objectif' : 'Nouvel objectif'}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={save}
    >
      <AlertList alertes={alertes} onFix={(a) => setForm((x) => ({ ...x, ...a.patch }))} />

      <View style={[f.preview, { backgroundColor: form.couleur }]}>
        <Text style={f.previewTitle} numberOfLines={2}>
          🎯 {form.titre || "Titre de l'objectif"}
        </Text>
        {!!form.debut && <Text style={f.previewSub}>{form.fin ? formatEpicDates(form) : `${formatEpicDates(form).split(' →')[0]} → permanent`}</Text>}
      </View>

      <Field
        style={f.titleInput}
        placeholder="Titre (ex. Doubler le nombre de clients)"
        value={form.titre}
        onChangeText={(v) => set('titre', v)}
        autoFocus={!objectif}
      />

      <LinkPicker levels={['domaine']} value={form} onChange={(p) => set('domaine', p.domaine ?? '')} />

      <Label>Début</Label>
      <DateField mode="date" value={form.debut} onChange={(v) => set('debut', v)} placeholder="Date de début" />
      <Label>Échéance</Label>
      <DateField mode="date" value={form.fin} onChange={(v) => set('fin', v)} placeholder="Permanent (sans échéance)" />
      <Text style={f.hint}>
        Vide = objectif permanent. L'échéance n'est jamais modifiée automatiquement : si une epic la dépasse, une alerte
        le signale avec un bouton pour l'ajuster.
      </Text>

      <Label>Indicateur (facultatif)</Label>
      <View style={f.row}>
        <Field style={f.flex} placeholder="Actuel" value={form.actuel} onChangeText={(v) => set('actuel', number(v))} keyboardType="decimal-pad" />
        <Field style={f.flex} placeholder="Cible" value={form.cible} onChangeText={(v) => set('cible', number(v))} keyboardType="decimal-pad" />
        <Field style={f.flex} placeholder="Unité" value={form.unite} onChangeText={(v) => set('unite', v)} maxLength={30} />
      </View>
      <Text style={f.hint}>Ex. 8 sur 20 clients. Sans indicateur, l'avancement suit les tâches terminées.</Text>

      <Label>Couleur</Label>
      <ColorPicker value={form.couleur} onChange={(c) => set('couleur', c)} />

      <Label>Description</Label>
      <Field style={f.notes} placeholder="Pourquoi, comment mesurer…" value={form.description} onChangeText={(v) => set('description', v)} multiline />

      {objectif && progress && (
        <>
          <Label>Avancement {progress.label ? `· ${progress.label}` : ''}</Label>
          <Progress ratio={progress.ratio} color={form.couleur} />
          <Label>Epics · {epics.length}</Label>
          {epics.length === 0 ? (
            <Text style={f.muted}>Aucune epic. Pour en rattacher une, ouvrez-la et choisissez cet objectif.</Text>
          ) : (
            epics.map((e) => (
              <Pressable key={e.id} style={f.link} onPress={() => onOpenEpic(e)}>
                <View style={[f.dot, { backgroundColor: e.couleur }]} />
                <Text style={f.linkTitle} numberOfLines={1}>
                  {e.titre}
                </Text>
                <Text style={f.muted}>{formatEpicDates(e).split(' · ')[0]}</Text>
              </Pressable>
            ))
          )}
          <ChildActions
            actions={[
              ...(onAddEpic ? [{ label: '+ Epic', onPress: () => onAddEpic(objectif) }] : []),
              ...(onOpenWizard ? [{ label: "🚀 Ouvrir dans l'assistant", onPress: () => onOpenWizard(objectif), primary: true }] : []),
            ]}
          />
          <DeleteSection
            label="Supprimer l'objectif"
            name={objectif.titre}
            children={children ? (children.epicIds.size + children.taskIds.size ? describeCounts({ objectifs: 0, epics: children.epicIds.size, taches: children.taskIds.size }) : '') : ''}
            keepText={dom ? `rattaché(e)s au domaine ${dom.icone} ${dom.nom}` : 'sans rattachement'}
            disabled={busy}
            onDelete={async (cascade) => {
              setBusy(true);
              try {
                await onDelete(objectif, cascade);
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
