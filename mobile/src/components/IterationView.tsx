import { ReactElement, useMemo } from 'react';
import { Pressable, RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addDays, toDateString } from '../dates';
import { useHierarchy } from '../hierarchyContext';
import { fmtPoints, iterationByKey, iterationOf, iterationOfItem, piLabel, pointsOf, shiftIteration } from '../pi';
import { useSafe } from '../safe';
import { colors } from '../theme';
import type { Item, Statut } from '../types';
import { PeriodHeader } from './PeriodHeader';
import { Swipe } from './Swipe';

interface Props {
  itKey: string;
  onChangeIteration: (key: string) => void;
  items: Item[];
  onOpenTask: (t: Item) => void;
  onSetStatut: (t: Item, statut: Statut) => void;
  onChangeCapacite: (n: number) => void;
  onTogglePointsJours: () => void;
  refreshControl: ReactElement<RefreshControlProps>;
}

const COLONNES: { statut: Statut; label: string; color: string }[] = [
  { statut: 'a_faire', label: 'À faire', color: colors.muted },
  { statut: 'en_cours', label: 'En cours', color: colors.primary },
  { statut: 'termine', label: 'Fait', color: colors.success },
];

/** 🏃 Itération (exécution SAFe) : Kanban, charge / capacité, burndown. */
export function IterationView({
  itKey,
  onChangeIteration,
  items,
  onOpenTask,
  onSetStatut,
  onChangeCapacite,
  onTogglePointsJours,
  refreshControl,
}: Props) {
  const safe = useSafe();
  const h = useHierarchy();
  const it = iterationByKey(itKey)!;
  const today = toDateString(new Date());
  const current = iterationOf(today).key;
  const fmt = (n: number) => fmtPoints(n, safe.pointsJours);

  const tasks = useMemo(() => items.filter((t) => iterationOfItem(t) === itKey), [items, itKey]);
  const total = tasks.reduce((n, t) => n + pointsOf(t), 0);
  const done = tasks.filter((t) => t.statut === 'termine').reduce((n, t) => n + pointsOf(t), 0);
  const sansPoints = tasks.filter((t) => !pointsOf(t)).length;
  const isIP = it.code === 'IP';
  const capacite = isIP ? 0 : safe.capacite;
  const over = !isIP && total > capacite;

  // Burndown : points restants chaque jour (une tâche terminée compte à sa date de modification)
  const days: string[] = [];
  for (let d = new Date(it.start); toDateString(d) <= it.end; d = addDays(d, 1)) days.push(toDateString(d));
  const doneDay = (t: Item) => (t.modifie_le ? toDateString(new Date(t.modifie_le)) : it.start);
  const remaining = days.map((d) =>
    d > today ? null : total - tasks.filter((t) => t.statut === 'termine' && doneDay(t) <= d).reduce((n, t) => n + pointsOf(t), 0),
  );

  const step = (n: number) => onChangeIteration(shiftIteration(itKey, n));

  return (
    <View style={styles.flex}>
      <PeriodHeader
        title={`${it.code} · ${piLabel(it.pi)}`}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={itKey === current ? undefined : () => onChangeIteration(current)}
      />
      <Swipe pageKey={itKey} onPrev={() => step(-1)} onNext={() => step(1)}>
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
          <Text style={styles.dates}>
            {it.label.split(' · ')[1]}
            {isIP ? ' · semaine d’innovation et de planification' : ''}
          </Text>

          <View style={styles.card}>
            <View style={styles.capRow}>
              <Text style={styles.capTitle}>Charge</Text>
              <Text style={[styles.capValue, over && { color: colors.danger }]}>
                {fmt(total)} {isIP ? '' : `/ ${fmt(capacite)}`} {over ? '⚠' : ''}
              </Text>
            </View>
            {!isIP && (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.min(100, (done / Math.max(capacite, total, 1)) * 100)}%`, backgroundColor: colors.success }]} />
                <View
                  style={[
                    styles.fill,
                    styles.planned,
                    { width: `${Math.min(100, ((total - done) / Math.max(capacite, total, 1)) * 100)}%`, backgroundColor: over ? colors.danger : colors.primary },
                  ]}
                />
              </View>
            )}
            <Text style={styles.muted}>
              Fait {fmt(done)} · reste {fmt(total - done)}
              {sansPoints ? ` · ${sansPoints} tâche${sansPoints > 1 ? 's' : ''} sans points` : ''}
            </Text>
            {over && <Text style={styles.warn}>⚠ La charge dépasse la capacité de {fmt(total - capacite)}.</Text>}
            {!isIP && (
              <View style={styles.settings}>
                <Text style={styles.muted}>Capacité</Text>
                <Pressable style={styles.stepBtn} onPress={() => onChangeCapacite(Math.max(1, safe.capacite - 1))} accessibilityLabel="Diminuer la capacité">
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.capNum}>{safe.capacite}</Text>
                <Pressable style={styles.stepBtn} onPress={() => onChangeCapacite(safe.capacite + 1)} accessibilityLabel="Augmenter la capacité">
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
                <Pressable onPress={onTogglePointsJours} style={styles.unit} accessibilityRole="switch" accessibilityState={{ checked: safe.pointsJours }}>
                  <Text style={styles.unitText}>{safe.pointsJours ? '1 point = 1 jour ✓' : '1 point = 1 jour'}</Text>
                </Pressable>
              </View>
            )}
          </View>

          {total > 0 && (
            <View style={styles.card}>
              <Text style={styles.capTitle}>Burndown · points restants</Text>
              <View style={styles.chart}>
                {days.map((d, i) => {
                  const ideal = total * (1 - i / Math.max(days.length - 1, 1));
                  const r = remaining[i];
                  return (
                    <View key={d} style={styles.col}>
                      <View style={[styles.ideal, { bottom: `${(ideal / total) * 100}%` }]} />
                      {r !== null && (
                        <View
                          style={[
                            styles.bar,
                            { height: `${(r / total) * 100}%`, backgroundColor: r > ideal + 0.01 ? '#F29900' : colors.primary },
                            d === today && styles.barToday,
                          ]}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
              <View style={styles.axis}>
                <Text style={styles.axisText}>{it.label.split(' · ')[1].split(' → ')[0]}</Text>
                <Text style={styles.axisText}>· · · idéal</Text>
                <Text style={styles.axisText}>{it.label.split(' → ')[1]}</Text>
              </View>
            </View>
          )}

          {COLONNES.map((col, ci) => {
            const list = tasks.filter((t) => t.statut === col.statut);
            const pts = list.reduce((n, t) => n + pointsOf(t), 0);
            return (
              <View key={col.statut} style={styles.lane}>
                <View style={[styles.laneHead, { borderLeftColor: col.color }]}>
                  <Text style={[styles.laneTitle, { color: col.color }]}>{col.label}</Text>
                  <Text style={styles.muted}>
                    {list.length} · {fmt(pts)}
                  </Text>
                </View>
                {list.length === 0 && <Text style={styles.empty}>—</Text>}
                {list.map((t) => {
                  const f = h.features.get(t.feature);
                  const e = f ? h.epics.get(f.epic) : h.epics.get(t.epic);
                  const prev = COLONNES[ci - 1];
                  const next = COLONNES[ci + 1];
                  return (
                    <View key={t.id} style={[styles.task, { borderLeftColor: e?.couleur ?? colors.border }]}>
                      <Pressable onPress={() => onOpenTask(t)} style={styles.flex} accessibilityRole="button">
                        <Text style={[styles.taskTitle, t.statut === 'termine' && styles.done]} numberOfLines={2}>
                          {t.titre}
                        </Text>
                        <Text style={styles.muted} numberOfLines={1}>
                          {pointsOf(t) ? fmt(pointsOf(t)) : 'sans points'}
                          {f ? ` · 🧩 ${f.titre}` : e ? ` · ${e.titre}` : ''}
                          {t.date ? ` · ${t.date.slice(8)}/${t.date.slice(5, 7)}` : ''}
                        </Text>
                      </Pressable>
                      <View style={styles.moves}>
                        {prev && (
                          <Pressable onPress={() => onSetStatut(t, prev.statut)} hitSlop={6} accessibilityLabel={`Remettre en ${prev.label}`}>
                            <Text style={styles.move}>‹</Text>
                          </Pressable>
                        )}
                        {next && (
                          <Pressable onPress={() => onSetStatut(t, next.statut)} hitSlop={6} accessibilityLabel={`Passer en ${next.label}`}>
                            <Text style={[styles.move, styles.moveNext]}>{next.statut === 'termine' ? '✓' : '›'}</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
          {tasks.length === 0 && (
            <Text style={styles.hint}>
              Aucune tâche dans cette itération. Une tâche y entre par sa date, ou en choisissant l’itération dans sa
              fiche (tâches sans date). Touchez + pour en ajouter une.
            </Text>
          )}
        </ScrollView>
      </Swipe>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: 130 },
  dates: { textAlign: 'center', color: colors.muted, fontSize: 13, marginBottom: 8 },
  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 6 },
  capRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  capTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  capValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  track: { flexDirection: 'row', height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%' },
  planned: { opacity: 0.55 },
  muted: { fontSize: 12.5, color: colors.muted },
  warn: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  settings: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  stepBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF1F6', alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  capNum: { fontSize: 15, fontWeight: '700', color: colors.text, minWidth: 22, textAlign: 'center' },
  unit: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  unitText: { fontSize: 12, color: colors.text },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 2, marginTop: 4 },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  ideal: { position: 'absolute', left: '35%', width: 3, height: 3, borderRadius: 2, backgroundColor: colors.muted },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 2 },
  barToday: { borderWidth: 2, borderColor: colors.text },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { fontSize: 11, color: colors.muted },
  lane: { marginHorizontal: 16, marginTop: 8, gap: 6 },
  laneHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, paddingLeft: 8 },
  laneTitle: { fontSize: 15, fontWeight: '800' },
  empty: { color: colors.muted, paddingLeft: 12 },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 4,
  },
  taskTitle: { fontSize: 14.5, fontWeight: '600', color: colors.text },
  done: { textDecorationLine: 'line-through', color: colors.muted },
  moves: { flexDirection: 'row', gap: 6 },
  move: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.muted,
    width: 30,
    height: 30,
    lineHeight: 30,
    textAlign: 'center',
    borderRadius: 15,
    backgroundColor: '#EEF1F6',
    overflow: 'hidden',
  },
  moveNext: { color: '#fff', backgroundColor: colors.primary },
  hint: { marginHorizontal: 24, marginTop: 16, textAlign: 'center', color: colors.muted, fontSize: 14, lineHeight: 20 },
});
