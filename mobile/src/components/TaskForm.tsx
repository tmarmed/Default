import { useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { ChoiceSheet } from './ChoiceSheet';
import { estIgnoree, IgnoreContext } from './AlertsCard';
import { checkPoints, unite } from '../checks';
import { AlerteChoix, ChampEstimation, ChampFiche, FeuilleMulti, LigneChoix, SaisieFiche, LigneEnfant, LigneFiche, SectionFiche } from './Choix';
import { filTravail, listeIterations, listeTaches, metaTache } from '../choixTravail';
import { LiaisonOrg } from './LiaisonOrg';
import { useEspaceFil } from './EspaceChoix';
import { AutoContext, BandeauAnnuler, useEnregistrementAuto } from './EnregistrementAuto';
import { useOrg } from '../organisation';
import { BoutonRetour, CheminPile, TitreBarre, TitreFiche, type Injection, type PileProps } from './FormSheet';

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
  onSave: (input: ItemInput, sousTaches: string[], opts?: { terminerSousTaches?: boolean; rangerSous?: string[]; rester?: boolean }) => Promise<void>;
  /** Tâche existante : tâches choisies comme sous-tâches, déplacées tout de suite (et « Annuler ») */
  onDeplacer?: (l: { kind: 'tache'; id: string; patch: Record<string, string> }[]) => Promise<void>;
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
/** Titre de la barre pour un nouvel élément, selon son type */
const NOUVEAU: Record<ItemType, string> = {
  tache: 'Nouvelle tâche',
  'rendez-vous': 'Nouveau rendez-vous',
  appel: 'Nouvel appel',
  demarche: 'Nouvelle démarche',
  mission: 'Nouvelle mission',
  story: 'Nouvelle story',
  exploration: 'Nouvelle exploration',
  bug: 'Nouveau bug',
};

/** « la story », « le rendez-vous »… (réponses aux questions) */
const TYPE_ARTICLE: Record<ItemType, string> = {
  tache: 'la tâche',
  'rendez-vous': 'le rendez-vous',
  appel: "l'appel",
  demarche: 'la démarche',
  mission: 'la mission',
  story: 'la story',
  exploration: "l'exploration",
  bug: 'le bug',
};

/** Libellés des champs pour le bandeau « … enregistré » */
const LIBELLES_TACHE: Partial<Record<keyof ItemInput, string>> = {
  titre: 'Titre',
  type: 'Type',
  date: 'Date',
  date_fin: 'Date de fin',
  heure: 'Heure',
  heure_fin: 'Heure de fin',
  lieu: 'Lieu',
  description: 'Notes',
  priorite: 'Priorité',
  statut: 'Statut',
  points: 'Estimation',
  iteration: 'Itération',
  equipe: 'Équipe',
  responsable: 'Responsable',
  parent: 'Tâche parente',
  periodicite: 'Répétition',
  echeance: 'Répétition',
  debut: 'Début de la répétition',
  fin: 'Fin de la répétition',
  telephone: 'Numéro',
};

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
  onDeplacer,
}: Props) {
  const [form, setForm] = useState<ItemInput>(empty(defaultType, defaultDate, defaultIteration));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const safe = useSafe();
  const org = useOrg();
  const hTous = useHierarchy();
  // Espaces : une tâche est créée dans un espace ; ses rattachements ne viennent que de cet espace
  const esp = useEspaces();
  const espaceDefaut = esp.visibles[0] ?? 'moi';
  const espace = form.espace || 'moi';
  const h = filtrerEspace(hTous, espace);
  const espaceFil = useEspaceFil(espace);
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
  /** ＋ rond des sous-tâches : menu, feuille « Ranger », tâches existantes rangées à l'enregistrement */
  const [menuSous, setMenuSous] = useState(false);
  const [rangerOuvert, setRangerOuvert] = useState(false);
  const [rangees, setRangees] = useState<string[]>([]);
  const saisieSous = useRef<TextInput>(null);
  /** Passée à « Terminé » avec des sous-tâches ouvertes : les terminer aussi ? (null = pas encore répondu) */
  const [terminerSous, setTerminerSous] = useState<boolean | null>(null);
  const enfants = item ? (subtaskMap(h.items).get(item.id) ?? []) : [];
  const parentItem = form.parent ? h.items.find((t) => t.id === form.parent) : undefined;
  const peutAvoir = canHaveSubtasks(form) && !(item && form.parent);
  const check = item ? pointsCheck({ ...item, points: form.points }, enfants) : { parent: 0, sous: 0, alerte: false };
  // Estimation ≠ total des sous-tâches : alerte jaune « Passer à … / Garder … » (la même que le centre d'alertes)
  const { ignorees, ignorer } = useContext(IgnoreContext);
  const alertePointsBrute = item ? checkPoints({ ...item, points: form.points }, enfants, unite(safe.pointsJours)) : null;
  const alertePoints = alertePointsBrute && !estIgnoree(alertePointsBrute, ignorees) ? alertePointsBrute : null;
  const tousFaits = enfants.length > 0 && enfants.every((t) => t.statut === 'termine');
  // Même règle que la case à cocher : passer un parent à « Terminé » → terminer aussi ses sous-tâches ouvertes ?
  const sousOuvertes = enfants.filter((t) => t.statut !== 'termine');
  const passeTermine = !!item && item.statut !== 'termine' && form.statut === 'termine';
  // Rendez-vous, appel : pas d'« En cours » (sauf s'il l'est déjà)
  const statuts = STATUTS.filter((o) => o.value !== 'en_cours' || !sansEnCours(form.type) || form.statut === 'en_cours');
  // Parents possibles pour rattacher cette tâche
  const parentsPossibles = h.items.filter((t) => canHaveSubtasks(t) && t.id !== item?.id);
  // Feuille « Tâche parente » : les parents de la même feature (ou epic) d'abord, les autres repliés
  const listeParents = listeTaches(parentsPossibles, h, parentItem ?? form, (x) => TYPE_ICONS[h.items.find((t) => t.id === x.id)!.type]);
  // Tâches qu'on peut ranger comme sous-tâches : principales, sans sous-tâches, ni répétées ni terminées
  const aDesEnfants = new Set(h.items.map((t) => t.parent).filter(Boolean));
  const candidatsSous = listeTaches(
    h.items.filter((t) => t.id !== item?.id && !t.parent && !t.periodicite && t.statut !== 'termine' && !aDesEnfants.has(t.id) && !rangees.includes(t.id)),
    h,
    form,
    (x) => TYPE_ICONS[h.items.find((t) => t.id === x.id)!.type],
  );
  // Tâches : toutes les affectations sont facultatives (rien en orange)
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
    // Tâche existante : le prochain enregistrement annonce la création, et « Annuler » la défait aussi
    if (item && injection.supprimer) auto.lierCreation({ texte: `« ${injection.nom ?? 'Élément'} » créé et choisi`, supprimer: injection.supprimer });
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
      setRangees([]);
      setTerminerSous(null);
    }
    // Réinitialiser seulement à l'ouverture, pas si la date affichée change derrière.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item?.id]);

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

  /** Ce qui empêche d'enregistrer (null : tout va bien) */
  const verifier = (f: ItemInput): string | null => {
    if (!f.titre.trim()) return 'Donnez un titre à cet élément.';
    const recurrenceError = checkRecurrence(f);
    if (recurrenceError) return recurrenceError;
    if (aHeureFin(f.type) && f.heure_fin && (!f.heure || f.heure_fin <= f.heure)) return "L'heure de fin doit être après l'heure de début.";
    if (aDateFin(f.type) && !f.periodicite && f.date_fin && f.date && f.date_fin < f.date) return 'La date de fin est avant la date.';
    if (enfants.length && !PARENT_TYPES.includes(f.type)) return 'Cette tâche a des sous-tâches : gardez le type Story, Démarche, Mission ou Exploration.';
    if ((enfants.length || nouvelles.length || rangees.length) && f.periodicite) return 'Une tâche avec des sous-tâches ne peut pas être répétée.';
    return null;
  };
  /** Ce qui part au Google Sheet */
  const preparer = (f: ItemInput): ItemInput => {
    // Un élément répété n'a pas de date unique : ses échéances sont calculées.
    const base = {
      ...f,
      heure_fin: aHeureFin(f.type) ? f.heure_fin : '',
      // Date de fin : démarches non répétées seulement
      date_fin: aDateFin(f.type) && !f.periodicite ? f.date_fin : '',
    };
    const input = base.periodicite ? { ...base, date: '', statut: 'a_faire' as const } : base;
    return { ...input, titre: input.titre.trim() };
  };
  // Question « terminer aussi les sous-tâches ? » sans réponse : on attend
  const enAttente = sousOuvertes.length > 0 && passeTermine && terminerSous === null;
  const erreurForm = verifier(form);

  // La tâche telle qu'elle est enregistrée, à l'ouverture (même forme que le formulaire)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const formInitial = useMemo(() => (item ? toInput(item) : form), [item?.id]);
  /** Tâche existante : enregistrée au fil de l'eau (bandeau « Annuler »), sans bouton Enregistrer */
  const auto = useEnregistrementAuto({
    actif: !!item,
    cle: item?.id ?? '',
    initial: formInitial,
    form,
    setForm,
    bloque: erreurForm ?? (enAttente ? 'question' : null),
    enregistrer: (f) => onSave(preparer(f), [], { terminerSousTaches: passeTermine && !!terminerSous, rester: true }),
    decrire: (a, b) => decrireTache(a, b),
  });
  /** Texte du bandeau : « Responsable : Nina Dupont », « Titre enregistré », « 2 changements enregistrés » */
  const decrireTache = (a: ItemInput, b: ItemInput) => {
    const champs = (Object.keys(b) as (keyof ItemInput)[]).filter((k) => a[k] !== b[k]);
    const liens = ['feature', 'epic', 'objectif', 'domaine'];
    const vus = champs.some((k) => liens.includes(k)) ? [...champs.filter((k) => !liens.includes(k)), 'feature' as keyof ItemInput] : champs;
    if (vus.length !== 1) return `${vus.length} changements enregistrés`;
    const k = vus[0];
    const v = (x: string) =>
      k === 'type'
        ? TYPE_LABELS[x as ItemType]
        : k === 'statut'
          ? STATUT_LABELS[x as Statut]
          : k === 'priorite'
            ? PRIORITE_LABELS[x as Priorite]
            : k === 'iteration'
              ? iterationNom(x)
              : k === 'responsable'
                ? (org.personne.get(x)?.nom ?? x)
                : k === 'equipe'
                  ? (org.equipe.get(x)?.nom ?? x)
                  : k === 'parent'
                    ? (h.items.find((t) => t.id === x)?.titre ?? x)
                    : x;
    if (liens.includes(k)) return filTravail(b, h) ? `Rattachée à ${filTravail(b, h).split(' › ').pop()}` : 'Rattachement retiré';
    const nom = LIBELLES_TACHE[k] ?? 'Changement';
    const val = String(b[k] ?? '');
    return ['titre', 'description', 'lieu'].includes(k) ? `${nom} enregistré${k === 'description' ? 'es' : ''}` : `${nom} : ${val ? v(val) : 'aucun'}`;
  };

  /** Tâche existante : les tâches choisies deviennent ses sous-tâches tout de suite, avec le rattachement du parent */
  const ajouterSousTaches = async (ids: string[]) => {
    if (!item || !onDeplacer || !ids.length) return;
    const liens = { parent: item.id, feature: form.feature, epic: form.epic, objectif: form.objectif, domaine: form.domaine };
    const avant = ids.map((id) => {
      const t = h.items.find((x) => x.id === id);
      return { kind: 'tache' as const, id, patch: { parent: t?.parent ?? '', feature: t?.feature ?? '', epic: t?.epic ?? '', objectif: t?.objectif ?? '', domaine: t?.domaine ?? '' } };
    });
    try {
      await onDeplacer(ids.map((id) => ({ kind: 'tache' as const, id, patch: liens })));
      const nom = h.items.find((x) => x.id === ids[0])?.titre ?? '';
      auto.annoncer({ texte: ids.length > 1 ? `${ids.length} tâches ajoutées` : `« ${nom} » ajoutée`, annuler: () => onDeplacer(avant) });
    } catch (e) {
      setError(`Non enregistré : ${(e as Error).message}`);
    }
  };

  /** Fermer (tâche existante) : enregistre ce qui attend ; une valeur impossible reste affichée */
  const fermer = async () => {
    if (!item) return onClose();
    if (erreurForm) return setError(erreurForm);
    if (enAttente) return setError('Répondez d’abord : terminer aussi les sous-tâches ? (sous « Statut »)');
    if (await auto.avantFermer()) onClose();
  };

  const save = async () => {
    const e = verifier(form);
    if (e) {
      setError(e);
      return;
    }
    if (enAttente) {
      setError('Répondez d’abord : terminer aussi les sous-tâches ? (sous « Statut »)');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSave(preparer(form), peutAvoir ? nouvelles : [], { terminerSousTaches: passeTermine && !!terminerSous, rangerSous: peutAvoir ? rangees : [] });
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
        <View style={[styles.header, (!!pile?.chemin || !!fil || !!espaceFil) && { borderBottomWidth: 0, paddingBottom: 6 }]}>
          <BoutonRetour pile={pile} onPress={item ? fermer : onClose} disabled={busy} style={styles.headerBtn} fermer={!!item} />
          <TitreBarre texte={item ? TYPE_LABELS[form.type] : NOUVEAU[form.type]} couleur={typeColors[form.type]} avecFil={!!pile?.chemin || !!fil || !!espaceFil} />
          {/* Nouvelle tâche : « Enregistrer » ; tâche existante : enregistrée au fil de l'eau */}
          {item ? (
            <View style={{ width: 60 }} />
          ) : (
            <Pressable onPress={save} hitSlop={10} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.headerBtn, styles.bold]}>Enregistrer</Text>}
            </Pressable>
          )}
        </View>
        <CheminPile pile={pile} fil={fil} espace={espaceFil} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onTouchStart={auto.fermerBandeau} onScrollBeginDrag={auto.fermerBandeau}>
            <AutoContext.Provider value={!!item}>
            {(error || auto.erreur) && <Text style={styles.error}>{error ?? auto.erreur}</Text>}
            {!!item && erreurForm && !error && <Text style={styles.error}>{erreurForm}</Text>}
            <TitreFiche icone={TYPE_ICONS[form.type]} titre={form.titre} vide="Titre de la tâche" couleur={typeColors[form.type]} />
            <TextInput
              style={[styles.input, styles.titleInput]}
              placeholder="Titre"
              placeholderTextColor={colors.muted}
              value={form.titre}
              onChangeText={(v) => set('titre', v)}
              autoFocus={!item}
              returnKeyType="done"
            />

            {plusieursEspaces && !item && (
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

            {/* Élément : type (8 choix → ligne de choix), numéro d'un appel */}
            <SectionFiche titre="Élément">
              <LigneChoix
                label="Type"
                value={form.type}
                groupes={[{ options: TYPES.map((o) => ({ value: o.value, label: o.label })) }]}
                // Rendez-vous, appel : pas d'« En cours » (il redevient « À faire »)
                onChange={(v) => v && setForm((f) => ({ ...f, type: v as ItemType, statut: sansEnCours(v as ItemType) && f.statut === 'en_cours' ? 'a_faire' : f.statut }))}
              />
              {form.type === 'appel' && (
                <ChampFiche label="Numéro">
                  <View style={styles.phoneRow}>
                    <SaisieFiche
                      style={{ flex: 1 }}
                      placeholder="06 12 34 56 78"
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
                </ChampFiche>
              )}
            </SectionFiche>

            {/* Quand : répétition, date, heure */}
            <SectionFiche titre="Quand">
              {!form.parent && !enfants.length && !nouvelles.length && (
                <RecurrenceFields value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
              )}
              {!form.periodicite && (
                <>
                  <ChampFiche label="Date">
                    <DateField nu mode="date" value={form.date} onChange={(v) => set('date', v)} placeholder="Choisir une date" />
                  </ChampFiche>
                  {aDateFin(form.type) && (
                    <ChampFiche label="Date de fin" sous="La date où la démarche doit être finie (ex. expiration du document).">
                      <DateField nu mode="date" value={form.date_fin} onChange={(v) => set('date_fin', v)} placeholder="Date limite (facultatif)" />
                    </ChampFiche>
                  )}
                </>
              )}
              <ChampFiche label="Heure">
                <DateField
                  nu
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
              </ChampFiche>
              {aHeureFin(form.type) && (
                <ChampFiche
                  label="Heure de fin"
                  sous={!!form.heure && !!form.heure_fin && form.heure_fin > form.heure ? `Durée : ${duree(form.heure, form.heure_fin)}` : undefined}
                >
                  <DateField nu mode="time" value={form.heure_fin} onChange={(v) => set('heure_fin', v)} placeholder="Choisir l'heure de fin" />
                </ChampFiche>
              )}
            </SectionFiche>

            {form.parent && parentItem ? (
              <SectionFiche titre="Rattachement">
                <LigneChoix
                  label="Tâche parente"
                  value={form.parent}
                  depart={item?.parent}
                  parent
                  {...listeParents}
                  libelle={() => `${TYPE_ICONS[parentItem.type]} ${parentItem.titre}`}
                  sous="Même rattachement que la tâche parente"
                  sans="Aucune (tâche principale)"
                  onChange={choisirParent}
                />
              </SectionFiche>
            ) : (
              <LinkPicker
                levels={safe.actif ? ['feature', 'epic', 'objectif', 'domaine'] : ['epic', 'objectif', 'domaine']}
                value={form}
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
                {!enfants.length && !nouvelles.length && !rangees.length && !form.periodicite && parentsPossibles.length > 0 && (
                  <LigneChoix
                    label="Tâche parente"
                    value=""
                    depart={item?.parent}
                    parent
                    {...listeParents}
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
              onChange={(p) => setForm((f) => ({ ...f, ...p }))}
              onNouveau={onNouveauOrg ? (k, champ) => (k === 'equipeagile' || k === 'personne') && (champ === 'equipe' || champ === 'responsable') && onNouveauOrg(k, champ, espace) : undefined}
            />
            {/* Planification : itération (SAFe) et estimation (« Estimation » partout ; l'unité est dans la valeur) */}
            <SectionFiche titre="Planification">
              {safe.actif &&
                !form.periodicite &&
                (form.date ? (
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
                ))}
              <ChampEstimation
                value={form.points}
                onChange={(v) => set('points', v)}
                jours={safe.pointsJours}
                // Sans estimation : celle des sous-tâches, en gris (elle compte déjà, rien à décider)
                placeholder={check.sous > 0 ? `${fmtPoints(check.sous, safe.pointsJours)} d'après les sous-tâches` : undefined}
              />
            </SectionFiche>

            {!!enfants.length && <Text style={styles.hint}>Les sous-tâches suivent le rattachement de cette tâche.</Text>}

            {peutAvoir && (
              <>
                <SectionFiche
                  titre={`Sous-tâches${enfants.length ? ` · ${enfants.filter((t) => t.statut === 'termine').length}/${enfants.length}` : ''}${check.sous ? ` · ${fmtPoints(check.sous, safe.pointsJours)}` : ''}`}
                  onAjouter={() => setMenuSous(true)}
                  ajouterLabel="Ajouter une sous-tâche"
                >
                  {/* Même ligne que les tâches d'une feature ou d'une epic : case à cocher, titre, détail gris, › */}
                  {enfants.map((t) => (
                    <LigneEnfant
                      key={t.id}
                      texte={`${t.type !== 'tache' ? `${TYPE_ICONS[t.type]} ` : ''}${t.titre}`}
                      coche={{
                        fait: t.statut === 'termine',
                        enCours: t.statut === 'en_cours',
                        onPress: onUpdateTask
                          ? () => onUpdateTask({ id: t.id, statut: t.statut === 'termine' ? 'a_faire' : 'termine' }).catch((e) => setError(`Sous-tâche non modifiée : ${(e as Error).message}`))
                          : undefined,
                      }}
                      meta={metaTache(t, safe.pointsJours)}
                      onPress={onOpenTask ? () => onOpenTask(t) : undefined}
                    />
                  ))}
                  {nouvelles.map((titre, i) => (
                    <LigneEnfant key={`n${i}`} texte={titre} coche={{ fait: false }} ajoute onAnnuler={() => setNouvelles((l) => l.filter((_, k) => k !== i))} />
                  ))}
                  {rangees.map((id) => {
                    const t = h.items.find((x) => x.id === id);
                    const avant = t ? filTravail(t, h) : '';
                    return (
                      <LigneEnfant
                        key={`r${id}`}
                        texte={t?.titre ?? '?'}
                        coche={{ fait: false }}
                        ajoute
                        avant={avant || undefined}
                        onAnnuler={() => setRangees((l) => l.filter((x) => x !== id))}
                      />
                    );
                  })}
                  {!enfants.length && !nouvelles.length && !rangees.length && <Text style={styles.rien}>Aucune sous-tâche pour l'instant.</Text>}
                  <TextInput
                    ref={saisieSous}
                    style={styles.saisieRapide}
                    placeholder="＋ Nouvelle sous-tâche"
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
                  <Text style={styles.entree}>Entrée pour ajouter</Text>
                </SectionFiche>
                {alertePoints && (
                  <AlerteChoix
                    texte={alertePoints.message}
                    oui={{ label: alertePoints.actions[0].label, onPress: () => set('points', String(check.sous)) }}
                    non={{ label: alertePoints.actions[1].label, onPress: () => ignorer(alertePoints) }}
                  />
                )}
                {rangees.length > 0 && <Text style={styles.hint}>Ajoutées à cette tâche à l'enregistrement.</Text>}
                {!item && nouvelles.length > 0 && <Text style={styles.hint}>Créées à l'enregistrement de la tâche.</Text>}
                {tousFaits && form.statut !== 'termine' && (
                  <Pressable style={styles.finish} onPress={() => set('statut', 'termine')} accessibilityRole="button">
                    <Text style={styles.finishText}>✓ Toutes les sous-tâches sont faites : terminer la tâche</Text>
                  </Pressable>
                )}
                <ChoiceSheet
                  key={`sous-${menuSous}`}
                  visible={menuSous}
                  title="Ajouter une sous-tâche"
                  choices={[
                    { label: '＋ Nouvelle sous-tâche', principal: true, onPress: () => setTimeout(() => saisieSous.current?.focus(), 50) },
                    { label: '☑ Choisir des tâches', suite: true, onPress: () => setRangerOuvert(true) },
                  ]}
                  onClose={() => setMenuSous(false)}
                />
                {rangerOuvert && (
                  <FeuilleMulti
                    titre="Ajouter à cette tâche"
                    {...candidatsSous}
                    selection={[]}
                    vide="Aucune tâche à ajouter."
                    libelleValider={(n) => (n ? `Ajouter ${n} tâche${n > 1 ? 's' : ''}` : 'Ajouter')}
                    onValider={(l) => {
                      setRangerOuvert(false);
                      // Tâche existante : ajoutées tout de suite (bandeau « Annuler ») ; nouvelle tâche : à l'enregistrement
                      if (item && onDeplacer) return void ajouterSousTaches(l);
                      setRangees((x) => [...x, ...l.filter((id) => !x.includes(id))]);
                    }}
                    onFermer={() => setRangerOuvert(false)}
                  />
                )}
              </>
            )}

            {/* Suivi : priorité et statut (3 choix : pastilles) */}
            <SectionFiche titre="Suivi">
              <ChampFiche label="Priorité">
                <Chips options={PRIORITES} value={form.priorite} onChange={(v) => set('priorite', v)} compact />
              </ChampFiche>
              {!form.periodicite && (
                <ChampFiche label="Statut">
                  <Chips options={statuts} value={form.statut} onChange={(v) => set('statut', v)} compact />
                </ChampFiche>
              )}
            </SectionFiche>
            {!form.periodicite && (
              <>
                {passeTermine && sousOuvertes.length > 0 &&
                  // Une question : alerte jaune à deux boutons ; une fois répondue, la réponse en gris (modifiable)
                  (terminerSous === null ? (
                    <AlerteChoix
                      texte={`${sousOuvertes.length > 1 ? `${sousOuvertes.length} sous-tâches ne sont pas faites` : 'Une sous-tâche n’est pas faite'} (${sousOuvertes.map((t) => `« ${t.titre} »`).join(', ')}).`}
                      oui={{ label: sousOuvertes.length > 1 ? `Terminer les ${sousOuvertes.length} sous-tâches` : 'Terminer la sous-tâche', onPress: () => setTerminerSous(true) }}
                      non={{ label: `Seulement ${TYPE_ARTICLE[form.type]}`, onPress: () => setTerminerSous(false) }}
                    />
                  ) : (
                    <Text style={styles.hint}>
                      {terminerSous ? (sousOuvertes.length > 1 ? `Les ${sousOuvertes.length} sous-tâches seront aussi terminées. ` : 'La sous-tâche sera aussi terminée. ') : `Seulement ${TYPE_ARTICLE[form.type]} : ${sousOuvertes.length > 1 ? 'les sous-tâches restent ouvertes' : 'la sous-tâche reste ouverte'}. `}
                      <Text style={styles.lien} onPress={() => setTerminerSous(null)}>
                        Changer
                      </Text>
                    </Text>
                  ))}
              </>
            )}

            {/* Détails : lieu et notes */}
            <SectionFiche titre="Détails">
              <ChampFiche label="Lieu">
                <SaisieFiche placeholder="Adresse, salle, client…" value={form.lieu} onChangeText={(v) => set('lieu', v)} />
              </ChampFiche>
              <ChampFiche label="Notes" colonne>
                <SaisieFiche placeholder="Détails, contacts, matériel…" value={form.description} onChangeText={(v) => set('description', v)} multiline />
              </ChampFiche>
            </SectionFiche>

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
            </AutoContext.Provider>
          </ScrollView>
        </KeyboardAvoidingView>
        <BandeauAnnuler bandeau={auto.bandeau} fermer={auto.fermerBandeau} />
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


const styles = StyleSheet.create({
  saisieRapide: { fontSize: 15, color: colors.text, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  entree: { fontSize: 11.5, color: colors.muted, paddingHorizontal: 12, paddingBottom: 10 },
  rien: { fontSize: 13.5, color: colors.muted, padding: 12 },
  unite: { fontSize: 15, fontWeight: '600', color: colors.muted },
  lien: { color: colors.primary, fontWeight: '700' },
  parentBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EEF4FE', borderRadius: 10, padding: 10, marginTop: 12 },
  parentText: { fontSize: 14.5, fontWeight: '600', color: colors.primary },
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
