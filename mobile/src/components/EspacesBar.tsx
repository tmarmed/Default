import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type Espace, ICONE_ESPACE, libelleEspace, type TypeEspace, useEspaces } from '../espaces';
import { colors } from '../theme';

const PLIE_KEY = 'president:espaces-plie';

/**
 * Carte des espaces, sous la barre « President ». Sa première ligne ne change jamais : « ESPACES 🔒 Moi · 👥 Mobile ② ▾ »
 * (la toucher replie / déplie). Dépliée, la carte grandit vers le bas : petit filtre Tous · 👥 · 🏢 (seulement s'il y a
 * à la fois des équipes et des entreprises), pilule ＋ | − (ajouter ou récupérer / retirer ou supprimer), puis les
 * espaces : un ou plusieurs affichés (au moins un). Appui long sur un espace : raccourci Retirer / Supprimer.
 */
export function EspacesBar({
  onChange,
  onAjouter,
  onEnlever,
  onOuvrir,
}: {
  onChange: (visibles: string[]) => void;
  /** ＋ : créer un espace (avec ses domaines), rétablir un espace retiré, restaurer un espace de la corbeille */
  onAjouter: () => void;
  /** − : retirer ou supprimer un espace */
  onEnlever: () => void;
  /** Appui long sur un espace (sauf Moi) : sa fiche (retirer, supprimer) — raccourci */
  onOuvrir: (e: Espace) => void;
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
  return (
    <View style={s.carte}>
      {/* Première ligne : toujours la même, repliée comme dépliée (la toucher replie / déplie) */}
      <Pressable onPress={plier} style={s.tete} accessibilityRole="button" accessibilityLabel={plie ? 'Déplier les espaces de travail' : 'Replier les espaces de travail'}>
        <Text style={s.titre}>ESPACES DE TRAVAIL</Text>
        <Text style={s.noms} numberOfLines={1}>
          {affiches.map((e) => `${ICONE_ESPACE[e.type]} ${libelleEspace(e)}`).join(' · ')}
        </Text>
        <View style={s.nb}>
          <Text style={s.nbText}>{affiches.length}</Text>
        </View>
        <Text style={s.chevron}>{plie ? '▾' : '▴'}</Text>
      </Pressable>
      {!plie && (
        <View style={s.corps}>
          <View style={s.outils}>
            {avecFiltre ? (
              <View style={s.types}>
                {(['tous', 'equipe', 'entreprise'] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={[s.type, filtre === t && s.typeOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filtre === t }}
                    accessibilityLabel={t === 'tous' ? 'Tous les espaces de travail' : t === 'equipe' ? 'Équipes seulement' : 'Entreprises seulement'}
                  >
                    <Text style={[s.typeText, filtre === t && s.typeTextOn]}>{t === 'tous' ? 'Tous' : ICONE_ESPACE[t]}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View />
            )}
            <View style={s.pilule}>
              <Pressable onPress={onAjouter} style={s.moitie} hitSlop={4} accessibilityRole="button" accessibilityLabel="Ajouter ou récupérer un espace de travail">
                <Text style={[s.signe, s.plus]}>＋</Text>
              </Pressable>
              <View style={s.sep} />
              <Pressable onPress={onEnlever} style={s.moitie} hitSlop={4} accessibilityRole="button" accessibilityLabel="Retirer ou supprimer un espace de travail">
                <Text style={[s.signe, s.moins]}>−</Text>
              </Pressable>
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
                  accessibilityLabel={`Espace de travail ${libelleEspace(e)}`}
                  accessibilityHint={e.id === 'moi' ? undefined : 'Appui long : retirer ou supprimer l’espace de travail'}
                >
                  <Text style={[s.chipText, on && s.chipTextOn]} numberOfLines={1} ellipsizeMode="tail">
                    {ICONE_ESPACE[e.type]} {libelleEspace(e)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  carte: { marginHorizontal: 12, marginTop: 6, marginBottom: 8, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexShrink: 0 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingLeft: 12, paddingRight: 10 },
  titre: { fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 0.7 },
  noms: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '600', color: colors.text },
  nb: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  nbText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  chevron: { width: 14, textAlign: 'center', fontSize: 11, color: colors.muted },
  corps: { borderTopWidth: 1, borderTopColor: '#EEF1F5', paddingTop: 8, paddingBottom: 10 },
  outils: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, marginBottom: 8 },
  types: { flexDirection: 'row', backgroundColor: '#E6EAF0', borderRadius: 13, padding: 2 },
  type: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 11 },
  typeOn: { backgroundColor: colors.card },
  typeText: { fontSize: 11.5, fontWeight: '800', color: colors.muted },
  typeTextOn: { color: colors.text },
  pilule: { flexDirection: 'row', alignItems: 'center', height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden' },
  moitie: { height: '100%', paddingHorizontal: 10, justifyContent: 'center' },
  sep: { width: 1, height: '100%', backgroundColor: '#EEF1F5' },
  signe: { fontSize: 16, fontWeight: '800', lineHeight: 20 },
  plus: { color: colors.primary },
  moins: { color: colors.danger },
  puces: { flexGrow: 0 },
  // Fondu à droite (navigateur) : d'autres espaces suivent
  fondu: { maskImage: 'linear-gradient(90deg, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, #000 88%, transparent)' } as never,
  row: { paddingLeft: 10, paddingRight: 44, gap: 6, alignItems: 'center' },
  chip: { maxWidth: 170, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
});
