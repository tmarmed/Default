import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  avancementLot,
  chargerReponses,
  cheminPoint,
  enregistrerReponses,
  ESPACES_FIL,
  FIL,
  LIBELLE_CHOIX,
  type LotFil,
  ouvert,
  type PointFil,
  type Reponse,
  resumeReponses,
  signature,
} from '../echange/echange';
import { colors } from '../theme';

/** Couleur du fil d'Ariane de chaque lot (et du format d'échange) */
const TEINTES = ['#1A73E8', '#188038', '#8E24AA', '#E37400', '#00897B', '#C2185B', '#795548'];
const teinte = (p: PointFil) => (p.espace === 'format' ? '#5F6B7A' : TEINTES[((p.lot ?? 1) - 1) % TEINTES.length]);

type Vue = 'questions' | 'backlog';
type Categorie = 'tous' | 'en_cours' | 'discuter' | 'livre' | 'a_faire';
const CATEGORIES: { id: Categorie; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'discuter', label: 'À discuter' },
  { id: 'a_faire', label: 'À faire' },
  { id: 'livre', label: 'Livré' },
];
function categorie(l: LotFil): Exclude<Categorie, 'tous'> {
  const a = avancementLot(l);
  if (a.faites === a.total) return 'livre';
  if (/DISCUTER/.test(l.etat)) return 'discuter';
  return a.faites > 0 ? 'en_cours' : 'a_faire';
}

/**
 * 💬 Échange (lot 20) : le fil d'échange avec Claude.
 * - Questions : les points à valider un par un (Projet President et Format d'échange séparés), captures en
 *   boutons (visionneuse ‹ n/N ›), votre choix et votre remarque ; « 📋 Copier et vider » copie vos réponses pour
 *   les coller dans la discussion avec Claude ;
 * - Backlog : les missions comme des epics (lot › étape › point), avancement = étapes terminées ÷ total.
 */
