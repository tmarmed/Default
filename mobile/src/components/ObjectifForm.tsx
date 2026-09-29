import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { alertesObjectif, type Alignement } from '../alerts';
import { addMonths, toDateString } from '../dates';
import { childrenOf, describeCounts, progressObjectif } from '../hierarchy';
import { HierarchyContext } from '../hierarchyContext';
import { EspaceChoix, useEspaceFiche } from './EspaceChoix';
import { formatEpicDates } from '../roadmap';
import { EPIC_COULEURS, Epic, Objectif, ObjectifInput } from '../types';
import { DateField } from './DateField';
import { DeleteSection } from './DeleteSection';
import { AlertList, ColorPicker, TitreFiche, Field, FormSheet, formStyles as f, type Injection, Label, type PileProps, Progress } from './FormSheet';
import { LinkPicker } from './LinkPicker';
import { ListeEnfants } from './Choix';
import { filTravail } from '../choixTravail';
import { useSafe } from '../safe';
import { View } from 'react-native';

interface Props {
  visible: boolean;
  objectif: Objectif | null;
  onClose: () => void;
  /** `rester` : objectif enregistré avant d'ouvrir un enfant (la fiche reste ouverte) ; renvoie l'objectif */
  onSave: (input: ObjectifInput, rester?: boolean, ranger?: string[]) => Promise<Objectif | void | undefined>;
  pile?: PileProps;
  injection?: Injection;
  /** « ＋ Nouveau domaine » depuis le choix du domaine */
  onNouveauDomaine?: () => void;
  onDelete: (o: Objectif, cascade: boolean) => Promise<void>;
  onOpenEpic: (e: Epic) => void;
  /** Valeurs proposées pour un nouvel objectif (ex. domaine) */
  defaults?: Partial<ObjectifInput>;
  onAddEpic?: (o: Objectif) => void;
  onOpenWizard?: (o: Objectif) => void;
  /** Aligner un élément (epic, tâche) sur l'objectif */
  onAlign?: (a: Alignement) => void;
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
export function ObjectifForm({ visible, objectif, onClose, onSave, onDelete, onOpenEpic, defaults, onAddEpic, onAlign, pile, injection, onNouveauDomaine }: Props) {
  // Espace de la fiche ; les rattachements proposés ne viennent que de cet espace
  const { espace, setEspace, h } = useEspaceFiche(visible, objectif, defaults);
  const [form, setForm] = useState<ObjectifInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Epics existantes rangées dans l'objectif : faites à l'enregistrement */
  const [ranger, setRanger] = useState<string[]>([]);
  const safe = useSafe();

  useEffect(() => {
    if (visible) {
      if (objectif) {
        const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = objectif;
        setForm(rest);
      } else setForm({ ...empty(), ...defaults });
      setError(null);
      setRanger([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, objectif]);

  const set = <K extends keyof ObjectifInput>(k: K, v: ObjectifInput[K]) => setForm((x) => ({ ...x, [k]: v }));
  const epics = objectif ? h.epicList.filter((e) => e.objectif === objectif.id) : [];
  const alertes = objectif && form.debut ? alertesObjectif({ id: objectif.id, titre: form.titre || objectif.titre, debut: form.debut, fin: form.fin }, h.epicList, h.items) : [];
  const progress = objectif ? progressObjectif({ ...objectif, ...form }, h.data) : null;
  const children = objectif
    ? childrenOf('objectif', objectif.id, h.data)
    : null;
  const dom = form.domaine ? h.domaines.get(form.domaine) : undefined;

  const save = async (rester = false): Promise<Objectif | undefined> => {
    if (!form.titre.trim()) return void setError("Donnez un titre à l'objectif.");
    if (!form.debut) return void setError('Choisissez une date de début.');
    if (form.fin && form.fin < form.debut) return void setError("L'échéance est avant la date de début.");
    if ((form.cible && isNaN(parseFloat(form.cible))) || (form.actuel && isNaN(parseFloat(form.actuel)))) {
      return void setError("L'indicateur doit être un nombre.");
    }
    setError(null);
    setBusy(true);
    try {
      const saved = (await onSave({ ...form, espace, titre: form.titre.trim() }, rester, ranger)) || undefined;
      if (rester) setRanger([]);
      return saved;
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  /** Nouvel objectif : enregistré d'abord, puis l'epic s'ouvre par-dessus */
  const enregistrerPuis = async (suite: (o: Objectif) => void) => {
    const o = objectif ?? (await save(true));
    if (o) suite(o);
  };
  // Domaine créé dans la fiche du dessus : choisi ici
  useEffect(() => {
    if (injection?.champ === 'domaine') setForm((x) => ({ ...x, domaine: injection.id }));
  }, [injection]);

  return (
    <HierarchyContext.Provider value={h}>
    <FormSheet
      visible={visible}
      title={objectif ? 'Objectif' : 'Nouvel objectif'}
      couleurTitre={form.couleur}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={() => save()}
      retour={pile?.retour}
      fil={filTravail({ domaine: form.domaine }, h)}
      chemin={pile?.chemin}
      onFermerTout={pile?.onFermerTout}
    >
      <AlertList alertes={alertes} onFix={(a) => setForm((x) => ({ ...x, ...a.patch }))} onAlign={onAlign} />

      <TitreFiche
        icone="🎯"
        titre={form.titre}
        vide="Titre de l'objectif"
        sous={form.debut ? (form.fin ? formatEpicDates(form) : `${formatEpicDates(form).split(' →')[0]} → permanent`) : undefined}
        couleur={form.couleur}
      />

      <Field
        style={f.titleInput}
        placeholder="Titre (ex. Doubler le nombre de clients)"
        value={form.titre}
        onChangeText={(v) => set('titre', v)}
        autoFocus={!objectif}
      />
      <EspaceChoix
        espace={espace}
        fige={!!objectif}
        onChange={(v) => {
          setEspace(v);
          setForm((x) => ({ ...x, domaine: '' }));
        }}
      />

      <LinkPicker
        levels={['domaine']}
        value={form}
        onChange={(p) => set('domaine', p.domaine ?? '')}
        onNouveau={onNouveauDomaine ? () => onNouveauDomaine() : undefined}
        initial={objectif ? { domaine: objectif.domaine } : undefined}
        attendu={safe.actif ? 'domaine' : undefined}
      />

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
        </>
      )}
      <ListeEnfants
        titre={`Epics · ${epics.length}`}
        enfants={epics.map((e) => ({ id: e.id, texte: `🗂️ ${e.titre} · ${formatEpicDates(e).split(' · ')[0]}`, onPress: () => onOpenEpic(e) }))}
        candidats={h.epicList
          .filter((e) => !objectif || e.objectif !== objectif.id)
          .map((e) => ({
            id: e.id,
            titre: `🗂️ ${e.titre}`,
            ailleurs: e.objectif ? `🎯 ${h.objectifs.get(e.objectif)?.titre ?? '?'}` : e.domaine ? `${h.domaines.get(e.domaine)?.icone ?? ''} ${h.domaines.get(e.domaine)?.nom ?? ''}` : undefined,
          }))}
        ranger={ranger}
        setRanger={setRanger}
        nouveau={onAddEpic ? () => enregistrerPuis(onAddEpic) : undefined}
        mots={{
          nouveau: 'Nouvelle epic',
          ranger: 'Ranger une epic existante',
          feuille: "Ranger dans l'objectif",
          libres: 'Sans objectif',
          autres: 'Dans un autre objectif',
          un: "Rangée dans l'objectif à l'enregistrement.",
          plusieurs: "Rangées dans l'objectif à l'enregistrement.",
        }}
        vide="Aucune epic pour l'instant."
      />

      {objectif && progress && (
        <>
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
    </HierarchyContext.Provider>
  );
}
