import { ReactElement, ReactNode, useState } from 'react';
import { Modal, Pressable, RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addDays, parseDate, toDateString } from '../dates';
import { domaineOf } from '../hierarchy';
import { chargeOf, subtaskMap } from '../subtasks';
import { useHierarchy } from '../hierarchyContext';
import { fmtPoints, iterationByKey, iterationOf, iterationOfItem, iterationsOf, piEnd, piLabel, piOf, piStart, pointsOf, shiftPi } from '../pi';
import { useSafe } from '../safe';
import { colors } from '../theme';
import type { Feature, Item, ObjectifPI } from '../types';
import { DateField } from './DateField';
import { AlertsCard } from './AlertsCard';
import { checksPI, filtrerDomaine } from '../checks';
import { DomainChips, inDomain, useDomainFilter } from './DomainFilter';
import { PeriodHeader } from './PeriodHeader';

interface Props {
  piKey: string;
  onChangePi: (pi: string) => void;
  onOpenFeature: (f: Feature | null) => void;
  onOpenObjectifPI: (o: ObjectifPI | null) => void;
  refreshControl: ReactElement<RefreshControlProps>;
  /** Ouvre l'écran Itération */
  onOpenIteration: (key: string) => void;
  onOpenTask: (t: Item) => void;
  onToggleTask: (t: Item) => void;
  /** « + » du tableau : fenêtre d'ajout (feature ou tâche, nouvelle ou existante) */
  onOpenAdd: () => void;
  /** Déplacer une feature / une tâche hors feature vers une autre itération (tâche datée : nouvelle date) */
  onMoveFeature: (f: Feature, itKey: string) => Promise<void>;
  onMoveTask: (t: Item, patch: { iteration: string } | { date: string }) => Promise<void>;
}

type Move = { kind: 'feature'; f: Feature; itKey: string } | { kind: 'task'; t: Item; itKey: string };

