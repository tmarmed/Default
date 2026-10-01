import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, type RefreshControlProps, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { toDateString } from '../dates';
import { useHierarchy } from '../hierarchyContext';
import { membresDe, type OrgValue, useFiltreOrg, useOrg } from '../organisation';
import { fmtPoints, iterationNom } from '../pi';
import { etatEpic, useSafe } from '../safe';
import { colors } from '../theme';
import { type Epic, ETATS_EPIC, type EtatEpic, type Feature, idsDe, type Item, type Statut } from '../types';
import { useRecherche } from './DomainFilter';

export type Niveau = 'epic' | 'feature' | 'tache';
interface Props {
  /** Niveau choisi dans les filtres (Epics / Features / Stories) */
  niveau: Niveau;
  onNiveau: (n: Niveau) => void;
  /** Value stream choisi dans les filtres ('' = tous) */
  vs: string;
  onOpenEpic: (e: Epic) => void;
  onOpenFeature: (f: Feature) => void;
  onOpenTask: (t: Item) => void;
  /** Nouvel ordre d'un niveau (glisser) : les rangs sont recalculés et enregistrés */
  onClasser: (niveau: Niveau, ids: string[]) => Promise<void>;
  /** ‹ › d'une carte : changer l'état d'une epic ou le statut d'une story */
  onMoveEpic: (e: Epic, etat: EtatEpic) => void;
  onMoveStory: (t: Item, statut: Statut) => void;
  refreshControl?: ReactElement<RefreshControlProps>;
}

const parRang = <T extends { rang?: string; titre: string }>(l: T[]) =>
  [...l].sort((a, b) => (a.rang ? +a.rang : 1e9) - (b.rang ? +b.rang : 1e9) || a.titre.localeCompare(b.titre));

/** États (colonnes du kanban) : epics (choisis ou déduits des dates), features (déduits), stories (statut) */
type Etat = { value: string; label: string; color: string };
const ETATS_FEATURE: Etat[] = [
  { value: 'idee', label: 'Idée', color: '#9AA3AF' },
  { value: 'prevue', label: 'Prévue', color: '#E37400' },
  { value: 'en_cours', label: 'En cours', color: '#1A73E8' },
  { value: 'terminee', label: 'Terminée', color: '#188038' },
];
const ETATS_STORY: Etat[] = [
  { value: 'a_faire', label: 'À faire', color: '#9AA3AF' },
  { value: 'en_cours', label: 'En cours', color: '#1A73E8' },
  { value: 'termine', label: 'Terminée', color: '#188038' },
];

/**
 * 🌳 Backlog (lot 4) : kanban par état, comme le Portefeuille, du niveau choisi dans les filtres — Epics
 * (portfolio), Features (train), Stories (équipe) ; niveau par défaut selon le rôle. Filtres standard : niveau,
 * value stream, delivery (portfolio / train / équipe), recherche. Toucher une epic montre ses features, toucher
 * une feature ses stories (fil « Epics › … », ✕ pour retirer). ‹ › change l'état (epic) ou le statut (story) ;
 * ⋮⋮ glisse une carte pour la prioriser dans sa colonne ; › ouvre la fiche.
 */
