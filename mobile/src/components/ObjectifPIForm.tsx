import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { domaineOf } from '../hierarchy';
import { HierarchyContext } from '../hierarchyContext';
import { EspaceChoix, useEspaceFiche } from './EspaceChoix';
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
  // Espace de la fiche ; les rattachements proposés ne viennent que de cet espace
  const { espace, setEspace, h } = useEspaceFiche(visible, objectif, { domaine: defaultDomaine });
  const empty = (): ObjectifPIInput => ({ titre: '', pi: defaultPi, type: 'engage', valeur_prevue: '', valeur_obtenue: '', domaine: defaultDomaine, epic: '' });
  const [form, setForm] = useState<ObjectifPIInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (objectif) {
        const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = objectif;
        setForm({ ...rest, domaine: rest.domaine ?? '', epic: rest.epic ?? '' });
      } else setForm(empty());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, objectif]);

  const set = <K extends keyof ObjectifPIInput>(k: K, v: ObjectifPIInput[K]) => setForm((x) => ({ ...x, [k]: v }));
  const domEpic = (id: string) => domaineOf({ epic: id }, h)?.id ?? '';
  // Epics proposées : celles du domaine choisi (toutes sans domaine), sauf les terminées (garder celle déjà choisie)
  const epics = h.epicList.filter((e) => (e.id === form.epic || e.etat !== 'termine') && (!form.domaine || domEpic(e.id) === form.domaine));
  const current = piOf(new Date());
  const pis = [-1, 0, 1, 2].map((n) => shiftPi(current, n));
  if (form.pi && !pis.includes(form.pi)) pis.push(form.pi);

  const save = async () => {
    if (!form.titre.trim()) return setError("Donnez un titre à l'objectif du PI.");
    if (!form.pi) return setError('Choisissez le PI.');
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

  return (
    <HierarchyContext.Provider value={h}>
    <FormSheet visible={visible} title={objectif ? 'Objectif du PI' : 'Nouvel objectif du PI'} busy={busy} error={error} onClose={onClose} onSave={save}>
      <Field style={f.titleInput} placeholder="Résultat à livrer (ex. Nouveau site en ligne)" value={form.titre} onChangeText={(v) => set('titre', v)} autoFocus={!objectif} />
      <EspaceChoix
        espace={espace}
        fige={!!objectif}
        onChange={(v) => {
          setEspace(v);
          setForm((x) => ({ ...x, domaine: '', epic: '' }));
        }}
      />
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
            // Un autre domaine : l'epic choisie n'en fait plus partie
            onChange={(v) => setForm((x) => ({ ...x, domaine: v, epic: x.epic && v && domEpic(x.epic) !== v ? '' : x.epic }))}
            compact
            wrap
          />
        </>
      )}
      {epics.length > 0 && (
        <>
          <Label>Epic</Label>
          <Chips
            options={[{ value: '', label: 'Aucune' }, ...epics.map((e) => ({ value: e.id, label: e.titre, color: e.couleur || undefined }))]}
            value={form.epic}
            // Choisir une epic range aussi l'objectif dans son domaine
            onChange={(v) => setForm((x) => ({ ...x, epic: v, domaine: v ? domEpic(v) || x.domaine : x.domaine }))}
            compact
            wrap
          />
          <Text style={f.hint}>L'objectif est porté par les features et les tâches de cette epic prévues dans le PI.</Text>
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
    </HierarchyContext.Provider>
  );
}
