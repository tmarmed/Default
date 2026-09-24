import { ReactElement, useMemo, useState } from 'react';
import { Pressable, RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alerte, alertesEpic } from '../alerts';
import { toDateString } from '../dates';
import { barFor, formatEpicDates, positionOf, progress, roadmapWindow, shift, Window, Zoom } from '../roadmap';
import { colors } from '../theme';
import type { Epic, Item } from '../types';
import { PeriodHeader } from './PeriodHeader';
import { Segmented } from './Segmented';
import { Swipe } from './Swipe';

interface Props {
  epics: Epic[];
  items: Item[];
  onOpenEpic: (epic: Epic) => void;
  /** Bouton d'une alerte : ajuste les dates de l'epic */
  onFixEpic: (epic: Epic, patch: Alerte['patch']) => void;
  refreshControl: ReactElement<RefreshControlProps>;
}

const ZOOMS: { value: Zoom; label: string }[] = [
  { value: '3ans', label: '3 ans' },
  { value: 'annee', label: 'Année' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'mois', label: 'Mois' },
];

const pct = (x: number) => `${Math.max(0, Math.min(100, x * 100))}%` as const;

/** Roadmap : une ligne par epic, barre de début à fin, sur 3 ans / 1 an / 1 trimestre / 1 mois. */
export function Roadmap({ epics, items, onOpenEpic, onFixEpic, refreshControl }: Props) {
  const [zoom, setZoom] = useState<Zoom>('annee');
  const [anchor, setAnchor] = useState(() => new Date());
  const win = useMemo(() => roadmapWindow(zoom, anchor), [zoom, anchor]);
  const today = toDateString(new Date());
  const todayPos = positionOf(today, win);
  const isCurrent = todayPos !== null;

  const sorted = useMemo(
    () => [...epics].sort((a, b) => a.debut.localeCompare(b.debut) || (a.fin || '9999').localeCompare(b.fin || '9999')),
    [epics],
  );
  const [alertesSeules, setAlertesSeules] = useState(false);
  const alertMap = useMemo(() => new Map(epics.map((e) => [e.id, alertesEpic(e, items)])), [epics, items]);
  const nbAlertes = [...alertMap.values()].reduce((n, a) => n + a.length, 0);
  const visible = sorted.filter((e) => barFor(e, win) && (!alertesSeules || alertMap.get(e.id)!.length > 0));
  const before = sorted.filter((e) => e.fin && e.fin < win.start);
  const after = sorted.filter((e) => e.debut > win.end);

  const step = (n: number) => setAnchor((d) => shift(zoom, d, n));

  return (
    <View style={styles.flex}>
      <View style={styles.controls}>
        <Segmented options={ZOOMS} value={zoom} onChange={setZoom} />
        {nbAlertes > 0 && (
          <Pressable
            style={[styles.alertChip, alertesSeules && styles.alertChipOn]}
            onPress={() => setAlertesSeules((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ selected: alertesSeules }}
          >
            <Text style={[styles.alertChipText, alertesSeules && styles.alertChipTextOn]}>
              ⚠ {nbAlertes} alerte{nbAlertes > 1 ? 's' : ''} {alertesSeules ? '· tout afficher' : '· voir seulement'}
            </Text>
          </Pressable>
        )}
      </View>
      <PeriodHeader
        title={win.title}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={isCurrent ? undefined : () => setAnchor(new Date())}
      />
      <Swipe pageKey={`${zoom}:${win.start}`} onPrev={() => step(-1)} onNext={() => step(1)}>
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
          {epics.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Aucune epic pour l’instant</Text>
              <Text style={styles.emptyText}>
                Une epic regroupe des tâches autour d’un projet, avec une date de début et de fin. Touchez + pour
                créer la première.
              </Text>
            </View>
          ) : (
            <View style={styles.chart}>
              <Scale win={win} todayPos={todayPos} />
              {visible.length === 0 && (
                <Text style={styles.none}>Aucune epic sur cette période. Glissez pour changer de période.</Text>
              )}
              {visible.map((e) => (
                <EpicRow
                  key={e.id}
                  epic={e}
                  win={win}
                  items={items}
                  todayPos={todayPos}
                  alertes={alertMap.get(e.id)!}
                  onPress={() => onOpenEpic(e)}
                  onFix={(patch) => onFixEpic(e, patch)}
                />
              ))}
            </View>
          )}

          {(before.length > 0 || after.length > 0) && (
            <View style={styles.outside}>
              {before.length > 0 && <OutsideList title="Terminées avant" epics={before} onOpen={onOpenEpic} />}
              {after.length > 0 && <OutsideList title="À venir après" epics={after} onOpen={onOpenEpic} />}
            </View>
          )}
        </ScrollView>
      </Swipe>
    </View>
  );
}