export function EchangeView() {
  const [vue, setVue] = useState<Vue>('questions');
  const [espace, setEspace] = useState<'projet' | 'format'>('projet');
  const [index, setIndex] = useState(0);
  const [reponses, setReponses] = useState<Record<string, Reponse>>({});
  const [viewer, setViewer] = useState<{ p: PointFil; i: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [texteCopie, setTexteCopie] = useState<string | null>(null);
  // Backlog : filtre et niveau ouvert (lot, puis étape)
  const [cat, setCat] = useState<Categorie>('tous');
  const [lotOuvert, setLotOuvert] = useState<number | null>(null);
  const [etapeOuverte, setEtapeOuverte] = useState<string | null>(null);

  useEffect(() => {
    chargerReponses().then(setReponses);
  }, []);

  const aRepondre = useMemo(() => FIL.points.filter((p) => ouvert(p) && p.espace === espace), [espace]);
  const nbEspace = (e: string) => FIL.points.filter((p) => ouvert(p) && p.espace === e).length;
  const courant = aRepondre[Math.min(index, aRepondre.length - 1)];
  const nbRepondus = Object.values(reponses).filter((r) => r.choix || r.note.trim()).length;

  const repondre = (p: PointFil, patch: Partial<Reponse>) =>
    setReponses((r) => {
      const n = { ...r, [p.id]: { ...{ choix: '', note: '' }, ...r[p.id], ...patch, sig: signature(p) } };
      enregistrerReponses(n);
      return n;
    });
  const choisir = (p: PointFil, choix: string) => {
    repondre(p, { choix });
    // On passe à la question suivante, sauf « À revoir » (on écrit d'abord pourquoi)
    if (choix !== 'revoir' && index < aRepondre.length - 1) setTimeout(() => setIndex((i) => i + 1), 250);
  };
  const vider = () => {
    setReponses({});
    enregistrerReponses({});
  };
  const copier = async () => {
    const t = resumeReponses(reponses);
    if (!t) return;
    try {
      if (Platform.OS !== 'web' || !navigator.clipboard) throw new Error('presse-papiers');
      await navigator.clipboard.writeText(t);
      const n = nbRepondus;
      vider();
      setMessage(`📋 ${n} réponse${n > 1 ? 's' : ''} copiée${n > 1 ? 's' : ''}, puis vidée${n > 1 ? 's' : ''} : collez-les dans la discussion avec Claude.`);
    } catch {
      setTexteCopie(t);
    }
  };
  const allerA = (p: PointFil) => {
    setEspace(p.espace);
    const liste = FIL.points.filter((x) => ouvert(x) && x.espace === p.espace);
    setIndex(Math.max(0, liste.findIndex((x) => x.id === p.id)));
    setVue('questions');
  };

  return (
    <View style={s.ecran}>
      <View style={s.segments}>
        {(['questions', 'backlog'] as const).map((v) => (
          <Pressable key={v} onPress={() => setVue(v)} style={[s.segment, vue === v && s.segmentOn]} accessibilityRole="tab" accessibilityState={{ selected: vue === v }}>
            <Text style={[s.segmentTexte, vue === v && s.segmentTexteOn]}>{v === 'questions' ? `Questions · ${FIL.points.filter(ouvert).length}` : 'Backlog des missions'}</Text>
          </Pressable>
        ))}
      </View>

      {vue === 'questions' ? (
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.espaces}>
            {ESPACES_FIL.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => {
                  setEspace(e.id);
                  setIndex(0);
                }}
                style={[s.puce, espace === e.id && s.puceOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: espace === e.id }}
              >
                <Text style={[s.puceTexte, espace === e.id && s.puceTexteOn]}>
                  {e.titre} · {nbEspace(e.id)}
                </Text>
              </Pressable>
            ))}
          </View>

          {message && (
            <Pressable onPress={() => setMessage(null)} style={s.message} accessibilityRole="button" accessibilityHint="Fermer le message">
              <Text style={s.messageTexte}>{message}</Text>
              <Text style={s.messageFermer}>✕</Text>
            </Pressable>
          )}

          {!courant ? (
            <View style={s.carte}>
              <Text style={s.vide}>Rien à répondre ici pour l'instant.</Text>
            </View>
          ) : (
            <>
              <View style={s.position}>
                <Text style={s.positionTexte}>
                  Question {Math.min(index, aRepondre.length - 1) + 1}/{aRepondre.length}
                </Text>
                <View style={s.points}>
                  {aRepondre.map((p, i) => {
                    const r = reponses[p.id];
                    return (
                      <Pressable key={p.id} onPress={() => setIndex(i)} hitSlop={4} accessibilityLabel={`Question ${i + 1}`}>
                        <View style={[s.point, r?.choix && s.pointRepondu, i === index && s.pointCourant]} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Question
                p={courant}
                r={reponses[courant.id]}
                onChoisir={(c) => choisir(courant, c)}
                onNote={(note) => repondre(courant, { note })}
                onImage={(i) => setViewer({ p: courant, i })}
              />
              <View style={s.nav}>
                <Pressable disabled={index === 0} onPress={() => setIndex((i) => Math.max(0, i - 1))} style={[s.navBouton, index === 0 && s.inactif]} accessibilityRole="button">
                  <Text style={s.navTexte}>‹ Précédente</Text>
                </Pressable>
                <Pressable
                  disabled={index >= aRepondre.length - 1}
                  onPress={() => setIndex((i) => Math.min(aRepondre.length - 1, i + 1))}
                  style={[s.navBouton, s.navSuivant, index >= aRepondre.length - 1 && s.inactif]}
                  accessibilityRole="button"
                >
                  <Text style={[s.navTexte, s.navTexteSuivant]}>Suivante ›</Text>
                </Pressable>
              </View>
            </>
          )}

          <Pressable disabled={!nbRepondus} onPress={copier} style={[s.copier, !nbRepondus && s.copierInactif]} accessibilityRole="button">
            <Text style={[s.copierTexte, !nbRepondus && s.copierTexteInactif]}>
              📋 Copier et vider{nbRepondus ? ` · ${nbRepondus} réponse${nbRepondus > 1 ? 's' : ''}` : ''}
            </Text>
          </Pressable>
          <Text style={s.aide}>Vos réponses restent sur cet appareil. Une fois copiées, collez-les dans la discussion avec Claude.</Text>
        </ScrollView>
      ) : (
        <Backlog
          cat={cat}
          onCat={setCat}
          lotOuvert={lotOuvert}
          etapeOuverte={etapeOuverte}
          onLot={(n) => {
            setLotOuvert(n);
            setEtapeOuverte(null);
          }}
          onEtape={setEtapeOuverte}
          onPoint={allerA}
        />
      )}

      <Visionneuse viewer={viewer} onChange={setViewer} />
      <Modal visible={!!texteCopie} transparent animationType="fade" onRequestClose={() => setTexteCopie(null)}>
        <View style={s.fond}>
          <View style={s.feuille}>
            <Text style={s.feuilleTitre}>Copiez ce texte</Text>
            <TextInput value={texteCopie ?? ''} multiline editable={false} selectTextOnFocus style={s.texteCopie} />
            <View style={s.nav}>
              <Pressable onPress={() => setTexteCopie(null)} style={s.navBouton} accessibilityRole="button">
                <Text style={s.navTexte}>Fermer</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  vider();
                  setTexteCopie(null);
                  setMessage('Réponses vidées : collez le texte copié dans la discussion avec Claude.');
                }}
                style={[s.navBouton, s.navSuivant]}
                accessibilityRole="button"
              >
                <Text style={[s.navTexte, s.navTexteSuivant]}>Copié : vider</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Question({ p, r, onChoisir, onNote, onImage }: { p: PointFil; r?: Reponse; onChoisir: (c: string) => void; onNote: (n: string) => void; onImage: (i: number) => void }) {
  const choix = p.options ?? Object.entries(LIBELLE_CHOIX).map(([id, label]) => ({ id, label }));
  return (
    <View style={s.carte}>
      <View style={s.corpsQuestion}>
        <Text style={[s.chemin, { color: teinte(p) }]}>{cheminPoint(p)}</Text>
        <Text style={s.titreQuestion}>{p.titre}</Text>
        {(!!p.images?.length || p.lien) && (
          <View style={s.boutonsImages}>
            {p.images?.map((im, i) => (
              <Pressable key={im.src} onPress={() => onImage(i)} style={s.boutonImage} accessibilityRole="button" accessibilityLabel={`Voir la capture ${im.label}`}>
                <Text style={s.boutonImageTexte}>🖼️ {im.label || `Capture ${i + 1}`}</Text>
              </Pressable>
            ))}
            {p.lien && (
              <Pressable onPress={() => Linking.openURL(p.lien!.url)} style={s.boutonImage} accessibilityRole="link">
                <Text style={s.boutonImageTexte}>↗ {p.lien.label}</Text>
              </Pressable>
            )}
          </View>
        )}
        {!!p.objectif && (
          <View style={s.bloc}>
            <Text style={s.blocTitre}>Objectif</Text>
            <Text style={s.blocTexte}>{p.objectif}</Text>
          </View>
        )}
        {!!p.explication && (
          <View style={s.bloc}>
            <Text style={s.blocTitre}>Ce que ça fait</Text>
            <Text style={s.blocTexte}>{p.explication}</Text>
          </View>
        )}
        <View style={s.choix}>
          {choix.map((c) => {
            const on = r?.choix === c.id;
            return (
              <Pressable key={c.id} onPress={() => onChoisir(on ? '' : c.id)} style={[s.choixBouton, on && (c.id === 'revoir' ? s.choixRevoir : s.choixOn)]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                <Text style={[s.choixTexte, on && s.choixTexteOn]}>
                  {on ? '✓ ' : ''}
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={r?.note ?? ''}
          onChangeText={onNote}
          placeholder={r?.choix === 'revoir' ? 'Qu’est-ce qui est à revoir ?' : 'Votre remarque (facultatif)'}
          placeholderTextColor="#9AA3AF"
          multiline
          style={s.note}
        />
      </View>
    </View>
  );
}

function Visionneuse({ viewer, onChange }: { viewer: { p: PointFil; i: number } | null; onChange: (v: { p: PointFil; i: number } | null) => void }) {
  const images = viewer?.p.images ?? [];
  const im = viewer ? images[viewer.i] : undefined;
  return (
    <Modal visible={!!im} transparent animationType="fade" onRequestClose={() => onChange(null)}>
      <View style={s.fondNoir}>
        <View style={s.visionneuseHaut}>
          <Text style={s.visionneuseTitre} numberOfLines={1}>
            {im?.label} · {(viewer?.i ?? 0) + 1}/{images.length}
          </Text>
          <Pressable onPress={() => onChange(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
            <Text style={s.visionneuseFermer}>✕</Text>
          </Pressable>
        </View>
        {im && <Image source={{ uri: im.src }} style={s.image} resizeMode="contain" accessibilityLabel={im.label} />}
        <View style={s.visionneuseBas}>
          <Pressable disabled={!viewer || viewer.i === 0} onPress={() => viewer && onChange({ ...viewer, i: viewer.i - 1 })} style={[s.fleche, (!viewer || viewer.i === 0) && s.inactif]} accessibilityLabel="Capture précédente">
            <Text style={s.flecheTexte}>‹</Text>
          </Pressable>
          <Pressable
            disabled={!viewer || viewer.i >= images.length - 1}
            onPress={() => viewer && onChange({ ...viewer, i: viewer.i + 1 })}
            style={[s.fleche, (!viewer || viewer.i >= images.length - 1) && s.inactif]}
            accessibilityLabel="Capture suivante"
          >
            <Text style={s.flecheTexte}>›</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Backlog({
  cat,
  onCat,
  lotOuvert,
  etapeOuverte,
  onLot,
  onEtape,
  onPoint,
}: {
  cat: Categorie;
  onCat: (c: Categorie) => void;
  lotOuvert: number | null;
  etapeOuverte: string | null;
  onLot: (n: number | null) => void;
  onEtape: (id: string | null) => void;
  onPoint: (p: PointFil) => void;
}) {
  const lot = FIL.lots.find((l) => l.num === lotOuvert);
  const etape = lot?.etapes.find((e) => e.id === etapeOuverte);
  const pointsDe = (n: number, e?: string) => FIL.points.filter((p) => p.espace === 'projet' && p.lot === n && (!e || p.etape === e));
  const ouvertsDe = (n: number, e?: string) => pointsDe(n, e).filter(ouvert).length;
  const lots = FIL.lots.filter((l) => cat === 'tous' || categorie(l) === cat);

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      {/* Fil : Missions › Lot › Étape (toucher un niveau y revient) */}
      <View style={s.fil}>
        <Pressable onPress={() => onLot(null)} disabled={!lot} accessibilityRole="button">
          <Text style={[s.filTexte, !lot && s.filCourant]}>Missions</Text>
        </Pressable>
        {lot && (
          <>
            <Text style={s.filSep}>›</Text>
            <Pressable onPress={() => onEtape(null)} disabled={!etape} accessibilityRole="button">
              <Text style={[s.filTexte, !etape && s.filCourant]}>Lot {lot.num}</Text>
            </Pressable>
          </>
        )}
        {etape && (
          <>
            <Text style={s.filSep}>›</Text>
            <Text style={[s.filTexte, s.filCourant]} numberOfLines={1}>
              {etape.titre}
            </Text>
          </>
        )}
      </View>

      {!lot && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.espaces}>
            {CATEGORIES.map((c) => {
              const n = c.id === 'tous' ? FIL.lots.length : FIL.lots.filter((l) => categorie(l) === c.id).length;
              return (
                <Pressable key={c.id} onPress={() => onCat(c.id)} style={[s.puce, cat === c.id && s.puceOn]} accessibilityRole="button" accessibilityState={{ selected: cat === c.id }}>
                  <Text style={[s.puceTexte, cat === c.id && s.puceTexteOn]}>
                    {c.label} · {n}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={s.carte}>
            {lots.map((l, i) => {
              const a = avancementLot(l);
              const n = ouvertsDe(l.num);
              return (
                <Pressable key={l.num} onPress={() => onLot(l.num)} style={[s.ligne, i > 0 && s.ligneBord]} accessibilityRole="button">
                  <View style={s.corps}>
                    <Text style={s.titre}>
                      <Text style={{ color: TEINTES[(l.num - 1) % TEINTES.length] }}>Lot {l.num}</Text> · {l.titre}
                    </Text>
                    <Text style={s.meta}>
                      {l.etat} · {a.faites}/{a.total} étapes
                    </Text>
                    <View style={s.barre}>
                      <View style={[s.barreRemplie, { width: `${Math.round(a.ratio * 100)}%`, backgroundColor: TEINTES[(l.num - 1) % TEINTES.length] }]} />
                    </View>
                  </View>
                  {n > 0 && <Text style={s.badge}>💬 {n}</Text>}
                  <Text style={s.chev}>›</Text>
                </Pressable>
              );
            })}
            {!lots.length && <Text style={s.vide}>Aucune mission dans ce filtre.</Text>}
          </View>
        </>
      )}

      {lot && !etape && (
        <View style={s.carte}>
          {lot.etapes.map((e, i) => {
            const nb = pointsDe(lot.num, e.id).length;
            const n = ouvertsDe(lot.num, e.id);
            return (
              <Pressable key={e.id} onPress={() => onEtape(e.id)} style={[s.ligne, i > 0 && s.ligneBord]} accessibilityRole="button">
                <Text style={[s.etat, e.fait && s.etatFait]}>{e.fait ? '✓' : '○'}</Text>
                <View style={s.corps}>
                  <Text style={s.titre}>{e.titre}</Text>
                  <Text style={s.meta}>
                    {nb} point{nb > 1 ? 's' : ''}
                    {n ? ` · ${n} à répondre` : ''}
                  </Text>
                </View>
                <Text style={s.chev}>›</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {lot && etape && (
        <View style={s.carte}>
          {pointsDe(lot.num, etape.id).map((p, i) => (
            <Pressable key={p.id} onPress={() => ouvert(p) && onPoint(p)} disabled={!ouvert(p)} style={[s.ligne, i > 0 && s.ligneBord]} accessibilityRole="button">
              <Text style={[s.etat, !ouvert(p) && s.etatFait]}>{ouvert(p) ? '💬' : '✓'}</Text>
              <View style={s.corps}>
                <Text style={s.titre}>{p.titre}</Text>
                <Text style={s.meta}>{ouvert(p) ? 'À répondre' : p.decision ? `Tranché · ${p.decision}` : 'Tranché'}</Text>
              </View>
              {ouvert(p) && <Text style={s.chev}>›</Text>}
            </Pressable>
          ))}
          {!pointsDe(lot.num, etape.id).length && <Text style={s.vide}>Aucun point pour cette étape.</Text>}
        </View>
      )}
      <Text style={s.aide}>Mis à jour par Claude le {FIL.maj.split('-').reverse().join('/')}. Avancement d'une mission : étapes terminées ÷ total.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1 },
  scroll: { paddingBottom: 130 },
  segments: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, backgroundColor: '#E6EAF0', borderRadius: 10, padding: 3 },
  segment: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.card },
  segmentTexte: { fontSize: 13, fontWeight: '700', color: colors.muted },
  segmentTexteOn: { color: colors.text },
  espaces: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginTop: 12, marginBottom: 10 },
  puce: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  puceOn: { backgroundColor: colors.text, borderColor: colors.text },
  puceTexte: { fontSize: 12.5, fontWeight: '600', color: colors.text },
  puceTexteOn: { color: '#fff' },
  message: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  messageTexte: { flex: 1, fontSize: 13, color: colors.text },
  messageFermer: { fontSize: 14, color: colors.muted },
  position: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 8 },
  positionTexte: { fontSize: 12.5, fontWeight: '700', color: colors.muted },
  points: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1 },
  point: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D5DBE4' },
  pointRepondu: { backgroundColor: colors.success },
  pointCourant: { transform: [{ scale: 1.4 }], borderWidth: 1, borderColor: colors.text },
  carte: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  corpsQuestion: { padding: 14, gap: 10 },
  chemin: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  titreQuestion: { fontSize: 17, fontWeight: '700', color: colors.text },
  boutonsImages: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  boutonImage: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EEF3FD' },
  boutonImageTexte: { fontSize: 13, fontWeight: '600', color: colors.primary },
  bloc: { gap: 2 },
  blocTitre: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  blocTexte: { fontSize: 14, color: colors.text, lineHeight: 20 },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  choixBouton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  choixOn: { backgroundColor: colors.success, borderColor: colors.success },
  choixRevoir: { backgroundColor: colors.warning, borderColor: colors.warning },
  choixTexte: { fontSize: 14, fontWeight: '700', color: colors.text },
  choixTexteOn: { color: '#fff' },
  note: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: colors.text, backgroundColor: '#FAFBFC' },
  nav: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 10 },
  navBouton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  navSuivant: { backgroundColor: colors.primary, borderColor: colors.primary },
  navTexte: { fontSize: 14, fontWeight: '700', color: colors.text },
  navTexteSuivant: { color: '#fff' },
  inactif: { opacity: 0.4 },
  copier: { marginHorizontal: 16, marginTop: 18, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.text },
  copierInactif: { backgroundColor: '#E6EAF0' },
  copierTexte: { fontSize: 15, fontWeight: '800', color: '#fff' },
  copierTexteInactif: { color: colors.muted },
  aide: { marginHorizontal: 16, marginTop: 10, fontSize: 12.5, color: colors.muted },
  fil: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 12 },
  filTexte: { fontSize: 13, fontWeight: '700', color: colors.primary },
  filCourant: { color: colors.text },
  filSep: { color: colors.muted },
  ligne: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  corps: { flex: 1, gap: 3 },
  titre: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12.5, color: colors.muted },
  barre: { height: 5, borderRadius: 3, backgroundColor: '#E3E7EE', overflow: 'hidden', marginTop: 4 },
  barreRemplie: { height: '100%', borderRadius: 3 },
  badge: { fontSize: 12.5, fontWeight: '700', color: colors.warning },
  chev: { fontSize: 18, color: '#A0A6B1' },
  etat: { width: 22, textAlign: 'center', fontSize: 15, color: colors.muted },
  etatFait: { color: colors.success, fontWeight: '800' },
  vide: { padding: 14, color: colors.muted },
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 16 },
  feuille: { backgroundColor: colors.card, borderRadius: 14, padding: 14, gap: 10, maxWidth: 480, width: '100%', alignSelf: 'center' },
  feuilleTitre: { fontSize: 16, fontWeight: '700', color: colors.text },
  texteCopie: { minHeight: 160, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 13, color: colors.text },
  fondNoir: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  visionneuseHaut: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  visionneuseTitre: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
  visionneuseFermer: { color: '#fff', fontSize: 20 },
  image: { flex: 1, width: '100%' },
  visionneuseBas: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14 },
  fleche: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  flecheTexte: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
