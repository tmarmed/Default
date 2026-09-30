import type { ReactElement } from 'react';
import { Pressable, type RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useHierarchy } from '../hierarchyContext';
import { useOrg } from '../organisation';
import { useMoi } from '../droits';
import { useSafe } from '../safe';
import { avancementOkr, droitsStrategie, epicsDeValueStream, epicsDirectesDeOkr, libelleTypeVs, resultatsDeOkr, valueStreamsDeOkr } from '../strategie';
import { colors } from '../theme';
import { idsDe, type Objectif, type ValueStream } from '../types';
import { useRecherche } from './DomainFilter';

interface Props {
  onOpenOkr: (o: Objectif) => void;
  onNouvelOkr: () => void;
  onOpenVs: (v: ValueStream) => void;
  onNouveauVs: () => void;
  refreshControl?: ReactElement<RefreshControlProps>;
}

/**
 * 🎯 Stratégie (lot 4) : les OKR (avec leurs résultats clés, value streams et epics) et, en SAFe, les value
 * streams. Tout le monde de l'entreprise lit ; l'Epic Owner crée et relie (le ＋ n'apparaît que pour lui).
 */
export function StrategieView({ onOpenOkr, onNouvelOkr, onOpenVs, onNouveauVs, refreshControl }: Props) {
  const h = useHierarchy();
  const org = useOrg();
  const moi = useMoi();
  const safe = useSafe();
  const cherche = useRecherche();
  const droits = droitsStrategie(moi, org);
  const okrs = h.objectifList.filter((o) => cherche(o.titre));
  const vs = h.valueStreams.filter((v) => cherche(v.nom));
  const nomsVs = (o: Objectif) => valueStreamsDeOkr(o.id, h.valueStreams).map((v) => v.nom);
  // Epics d'un OKR : directes, puis celles de ses value streams (affichées une fois)
  const nomsEpics = (o: Objectif) => {
    const directes = epicsDirectesDeOkr(o.id, h.epicList);
    const parVs = valueStreamsDeOkr(o.id, h.valueStreams).flatMap((v) => epicsDeValueStream(v.id, h.epicList));
    return [...new Map([...directes, ...parVs].map((e) => [e.id, e.titre])).values()];
  };

  return (
    <ScrollView contentContainerStyle={s.scroll} refreshControl={refreshControl}>
      <View style={s.entete}>
        <Text style={s.section}>OKR · {okrs.length}</Text>
        {droits.tout && (
          <Pressable onPress={onNouvelOkr} style={s.rond} hitSlop={8} accessibilityRole="button" accessibilityLabel="Nouvel OKR">
            <Text style={s.rondTexte}>＋</Text>
          </Pressable>
        )}
      </View>
      <View style={s.carte}>
        {okrs.map((o, i) => {
          const r = avancementOkr(o, h.resultats);
          const kr = resultatsDeOkr(o.id, h.resultats).length;
          const v = nomsVs(o), e = nomsEpics(o);
          return (
            <Pressable key={o.id} onPress={() => onOpenOkr(o)} style={[s.ligne, i > 0 && s.ligneBord]} accessibilityRole="button">
              <View style={s.corps}>
                <Text style={s.titre}>🎯 {o.titre}</Text>
                <Text style={s.meta}>
                  {kr} résultat{kr > 1 ? 's' : ''} clé{kr > 1 ? 's' : ''}
                  {safe.actif && v.length ? ` · 🌊 ${v.join(', ')}` : ''}
                </Text>
                {!!e.length && <Text style={s.meta}>🗂️ {e.join(', ')}</Text>}
                {r !== null && (
                  <View style={s.barre}>
                    <View style={[s.barreRemplie, { width: `${Math.round(r * 100)}%`, backgroundColor: o.couleur || colors.primary }]} />
                  </View>
                )}
              </View>
              <Text style={s.chev}>›</Text>
            </Pressable>
          );
        })}
        {!okrs.length && <Text style={s.vide}>Aucun OKR pour l'instant.</Text>}
      </View>

      {safe.actif && (
        <>
          <View style={s.entete}>
            <Text style={s.section}>Value streams · {vs.length}</Text>
            {droits.tout && (
              <Pressable onPress={onNouveauVs} style={s.rond} hitSlop={8} accessibilityRole="button" accessibilityLabel="Nouveau value stream">
                <Text style={s.rondTexte}>＋</Text>
              </Pressable>
            )}
          </View>
          <View style={s.carte}>
            {vs.map((v, i) => {
              const parts = [libelleTypeVs(v.type), v.portfolio ? `💼 ${org.portfolio.get(v.portfolio)?.nom ?? ''}` : '', ...idsDe(v.trains).map((t) => `🚆 ${org.train.get(t)?.nom ?? ''}`)].filter(Boolean);
              const n = epicsDeValueStream(v.id, h.epicList).length;
              return (
                <Pressable key={v.id} onPress={() => onOpenVs(v)} style={[s.ligne, i > 0 && s.ligneBord]} accessibilityRole="button">
                  <View style={s.corps}>
                    <Text style={s.titre}>🌊 {v.nom}</Text>
                    <Text style={s.meta}>{parts.join(' · ')}</Text>
                    <Text style={s.meta}>
                      {idsDe(v.okrs).length} OKR · {n} epic{n > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={s.chev}>›</Text>
                </Pressable>
              );
            })}
            {!vs.length && <Text style={s.vide}>Aucun value stream pour l'instant.</Text>}
          </View>
        </>
      )}
      {!droits.tout && <Text style={s.aide}>Lecture : l'Epic Owner du portfolio crée les OKR et les value streams.</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 130 },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  rond: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  rondTexte: { color: '#fff', fontSize: 17, fontWeight: '700', lineHeight: 20 },
  carte: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  corps: { flex: 1, gap: 3 },
  titre: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12.5, color: colors.muted },
  barre: { height: 5, borderRadius: 3, backgroundColor: '#E3E7EE', overflow: 'hidden', marginTop: 4 },
  barreRemplie: { height: '100%', borderRadius: 3 },
  chev: { fontSize: 18, color: '#A0A6B1' },
  vide: { padding: 14, color: colors.muted },
  aide: { marginHorizontal: 16, marginTop: 12, fontSize: 12.5, color: colors.muted },
});
