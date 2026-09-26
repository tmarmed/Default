import { type ReactNode, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type Espace, ICONE_ESPACE, libelleEspace, type TypeEspace, useEspaces } from '../espaces';
import { colors } from '../theme';

const PLIE_KEY = 'president:espaces-plie';

/**
 * Haut de l'écran : les espaces (et, à droite, le compte). Replié : une seule ligne « ESPACES 🔒 Moi · 👥 Mobile ② ▾ »
 * (on la touche pour déplier). Déplié : petit filtre Tous · 👥 · 🏢 (seulement s'il y a à la fois des équipes et des
 * entreprises), pilule ＋ | − (ajouter ou récupérer / retirer ou supprimer), ▴ (replier), puis les espaces : un ou
 * plusieurs affichés (au moins un). Appui long sur un espace : raccourci Retirer / Supprimer.
 */
export function EspacesBar({
  onChange,
  onAjouter,
  onEnlever,
  onOuvrir,
  droite,
}: {
  onChange: (visibles: string[]) => void;
  /** ＋ : créer un espace (avec ses domaines), rétablir un espace retiré, restaurer un espace de la corbeille */
  onAjouter: () => void;
  /** − : retirer ou supprimer un espace */
  onEnlever: () => void;
  /** Appui long sur un espace (sauf Moi) : sa fiche (retirer, supprimer) — raccourci */
  onOuvrir: (e: Espace) => void;
  /** À droite, dans les deux états : le compte (ou, en démo, réinitialiser) */
  droite?: ReactNode;
}) {
  const { liste, visibles } = useEspaces();
  const [plie, setPlie] = useState(false);
  const [type, setType] = useState<'tous' | TypeEspace>('tous');
  useEffect(() => {
    AsyncStorage.getItem(PLIE_KEY)
      .then((v) => setPlie(v === '1'))
      .catch(() => {});
  }, []);
  const plier = () => {
    setPlie((p) => {
      AsyncStorage.setItem(PLIE_KEY, p ? '0' : '1').catch(() => {});
      return !p;
    });
  };
  // Le filtre par type n'a de sens que s'il y a à la fois des équipes et des entreprises
  const avecFiltre = liste.some((e) => e.type === 'equipe') && liste.some((e) => e.type === 'entreprise');
  const filtre = avecFiltre ? type : 'tous';
  const montres = liste.filter((e) => e.type === 'moi' || filtre === 'tous' || e.type === filtre);
  const basculer = (id: string) => {
    const on = visibles.includes(id);
    if (on && visibles.length === 1) return; // au moins un espace affiché
    onChange(on ? visibles.filter((v) => v !== id) : liste.map((e) => e.id).filter((v) => v === id || visibles.includes(v)));
  };
  const affiches = liste.filter((e) => visibles.includes(e.id));
  if (plie)
    return (
      <View style={s.ligneHaut}>
        <Pressable onPress={plier} style={s.ligne} accessibilityRole="button" accessibilityLabel="Déplier les espaces">
          <Text style={s.titre}>ESPACES</Text>
          <Text style={s.noms} numberOfLines={1}>
            {affiches.map((e) => `${ICONE_ESPACE[e.type]} ${libelleEspace(e)}`).join(' · ')}
          </Text>
          <View style={s.nb}>
            <Text style={s.nbText}>{affiches.length}</Text>
          </View>
          <Text style={s.chevron}>▾</Text>
        </Pressable>
        {droite}
      </View>
    );
  return (
    <View style={s.bloc}>
      <View style={s.tete}>
        <Text style={s.titre}>ESPACES</Text>
        {avecFiltre && (
          <View style={s.types}>
            {(['tous', 'equipe', 'entreprise'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[s.type, filtre === t && s.typeOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: filtre === t }}
                accessibilityLabel={t === 'tous' ? 'Tous les espaces' : t === 'equipe' ? 'Équipes seulement' : 'Entreprises seulement'}
              >
                <Text style={[s.typeText, filtre === t && s.typeTextOn]}>{t === 'tous' ? 'Tous' : ICONE_ESPACE[t]}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={s.actions}>
          <View style={s.pilule}>
            <Pressable onPress={onAjouter} style={s.moitie} hitSlop={4} accessibilityRole="button" accessibilityLabel="Ajouter ou récupérer un espace">
              <Text style={[s.signe, s.plus]}>＋</Text>
            </Pressable>
            <View style={s.sep} />
            <Pressable onPress={onEnlever} style={s.moitie} hitSlop={4} accessibilityRole="button" accessibilityLabel="Retirer ou supprimer un espace">
              <Text style={[s.signe, s.moins]}>−</Text>
            </Pressable>
          </View>
          <Pressable onPress={plier} style={s.rond} hitSlop={6} accessibilityRole="button" accessibilityLabel="Replier les espaces">
            <Text style={s.chevron}>▴</Text>
          </Pressable>
          {droite}
        </View>
      </View>
      <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          style={[s.puces, Platform.OS === 'web' && (s.fondu as object)]}
        >
          {montres.map((e) => {
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
  ligneHaut: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 8, marginBottom: 8, flexShrink: 0 },
  ligne: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  noms: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '600', color: colors.text },
  nb: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  nbText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  bloc: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  tete: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, minHeight: 30 },
  titre: { fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 0.7 },
  types: { flexDirection: 'row', backgroundColor: '#E6EAF0', borderRadius: 13, padding: 2 },
  type: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 11 },
  typeOn: { backgroundColor: colors.card },
  typeText: { fontSize: 11.5, fontWeight: '800', color: colors.muted },
  typeTextOn: { color: colors.text },
  actions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  pilule: { flexDirection: 'row', alignItems: 'center', height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden' },
  moitie: { height: '100%', paddingHorizontal: 10, justifyContent: 'center' },
  sep: { width: 1, height: '100%', backgroundColor: '#EEF1F5' },
  signe: { fontSize: 16, fontWeight: '800', lineHeight: 20 },
  plus: { color: colors.primary },
  moins: { color: colors.danger },
  rond: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  chevron: { fontSize: 12, color: colors.muted },
  puces: { flexGrow: 0, marginTop: 9 },
  // Fondu à droite (navigateur) : d'autres espaces suivent
  fondu: { maskImage: 'linear-gradient(90deg, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, #000 88%, transparent)' } as never,
  row: { paddingLeft: 10, paddingRight: 44, gap: 6, alignItems: 'center' },
  chip: { maxWidth: 170, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
});
