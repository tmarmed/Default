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
  aDateFin,
  sansEnCours,
  aHeureFin,
  Item,
  ItemInput,
  ItemType,
  Priorite,
  PRIORITE_LABELS,
  Statut,
  STATUT_LABELS,
  TYPE_ICONS,
  TYPE_LABELS,
  TYPE_SHORT,
} from '../types';
import { Chips } from './Chips';
import { DateField } from './DateField';
import { checkRecurrence, RecurrenceFields } from './RecurrenceFields';
import { LinkPicker } from './LinkPicker';
import { filtrerEspace, HierarchyContext, useHierarchy } from '../hierarchyContext';
import { espaceParId, ICONE_ESPACE, libelleEspace, useEspaces } from '../espaces';
import { useSafe } from '../safe';
import { iterationByKey, iterationNom, iterationOf } from '../pi';
import { callNumber } from '../phone';
import { fmtPoints } from '../pi';
import { canHaveSubtasks, PARENT_TYPES, pointsCheck, subtaskMap } from '../subtasks';
import { LigneChoix, LigneFiche, SectionFiche } from './Choix';
import { listeIterations } from '../choixTravail';
import { filTravail } from '../choixTravail';
import { LiaisonOrg } from './LiaisonOrg';
import { BoutonRetour, CheminPile, type Injection, type PileProps } from './FormSheet';

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
  /** Enregistre ; `sousTaches` = titres des sous-tâches à créer avec une nouvelle tâche parente */
  onSave: (input: ItemInput, sousTaches: string[], opts?: { terminerSousTaches?: boolean }) => Promise<void>;
  /** Supprime ; `cascade` = supprimer aussi les sous-tâches (sinon elles deviennent des tâches normales) */
  onDelete: (item: Item, cascade: boolean) => Promise<void>;
  /** Ouvre une autre fiche (sous-tâche ou parent) */
  onOpenTask?: (t: Item) => void;
  /** Sous-tâches d'une tâche déjà enregistrée : ajout et modifications immédiats */
  onAddSubtask?: (parent: Item, titre: string) => Promise<void>;
  onUpdateTask?: (patch: Partial<Item> & { id: string }) => Promise<void>;
  /** Pile de fiches (ouverte depuis une autre fiche) */
  pile?: PileProps;
  /** Élément créé dans une fiche du dessus (« ＋ Nouvelle feature », « ＋ Nouvelle personne »…) : choisi ici */
  injection?: Injection;
  /** « ＋ Nouvelle feature / epic / objectif / domaine » depuis le rattachement */
  onNouveau?: (niveau: 'feature' | 'epic' | 'objectif' | 'domaine', espace: string, defauts?: Record<string, string | undefined>) => void;
  /** « ＋ Nouvelle équipe / personne » depuis la section Delivery */
  onNouveauOrg?: (kind: 'equipeagile' | 'personne', champ: 'equipe' | 'responsable', espace: string) => void;
}

const empty = (type: ItemType, date: string, defaultIteration = ''): ItemInput => ({
  titre: '',
  type,
  date,
  heure: '',
  heure_fin: '',
  date_fin: '',
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
  telephone: '',
  parent: '',
});

/** Seulement les champs enregistrés (pas ceux calculés pour l'affichage). */
const toInput = (i: Item): ItemInput => ({
  titre: i.titre,
  type: i.type,
  date: i.date,
  heure: i.heure,
  heure_fin: i.heure_fin ?? '',
  date_fin: i.date_fin ?? '',
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
  telephone: i.telephone ?? '',
  parent: i.parent ?? '',
  equipe: i.equipe ?? '',
  responsable: i.responsable ?? '',
  espace: i.espace || 'moi',
});

const TYPES = (Object.keys(TYPE_LABELS) as ItemType[]).map((t) => ({
  value: t,
  label: `${TYPE_ICONS[t]} ${TYPE_SHORT[t]}`,
  color: typeColors[t],
}));
const PRIORITES = (Object.keys(PRIORITE_LABELS) as Priorite[]).map((p) => ({
  value: p,
  label: PRIORITE_LABELS[p],
  color: prioriteColors[p],
}));
const STATUTS = (Object.keys(STATUT_LABELS) as Statut[]).map((s) => ({ value: s, label: STATUT_LABELS[s] }));

