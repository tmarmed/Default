import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alerte, alertesEpic, alertesObjectif, Alignement } from '../alerts';
import { progressObjectif } from '../hierarchy';
import { useHierarchy } from '../hierarchyContext';
import { piLabel } from '../pi';
import { useSafe } from '../safe';
import { toDateString } from '../dates';
import { barFor, formatEpicDates, positionOf, progress, roadmapWindow, shift, Window, Zoom } from '../roadmap';
import { colors } from '../theme';
import type { Domaine, Epic, Item, Objectif } from '../types';
import { DomainChips, useDomainFilter } from './DomainFilter';
import { PeriodHeader } from './PeriodHeader';
import { Segmented } from './Segmented';
import { Swipe } from './Swipe';

interface Props {
  epics: Epic[];
  objectifs: Objectif[];
  domaines: Domaine[];
  items: Item[];
  onOpenEpic: (epic: Epic) => void;
  onOpenObjectif: (o: Objectif) => void;
  onOpenDomaine: (d: Domaine) => void;
  /** Boutons des alertes : ajustent les dates de l'epic / de l'objectif */
  onFixEpic: (epic: Epic, patch: Alerte['patch']) => void;
  onFixObjectif: (o: Objectif, patch: Alerte['patch']) => void;
  /** Deuxième bouton : aligner l'élément (tâche, epic) sur son parent */
  onAlign: (a: Alignement) => void;
  onOpenWizard?: () => void;
  refreshControl: ReactElement<RefreshControlProps>;
}

const ZOOMS: { value: Zoom; label: string }[] = [
  { value: '3ans', label: '3 ans' },
  { value: 'annee', label: 'Année' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'mois', label: 'Mois' },
];

const pct = (x: number) => `${Math.max(0, Math.min(100, x * 100))}%` as const;

const COLLAPSE_KEY = 'mes-taches:roadmap-replie';

/**
 * Roadmap : Domaine > Objectif > Epic, une barre par élément, sur 3 ans / 1 an / 1 trimestre / 1 mois.
 * Sections repliables (mémorisées sur l'appareil), filtre par domaine et « alertes seulement ».
 */
