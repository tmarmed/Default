import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface Props {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
  /** Bouton à droite de la ligne (ex. « Tout replier » de la Roadmap) : « ‹ Titre › » passe alors à gauche */
  action?: ReactNode;
}

/** ‹ Titre de la période › — les flèches doublent le geste de glissement. */
export function PeriodHeader({ title, onPrev, onNext, onToday, action }: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPrev} hitSlop={12} accessibilityLabel="Période précédente" style={styles.arrow}>
        <Text style={styles.arrowText}>‹</Text>
      </Pressable>
      <Text style={[styles.title, !!action && styles.titleGauche]} numberOfLines={1}>
        {title}
      </Text>
      <Pressable onPress={onNext} hitSlop={12} accessibilityLabel="Période suivante" style={styles.arrow}>
        <Text style={styles.arrowText}>›</Text>
      </Pressable>
      {/* Toujours présent (invisible sur la période en cours) pour que le titre ne bouge pas. */}
      <Pressable
        onPress={onToday}
        disabled={!onToday}
        hitSlop={8}
        style={[styles.today, !onToday && styles.hidden]}
        accessibilityElementsHidden={!onToday}
        importantForAccessibility={onToday ? 'auto' : 'no-hide-descendants'}
      >
        <Text style={styles.todayText}>Aujourd'hui</Text>
      </Pressable>
      {!!action && (
        <>
          <View style={styles.espace} />
          {action}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  arrow: { paddingHorizontal: 10 },
  arrowText: { fontSize: 30, lineHeight: 32, color: colors.primary },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.text },
  today: {
    marginLeft: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  titleGauche: { flex: 0, minWidth: 48 },
  espace: { flex: 1 },
  hidden: { opacity: 0 },
  todayText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});
