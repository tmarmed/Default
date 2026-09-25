import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from './src/api';
import { EpicForm } from './src/components/EpicForm';
import { FeatureForm } from './src/components/FeatureForm';
import { IterationView } from './src/components/IterationView';
import { ObjectifPIForm } from './src/components/ObjectifPIForm';
import { PIView } from './src/components/PIView';
import { TypeFilter, TypeFiltre } from './src/components/TypeFilter';
import { PIAddSheet } from './src/components/PIAddSheet';
import { PickerModal } from './src/components/ItemPicker';
import { inDomain } from './src/components/DomainFilter';
import { DomainesPrincipauxChips, DomainFilterContext, loadDomainFilter, saveDomainFilter, SousDomaineChips } from './src/components/DomainFilter';
import { ProjectWizard, WizardStart } from './src/components/ProjectWizard';
import { applyDraft } from './src/wizard';
import { cascadeLinks, parentsLies, pointsCheck, subtaskMap } from './src/subtasks';
import type { Alignement } from './src/alerts';
import { type Action, type Check, checksDatesDomaine, checksParEcran, signaturesExistantes, situationDe } from './src/checks';
import { AlertsCard, CheckActionContext, IgnoreContext, nbAlertes } from './src/components/AlertsCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Portfolio } from './src/components/Portfolio';
import { iterationOf, iterationOfItem, piOf } from './src/pi';
import { Roadmap } from './src/components/Roadmap';
import { LoginScreen } from './src/components/LoginScreen';
import { SettingsScreen } from './src/components/SettingsScreen';
import { TaskForm } from './src/components/TaskForm';
import { TaskItem } from './src/components/TaskItem';
import { DayView, MonthView, WeekView } from './src/components/PeriodViews';
import { PeriodHeader } from './src/components/PeriodHeader';
import { Segmented } from './src/components/Segmented';
import { Swipe } from './src/components/Swipe';
import {
  addDays,
  addMonths,
  formatDate,
  formatMonth,
  formatWeek,
  compareItems,
  groupItems,
  startOfWeek,
  toDateString,
} from './src/dates';
import { AuthError, restoreSession, signOut } from './src/auth';
import { API_URL, GOOGLE_AUTH } from './src/config';
import { DEMO, demoApiFor, ESPACES_DEMO } from './src/demo';
import { type Ecran, type Espace, ESPACE_MOI, espaceParId, EspacesContext, loadEspaces, loadVisibles, onglets, saveEspaces, saveVisibles } from './src/espaces';
import { EspacesBar } from './src/components/EspacesBar';
import { EspacesSheet } from './src/components/EspacesSheet';
import { EcranAVenir } from './src/components/EcranAVenir';
import { ChoiceSheet } from './src/components/ChoiceSheet';
import { DomaineForm } from './src/components/DomaineForm';
import { ObjectifForm } from './src/components/ObjectifForm';
import { domaineOf } from './src/hierarchy';
import { HierarchyContext, makeHierarchyValue } from './src/hierarchyContext';
import { loadSafe, SAFE_DEFAUT, SafeContext, SafeSettings, saveSafe } from './src/safe';
import {
  clearSettings,
  loadCache,
  loadHierarchyCache,
  loadSettings,
  saveCache,
  saveHierarchyCache,
  saveSettings,
} from './src/storage';
import { colors } from './src/theme';
import { expandRange, listEntries, toggleDone } from './src/recurrence';
import {
  Domaine,
  EntityKind,
  Epic,
  dateRepere,
  Feature,
  sansEnCours,
  Ignoree,
  Item,
  ItemInput,
  EpicInput,
  FeatureInput,
  ObjectifInput,
  RECURRENCE_DEFAUTS,
  TYPES_V7,
  Objectif,
  ObjectifPI,
  Settings,
  Statut,
  TYPE_LABELS,
  DOMAINES_DE_BASE,
} from './src/types';

type Filter = TypeFiltre;
type Mode = 'liste' | 'jour' | 'semaine' | 'mois';

