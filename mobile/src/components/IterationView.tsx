import { ReactElement, useMemo, useState } from 'react';
import { Pressable, RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addDays, toDateString } from '../dates';
import { domaineOf } from '../hierarchy';
import { useHierarchy } from '../hierarchyContext';
import { fmtPoints, iterationByKey, iterationOf, iterationOfItem, piLabel, pointsOf, shiftIteration } from '../pi';
import { capaciteDe, useSafe } from '../safe';
import { useEspaces } from '../espaces';
import { prefixeEspace } from '../nomsEspaces';
import { colors } from '../theme';
import { sansEnCours, TYPE_ICONS, type Item, type Statut } from '../types';
import { chargeOf, pointsCheck, subtaskMap } from '../subtasks';
import { AlertsCard } from './AlertsCard';
import { checksIteration, filtrerDomaine } from '../checks';
import { DomainChips, inDomain, useDomainFilter } from './DomainFilter';
import { PeriodHeader } from './PeriodHeader';
import { Swipe } from './Swipe';

interface Props {
  itKey: string;
  onChangeIteration: (key: string) => void;
  items: Item[];
  onOpenTask: (t: Item) => void;
  onSetStatut: (t: Item, statut: Statut) => void;
  /** Capacité par itération d'un espace */
  onChangeCapacite: (espace: string, n: number) => void;
  onTogglePointsJours: () => void;
  refreshControl: ReactElement<RefreshControlProps>;
}

