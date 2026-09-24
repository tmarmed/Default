import { ReactElement, useMemo } from 'react';
import { Pressable, RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import { alertesEpic, alertesObjectif } from '../alerts';
import { toDateString } from '../dates';
import { domaineOf, progressObjectif } from '../hierarchy';
import { useHierarchy } from '../hierarchyContext';
import { formatEpicDates, progress } from '../roadmap';
import { etatEpic } from '../safe';
import { colors } from '../theme';
import { Epic, ETATS_EPIC, EtatEpic, Objectif } from '../types';
import { AlertsCard } from './AlertsCard';
import { checksPortefeuille, filtrerDomaine } from '../checks';
import { DomainChips, useDomainFilter } from './DomainFilter';

interface Props {
  onOpenEpic: (e: Epic) => void;
  onOpenObjectif: (o: Objectif) => void;
  onMoveEpic: (e: Epic, etat: EtatEpic) => void;
  onShowAlerts: () => void;
  onOpenWizard?: () => void;
  refreshControl: ReactElement<RefreshControlProps>;
}

/** 🧭 Portefeuille (vision stratégique SAFe) : Kanban des epics, objectifs, répartition, alertes. */
export function Portfolio({ onOpenEpic, onOpenObjectif, onMoveEpic, onShowAlerts, refreshControl, onOpenWizard }: Props) {
  const h = useHierarchy();
  const today = toDateString(new Date());
  const { value: dom } = useDomainFilter();

  const epicDom = (e: Epic) => domaineOf({ epic: e.id }, h)?.id ?? '';
  const epics = h.epicList.filter((e) => dom === 'tous' || epicDom(e) === dom);
  const objectifs = h.objectifList.filter((o) => dom === 'tous' || o.domaine === dom);

  const columns = useMemo(
    () => ETATS_EPIC.map((s) => ({ ...s, epics: epics.filter((e) => etatEpic(e, today) === s.value) })),
    [epics, today],
  );
  const nbAlertes =
    epics.reduce((n, e) => n + alertesEpic(e, h.items, h.featureList).length, 0) +
    objectifs.reduce((n, o) => n + alertesObjectif(o, h.epicList, h.items).length, 0);

  // Répartition des epics en cours par domaine
  const enCours = epics.filter((e) => etatEpic(e, today) === 'en_cours');
  const repartition = [...h.domaineList, null]
    .map((d) => ({ d, n: enCours.filter((e) => epicDom(e) === (d ? d.id : '')).length }))
    .filter((r) => r.n > 0);

  return (
    <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
      {h.epicList.length === 0 && onOpenWizard && (
        <Pressable style={styles.wizard} onPress={onOpenWizard} accessibilityRole="button">
          <Text style={styles.wizardText}>🚀 Aucune epic : lancer l’assistant projet</Text>
        </Pressable>
      )}
      <DomainChips style={styles.pad} />
      <AlertsCard ecran="portefeuille" checks={checksPortefeuille(filtrerDomaine(h, dom), today)} />

      <View style={styles.stats}>
        {ETATS_EPIC.map((s) => (
          <View key={s.value} style={styles.stat}>
            <Text style={[styles.statNum, { color: s.color }]}>{columns.find((c) => c.value === s.value)!.epics.length}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {nbAlertes > 0 && (
        <Pressable style={styles.alertBox} onPress={onShowAlerts} accessibilityRole="button">
          <Text style={styles.alertText}>⚠ {nbAlertes} alerte{nbAlertes > 1 ? 's' : ''} de dates · voir dans la roadmap ›</Text>
        </Pressable>
      )}

      <Text style={styles.section}>Kanban des epics</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.board}>
        {columns.map((col, ci) => (
          <View key={col.value} style={styles.column}>
            <View style={[styles.colHead, { borderTopColor: col.color }]}>
              <Text style={[styles.colTitle, { color: col.color }]}>{col.label}</Text>
              <Text style={styles.colCount}>{col.epics.length}</Text>
            </View>
            {col.epics.length === 0 && <Text style={styles.empty}>—</Text>}
            {col.epics.map((e) => {
              const p = progress(e.id, h.items, h.featureList);
              const d = domaineOf({ epic: e.id }, h);
              const warn = alertesEpic(e, h.items, h.featureList).length;
              const prev = ETATS_EPIC[ci - 1];
              const next = ETATS_EPIC[ci + 1];
              return (
                <View key={e.id} style={[styles.card, { borderLeftColor: e.couleur }]}>
                  <Pressable onPress={() => onOpenEpic(e)} accessibilityRole="button">
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {warn > 0 ? '⚠ ' : ''}
                      {e.titre}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {d ? `${d.icone} ${d.nom} · ` : ''}
                      {formatEpicDates(e).split(' · ')[0]}
                    </Text>
                    {p.total > 0 && (
                      <View style={styles.progressRow}>
                        <View style={styles.track}>
                          <View style={[styles.fill, { width: `${(p.done / p.total) * 100}%`, backgroundColor: e.couleur }]} />
                        </View>
                        <Text style={styles.cardMeta}>
                          {p.done}/{p.total}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                  <View style={styles.moves}>
                    {prev ? (
                      <Pressable onPress={() => onMoveEpic(e, prev.value)} hitSlop={6} accessibilityLabel={`Passer en ${prev.label}`}>
                        <Text style={styles.move}>‹ {prev.label}</Text>
                      </Pressable>
                    ) : (
                      <View />
                    )}
                    {next && (
                      <Pressable onPress={() => onMoveEpic(e, next.value)} hitSlop={6} accessibilityLabel={`Passer en ${next.label}`}>
                        <Text style={[styles.move, styles.moveNext]}>{next.label} ›</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <Text style={styles.section}>Objectifs</Text>
      {objectifs.length === 0 && <Text style={styles.muted}>Aucun objectif. Créez-en un depuis la roadmap (+).</Text>}
      {objectifs.map((o) => {
        const p = progressObjectif(o, h.data);
        const warn = alertesObjectif(o, h.epicList, h.items).length;
        return (
          <Pressable key={o.id} style={styles.obj} onPress={() => onOpenObjectif(o)} accessibilityRole="button">
            <View style={styles.objHead}>
              <Text style={styles.objTitle} numberOfLines={1}>
                {warn > 0 ? '⚠ ' : ''}🎯 {o.titre}
              </Text>
              <Text style={styles.cardMeta}>{p.label || '—'}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${p.ratio * 100}%`, backgroundColor: o.couleur }]} />
            </View>
            <Text style={styles.cardMeta}>{o.fin ? `Échéance : ${formatEpicDates(o).split(' → ')[1].split(' · ')[0]}` : 'Permanent'}</Text>
          </Pressable>
        );
      })}

      {repartition.length > 0 && (
        <>
          <Text style={styles.section}>Epics en cours par domaine</Text>
          <View style={styles.repart}>
            {repartition.map(({ d, n }) => (
              <View key={d ? d.id : 'none'} style={styles.repRow}>
                <Text style={styles.repName} numberOfLines={1}>
                  {d ? `${d.icone} ${d.nom}` : 'Sans domaine'}
                </Text>
                <View style={styles.repTrack}>
                  <View style={[styles.fill, { width: `${(n / enCours.length) * 100}%`, backgroundColor: d?.couleur ?? colors.muted }]} />
                </View>
                <Text style={styles.repPct}>{Math.round((n / enCours.length) * 100)} %</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 130 },
  wizard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.primary, borderRadius: 12, padding: 12 },
  wizardText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
  pad: { paddingHorizontal: 16, paddingBottom: 8 },
  stats: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 10 },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  alertBox: { marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: '#FCE8E6' },
  alertText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  section: {
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  board: { paddingHorizontal: 16, gap: 10 },
  column: { width: 220, backgroundColor: '#E9EDF3', borderRadius: 12, padding: 8, gap: 8 },
  colHead: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 3, paddingTop: 6, paddingHorizontal: 4 },
  colTitle: { fontSize: 14, fontWeight: '800' },
  colCount: { fontSize: 13, fontWeight: '700', color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, paddingVertical: 8 },
  card: { backgroundColor: colors.card, borderRadius: 10, padding: 10, borderLeftWidth: 4, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.muted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginVertical: 4 },
  fill: { height: '100%', borderRadius: 3 },
  moves: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  move: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  moveNext: { color: colors.primary },
  muted: { marginHorizontal: 16, fontSize: 13, color: colors.muted },
  obj: { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  objHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  objTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  repart: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 8 },
  repRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  repName: { width: 110, fontSize: 13, color: colors.text },
  repTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  repPct: { width: 42, textAlign: 'right', fontSize: 12, color: colors.muted },
});
