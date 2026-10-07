import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { DEMO } from '../demo';
import { compteRenduRemarques, contexteActuel, ecrireRemarques, lireRemarques, type Remarque } from '../remarquesDemo';
import { colors } from '../theme';

/**
 * Bouton « 📝 » des remarques de la démo (version démo seulement) : languette au bord droit de l'écran et de chaque
 * fenêtre. Il ouvre la fenêtre des remarques avec l'écran, la fenêtre et l'étape pris au moment du toucher.
 */
export function BoutonRemarque() {
  const [ouvert, setOuvert] = useState<ReturnType<typeof contexteActuel> | null>(null);
  if (!DEMO) return null;
  return (
    <>
      <Pressable
        onPress={() => setOuvert(contexteActuel())}
        style={s.languette}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Noter une remarque sur cet écran (démo)"
      >
        <Text style={s.languetteTexte}>📝</Text>
      </Pressable>
      {!!ouvert && <FenetreRemarques contexte={ouvert} onFermer={() => setOuvert(null)} />}
    </>
  );
}

function FenetreRemarques({ contexte, onFermer }: { contexte: ReturnType<typeof contexteActuel>; onFermer: () => void }) {
  const [liste, setListe] = useState<Remarque[]>([]);
  const [texte, setTexte] = useState('');
  const [info, setInfo] = useState('');
  const [effacer, setEffacer] = useState(false);
  useEffect(() => void lireRemarques().then(setListe), []);
  const poser = (l: Remarque[]) => {
    setListe(l);
    ecrireRemarques(l);
  };
  const ajouter = () => {
    if (!texte.trim()) return;
    poser([...liste, { id: `${Date.now()}`, quand: new Date().toISOString(), ...contexte, texte: texte.trim() }]);
    setTexte('');
    setInfo('Remarque ajoutée ✓');
  };
  const copier = async () => {
    const cr = compteRenduRemarques(liste);
    if (!cr) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(cr);
        setInfo('Compte rendu copié ✓ : collez-le dans Claude Code');
      } else {
        await Share.share({ message: cr });
      }
    } catch {
      setInfo('Copie refusée : partagez le texte à la place');
      Share.share({ message: cr }).catch(() => {});
    }
  };
  const ligne = (lib: string, val: string) =>
    !!val && (
      <Text style={s.ctx}>
        <Text style={s.ctxLib}>{lib} </Text>
        {val}
      </Text>
    );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onFermer}>
      <View style={s.voile}>
        <Pressable style={{ flex: 1 }} onPress={onFermer} accessibilityLabel="Fermer" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.feuille}>
          <View style={s.entete}>
            <Pressable onPress={onFermer} hitSlop={10}>
              <Text style={s.lien}>Fermer</Text>
            </Pressable>
            <Text style={s.titre}>Nouvelle remarque</Text>
            <Pressable onPress={ajouter} hitSlop={10} disabled={!texte.trim()}>
              <Text style={[s.lien, s.gras, !texte.trim() && s.inactif]}>Ajouter</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.corps} keyboardShouldPersistTaps="handled">
            <View style={s.bloc}>
              {ligne('Écran', contexte.ecran || '—')}
              {ligne('Fenêtre', contexte.fenetre)}
              {ligne('Étape', contexte.etape)}
            </View>
            <TextInput
              style={s.champ}
              value={texte}
              onChangeText={(t) => {
                setTexte(t);
                setInfo('');
              }}
              placeholder="Votre remarque sur cet écran…"
              placeholderTextColor={colors.muted}
              multiline
              autoFocus
            />
            {!!info && <Text style={s.info}>{info}</Text>}
            <Text style={s.section}>REMARQUES NOTÉES · {liste.length}</Text>
            {liste.length === 0 && <Text style={s.vide}>Aucune pour l’instant. Elles restent dans cet appareil, jamais dans un Sheet.</Text>}
            {liste.map((r) => (
              <View key={r.id} style={s.remarque}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.remarqueTexte}>{r.texte}</Text>
                  <Text style={s.remarqueCtx} numberOfLines={2}>
                    {[r.ecran, r.fenetre, r.etape].filter(Boolean).join(' › ')}
                  </Text>
                </View>
                <Pressable onPress={() => poser(liste.filter((x) => x.id !== r.id))} hitSlop={8} accessibilityLabel="Supprimer la remarque">
                  <Text style={s.croix}>✕</Text>
                </Pressable>
              </View>
            ))}
            {liste.length > 0 && (
              <>
                <Pressable onPress={copier} style={s.bouton} accessibilityRole="button">
                  <Text style={s.boutonTexte}>Copier le compte rendu</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!effacer) return setEffacer(true);
                    poser([]);
                    setEffacer(false);
                    setInfo('Remarques effacées');
                  }}
                  style={s.effacer}
                >
                  <Text style={[s.lien, { color: colors.danger }]}>{effacer ? 'Toucher encore pour tout effacer' : 'Tout effacer'}</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  languette: {
    position: 'absolute',
    right: 0,
    top: '42%',
    zIndex: 50,
    backgroundColor: '#1d2433',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 6,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    opacity: 0.85,
  },
  languetteTexte: { fontSize: 17 },
  voile: { flex: 1, backgroundColor: 'rgba(20,24,32,0.38)' },
  feuille: { maxHeight: '82%', backgroundColor: colors.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  titre: { fontSize: 16, fontWeight: '700', color: colors.text },
  lien: { fontSize: 16, color: colors.primary },
  gras: { fontWeight: '700' },
  inactif: { opacity: 0.4 },
  corps: { padding: 16, gap: 10 },
  bloc: { backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 3 },
  ctx: { fontSize: 13.5, color: colors.text },
  ctxLib: { color: colors.muted, fontWeight: '600' },
  champ: { minHeight: 84, backgroundColor: colors.card, borderRadius: 12, padding: 12, fontSize: 15.5, color: colors.text, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border },
  info: { fontSize: 13, color: colors.success, fontWeight: '600' },
  section: { marginTop: 8, fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.4 },
  vide: { fontSize: 13.5, color: colors.muted },
  remarque: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  remarqueTexte: { fontSize: 14.5, color: colors.text },
  remarqueCtx: { fontSize: 12, color: colors.muted, marginTop: 3 },
  croix: { fontSize: 15, color: colors.muted, paddingHorizontal: 4 },
  bouton: { marginTop: 6, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.primary },
  boutonTexte: { color: '#fff', fontSize: 16, fontWeight: '700' },
  effacer: { alignItems: 'center', paddingVertical: 8 },
});
