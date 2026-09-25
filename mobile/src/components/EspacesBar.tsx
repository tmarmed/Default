import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ICONE_ESPACE, libelleEspace, useEspaces } from '../espaces';
import { colors } from '../theme';

/**
 * Filtre des espaces, en haut de l'application : un ou plusieurs espaces affichés (au moins un),
 * « + Espace » pour créer ou ajouter un espace et, à droite, le compte Google (rond avec l'initiale).
 */
export function EspacesBar({
  onChange,
  onGerer,
  compte,
}: {
  onChange: (visibles: string[]) => void;
  onGerer: () => void;
  /** Compte Google connecté (rien dans la démo) */
  compte?: { email: string; onPress: () => void };
}) {
  const { liste, visibles } = useEspaces();
  const basculer = (id: string) => {
    const on = visibles.includes(id);
    if (on && visibles.length === 1) return; // au moins un espace affiché
    onChange(on ? visibles.filter((v) => v !== id) : liste.map((e) => e.id).filter((v) => v === id || visibles.includes(v)));
  };
  return (
    <View style={s.ligne}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row} style={s.bar}>
      {liste.map((e) => {
        const on = visibles.includes(e.id);
        return (
          <Pressable
            key={e.id}
            onPress={() => basculer(e.id)}
            style={[s.chip, on && s.chipOn]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`Espace ${libelleEspace(e)}`}
          >
            <Text style={[s.chipText, on && s.chipTextOn]}>
              {ICONE_ESPACE[e.type]} {libelleEspace(e)}
            </Text>
          </Pressable>
        );
      })}
      <Pressable onPress={onGerer} style={s.add} accessibilityRole="button" accessibilityLabel="Créer ou ajouter un espace">
        <Text style={s.addText}>＋ Espace</Text>
      </Pressable>
    </ScrollView>
      {compte && (
        <Pressable onPress={compte.onPress} style={s.avatar} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Compte Google ${compte.email}`}>
          <Text style={s.avatarText}>{compte.email.charAt(0).toUpperCase()}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  bar: { flexGrow: 1, flexShrink: 1 },
  row: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  add: { paddingHorizontal: 10, paddingVertical: 6 },
  addText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 16,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