/** Graduations de la période (années, mois, semaines) et repère « aujourd'hui ». */
function Scale({ win, todayPos }: { win: Window; todayPos: number | null }) {
  return (
    <View style={styles.scale}>
      {win.columns.map((c, i) => (
        <View key={i} style={[styles.scaleCol, { left: pct(c.left), width: pct(c.width) }]}>
          <Text style={styles.scaleLabel} numberOfLines={1}>
            {c.label}
          </Text>
        </View>
      ))}
      {todayPos !== null && (
        <View style={[styles.todayFlag, { left: pct(todayPos) }]}>
          <Text style={styles.todayFlagText}>Auj.</Text>
        </View>
      )}
    </View>
  );
}

function Grid({ win, todayPos }: { win: Window; todayPos: number | null }) {
  return (
    <>
      {win.ticks.map((t, i) => (
        <View key={`t${i}`} style={[styles.tick, { left: pct(t) }]} />
      ))}
      {win.columns.slice(1).map((c, i) => (
        <View key={`c${i}`} style={[styles.gridLine, { left: pct(c.left) }]} />
      ))}
      {todayPos !== null && <View style={[styles.todayLine, { left: pct(todayPos) }]} />}
    </>
  );
}

function EpicRow({
  epic,
  win,
  items,
  todayPos,
  alertes,
  onPress,
  onFix,
}: {
  epic: Epic;
  win: Window;
  items: Item[];
  todayPos: number | null;
  alertes: Alerte[];
  onPress: () => void;
  onFix: (patch: Alerte['patch']) => void;
}) {
  const bar = barFor(epic, win)!;
  const stats = progress(epic.id, items);
  const ratio = stats.total ? stats.done / stats.total : 0;
  const late = !!epic.fin && epic.fin < toDateString(new Date()) && stats.total > stats.done;

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowHead}>
        <View style={[styles.dot, { backgroundColor: epic.couleur }]} />
        <Text style={styles.rowTitle} numberOfLines={1}>
          {epic.titre}
        </Text>
        {alertes.length > 0 && <Text style={styles.warn}>⚠</Text>}
        {stats.total > 0 && (
          <Text style={[styles.rowCount, late && { color: colors.danger }]}>
            {stats.done}/{stats.total}
          </Text>
        )}
      </View>
      <View style={styles.track}>
        <Grid win={win} todayPos={todayPos} />
        <View
          style={[
            styles.bar,
            {
              left: pct(bar.left),
              width: pct(bar.width),
              backgroundColor: `${epic.couleur}40`,
              borderColor: epic.couleur,
            },
            bar.cutStart && styles.cutStart,
            bar.cutEnd && styles.cutEnd,
          ]}
        >
          {/* Avancement : part des tâches terminées */}
          <View style={[styles.barFill, { width: pct(ratio), backgroundColor: epic.couleur }]} />
          {bar.cutStart && <Text style={[styles.arrow, styles.arrowLeft, { color: epic.couleur }]}>‹</Text>}
          {bar.cutEnd && (
            <Text style={[styles.arrow, styles.arrowRight, { color: epic.couleur }]}>{bar.infinite ? '∞' : '›'}</Text>
          )}
        </View>
      </View>
      <Text style={styles.rowDates} numberOfLines={1}>
        {formatEpicDates(epic)}
        {late ? ' · en retard' : ''}
      </Text>
      {alertes.slice(0, 2).map((a) => (
        <View key={a.key} style={styles.alert}>
          <Text style={styles.alertText}>⚠ {a.message}</Text>
          <Pressable style={styles.alertBtn} onPress={() => onFix(a.patch)} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.alertBtnText}>{a.bouton}</Text>
          </Pressable>
        </View>
      ))}
      {alertes.length > 2 && (
        <Text style={styles.alertMore}>… et {alertes.length - 2} autre(s) : touchez l'epic pour les voir.</Text>
      )}
    </Pressable>
  );
}