/** Date proposée dans l'itération visée : même position (jour) dans l'itération. */
function dateDansIteration(date: string, itKey: string): string {
  const from = iterationOf(date);
  const to = iterationByKey(itKey)!;
  const decalage = Math.round((parseDate(date).getTime() - parseDate(from.start).getTime()) / 86400000);
  const d = addDays(parseDate(to.start), decalage);
  const fin = toDateString(d) > to.end ? to.end : toDateString(d);
  return fin;
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
  onOpenTask,
  onToggleTask,
  onOpenAdd,
  onMoveFeature,
  onMoveTask,
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
  // Un parent dont les sous-tâches ont des points ne compte pas : ses sous-tâches comptent dans leur itération
  const subs = subtaskMap(h.items);
  const charge = inIt.map((list) => list.reduce((n, t) => n + chargeOf(t, subs), 0));
  const chargeDom = inIt.map((list) => list.filter(taskIn).reduce((n, t) => n + chargeOf(t, subs), 0));
  // Tâches hors feature, par itération
  // Les sous-tâches restent sous leur parent : pas de ligne à elles
  const horsFeature = inIt.map((list) => list.filter((t) => !t.feature && !t.parent && taskIn(t)));
  // Toutes les tâches hors feature du PI, dans l'ordre des itérations
  const allHors = horsFeature.flatMap((list) =>
    [...list].sort((a, b) => (a.date || '~').localeCompare(b.date || '~') || a.titre.localeCompare(b.titre)),
  );
  const [horsOpen, setHorsOpen] = useState(true);
  // Déplacement : case vide touchée → confirmation (tâche datée : nouvelle date proposée)
  const [move, setMove] = useState<Move | null>(null);
  const [newDate, setNewDate] = useState('');
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const askMove = (m: Move) => {
    setMove(m);
    setMoveError(null);
    setNewDate(m.kind === 'task' && m.t.date ? dateDansIteration(m.t.date, m.itKey) : '');
  };
  const moveIt = move ? iterationByKey(move.itKey) : undefined;
  const dateIt = newDate ? iterationOf(newDate) : undefined;
  const confirmMove = async () => {
    if (!move) return;
    setMoving(true);
    setMoveError(null);
    try {
      if (move.kind === 'feature') await onMoveFeature(move.f, move.itKey);
      else await onMoveTask(move.t, move.t.date ? { date: newDate } : { iteration: move.itKey });
      setMove(null);
    } catch (e) {
      setMoveError(`Déplacement impossible : ${(e as Error).message}`);
    } finally {
      setMoving(false);
    }
  };
  /** Case d'une ligne : bloc de l'élément, ou case vide qui propose le déplacement */
  const moveCell = (it: { key: string; code: string }, label: string, onPress: () => void, children?: ReactNode) =>
    children ? (
      <View key={it.key} style={[styles.cell, it.key === currentIt && styles.nowCol]}>
        {children}
      </View>
    ) : (
      <Pressable
        key={it.key}
        style={[styles.cell, it.key === currentIt && styles.nowCol]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Déplacer ${label} en ${it.code}`}
      />
    );
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
      {/* Pas de glissement entre PI : le tableau défile librement, on change de PI avec les flèches */}
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
        <Text style={styles.dates}>
          {court(piStart(piKey))} → {court(piEnd(piKey))} · 6 itérations + semaine IP
        </Text>
        <DomainChips style={styles.chips} />
        <AlertsCard ecran="pi" titre={`PI ${piLabel(piKey)}`} checks={checksPI(filtrerDomaine(h, dom), piKey, today, safe.capacite, h)} />

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
              <Pressable style={[styles.nameCell, styles.headCell, styles.corner]} onPress={onOpenAdd} accessibilityRole="button" accessibilityLabel="Ajouter au PI">
                <Text style={styles.cornerPlus}>＋</Text>
                <Text style={styles.cornerText}>Ajouter</Text>
              </Pressable>
              {its.map((it) => (
                <Pressable
                  key={it.key}
                  style={[styles.cell, styles.headCell, it.key === currentIt && styles.nowCol]}
                  onPress={() => onOpenIteration(it.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ouvrir l'itération ${it.code}`}
                >
                  <Text style={[styles.itCode, it.code === 'IP' && { color: colors.warning }]}>{it.code} ›</Text>
                  <Text style={styles.itDates}>{it.label.split(' · ')[1].split(' → ')[0]}</Text>
                </Pressable>
              ))}
            </View>

            {groups.map((g) => (
              <View key={g.epic?.id ?? 'none'}>
                <View style={[styles.row, styles.groupRow]}>
                  <View style={[styles.nameCell, styles.groupName]}>
                    <View style={[styles.dot, { backgroundColor: g.epic?.couleur ?? colors.muted }]} />
                    <Text style={styles.epicName} numberOfLines={2}>
                      {g.epic ? g.epic.titre : 'Sans epic'}
                    </Text>
                  </View>
                  {its.map((it) => (
                    <View key={it.key} style={[styles.cell, it.key === currentIt && styles.nowCol]} />
                  ))}
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
                        const content =
                          planned || inIt.length > 0 ? (
                            <>
                              {planned && (
                                <Pressable style={[styles.block, { backgroundColor: color }]} onPress={() => onOpenFeature(f)}>
                                  <Text style={styles.blockText} numberOfLines={1}>
                                    {pointsOf(f) ? fmt(pointsOf(f)) : 'prévue'}
                                  </Text>
                                </Pressable>
                              )}
                              {inIt.length > 0 && (
                                <Pressable onPress={() => !planned && askMove({ kind: 'feature', f, itKey: it.key })} disabled={planned}>
                                  <Text style={[styles.tasks, { color }]}>
                                    {done}/{inIt.length} tâche{inIt.length > 1 ? 's' : ''}
                                  </Text>
                                </Pressable>
                              )}
                            </>
                          ) : undefined;
                        return moveCell(it, f.titre, () => askMove({ kind: 'feature', f, itKey: it.key }), content);
                      })}
                    </View>
                  );
                })}
              </View>
            ))}
            {features.length === 0 && (
              <Text style={[styles.muted, styles.emptyBoard]}>Aucune feature prévue dans ce PI.</Text>
            )}
            <View style={[styles.row, styles.groupRow]}>
              <Pressable
                style={[styles.nameCell, styles.groupName]}
                onPress={() => setHorsOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel="Replier les tâches hors feature"
              >
                <View style={styles.flex}>
                  <Text style={styles.epicName}>{horsOpen ? '▾' : '▸'} Tâches hors feature</Text>
                  <Text style={styles.fMeta}>
                    {allHors.length ? `${allHors.filter((t) => t.statut === 'termine').length}/${allHors.length} faites` : 'aucune'}
                  </Text>
                </View>
              </Pressable>
              {its.map((it) => (
                <View key={it.key} style={[styles.cell, it.key === currentIt && styles.nowCol]} />
              ))}
            </View>
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
                    {its.map((it) =>
                      moveCell(
                        it,
                        t.titre,
                        () => askMove({ kind: 'task', t, itKey: it.key }),
                        iterationOfItem(t) === it.key ? (
                          <Pressable
                            style={[styles.block, { backgroundColor: done ? colors.success : color }]}
                            onPress={() => onOpenTask(t)}
                            accessibilityLabel={`${t.titre} en ${it.code}`}
                          >
                            <Text style={styles.blockText} numberOfLines={1}>
                              {done ? '✓ ' : ''}
                              {pointsOf(t) ? fmt(pointsOf(t)) : t.date ? court(parseDate(t.date)) : '•'}
                            </Text>
                          </Pressable>
                        ) : undefined,
                      ),
                    )}
                  </View>
                );
              })}
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
      <Modal visible={!!move} transparent animationType="fade" onRequestClose={() => !moving && setMove(null)}>
        <Pressable style={styles.backdrop} onPress={() => !moving && setMove(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {move && moveIt && (
              <>
                <Text style={styles.sheetTitle}>
                  Déplacer « {move.kind === 'feature' ? move.f.titre : move.t.titre} » en {moveIt.code} ?
                </Text>
                <Text style={styles.muted}>{moveIt.label.split(' · ')[1]}</Text>
                {move.kind === 'task' && (subs.get(move.t.id) ?? []).length > 0 && (
                  <Text style={styles.muted}>Ses sous-tâches gardent leur date ou leur itération.</Text>
                )}
                {move.kind === 'feature' && (
                  <Text style={styles.muted}>
                    L’itération prévue de la feature change. Ses tâches gardent leur date ou leur itération.
                  </Text>
                )}
                {move.kind === 'task' && !!move.t.date && (
                  <>
                    <Text style={styles.sheetText}>
                      Cette tâche a une date ({court(parseDate(move.t.date))}) : pour la déplacer, choisissez sa nouvelle date.
                    </Text>
                    <DateField mode="date" value={newDate} onChange={setNewDate} placeholder="Nouvelle date" />
                    {dateIt && dateIt.key !== move.itKey && (
                      <Text style={styles.warnText}>
                        ⚠ Le {court(parseDate(newDate))} tombe en {dateIt.code}
                        {dateIt.pi !== piKey ? ` du PI ${piLabel(dateIt.pi)}` : ''} : la tâche ira là.
                      </Text>
                    )}
                  </>
                )}
                {moveError && <Text style={styles.warnText}>{moveError}</Text>}
                <View style={styles.sheetButtons}>
                  <Pressable onPress={() => setMove(null)} disabled={moving} style={styles.sheetBtn}>
                    <Text style={styles.add}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    onPress={confirmMove}
                    disabled={moving || (move.kind === 'task' && !!move.t.date && !newDate)}
                    style={[styles.sheetBtn, styles.sheetBtnPrimary, moving && { opacity: 0.6 }]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.sheetBtnText}>
                      {moving
                        ? 'Déplacement…'
                        : move.kind === 'task' && move.t.date && newDate
                          ? `Déplacer au ${court(parseDate(newDate))}`
                          : `Déplacer en ${moveIt.code}`}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  groupRow: { backgroundColor: '#F7F9FC' },
  groupName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28, gap: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sheetText: { fontSize: 14, color: colors.text, marginTop: 4 },
  warnText: { fontSize: 13, color: colors.danger, lineHeight: 18 },
  sheetButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 8 },
  sheetBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  sheetBtnPrimary: { backgroundColor: colors.primary },
  sheetBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  corner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cornerPlus: { fontSize: 20, fontWeight: '800', color: colors.primary },
  cornerText: { fontSize: 13, fontWeight: '700', color: colors.primary },
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