export function BacklogView({ niveau, onNiveau, vs, onOpenEpic, onOpenFeature, onOpenTask, onClasser, onMoveEpic, onMoveStory, refreshControl }: Props) {
  const h = useHierarchy();
  const org = useOrg();
  const safe = useSafe();
  const cherche = useRecherche();
  const fo = useFiltreOrg();
  const { width } = useWindowDimensions();
  const [selEpic, setSelEpic] = useState<string | null>(null);
  const [selFeature, setSelFeature] = useState<string | null>(null);
  const today = toDateString(new Date());

  const leVs = h.valueStreams.find((v) => v.id === vs);
  const epics = useMemo(() => parRang(h.epicList.filter((e) => (!leVs || idsDe(e.value_streams).includes(leVs.id)) && fo.epic(e))), [h.epicList, leVs, fo]);
  const epicIds = new Set(epics.map((e) => e.id));
  const features = useMemo(
    () => parRang(h.featureList.filter((f) => (!leVs || epicIds.has(f.epic) || (!!f.train && idsDe(leVs.trains).includes(f.train))) && fo.feature(f))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [h.featureList, leVs, epics, fo],
  );
  const featIds = new Set(features.map((f) => f.id));
  const stories = useMemo(() => parRang(h.items.filter((t) => !t.parent && !!t.feature && featIds.has(t.feature) && fo.item(t))), [h.items, features, fo]); // eslint-disable-line react-hooks/exhaustive-deps

  const etatFeature = (f: Feature) => {
    const st = h.items.filter((t) => !t.parent && t.feature === f.id);
    if (st.length && st.every((t) => t.statut === 'termine')) return 'terminee';
    if (st.some((t) => t.statut !== 'a_faire')) return 'en_cours';
    return f.pi ? 'prevue' : 'idee';
  };

  const choisirEpic = (e: Epic) => {
    setSelEpic(e.id);
    setSelFeature(null);
    onNiveau('feature');
  };
  const choisirFeature = (f: Feature) => {
    setSelFeature(f.id);
    if (f.epic) setSelEpic(f.epic);
    onNiveau('tache');
  };

  const carteEpic = (e: Epic, i: number): Carte => {
    const n = h.featureList.filter((f) => f.epic === e.id).length;
    const prev = ETATS_EPIC[i - 1];
    const next = ETATS_EPIC[i + 1];
    return {
      id: e.id,
      titre: `🗂️ ${e.titre}`,
      meta: [`${n} feature${n > 1 ? 's' : ''}`, e.portfolio ? `💼 ${org.portfolio.get(e.portfolio)?.nom ?? ''}` : ''].filter(Boolean).join(' · '),
      couleur: e.couleur,
      ouvrir: () => onOpenEpic(e),
      toucher: () => choisirEpic(e),
      prev: prev && { label: prev.label, press: () => onMoveEpic(e, prev.value) },
      next: next && { label: next.label, press: () => onMoveEpic(e, next.value) },
    };
  };
  const carteFeature = (f: Feature): Carte => ({
    id: f.id,
    titre: `🧩 ${f.titre}`,
    meta: [f.points ? fmtPoints(+f.points, safe.pointsJours) : '', f.pi ? `PI ${f.pi.split('-')[1]}` : '', f.train ? `🚆 ${org.train.get(f.train)?.nom ?? ''}` : ''].filter(Boolean).join(' · '),
    couleur: h.epics.get(f.epic)?.couleur ?? '#8A94A6',
    ouvrir: () => onOpenFeature(f),
    toucher: () => choisirFeature(f),
  });
  const carteStory = (t: Item, i: number): Carte => {
    const prev = ETATS_STORY[i - 1];
    const next = ETATS_STORY[i + 1];
    return {
      id: t.id,
      titre: `${t.type === 'story' ? '📖' : '✓'} ${t.titre}`,
      meta: [t.points ? fmtPoints(+t.points, safe.pointsJours) : '', t.iteration ? iterationNom(t.iteration).split(' · ')[0] : '', t.responsable ? (org.personne.get(t.responsable)?.nom ?? '').split(' ')[0] : ''].filter(Boolean).join(' · '),
      couleur: h.epics.get(h.features.get(t.feature)?.epic ?? '')?.couleur ?? '#8A94A6',
      ouvrir: () => onOpenTask(t),
      toucher: () => onOpenTask(t),
      prev: prev && { label: prev.label, press: () => onMoveStory(t, prev.value as Statut) },
      next: next && { label: next.label, press: () => onMoveStory(t, next.value as Statut) },
    };
  };

  // Ce que montre le niveau : filtre de l'epic / de la feature touchée, puis la recherche
  const featuresVues = features.filter((f) => !selEpic || f.epic === selEpic);
  const storiesVues = stories.filter((t) => (selFeature ? t.feature === selFeature : !selEpic || h.features.get(t.feature)?.epic === selEpic));
  const colonnes: { etat: Etat; cartes: Carte[]; tous: string[] }[] =
    niveau === 'epic'
      ? ETATS_EPIC.map((et, i) => ({ etat: et, cartes: epics.filter((e) => etatEpic(e, today) === et.value && cherche(e.titre)).map((e) => carteEpic(e, i)), tous: epics.map((e) => e.id) }))
      : niveau === 'feature'
        ? ETATS_FEATURE.map((et) => ({ etat: et, cartes: featuresVues.filter((f) => etatFeature(f) === et.value && cherche(f.titre)).map(carteFeature), tous: features.map((f) => f.id) }))
        : ETATS_STORY.map((et, i) => ({ etat: et, cartes: storiesVues.filter((t) => (t.statut || 'a_faire') === et.value && cherche(t.titre)).map((t) => carteStory(t, i)), tous: stories.map((t) => t.id) }));

  /** Nouvel ordre d'une colonne : les autres éléments du niveau gardent leur place */
  const classer = (tous: string[], col: string[], ordre: string[]) => {
    const dans = new Set(col);
    let k = 0;
    void onClasser(niveau, tous.map((id) => (dans.has(id) ? ordre[k++] : id)));
  };

  const e = selEpic ? h.epics.get(selEpic) : undefined;
  const f = selFeature ? h.features.get(selFeature) : undefined;
  const fil = niveau === 'feature' ? (e ? [e] : []) : niveau === 'tache' ? [e, f].filter((x): x is Epic | Feature => !!x) : [];
  const largeur = Math.min(260, Math.max(220, width * 0.62));
  // Navigation : le kanban s'ouvre sur la première colonne qui a des cartes ; toucher un compteur y va
  const tableau = useRef<ScrollView>(null);
  const allerA = (i: number) => tableau.current?.scrollTo({ x: Math.max(0, i * (largeur + 10)), animated: true });
  const premiere = Math.max(0, colonnes.findIndex((c) => c.cartes.length > 0));
  const cleVue = `${niveau}|${selEpic}|${selFeature}|${vs}`;
  useEffect(() => {
    const t = setTimeout(() => allerA(premiere), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleVue]);

  return (
    <ScrollView contentContainerStyle={s.scroll} refreshControl={refreshControl}>
      <View style={s.stats}>
        {colonnes.map((c, i) => (
          <Pressable key={c.etat.value} style={s.stat} onPress={() => allerA(i)} accessibilityRole="button" accessibilityLabel={`${c.etat.label} : ${c.cartes.length}`}>
            <Text style={[s.statNum, { color: c.etat.color }]}>{c.cartes.length}</Text>
            <Text style={s.statLabel}>{c.etat.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.titreLigne}>
        <Text style={s.section}>{niveau === 'epic' ? 'Epics · portfolio' : niveau === 'feature' ? 'Features · train' : 'Stories · équipe'}</Text>
      </View>
      {fil.length > 0 && (
        <View style={s.fil}>
          <Pressable onPress={() => onNiveau('epic')} accessibilityRole="button">
            <Text style={s.filTexte}>Epics</Text>
          </Pressable>
          {fil.map((x, i) => (
            <View key={x.id} style={s.filMorceau}>
              <Text style={s.filSep}>›</Text>
              <Pressable onPress={() => i === 0 && fil.length > 1 && (setSelFeature(null), onNiveau('feature'))} disabled={!(i === 0 && fil.length > 1)} style={s.filBouton} accessibilityRole="button">
                <Text style={[s.filTexte, i === fil.length - 1 && s.filIci]} numberOfLines={1}>
                  {'epic' in x ? '🧩' : '🗂️'} {x.titre}
                </Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => (setSelEpic(null), setSelFeature(null))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retirer le filtre" style={s.filCroix}>
            <Text style={s.croix}>✕</Text>
          </Pressable>
        </View>
      )}
      <ScrollView ref={tableau} horizontal showsHorizontalScrollIndicator contentContainerStyle={s.board}>
        {colonnes.map((c) => (
          <View key={c.etat.value} style={[s.colonne, { width: largeur }]}>
            <View style={[s.colHead, { borderTopColor: c.etat.color }]}>
              <Text style={[s.colTitre, { color: c.etat.color }]}>{c.etat.label}</Text>
              <Text style={s.colNb}>{c.cartes.length}</Text>
            </View>
            {c.cartes.length === 0 ? <Text style={s.vide}>—</Text> : <ListeGlissable cartes={c.cartes} onOrdre={(ids) => classer(c.tous, c.cartes.map((x) => x.id), ids)} />}
          </View>
        ))}
      </ScrollView>
      <Text style={s.aide}>
        {niveau === 'tache' ? 'Toucher une story l’ouvre' : `Toucher une ${niveau === 'epic' ? 'epic montre ses features' : 'feature montre ses stories'}`}
        {niveau === 'feature' ? '' : ' ; ‹ › change l’état'} ; ⋮⋮ pour glisser et prioriser ; › pour ouvrir.
      </Text>
    </ScrollView>
  );
}

/** Niveau par défaut selon le rôle : Epic Owner → Epics ; RTE ou PM → Features ; sinon Stories (membre d'une équipe) */
export function niveauDuRole(moi: string | null, org: OrgValue): Niveau {
  if (!moi) return 'epic';
  if (org.portfolios.some((p) => (p as { epic_owner?: string }).epic_owner === moi)) return 'epic';
  if (org.trains.some((t) => t.rte === moi || t.pm === moi)) return 'feature';
  if (org.equipes.some((e) => e.po === moi || e.sm === moi || membresDe(e).includes(moi))) return 'tache';
  return 'epic';
}

type Bouge = { label: string; press: () => void };
type Carte = { id: string; titre: string; meta: string; couleur: string; ouvrir: () => void; toucher: () => void; prev?: Bouge; next?: Bouge };

/** Cartes d'une colonne ; la poignée ⋮⋮ fait glisser une carte à une autre place */
function ListeGlissable({ cartes, onOrdre }: { cartes: Carte[]; onOrdre: (ids: string[]) => void }) {
  const [glisse, setGlisse] = useState<{ id: string; dy: number } | null>(null);
  // Cartes sans ‹ › (features) plus basses ; le glissé compte en cartes
  const hauteur = cartes.some((c) => c.prev || c.next) ? HAUTEUR : HAUTEUR_SIMPLE;
  const pas = hauteur + ECART;
  return (
    <View style={{ gap: ECART }}>
      {cartes.map((c, i) => (
        <CarteGlissable
          key={c.id}
          c={c}
          hauteur={hauteur}
          dy={glisse?.id === c.id ? glisse.dy : 0}
          onGlisse={(dy) => setGlisse({ id: c.id, dy })}
          onLache={(dy) => {
            setGlisse(null);
            const j = Math.max(0, Math.min(cartes.length - 1, i + Math.round(dy / pas)));
            if (i === j) return;
            const ids = cartes.map((x) => x.id);
            ids.splice(i, 1);
            ids.splice(j, 0, c.id);
            onOrdre(ids);
          }}
        />
      ))}
    </View>
  );
}

function CarteGlissable({ c, hauteur, dy, onGlisse, onLache }: { c: Carte; hauteur: number; dy: number; onGlisse: (dy: number) => void; onLache: (dy: number) => void }) {
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
    <View style={[s.carte, { height: hauteur, borderLeftColor: c.couleur }, dy !== 0 && [s.carteGlisse, { transform: [{ translateY: dy }] }]]}>
      <View style={s.carteHaut}>
        <Pressable style={s.carteCorps} onPress={c.toucher} accessibilityRole="button" accessibilityLabel={c.titre}>
          <Text style={s.carteTitre} numberOfLines={1}>{c.titre}</Text>
          {!!c.meta && <Text style={s.carteMeta} numberOfLines={1}>{c.meta}</Text>}
        </Pressable>
        <Pressable onPress={c.ouvrir} hitSlop={6} style={s.ouvrir} accessibilityRole="button" accessibilityLabel={`Ouvrir ${c.titre}`}>
          <Text style={s.chev}>›</Text>
        </Pressable>
        <View {...pan.panHandlers} style={s.poignee} accessibilityLabel={`Glisser ${c.titre}`}>
          <Text style={s.poigneeTexte}>⋮⋮</Text>
        </View>
      </View>
      {(c.prev || c.next) && (
        <View style={s.moves}>
          {c.prev ? (
            <Pressable onPress={c.prev.press} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Passer en ${c.prev.label}`}>
              <Text style={s.move}>‹ {c.prev.label}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {c.next && (
            <Pressable onPress={c.next.press} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Passer en ${c.next.label}`}>
              <Text style={[s.move, s.moveNext]}>{c.next.label} ›</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

/** Hauteur fixe d'une carte, avec ou sans ‹ › (le glissé compte en cartes) */
const HAUTEUR = 82;
const HAUTEUR_SIMPLE = 60;
const ECART = 8;

const s = StyleSheet.create({
  scroll: { paddingBottom: 130, gap: 10 },
  aide: { fontSize: 12, color: colors.muted, paddingHorizontal: 16 },
  stats: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 10, marginTop: 4 },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  titreLigne: { marginHorizontal: 16, marginTop: 8 },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  board: { paddingHorizontal: 16, gap: 10, alignItems: 'flex-start' },
  colonne: { backgroundColor: '#E9EDF3', borderRadius: 12, padding: 8, gap: 8 },
  colHead: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 3, paddingTop: 6, paddingHorizontal: 4 },
  colTitre: { fontSize: 14, fontWeight: '800' },
  colNb: { fontSize: 13, fontWeight: '700', color: colors.muted },
  vide: { textAlign: 'center', color: colors.muted, paddingVertical: 8 },
  carte: { backgroundColor: colors.card, borderRadius: 10, borderLeftWidth: 4, paddingLeft: 10, paddingRight: 4, paddingVertical: 6, justifyContent: 'space-between' },
  carteGlisse: { zIndex: 5, elevation: 5, boxShadow: '0 6px 18px rgba(20,30,50,.18)' } as never,
  carteHaut: { flexDirection: 'row', alignItems: 'center' },
  carteCorps: { flex: 1, minWidth: 0, gap: 2 },
  carteTitre: { fontSize: 14, fontWeight: '700', color: colors.text },
  carteMeta: { fontSize: 12, color: colors.muted },
  ouvrir: { paddingHorizontal: 6, paddingVertical: 6 },
  chev: { fontSize: 18, color: '#A0A6B1' },
  poignee: { width: 26, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', cursor: 'grab', touchAction: 'none', userSelect: 'none' } as never,
  poigneeTexte: { color: '#A0A6B1', fontSize: 14, fontWeight: '800', letterSpacing: -2 },
  moves: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 8 },
  move: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  moveNext: { color: colors.primary },
  fil: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  filMorceau: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  filBouton: { flexShrink: 1, minWidth: 0 },
  filTexte: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  filIci: { color: colors.text },
  filSep: { color: colors.muted },
  filCroix: { marginLeft: 'auto', paddingLeft: 8 },
  croix: { fontSize: 14, color: '#9AA1AD' },
});
