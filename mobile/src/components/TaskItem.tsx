import { memo, useState } from 'react';
import { domaineOf } from '../hierarchy';
import { useHierarchy } from '../hierarchyContext';
import { fmtPoints, pointsOf } from '../pi';
import { useSafe } from '../safe';
import { espaceParId, ICONE_ESPACE, libelleEspace, useEspaces } from '../espaces';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatDate, isOverdue, toDateString } from '../dates';
import { callNumber } from '../phone';
import { colors, prioriteColors, typeColors } from '../theme';
import { finDepassee, Item, STATUT_LABELS, TYPE_ICONS, TYPE_LABELS } from '../types';

interface Props {
  item: Item;
  onPress: (item: Item) => void;
  onToggle: (item: Item) => void;
  /** Parent avec sous-tâches : déplié ou non (liste) */
  expanded?: boolean;
  onToggleExpand?: (id: string, now: boolean) => void;
  onAddSubtask?: (parent: Item, titre: string) => void;
}

export const TaskItem = memo(function TaskItem({ item, onPress, onToggle, expanded, onToggleExpand, onAddSubtask }: Props) {
  const [quick, setQuick] = useState('');
  const done = item.statut === 'termine';
  const h = useHierarchy();
  const safe = useSafe();
  const pts = safe.actif ? pointsOf(item) : 0;
  const parentFeature = h.features.get(item.feature);
  // Rattachement le plus précis affiché en étiquette, précédé de l'icône du domaine.
  const parent = parentFeature ?? h.epics.get(item.epic) ?? h.objectifs.get(item.objectif);
  const parentColor = parentFeature ? (h.epics.get(parentFeature.epic)?.couleur ?? colors.primary) : parent?.couleur;
  const domaine = domaineOf(item, h);
  const late = isOverdue(item);
  // Plusieurs espaces affichés : l'étiquette de l'espace de la tâche
  const esp = useEspaces();
  const monEspace = esp.visibles.length > 1 ? espaceParId(esp.liste, item.espace) : undefined;
  return (
    <Pressable style={[styles.card, expanded && styles.cardOpen]} onPress={() => onPress(item)}>
      <View style={[styles.stripe, { backgroundColor: typeColors[item.type] }]} />
      <Pressable
        onPress={() => onToggle(item)}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? 'Marquer à faire' : 'Marquer terminé'}
        style={[styles.check, done && styles.checkDone, expanded && styles.checkOpen]}
      >
        {done && <Text style={styles.checkMark}>✓</Text>}
      </Pressable>
      <View style={styles.body}>
        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
          {item.repereFin ? <Text style={styles.finLabel}>⏳ Fin : </Text> : null}
          {item.titre}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.badge, { color: typeColors[item.type] }]}>
            {TYPE_ICONS[item.type]} {TYPE_LABELS[item.type]}
          </Text>
          {!!monEspace && (
            <Text style={styles.espace} numberOfLines={1}>
              {ICONE_ESPACE[monEspace.type]} {libelleEspace(monEspace)}
            </Text>
          )}
          {!!item.parentTitre && (
            <Text style={styles.metaText} numberOfLines={1}>
              ↳ {item.parentTitre}
            </Text>
          )}
          {!!item.heure && (
            <Text style={styles.metaText}>
              🕒 {item.heure}
              {item.heure_fin ? ` → ${item.heure_fin}` : ''}
            </Text>
          )}
          {!!item.date_fin && (
            <Text style={[styles.metaText, !done && item.date_fin < toDateString(new Date()) && { color: colors.danger }]}>
              ⏳ fin {formatDate(item.date_fin)}
            </Text>
          )}
          {item.type === 'appel' && !!item.telephone && (
            <Pressable onPress={() => callNumber(item.telephone)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Appeler le ${item.telephone}`}>
              <Text style={styles.call}>📞 {item.telephone}</Text>
            </Pressable>
          )}
          {!!item.lieu && (
            <Text style={styles.metaText} numberOfLines={1}>
              📍 {item.lieu}
            </Text>
          )}
          {!!item.periodicite && !item.retards && (
            <Text style={styles.metaText} numberOfLines={1}>
              🔁 {item.periodeLabel ?? ''}
            </Text>
          )}
          {(parent || domaine) && (
            <Text
              style={[
                styles.epic,
                { color: parentColor ?? domaine!.couleur, borderColor: parentColor ?? domaine!.couleur },
              ]}
              numberOfLines={1}
            >
              {domaine ? `${domaine.icone} ` : ''}
              {parentFeature ? '🧩 ' : ''}
              {parent ? parent.titre : domaine!.nom}
            </Text>
          )}
          {pts > 0 && <Text style={styles.points}>{fmtPoints(pts, safe.pointsJours)}</Text>}
          {item.statut === 'en_cours' && <Text style={styles.enCours}>{STATUT_LABELS.en_cours}</Text>}
          {item.retards ? (
            <Text style={styles.late}>
              🔁 En retard : {item.retards.join(', ')}
            </Text>
          ) : (
            late && <Text style={styles.late}>{finDepassee(item, toDateString(new Date())) ? 'Date de fin dépassée' : 'En retard'}</Text>
          )}
        </View>
        {expanded && (
          <View style={styles.subs}>
            {(item.sousTaches ?? []).map((c) => {
              const cDone = c.statut === 'termine';
              const cLate = isOverdue(c);
              return (
                <View key={c.id} style={styles.subRow}>
                  <Pressable
                    onPress={() => onToggle(c)}
                    hitSlop={8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: cDone }}
                    accessibilityLabel={`Terminer ${c.titre}`}
                    style={[styles.subCheck, cDone && styles.checkDone]}
                  >
                    {cDone && <Text style={styles.subMark}>✓</Text>}
                  </Pressable>
                  <Pressable style={styles.subBody} onPress={() => onPress(c)} accessibilityRole="button">
                    <Text style={[styles.subTitle, cDone && styles.titleDone]} numberOfLines={2}>
                      {c.type !== 'tache' ? `${TYPE_ICONS[c.type]} ` : ''}
                      {c.titre}
                    </Text>
                    {(!!c.date || !!c.heure || cLate) && (
                      <Text style={[styles.subMeta, cLate && !cDone && styles.lateText]}>
                        {c.date ? `${c.date.slice(8)}/${c.date.slice(5, 7)}` : ''}
                        {c.heure ? ` ${c.heure}` : ''}
                        {cLate && !cDone ? ' · en retard' : ''}
                      </Text>
                    )}
                  </Pressable>
                  {c.type === 'appel' && !!c.telephone && (
                    <Pressable onPress={() => callNumber(c.telephone)} hitSlop={6} accessibilityLabel={`Appeler le ${c.telephone}`}>
                      <Text style={styles.call}>📞</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
            {onAddSubtask && (
              <TextInput
                style={styles.subInput}
                placeholder="+ Sous-tâche"
                placeholderTextColor={colors.muted}
                value={quick}
                onChangeText={setQuick}
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  const t = quick.trim();
                  if (!t) return;
                  onAddSubtask(item, t);
                  setQuick('');
                }}
              />
            )}
          </View>
        )}
      </View>
      {!!item.sousTotal && (
        <Pressable
          onPress={() => onToggleExpand?.(item.id, !!expanded)}
          hitSlop={8}
          style={[styles.expand, expanded && styles.expandOpen]}
          accessibilityRole="button"
          accessibilityState={{ expanded: !!expanded }}
          accessibilityLabel={`${expanded ? 'Replier' : 'Déplier'} les sous-tâches de ${item.titre}`}
        >
          <Text style={[styles.expandText, item.sousFaites === item.sousTotal && { color: colors.success }]}>
            {item.alertePoints ? '⚠ ' : ''}
            {expanded ? '▾' : '▸'} {item.sousFaites}/{item.sousTotal}
          </Text>
        </Pressable>
      )}
      {item.priorite !== 'normale' && !done && (
        <View style={[styles.prio, { backgroundColor: prioriteColors[item.priorite] }]} />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  call: { fontSize: 12.5, fontWeight: '700', color: '#00897B', textDecorationLine: 'underline' },
  cardOpen: { alignItems: 'flex-start' },
  checkOpen: { marginTop: 18 },
  subs: { marginTop: 8, gap: 2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  subCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  subMark: { color: '#fff', fontSize: 11, fontWeight: '800' },
  subBody: { flex: 1, minWidth: 0 },
  subTitle: { fontSize: 14.5, color: colors.text },
  subMeta: { fontSize: 12, color: colors.muted },
  lateText: { color: colors.danger, fontWeight: '600' },
  subInput: { marginTop: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14, color: colors.text },
  expand: { alignSelf: 'flex-start', marginTop: 12, marginRight: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#EEF1F6' },
  expandOpen: { backgroundColor: '#E8F0FE' },
  expandText: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    overflow: 'hidden',
    minHeight: 64,
  },
  stripe: { width: 4, alignSelf: 'stretch' },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.muted,
    marginHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { color: '#fff', fontWeight: '700' },
  body: { flex: 1, paddingVertical: 10, paddingRight: 12 },
  title: { fontSize: 16, color: colors.text, fontWeight: '500' },
  titleDone: { textDecorationLine: 'line-through', color: colors.muted },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  metaText: { fontSize: 13, color: colors.muted, flexShrink: 1 },
  badge: { fontSize: 13, fontWeight: '600' },
  epic: {
    fontSize: 12,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    overflow: 'hidden',
    maxWidth: 160,
  },
  points: { fontSize: 12, fontWeight: '700', color: colors.muted, backgroundColor: '#EEF1F6', borderRadius: 8, paddingHorizontal: 6, overflow: 'hidden' },
  enCours: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  late: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  espace: { fontSize: 12, color: colors.text, backgroundColor: '#EEF0F3', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  finLabel: { color: colors.warning, fontWeight: '700' },
  prio: { width: 8, height: 8, borderRadius: 4, marginRight: 14 },
});
