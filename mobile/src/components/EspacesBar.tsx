import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type Espace, ICONE_ESPACE, libelleEspace, type TypeEspace, useEspaces } from '../espaces';
import { colors } from '../theme';
import { TexteAjuste } from './TexteAjuste';

/**
 * Espaces de travail repliés : une pastille dans la barre, juste après « President » :
 * « 🔒 Moi · 👥 Mobile ② ▾ » (la toucher déplie la carte dessous ; ▴ la replie). Noms longs coupés « … ».
 */
export function EspacesPastille({ plie, onPlier }: { plie: boolean; onPlier: () => void }) {
  const { liste, visibles } = useEspaces();
  const [zone, setZone] = useState(0);
  const affiches = liste.filter((e) => visibles.includes(e.id));
  const noms = affiches.map((e) => `${ICONE_ESPACE[e.type]} ${libelleEspace(e)}`);
  // Jamais coupé « … » : le texte rapetisse, puis les derniers noms deviennent « +N »
  const variantes = noms.map((_, i) => noms.slice(0, noms.length - i).join(' · ') + (i ? ` +${i}` : ''));
  return (
    <View style={s.zone} onLayout={(e) => setZone(e.nativeEvent.layout.width)}>
      <Pressable
        onPress={onPlier}
        style={s.pastille}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${plie ? 'Déplier' : 'Replier'} les espaces de travail`}
        accessibilityHint={noms.join(', ')}
      >
        <TexteAjuste variantes={variantes} taille={12.5} min={10} dispo={zone ? zone - FIXE_PASTILLE : null} style={s.noms} />
        <View style={s.nb}>
          <Text style={s.nbText}>{affiches.length}</Text>
        </View>
        <Text style={s.chevron}>{plie ? '▾' : '▴'}</Text>
      </Pressable>
    </View>
  );
}
/** Pastille des espaces : marges, nombre et chevron (ce qui n'est pas le texte des noms) */
const FIXE_PASTILLE = 11 + 8 + 6 + 18 + 6 + 14 + 2;

/**
 * Carte des espaces de travail, dépliée sous la barre (la pastille de la barre la replie) : petit filtre
 * Tous · 👥 · 🏢 (seulement s'il y a à la fois des équipes et des entreprises), pilule ＋ | − (ajouter ou
 * récupérer / retirer ou supprimer), puis les espaces : un ou plusieurs affichés (au moins un). Appui long sur un
 * espace : raccourci Retirer / Supprimer.
 */
export function EspacesBar({
  plie,
  onChange,
  onAjouter,
  onEnlever,
  onOuvrir,
}: {
  /** Replié : la carte disparaît, il reste la pastille de la barre */
  plie: boolean;
  onChange: (visibles: string[]) => void;
  /** ＋ : créer un espace (avec ses domaines), rétablir un espace retiré, restaurer un espace de la corbeille */
  onAjouter: () => void;
  /** − : retirer ou supprimer un espace */
  onEnlever: () => void;
  /** Appui long sur un espace (sauf Moi) : sa fiche (retirer, supprimer) — raccourci */
  onOuvrir: (e: Espace) => void;
}) {
  const { liste, visibles } = useEspaces();
  const [type, setType] = useState<'tous' | TypeEspace>('tous');
  /** Ligne du titre : largeurs mesurées (ligne, filtre par type, ＋ | −) pour ajuster la taille du titre */
  const [largeurs, setLargeurs] = useState({ ligne: 0, types: 0, pilule: 0 });
  // Le filtre par type n'a de sens que s'il y a à la fois des équipes et des entreprises
  const avecFiltre = liste.some((e) => e.type === 'equipe') && liste.some((e) => e.type === 'entreprise');
  const filtre = avecFiltre ? type : 'tous';
  const montres = liste.filter((e) => e.type === 'moi' || filtre === 'tous' || e.type === filtre);
  const basculer = (id: string) => {
    const on = visibles.includes(id);
    if (on && visibles.length === 1) return; // au moins un espace affiché
    onChange(on ? visibles.filter((v) => v !== id) : liste.map((e) => e.id).filter((v) => v === id || visibles.includes(v)));
  };
  if (plie) return null;
  return (
    <View style={s.carte}>
        <View style={s.corps}>
          <View style={s.outils} onLayout={(e) => setLargeurs((l) => ({ ...l, ligne: e.nativeEvent.layout.width }))}>
            {/* Ouverte, la carte garde son titre (jamais coupé : il rapetisse si la place manque) */}
            <TexteAjuste
              variantes={['ESPACES DE TRAVAIL']}
              taille={11}
              min={8}
              dispo={largeurs.ligne ? largeurs.ligne - 22 - (avecFiltre ? largeurs.types + 8 : 0) - largeurs.pilule - 8 : null}
              style={s.titre}
            />
            {avecFiltre && (
              <View style={s.types} onLayout={(e) => setLargeurs((l) => ({ ...l, types: e.nativeEvent.layout.width }))}>
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
            )}
            <View style={[s.pilule, s.droite]} onLayout={(e) => setLargeurs((l) => ({ ...l, pilule: e.nativeEvent.layout.width }))}>
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
                  <Text style={[s.chipText, on && s.chipTextOn]} numberOfLines={1}>
                    {ICONE_ESPACE[e.type]} {libelleEspace(e)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
    </View>
  );
}

const s = StyleSheet.create({
  carte: { marginHorizontal: 12, marginTop: 6, marginBottom: 8, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexShrink: 0 },
  zone: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  pastille: { flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingLeft: 11, paddingRight: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  noms: { fontSize: 12.5, fontWeight: '600', color: colors.text },
  nb: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  nbText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  chevron: { width: 14, textAlign: 'center', fontSize: 11, color: colors.muted },
  corps: { paddingTop: 8, paddingBottom: 10 },
  outils: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 10, marginBottom: 8 },
  titre: { fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 0.7 },
  droite: { marginLeft: 'auto' },
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
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
});
