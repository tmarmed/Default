import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useHierarchy } from '../hierarchyContext';
import { piLabel, piOf, shiftPi } from '../pi';
import type { ObjectifPI, ObjectifPIInput } from '../types';
import { Chips } from './Chips';
import { DeleteSection } from './DeleteSection';
import { Field, FormSheet, formStyles as f, Label } from './FormSheet';

interface Props {
  visible: boolean;
  objectif: ObjectifPI | null;
  defaultPi: string;
  /** Domaine proposé (filtre en cours) */
  defaultDomaine: string;
  onClose: () => void;
  onSave: (input: ObjectifPIInput) => Promise<void>;
  onDelete: (x: ObjectifPI, cascade: boolean) => Promise<void>;
}

const VALEURS = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((v) => ({ value: v, label: v || '—' }));

/** Objectif du PI : engagement d'un trimestre, valeur prévue en début, valeur obtenue en fin (sur 10). */
export function ObjectifPIForm({ visible, objectif, defaultPi, defaultDomaine, onClose, onSave, onDelete }: Props) {
  const h = useHierarchy();
  const empty = (): ObjectifPIInput => ({ titre: '', pi: defaultPi, type: 'engage', valeur_prevue: '', valeur_obtenue: '', domaine: defaultDomaine });
  const [form, setForm] = useState<ObjectifPIInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (objectif) {
        const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = objectif;
        setForm({ ...rest, domaine: rest.domaine ?? '' });
      } else setForm(empty());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, objectif]);

  const set = <K extends keyof ObjectifPIInput>(k: K, v: ObjectifPIInput[K]) => setForm((x) => ({ ...x, [k]: v }));
  const current = piOf(new Date());
  const pis = [-1, 0, 1, 2].map((n) => shiftPi(current, n));
  if (form.pi && !pis.includes(form.pi)) pis.push(form.pi);

  const save = async () => {
    if (!form.titre.trim()) return setError("Donnez un titre à l'objectif du PI.");
    if (!form.pi) return setError('Choisissez le PI.');
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
    <FormSheet visible={visible} title={objectif ? 'Objectif du PI' : 'Nouvel objectif du PI'} busy={busy} error={error} onClose={onClose} onSave={save}>
      <Field style={f.titleInput} placeholder="Résultat à livrer (ex. Nouveau site en ligne)" value={form.titre} onChangeText={(v) => set('titre', v)} autoFocus={!objectif} />
      <Label>PI (trimestre)</Label>
      <Chips options={pis.map((p) => ({ value: p, label: piLabel(p) }))} value={form.pi} onChange={(v) => set('pi', v)} compact wrap />
      {h.domaineList.length > 0 && (
        <>
          <Label>Domaine</Label>
          <Chips
            options={[
              { value: '', label: 'Aucun' },
              ...h.domaineList.map((d) => ({ value: d.id, label: `${d.icone} ${d.nom}`, color: d.couleur })),
            ]}
            value={form.domaine}
            onChange={(v) => set('domaine', v)}
            compact
            wrap
          />
        </>
      )}
      <Label>Type</Label>
      <Chips
        options={[
          { value: 'engage', label: '🤝 Engagé', color: '#1A73E8' },
          { value: 'bonus', label: '✨ Bonus', color: '#9AA3AF' },
        ]}
        value={form.type}
        onChange={(v) => set('type', v)}
      />
      <Text style={f.hint}>Engagé : je m'y engage. Bonus : si j'ai le temps (ne compte pas dans la prévisibilité).</Text>
      <Label>Valeur prévue (importance, en début de PI)</Label>
      <Chips options={VALEURS} value={form.valeur_prevue} onChange={(v) => set('valeur_prevue', v)} compact wrap />
      <Label>Valeur obtenue (à noter en fin de PI)</Label>
      <Chips options={VALEURS} value={form.valeur_obtenue} onChange={(v) => set('valeur_obtenue', v)} compact wrap />
      {objectif && (
        <DeleteSection
          label="Supprimer l'objectif du PI"
          name={objectif.titre}
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
      )}
    </FormSheet>
  );
}
