import { ReactElement, useState } from 'react';
import { Pressable, RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import { toDateString } from '../dates';
import { domaineOf } from '../hierarchy';
import { useHierarchy } from '../hierarchyContext';
import { fmtPoints, iterationOf, iterationOfItem, iterationsOf, piEnd, piLabel, piOf, piStart, pointsOf, shiftPi } from '../pi';
import { useSafe } from '../safe';
import { colors } from '../theme';
import type { Feature, Item, ObjectifPI } from '../types';
import { DomainChips, inDomain, useDomainFilter } from './DomainFilter';
import { PeriodHeader } from './PeriodHeader';
import { Swipe } from './Swipe';

interface Props {
  piKey: string;
  onChangePi: (pi: string) => void;
  onOpenFeature: (f: Feature | null) => void;
  onOpenObjectifPI: (o: ObjectifPI | null) => void;
  refreshControl: ReactElement<RefreshControlProps>;
  /** Ouvre l'écran Itération */
  onOpenIteration: (key: string) => void;
  /** Itération choisie dans la ligne « Tâches hors feature » */
  selIt: string;
  onSelectIt: (key: string) => void;
  onOpenTask: (t: Item) => void;
  onToggleTask: (t: Item) => void;
  /** Nouvelle tâche hors feature dans l'itération */
  onAddTask: (itKey: string) => void;
  /** Choisir des tâches existantes pour l'itération / des features existantes pour ce PI */
  onPickTask: (itKey: string) => void;
  onPickFeature: () => void;
}

/** Itération proposée dans un PI : celle choisie, sinon l'itération en cours, sinon la première. */
export function selectedIteration(piKey: string, selIt: string): string {
  if (selIt.startsWith(`${piKey}-`)) return selIt;
  const now = iterationOf(new Date()).key;
  return now.startsWith(`${piKey}-`) ? now : iterationsOf(piKey)[0].key;
}

const NAME_W = 140;
const COL_W = 76;
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const court = (d: Date) => `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]}`;

/** 🗓️ PI (vision tactique SAFe) : objectifs du PI, tableau features × itérations, charge. */
export function PIView({
  piKey,
  onChangePi,
  onOpenFeature,
  onOpenObjectifPI,
  refreshControl,
  onOpenIteration,
  selIt,
  onSelectIt,
  onOpenTask,
  onToggleTask,
  onAddTask,
  onPickTask,
  onPickFeature,
}: Props) {
  const h = useHierarchy();
  const safe = useSafe();
  const fmt = (n: number) => fmtPoints(n, safe.pointsJours);
  const today = toDateString(new Date());
  const current = piOf(today);
  const currentIt = iterationOf(today).key;
  const its = iterationsOf(piKey);
  // Filtre de domaine partagé : objectifs, features et tâches du domaine ; capacité commune
  const { value: dom } = useDomainFilter();
  const filtered = dom !== 'tous';
  const domName = dom ? h.domaines.get(dom)?.nom : 'sans domaine';
  const featDom = (f: Feature) => domaineOf({ epic: f.epic }, h)?.id;
  const taskIn = (t: Item) => inDomain(dom, domaineOf(t, h)?.id);

  // Objectifs du PI et prévisibilité (valeur obtenue / prévue, objectifs engagés notés)
  const objs = h.objectifsPI.filter((o) => o.pi === piKey && inDomain(dom, o.domaine)).sort((a, b) => (a.type === b.type ? a.titre.localeCompare(b.titre) : a.type === 'engage' ? -1 : 1));
  const notes = objs.filter((o) => o.type === 'engage' && o.valeur_prevue && o.valeur_obtenue);
  const prevue = notes.reduce((n, o) => n + +o.valeur_prevue, 0);
  const obtenue = notes.reduce((n, o) => n + +o.valeur_obtenue, 0);
  const previsibilite = prevue ? Math.round((obtenue / prevue) * 100) : null;

  // Features du PI, groupées par epic
  const features = h.featureList.filter((f) => f.pi === piKey && inDomain(dom, featDom(f)));
  const groups = [...new Set(features.map((f) => f.epic))]
    .map((epicId) => ({ epic: h.epics.get(epicId), features: features.filter((f) => f.epic === epicId) }))
    .sort((a, b) => (a.epic?.titre ?? '~').localeCompare(b.epic?.titre ?? '~'));
  const sansPi = h.featureList.filter((f) => !f.pi && inDomain(dom, featDom(f)));

  // Charge : points des tâches par itération
  const inIt = its.map((it) => h.items.filter((t) => iterationOfItem(t) === it.key));
  const charge = inIt.map((list) => list.reduce((n, t) => n + pointsOf(t), 0));
  const chargeDom = inIt.map((list) => list.filter(taskIn).reduce((n, t) => n + pointsOf(t), 0));
  // Tâches hors feature, par itération
  const horsFeature = inIt.map((list) => list.filter((t) => !t.feature && taskIn(t)));
  const sel = selectedIteration(piKey, selIt);
  const selIndex = Math.max(0, its.findIndex((it) => it.key === sel));
  // Toutes les tâches hors feature du PI, dans l'ordre des itérations
  const allHors = horsFeature.flatMap((list) =>
    [...list].sort((a, b) => (a.date || '~').localeCompare(b.date || '~') || a.titre.localeCompare(b.titre)),
  );
  const [horsOpen, setHorsOpen] = useState(true);
  const colorOf = (t: Item) =>
    h.epics.get(t.epic)?.couleur ?? h.objectifs.get(t.objectif)?.couleur ?? h.domaines.get(domaineOf(t, h)?.id ?? '')?.couleur ?? '#8A94A6';
  const parentOf = (t: Item) =>
    h.epics.get(t.epic)?.titre ?? h.objectifs.get(t.objectif)?.titre ?? (h.domaines.get(t.domaine) ? `${h.domaines.get(t.domaine)!.icone} ${h.domaines.get(t.domaine)!.nom}` : '');
  const featurePts = features.reduce((n, f) => n + pointsOf(f), 0);
  const capaPi = safe.capacite * 6;

  const step = (n: number) => onChangePi(shiftPi(piKey, n));

  return (
    <View style={styles.flex}>
      <PeriodHeader
        title={`PI ${piLabel(piKey)}`}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={piKey === current ? undefined : () => onChangePi(current)}
      />
      <Swipe pageKey={piKey} onPrev={() => step(-1)} onNext={() => step(1)}>
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
          <Text style={styles.dates}>
            {court(piStart(piKey))} → {court(piEnd(piKey))} · 6 itérations + semaine IP
          </Text>
          <DomainChips style={styles.chips} />

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Objectifs du PI</Text>
              {previsibilite !== null && (
                <Text style={[styles.badge, { color: previsibilite >= 80 ? colors.success : colors.warning }]}>
                  Prévisibilité{filtered ? ` ${domName}` : ''} {previsibilite} %
                </Text>
              )}
            </View>
            {objs.length === 0 && <Text style={styles.muted}>Ce que je m'engage à livrer ce trimestre.</Text>}
            {objs.map((o) => (
              <Pressable key={o.id} style={styles.objRow} onPress={() => onOpenObjectifPI(o)} accessibilityRole="button">
                <Text style={[styles.type, o.type === 'engage' ? styles.engage : styles.bonus]}>{o.type === 'engage' ? 'Engagé' : 'Bonus'}</Text>
                <Text style={styles.objTitle} numberOfLines={2}>
                  {!filtered && o.domaine && h.domaines.get(o.domaine) ? `${h.domaines.get(o.domaine)!.icone} ` : ''}
                  {o.titre}
                </Text>
                <Text style={styles.value}>
                  {o.valeur_prevue || '—'}
                  {o.valeur_obtenue ? ` → ${o.valeur_obtenue}` : ''}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => onOpenObjectifPI(null)} hitSlop={6}>
              <Text style={styles.add}>+ Objectif du PI</Text>
            </Pressable>
          </View>

          <View style={styles.cardHead2}>
            <Text style={styles.section}>Tableau du PI</Text>
            <Text style={styles.muted}>
              Features {fmt(featurePts)} · capacité {fmt(capaPi)}
              {featurePts > capaPi ? ' ⚠' : ''}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.boardPad}>
            <View style={styles.board}>
              <View style={styles.row}>
                <View style={[styles.nameCell, styles.headCell]} />
                {its.map((it) => (
                  <View key={it.key} style={[styles.cell, styles.headCell, it.key === currentIt && styles.nowCol]}>
                    <Text style={[styles.itCode, it.code === 'IP' && { color: colors.warning }]}>{it.code}</Text>
                    <Text style={styles.itDates}>{it.label.split(' · ')[1].split(' → ')[0]}</Text>
                  </View>
                ))}
              </View>

              {groups.map((g) => (
                <View key={g.epic?.id ?? 'none'}>
                  <View style={styles.epicRow}>
                    <View style={[styles.dot, { backgroundColor: g.epic?.couleur ?? colors.muted }]} />
                    <Text style={styles.epicName} numberOfLines={1}>
                      {g.epic ? g.epic.titre : 'Sans epic'}
                    </Text>
                  </View>
                  {g.features.map((f) => {
                    const color = g.epic?.couleur ?? colors.primary;
                    const tasks = h.items.filter((t) => t.feature === f.id);
                    return (
                      <View key={f.id} style={styles.row}>
                        <Pressable style={styles.nameCell} onPress={() => onOpenFeature(f)} accessibilityRole="button">
                          <Text style={styles.fName} numberOfLines={2}>
                            {f.titre}
                          </Text>
                          <Text style={styles.fMeta}>
                            {pointsOf(f) ? fmt(pointsOf(f)) : ''}
                            {!f.iteration ? (pointsOf(f) ? ' · ' : '') + 'non planifiée' : ''}
                          </Text>
                        </Pressable>
                        {its.map((it) => {
                          const planned = f.iteration === it.key;
                          const inIt = tasks.filter((t) => iterationOfItem(t) === it.key);
                          const done = inIt.filter((t) => t.statut === 'termine').length;
                          return (
                            <View key={it.key} style={[styles.cell, it.key === currentIt && styles.nowCol]}>
                              {planned && (
                                <Pressable style={[styles.block, { backgroundColor: color }]} onPress={() => onOpenFeature(f)}>
                                  <Text style={styles.blockText} numberOfLines={1}>
                                    {pointsOf(f) ? fmt(pointsOf(f)) : 'prévue'}
                                  </Text>
                                </Pressable>
                              )}
                              {inIt.length > 0 && (
                                <Text style={[styles.tasks, { color }]}>
                                  {done}/{inIt.length} tâche{inIt.length > 1 ? 's' : ''}
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              ))}
              {features.length === 0 && (
                <Text style={[styles.muted, styles.emptyBoard]}>Aucune feature prévue dans ce PI.</Text>
              )}

              <Pressable style={styles.epicRow} onPress={() => setHorsOpen((v) => !v)} accessibilityRole="button" accessibilityLabel="Replier les tâches hors feature">
                <Text style={styles.epicName}>
                  {horsOpen ? '▾' : '▸'} Tâches hors feature
                </Text>
                <Text style={styles.fMeta}>
                  {allHors.length ? `${allHors.filter((t) => t.statut === 'termine').length}/${allHors.length} faites` : 'aucune'}
                </Text>
              </Pressable>
              {horsOpen &&
                allHors.map((t) => {
                  const done = t.statut === 'termine';
                  const color = colorOf(t);
                  return (
                    <View key={t.id} style={styles.row}>
                      <View style={[styles.nameCell, styles.taskName]}>
                        <Pressable
                          onPress={() => onToggleTask(t)}
                          hitSlop={6}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: done }}
                          accessibilityLabel={`Terminer ${t.titre}`}
                          style={[styles.check, done && styles.checkOn]}
                        >
                          {done && <Text style={styles.checkMark}>✓</Text>}
                        </Pressable>
                        <Pressable style={styles.flex} onPress={() => onOpenTask(t)} accessibilityRole="button">
                          <Text style={[styles.fName, done && styles.done]} numberOfLines={2}>
                            {t.titre}
                          </Text>
                          <Text style={styles.fMeta} numberOfLines={1}>
                            {[t.statut === 'en_cours' ? 'en cours' : '', parentOf(t)].filter(Boolean).join(' · ')}
                          </Text>
                        </Pressable>
                      </View>
                      {its.map((it) => (
                        <View key={it.key} style={[styles.cell, it.key === currentIt && styles.nowCol]}>
                          {iterationOfItem(t) === it.key && (
                            <Pressable
                              style={[styles.block, { backgroundColor: done ? colors.success : color }]}
                              onPress={() => onOpenTask(t)}
                              accessibilityLabel={`${t.titre} en ${it.code}`}
                            >
                              <Text style={styles.blockText} numberOfLines={1}>
                                {done ? '✓ ' : ''}
                                {pointsOf(t) ? fmt(pointsOf(t)) : t.date ? `${t.date.slice(8)}/${t.date.slice(5, 7)}` : '•'}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      ))}
                    </View>
                  );
                })}
              <View style={styles.row}>
                <View style={styles.nameCell}>
                  <Text style={styles.fMeta}>Ajouter une tâche dans l'itération :</Text>
                </View>
                {its.map((it) => (
                  <Pressable
                    key={it.key}
                    style={[styles.cell, it.key === currentIt && styles.nowCol]}
                    onPress={() => onSelectIt(it.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: it.key === sel }}
                    accessibilityLabel={`Ajouter en ${it.code}`}
                  >
                    <Text style={[styles.tasks, styles.selBox, it.key === sel && styles.selOn, { color: it.key === sel ? '#fff' : colors.primary }]}>
                      {it.key === sel ? it.code : '+'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.row, styles.chargeRow]}>
                <View style={styles.nameCell}>
                  <Text style={styles.fName}>Charge</Text>
                  <Text style={styles.fMeta}>{filtered ? `${domName} · total / capacité` : 'tâches / capacité'}</Text>
                </View>
                {its.map((it, i) => {
                  const cap = it.code === 'IP' ? 0 : safe.capacite;
                  const over = cap > 0 && charge[i] > cap;
                  return (
                    <View key={it.key} style={[styles.cell, it.key === currentIt && styles.nowCol]}>
                      {filtered && <Text style={styles.charge}>{chargeDom[i] ? fmt(chargeDom[i]).replace(/ .*/, '') : '0'}</Text>}
                      <Text style={[filtered ? styles.chargeSmall : styles.charge, over && { color: colors.danger }]}>
                        {charge[i] ? fmt(charge[i]).replace(/ .*/, '') : '0'}
                        {cap ? `/${cap}` : ''}
                        {over ? ' ⚠' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.addRow}>
            <Pressable onPress={() => onOpenFeature(null)} hitSlop={6} accessibilityRole="button">
              <Text style={styles.add}>+ Nouvelle feature</Text>
            </Pressable>
            <Pressable onPress={onPickFeature} hitSlop={6} accessibilityRole="button">
              <Text style={styles.add}>+ Feature existante</Text>
            </Pressable>
          </View>

          <View style={styles.addLine}>
            <Text style={styles.muted}>Tâche hors feature en {its[selIndex].code} :</Text>
            <Pressable onPress={() => onAddTask(sel)} hitSlop={6} accessibilityRole="button">
              <Text style={styles.add}>+ Nouvelle</Text>
            </Pressable>
            <Pressable onPress={() => onPickTask(sel)} hitSlop={6} accessibilityRole="button">
              <Text style={styles.add}>+ Existante</Text>
            </Pressable>
            <Pressable onPress={() => onOpenIteration(sel)} hitSlop={6} accessibilityRole="button">
              <Text style={styles.add}>Itération ›</Text>
            </Pressable>
          </View>

          {sansPi.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Features sans PI · {sansPi.length}</Text>
              {sansPi.map((f) => (
                <Pressable key={f.id} onPress={() => onOpenFeature(f)} style={styles.objRow}>
                  <Text style={styles.objTitle}>🧩 {f.titre}</Text>
                  <Text style={styles.muted}>{h.epics.get(f.epic)?.titre ?? ''}</Text>
                </Pressable>
              ))}
            </View>
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
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 8 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHead2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 6 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  badge: { fontSize: 13, fontWeight: '800' },
  muted: { fontSize: 12.5, color: colors.muted },
  objRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  type: { fontSize: 11, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  engage: { color: '#fff', backgroundColor: colors.primary },
  bonus: { color: colors.text, backgroundColor: '#E4E8EF' },
  objTitle: { flex: 1, fontSize: 14.5, color: colors.text, fontWeight: '600' },
  value: { fontSize: 13, fontWeight: '700', color: colors.text },
  add: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  addRow: { flexDirection: 'row', gap: 20, marginHorizontal: 16, marginVertical: 12 },
  addLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginHorizontal: 16, marginBottom: 14 },
  taskName: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8 },
  boardPad: { paddingHorizontal: 16 },
  board: { backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  nameCell: { width: NAME_W, padding: 8, justifyContent: 'center' },
  headCell: { paddingVertical: 8 },
  cell: {
    width: COL_W,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  nowCol: { backgroundColor: '#EEF4FE' },
  itCode: { fontSize: 13, fontWeight: '800', color: colors.text },
  itDates: { fontSize: 10.5, color: colors.muted },
  epicRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingTop: 10, paddingBottom: 4, backgroundColor: '#F7F9FC' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  epicName: { fontSize: 13, fontWeight: '800', color: colors.text },
  fName: { fontSize: 13, fontWeight: '600', color: colors.text },
  fMeta: { fontSize: 11, color: colors.muted },
  block: { alignSelf: 'stretch', borderRadius: 6, paddingVertical: 5, paddingHorizontal: 4, alignItems: 'center' },
  blockText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  tasks: { fontSize: 10.5, fontWeight: '700' },
  emptyBoard: { padding: 16, width: NAME_W + COL_W * 7 },
  chargeRow: { backgroundColor: '#F7F9FC' },
  charge: { fontSize: 12, fontWeight: '800', color: colors.text },
  selBox: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  selOn: { backgroundColor: colors.primary },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  done: { textDecorationLine: 'line-through', color: colors.muted },
  chargeSmall: { fontSize: 10.5, fontWeight: '600', color: colors.muted },
  chips: { paddingHorizontal: 16, paddingBottom: 10 },
});
