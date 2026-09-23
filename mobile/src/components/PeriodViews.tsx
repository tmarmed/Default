import { ReactElement } from 'react';
import { Pressable, RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addDays, JOURS_COURTS, startOfWeek, toDateString } from '../dates';
import { colors, typeColors } from '../theme';
import type { Item } from '../types';
import { TaskItem } from './TaskItem';

interface Common {
  /** Date sélectionnée */
  date: Date;
  byDate: Map<string, Item[]>;
  onPress: (item: Item) => void;
  onToggle: (item: Item) => void;
  refreshControl: ReactElement<RefreshControlProps>;
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

/** Éléments répétés « dans la période » (sans jour précis). */
function Band({ items, title, onPress, onToggle }: { items: Item[]; title: string } & Pick<Common, 'onPress' | 'onToggle'>) {
  if (!items.length) return null;
  return (
    <View style={styles.band}>
      <Text style={styles.bandTitle}>🔁 {title}</Text>
      <ItemList items={items} onPress={onPress} onToggle={onToggle} />
    </View>
  );
}

function ItemList({ items, onPress, onToggle }: { items: Item[] } & Pick<Common, 'onPress' | 'onToggle'>) {
  return (
    <>
      {items.map((item) => (
        <TaskItem key={item.id} item={item} onPress={onPress} onToggle={onToggle} />
      ))}
    </>
  );
}

// ---------- Jour ----------

export function DayView({ date, byDate, onPress, onToggle, refreshControl }: Common) {
  const items = byDate.get(toDateString(date)) ?? [];
  return (
    <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
      {items.length ? (
        <ItemList items={items} onPress={onPress} onToggle={onToggle} />
      ) : (
        <Empty text="Rien de prévu ce jour-là." />
      )}
    </ScrollView>
  );
}

// ---------- Semaine ----------

export function WeekView({
  date,
  byDate,
  onPress,
  onToggle,
  refreshControl,
  onOpenDay,
  band,
}: Common & { onOpenDay: (d: Date) => void; band: Item[] }) {
  const today = toDateString(new Date());
  const start = startOfWeek(date);
  return (
    <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
      <Band items={band} title="À faire sur la période" onPress={onPress} onToggle={onToggle} />
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i);
        const key = toDateString(d);
        const items = byDate.get(key) ?? [];
        const isToday = key === today;
        return (
          <View key={key}>
            <Pressable style={styles.dayHeader} onPress={() => onOpenDay(d)} hitSlop={4}>
              <Text style={[styles.dayName, isToday && styles.todayText]}>{JOURS_COURTS[i]}</Text>
              <View style={[styles.dayNum, isToday && styles.todayBubble]}>
                <Text style={[styles.dayNumText, isToday && styles.todayBubbleText]}>{d.getDate()}</Text>
              </View>
              {items.length > 0 && <Text style={styles.count}>{items.length}</Text>}
            </Pressable>
            {items.length ? (
              <ItemList items={items} onPress={onPress} onToggle={onToggle} />
            ) : (
              <Text style={styles.none}>—</Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ---------- Mois ----------

export function MonthView({
  date,
  byDate,
  onPress,
  onToggle,
  refreshControl,
  onSelect,
  band,
}: Common & { onSelect: (d: Date) => void; band: Item[] }) {
  const today = toDateString(new Date());
  const selected = toDateString(date);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil(((first.getDay() + 6) % 7 + daysInMonth) / 7);
  const selectedItems = byDate.get(selected) ?? [];

  return (
    <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
      <Band items={band} title="À faire ce mois-ci" onPress={onPress} onToggle={onToggle} />
      <View style={styles.grid}>
        <View style={styles.week}>
          {JOURS_COURTS.map((j) => (
            <Text key={j} style={styles.weekday}>
              {j.slice(0, 1).toUpperCase()}
            </Text>
          ))}
        </View>
        {Array.from({ length: weeks }, (_, w) => (
          <View key={w} style={styles.week}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(gridStart, w * 7 + i);
              const key = toDateString(d);
              const items = byDate.get(key) ?? [];
              const outside = d.getMonth() !== date.getMonth();
              const isSelected = key === selected;
              const isToday = key === today;
              return (
                <Pressable
                  key={key}
                  style={[styles.cell, isSelected && styles.cellSelected]}
                  onPress={() => onSelect(d)}
                  accessibilityLabel={`${d.getDate()}, ${items.length} élément(s)`}
                >
                  <View style={[styles.cellNum, isToday && styles.todayBubble]}>
                    <Text
                      style={[
                        styles.cellText,
                        outside && styles.outside,
                        isToday && styles.todayBubbleText,
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    {items.slice(0, 3).map((it) => (
                      <View
                        key={it.id}
                        style={[
                          styles.dot,
                          { backgroundColor: typeColors[it.type] },
                          it.statut === 'termine' && styles.dotDone,
                        ]}
                      />
                    ))}
                    {items.length > 3 && <Text style={styles.more}>+</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {selectedItems.length ? (
        <ItemList items={selectedItems} onPress={onPress} onToggle={onToggle} />
      ) : (
        <Empty text="Rien de prévu ce jour-là." />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 110 },
  band: { marginTop: 4, marginBottom: 8 },
  bandTitle: {
    marginHorizontal: 16,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 15 },
  none: { marginHorizontal: 28, marginBottom: 6, color: colors.border, fontSize: 15 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, marginBottom: 6, gap: 8 },
  dayName: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', width: 36 },
  dayNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayNumText: { fontSize: 15, fontWeight: '600', color: colors.text },
  count: { marginLeft: 'auto', fontSize: 12, color: colors.muted },
  todayText: { color: colors.primary },
  todayBubble: { backgroundColor: colors.primary },
  todayBubbleText: { color: '#fff', fontWeight: '700' },
  grid: { marginHorizontal: 12, marginBottom: 12, backgroundColor: colors.card, borderRadius: 12, padding: 6 },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.muted, paddingVertical: 6 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 10, minHeight: 50 },
  cellSelected: { backgroundColor: '#E8F0FE' },
  cellNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 15, color: colors.text },
  outside: { color: '#B8BFCA' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 10, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotDone: { opacity: 0.35 },
  more: { fontSize: 10, lineHeight: 10, color: colors.muted },
});
