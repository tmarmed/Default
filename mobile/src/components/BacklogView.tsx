import { type ReactElement, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, type RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMoi } from '../droits';
import { membresDe } from '../organisation';
import { Segmented } from './Segmented';
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

/** États montrés en pastille et proposés dans « Étape » : epics (choisis ou déduits), features et stories (déduits) */
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
 * 📋 Backlog (lot 4) : une colonne à la fois — Epics (portfolio), Features (train), Stories (équipe) — avec la
 * bascule en haut ; colonne par défaut selon le rôle (Epic Owner → Epics, RTE / PM → Features, sinon Stories).
 * Toucher une epic ouvre ses features, toucher une feature ses stories (le filtre se retire par ✕). L'état de
 * chaque carte est une pastille de couleur ; « Étape » ne garde qu'un état. Glisser une carte (poignée ⋮⋮)
 * change sa priorité ; › ouvre la fiche. En haut, un filtre par value stream.
 */
export function BacklogView({ onOpenEpic, onOpenFeature, onOpenTask, onClasser, refreshControl }: Props) {
  const h = useHierarchy();
  const org = useOrg();
  const safe = useSafe();
  const moi = useMoi();
  const [vs, setVs] = useState('');
  const [selEpic, setSelEpic] = useState<string | null>(null);
  const [selFeature, setSelFeature] = useState<string | null>(null);
  const [niveau, setNiveau] = useState<Niveau>(() => niveauDuRole(moi, org));
  const [etape, setEtape] = useState('');
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

  const etatFeature = (f: Feature) => {
    const st = h.items.filter((t) => !t.parent && t.feature === f.id);
    if (st.length && st.every((t) => t.statut === 'termine')) return 'terminee';
    if (st.some((t) => t.statut !== 'a_faire')) return 'en_cours';
    return f.pi ? 'prevue' : 'idee';
  };
  const etatDe = (niv: Niveau, x: Epic | Feature | Item) => (niv === 'epic' ? etatEpic(x as Epic, today) : niv === 'feature' ? etatFeature(x as Feature) : (x as Item).statut || 'a_faire');
  const etats = niveau === 'epic' ? ETATS_EPIC : niveau === 'feature' ? ETATS_FEATURE : ETATS_STORY;
  const pastille = (niv: Niveau, x: Epic | Feature | Item) => (niv === 'epic' ? ETATS_EPIC : niv === 'feature' ? ETATS_FEATURE : ETATS_STORY).find((e) => e.value === etatDe(niv, x));

  const changerNiveau = (n: Niveau) => {
    setNiveau(n);
    setEtape('');
  };
  const choisirEpic = (e: Epic) => {
    setSelEpic(e.id);
    setSelFeature(null);
    changerNiveau('feature');
  };
  const choisirFeature = (f: Feature) => {
    setSelFeature(f.id);
    if (f.epic) setSelEpic(f.epic);
    changerNiveau('tache');
  };

  const carteEpic = (e: Epic): Carte => {
    const n = h.featureList.filter((f) => f.epic === e.id).length;
    return { id: e.id, titre: `🗂️ ${e.titre}`, etat: pastille('epic', e), meta: `${n} feature${n > 1 ? 's' : ''}`, couleur: e.couleur, on: false, actif: true, ouvrir: () => onOpenEpic(e), toucher: () => choisirEpic(e) };
  };
  const carteFeature = (f: Feature): Carte => ({
    id: f.id,
    titre: `🧩 ${f.titre}`,
    etat: pastille('feature', f),
    meta: [f.points ? fmtPoints(+f.points, safe.pointsJours) : '', f.pi ? `PI ${f.pi.split('-')[1]}` : '', f.train ? `🚆 ${org.train.get(f.train)?.nom ?? ''}` : ''].filter(Boolean).join(' · '),
    couleur: h.epics.get(f.epic)?.couleur ?? '#8A94A6',
    on: false,
    actif: true,
    ouvrir: () => onOpenFeature(f),
    toucher: () => choisirFeature(f),
  });
  const carteStory = (t: Item): Carte => ({
    id: t.id,
    titre: `${t.type === 'story' ? '📖' : '✓'} ${t.titre}`,
    etat: pastille('tache', t),
    meta: [t.points ? fmtPoints(+t.points, safe.pointsJours) : '', t.iteration ? iterationNom(t.iteration).split(' · ')[0] : '', t.responsable ? (org.personne.get(t.responsable)?.nom ?? '').split(' ')[0] : ''].filter(Boolean).join(' · '),
    couleur: h.epics.get(h.features.get(t.feature)?.epic ?? '')?.couleur ?? '#8A94A6',
    on: false,
    actif: true,
    ouvrir: () => onOpenTask(t),
    toucher: () => onOpenTask(t),
  });

  // Ce que montre la colonne : filtre de l'epic / de la feature touchée, puis l'étape
  const featuresVues = features.filter((f) => !selEpic || f.epic === selEpic);
  const storiesVues = stories.filter((t) => (selFeature ? t.feature === selFeature : !selEpic || h.features.get(t.feature)?.epic === selEpic));
  const garder = <T extends Epic | Feature | Item>(l: T[]) => (etape ? l.filter((x) => etatDe(niveau, x) === etape) : l);
  const cartes =
    niveau === 'epic' ? garder(epics).map(carteEpic) : niveau === 'feature' ? garder(featuresVues).map(carteFeature) : garder(storiesVues).map(carteStory);

  const e = selEpic ? h.epics.get(selEpic) : undefined;
  const f = selFeature ? h.features.get(selFeature) : undefined;
  const filtre = niveau === 'feature' ? (e ? [e] : []) : niveau === 'tache' ? [e, f].filter((x): x is Epic | Feature => !!x) : [];
  const retirerFiltre = () => {
    setSelEpic(null);
    setSelFeature(null);
  };

  return (
    <ScrollView contentContainerStyle={s.scroll} refreshControl={refreshControl}>
      <Segmented
        options={[
          { value: 'epic', label: `Epics · ${epics.length}` },
          { value: 'feature', label: `Features · ${(e ? featuresVues : features).length}` },
          { value: 'tache', label: `Stories · ${(e || f ? storiesVues : stories).length}` },
        ]}
        value={niveau}
        onChange={changerNiveau}
      />
      {h.valueStreams.length > 0 && (
        <View style={s.filtre}>
          <LigneChoix
            label="Value stream"
            value={vs}
            groupes={[{ options: h.valueStreams.map((v) => ({ value: v.id, label: `🌊 ${v.nom}` })) }]}
            vide="🌊 Tous les value streams"
            sans="Tous les value streams"
            onChange={(v) => {
              setVs(v);
              retirerFiltre();
            }}
          />
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.etapes}>
        <Text style={s.etapeLabel}>Étape</Text>
        {[{ value: '', label: 'Toutes', color: colors.text }, ...etats].map((x) => {
          const on = etape === x.value;
          return (
            <Pressable key={x.value || 'tout'} onPress={() => setEtape(x.value)} style={[s.etape, on && { backgroundColor: x.color, borderColor: x.color }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text style={[s.etapeTexte, on && s.etapeTexteOn]}>{x.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {filtre.length > 0 && (
        <View style={s.fil}>
          <Pressable onPress={() => changerNiveau('epic')} accessibilityRole="button">
            <Text style={s.filTexte}>Epics</Text>
          </Pressable>
          {filtre.map((x, i) => (
            <View key={x.id} style={s.filMorceau}>
              <Text style={s.filSep}>›</Text>
              <Pressable onPress={() => i === 0 && filtre.length > 1 && (setSelFeature(null), changerNiveau('feature'))} disabled={!(i === 0 && filtre.length > 1)} style={s.filBouton} accessibilityRole="button">
                <Text style={[s.filTexte, i === filtre.length - 1 && s.filIci]} numberOfLines={1}>
                  {'epic' in x ? '🧩' : '🗂️'} {x.titre}
                </Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={retirerFiltre} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retirer le filtre" style={s.filCroix}>
            <Text style={s.croix}>✕</Text>
          </Pressable>
        </View>
      )}
      <ListeGlissable cartes={cartes} onOrdre={(ids) => void onClasser(niveau, ids)} />
      {!cartes.length && (
        <Text style={s.vide}>
          {etape ? `Aucune ${niveau === 'epic' ? 'epic' : niveau === 'feature' ? 'feature' : 'story'} à cette étape.` : niveau === 'epic' ? 'Aucune epic.' : niveau === 'feature' ? (e ? 'Aucune feature pour cette epic.' : 'Aucune feature.') : f ? 'Aucune story pour cette feature.' : 'Aucune story.'}
        </Text>
      )}
      <Text style={s.aide}>{niveau === 'tache' ? 'Toucher une story l’ouvre' : `Toucher une ${niveau === 'epic' ? 'epic montre ses features' : 'feature montre ses stories'}`} ; ⋮⋮ pour glisser et prioriser ; › pour ouvrir.</Text>
    </ScrollView>
  );
}

/** Colonne par défaut selon le rôle : Epic Owner → Epics ; RTE ou PM → Features ; sinon Stories (membre d'une équipe) */
function niveauDuRole(moi: string | null, org: ReturnType<typeof useOrg>): Niveau {
  if (!moi) return 'epic';
  if (org.portfolios.some((p) => (p as { epic_owner?: string }).epic_owner === moi)) return 'epic';
  if (org.trains.some((t) => t.rte === moi || t.pm === moi)) return 'feature';
  if (org.equipes.some((e) => e.po === moi || e.sm === moi || membresDe(e).includes(moi))) return 'tache';
  return 'epic';
}

type Carte = { id: string; titre: string; etat?: Etat; meta: string; couleur: string; on: boolean; actif: boolean; ouvrir: () => void; toucher: () => void };

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
        <View style={s.metaLigne}>
          {!!c.etat && (
            <View style={[s.pastille, { backgroundColor: `${c.etat.color}1F` }]}>
              <Text style={[s.pastilleTexte, { color: c.etat.color }]}>{c.etat.label}</Text>
            </View>
          )}
          {!!c.meta && <Text style={s.carteMeta} numberOfLines={1}>{c.meta}</Text>}
        </View>
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
  carteMeta: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  ouvrir: { paddingHorizontal: 8, height: '100%', justifyContent: 'center' },
  chev: { fontSize: 18, color: '#A0A6B1' },
  poignee: { width: 30, height: '100%', alignItems: 'center', justifyContent: 'center', cursor: 'grab', touchAction: 'none', userSelect: 'none' } as never,
  poigneeTexte: { color: '#A0A6B1', fontSize: 14, fontWeight: '800', letterSpacing: -2 },
  fil: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  filMorceau: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  filBouton: { flexShrink: 1, minWidth: 0 },
  filTexte: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  filCroix: { marginLeft: 'auto', paddingLeft: 8 },
  croix: { fontSize: 14, color: '#9AA1AD' },
  etapes: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  etapeLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, marginRight: 2 },
  etape: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.card },
  etapeTexte: { fontSize: 12.5, fontWeight: '600', color: colors.text },
  etapeTexteOn: { color: '#fff' },
  metaLigne: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  pastille: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 1 },
  pastilleTexte: { fontSize: 11, fontWeight: '700' },
  filIci: { color: colors.text },
  filSep: { color: colors.muted },
});
