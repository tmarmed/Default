import { type ReactElement, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, PanResponder, Pressable, type RefreshControlProps, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useHierarchy } from '../hierarchyContext';
import { fmtPoints, iterationNom } from '../pi';
import { useOrg } from '../organisation';
import { useSafe } from '../safe';
import { colors } from '../theme';
import { type Epic, ETATS_EPIC, type Feature, idsDe, type Item } from '../types';
import { etatEpic } from '../safe';
import { toDateString } from '../dates';
import { LigneChoix } from './Choix';

type Niveau = 'epic' | 'feature' | 'tache';
interface Props {
  onOpenEpic: (e: Epic) => void;
  onOpenFeature: (f: Feature) => void;
  onOpenTask: (t: Item) => void;
  /** Nouvel ordre d'une colonne (glisser) : les rangs sont recalculés et enregistrés */
  onClasser: (niveau: Niveau, ids: string[]) => Promise<void>;
  refreshControl?: ReactElement<RefreshControlProps>;
}

/** Hauteur d'une carte + écart : un glissé de cette hauteur change la carte de place */
const PAS = 66;
const parRang = <T extends { rang?: string; titre: string }>(l: T[]) =>
  [...l].sort((a, b) => (a.rang ? +a.rang : 1e9) - (b.rang ? +b.rang : 1e9) || a.titre.localeCompare(b.titre));

/**
 * 📋 Backlog (lot 4) : les trois backlogs côte à côte — portfolio (epics), train (features), équipe (stories).
 * Toucher une epic ne garde que ses features (les autres en gris), toucher une feature ne garde que ses stories ;
 * toucher à nouveau enlève le filtre. Glisser une carte (poignée ⋮⋮) change sa priorité dans sa colonne. En haut,
 * un filtre par value stream. Sur téléphone : une colonne à la fois, avec un fil « Epic › Feature » pour revenir.
 */
