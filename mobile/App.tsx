import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as api from './src/api';
import { Chips } from './src/components/Chips';
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
  groupItems,
  itemsByDate,
  startOfWeek,
  toDateString,
} from './src/dates';
import { clearSettings, loadCache, loadSettings, saveCache, saveSettings } from './src/storage';
import { colors } from './src/theme';
import { Item, ItemInput, ItemType, Settings, TYPE_LABELS } from './src/types';

type Filter = 'tous' | ItemType;
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
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Main />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Main() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [booting, setBooting] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState<string | null>(null);
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

  const refresh = useCallback(
    async (s: Settings) => {
      setRefreshing(true);
      try {
        updateItems(await api.listItems(s));
        setOffline(null);
      } catch (e) {
        setOffline((e as Error).message);
      } finally {
        setRefreshing(false);
      }
    },
    [updateItems],
  );

  useEffect(() => {
    (async () => {
      const [s, cache] = await Promise.all([loadSettings(), loadCache()]);
      if (cache) setItems(cache.items);
      setSettings(s);
      setBooting(false);
      if (s) refresh(s);
    })();
  }, [refresh]);

  const visible = useMemo(
    () =>
      groupItems(
        items.filter((i) => (filter === 'tous' || i.type === filter) && (showDone || i.statut !== 'termine')),
      ),
    [items, filter, showDone],
  );
  const doneCount = useMemo(
    () => items.filter((i) => i.statut === 'termine' && (filter === 'tous' || i.type === filter)).length,
    [items, filter],
  );

  // Vues Jour / Semaine / Mois : tous les éléments datés du type choisi, terminés compris.
  const byDate = useMemo(
    () => itemsByDate(items.filter((i) => filter === 'tous' || i.type === filter)),
    [items, filter],
  );

  const step = (n: number) =>
    setAnchor((d) => (mode === 'mois' ? addMonths(d, n) : addDays(d, mode === 'semaine' ? 7 * n : n)));
  const periodTitle =
    mode === 'mois' ? formatMonth(anchor) : mode === 'semaine' ? formatWeek(anchor) : formatDate(toDateString(anchor));
  const pageKey = periodKeyOf(mode, anchor);

  const openForm = useCallback((item: Item | null) => {
    setEditing(item);
    setFormOpen(true);
  }, []);

  const toggle = useCallback(
    async (item: Item) => {
      if (!settings) return;
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
        Alert.alert('Modification non enregistrée', (e as Error).message);
      }
    },
    [settings],
  );

  const save = async (input: ItemInput) => {
    if (!settings) return;
    if (editing) {
      const saved = await api.updateItem(settings, { ...input, id: editing.id });
      updateItems(items.map((i) => (i.id === saved.id ? saved : i)));
    } else {
      const created = await api.createItem(settings, input);
      updateItems([...items, created]);
    }
    setFormOpen(false);
  };

  const remove = async (item: Item) => {
    if (!settings) return;
    await api.deleteItem(settings, item.id);
    updateItems(items.filter((i) => i.id !== item.id));
    setFormOpen(false);
  };

  if (booting) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  }

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

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes tâches</Text>
        <Pressable onPress={() => setShowSettings(true)} hitSlop={10} accessibilityLabel="Réglages">
          <Text style={styles.gear}>⚙︎</Text>
        </Pressable>
      </View>
      <View style={styles.filters}>
        <Segmented options={MODES} value={mode} onChange={setMode} />
        <Chips options={FILTERS} value={filter} onChange={setFilter} compact />
      </View>
      {offline && (
        <Pressable style={styles.offline} onPress={() => refresh(settings)}>
          <Text style={styles.offlineText}>{offline} Données affichées : dernière copie. Touchez pour réessayer.</Text>
        </Pressable>
      )}

      {mode !== 'liste' && (
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

      {mode === 'liste' && <SectionList
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
              {filter === 'tous' ? 'une tâche' : TYPE_LABELS[filter].toLowerCase()}.
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
        style={styles.fab}
        onPress={() => openForm(null)}
        accessibilityRole="button"
        accessibilityLabel="Ajouter"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <TaskForm
        visible={formOpen}
        item={editing}
        defaultType={filter === 'tous' ? 'tache' : filter}
        defaultDate={mode === 'jour' || mode === 'mois' ? toDateString(anchor) : ''}
        onClose={() => setFormOpen(false)}
        onSave={save}
        onDelete={remove}
      />
    </View>
  );
}

function periodKeyOf(mode: Mode, d: Date): string {
  if (mode === 'mois') return `${d.getFullYear()}-${d.getMonth()}`;
  return toDateString(mode === 'semaine' ? startOfWeek(d) : d);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