export function Roadmap({
  epics,
  objectifs,
  domaines,
  items,
  onOpenEpic,
  onOpenObjectif,
  onOpenDomaine,
  onFixEpic,
  onFixObjectif,
  onAlign,
  refreshControl,
  onOpenWizard,
}: Props) {
  const [zoom, setZoom] = useState<Zoom>('annee');
  const [anchor, setAnchor] = useState(() => new Date());
  const { value: domaineFiltre } = useDomainFilter();
  const [alertesSeules, setAlertesSeules] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const win = useMemo(() => roadmapWindow(zoom, anchor), [zoom, anchor]);
  const today = toDateString(new Date());
  const todayPos = positionOf(today, win);

  useEffect(() => {
    AsyncStorage.getItem(COLLAPSE_KEY)
      .then((raw) => raw && setCollapsed(new Set(JSON.parse(raw))))
      .catch(() => {});
  }, []);
  const saveCollapsed = (next: Set<string>) => {
    setCollapsed(next);
    AsyncStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])).catch(() => {});
  };
  const toggle = (key: string) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    saveCollapsed(next);
  };

  const byStart = <T extends { debut: string; fin: string }>(a: T, b: T) =>
    a.debut.localeCompare(b.debut) || (a.fin || '9999').localeCompare(b.fin || '9999');

  const hv = useHierarchy();
  const epicAlerts = useMemo(
    () => new Map(epics.map((e) => [e.id, alertesEpic(e, items, hv.featureList)])),
    [epics, items, hv.featureList],
  );
  const objAlerts = useMemo(() => new Map(objectifs.map((o) => [o.id, alertesObjectif(o, epics, items)])), [objectifs, epics, items]);
  const nbAlertes =
    [...epicAlerts.values()].reduce((n, a) => n + a.length, 0) + [...objAlerts.values()].reduce((n, a) => n + a.length, 0);

  // Groupes : un par domaine + « Sans domaine »
  const groups = useMemo(() => {
    const known = new Set(domaines.map((d) => d.id));
    const objKnown = new Set(objectifs.map((o) => o.id));
    const list: { key: string; domaine: Domaine | null; objs: { o: Objectif; epics: Epic[] }[]; loose: Epic[] }[] = [];
    const doms: (Domaine | null)[] = [...[...domaines].sort((a, b) => a.nom.localeCompare(b.nom)), null];
    for (const d of doms) {
      const inDom = (id: string) => (d ? id === d.id : !known.has(id));
      const objs = objectifs
        .filter((o) => inDom(o.domaine))
        .sort(byStart)
        .map((o) => ({ o, epics: epics.filter((e) => e.objectif === o.id).sort(byStart) }));
      const loose = epics.filter((e) => !objKnown.has(e.objectif) && inDom(e.domaine)).sort(byStart);
      list.push({ key: d ? d.id : '', domaine: d, objs, loose });
    }
    return list;
  }, [epics, objectifs, domaines]);

  const epicShown = (e: Epic) => !!barFor(e, win) && (!alertesSeules || epicAlerts.get(e.id)!.length > 0);
  const objShown = (o: Objectif, es: Epic[]) =>
    es.some(epicShown) || (!!barFor(o, win) && (!alertesSeules || objAlerts.get(o.id)!.length > 0));

  const visibleGroups = groups
    .filter((g) => domaineFiltre === 'tous' || g.key === domaineFiltre)
    .map((g) => ({ ...g, objs: g.objs.filter(({ o, epics: es }) => objShown(o, es)), loose: g.loose.filter(epicShown) }))
    .filter((g) => g.objs.length || g.loose.length);

  const inFilter = (d: string) => domaineFiltre === 'tous' || d === domaineFiltre;
  const outside = [
    ...objectifs.filter((o) => !barFor(o, win) && !epics.some((e) => e.objectif === o.id && barFor(e, win))).map((o) => ({ kind: 'o' as const, x: o, dom: o.domaine })),
    ...epics.filter((e) => !barFor(e, win)).map((e) => ({ kind: 'e' as const, x: e, dom: e.objectif ? objectifs.find((o) => o.id === e.objectif)?.domaine ?? '' : e.domaine })),
  ].filter((r) => domaineFiltre === 'tous' || inFilter(r.dom));
  const before = outside.filter((r) => r.x.fin && r.x.fin < win.start).sort((a, b) => byStart(a.x, b.x));
  const after = outside.filter((r) => r.x.debut > win.end).sort((a, b) => byStart(a.x, b.x));

  const allKeys = groups.flatMap((g) => [`d:${g.key}`, ...g.objs.map(({ o }) => `o:${o.id}`)]);
  // Une section repliée suffit pour proposer « Tout déplier »
  const anyCollapsed = allKeys.some((k) => collapsed.has(k));

  const step = (n: number) => setAnchor((d) => shift(zoom, d, n));

  const empty = epics.length === 0 && objectifs.length === 0;

  return (
    <View style={styles.flex}>
      <View style={styles.controls}>
        <Segmented options={ZOOMS} value={zoom} onChange={setZoom} />
        {domaines.length > 0 && (
          <DomainChips style={styles.filterRow} />
        )}
        <View style={styles.toolRow}>
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
          {!empty && (
            <Pressable onPress={() => saveCollapsed(anyCollapsed ? new Set() : new Set(allKeys))} hitSlop={8} style={styles.foldAll}>
              <Text style={styles.foldAllText}>{anyCollapsed ? 'Tout déplier' : 'Tout replier'}</Text>
            </Pressable>
          )}
        </View>
      </View>
      <PeriodHeader
        title={win.title}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={todayPos !== null ? undefined : () => setAnchor(new Date())}
      />
      <Swipe pageKey={`${zoom}:${win.start}`} onPrev={() => step(-1)} onNext={() => step(1)}>
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
          {empty ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Roadmap vide pour l’instant</Text>
              <Text style={styles.emptyText}>
                Organisez vos projets en domaines (Pro, Perso…), objectifs et epics. Touchez + pour créer le premier, ou laissez l’assistant vous guider.
              </Text>
              {onOpenWizard && (
                <Pressable style={styles.wizardBtn} onPress={onOpenWizard} accessibilityRole="button">
                  <Text style={styles.wizardText}>🚀 Assistant projet</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.chart}>
              <Scale win={win} todayPos={todayPos} />
              {visibleGroups.length === 0 && (
                <Text style={styles.none}>
                  {alertesSeules ? 'Aucune alerte sur cette période.' : 'Rien sur cette période. Glissez pour changer de période.'}
                </Text>
              )}
              {visibleGroups.map((g) => {
                const dKey = `d:${g.key}`;
                const open = !collapsed.has(dKey);
                const nbEpics = g.loose.length + g.objs.reduce((n, x) => n + x.epics.filter(epicShown).length, 0);
                const warn =
                  g.objs.reduce((n, { o, epics: es }) => n + objAlerts.get(o.id)!.length + es.reduce((m, e) => m + epicAlerts.get(e.id)!.length, 0), 0) +
                  g.loose.reduce((n, e) => n + epicAlerts.get(e.id)!.length, 0);
                return (
                  <View key={dKey} style={styles.group}>
                    <View style={styles.groupHead}>
                      <Pressable style={styles.groupToggle} onPress={() => toggle(dKey)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
                        <Text style={[styles.groupTitle, g.domaine && { color: g.domaine.couleur }]} numberOfLines={1}>
                          {g.domaine ? `${g.domaine.icone} ${g.domaine.nom}` : '📂 Sans domaine'}
                        </Text>
                        <Text style={styles.groupCount}>
                          {g.objs.length ? `${g.objs.length} obj. · ` : ''}
                          {nbEpics} epic{nbEpics > 1 ? 's' : ''}
                        </Text>
                        {warn > 0 && <Text style={styles.warn}> ⚠ {warn}</Text>}
                      </Pressable>
                      {g.domaine && (
                        <Pressable onPress={() => onOpenDomaine(g.domaine!)} hitSlop={8} accessibilityLabel={`Modifier le domaine ${g.domaine.nom}`}>
                          <Text style={styles.edit}>Modifier</Text>
                        </Pressable>
                      )}
                    </View>
                    {open && (
                      <>
                        {g.objs.map(({ o, epics: es }) => {
                          const oKey = `o:${o.id}`;
                          const oOpen = !collapsed.has(oKey);
                          const shown = es.filter(epicShown);
                          return (
                            <View key={oKey}>
                              <BarRow
                                kind="objectif"
                                title={o.titre}
                                couleur={o.couleur}
                                debut={o.debut}
                                fin={o.fin}
                                win={win}
                                todayPos={todayPos}
                                progress={progressObjectif(o, hv.data)}
                                alertes={objAlerts.get(o.id)!}
                                onPress={() => onOpenObjectif(o)}
                                onFix={(p) => onFixObjectif(o, p)}
                                onAlign={onAlign}
                                toggle={shown.length ? { open: oOpen, count: shown.length, onPress: () => toggle(oKey) } : undefined}
                              />
                              {oOpen &&
                                shown.map((e) => (
                                  <View key={e.id} style={styles.indent}>
                                    <EpicBar epic={e} win={win} items={items} todayPos={todayPos} alertes={epicAlerts.get(e.id)!} onOpen={onOpenEpic} onFix={onFixEpic} onAlign={onAlign} />
                                  </View>
                                ))}
                            </View>
                          );
                        })}
                        {g.loose.length > 0 && g.objs.length > 0 && <Text style={styles.subhead}>Sans objectif</Text>}
                        {g.loose.map((e) => (
                          <EpicBar key={e.id} epic={e} win={win} items={items} todayPos={todayPos} alertes={epicAlerts.get(e.id)!} onOpen={onOpenEpic} onFix={onFixEpic} onAlign={onAlign} />
                        ))}
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {(before.length > 0 || after.length > 0) && !alertesSeules && (
            <View style={styles.outside}>
              {before.length > 0 && <OutsideList title="Terminés avant" rows={before} onOpenEpic={onOpenEpic} onOpenObjectif={onOpenObjectif} />}
              {after.length > 0 && <OutsideList title="À venir après" rows={after} onOpenEpic={onOpenEpic} onOpenObjectif={onOpenObjectif} />}
            </View>
          )}
        </ScrollView>
      </Swipe>
    </View>
  );
}

function EpicBar({
  epic,
  win,
  items,
  todayPos,
  alertes,
  onOpen,
  onFix,
  onAlign,
}: {
  epic: Epic;
  win: Window;
  items: Item[];
  todayPos: number | null;
  alertes: Alerte[];
  onOpen: (e: Epic) => void;
  onFix: (e: Epic, patch: Alerte['patch']) => void;
  onAlign: (a: Alignement) => void;
}) {
  const hv = useHierarchy();
  const safe = useSafe();
  const stats = progress(epic.id, items, hv.featureList);
  const feats = safe.actif ? hv.featureList.filter((f) => f.epic === epic.id) : [];
  return (
    <BarRow
      note={feats.length ? `🧩 ${feats.map((f) => f.titre + (f.pi ? ` (${piLabel(f.pi)})` : '')).join(' · ')}` : undefined}
      kind="epic"
      title={epic.titre}
      couleur={epic.couleur}
      debut={epic.debut}
      fin={epic.fin}
      win={win}
      todayPos={todayPos}
      progress={{ ratio: stats.total ? stats.done / stats.total : 0, label: stats.total ? `${stats.done}/${stats.total}` : '' }}
      alertes={alertes}
      onPress={() => onOpen(epic)}
      onFix={(p) => onFix(epic, p)}
      onAlign={onAlign}
    />
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

/** Ligne de la roadmap (objectif ou epic) : titre, barre de début à fin, avancement, alertes et leurs boutons. */
function BarRow({
  kind,
  title,
  couleur,
  debut,
  fin,
  win,
  todayPos,
  progress: prog,
  alertes,
  onPress,
  onFix,
  onAlign,
  toggle,
  note,
}: {
  kind: 'objectif' | 'epic';
  /** Ligne d'information sous les dates (ex. features de l'epic) */
  note?: string;
  title: string;
  couleur: string;
  debut: string;
  fin: string;
  win: Window;
  todayPos: number | null;
  progress: { ratio: number; label: string };
  alertes: Alerte[];
  onPress: () => void;
  onFix: (patch: Alerte['patch']) => void;
  onAlign: (a: Alignement) => void;
  toggle?: { open: boolean; count: number; onPress: () => void };
}) {
  const bar = barFor({ debut, fin }, win);
  const late = !!fin && fin < toDateString(new Date()) && prog.ratio < 1 && !!prog.label;
  const big = kind === 'objectif';

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        {toggle ? (
          <Pressable onPress={toggle.onPress} hitSlop={8} accessibilityRole="button" accessibilityState={{ expanded: toggle.open }}>
            <Text style={styles.chevronSmall}>{toggle.open ? '▾' : '▸'}</Text>
          </Pressable>
        ) : (
          <View style={[styles.dot, { backgroundColor: couleur }]} />
        )}
        <Pressable style={styles.rowTitleBtn} onPress={onPress} accessibilityRole="button">
          <Text style={[styles.rowTitle, big && styles.rowTitleBig]} numberOfLines={1}>
            {big ? '🎯 ' : ''}
            {title}
          </Text>
        </Pressable>
        {alertes.length > 0 && <Text style={styles.warn}>⚠</Text>}
        {!!prog.label && <Text style={[styles.rowCount, late && { color: colors.danger }]}>{prog.label}</Text>}
      </View>
      <Pressable onPress={onPress}>
        <View style={[styles.track, big && styles.trackBig]}>
          <Grid win={win} todayPos={todayPos} />
          {bar && (
            <View
              style={[
                styles.bar,
                big && styles.barBig,
                { left: pct(bar.left), width: pct(bar.width), backgroundColor: `${couleur}40`, borderColor: couleur },
                bar.cutStart && styles.cutStart,
                bar.cutEnd && styles.cutEnd,
              ]}
            >
              <View style={[styles.barFill, { width: pct(prog.ratio), backgroundColor: couleur }]} />
              {bar.cutStart && <Text style={[styles.arrow, styles.arrowLeft, { color: couleur }]}>‹</Text>}
              {bar.cutEnd && <Text style={[styles.arrow, styles.arrowRight, { color: couleur }]}>{bar.infinite ? '∞' : '›'}</Text>}
            </View>
          )}
        </View>
      </Pressable>
      <Text style={styles.rowDates} numberOfLines={1}>
        {fin ? formatEpicDates({ debut, fin }) : `${formatEpicDates({ debut, fin }).split(' → ')[0]} → ${big ? 'permanent' : 'sans fin'}`}
        {late ? ' · en retard' : ''}
        {toggle && !toggle.open ? ` · ${toggle.count} epic${toggle.count > 1 ? 's' : ''} repliée${toggle.count > 1 ? 's' : ''}` : ''}
      </Text>
      {!!note && (
        <Text style={styles.note} numberOfLines={2}>
          {note}
        </Text>
      )}
      {alertes.slice(0, 2).map((a) => (
        <View key={a.key} style={styles.alert}>
          <Text style={styles.alertText}>⚠ {a.message}</Text>
          <View style={styles.alertBtns}>
            <Pressable style={styles.alertBtn} onPress={() => onFix(a.patch)} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.alertBtnText}>{a.bouton}</Text>
            </Pressable>
            {a.aligner && (
              <Pressable style={[styles.alertBtn, styles.alertBtn2]} onPress={() => onAlign(a.aligner!)} accessibilityRole="button" hitSlop={6}>
                <Text style={[styles.alertBtnText, styles.alertBtnText2]}>{a.aligner.bouton}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
      {alertes.length > 2 && (
        <Text style={styles.alertMore}>… et {alertes.length - 2} autre(s) : ouvrez la fiche pour les voir.</Text>
      )}
    </View>
  );
}

function OutsideList({
  title,
  rows,
  onOpenEpic,
  onOpenObjectif,
}: {
  title: string;
  rows: ({ kind: 'e'; x: Epic } | { kind: 'o'; x: Objectif })[];
  onOpenEpic: (e: Epic) => void;
  onOpenObjectif: (o: Objectif) => void;
}) {
  return (
    <View style={styles.outsideGroup}>
      <Text style={styles.outsideTitle}>
        {title} · {rows.length}
      </Text>
      {rows.map((r) => (
        <Pressable
          key={`${r.kind}${r.x.id}`}
          style={styles.outsideRow}
          onPress={() => (r.kind === 'e' ? onOpenEpic(r.x) : onOpenObjectif(r.x))}
        >
          <View style={[styles.dot, { backgroundColor: r.x.couleur }]} />
          <Text style={styles.outsideName} numberOfLines={1}>
            {r.kind === 'o' ? '🎯 ' : ''}
            {r.x.titre}
          </Text>
          <Text style={styles.outsideDates}>{formatEpicDates(r.x).split(' · ')[0]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const TRACK = 26;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  controls: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  filterRow: { paddingRight: 16 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 },
  foldAll: { marginLeft: 'auto' },
  foldAllText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  group: { marginTop: 6 },
  groupHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  groupToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chevron: { fontSize: 14, color: colors.muted, width: 14 },
  chevronSmall: { fontSize: 13, color: colors.muted, width: 12 },
  groupTitle: { fontSize: 15, fontWeight: '800', color: colors.text, flexShrink: 1 },
  groupCount: { fontSize: 12, color: colors.muted },
  edit: { fontSize: 12.5, color: colors.primary, fontWeight: '600' },
  indent: { marginLeft: 14, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: colors.border },
  subhead: { marginTop: 8, fontSize: 11.5, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  rowTitleBtn: { flex: 1 },
  rowTitleBig: { fontSize: 15.5, fontWeight: '700' },
  trackBig: { height: 30 },
  barBig: { height: 24, borderWidth: 2 },
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
    maxWidth: '100%',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.danger,
  },
  alertBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  // Boutons l'un sous l'autre : leur texte (avec les noms) peut passer à la ligne
  alertBtns: { gap: 6, alignItems: 'flex-start' },
  alertBtn2: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.danger },
  alertBtnText2: { color: colors.danger },
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
  rowTitle: { fontSize: 14.5, fontWeight: '600', color: colors.text },
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
  note: { marginTop: 3, fontSize: 12, color: colors.text },
  rowDates: { marginTop: 5, fontSize: 12, color: colors.muted },
  none: { textAlign: 'center', color: colors.muted, paddingVertical: 24, fontSize: 14 },
  emptyBox: { marginHorizontal: 16, marginTop: 30, padding: 20, backgroundColor: colors.card, borderRadius: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  wizardBtn: { alignSelf: 'flex-start', marginTop: 14, backgroundColor: colors.primary, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  wizardText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyText: { marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.muted },
  outside: { marginHorizontal: 16, marginTop: 18, gap: 14 },
  outsideGroup: { gap: 6 },
  outsideTitle: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  outsideRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  outsideName: { flex: 1, fontSize: 14, color: colors.text },
  outsideDates: { fontSize: 12, color: colors.muted },
});