const COLONNES: { statut: Statut; label: string; color: string }[] = [
  { statut: 'a_faire', label: 'À faire', color: colors.muted },
  { statut: 'en_cours', label: 'En cours', color: colors.primary },
  { statut: 'termine', label: 'Terminé', color: colors.success },
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

  const { value: dom } = useDomainFilter();
  const filtered = dom !== 'tous';
  const subs = useMemo(() => subtaskMap(items), [items]);
  // Éléments de l'itération (sous-tâches comprises) ; un parent dont les sous-tâches ont des points ne compte pas
  const allTasks = useMemo(() => items.filter((t) => iterationOfItem(t) === itKey), [items, itKey]);
  // Filtre de domaine : on ne voit que ses tâches, mais la capacité reste commune à tous les domaines
  const tasks = useMemo(() => allTasks.filter((t) => inDomain(dom, domaineOf(t, h)?.id, h)), [allTasks, dom, h]);
  const charge = (t: Item) => chargeOf(t, subs);
  const total = tasks.reduce((n, t) => n + charge(t), 0);
  // Cartes du Kanban : les éléments sans parent, et les parents dont une sous-tâche est dans l'itération
  const cards = useMemo(() => {
    const ids = new Set<string>();
    const out: Item[] = [];
    for (const t of tasks) {
      const card = t.parent ? items.find((p) => p.id === t.parent) : t;
      if (card && !ids.has(card.id)) (ids.add(card.id), out.push(card));
    }
    return out;
  }, [tasks, items]);
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});
  const isIP = it.code === 'IP';
  // Espaces affichés : une jauge de charge chacun
  const { visibles: lesEspaces } = useEspaces();

  // Burndown : points restants chaque jour (une tâche terminée compte à sa date de modification)
  const days: string[] = [];
  for (let d = new Date(it.start); toDateString(d) <= it.end; d = addDays(d, 1)) days.push(toDateString(d));
  // Jour de fin réel (« terminé le », script v13), sinon dernière modification (anciennes lignes)
  const doneDay = (t: Item) => t.termine_le || (t.modifie_le ? toDateString(new Date(t.modifie_le)) : it.start);
  const remaining = days.map((d) =>
    d > today ? null : total - tasks.filter((t) => t.statut === 'termine' && doneDay(t) <= d).reduce((n, t) => n + chargeOf(t, subs), 0),
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
          <DomainChips style={styles.chips} />
          <AlertsCard ecran="iteration" titre={`${it.code} · ${piLabel(it.pi)}`} checks={checksIteration(filtrerDomaine(h, dom), itKey, today, (e) => capaciteDe(safe, e), h, safe.pointsJours)} />

          {/* Charge : une jauge par espace affiché (chaque espace a sa capacité) */}
          {lesEspaces.map((e) => {
            const dansE = (t: Item) => (t.espace || 'moi') === e;
            const totalE = tasks.filter(dansE).reduce((n, t) => n + charge(t), 0);
            const totalAllE = allTasks.filter(dansE).reduce((n, t) => n + charge(t), 0);
            const autresE = totalAllE - totalE;
            const doneE = tasks.filter((t) => dansE(t) && t.statut === 'termine').reduce((n, t) => n + charge(t), 0);
            const sansPointsE = cards.filter((t) => dansE(t) && !pointsOf(t) && !(subs.get(t.id) ?? []).some((c) => pointsOf(c) > 0)).length;
            const capE = capaciteDe(safe, e);
            const capacite = isIP ? 0 : capE;
            const over = !isIP && totalAllE > capacite;
            const nom = prefixeEspace(e).replace(/ · $/, '');
            return (
              <View key={e} style={styles.card}>
                <View style={styles.capRow}>
                  <Text style={styles.capTitle}>Charge{nom ? ` · ${nom}` : ''}</Text>
                  <Text style={[styles.capValue, over && { color: colors.danger }]}>
                    {filtered ? `${fmt(totalE)} · total ${fmt(totalAllE)}` : fmt(totalE)} {isIP ? '' : `/ ${fmt(capacite)}`} {over ? '⚠' : ''}
                  </Text>
                </View>
                {!isIP && (
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.min(100, (doneE / Math.max(capacite, totalAllE, 1)) * 100)}%`, backgroundColor: colors.success }]} />
                    <View
                      style={[
                        styles.fill,
                        styles.planned,
                        { width: `${Math.min(100, ((totalE - doneE) / Math.max(capacite, totalAllE, 1)) * 100)}%`, backgroundColor: over ? colors.danger : colors.primary },
                      ]}
                    />
                    {autresE > 0 && (
                      <View style={[styles.fill, styles.planned, { width: `${Math.min(100, (autresE / Math.max(capacite, totalAllE, 1)) * 100)}%`, backgroundColor: '#C5CCD6' }]} />
                    )}
                  </View>
                )}
                <Text style={styles.muted}>
                  Fait {fmt(doneE)} · reste {fmt(totalE - doneE)}
                  {autresE > 0 ? ` · autres domaines ${fmt(autresE)} (gris)` : ''}
                  {sansPointsE ? ` · ${sansPointsE} tâche${sansPointsE > 1 ? 's' : ''} sans points` : ''}
                </Text>
                {over && <Text style={styles.warn}>⚠ La charge{filtered ? ' totale' : ''} dépasse la capacité de {fmt(totalAllE - capacite)}.</Text>}
                {!isIP && (
                  <View style={styles.settings}>
                    <Text style={styles.muted}>Capacité</Text>
                    <Pressable style={styles.stepBtn} onPress={() => onChangeCapacite(e, Math.max(1, capE - 1))} accessibilityLabel={`Diminuer la capacité${nom ? ` de ${nom}` : ''}`}>
                      <Text style={styles.stepText}>−</Text>
                    </Pressable>
                    <Text style={styles.capNum}>{capE}</Text>
                    <Pressable style={styles.stepBtn} onPress={() => onChangeCapacite(e, capE + 1)} accessibilityLabel={`Augmenter la capacité${nom ? ` de ${nom}` : ''}`}>
                      <Text style={styles.stepText}>+</Text>
                    </Pressable>
                    <Pressable onPress={onTogglePointsJours} style={styles.unit} accessibilityRole="switch" accessibilityState={{ checked: safe.pointsJours }}>
                      <Text style={styles.unitText}>{safe.pointsJours ? '1 point = 1 jour ✓' : '1 point = 1 jour'}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}

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
            const list = cards.filter((t) => t.statut === col.statut);
            const pts = list.reduce((n, t) => n + (tasks.includes(t) ? charge(t) : 0) + (subs.get(t.id) ?? []).filter((c) => tasks.includes(c)).reduce((m, c) => m + charge(c), 0), 0);
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
                  // Rendez-vous, appel : pas d'« En cours » (À faire ⇄ Terminé)
                  const saute = (c: (typeof COLONNES)[number] | undefined) => (c && c.statut === 'en_cours' && sansEnCours(t.type) ? undefined : c);
                  const prev = saute(COLONNES[ci - 1]) ?? (sansEnCours(t.type) ? COLONNES[ci - 2] : undefined);
                  const next = saute(COLONNES[ci + 1]) ?? (sansEnCours(t.type) ? COLONNES[ci + 2] : undefined);
                  const kids = subs.get(t.id) ?? [];
                  const kidsDone = kids.filter((c) => c.statut === 'termine').length;
                  const open = ouverts[t.id] ?? kids.some((c) => tasks.includes(c) && c.statut !== 'termine');
                  const alerte = pointsCheck(t, kids).alerte;
                  return (
                    <View key={t.id} style={[styles.taskOuter, { borderLeftColor: e?.couleur ?? colors.border }]}>
                    <View style={styles.task}>
                      <Pressable onPress={() => onOpenTask(t)} style={styles.flex} accessibilityRole="button">
                        <Text style={[styles.taskTitle, t.statut === 'termine' && styles.done]} numberOfLines={2}>
                          {t.titre}
                        </Text>
                        <Text style={styles.muted} numberOfLines={1}>
                          {TYPE_ICONS[t.type]} {pointsOf(t) ? fmt(pointsOf(t)) : 'sans points'}
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
                    {kids.length > 0 && (
                      <Pressable
                        onPress={() => setOuverts((o) => ({ ...o, [t.id]: !open }))}
                        style={styles.kidsToggle}
                        accessibilityRole="button"
                        accessibilityLabel={`${open ? 'Replier' : 'Déplier'} les sous-tâches de ${t.titre}`}
                      >
                        <Text style={styles.kidsToggleText}>
                          {alerte ? '⚠ ' : ''}
                          {open ? '▾' : '▸'} Sous-tâches {kidsDone}/{kids.length}
                        </Text>
                      </Pressable>
                    )}
                    {open &&
                      kids.map((c) => {
                        const ici = tasks.includes(c);
                        const cDone = c.statut === 'termine';
                        const autre = iterationOfItem(c);
                        return (
                          <View key={c.id} style={[styles.kid, !ici && styles.kidAilleurs]}>
                            <Pressable
                              onPress={() => onSetStatut(c, cDone ? 'a_faire' : 'termine')}
                              hitSlop={6}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: cDone }}
                              accessibilityLabel={`Terminer ${c.titre}`}
                              style={[styles.kidCheck, cDone && styles.kidCheckOn]}
                            >
                              {cDone && <Text style={styles.kidMark}>✓</Text>}
                            </Pressable>
                            <Pressable style={styles.flex} onPress={() => onOpenTask(c)} accessibilityRole="button">
                              <Text style={[styles.kidTitle, cDone && styles.done]} numberOfLines={2}>
                                {c.type !== 'tache' ? `${TYPE_ICONS[c.type]} ` : ''}
                                {c.titre}
                              </Text>
                              <Text style={styles.kidMeta}>
                                {pointsOf(c) ? fmt(pointsOf(c)) : ''}
                                {!ici ? `${pointsOf(c) ? ' · ' : ''}${autre ? `en ${autre.split('-').slice(-1)[0]}${autre.slice(0, 7) !== itKey.slice(0, 7) ? ` (${autre.split('-')[1]})` : ''}` : 'hors itération'}` : ''}
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    {open && kids.length > 0 && kidsDone === kids.length && t.statut !== 'termine' && (
                      <Pressable onPress={() => onSetStatut(t, 'termine')} style={styles.finish} accessibilityRole="button">
                        <Text style={styles.finishText}>✓ Tout est fait : terminer « {t.titre} »</Text>
                      </Pressable>
                    )}
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
  chips: { paddingHorizontal: 16, paddingBottom: 8 },
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
  taskOuter: { backgroundColor: colors.card, borderRadius: 10, borderLeftWidth: 4, overflow: 'hidden' },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  kidsToggle: { paddingHorizontal: 10, paddingBottom: 8 },
  kidsToggleText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  kid: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  kidAilleurs: { opacity: 0.45 },
  kidCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  kidCheckOn: { backgroundColor: colors.success, borderColor: colors.success },
  kidMark: { color: '#fff', fontSize: 11, fontWeight: '800' },
  kidTitle: { fontSize: 13.5, color: colors.text },
  kidMeta: { fontSize: 11.5, color: colors.muted },
  finish: { margin: 8, marginTop: 4, backgroundColor: '#E6F4EA', borderRadius: 8, padding: 8 },
  finishText: { color: colors.success, fontWeight: '700', fontSize: 13 },
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