const MODES: { value: Mode; label: string }[] = [
  { value: 'liste', label: 'Liste' },
  { value: 'jour', label: 'Jour' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
];

/** Onglets : ceux des espaces affichés, selon leur type et le mode (voir src/espaces.ts) */
type Tab = Ecran;
const TAB_TITLES: Record<Tab, string> = {
  taches: 'Mes tâches',
  iteration: 'Itération',
  pi: 'PI',
  roadmap: 'Roadmap',
  portefeuille: 'Portefeuille',
  strategie: 'Stratégie',
  backlog: 'Backlog',
  equipe: 'Équipe',
  organisation: 'Organisation',
  pilotage: 'Pilotage',
};
const TAB_ICONS: Record<Tab, string> = {
  taches: '✓',
  iteration: '🏃',
  pi: '🗓️',
  roadmap: '▤',
  portefeuille: '🧭',
  strategie: '🎯',
  backlog: '🌳',
  equipe: '👥',
  organisation: '🏛️',
  pilotage: '📊',
};
const TAB_LABELS: Record<Tab, string> = { ...TAB_TITLES, taches: 'Tâches' };
/** Écrans prévus, encore vides (règles de gestion à définir) */
const A_VENIR: Tab[] = ['strategie', 'backlog', 'equipe', 'organisation', 'pilotage'];
/** Nom de l'application : début du nom des fichiers des espaces */
const NOM_APP = 'Mes tâches';

type Hier = {
  epics: Epic[];
  objectifs: Objectif[];
  domaines: Domaine[];
  features: Feature[];
  objectifsPI: ObjectifPI[];
  ignorees: Ignoree[];
};
const EMPTY_HIER: Hier = { epics: [], objectifs: [], domaines: [], features: [], objectifsPI: [], ignorees: [] };

/** Nouvelle sous-tâche : rangement du parent ; sans date, elle prend l'itération du parent. */
const subtaskInput = (parent: Item, titre: string): ItemInput => ({
  ...RECURRENCE_DEFAUTS,
  titre,
  type: 'tache',
  date: '',
  heure: '',
  lieu: '',
  description: '',
  priorite: 'normale',
  statut: 'a_faire',
  parent: parent.id,
  espace: parent.espace,
  feature: parent.feature,
  epic: parent.epic,
  objectif: parent.objectif,
  domaine: parent.domaine,
  iteration: parent.date ? iterationOf(parent.date).key : parent.iteration,
});

/** Domaines de base déjà créés dans Moi (sur cet appareil) */
const DOMAINES_BASE_KEY = 'mes-taches:domaines-de-base';
const DEPLIES_KEY = 'mes-taches:deplies';
/** Statut d'avant « Terminé » (« En cours »), pour décocher sans le perdre ; mémorisé sur l'appareil */
const STATUT_AVANT_KEY = 'mes-taches:statut-avant';

const matchesType = (i: Item, filter: Filter) =>
  filter === 'tous' || (filter === 'recurrents' ? !!i.periodicite : i.type === filter);

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
          <Main />
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

function Main() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [booting, setBooting] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  /** Données de tous les espaces (chaque élément porte son espace) ; seuls les espaces affichés sont montrés */
  const [tousItems, setItems] = useState<Item[]>([]);
  /** Domaines, objectifs et epics */
  const [tousHier, setHier] = useState<Hier>(EMPTY_HIER);
  /** Espaces connus, et espaces affichés (filtre du haut) */
  const [espaces, setEspacesState] = useState<Espace[]>([ESPACE_MOI]);
  const [visibles, setVisiblesState] = useState<string[]>(['moi']);
  const espacesRef = useRef(espaces);
  espacesRef.current = espaces;
  const visiblesRef = useRef(visibles);
  visiblesRef.current = visibles;
  const [espacesOpen, setEspacesOpen] = useState(false);
  const dansVisibles = useCallback((x: { espace?: string }) => visibles.includes(x.espace || 'moi'), [visibles]);
  const items = useMemo(() => tousItems.filter(dansVisibles), [tousItems, dansVisibles]);
  const hier = useMemo<Hier>(
    () => ({
      epics: tousHier.epics.filter(dansVisibles),
      objectifs: tousHier.objectifs.filter(dansVisibles),
      domaines: tousHier.domaines.filter(dansVisibles),
      features: tousHier.features.filter(dansVisibles),
      objectifsPI: tousHier.objectifsPI.filter(dansVisibles),
      // Les alertes ignorées sont personnelles (espace Moi) : toujours toutes
      ignorees: tousHier.ignorees,
    }),
    [tousHier, dansVisibles],
  );
  const { epics, objectifs, domaines, features, objectifsPI } = hier;
  const hv = useMemo(
    () => makeHierarchyValue(epics, objectifs, domaines, items, features, objectifsPI),
    [epics, objectifs, domaines, items, features, objectifsPI],
  );
  /** Mode Simple (Tâches + Roadmap) ou SAFe (5 onglets), capacité, points en jours */
  const [safe, setSafe] = useState<SafeSettings>(SAFE_DEFAUT);
  /** Capacité courante, lue au chargement (nettoyage des alertes ignorées) */
  const capaciteRef = useRef(SAFE_DEFAUT.capacite);
  capaciteRef.current = safe.capacite;
  const joursRef = useRef(SAFE_DEFAUT.pointsJours);
  joursRef.current = safe.pointsJours;
  useEffect(() => {
    loadSafe().then(setSafe);
  }, []);
  const updateSafe = (patch: Partial<SafeSettings>) => {
    setSafe((prev) => {
      const next = { ...prev, ...patch };
      saveSafe(next);
      return next;
    });
  };
  /** Remplace les données des espaces affichés (les autres espaces restent tels quels) */
  const updateHier = useCallback((next: Hier) => {
    setHier((prev) => {
      const garde = (x: { espace?: string }) => !visiblesRef.current.includes(x.espace || 'moi');
      const all: Hier = {
        epics: [...prev.epics.filter(garde), ...next.epics],
        objectifs: [...prev.objectifs.filter(garde), ...next.objectifs],
        domaines: [...prev.domaines.filter(garde), ...next.domaines],
        features: [...prev.features.filter(garde), ...next.features],
        objectifsPI: [...prev.objectifsPI.filter(garde), ...next.objectifsPI],
        ignorees: next.ignorees,
      };
      saveHierarchyCache(all).catch(() => {});
      return all;
    });
  }, []);
  /** Filtre de domaine partagé par tous les écrans, mémorisé sur l'appareil */
  const [domFilter, setDomFilterState] = useState<string>('tous');
  const setDomFilter = useCallback((v: string) => {
    setDomFilterState(v);
    saveDomainFilter(v);
  }, []);
  const domFilterValue = useMemo(() => ({ value: domFilter, set: setDomFilter }), [domFilter, setDomFilter]);
  /** Itération affichée dans l'écran Itération ; filtre « itération en cours » de la liste */
  const [itKey, setItKey] = useState(() => iterationOf(new Date()).key);
  const [itFilter, setItFilter] = useState(false);
  const [piKey, setPiKey] = useState(() => piOf(new Date()));
  /** Écran PI : choix de tâches existantes ou de features existantes (d'une epic, ou de toutes) pour une itération */
  const [piPicker, setPiPicker] = useState<null | { kind: 'tache' | 'feature'; itKey: string }>(null);
  /** Écran PI : fenêtre du « + » (itération, puis quoi ajouter) */
  const [piAdd, setPiAdd] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [featureFormOpen, setFeatureFormOpen] = useState(false);
  const [editingOPI, setEditingOPI] = useState<ObjectifPI | null>(null);
  const [opiFormOpen, setOpiFormOpen] = useState(false);
  const [editingObjectif, setEditingObjectif] = useState<Objectif | null>(null);
  const [objectifFormOpen, setObjectifFormOpen] = useState(false);
  const [editingDomaine, setEditingDomaine] = useState<Domaine | null>(null);
  const [domaineFormOpen, setDomaineFormOpen] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  /** Valeurs proposées pour une nouvelle fiche ouverte par « + niveau suivant » */
  const [taskDefaults, setTaskDefaults] = useState<Partial<ItemInput> | undefined>();
  const [objDefaults, setObjDefaults] = useState<Partial<ObjectifInput> | undefined>();
  const [epicDefaults, setEpicDefaults] = useState<Partial<EpicInput> | undefined>();
  const [featDefaults, setFeatDefaults] = useState<Partial<FeatureInput> | undefined>();
  const [wizard, setWizard] = useState<{ open: boolean; start: WizardStart }>({ open: false, start: null });
  const [tab, setTab] = useState<Tab>('taches');
  /** Menu « ⋯ Plus » (écrans au-delà des 5 de la barre) */
  const [plusOpen, setPlusOpen] = useState(false);
  /** Onglets des espaces affichés, selon leur type et le mode : 5 dans la barre, les autres dans « ⋯ Plus » */
  const tabs = useMemo(
    () => onglets(visibles.map((id) => espaceParId(espaces, id)?.type ?? 'moi'), safe.actif),
    [visibles, espaces, safe.actif],
  );
  // Onglet qui n'existe plus (autre mode ou autres espaces) : retour aux Tâches
  useEffect(() => {
    if (![...tabs.barre, ...tabs.plus].includes(tab)) setTab('taches');
  }, [tabs, tab]);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [epicFormOpen, setEpicFormOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Information (ex. dates d'epic ajustées), en bleu */
  const [info, setInfo] = useState<string | null>(null);
  /** Version du script : avant la 2, la répétition n'est pas enregistrée. */
  const [apiVersion, setApiVersion] = useState(api.API_VERSION_SOUS_DOMAINES);
  const [filter, setFilter] = useState<Filter>('tous');
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('liste');
  const [anchor, setAnchor] = useState(() => new Date());

  /** Filtre des espaces (en haut) ; les nouvelles créations vont dans le premier espace affiché */
  const setVisibles = useCallback((v: string[]) => {
    visiblesRef.current = v;
    setVisiblesState(v);
    saveVisibles(v);
    api.definirEspaceParDefaut(v[0] ?? 'moi');
  }, []);

  /** Remplace les éléments des espaces affichés (les autres espaces restent tels quels) */
  const tousItemsRef = useRef(tousItems);
  tousItemsRef.current = tousItems;
  const tousHierRef = useRef(tousHier);
  tousHierRef.current = tousHier;
  const updateItems = useCallback((next: Item[]) => {
    setItems((prev) => {
      const all = [...prev.filter((i) => !visiblesRef.current.includes(i.espace || 'moi')), ...next];
      saveCache(all).catch(() => {});
      return all;
    });
  }, []);

  /** Connexion de chaque espace : Moi = la connexion principale ; les autres = leur script (même compte Google) */
  const connexions = useCallback(
    (s: Settings) =>
      espacesRef.current.map((e) => ({
        id: e.id,
        settings: e.id === 'moi' ? s : { url: DEMO ? 'demo' : (e.url ?? ''), key: e.key, googleEmail: s.googleEmail },
      })),
    [],
  );

  const logout = useCallback(async () => {
    await signOut();
    await clearSettings();
    setItems([]);
    setHier(EMPTY_HIER);
    setSettings(null);
  }, []);

  const refresh = useCallback(
    async (s: Settings) => {
      setRefreshing(true);
      try {
        // Tous les espaces connus (changer le filtre du haut est alors immédiat)
        api.definirEspaces(connexions(s), visiblesRef.current[0] ?? 'moi');
        const liste = espacesRef.current;
        const res = await Promise.allSettled(liste.map((e) => api.listItems(s, e.id)));
        const moi = res[0];
        if (moi.status === 'rejected') throw moi.reason;
        const ok = res.flatMap((r, k) => (r.status === 'fulfilled' ? [{ id: liste[k].id, d: r.value }] : []));
        const echecs = liste.filter((_, k) => res[k].status === 'rejected');
        // Espace injoignable : on garde sa dernière copie
        const chargés = new Set(ok.map((o) => o.id));
        const garde = (x: { espace?: string }) => !chargés.has(x.espace || 'moi');
        const list = [...tousItemsRef.current.filter(garde), ...ok.flatMap((o) => o.d.items)];
        const cat = <K extends keyof Omit<Hier, 'ignorees'>>(k: K) => [...(tousHierRef.current[k] as { espace?: string }[]).filter(garde), ...ok.flatMap((o) => o.d[k] as { espace?: string }[])] as Hier[K];
        const rest: Omit<Hier, 'ignorees'> = { epics: cat('epics'), objectifs: cat('objectifs'), domaines: cat('domaines'), features: cat('features'), objectifsPI: cat('objectifsPI') };
        const version = Math.min(...ok.map((o) => o.d.version));
        // Premier lancement : domaines de base dans Moi (une seule fois : ceux qu'on supprime ne reviennent pas)
        if (!moi.value.domaines.length && moi.value.version >= api.API_VERSION_SOUS_DOMAINES && !(await AsyncStorage.getItem(DOMAINES_BASE_KEY).catch(() => '1'))) {
          try {
            rest.domaines = [...rest.domaines, ...(await api.copierDomaines(s, 'moi', DOMAINES_DE_BASE))];
            AsyncStorage.setItem(DOMAINES_BASE_KEY, '1').catch(() => {});
          } catch {
            // On réessaiera au prochain chargement
          }
        }
        setItems(list);
        saveCache(list).catch(() => {});
        // Alertes ignorées : dans l'espace Moi
        let ignorees = moi.value.ignorees ?? [];
        // Nettoyage : une alerte ignorée dont la situation n'existe plus est effacée du Google Sheet
        // (si le même problème revient un jour, il sera de nouveau signalé). Seulement sur des données fraîches.
        if (version >= api.API_VERSION_IGNOREES && ignorees.length && !echecs.length) {
          const hvFrais = makeHierarchyValue(rest.epics, rest.objectifs, rest.domaines, list, rest.features, rest.objectifsPI);
          const existantes = signaturesExistantes(hvFrais, toDateString(new Date()), capaciteRef.current, joursRef.current);
          const perimees = ignorees.filter((i) => !existantes.has(`${i.cle}\u0000${i.signature}`));
          for (const i of perimees) {
            try {
              await api.deleteEntity(s, 'ignoree', i.id, false);
              ignorees = ignorees.filter((x) => x.id !== i.id);
            } catch {
              // On réessaiera au prochain chargement
            }
          }
        }
        const all: Hier = { ...rest, ignorees };
        setHier(all);
        saveHierarchyCache(all).catch(() => {});
        setApiVersion(version);
        setOffline(echecs.length ? `Espace injoignable : ${echecs.map((e) => e.nom).join(', ')}.` : null);
      } catch (e) {
        if (e instanceof AuthError && s.googleEmail) {
          // Compte retiré de l'onglet « Utilisateurs » ou session Google terminée.
          await logout();
          setLoginError(e.message);
          return;
        }
        setOffline((e as Error).message);
      } finally {
        setRefreshing(false);
      }
    },
    [logout, connexions],
  );

  useEffect(() => {
    (async () => {
      const [stored, cache, cachedHier, dom, liste, vis] = await Promise.all([
        loadSettings(),
        loadCache(),
        loadHierarchyCache(),
        loadDomainFilter(),
        loadEspaces(DEMO ? [ESPACE_MOI, ...ESPACES_DEMO] : [ESPACE_MOI]),
        loadVisibles(),
      ]);
      setDomFilterState(dom);
      // Espaces : la liste, et le filtre (sans les espaces qui n'existent plus)
      const visOk = vis.filter((v) => liste.some((e) => e.id === v));
      espacesRef.current = liste;
      visiblesRef.current = visOk.length ? visOk : ['moi'];
      setEspacesState(liste);
      setVisiblesState(visiblesRef.current);
      let s = stored;
      if (GOOGLE_AUTH) {
        const email = await restoreSession();
        s = email ? { url: API_URL, googleEmail: email } : null;
      }
      if (cache && s) {
        const list = cache.items.map(api.normalize);
        api.retenirEspaces(list);
        setItems(list);
      }
      if (s) {
        const h = { ...EMPTY_HIER, ...cachedHier } as Hier;
        for (const l of [h.epics, h.objectifs, h.domaines, h.features, h.objectifsPI]) api.retenirEspaces(l);
        setHier(h);
      }
      setSettings(s);
      setBooting(false);
      if (s) refresh(s);
    })();
  }, [refresh]);

  // Domaine filtré supprimé entre-temps : retour à « Tous »
  useEffect(() => {
    if (domFilter && domFilter !== 'tous' && hier.domaines.length && !hier.domaines.some((d) => d.id === domFilter)) setDomFilter('tous');
  }, [domFilter, hier.domaines, setDomFilter]);

  const today = toDateString(new Date());
  // Filtres : type (ou répétées) et domaine (direct ou hérité de l'objectif / de l'epic)
  const matches = useCallback(
    (i: Item) =>
      matchesType(i, filter) &&
      inDomain(domFilter, domaineOf(i, hv)?.id, hv) &&
      (!safe.actif || !itFilter || iterationOfItem(i) === iterationOf(new Date()).key),
    [filter, domFilter, hv, safe.actif, itFilter],
  );
  const subs = useMemo(() => subtaskMap(items), [items]);
  const visible = useMemo(
    () =>
      groupItems(
        items
          .filter((i) => !i.parent)
          .flatMap((i): Item[] => {
            const kids = subs.get(i.id);
            if (!kids) return matches(i) ? [i] : [];
            // Parent : visible s'il passe le filtre, ou si une de ses sous-tâches le passe (seules celles-ci sont montrées)
            const shown = matches(i) ? kids : kids.filter((k) => matches(k));
            if (!matches(i) && !shown.length) return [];
            // Rangé à la date la plus proche : la sienne ou celle d'une sous-tâche pas encore faite
            const dates = [i.statut !== 'termine' ? dateRepere(i) : '', ...kids.filter((k) => k.statut !== 'termine').map((k) => k.date)].filter(Boolean);
            const date = dates.length ? dates.sort()[0] : i.date;
            return [
              {
                ...i,
                date,
                sousTaches: showDone ? shown : shown.filter((k) => k.statut !== 'termine' || i.statut === 'termine'),
                sousTotal: kids.length,
                sousFaites: kids.filter((k) => k.statut === 'termine').length,
                alertePoints: pointsCheck(i, kids).alerte,
              },
            ];
          })
          // Un élément répété devient ses lignes du moment : retards regroupés + échéance en cours.
          .flatMap((i) => (i.periodicite ? listEntries(i, today) : [i]))
          .filter((i) => showDone || i.statut !== 'termine'),
      ),
    [items, subs, matches, showDone, today],
  );
  /** Parents dépliés / repliés à la main (sinon : dépliés si une sous-tâche est due aujourd'hui ou en retard) */
  const [deplies, setDeplies] = useState<Record<string, boolean>>({});
  useEffect(() => {
    AsyncStorage.getItem(DEPLIES_KEY)
      .then((v) => v && setDeplies(JSON.parse(v)))
      .catch(() => {});
  }, []);
  const toggleDeplie = useCallback((id: string, now: boolean) => {
    setDeplies((prev) => {
      const next = { ...prev, [id]: !now };
      AsyncStorage.setItem(DEPLIES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const isDeplie = useCallback(
    (p: Item) =>
      deplies[p.id] ??
      (subs.get(p.id) ?? []).some((k) => k.statut !== 'termine' && !!k.date && k.date <= today),
    [deplies, subs, today],
  );
  const doneCount = useMemo(
    () => items.filter((i) => !i.periodicite && i.statut === 'termine' && matches(i)).length,
    [items, matches],
  );

  // Vues Jour / Semaine / Mois : éléments datés et échéances des éléments répétés,
  // sur les 6 semaines de la grille du mois affiché (qui contient aussi le jour et la semaine).
  const { byDate, fenetres } = useMemo(() => {
    const gridStart = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const titres = new Map(items.map((i) => [i.id, i.titre]));
    const range = expandRange(
      // Sous-tâches datées : à leur date, avec « ↳ parent »
      items.filter((i) => matches(i)).map((i) => (i.parent ? { ...i, parentTitre: titres.get(i.parent) ?? '' } : i)),
      toDateString(gridStart),
      toDateString(addDays(gridStart, 41)),
      today,
    );
    for (const list of range.byDate.values()) list.sort(compareItems);
    return range;
  }, [items, matches, anchor, today]);
  const weekStart = toDateString(startOfWeek(anchor));
  const weekEnd = toDateString(addDays(startOfWeek(anchor), 6));
  const monthStart = toDateString(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const monthEnd = toDateString(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));
  const weekBand = fenetres.filter((f) => f.start <= weekEnd && f.end >= weekStart).map((f) => f.entry);
  const monthBand = fenetres
    .filter((f) => f.entry.fenetre !== 'semaine' && f.start <= monthEnd && f.end >= monthStart)
    .map((f) => f.entry);

  const step = (n: number) =>
    setAnchor((d) => (mode === 'mois' ? addMonths(d, n) : addDays(d, mode === 'semaine' ? 7 * n : n)));
  const periodTitle =
    mode === 'mois' ? formatMonth(anchor) : mode === 'semaine' ? formatWeek(anchor) : formatDate(toDateString(anchor));
  const pageKey = periodKeyOf(mode, anchor);

  const openForm = useCallback(
    (item: Item | null) => {
      // Une échéance affichée ouvre l'élément répété d'origine.
      // Échéance d'un élément répété, ou parent affiché avec une autre date : on ouvre l'élément enregistré.
      setEditing(item ? (items.find((i) => i.id === (item.baseId ?? item.id)) ?? item) : null);
      setTaskDefaults(undefined);
      setFormOpen(true);
    },
    [items],
  );

  // Statut d'avant « Terminé » : décocher une tâche qui était « En cours » la remet « En cours »
  const statutAvant = useRef<Record<string, Statut>>({});
  useEffect(() => {
    AsyncStorage.getItem(STATUT_AVANT_KEY)
      .then((v) => {
        if (v) statutAvant.current = JSON.parse(v);
      })
      .catch(() => {});
  }, []);
  /** Question « terminer aussi les sous-tâches ? » */
  const [askSubs, setAskSubs] = useState<{ parent: Item; kids: Item[] } | null>(null);

  /** Mémorise le statut d'avant « Terminé » (« En cours ») des tâches qui changent de statut. */
  const noterStatutAvant = useCallback((changes: { item: Item; statut: Statut }[]) => {
    const avant = { ...statutAvant.current };
    for (const { item, statut } of changes) {
      if (statut === item.statut) continue;
      if (statut === 'termine' && item.statut === 'en_cours') avant[item.id] = 'en_cours';
      else delete avant[item.id];
    }
    statutAvant.current = avant;
    AsyncStorage.setItem(STATUT_AVANT_KEY, JSON.stringify(avant)).catch(() => {});
  }, []);

  /**
   * Enregistre des statuts (mise à jour immédiate à l'écran, annulée si le Google Sheet refuse),
   * avec les parents qui suivent leurs sous-tâches (sous-tâche rouverte ou commencée → parent « En cours »).
   */
  const enregistrerStatuts = useCallback(
    async (demandes: { item: Item; statut: Statut }[]) => {
      if (!settings || !demandes.length) return;
      const changes = [...demandes, ...parentsLies(demandes, items)];
      noterStatutAvant(changes);
      const voulu = new Map(changes.map((c) => [c.item.id, c.statut]));
      const now = new Date().toISOString();
      const jour = toDateString(new Date());
      setItems((prev) =>
        prev.map((i) => {
          if (!voulu.has(i.id)) return i;
          const statut = voulu.get(i.id)!;
          // « Terminé le » : posé en passant à Terminé, vidé en sortant (le script fait de même)
          return {
            ...i,
            statut,
            modifie_le: now,
            termine_le: statut !== 'termine' ? '' : i.statut === 'termine' ? i.termine_le : jour,
            statut_avant: statut !== 'termine' ? '' : i.statut === 'termine' ? i.statut_avant : i.statut === 'en_cours' ? 'en_cours' : '',
          };
        }),
      );
      for (const { item, statut } of changes) {
        try {
          const saved = await api.updateItem(settings, { id: item.id, statut });
          setItems((prev) => {
            const next = prev.map((i) => (i.id === saved.id ? saved : i));
            saveCache(next).catch(() => {});
            return next;
          });
        } catch (e) {
          setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
          setNotice(`Modification non enregistrée : ${(e as Error).message}`);
        }
      }
    },
    [settings, items, noterStatutAvant],
  );

  /**
   * Changer le statut d'une tâche (case à cocher, Kanban) : même règle partout.
   * - « Terminé » d'un parent qui a des sous-tâches ouvertes → on demande s'il faut les terminer aussi ;
   * - sortir de « Terminé » vers « À faire » → statut d'avant (« En cours » s'il l'était).
   */
  const changerStatut = useCallback(
    (item: Item, voulu: Statut) => {
      // Élément enregistré (la ligne affichée peut porter une autre date : parent de sous-tâches)
      const orig = items.find((i) => i.id === item.id) ?? item;
      // Statut d'avant : enregistré dans le Google Sheet (v14), sinon le souvenir de l'appareil (ancien script)
      const memo = (orig.statut_avant as Statut) || statutAvant.current[orig.id] || 'a_faire';
      // (un rendez-vous ou un appel n'a pas d'« En cours »)
      const avant = sansEnCours(orig.type) ? 'a_faire' : memo;
      const statut = orig.statut === 'termine' && voulu === 'a_faire' ? avant : voulu;
      if (statut === 'termine') {
        const kids = items.filter((k) => k.parent === orig.id && k.statut !== 'termine');
        if (kids.length) return setAskSubs({ parent: orig, kids });
      }
      enregistrerStatuts([{ item: orig, statut }]);
    },
    [items, enregistrerStatuts],
  );

  const toggle = useCallback(
    async (item: Item) => {
      if (!settings) return;
      if (item.baseId && item.occurrence) {
        // Échéance d'un élément répété : on coche / décoche sa période.
        const base = items.find((i) => i.id === item.baseId);
        if (!base) return;
        if (apiVersion < api.API_VERSION_REPETITION) {
          setNotice("Mettez à jour le script du Google Sheet pour enregistrer les éléments répétés.");
          return;
        }
        const faits = toggleDone(base, item.occurrence);
        setItems((prev) => prev.map((i) => (i.id === base.id ? { ...i, faits } : i)));
        try {
          const saved = await api.updateItem(settings, { id: base.id, faits });
          setItems((prev) => {
            const next = prev.map((i) => (i.id === saved.id ? saved : i));
            saveCache(next).catch(() => {});
            return next;
          });
        } catch (e) {
          setItems((prev) => prev.map((i) => (i.id === base.id ? base : i)));
          setNotice(`Modification non enregistrée : ${(e as Error).message}`);
        }
        return;
      }
      changerStatut(item, item.statut === 'termine' ? 'a_faire' : 'termine');
    },
    [settings, items, apiVersion, changerStatut],
  );

  /** Écran Itération : déplacer une carte du Kanban (statut). */
  const setStatut = (item: Item, statut: Item['statut']) => changerStatut(item, statut);

  const save = async (input: ItemInput, sousTaches: string[] = [], opts: { terminerSousTaches?: boolean } = {}) => {
    if (!settings) return;
    if (input.date_fin && apiVersion < api.API_VERSION_DATE_FIN) {
      throw new Error("le script du Google Sheet n'est pas à jour pour la date de fin des démarches. Recollez le nouveau Code.gs et déployez une nouvelle version.");
    }
    if (input.heure_fin && apiVersion < api.API_VERSION_HEURE_FIN) {
      throw new Error("le script du Google Sheet n'est pas à jour pour l'heure de fin des rendez-vous. Recollez le nouveau Code.gs et déployez une nouvelle version.");
    }
    if ((input.parent || sousTaches.length) && apiVersion < api.API_VERSION_SOUS_TACHES) {
      throw new Error("le script du Google Sheet n'est pas à jour pour les sous-tâches. Recollez le nouveau Code.gs et déployez une nouvelle version.");
    }
    if ((TYPES_V7.includes(input.type) || input.telephone) && apiVersion < api.API_VERSION_TYPES) {
      throw new Error("le script du Google Sheet n'est pas à jour pour les nouveaux types (appel, démarche, story, exploration, bug). Recollez le nouveau Code.gs et déployez une nouvelle version.");
    }
    if ((input.points || input.iteration || input.feature) && apiVersion < api.API_VERSION_SAFE) {
      throw new Error("le script du Google Sheet n'est pas à jour pour le mode SAFe. Recollez le nouveau Code.gs et déployez une nouvelle version.");
    }
    if ((input.objectif || input.domaine) && apiVersion < api.API_VERSION_HIERARCHIE) {
      throw new Error("le script du Google Sheet n'est pas à jour pour les domaines et objectifs. Recollez le nouveau Code.gs et déployez une nouvelle version.");
    }
    if (input.epic && apiVersion < api.API_VERSION_EPICS) {
      throw new Error("le script du Google Sheet n'est pas à jour pour les epics. Recollez le nouveau Code.gs et déployez une nouvelle version.");
    }
    if (input.periodicite && apiVersion < api.API_VERSION_REPETITION) {
      throw new Error(
        "le script du Google Sheet n'est pas à jour. Recollez le nouveau Code.gs et déployez une nouvelle version.",
      );
    }
    let next: Item[];
    let saved: Item;
    const ancien = editing ? (items.find((i) => i.id === editing.id) ?? editing) : null;
    if (editing) {
      saved = await api.updateItem(settings, { ...input, id: editing.id });
      next = items.map((i) => (i.id === saved.id ? saved : i));
    } else {
      saved = await api.createItem(settings, input);
      next = [...items, saved];
    }
    // Les sous-tâches suivent le rangement de leur parent (le script fait de même)
    next = cascadeLinks(saved, next);
    for (const titre of sousTaches) next = [...next, await api.createItem(settings, subtaskInput(saved, titre))];
    updateItems(next);
    setFormOpen(false);
    // Parent enregistré « Terminé » avec de nouvelles sous-tâches à faire : il est « En cours »
    if (sousTaches.length && saved.statut === 'termine') await enregistrerStatuts([{ item: saved, statut: 'en_cours' }]);
    // Statut changé dans la fiche : mêmes règles que la case à cocher et le Kanban
    if (ancien && ancien.statut !== saved.statut) {
      noterStatutAvant([{ item: ancien, statut: saved.statut }]);
      const suite = [
        ...parentsLies([{ item: ancien, statut: saved.statut }], next),
        ...(opts.terminerSousTaches && saved.statut === 'termine'
          ? next.filter((k) => k.parent === saved.id && k.statut !== 'termine').map((item) => ({ item, statut: 'termine' as const }))
          : []),
      ];
      if (suite.length) await enregistrerStatuts(suite);
    }
  };

  const remove = async (item: Item, cascade = false) => {
    if (!settings) return;
    await api.deleteItem(settings, item.id, cascade);
    // Sous-tâches : supprimées (cascade) ou détachées
    updateItems(
      items.filter((i) => i.id !== item.id && !(cascade && i.parent === item.id)).map((i) => (i.parent === item.id ? { ...i, parent: '' } : i)),
    );
    setFormOpen(false);
  };

  /** Sous-tâche ajoutée depuis la fiche du parent (ou l'Itération) : tout de suite. */
  const addSubtask = async (parent: Item, titre: string) => {
    if (!settings) return;
    if (apiVersion < api.API_VERSION_SOUS_TACHES) {
      throw new Error("le script du Google Sheet n'est pas à jour pour les sous-tâches.");
    }
    const saved = await api.createItem(settings, subtaskInput(parent, titre));
    setItems((prev) => {
      const next = [...prev, saved];
      saveCache(next).catch(() => {});
      return next;
    });
    // Nouveau travail sur un parent terminé : il repasse « En cours »
    const orig = items.find((i) => i.id === parent.id);
    if (orig?.statut === 'termine') await enregistrerStatuts([{ item: orig, statut: 'en_cours' }]);
  };

  const openEpic = (epic: Epic | null, defaults?: Partial<EpicInput>) => {
    setEditingEpic(epic);
    setEpicDefaults(defaults);
    setEpicFormOpen(true);
  };
  const openObjectif = (o: Objectif | null, defaults?: Partial<ObjectifInput>) => {
    setEditingObjectif(o);
    setObjDefaults(defaults);
    setObjectifFormOpen(true);
  };
  const openFeature = (f: Feature | null, defaults?: Partial<FeatureInput>) => {
    setEditingFeature(f);
    setFeatDefaults(defaults);
    setFeatureFormOpen(true);
  };
  /** Espace d'un rattachement (feature, epic, objectif, domaine, parent), s'il y en a un */
  const espaceLie = (x: Partial<Item>) =>
    api.espaceDe(x.parent) ?? api.espaceDe(x.feature) ?? api.espaceDe(x.epic) ?? api.espaceDe(x.objectif) ?? api.espaceDe(x.domaine);
  /** Nouvelle tâche pré-rangée (epic, feature…) depuis une fiche. */
  const openNewTask = (defaults: Partial<ItemInput>) => {
    setEditing(null);
    // Une tâche rattachée (feature, epic…) est créée dans l'espace de ce rattachement
    const lie = espaceLie(defaults);
    setTaskDefaults(lie ? { ...defaults, espace: lie } : defaults);
    setFormOpen(true);
  };
  /** Tâche mise à jour : remplace l'ancienne dans la liste et le cache. */
  const updateTask = async (patch: Partial<Item> & { id: string }) => {
    if (!settings) return;
    if (apiVersion < api.API_VERSION_SAFE) {
      throw new Error("le script du Google Sheet n'est pas à jour pour le mode SAFe.");
    }
    const ancien = items.find((i) => i.id === patch.id);
    const saved = await api.updateItem(settings, patch);
    setItems((prev) => {
      const next = cascadeLinks(saved, prev.map((i) => (i.id === saved.id ? saved : i)));
      saveCache(next).catch(() => {});
      return next;
    });
    // Statut changé : mêmes règles que la case à cocher
    if (ancien && patch.statut && patch.statut !== ancien.statut) {
      noterStatutAvant([{ item: ancien, statut: patch.statut }]);
      const lies = parentsLies([{ item: ancien, statut: patch.statut }], items);
      if (lies.length) await enregistrerStatuts(lies);
    }
    // Tâche ouverte rattachée à un parent terminé (sous-tâche existante) : le parent repasse « En cours »
    if (ancien && patch.parent && patch.parent !== ancien.parent && saved.statut !== 'termine') {
      const p = items.find((i) => i.id === patch.parent);
      if (p?.statut === 'termine') await enregistrerStatuts([{ item: p, statut: 'en_cours' }]);
    }
  };
  /** Rattache une tâche existante à une feature (seul le lien le plus précis est gardé). */
  const linkTaskToFeature = (f: Feature, t: Item) =>
    updateTask({
      id: t.id,
      feature: f.id,
      epic: '',
      objectif: '',
      domaine: '',
      // Sans date ni itération, elle prend l'itération prévue de la feature
      ...(!t.date && !t.iteration && f.iteration ? { iteration: f.iteration } : {}),
    });

  /** Écran PI : nouvelle tâche hors feature, dans l'itération choisie (et le domaine filtré). */
  const addHorsFeature = (key: string) => {
    openNewTask({ iteration: key, date: '', ...(domFilter !== 'tous' && domFilter ? { domaine: domFilter } : {}) });
  };
  const closeFiches = () => {
    setEpicFormOpen(false);
    setObjectifFormOpen(false);
    setDomaineFormOpen(false);
    setFeatureFormOpen(false);
  };
  const openWizard = (start: WizardStart) => {
    closeFiches();
    setAddMenu(false);
    setWizard({ open: true, start });
  };

  /** Saisie rapide dans une feature : tâche créée tout de suite, dans l'itération prévue de la feature. */
  const quickAddTask = async (f: Feature, titre: string) => {
    if (!settings) return;
    if (apiVersion < api.API_VERSION_SAFE) {
      throw new Error("le script du Google Sheet n'est pas à jour pour le mode SAFe.");
    }
    const saved = await api.createItem(settings, {
      ...RECURRENCE_DEFAUTS,
      titre,
      type: 'tache',
      date: '',
      heure: '',
      lieu: '',
      description: '',
      priorite: 'normale',
      statut: 'a_faire',
      feature: f.id,
      iteration: f.iteration,
    });
    setItems((prev) => {
      const next = [...prev, saved];
      saveCache(next).catch(() => {});
      return next;
    });
  };
  const openDomaine = (d: Domaine | null) => {
    setEditingDomaine(d);
    setDomaineFormOpen(true);
  };

  const LIST_KEY = {
    epic: 'epics',
    objectif: 'objectifs',
    domaine: 'domaines',
    feature: 'features',
    objectifpi: 'objectifsPI',
    ignoree: 'ignorees',
  } as const satisfies Record<EntityKind, keyof Hier>;

  const checkScript = (kind?: EntityKind, input?: object) => {
    const needSafe = kind === 'feature' || kind === 'objectifpi' || (!!input && 'etat' in input);
    if (kind === 'ignoree' && apiVersion < api.API_VERSION_IGNOREES) {
      throw new Error("le script du Google Sheet n'est pas à jour pour ignorer des alertes. Recollez le nouveau Code.gs et déployez une nouvelle version.");
    }
    if (kind === 'objectifpi' && !!input && !!(input as { epic?: string }).epic && apiVersion < api.API_VERSION_EPIC_PI) {
      throw new Error("le script du Google Sheet n'est pas à jour pour l'epic des objectifs du PI. Recollez le nouveau Code.gs et déployez une nouvelle version.");
    }
    if (kind === 'domaine' && !!input && !!(input as { parent?: string }).parent && apiVersion < api.API_VERSION_SOUS_DOMAINES) {
      throw new Error("le script du Google Sheet n'est pas à jour pour les sous-domaines. Recollez le nouveau Code.gs et déployez une nouvelle version.");
    }
    const needDomPi = kind === 'objectifpi' && !!input && !!(input as { domaine?: string }).domaine;
    if (apiVersion < (needDomPi ? api.API_VERSION_DOMAINE_PI : needSafe ? api.API_VERSION_SAFE : api.API_VERSION_HIERARCHIE)) {
      throw new Error("le script du Google Sheet n'est pas à jour. Recollez le nouveau Code.gs et déployez une nouvelle version.");
    }
  };

  /** Crée (editing = null) ou met à jour un domaine / objectif / epic. */
  const saveEntity = async <K extends EntityKind>(kind: K, editing: { id: string } | null, input: object) => {
    if (!settings) return;
    checkScript(kind, input);
    // Création : dans l'espace de son rattachement (objectif, epic, domaine), sinon le premier espace affiché
    if (!editing && !(input as { espace?: string }).espace)
      input = { ...input, espace: espaceLie(input as Partial<Item>) ?? visiblesRef.current[0] ?? 'moi' };
    const saved = editing
      ? await api.updateEntity(settings, kind, { ...input, id: editing.id } as never)
      : await api.createEntity(settings, kind, input as never);
    const key = LIST_KEY[kind];
    const s0 = saved as { id: string };
    setHier((prev) => {
      const list = prev[key] as { id: string }[];
      const next = {
        ...prev,
        [key]: editing ? list.map((x) => (x.id === s0.id ? s0 : x)) : [...list, s0],
      } as Hier;
      saveHierarchyCache(next).catch(() => {});
      return next;
    });
    return saved;
  };

  /** Bouton d'une alerte : applique les dates proposées. */
  const fixEntity = async (kind: 'epic' | 'objectif', x: { id: string; titre: string }, patch: { debut?: string; fin?: string }) => {
    try {
      await saveEntity(kind, x, patch);
      setInfo(`${kind === 'epic' ? 'Epic' : 'Objectif'} « ${x.titre} » mis(e) à jour.`);
    } catch (e) {
      setNotice(`Mise à jour impossible : ${(e as Error).message}`);
    }
  };

  /** Deuxième bouton d'une alerte : aligner la tâche ou l'epic sur les dates de son parent. */
  const alignChild = async (a: Alignement) => {
    try {
      if (a.kind === 'tache') await updateTask({ id: a.id, ...a.patch });
      else await saveEntity('epic', { id: a.id }, a.patch);
      setInfo(`« ${a.nom} » aligné sur les dates de son parent.`);
    } catch (e) {
      setNotice(`Alignement impossible : ${(e as Error).message}`);
    }
  };

  /** « Ignorer » une alerte : enregistrée dans le Google Sheet (onglet Ignorees), avec la situation du moment. */
  const ignorer = (c: Check) => {
    const deja = hier.ignorees.find((i) => i.cle === c.key);
    (deja ? saveEntity('ignoree', deja, { signature: situationDe(c) }) : saveEntity('ignoree', null, { cle: c.key, signature: situationDe(c) }))
      .then(() => setInfo('Alerte ignorée. Elle reviendra si la situation change.'))
      .catch((e) => setNotice(`Impossible d'ignorer l'alerte : ${(e as Error).message}`));
  };
  const retablir = async (c: Check) => {
    const deja = hier.ignorees.find((i) => i.cle === c.key);
    if (!settings || !deja) return;
    try {
      await api.deleteEntity(settings, 'ignoree', deja.id, false);
      updateHier({ ...hier, ignorees: hier.ignorees.filter((i) => i.id !== deja.id) });
    } catch (e) {
      setNotice(`Impossible de rétablir l'alerte : ${(e as Error).message}`);
    }
  };
  const ignoreValue = { ignorees: hier.ignorees, ignorer, retablir };

  /** Boutons des alertes : modifier, ouvrir ou créer. */
  const runAction = (a: Action) => {
    const fait = (p: Promise<unknown>, msg = 'Fait.') =>
      p.then(() => setInfo(msg)).catch((e) => setNotice(`Action impossible : ${(e as Error).message}`));
    switch (a.kind) {
      case 'task': {
        // Simple changement de statut (« Terminer », « Marquer fait ») : même règle que la case à cocher
        // (question pour les sous-tâches ouvertes, parent qui suit)
        const t = items.find((i) => i.id === a.id);
        const cles = Object.keys(a.patch);
        if (t && cles.length === 1 && a.patch.statut) return changerStatut(t, a.patch.statut);
        return fait(updateTask({ id: a.id, ...a.patch }));
      }
      case 'tasks':
        return fait(
          (async () => {
            for (const p of a.patches) await updateTask(p);
          })(),
          `${a.patches.length} tâche${a.patches.length > 1 ? 's' : ''} mise${a.patches.length > 1 ? 's' : ''} à jour.`,
        );
      case 'entity':
        return fait(saveEntity(a.entity, { id: a.id }, a.patch));
      case 'open': {
        if (a.target === 'task') return openForm(items.find((t) => t.id === a.id) ?? null);
        if (a.target === 'epic') return openEpic(hier.epics.find((e) => e.id === a.id) ?? null);
        if (a.target === 'objectif') return openObjectif(hier.objectifs.find((o) => o.id === a.id) ?? null);
        if (a.target === 'feature') return openFeature(hier.features.find((f) => f.id === a.id) ?? null);
        setEditingOPI(hier.objectifsPI.find((o) => o.id === a.id) ?? null);
        return setOpiFormOpen(true);
      }
      case 'new':
        return a.target === 'task' ? openNewTask(a.defaults) : openEpic(null, a.defaults);
      case 'iteration':
        setItKey(a.itKey);
        return setTab('iteration');
    }
  };

  /** Assistant projet : enregistre le brouillon, puis recharge tout. */
  const applyWizard = async (draft: Parameters<typeof applyDraft>[0], onProgress: (done: number, total: number) => void) => {
    if (!settings) return;
    checkScript(safe.actif ? 'feature' : undefined);
    try {
      const r = await applyDraft(
        draft,
        {
          create: async (level, data) =>
            level === 'tache'
              ? (await api.createItem(settings, data as unknown as ItemInput)).id
              : (await api.createEntity(settings, level, data as never)).id,
          update: async (level, id, data) => {
            if (level === 'tache') await api.updateItem(settings, { ...data, id } as never);
            else await api.updateEntity(settings, level, { ...data, id } as never);
          },
          remove: async (level, id, cascade) => {
            if (level === 'tache') await api.deleteItem(settings, id);
            else await api.deleteEntity(settings, level, id, cascade);
          },
        },
        onProgress,
      );
      setInfo(
        `Projet enregistré : ${[
          r.created && `${r.created} créé(s)`,
          r.updated && `${r.updated} modifié(s)`,
          r.deleted && `${r.deleted} supprimé(s)`,
        ]
          .filter(Boolean)
          .join(', ')}.`,
      );
    } finally {
      await refresh(settings);
    }
  };

  /** Suppression, avec ou sans ce qui est rattaché ; la liste est rechargée (le script a tout fait). */
  const deleteEntity = async (kind: EntityKind, x: { id: string }, cascade: boolean) => {
    if (!settings) return;
    checkScript();
    const counts = await api.deleteEntity(settings, kind, x.id, cascade);
    setEpicFormOpen(false);
    setObjectifFormOpen(false);
    setDomaineFormOpen(false);
    setFeatureFormOpen(false);
    setOpiFormOpen(false);
    await refresh(settings);
    const n = counts.objectifs + counts.epics + counts.taches;
    setInfo(
      n
        ? cascade
          ? `Supprimé, avec ${n} élément(s) rattaché(s).`
          : `Supprimé. ${n} élément(s) rattaché(s) conservé(s).`
        : 'Supprimé.',
    );
  };

  const piPickerIt = piPicker?.itKey ?? '';
  const piPickerOptions =
    piPicker?.kind === 'feature'
      ? hier.features
          // Pas encore à cet endroit : autre itération, ou (sans itération) pas encore dans ce PI
          .filter((f) => (piPickerIt ? f.iteration !== piPickerIt : f.pi !== piKey) && inDomain(domFilter, domaineOf({ epic: f.epic }, hv)?.id, hv))
          .map((f) => ({
            id: f.id,
            title: `🧩 ${f.titre}`,
            sub: [
              hv.epics.get(f.epic)?.titre ?? 'sans epic',
              f.iteration ? `prévue en ${f.iteration.split('-').slice(1).join(' ')}` : f.pi ? `PI ${f.pi.split('-')[1]} ${f.pi.split('-')[0]}` : 'sans PI',
            ].join(' · '),
          }))
      : piPicker?.kind === 'tache'
        ? items
            .filter(
              (t) =>
                !t.periodicite &&
                !t.feature &&
                !t.parent &&
                !t.date &&
                t.statut !== 'termine' &&
                t.iteration !== piPickerIt &&
                inDomain(domFilter, domaineOf(t, hv)?.id, hv),
            )
            .map((t) => ({
              id: t.id,
              title: t.titre,
              sub: [
                hv.epics.get(t.epic)?.titre ?? hv.objectifs.get(t.objectif)?.titre ?? hv.domaines.get(t.domaine)?.nom ?? 'non rangée',
                t.iteration ? `prévue en ${t.iteration.split('-').slice(1).join(' ')}` : 'pas d’itération',
              ].join(' · '),
            }))
        : [];

  // Alertes de chaque écran (chiffres rouges des onglets)
  // Les alertes suivent le filtre de domaine (la capacité reste commune)
  // (l'heure actuelle est relue à chaque recalcul : les rendez-vous d'aujourd'hui déjà finis ne se chevauchent plus)
  const checks = useMemo(() => {
    const n = new Date();
    return checksParEcran(hv, today, safe.capacite, safe.actif, domFilter, { jours: safe.pointsJours, maintenant: n.getHours() * 60 + n.getMinutes() });
  }, [hv, today, safe.capacite, safe.actif, safe.pointsJours, domFilter]);
  const alertesDates = useMemo(() => checksDatesDomaine(hv, domFilter), [hv, domFilter]);
  // Les alertes ignorées ne comptent pas
  const ig = hier.ignorees;
  // Deux pastilles par onglet : alertes (rouge) et rappels (jaune)
  const compte = (cs: Check[]) => ({ rouge: nbAlertes(cs, ig, 'alerte'), jaune: nbAlertes(cs, ig, 'rappel') });
  const zero = { rouge: 0, jaune: 0 };
  const badges: Record<Tab, { rouge: number; jaune: number }> = {
    taches: compte(checks.taches),
    iteration: compte(checks.iteration),
    pi: compte(checks.pi),
    roadmap: compte([...checks.roadmap, ...alertesDates]),
    portefeuille: compte(checks.portefeuille),
    strategie: zero,
    backlog: zero,
    equipe: zero,
    organisation: zero,
    pilotage: zero,
  };

  // Écran Tâches : les alertes défilent avec le contenu (en tête de liste / de calendrier)
  const alertesTaches = <AlertsCard ecran="taches" checks={checks.taches} />;
  const espacesValue = { liste: espaces, visibles };

  if (booting) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  }

  if (GOOGLE_AUTH && !settings) {
    return (
      <LoginScreen
        initialError={loginError}
        onSignedIn={(email) => {
          const s = { url: API_URL, googleEmail: email };
          setLoginError(null);
          setSettings(s);
          refresh(s);
        }}
      />
    );
  }

  const openAccount = () => {
    if (!settings?.googleEmail) {
      setShowSettings(true);
      return;
    }
    Alert.alert('Compte Google', `Connecté avec ${settings.googleEmail}`, [
      { text: 'Fermer', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: logout },
    ]);
  };

  if (!settings || showSettings) {
    return (
      <SettingsScreen
        initial={settings}
        onSaved={async (s) => {
          await saveSettings(s);
          setSettings(s);
          setShowSettings(false);
          refresh(s);
        }}
        onCancel={settings ? () => setShowSettings(false) : undefined}
        onDisconnect={
          settings
            ? async () => {
                await clearSettings();
                setItems([]);
                setSettings(null);
                setShowSettings(false);
              }
            : undefined
        }
      />
    );
  }

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={() => refresh(settings)} />;

  const TAB_BAR = 58;

  return (
    <SafeContext.Provider value={safe}>
    <HierarchyContext.Provider value={hv}>
    <DomainFilterContext.Provider value={domFilterValue}>
    <CheckActionContext.Provider value={runAction}>
    <IgnoreContext.Provider value={ignoreValue}>
    <EspacesContext.Provider value={espacesValue}>
    <View style={styles.flex}>
      {/* Espaces affichés et « ＋ Espace », au-dessus du titre et du mode */}
      <EspacesBar onChange={setVisibles} onGerer={() => setEspacesOpen(true)} />
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {TAB_TITLES[tab]}
        </Text>
        <View style={styles.modeSwitch}>
          <Segmented
            options={[
              { value: 'simple', label: 'Simple' },
              { value: 'safe', label: 'SAFe' },
            ]}
            value={safe.actif ? 'safe' : 'simple'}
            onChange={(v) => updateSafe({ actif: v === 'safe' })}
          />
        </View>
        {!DEMO && (
          <Pressable onPress={openAccount} hitSlop={10} accessibilityLabel="Réglages">
            <Text style={styles.gear}>⚙︎</Text>
          </Pressable>
        )}
      </View>
      {DEMO && (
        <View style={styles.demo}>
          <Pressable
            onPress={async () => {
              // Tous les espaces de la démo reviennent aux exemples
              for (const e of espaces) await demoApiFor(e.id).reset();
              if (settings) await refresh(settings);
            }}
            hitSlop={8}
          >
            <Text style={styles.demoReset}>Réinitialiser</Text>
          </Pressable>
        </View>
      )}
      {tab === 'taches' && (
        <View style={styles.filters}>
          <Segmented options={MODES} value={mode} onChange={setMode} />
          <TypeFilter value={filter} onChange={setFilter} />
          {(domaines.length > 0 || safe.actif) && (
            <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterLine}>
              {safe.actif && (
                <Pressable
                  onPress={() => setItFilter((v) => !v)}
                  style={[styles.itChip, itFilter && styles.itChipOn]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: itFilter }}
                >
                  <Text style={[styles.itChipText, itFilter && styles.itChipTextOn]}>🏃 Itération en cours</Text>
                </Pressable>
              )}
              {domaines.length > 0 && <DomainesPrincipauxChips />}
            </ScrollView>
            <SousDomaineChips style={styles.sousDomaines} />
            </>
          )}
        </View>
      )}
      {tab !== 'taches' && <View style={styles.spacer} />}
      {info && (
        <Pressable style={styles.info} onPress={() => setInfo(null)} accessibilityLabel="Fermer le message">
          <Text style={styles.infoText}>{info} ✕</Text>
        </Pressable>
      )}
      {notice && (
        <Pressable style={styles.notice} onPress={() => setNotice(null)} accessibilityLabel="Fermer le message">
          <Text style={styles.noticeText}>{notice} ✕</Text>
        </Pressable>
      )}
      {apiVersion < api.API_VERSION_SOUS_DOMAINES && (
        <View style={styles.offline}>
          <Text style={styles.offlineText}>
            Le script du Google Sheet n'est pas à jour : {apiVersion < api.API_VERSION_REPETITION ? 'la répétition, ' : ''}
            {apiVersion < api.API_VERSION_EPICS ? 'les epics, ' : ''}
            {apiVersion < api.API_VERSION_HIERARCHIE ? 'les domaines, les objectifs, ' : ''}
            {apiVersion < api.API_VERSION_SAFE ? 'les données SAFe (états, features, points, itérations), ' : ''}
            {apiVersion < api.API_VERSION_DOMAINE_PI ? 'le domaine des objectifs du PI, ' : ''}
            {apiVersion < api.API_VERSION_TYPES ? 'les nouveaux types (appel, démarche, story, exploration, bug), ' : ''}
            {apiVersion < api.API_VERSION_SOUS_TACHES ? 'les sous-tâches, ' : ''}
            {apiVersion < api.API_VERSION_HEURE_FIN ? "l'heure de fin des rendez-vous, " : ''}
            {apiVersion < api.API_VERSION_IGNOREES ? 'les alertes ignorées, ' : ''}
            {apiVersion < api.API_VERSION_EPIC_PI ? "l'epic des objectifs du PI, " : ''}
            {apiVersion < api.API_VERSION_DATE_FIN ? 'la date de fin des démarches, ' : ''}
            {apiVersion < api.API_VERSION_TERMINE_LE ? 'le jour où une tâche est terminée, ' : ''}
            {apiVersion < api.API_VERSION_STATUT_AVANT ? "le statut d'avant « Terminé », " : ''}les sous-domaines ne seront pas
            enregistrés.
            Recollez le nouveau Code.gs puis Déployer › Gérer les déploiements › Nouvelle version.
          </Text>
        </View>
      )}
      {offline && (
        <Pressable style={styles.offline} onPress={() => refresh(settings)}>
          <Text style={styles.offlineText}>{offline} Données affichées : dernière copie. Touchez pour réessayer.</Text>
        </Pressable>
      )}

      {tab === 'iteration' && (
        <IterationView
          itKey={itKey}
          onChangeIteration={setItKey}
          items={items}
          onOpenTask={openForm}
          onSetStatut={setStatut}
          onChangeCapacite={(n) => updateSafe({ capacite: n })}
          onTogglePointsJours={() => updateSafe({ pointsJours: !safe.pointsJours })}
          refreshControl={refreshControl}
        />
      )}

      {tab === 'pi' && (
        <PIView
          piKey={piKey}
          onChangePi={setPiKey}
          onOpenFeature={(f) => openFeature(f)}
          onOpenIteration={(key) => {
            setItKey(key);
            setTab('iteration');
          }}
          onOpenTask={openForm}
          onToggleTask={toggle}
          onOpenAdd={() => setPiAdd(true)}
          onMoveFeature={async (f, itKey) => {
            await saveEntity('feature', f, { pi: piKey, iteration: itKey });
          }}
          onMoveTask={(t, patch) => updateTask({ id: t.id, ...patch })}
          onOpenObjectifPI={(o) => {
            setEditingOPI(o);
            setOpiFormOpen(true);
          }}
          refreshControl={refreshControl}
        />
      )}

      {tab === 'portefeuille' && (
        <Portfolio
          onOpenEpic={openEpic}
          onOpenObjectif={openObjectif}
          onMoveEpic={(e, etat) =>
            saveEntity('epic', e, { etat }).catch((err) => setNotice(`Epic non déplacée : ${(err as Error).message}`))
          }
          onShowAlerts={() => setTab('roadmap')}
          onOpenWizard={() => openWizard(null)}
          refreshControl={refreshControl}
        />
      )}

      {tab === 'roadmap' && (
        <Roadmap
          epics={epics}
          objectifs={objectifs}
          domaines={domaines}
          items={items}
          onOpenEpic={openEpic}
          onOpenObjectif={openObjectif}
          onOpenDomaine={openDomaine}
          onFixEpic={(e, p) => fixEntity('epic', e, p)}
          onFixObjectif={(o, p) => fixEntity('objectif', o, p)}
          onAlign={alignChild}
          refreshControl={refreshControl}
          onOpenWizard={() => openWizard(null)}
        />
      )}

      {A_VENIR.includes(tab) && <EcranAVenir ecran={tab} />}

      {tab === 'taches' && mode !== 'liste' && (
        <>
          <PeriodHeader
            title={periodTitle}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onToday={pageKey === periodKeyOf(mode, new Date()) ? undefined : () => setAnchor(new Date())}
          />
          <Swipe pageKey={`${mode}:${pageKey}`} onPrev={() => step(-1)} onNext={() => step(1)}>
            {mode === 'jour' && (
              <DayView date={anchor} byDate={byDate} onPress={openForm} onToggle={toggle} refreshControl={refreshControl} header={alertesTaches} />
            )}
            {mode === 'semaine' && (
              <WeekView
                header={alertesTaches}
                band={weekBand}
                date={anchor}
                byDate={byDate}
                onPress={openForm}
                onToggle={toggle}
                refreshControl={refreshControl}
                onOpenDay={(d) => {
                  setAnchor(d);
                  setMode('jour');
                }}
              />
            )}
            {mode === 'mois' && (
              <MonthView
                header={alertesTaches}
                band={monthBand}
                date={anchor}
                byDate={byDate}
                onPress={openForm}
                onToggle={toggle}
                refreshControl={refreshControl}
                onSelect={setAnchor}
              />
            )}
          </Swipe>
        </>
      )}

      {tab === 'taches' && mode === 'liste' && <SectionList
        sections={visible}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TaskItem
            item={item}
            onPress={openForm}
            onToggle={toggle}
            expanded={item.sousTotal ? isDeplie(item) : undefined}
            onToggleExpand={toggleDeplie}
            onAddSubtask={(p, titre) => addSubtask(items.find((x) => x.id === p.id) ?? p, titre).catch((e) => setNotice(`Sous-tâche non ajoutée : ${(e as Error).message}`))}
          />
        )}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.section, section.title === 'En retard' && { color: colors.danger }]}>
            {section.title} · {section.data.length}
          </Text>
        )}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={alertesTaches}
        refreshControl={refreshControl}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !refreshing ? (
            <Text style={styles.empty}>
              Rien à faire pour le moment.{'\n'}Touchez + pour ajouter{' '}
              {filter === 'tous' || filter === 'recurrents' ? 'un élément' : TYPE_LABELS[filter].toLowerCase()}.
            </Text>
          ) : null
        }
        ListFooterComponent={
          doneCount > 0 ? (
            <Pressable onPress={() => setShowDone((v) => !v)} style={styles.doneToggle}>
              <Text style={styles.doneToggleText}>
                {showDone ? 'Masquer' : 'Afficher'} les terminés ({doneCount})
              </Text>
            </Pressable>
          ) : null
        }
      />}

      {!A_VENIR.includes(tab) && <Pressable
        style={[styles.fab, { bottom: TAB_BAR + insets.bottom + 18 }]}
        onPress={() => (tab === 'pi' ? setPiAdd(true) : tab === 'roadmap' || tab === 'portefeuille' ? setAddMenu(true) : openForm(null))}
        accessibilityRole="button"
        accessibilityLabel={tab === 'roadmap' ? 'Nouvelle epic' : 'Ajouter'}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>}

      <View style={[styles.tabBar, { height: TAB_BAR + insets.bottom, paddingBottom: insets.bottom }]}>
        {[...tabs.barre, ...(tabs.plus.length ? (['plus'] as const) : [])].map((key) => key === 'plus' ? (
          <Pressable
            key="plus"
            style={styles.tabBtn}
            onPress={() => setPlusOpen(true)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tabs.plus.includes(tab) }}
            accessibilityLabel="Plus d'écrans"
          >
            <Text style={[styles.tabIcon, tabs.plus.includes(tab) && styles.tabOn]}>⋯</Text>
            <Text style={[styles.tabLabel, tabs.plus.includes(tab) && styles.tabOn]} numberOfLines={1}>
              {tabs.plus.includes(tab) ? TAB_LABELS[tab] : 'Plus'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            key={key}
            style={styles.tabBtn}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <View>
              <Text style={[styles.tabIcon, tab === key && styles.tabOn]}>{TAB_ICONS[key]}</Text>
              {(badges[key].rouge > 0 || badges[key].jaune > 0) && (
                <View style={styles.badges}>
                  {badges[key].rouge > 0 && (
                    <View style={styles.badge} accessibilityLabel={`${badges[key].rouge} alerte${badges[key].rouge > 1 ? 's' : ''}`}>
                      <Text style={styles.badgeText}>{badges[key].rouge > 99 ? '99+' : badges[key].rouge}</Text>
                    </View>
                  )}
                  {badges[key].jaune > 0 && (
                    <View style={[styles.badge, styles.badgeJaune]} accessibilityLabel={`${badges[key].jaune} rappel${badges[key].jaune > 1 ? 's' : ''}`}>
                      <Text style={[styles.badgeText, styles.badgeTextJaune]}>{badges[key].jaune > 99 ? '99+' : badges[key].jaune}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, tab === key && styles.tabOn]} numberOfLines={1}>
              {TAB_LABELS[key]}
            </Text>
          </Pressable>
        ))}
      </View>

      <TaskForm
        visible={formOpen}
        item={editing}
        defaultType={filter === 'tous' || filter === 'recurrents' ? 'tache' : filter}
        defaultDate={tab === 'taches' && (mode === 'jour' || mode === 'mois') ? toDateString(anchor) : ''}
        defaultIteration={tab === 'iteration' ? itKey : ''}
        defaults={taskDefaults}
        onClose={() => setFormOpen(false)}
        onSave={save}
        onDelete={remove}
        onOpenTask={openForm}
        onAddSubtask={addSubtask}
        onUpdateTask={updateTask}
      />

      <EpicForm
        visible={epicFormOpen}
        epic={editingEpic}
        items={items}
        onClose={() => setEpicFormOpen(false)}
        onSave={async (input) => {
          await saveEntity('epic', editingEpic, input);
          setEpicFormOpen(false);
        }}
        onDelete={(e, cascade) => deleteEntity('epic', e, cascade)}
        onOpenTask={(t) => {
          setEpicFormOpen(false);
          openForm(t);
        }}
        defaults={epicDefaults}
        onAddFeature={(e) => {
          setEpicFormOpen(false);
          openFeature(null, { epic: e.id });
        }}
        onAddTask={(e) => {
          setEpicFormOpen(false);
          openNewTask({ epic: e.id });
        }}
        onOpenWizard={(e) => openWizard({ level: 'epic', id: e.id })}
        onAlign={alignChild}
      />
      <ObjectifForm
        visible={objectifFormOpen}
        objectif={editingObjectif}
        onClose={() => setObjectifFormOpen(false)}
        onSave={async (input) => {
          await saveEntity('objectif', editingObjectif, input);
          setObjectifFormOpen(false);
        }}
        onDelete={(o, cascade) => deleteEntity('objectif', o, cascade)}
        onOpenEpic={(e) => {
          setObjectifFormOpen(false);
          openEpic(e);
        }}
        defaults={objDefaults}
        onAddEpic={(o) => {
          setObjectifFormOpen(false);
          openEpic(null, { objectif: o.id, domaine: '' });
        }}
        onOpenWizard={(o) => openWizard({ level: 'objectif', id: o.id })}
        onAlign={alignChild}
      />

      <DomaineForm
        visible={domaineFormOpen}
        domaine={editingDomaine}
        onClose={() => setDomaineFormOpen(false)}
        onSave={async (input) => {
          await saveEntity('domaine', editingDomaine, input);
          setDomaineFormOpen(false);
        }}
        onDelete={(d, cascade) => deleteEntity('domaine', d, cascade)}
        onOpenObjectif={(o) => {
          setDomaineFormOpen(false);
          openObjectif(o);
        }}
        onAddObjectif={(d) => {
          setDomaineFormOpen(false);
          openObjectif(null, { domaine: d.id });
        }}
        onOpenWizard={(d) => openWizard({ level: 'domaine', id: d.id })}
      />

      <FeatureForm
        visible={featureFormOpen}
        feature={editingFeature}
        defaultPi={piKey}
        onClose={() => setFeatureFormOpen(false)}
        onSave={async (input, taches) => {
          const saved = (await saveEntity('feature', editingFeature, input)) as Feature | undefined;
          if (!editingFeature && saved) {
            for (const id of taches.existantes) {
              const t = items.find((x) => x.id === id);
              if (t) await linkTaskToFeature(saved, t);
            }
            for (const titre of taches.nouvelles) await quickAddTask(saved, titre);
          }
          setFeatureFormOpen(false);
        }}
        onLinkTask={linkTaskToFeature}
        onDelete={(f, cascade) => deleteEntity('feature', f, cascade)}
        onOpenTask={(t) => {
          setFeatureFormOpen(false);
          openForm(t);
        }}
        defaults={featDefaults}
        onQuickAddTask={quickAddTask}
        onOpenWizard={(f) => openWizard({ level: 'feature', id: f.id })}
      />

      <ChoiceSheet
        visible={!!askSubs}
        title="Terminer aussi les sous-tâches ?"
        message={
          askSubs
            ? `« ${askSubs.parent.titre} » a encore ${askSubs.kids.length} sous-tâche${askSubs.kids.length > 1 ? 's' : ''} non faite${askSubs.kids.length > 1 ? 's' : ''} : ${askSubs.kids.map((k) => `« ${k.titre} »`).join(', ')}.`
            : undefined
        }
        choices={
          askSubs
            ? [
                {
                  label: `Oui, tout terminer (${askSubs.kids.length + 1})`,
                  principal: true,
                  onPress: () => enregistrerStatuts([askSubs.parent, ...askSubs.kids].map((item) => ({ item, statut: 'termine' as const }))),
                },
                { label: `Non, seulement « ${askSubs.parent.titre} »`, onPress: () => enregistrerStatuts([{ item: askSubs.parent, statut: 'termine' }]) },
              ]
            : []
        }
        onClose={() => setAskSubs(null)}
      />
      <PIAddSheet
        visible={piAdd}
        piKey={piKey}
        onClose={() => setPiAdd(false)}
        onChoose={(kind, itKey) => {
          setPiAdd(false);
          if (kind === 'newFeature') openFeature(null, { pi: piKey, iteration: itKey });
          else if (kind === 'newTask') addHorsFeature(itKey);
          else setPiPicker({ kind: kind === 'pickFeature' ? 'feature' : 'tache', itKey });
        }}
      />

      <PickerModal
        visible={piPicker !== null}
        title={`${piPicker?.kind === 'feature' ? 'Features' : 'Tâches'} pour ${piPickerIt ? piPickerIt.split('-').pop() : `le PI ${piKey.split('-')[1]}`}`}
        hint={
          piPicker?.kind === 'feature'
            ? `Features de toutes les epics, pas encore ${piPickerIt ? 'dans cette itération' : 'dans ce PI'}. Touchez pour la planifier ${piPickerIt ? `en ${piPickerIt.split('-').pop()}` : 'dans ce PI (sans itération)'}.`
            : 'Tâches sans feature et sans date, pas encore dans cette itération. Une tâche datée suit sa date : changez-la dans sa fiche.'
        }
        empty={piPicker?.kind === 'feature' ? 'Aucune autre feature.' : 'Aucune tâche à planifier.'}
        options={piPickerOptions}
        onClose={() => setPiPicker(null)}
        onPick={(id) => {
          const run =
            piPicker?.kind === 'feature'
              ? (async () => {
                  const f = hier.features.find((x) => x.id === id);
                  if (f) await saveEntity('feature', f, { pi: piKey, iteration: piPickerIt });
                })()
              : updateTask({ id, iteration: piPickerIt });
          run.catch((e) => setNotice(`Non planifié : ${(e as Error).message}`));
        }}
      />

      <ProjectWizard
        visible={wizard.open}
        start={wizard.start}
        onClose={() => setWizard((w) => ({ ...w, open: false }))}
        onApply={applyWizard}
      />

      <ObjectifPIForm
        visible={opiFormOpen}
        objectif={editingOPI}
        defaultPi={piKey}
        defaultDomaine={domFilter === 'tous' ? '' : domFilter}
        onClose={() => setOpiFormOpen(false)}
        onSave={async (input) => {
          await saveEntity('objectifpi', editingOPI, input);
          setOpiFormOpen(false);
        }}
        onDelete={(o, cascade) => deleteEntity('objectifpi', o, cascade)}
      />

      <Modal visible={addMenu} transparent animationType="fade" onRequestClose={() => setAddMenu(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setAddMenu(false)}>
          <View style={[styles.menu, { paddingBottom: 16 + insets.bottom }]}>
            <Text style={styles.menuTitle}>Ajouter</Text>
            {(
              [
                ['🚀', 'Assistant projet', 'Créer ou modifier un projet, niveau par niveau', () => openWizard(null)],
                ['🗂️', 'Une epic', 'Un projet daté, avec ses tâches', () => openEpic(null)],
                ...(safe.actif
                  ? ([['🧩', 'Une feature', 'Une partie d’epic (sous-epic), prévue dans un PI', () => openFeature(null)]] as const)
                  : []),
                ['🎯', 'Un objectif', 'Un résultat à atteindre, avec échéance ou permanent', () => openObjectif(null)],
                ['🏷️', 'Un domaine', 'Une grande catégorie : Pro, Perso…', () => openDomaine(null)],
              ] as const
            ).map(([icon, title, sub, action]) => (
              <Pressable
                key={title}
                style={styles.menuItem}
                onPress={() => {
                  setAddMenu(false);
                  action();
                }}
              >
                <Text style={styles.menuIcon}>{icon}</Text>
                <View style={styles.flex}>
                  <Text style={styles.menuItemTitle}>{title}</Text>
                  <Text style={styles.menuItemSub}>{sub}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <ChoiceSheet
        visible={plusOpen}
        title="Plus d'écrans"
        choices={tabs.plus.map((t) => ({ label: `${TAB_ICONS[t]} ${TAB_LABELS[t]}`, principal: t === tab, onPress: () => setTab(t) }))}
        onClose={() => setPlusOpen(false)}
      />
      <EspacesSheet
        visible={espacesOpen}
        espaces={espaces}
        nomApp={NOM_APP}
        demo={DEMO}
        onClose={() => setEspacesOpen(false)}
        domainesMoi={tousHier.domaines.filter((d) => (d.espace || 'moi') === 'moi')}
        onAdd={async (e, domaines) => {
          const liste = [...espaces, e];
          espacesRef.current = liste;
          setEspacesState(liste);
          await saveEspaces(liste);
          // Domaines choisis : copiés de Moi dans le Google Sheet du nouvel espace
          if (settings && domaines.length) {
            api.definirEspaces(connexions(settings), visiblesRef.current[0] ?? 'moi');
            try {
              const existants = (await api.listItems(settings, e.id)).domaines;
              await api.copierDomaines(settings, e.id, domaines, existants);
            } catch (err) {
              setNotice(`Espace ajouté, mais ses domaines n'ont pas été copiés : ${(err as Error).message}`);
            }
          }
          setVisibles([...visibles, e.id]);
          if (settings) await refresh(settings);
        }}
        onRemove={(e) => {
          const liste = espaces.filter((x) => x.id !== e.id);
          espacesRef.current = liste;
          setEspacesState(liste);
          saveEspaces(liste);
          const v = visibles.filter((x) => x !== e.id);
          setVisibles(v.length ? v : ['moi']);
          // Ses données quittent l'application (son Google Sheet reste intact)
          const autre = (x: { espace?: string }) => (x.espace || 'moi') !== e.id;
          setItems((prev) => prev.filter(autre));
          setHier((prev) => ({
            epics: prev.epics.filter(autre),
            objectifs: prev.objectifs.filter(autre),
            domaines: prev.domaines.filter(autre),
            features: prev.features.filter(autre),
            objectifsPI: prev.objectifsPI.filter(autre),
            ignorees: prev.ignorees,
          }));
        }}
      />
    </View>
    </EspacesContext.Provider>
    </IgnoreContext.Provider>
    </CheckActionContext.Provider>
    </DomainFilterContext.Provider>
    </HierarchyContext.Provider>
    </SafeContext.Provider>
  );
}

function periodKeyOf(mode: Mode, d: Date): string {
  if (mode === 'mois') return `${d.getFullYear()}-${d.getMonth()}`;
  return toDateString(mode === 'semaine' ? startOfWeek(d) : d);
}

const styles = StyleSheet.create({
  // Sur ordinateur (navigateur), l'application garde une largeur de téléphone, centrée.
  page: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#DDE3EC' : colors.bg, alignItems: 'center' },
  container: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 480 : undefined, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, flexShrink: 1 },
  modeSwitch: { width: 150, marginLeft: 'auto', marginRight: 10 },
  gear: { fontSize: 26, color: colors.muted },
  filters: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  demo: { flexDirection: 'row', justifyContent: 'flex-end', marginHorizontal: 16, marginTop: 6 },
  demoReset: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  info: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, backgroundColor: '#E8F0FE' },
  infoText: { color: '#174EA6', fontSize: 13, lineHeight: 18 },
  notice: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, backgroundColor: '#FCE8E6' },
  noticeText: { color: colors.danger, fontSize: 13 },
  offline: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, backgroundColor: '#FEF7E0' },
  offlineText: { color: '#7A4F01', fontSize: 13 },
  list: { paddingBottom: 110 },
  section: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 60, fontSize: 15, lineHeight: 22 },
  doneToggle: { alignItems: 'center', paddingVertical: 16 },
  doneToggleText: { color: colors.primary, fontSize: 15 },
  spacer: { height: 12 },
  sousDomaines: { gap: 6 },
  filterLine: { gap: 6, alignItems: 'center' },
  itChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: colors.primary },
  itChipOn: { backgroundColor: colors.primary },
  itChipText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  itChipTextOn: { color: '#fff' },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  menu: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 4,
  },
  menuTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  menuIcon: { fontSize: 26 },
  menuItemTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  menuItemSub: { fontSize: 13, color: colors.muted },
  // La barre des onglets ne se fait jamais écraser ni pousser hors de l'écran
  tabBar: {
    flexShrink: 0,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIcon: { fontSize: 18, color: colors.muted },
  badges: { position: 'absolute', top: -5, left: 13, flexDirection: 'row', gap: 2 },
  badgeJaune: { backgroundColor: '#F2C230' },
  badgeTextJaune: { color: '#3A2E00' },
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  tabLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tabOn: { color: colors.primary },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 32,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 34 },
});