export function TaskForm({
  visible,
  item,
  defaultType,
  defaultDate,
  defaultIteration,
  defaults,
  onClose,
  onSave,
  onDelete,
  onOpenTask,
  onAddSubtask,
  onUpdateTask,
  pile,
  injection,
  onNouveau,
  onNouveauOrg,
}: Props) {
  const [form, setForm] = useState<ItemInput>(empty(defaultType, defaultDate, defaultIteration));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const safe = useSafe();
  const hTous = useHierarchy();
  // Espaces : une tâche est créée dans un espace ; ses rattachements ne viennent que de cet espace
  const esp = useEspaces();
  const espaceDefaut = esp.visibles[0] ?? 'moi';
  const espace = form.espace || 'moi';
  const h = filtrerEspace(hTous, espace);
  const plusieursEspaces = esp.visibles.length > 1 || espace !== espaceDefaut;
  /** Changer d'espace : les rattachements de l'ancien espace ne valent plus */
  const choisirEspace = (e: string) =>
    setForm((f) => ({
      ...f,
      espace: e,
      epic: '',
      objectif: '',
      domaine: '',
      feature: '',
      parent: '',
      equipe: '',
      responsable: '',
    }));
  // Sous-tâches
  const [cascadeDel, setCascadeDel] = useState(false);
  const [nouvelles, setNouvelles] = useState<string[]>([]);
  const [quick, setQuick] = useState('');
  /** Passée à « Terminé » avec des sous-tâches ouvertes : les terminer aussi ? (null = pas encore répondu) */
  const [terminerSous, setTerminerSous] = useState<boolean | null>(null);
  const enfants = item ? (subtaskMap(h.items).get(item.id) ?? []) : [];
  const parentItem = form.parent ? h.items.find((t) => t.id === form.parent) : undefined;
  const peutAvoir = canHaveSubtasks(form) && !(item && form.parent);
  const check = item ? pointsCheck({ ...item, points: form.points }, enfants) : { parent: 0, sous: 0, alerte: false };
  const tousFaits = enfants.length > 0 && enfants.every((t) => t.statut === 'termine');
  // Même règle que la case à cocher : passer un parent à « Terminé » → terminer aussi ses sous-tâches ouvertes ?
  const sousOuvertes = enfants.filter((t) => t.statut !== 'termine');
  const passeTermine = !!item && item.statut !== 'termine' && form.statut === 'termine';
  // Rendez-vous, appel : pas d'« En cours » (sauf s'il l'est déjà)
  const statuts = STATUTS.filter((o) => o.value !== 'en_cours' || !sansEnCours(form.type) || form.statut === 'en_cours');
  // Parents possibles pour rattacher cette tâche
  const parentsPossibles = h.items
    .filter((t) => canHaveSubtasks(t) && t.id !== item?.id)
    .map((t) => ({ id: t.id, title: `${TYPE_ICONS[t.type]} ${t.titre}`, sub: TYPE_LABELS[t.type] }));
  // Affectations attendues (SAFe) : une story, un bug, une exploration ont leur feature, leur équipe, leur responsable
  const attendu = safe.actif && (form.type === 'story' || form.type === 'bug' || form.type === 'exploration');
  const featureCourante = form.feature ? h.features.get(form.feature) : undefined;

  // Élément créé dans une fiche du dessus : choisi ici (rattachement : seulement le plus précis)
  useEffect(() => {
    if (!injection) return;
    const { champ, id } = injection;
    setForm((f) => {
      if (champ === 'feature' || champ === 'epic' || champ === 'objectif' || champ === 'domaine') {
        const next = { ...f, feature: '', epic: '', objectif: '', domaine: '', [champ]: id };
        const feat = champ === 'feature' ? hTous.features.get(id) : undefined;
        if (feat?.iteration && !next.date && !next.periodicite && !f.iteration) next.iteration = feat.iteration;
        return next;
      }
      return champ === 'equipe' || champ === 'responsable' ? { ...f, [champ]: id } : f;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injection]);

  useEffect(() => {
    if (visible) {
      // (nouvel élément : dans le premier espace affiché, sauf espace imposé ; chaque élément reste dans son espace)
      setForm(item ? toInput(item) : { ...empty(defaultType, defaultDate, defaultIteration), espace: espaceDefaut, ...defaults });
      setError(null);
      setConfirmDelete(false);
      setCascadeDel(false);
      setNouvelles([]);
      setQuick('');
      setTerminerSous(null);
    }
    // Réinitialiser seulement à l'ouverture, pas si la date affichée change derrière.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item]);

  // Fil d'Ariane en haut : où est rangée la tâche (sa tâche parente, sinon feature › epic › objectif › domaine)
  const fil = parentItem ? [filTravail(parentItem, h), `${TYPE_ICONS[parentItem.type]} ${parentItem.titre}`].filter(Boolean).join(' › ') : filTravail(form, h);

  /** Tâche parente choisie (une sous-tâche a le rangement de son parent) ; vide : redevient une tâche principale */
  const choisirParent = (id: string) => {
    if (!id) return setForm((f) => ({ ...f, parent: '' }));
    const p = h.items.find((t) => t.id === id);
    if (!p) return;
    setForm((f) => ({ ...f, parent: id, feature: p.feature, epic: p.epic, objectif: p.objectif, domaine: p.domaine }));
  };

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
    if (aHeureFin(form.type) && form.heure_fin && (!form.heure || form.heure_fin <= form.heure)) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    if (aDateFin(form.type) && !form.periodicite && form.date_fin && form.date && form.date_fin < form.date) {
      setError('La date de fin est avant la date.');
      return;
    }
    if (enfants.length && !PARENT_TYPES.includes(form.type)) {
      setError('Cette tâche a des sous-tâches : gardez le type Story, Démarche, Mission ou Exploration.');
      return;
    }
    if ((enfants.length || nouvelles.length) && form.periodicite) {
      setError('Une tâche avec des sous-tâches ne peut pas être répétée.');
      return;
    }
    if (sousOuvertes.length && passeTermine && terminerSous === null) {
      setError('Répondez d’abord : terminer aussi les sous-tâches ? (sous « Statut »)');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // Un élément répété n'a pas de date unique : ses échéances sont calculées.
      const base = {
        ...form,
        heure_fin: aHeureFin(form.type) ? form.heure_fin : '',
        // Date de fin : démarches non répétées seulement
        date_fin: aDateFin(form.type) && !form.periodicite ? form.date_fin : '',
      };
      const input = base.periodicite ? { ...base, date: '', statut: 'a_faire' as const } : base;
      await onSave({ ...input, titre: input.titre.trim() }, peutAvoir ? nouvelles : [], { terminerSousTaches: passeTermine && !!terminerSous });
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
      await onDelete(item, cascadeDel);
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
    <HierarchyContext.Provider value={h}>
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={[styles.header, (!!pile?.chemin || !!fil) && { borderBottomWidth: 0, paddingBottom: 6 }]}>
          <BoutonRetour pile={pile} onPress={onClose} disabled={busy} style={styles.headerBtn} />
          <Text style={styles.headerTitle}>{item ? TYPE_LABELS[form.type] : 'Nouvelle tâche'}</Text>
          <Pressable onPress={save} hitSlop={10} disabled={busy}>
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
            <TextInput
              style={[styles.input, styles.titleInput]}
              placeholder="Titre"
              placeholderTextColor={colors.muted}
              value={form.titre}
              onChangeText={(v) => set('titre', v)}
              autoFocus={!item}
              returnKeyType="done"
            />

            {plusieursEspaces && (
              <SectionFiche titre="Espace de travail">
                <LigneChoix
                  label="Espace"
                  value={espace}
                  fige={!!item}
                  groupes={[
                    {
                      options: esp.liste
                        .filter((e) => esp.visibles.includes(e.id) || e.id === espace)
                        .map((e) => ({ value: e.id, label: `${ICONE_ESPACE[e.type]} ${libelleEspace(e)}` })),
                    },
                  ]}
                  libelle={(v) => {
                    const e = espaceParId(esp.liste, v);
                    return e ? `${ICONE_ESPACE[e.type]} ${libelleEspace(e)}` : v;
                  }}
                  onChange={(v) => v && choisirEspace(v)}
                />
              </SectionFiche>
            )}

            <Text style={styles.label}>Type</Text>
            <Chips
              options={TYPES}
              value={form.type}
              // Rendez-vous, appel : pas d'« En cours » (il redevient « À faire »)
              onChange={(v) => setForm((f) => ({ ...f, type: v, statut: sansEnCours(v) && f.statut === 'en_cours' ? 'a_faire' : f.statut }))}
              compact
              wrap
            />

            {form.type === 'appel' && (
              <>
                <Text style={styles.label}>Numéro</Text>
                <View style={styles.phoneRow}>
                  <TextInput
                    style={[styles.input, styles.phoneInput]}
                    placeholder="06 12 34 56 78"
                    placeholderTextColor={colors.muted}
                    value={form.telephone}
                    onChangeText={(v) => set('telephone', v.replace(/[^0-9+().\s-]/g, ''))}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                  {!!form.telephone.trim() && (
                    <Pressable
                      style={styles.callBtn}
                      onPress={() => callNumber(form.telephone)}
                      accessibilityRole="button"
                      accessibilityLabel={`Appeler le ${form.telephone}`}
                    >
                      <Text style={styles.callText}>📞 Appeler</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}

            {!form.parent && !enfants.length && !nouvelles.length && (
              <RecurrenceFields value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
            )}

            {!form.periodicite && (
              <>
                <Text style={styles.label}>Date</Text>
                <DateField mode="date" value={form.date} onChange={(v) => set('date', v)} placeholder="Choisir une date" />
                {aDateFin(form.type) && (
                  <>
                    <Text style={styles.label}>Date de fin</Text>
                    <DateField mode="date" value={form.date_fin} onChange={(v) => set('date_fin', v)} placeholder="Date limite (facultatif)" />
                    <Text style={styles.hint}>La date où la démarche doit être finie (ex. expiration du document).</Text>
                  </>
                )}
              </>
            )}

            <Text style={styles.label}>Heure</Text>
            <DateField
              mode="time"
              value={form.heure}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  heure: v,
                  // Rendez-vous, mission : fin proposée une heure après le début (si pas encore choisie)
                  heure_fin: aHeureFin(f.type) && v && (!f.heure_fin || f.heure_fin <= v) ? plusUneHeure(v) : f.heure_fin,
                }))
              }
              placeholder="Choisir une heure"
            />
            {aHeureFin(form.type) && (
              <>
                <Text style={styles.label}>Heure de fin</Text>
                <DateField mode="time" value={form.heure_fin} onChange={(v) => set('heure_fin', v)} placeholder="Choisir l'heure de fin" />
                {!!form.heure && !!form.heure_fin && form.heure_fin > form.heure && (
                  <Text style={styles.hint}>Durée : {duree(form.heure, form.heure_fin)}</Text>
                )}
              </>
            )}

            {form.parent && parentItem ? (
              <SectionFiche titre="Rattachement">
                <LigneChoix
                  label="Tâche parente"
                  value={form.parent}
                  depart={item?.parent}
                  parent
                  groupes={[{ options: parentsPossibles.map((p) => ({ value: p.id, label: p.title })) }]}
                  libelle={() => `${TYPE_ICONS[parentItem.type]} ${parentItem.titre}`}
                  sous="Même rangement que la tâche parente"
                  sans="Pas une sous-tâche"
                  onChange={choisirParent}
                />
              </SectionFiche>
            ) : (
              <LinkPicker
                levels={safe.actif ? ['feature', 'epic', 'objectif', 'domaine'] : ['epic', 'objectif', 'domaine']}
                value={form}
                attendu={attendu ? 'feature' : undefined}
                onChange={(patch) =>
                  setForm((f) => {
                    const next = { ...f, ...patch };
                    // Tâche sans date rangée dans une feature : elle prend l'itération prévue de la feature
                    const feat = patch.feature ? h.features.get(patch.feature) : undefined;
                    if (feat?.iteration && !next.date && !next.periodicite && !f.iteration) next.iteration = feat.iteration;
                    return next;
                  })
                }
                onNouveau={onNouveau ? (n, d) => onNouveau(n, espace, d) : undefined}
                initial={item ? { feature: item.feature, epic: item.epic, objectif: item.objectif, domaine: item.domaine } : undefined}
              >
                {/* Faire de cette tâche une sous-tâche (pas si elle a des sous-tâches ou se répète) */}
                {!enfants.length && !nouvelles.length && !form.periodicite && parentsPossibles.length > 0 && (
                  <LigneChoix
                    label="Tâche parente"
                    value=""
                    depart={item?.parent}
                    parent
                    groupes={[{ options: parentsPossibles.map((p) => ({ value: p.id, label: p.title })) }]}
                    vide="Aucune (tâche principale)"
                    onChange={choisirParent}
                  />
                )}
              </LinkPicker>
            )}
            <LiaisonOrg
              espace={espace}
              niveau="item"
              valeurs={{ equipe: form.equipe, responsable: form.responsable, feature: form.feature, epic: form.epic }}
              initial={item ? { equipe: item.equipe, responsable: item.responsable } : undefined}
              attendu={attendu}
              onChange={(p) => setForm((f) => ({ ...f, ...p }))}
              onNouveau={onNouveauOrg ? (k, champ) => (k === 'equipeagile' || k === 'personne') && (champ === 'equipe' || champ === 'responsable') && onNouveauOrg(k, champ, espace) : undefined}
            />
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
                {!form.periodicite && (
                  <SectionFiche titre="Planification">
                    {form.date ? (
                      <LigneFiche label="Itération" valeur={iterationOf(form.date).label} sous="D'après la date de la tâche" />
                    ) : (
                      <LigneChoix
                        label="Itération"
                        value={form.iteration}
                        depart={item?.iteration}
                        {...listeIterations(featureCourante?.pi, featureCourante?.iteration, form.iteration)}
                        libelle={(v) => iterationNom(v)}
                        sans="Sans itération"
                        onChange={(v) => set('iteration', v)}
                      />
                    )}
                  </SectionFiche>
                )}
              </>
            )}
            {/* Mode Simple : planification SAFe en lecture seule (rien n'est caché ni perdu) */}
            {!safe.actif && (!!form.iteration || !!form.points) && (
              <Text style={styles.hint}>
                {[
                  form.iteration && iterationByKey(form.iteration)
                    ? `Planifiée en ${iterationNom(form.iteration)}`
                    : '',
                  form.points ? fmtPoints(parseFloat(form.points.replace(',', '.')) || 0, safe.pointsJours) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}{' '}
                — modifiable en mode SAFe.
              </Text>
            )}

            {!!enfants.length && <Text style={styles.hint}>Les sous-tâches suivent le rangement de cette tâche.</Text>}

            {peutAvoir && (
              <>
                <SectionFiche
                  titre={`Sous-tâches${enfants.length ? ` · ${enfants.filter((t) => t.statut === 'termine').length}/${enfants.length}` : ''}${check.sous ? ` · ${fmtPoints(check.sous, safe.pointsJours)}` : ''}`}
                />
                {check.alerte && (
                  <View style={styles.alert}>
                    <Text style={styles.alertText}>
                      ⚠ Les sous-tâches font {fmtPoints(check.sous, safe.pointsJours)}, la tâche {fmtPoints(check.parent, safe.pointsJours)}.
                    </Text>
                    <Pressable style={styles.alertBtn} onPress={() => set('points', String(check.sous))} accessibilityRole="button">
                      <Text style={styles.alertBtnText}>Passer la tâche à {fmtPoints(check.sous, safe.pointsJours)}</Text>
                    </Pressable>
                  </View>
                )}
                {!check.alerte && check.sous > 0 && !check.parent && (
                  <Pressable onPress={() => set('points', String(check.sous))} hitSlop={6} style={styles.attach}>
                    <Text style={styles.linkText}>Reporter {fmtPoints(check.sous, safe.pointsJours)} sur la tâche</Text>
                  </Pressable>
                )}
                {enfants.map((t) => {
                  const done = t.statut === 'termine';
                  return (
                    <View key={t.id} style={styles.subRow}>
                      <Pressable
                        onPress={() => onUpdateTask?.({ id: t.id, statut: done ? 'a_faire' : 'termine' }).catch((e) => setError(`Sous-tâche non modifiée : ${(e as Error).message}`))}
                        hitSlop={6}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: done }}
                        accessibilityLabel={`Terminer ${t.titre}`}
                        style={[styles.subCheck, done && styles.subCheckOn]}
                      >
                        {done && <Text style={styles.subCheckMark}>✓</Text>}
                      </Pressable>
                      <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => onOpenTask?.(t)} accessibilityRole="button">
                        <Text style={[styles.subTitle, done && styles.subDone]} numberOfLines={2}>
                          {t.type !== 'tache' ? `${TYPE_ICONS[t.type]} ` : ''}
                          {t.titre}
                        </Text>
                        {(t.date || t.iteration) && (
                          <Text style={styles.subMeta}>
                            {t.date ? `${t.date.slice(8)}/${t.date.slice(5, 7)}${t.heure ? ` ${t.heure}` : ''}` : t.iteration.split('-').pop()}
                          </Text>
                        )}
                      </Pressable>
                      {safe.actif && (
                        <PointsInput
                          value={t.points}
                          onCommit={(v) =>
                            v !== t.points && onUpdateTask?.({ id: t.id, points: v }).catch((e) => setError(`Points non enregistrés : ${(e as Error).message}`))
                          }
                        />
                      )}
                    </View>
                  );
                })}
                {nouvelles.map((titre, i) => (
                  <View key={`n${i}`} style={styles.subRow}>
                    <Text style={styles.subMeta}>＋</Text>
                    <Text style={[styles.subTitle, { flex: 1 }]}>{titre}</Text>
                    <Pressable onPress={() => setNouvelles((l) => l.filter((_, k) => k !== i))} hitSlop={8} accessibilityLabel={`Retirer ${titre}`}>
                      <Text style={styles.subMeta}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                <TextInput
                  style={styles.input}
                  placeholder="+ Sous-tâche (Entrée pour ajouter)"
                  placeholderTextColor={colors.muted}
                  value={quick}
                  onChangeText={setQuick}
                  returnKeyType="done"
                  blurOnSubmit={false}
                  onSubmitEditing={async () => {
                    const titre = quick.trim();
                    if (!titre) return;
                    if (!item || !onAddSubtask) {
                      setNouvelles((l) => [...l, titre]);
                      setQuick('');
                      return;
                    }
                    try {
                      await onAddSubtask({ ...item, ...form }, titre);
                      setQuick('');
                    } catch (e) {
                      setError(`Sous-tâche non ajoutée : ${(e as Error).message}`);
                    }
                  }}
                />
                {!item && nouvelles.length > 0 && <Text style={styles.hint}>Créées à l'enregistrement de la tâche.</Text>}
                {tousFaits && form.statut !== 'termine' && (
                  <Pressable style={styles.finish} onPress={() => set('statut', 'termine')} accessibilityRole="button">
                    <Text style={styles.finishText}>✓ Toutes les sous-tâches sont faites : terminer la tâche</Text>
                  </Pressable>
                )}
              </>
            )}

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
                <Chips options={statuts} value={form.statut} onChange={(v) => set('statut', v)} />
                {passeTermine && sousOuvertes.length > 0 && (
                  <View style={styles.askBox}>
                    <Text style={styles.askText}>
                      Terminer aussi {sousOuvertes.length > 1 ? `les ${sousOuvertes.length} sous-tâches non faites` : 'la sous-tâche non faite'} (
                      {sousOuvertes.map((t) => `« ${t.titre} »`).join(', ')}) ?
                    </Text>
                    <Chips
                      options={[
                        { value: 'oui', label: 'Oui, tout terminer' },
                        { value: 'non', label: 'Non, seulement la tâche' },
                      ]}
                      value={terminerSous === null ? '' : terminerSous ? 'oui' : 'non'}
                      onChange={(v) => setTerminerSous(v === 'oui')}
                    />
                  </View>
                )}
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

            {item && enfants.length > 0 && (
              <Pressable style={styles.cascade} onPress={() => setCascadeDel((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: cascadeDel }}>
                <Text style={styles.cascadeBox}>{cascadeDel ? '☑' : '☐'}</Text>
                <Text style={styles.cascadeText}>
                  En supprimant, supprimer aussi les {enfants.length} sous-tâche{enfants.length > 1 ? 's' : ''} (sinon elles deviennent des tâches normales)
                </Text>
              </Pressable>
            )}
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
    </HierarchyContext.Provider>
  );
}

/** « 10:30 » → « 11:30 » (sans dépasser 23:59) */
function plusUneHeure(h: string): string {
  const [a, b] = h.split(':').map(Number);
  const m = Math.min(a * 60 + b + 60, 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
/** Durée lisible : « 1 h 30 », « 45 min » */
export function duree(debut: string, fin: string): string {
  const m = (h: string) => h.split(':').map(Number).reduce((x, y, i) => (i ? x + y : y * 60), 0);
  const d = m(fin) - m(debut);
  return d >= 60 ? `${Math.floor(d / 60)} h${d % 60 ? ` ${String(d % 60).padStart(2, '0')}` : ''}` : `${d} min`;
}

/** Points d'une sous-tâche, enregistrés en quittant le champ. */
function PointsInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <TextInput
      style={styles.subPoints}
      value={v}
      onChangeText={(x) => setV(x.replace(/[^0-9.,]/g, '').replace(',', '.'))}
      onEndEditing={() => onCommit(v)}
      onBlur={() => onCommit(v)}
      keyboardType="decimal-pad"
      placeholder="—"
      placeholderTextColor={colors.muted}
      accessibilityLabel="Points"
    />
  );
}

const styles = StyleSheet.create({
  parentBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EEF4FE', borderRadius: 10, padding: 10, marginTop: 12 },
  parentText: { fontSize: 14.5, fontWeight: '600', color: colors.primary },
  linkText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  attach: { marginTop: 10, alignSelf: 'flex-start' },
  alert: { marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: '#FCE8E6', gap: 8 },
  alertText: { color: '#A50E0E', fontSize: 13.5, lineHeight: 19 },
  alertBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.danger },
  alertBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 6 },
  subCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  subCheckOn: { backgroundColor: colors.success, borderColor: colors.success },
  subCheckMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  subTitle: { fontSize: 15, color: colors.text },
  subDone: { textDecorationLine: 'line-through', color: colors.muted },
  subMeta: { fontSize: 12, color: colors.muted },
  subPoints: { width: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 6, textAlign: 'center', fontSize: 14, color: colors.text },
  finish: { marginTop: 10, backgroundColor: '#E6F4EA', borderRadius: 10, padding: 12 },
  finishText: { color: colors.success, fontWeight: '700', fontSize: 14 },
  cascade: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28 },
  cascadeBox: { fontSize: 20, color: colors.danger },
  cascadeText: { flex: 1, fontSize: 13.5, color: colors.text },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneInput: { flex: 1, minWidth: 0 },
  callBtn: { backgroundColor: '#00897B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  callText: { color: '#fff', fontWeight: '700', fontSize: 15 },
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
  askBox: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: '#EEF3FE', gap: 8 },
  askText: { fontSize: 14, lineHeight: 19, color: colors.text },
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
