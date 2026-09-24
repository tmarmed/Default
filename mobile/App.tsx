import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from './src/api';
import { Chips } from './src/components/Chips';
import { EpicForm } from './src/components/EpicForm';
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
import { DEMO, demoApi } from './src/demo';
import { ajusterEpic } from './src/epicRules';
import { EpicsContext } from './src/epicsContext';
import {
  clearSettings,
  loadCache,
  loadEpicsCache,
  loadSettings,
  saveCache,
  saveEpicsCache,
  saveSettings,
} from './src/storage';
import { colors } from './src/theme';
import { expandRange, listEntries, toggleDone } from './src/recurrence';
import { Epic, EpicInput, Item, ItemInput, ItemType, Settings, TYPE_LABELS } from './src/types';

type Filter = 'tous' | ItemType | 'recurrents';
type Mode = 'liste' | 'jour' | 'semaine' | 'mois';

const MODES: { value: Mode; label: string }[] = [
  { value: 'liste', label: 'Liste' },
  { value: 'jour', label: 'Jour' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
];

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'tache', label: 'Tâches' },
  { value: 'mission', label: 'Missions' },
  { value: 'rendez-vous', label: 'Rendez-vous' },
  { value: 'recurrents', label: '🔁' },
];

const matches = (i: Item, filter: Filter) =>
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
  const [items, setItems] = useState<Item[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const epicMap = useMemo(() => new Map(epics.map((e) => [e.id, e])), [epics]);
  const [tab, setTab] = useState<'taches' | 'roadmap'>('taches');
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
  const [apiVersion, setApiVersion] = useState(api.API_VERSION_EPICS);
  const [filter, setFilter] = useState<Filter>('tous');
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('liste');
  const [anchor, setAnchor] = useState(() => new Date());

  const updateItems = useCallback((next: Item[]) => {
    setItems(next);
    saveCache(next).catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    await clearSettings();
    setItems([]);
    setEpics([]);
    setSettings(null);
  }, []);

  const refresh = useCallback(
    async (s: Settings) => {
      setRefreshing(true);
      try {
        const { items: list, epics: epicList, version } = await api.listItems(s);
        updateItems(list);
        setEpics(epicList);
        saveEpicsCache(epicList).catch(() => {});
        setApiVersion(version);
        setOffline(null);
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
    [updateItems, logout],
  );

  useEffect(() => {
    (async () => {
      const [stored, cache, cachedEpics] = await Promise.all([loadSettings(), loadCache(), loadEpicsCache()]);
      let s = stored;
      if (GOOGLE_AUTH) {
        const email = await restoreSession();
        s = email ? { url: API_URL, googleEmail: email } : null;
      }
      if (cache && s) setItems(cache.items.map(api.normalize));
      if (s) setEpics(cachedEpics);
      setSettings(s);
      setBooting(false);
      if (s) refresh(s);
    })();
  }, [refresh]);

  const today = toDateString(new Date());
  const visible = useMemo(
    () =>
      groupItems(
        items
          .filter((i) => matches(i, filter))
          // Un élément répété devient ses lignes du moment : retards regroupés + échéance en cours.
          .flatMap((i) => (i.periodicite ? listEntries(i, today) : [i]))
          .filter((i) => showDone || i.statut !== 'termine'),
      ),
    [items, filter, showDone, today],
  );
  const doneCount = useMemo(
    () => items.filter((i) => !i.periodicite && i.statut === 'termine' && matches(i, filter)).length,
    [items, filter],
  );

  // Vues Jour / Semaine / Mois : éléments datés et échéances des éléments répétés,
  // sur les 6 semaines de la grille du mois affiché (qui contient aussi le jour et la semaine).
  const { byDate, fenetres } = useMemo(() => {
    const gridStart = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const range = expandRange(
      items.filter((i) => matches(i, filter)),
      toDateString(gridStart),
      toDateString(addDays(gridStart, 41)),
      today,
    );
    for (const list of range.byDate.values()) list.sort(compareItems);
    return range;
  }, [items, filter, anchor, today]);
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
      setEditing(item?.baseId ? (items.find((i) => i.id === item.baseId) ?? null) : item);
      setFormOpen(true);
    },
    [items],
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
      const statut = item.statut === 'termine' ? 'a_faire' : 'termine';
      // Mise à jour immédiate à l'écran, annulée si le Google Sheet refuse.
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, statut } : i)));
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
    },
    [settings, items, apiVersion],
  );

  const save = async (input: ItemInput) => {
    if (!settings) return;
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
    if (editing) {
      saved = await api.updateItem(settings, { ...input, id: editing.id });
      next = items.map((i) => (i.id === saved.id ? saved : i));
    } else {
      saved = await api.createItem(settings, input);
      next = [...items, saved];
    }
    updateItems(next);
    setFormOpen(false);
    if (saved.epic) await elargirEpic(saved.epic, next);
  };

  /** Élargit l'epic si une de ses tâches en sort (règles dans epicRules.ts). */
  const elargirEpic = async (epicId: string, allItems: Item[]) => {
    const epic = epics.find((e) => e.id === epicId);
    if (!epic || !settings) return;
    const adj = ajusterEpic(epic, allItems.filter((i) => i.epic === epicId));
    if (adj.debut === epic.debut && adj.fin === epic.fin) return;
    try {
      const updated = await api.updateEpic(settings, { id: epic.id, debut: adj.debut, fin: adj.fin });
      setEpics((prev) => {
        const list = prev.map((e) => (e.id === updated.id ? updated : e));
        saveEpicsCache(list).catch(() => {});
        return list;
      });
      setInfo(adj.messages.join(' '));
    } catch (e) {
      setNotice(`Dates de l'epic non mises à jour : ${(e as Error).message}`);
    }
  };

  const remove = async (item: Item) => {
    if (!settings) return;
    await api.deleteItem(settings, item.id);
    updateItems(items.filter((i) => i.id !== item.id));
    setFormOpen(false);
  };

  const openEpic = (epic: Epic | null) => {
    setEditingEpic(epic);
    setEpicFormOpen(true);
  };

  const saveEpic = async (input: EpicInput) => {
    if (!settings) return;
    if (apiVersion < api.API_VERSION_EPICS) {
      throw new Error("le script du Google Sheet n'est pas à jour. Recollez le nouveau Code.gs et déployez une nouvelle version.");
    }
    // Les dates saisies sont élargies si une tâche de l'epic en sort.
    const adj = editingEpic
      ? ajusterEpic(input, items.filter((i) => i.epic === editingEpic.id))
      : { debut: input.debut, fin: input.fin, messages: [] };
    input = { ...input, debut: adj.debut, fin: adj.fin };
    if (adj.messages.length) setInfo(adj.messages.join(' '));
    if (editingEpic) {
      const saved = await api.updateEpic(settings, { ...input, id: editingEpic.id });
      const list = epics.map((e) => (e.id === saved.id ? saved : e));
      setEpics(list);
      saveEpicsCache(list).catch(() => {});
    } else {
      const created = await api.createEpic(settings, input);
      const list = [...epics, created];
      setEpics(list);
      saveEpicsCache(list).catch(() => {});
    }
    setEpicFormOpen(false);
  };

  const removeEpic = async (epic: Epic) => {
    if (!settings) return;
    await api.deleteEpic(settings, epic.id);
    const list = epics.filter((e) => e.id !== epic.id);
    setEpics(list);
    saveEpicsCache(list).catch(() => {});
    // Les tâches de l'epic sont conservées, sans epic.
    updateItems(items.map((i) => (i.epic === epic.id ? { ...i, epic: '' } : i)));
    setEpicFormOpen(false);
  };

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
    <EpicsContext.Provider value={epicMap}>
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.title}>{tab === 'roadmap' ? 'Roadmap' : 'Mes tâches'}</Text>
        {!DEMO && (
          <Pressable onPress={openAccount} hitSlop={10} accessibilityLabel="Réglages">
            <Text style={styles.gear}>⚙︎</Text>
          </Pressable>
        )}
      </View>
      {DEMO && (
        <View style={styles.demo}>
          <Text style={styles.demoText}>
            Démo : données d'exemple, gardées dans ce navigateur, sans lien avec Google Sheets.
          </Text>
          <Pressable
            onPress={async () => {
              const r = await demoApi.reset();
              updateItems(r.items);
              setEpics(r.epics);
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
          <Chips options={FILTERS} value={filter} onChange={setFilter} compact />
        </View>
      )}
      {tab === 'roadmap' && <View style={styles.spacer} />}
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
      {apiVersion < api.API_VERSION_EPICS && (
        <View style={styles.offline}>
          <Text style={styles.offlineText}>
            Le script du Google Sheet n'est pas à jour : {apiVersion < api.API_VERSION_REPETITION ? 'la répétition et ' : ''}
            les epics ne seront pas enregistrées. Recollez le nouveau Code.gs puis Déployer › Gérer les déploiements ›
            Nouvelle version.
          </Text>
        </View>
      )}
      {offline && (
        <Pressable style={styles.offline} onPress={() => refresh(settings)}>
          <Text style={styles.offlineText}>{offline} Données affichées : dernière copie. Touchez pour réessayer.</Text>
        </Pressable>
      )}

      {tab === 'roadmap' && (
        <Roadmap epics={epics} items={items} onOpenEpic={openEpic} refreshControl={refreshControl} />
      )}

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
              <DayView date={anchor} byDate={byDate} onPress={openForm} onToggle={toggle} refreshControl={refreshControl} />
            )}
            {mode === 'semaine' && (
              <WeekView
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
        renderItem={({ item }) => <TaskItem item={item} onPress={openForm} onToggle={toggle} />}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.section, section.title === 'En retard' && { color: colors.danger }]}>
            {section.title} · {section.data.length}
          </Text>
        )}
        stickySectionHeadersEnabled={false}
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

      <Pressable
        style={[styles.fab, { bottom: TAB_BAR + insets.bottom + 18 }]}
        onPress={() => (tab === 'roadmap' ? openEpic(null) : openForm(null))}
        accessibilityRole="button"
        accessibilityLabel={tab === 'roadmap' ? 'Nouvelle epic' : 'Ajouter'}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <View style={[styles.tabBar, { height: TAB_BAR + insets.bottom, paddingBottom: insets.bottom }]}>
        {(
          [
            ['taches', '✓', 'Tâches'],
            ['roadmap', '▤', 'Roadmap'],
          ] as const
        ).map(([key, icon, label]) => (
          <Pressable
            key={key}
            style={styles.tabBtn}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Text style={[styles.tabIcon, tab === key && styles.tabOn]}>{icon}</Text>
            <Text style={[styles.tabLabel, tab === key && styles.tabOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <TaskForm
        visible={formOpen}
        item={editing}
        defaultType={filter === 'tous' || filter === 'recurrents' ? 'tache' : filter}
        defaultDate={mode === 'jour' || mode === 'mois' ? toDateString(anchor) : ''}
        onClose={() => setFormOpen(false)}
        onSave={save}
        onDelete={remove}
      />

      <EpicForm
        visible={epicFormOpen}
        epic={editingEpic}
        items={items}
        onClose={() => setEpicFormOpen(false)}
        onSave={saveEpic}
        onDelete={removeEpic}
        onOpenTask={(t) => {
          setEpicFormOpen(false);
          openForm(t);
        }}
      />
    </View>
    </EpicsContext.Provider>
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
    paddingTop: 8,
  },
  title: { fontSize: 30, fontWeight: '700', color: colors.text },
  gear: { fontSize: 26, color: colors.muted },
  filters: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#E8F0FE',
  },
  demoText: { flex: 1, color: '#174EA6', fontSize: 12.5, lineHeight: 17 },
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
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIcon: { fontSize: 18, color: colors.muted },
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
