import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type Espace, ICONE_ESPACE, libelleEspace, useEspaces } from '../espaces';
import { colors } from '../theme';

/**
 * Bloc « Espaces », sous la barre de l'application : un ou plusieurs espaces affichés (au moins un), « ＋ » pour
 * créer un espace, « ⋯ » pour les gérer (retirer, supprimer, rétablir, restaurer), appui long sur un espace pour
 * le retirer ou le supprimer. Les noms longs sont coupés « … » ; au-delà de la largeur, la ligne défile.
 */
export function EspacesBar({
  onChange,
  onGerer,
  onGestion,
  onOuvrir,
}: {
  onChange: (visibles: string[]) => void;
  /** « ＋ » : créer un espace */
  onGerer: () => void;
  /** « ⋯ » : mes espaces, retirés, corbeille */
  onGestion: () => void;
  /** Appui long sur un espace (sauf Moi) : sa fiche (retirer, supprimer) — raccourci */
  onOuvrir: (e: Espace) => void;
}) {
  const { liste, visibles } = useEspaces();
  const basculer = (id: string) => {
    const on = visibles.includes(id);
    if (on && visibles.length === 1) return; // au moins un espace affiché
    onChange(on ? visibles.filter((v) => v !== id) : liste.map((e) => e.id).filter((v) => v === id || visibles.includes(v)));
  };
  return (
    <View style={s.bloc}>
      <View style={s.tete}>
        <Text style={s.titre}>ESPACES</Text>
        <View style={s.actions}>
          <Pressable onPress={onGerer} style={s.mini} hitSlop={6} accessibilityRole="button" accessibilityLabel="Créer un espace">
            <Text style={[s.miniText, s.miniPlus]}>＋</Text>
          </Pressable>
          <Pressable onPress={onGestion} style={s.mini} hitSlop={6} accessibilityRole="button" accessibilityLabel="Gérer les espaces">
            <Text style={s.miniText}>⋯</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
        style={[s.puces, Platform.OS === 'web' && (s.fondu as object)]}
      >
        {liste.map((e) => {
          const on = visibles.includes(e.id);
          return (
            <Pressable
              key={e.id}
              onPress={() => basculer(e.id)}
              onLongPress={e.id === 'moi' ? undefined : () => onOuvrir(e)}
              delayLongPress={450}
              style={[s.chip, on && s.chipOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`Espace ${libelleEspace(e)}`}
              accessibilityHint={e.id === 'moi' ? undefined : 'Appui long : retirer ou supprimer l’espace'}
            >
              <Text style={[s.chipText, on && s.chipTextOn]} numberOfLines={1} ellipsizeMode="tail">
                {ICONE_ESPACE[e.type]} {libelleEspace(e)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 8,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexShrink: 0,
  },
  tete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 6 },
  titre: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.6 },
  actions: { flexDirection: 'row', gap: 6 },
  mini: { minWidth: 30, height: 24, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  miniText: { fontSize: 14, lineHeight: 16, fontWeight: '700', color: colors.text },
  miniPlus: { color: colors.primary },
  puces: { flexGrow: 0 },
  // Fondu à droite (navigateur) : d'autres espaces suivent
  fondu: { maskImage: 'linear-gradient(90deg, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, #000 88%, transparent)' } as never,
  row: { paddingLeft: 10, paddingRight: 44, gap: 6, alignItems: 'center' },
  chip: { maxWidth: 170, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
});