export function BacklogView({ onOpenEpic, onOpenFeature, onOpenTask, onClasser, refreshControl }: Props) {
  const h = useHierarchy();
  const org = useOrg();
  const safe = useSafe();
  // Trois colonnes quand l'écran de l'application est assez large (mesuré, pas la fenêtre)
  const { width: fenetre } = useWindowDimensions();
  const [largeur, setLargeur] = useState(0);
  const large = (largeur || fenetre) >= 720;
  const [vs, setVs] = useState('');
  const [selEpic, setSelEpic] = useState<string | null>(null);
  const [selFeature, setSelFeature] = useState<string | null>(null);
  const [niveau, setNiveau] = useState<Niveau>('epic');
  const today = toDateString(new Date());

  const leVs = h.valueStreams.find((v) => v.id === vs);
  const epics = useMemo(() => parRang(h.epicList.filter((e) => !leVs || idsDe(e.value_streams).includes(leVs.id))), [h.epicList, leVs]);
  const epicIds = new Set(epics.map((e) => e.id));
  const features = useMemo(
    () => parRang(h.featureList.filter((f) => !leVs || epicIds.has(f.epic) || (!!f.train && idsDe(leVs.trains).includes(f.train)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [h.featureList, leVs, epics],
  );
  const featIds = new Set(features.map((f) => f.id));
  const stories = useMemo(() => parRang(h.items.filter((t) => !t.parent && !!t.feature && featIds.has(t.feature))), [h.items, features]); // eslint-disable-line react-hooks/exhaustive-deps

  const featureActive = (f: Feature) => !selEpic || f.epic === selEpic;
  const storyActive = (t: Item) => (selFeature ? t.feature === selFeature : !selEpic || h.features.get(t.feature)?.epic === selEpic);

  const choisirEpic = (e: Epic) => {
    setSelFeature(null);
    if (!large) return void (setSelEpic(e.id), setNiveau('feature'));
    setSelEpic((x) => (x === e.id ? null : e.id));
  };
  const choisirFeature = (f: Feature) => {
    if (!large) return void (setSelFeature(f.id), setNiveau('tache'));
    setSelFeature((x) => (x === f.id ? null : f.id));
    if (f.epic && !selEpic) setSelEpic(f.epic);
  };

  const carteEpic = (e: Epic): Carte => {
    const n = h.featureList.filter((f) => f.epic === e.id).length;
    const etat = ETATS_EPIC.find((x) => x.value === etatEpic(e, today))?.label ?? '';
    return { id: e.id, titre: `🗂️ ${e.titre}`, meta: `${etat} · ${n} feature${n > 1 ? 's' : ''}`, couleur: e.couleur, on: selEpic === e.id, actif: true, ouvrir: () => onOpenEpic(e), toucher: () => choisirEpic(e) };
  };
  const carteFeature = (f: Feature) => ({
    id: f.id,
    titre: `🧩 ${f.titre}`,
    meta: [f.points ? fmtPoints(+f.points, safe.pointsJours) : '', f.pi ? `PI ${f.pi.split('-')[1]}` : '', f.train ? `🚆 ${org.train.get(f.train)?.nom ?? ''}` : ''].filter(Boolean).join(' · '),
    couleur: h.epics.get(f.epic)?.couleur ?? '#8A94A6',
    on: selFeature === f.id,
    actif: featureActive(f),
    ouvrir: () => onOpenFeature(f),
    toucher: () => choisirFeature(f),
  });
  const carteStory = (t: Item) => ({
    id: t.id,
    titre: `${t.type === 'story' ? '📖' : '✓'} ${t.titre}`,
    meta: [t.points ? fmtPoints(+t.points, safe.pointsJours) : '', t.iteration ? iterationNom(t.iteration).split(' · ')[0] : '', t.responsable ? (org.personne.get(t.responsable)?.nom ?? '').split(' ')[0] : ''].filter(Boolean).join(' · '),
    couleur: h.epics.get(h.features.get(t.feature)?.epic ?? '')?.couleur ?? '#8A94A6',
    on: false,
    actif: storyActive(t),
    ouvrir: () => onOpenTask(t),
    toucher: () => onOpenTask(t),
  });

  const colonne = (niv: Niveau, titre: string, cartes: Carte[], vide: string, masquerInactifs = false) => {
    const liste = masquerInactifs ? cartes.filter((c) => c.actif) : cartes;
    return (
      <View style={[s.colonne, large && s.colonneLarge]} key={niv}>
        <Text style={s.colTitre}>
          {titre} · {liste.filter((c) => c.actif).length}
        </Text>
        <ListeGlissable
          cartes={liste}
          onOrdre={(ids) => void onClasser(niv, ids)}
        />
        {!liste.length && <Text style={s.vide}>{vide}</Text>}
      </View>
    );
  };

  const filtreVs = h.valueStreams.length > 0 && (
    <View style={s.filtre}>
      <LigneChoix
        label="Value stream"
        value={vs}
        groupes={[{ options: h.valueStreams.map((v) => ({ value: v.id, label: `🌊 ${v.nom}` })) }]}
        vide="🌊 Tous les value streams"
        sans="Tous les value streams"
        onChange={(v) => {
          setVs(v);
          setSelEpic(null);
          setSelFeature(null);
          setNiveau('epic');
        }}
      />
    </View>
  );

  if (large)
    return (
      <ScrollView contentContainerStyle={s.scroll} refreshControl={refreshControl} onLayout={(ev: LayoutChangeEvent) => setLargeur(ev.nativeEvent.layout.width)}>
        {filtreVs}
        <Text style={s.aide}>Toucher une carte filtre la colonne suivante ; ⋮⋮ pour glisser et prioriser ; › pour ouvrir.</Text>
        <View style={s.colonnes}>
          {colonne('epic', 'Epics · portfolio', epics.map(carteEpic), 'Aucune epic.')}
          {colonne('feature', 'Features · train', features.map(carteFeature), 'Aucune feature.')}
          {colonne('tache', 'Stories · équipe', stories.map(carteStory), 'Aucune story.')}
        </View>
      </ScrollView>
    );

  // Téléphone : une colonne à la fois, avec le fil pour revenir
  const e = selEpic ? h.epics.get(selEpic) : undefined;
  const f = selFeature ? h.features.get(selFeature) : undefined;
  return (
    <ScrollView contentContainerStyle={s.scroll} refreshControl={refreshControl} onLayout={(ev: LayoutChangeEvent) => setLargeur(ev.nativeEvent.layout.width)}>
      {filtreVs}
      <View style={s.fil}>
        <Pressable onPress={() => (setNiveau('epic'), setSelEpic(null), setSelFeature(null))} accessibilityRole="button">
          <Text style={[s.filTexte, niveau === 'epic' && s.filIci]}>Epics</Text>
        </Pressable>
        {e && niveau !== 'epic' && (
          <>
            <Text style={s.filSep}>›</Text>
            <Pressable onPress={() => (setNiveau('feature'), setSelFeature(null))} accessibilityRole="button">
              <Text style={[s.filTexte, niveau === 'feature' && s.filIci]} numberOfLines={1}>{e.titre}</Text>
            </Pressable>
          </>
        )}
        {f && niveau === 'tache' && (
          <>
            <Text style={s.filSep}>›</Text>
            <Text style={[s.filTexte, s.filIci]} numberOfLines={1}>{f.titre}</Text>
          </>
        )}
      </View>
      {niveau === 'epic' && colonne('epic', 'Epics · portfolio', epics.map(carteEpic), 'Aucune epic.')}
      {niveau === 'feature' && colonne('feature', 'Features · train', features.map(carteFeature), 'Aucune feature pour cette epic.', true)}
      {niveau === 'tache' && colonne('tache', 'Stories · équipe', stories.map(carteStory), 'Aucune story pour cette feature.', true)}
    </ScrollView>
  );
}

type Carte = { id: string; titre: string; meta: string; couleur: string; on: boolean; actif: boolean; ouvrir: () => void; toucher: () => void };

/** Cartes d'une colonne ; la poignée ⋮⋮ fait glisser une carte à une autre place */
function ListeGlissable({ cartes, onOrdre }: { cartes: Carte[]; onOrdre: (ids: string[]) => void }) {
  const [glisse, setGlisse] = useState<{ id: string; dy: number } | null>(null);
  const actifs = cartes.filter((c) => c.actif);
  return (
    <View style={{ gap: PAS - 58 }}>
      {cartes.map((c) => (
        <CarteGlissable
          key={c.id}
          c={c}
          dy={glisse?.id === c.id ? glisse.dy : 0}
          onGlisse={(dy) => setGlisse({ id: c.id, dy })}
          onLache={(dy) => {
            setGlisse(null);
            const i = actifs.findIndex((x) => x.id === c.id);
            const j = Math.max(0, Math.min(actifs.length - 1, i + Math.round(dy / PAS)));
            if (i < 0 || i === j) return;
            const ids = actifs.map((x) => x.id);
            ids.splice(i, 1);
            ids.splice(j, 0, c.id);
            onOrdre(ids);
          }}
        />
      ))}
    </View>
  );
}

function CarteGlissable({ c, dy, onGlisse, onLache }: { c: Carte; dy: number; onGlisse: (dy: number) => void; onLache: (dy: number) => void }) {
  const cb = useRef({ onGlisse, onLache });
  cb.current = { onGlisse, onLache };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => cb.current.onGlisse(g.dy),
        onPanResponderRelease: (_e, g) => cb.current.onLache(g.dy),
        onPanResponderTerminate: (_e, g) => cb.current.onLache(g.dy),
      }),
    [],
  );
  return (
    <View style={[s.carte, { borderLeftColor: c.couleur }, c.on && s.carteOn, !c.actif && s.carteGrise, dy !== 0 && [s.carteGlisse, { transform: [{ translateY: dy }] }]]}>
      <Pressable style={s.carteCorps} onPress={c.toucher} accessibilityRole="button" accessibilityLabel={c.titre}>
        <Text style={s.carteTitre} numberOfLines={1}>{c.titre}</Text>
        {!!c.meta && <Text style={s.carteMeta} numberOfLines={1}>{c.meta}</Text>}
      </Pressable>
      <Pressable onPress={c.ouvrir} hitSlop={6} style={s.ouvrir} accessibilityRole="button" accessibilityLabel={`Ouvrir ${c.titre}`}>
        <Text style={s.chev}>›</Text>
      </Pressable>
      {c.actif && (
        <View {...pan.panHandlers} style={s.poignee} accessibilityLabel={`Glisser ${c.titre}`}>
          <Text style={s.poigneeTexte}>⋮⋮</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 130, paddingHorizontal: 12, gap: 10 },
  filtre: { backgroundColor: colors.card, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden', marginTop: 4 },
  aide: { fontSize: 12, color: colors.muted, paddingHorizontal: 4 },
  colonnes: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  colonne: { gap: 8 },
  colonneLarge: { flex: 1, minWidth: 0, backgroundColor: '#E9EDF3', borderRadius: 12, padding: 8 },
  colTitre: { fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, paddingHorizontal: 4 },
  vide: { color: colors.muted, fontSize: 13, padding: 8 },
  carte: { height: 58, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, borderLeftWidth: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingLeft: 10 },
  carteOn: { borderColor: colors.primary, borderWidth: 2, backgroundColor: '#E8F0FE' },
  carteGrise: { opacity: 0.4 },
  carteGlisse: { zIndex: 5, elevation: 5, boxShadow: '0 6px 18px rgba(20,30,50,.18)' } as never,
  carteCorps: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 8 },
  carteTitre: { fontSize: 14, fontWeight: '600', color: colors.text },
  carteMeta: { fontSize: 12, color: colors.muted },
  ouvrir: { paddingHorizontal: 8, height: '100%', justifyContent: 'center' },
  chev: { fontSize: 18, color: '#A0A6B1' },
  poignee: { width: 30, height: '100%', alignItems: 'center', justifyContent: 'center', cursor: 'grab', touchAction: 'none', userSelect: 'none' } as never,
  poigneeTexte: { color: '#A0A6B1', fontSize: 14, fontWeight: '800', letterSpacing: -2 },
  fil: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, flexWrap: 'wrap' },
  filTexte: { fontSize: 14, color: colors.primary, fontWeight: '600', maxWidth: 160 },
  filIci: { color: colors.text },
  filSep: { color: colors.muted },
});
