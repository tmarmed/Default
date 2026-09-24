import { memo } from 'react';
import { domaineOf } from '../hierarchy';
import { useHierarchy } from '../hierarchyContext';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isOverdue } from '../dates';
import { colors, prioriteColors, typeColors } from '../theme';
import { Item, STATUT_LABELS, TYPE_ICONS, TYPE_LABELS } from '../types';

interface Props {
  item: Item;
  onPress: (item: Item) => void;
  onToggle: (item: Item) => void;
}

export const TaskItem = memo(function TaskItem({ item, onPress, onToggle }: Props) {
  const done = item.statut === 'termine';
  const h = useHierarchy();
  // Rattachement le plus précis affiché en étiquette, précédé de l'icône du domaine.
  const parent = h.epics.get(item.epic) ?? h.objectifs.get(item.objectif);
  const domaine = domaineOf(item, h);
  const late = isOverdue(item);
  return (
    <Pressable style={styles.card} onPress={() => onPress(item)}>
      <View style={[styles.stripe, { backgroundColor: typeColors[item.type] }]} />
      <Pressable
        onPress={() => onToggle(item)}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? 'Marquer à faire' : 'Marquer terminé'}
        style={[styles.check, done && styles.checkDone]}
      >
        {done && <Text style={styles.checkMark}>✓</Text>}
      </Pressable>
      <View style={styles.body}>
        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
          {item.titre}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.badge, { color: typeColors[item.type] }]}>
            {TYPE_ICONS[item.type]} {TYPE_LABELS[item.type]}
          </Text>
          {!!item.heure && <Text style={styles.metaText}>🕒 {item.heure}</Text>}
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
              style={[styles.epic, { color: (parent ?? domaine)!.couleur, borderColor: (parent ?? domaine)!.couleur }]}
              numberOfLines={1}
            >
              {domaine ? `${domaine.icone} ` : ''}
              {parent ? parent.titre : domaine!.nom}
            </Text>
          )}
          {item.statut === 'en_cours' && <Text style={styles.enCours}>{STATUT_LABELS.en_cours}</Text>}
          {item.retards ? (
            <Text style={styles.late}>
              🔁 En retard : {item.retards.join(', ')}
            </Text>
          ) : (
            late && <Text style={styles.late}>En retard</Text>
          )}
        </View>
      </View>
      {item.priorite !== 'normale' && !done && (
        <View style={[styles.prio, { backgroundColor: prioriteColors[item.priorite] }]} />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
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
  enCours: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  late: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  prio: { width: 8, height: 8, borderRadius: 4, marginRight: 14 },
});
