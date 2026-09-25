import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ICONE_ESPACE, libelleEspace, useEspaces } from '../espaces';
import { colors } from '../theme';

/**
 * Filtre des espaces, en haut de l'application : un ou plusieurs espaces affichés (au moins un),
 * et « + Espace » pour créer ou ajouter un espace.
 */
export function EspacesBar({ onChange, onGerer }: { onChange: (visibles: string[]) => void; onGerer: () => void }) {
  const { liste, visibles } = useEspaces();
  const basculer = (id: string) => {
    const on = visibles.includes(id);
    if (on && visibles.length === 1) return; // au moins un espace affiché
    onChange(on ? visibles.filter((v) => v !== id) : liste.map((e) => e.id).filter((v) => v === id || visibles.includes(v)));
  };
  return (
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
  );
}

const s = StyleSheet.create({
  bar: { flexGrow: 0 },
  row: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  add: { paddingHorizontal: 10, paddingVertical: 6 },
  addText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
});
