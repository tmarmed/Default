import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

export interface PickOption {
  id: string;
  title: string;
  /** Où il se trouve aujourd'hui (epic, PI, itération…) */
  sub?: string;
}

interface Props {
  options: PickOption[];
  onPick: (id: string) => void;
  /** Texte quand il n'y a rien à proposer */
  empty: string;
  /** Hauteur maximale de la liste (dans une fiche) */
  maxHeight?: number;
}

/** Choisir un élément existant : recherche + liste ; chaque appui choisit un élément (plusieurs possibles). */
export function ItemPicker({ options, onPick, empty, maxHeight }: Props) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = options.filter((o) => !query || `${o.title} ${o.sub ?? ''}`.toLowerCase().includes(query));
  return (
    <View style={s.box}>
      <TextInput style={s.search} placeholder="Rechercher…" placeholderTextColor={colors.muted} value={q} onChangeText={setQ} />
      <ScrollView style={maxHeight ? { maxHeight } : undefined} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {shown.length === 0 && <Text style={s.empty}>{options.length ? 'Aucun résultat.' : empty}</Text>}
        {shown.map((o) => (
          <Pressable key={o.id} style={s.row} onPress={() => onPick(o.id)} accessibilityRole="button" accessibilityLabel={`Choisir ${o.title}`}>
            <View style={s.flex}>
              <Text style={s.title} numberOfLines={2}>
                {o.title}
              </Text>
              {!!o.sub && (
                <Text style={s.sub} numberOfLines={1}>
                  {o.sub}
                </Text>
              )}
            </View>
            <Text style={s.plus}>＋</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Même chose, dans une fenêtre (écran PI). */
export function PickerModal({
  visible,
  title,
  hint,
  onClose,
  ...picker
}: Props & { visible: boolean; title: string; hint?: string; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={s.header}>
          <View style={{ width: 60 }} />
          <Text style={s.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={s.headerBtn}>Terminé</Text>
          </Pressable>
        </View>
        <View style={s.content}>
          {!!hint && <Text style={s.hint}>{hint}</Text>}
          <ItemPicker {...picker} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text, flexShrink: 1 },
  headerBtn: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  content: { flex: 1, padding: 16, gap: 10 },
  hint: { fontSize: 13.5, lineHeight: 19, color: colors.muted },
  box: { flexShrink: 1, gap: 8 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  plus: { fontSize: 18, color: colors.primary, fontWeight: '700' },
  empty: { fontSize: 13.5, color: colors.muted, paddingVertical: 8 },
});