function OutsideList({ title, epics, onOpen }: { title: string; epics: Epic[]; onOpen: (e: Epic) => void }) {
  return (
    <View style={styles.outsideGroup}>
      <Text style={styles.outsideTitle}>
        {title} · {epics.length}
      </Text>
      {epics.map((e) => (
        <Pressable key={e.id} style={styles.outsideRow} onPress={() => onOpen(e)}>
          <View style={[styles.dot, { backgroundColor: e.couleur }]} />
          <Text style={styles.outsideName} numberOfLines={1}>
            {e.titre}
          </Text>
          <Text style={styles.outsideDates}>{formatEpicDates(e).split(' · ')[0]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const TRACK = 26;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  controls: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  alertChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  alertChipOn: { backgroundColor: colors.danger },
  alertChipText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  alertChipTextOn: { color: '#fff' },
  warn: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  alert: { marginTop: 6, padding: 8, borderRadius: 8, backgroundColor: '#FCE8E6', gap: 6 },
  alertText: { color: '#A50E0E', fontSize: 12.5, lineHeight: 17 },
  alertBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.danger,
  },
  alertBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  alertMore: { marginTop: 4, fontSize: 12, color: colors.danger },
  scroll: { paddingBottom: 130 },
  chart: { marginHorizontal: 12, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 12, paddingBottom: 8 },
  scale: { height: 34, position: 'relative', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  scaleCol: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'flex-end', paddingBottom: 6, alignItems: 'center' },
  scaleLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  todayFlag: { position: 'absolute', top: 0, marginLeft: -15, width: 30, alignItems: 'center' },
  todayFlagText: { fontSize: 10, fontWeight: '700', color: colors.danger },
  row: { paddingVertical: 8, borderRadius: 8 },
  pressed: { backgroundColor: '#F1F4F9' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  rowCount: { fontSize: 12, fontWeight: '600', color: colors.muted },
  track: { height: TRACK, position: 'relative', backgroundColor: '#F4F6FA', borderRadius: 6 },
  gridLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.border },
  tick: { position: 'absolute', top: 6, bottom: 6, width: 1, backgroundColor: '#E9EDF3' },
  todayLine: { position: 'absolute', top: -2, bottom: -2, width: 2, marginLeft: -1, backgroundColor: colors.danger },
  bar: {
    position: 'absolute',
    top: 3,
    height: TRACK - 6,
    minWidth: 6,
    borderRadius: 7,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  cutStart: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 },
  cutEnd: { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 },
  arrow: { position: 'absolute', fontSize: 16, fontWeight: '700', top: -1 },
  arrowLeft: { left: 3 },
  arrowRight: { right: 3 },
  rowDates: { marginTop: 5, fontSize: 12, color: colors.muted },
  none: { textAlign: 'center', color: colors.muted, paddingVertical: 24, fontSize: 14 },
  emptyBox: { marginHorizontal: 16, marginTop: 30, padding: 20, backgroundColor: colors.card, borderRadius: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyText: { marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.muted },
  outside: { marginHorizontal: 16, marginTop: 18, gap: 14 },
  outsideGroup: { gap: 6 },
  outsideTitle: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  outsideRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  outsideName: { flex: 1, fontSize: 14, color: colors.text },
  outsideDates: { fontSize: 12, color: colors.muted },
});
