import { createContext, useContext, useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PieceEntree, PieceJointe } from '../api';
import { adressePiece, ouvrirPiece } from '../fichiers';
import { colors } from '../theme';
import type { Echange } from '../types';

/**
 * Pièces jointes d'un échange : vignettes des images (toucher → visionneuse plein écran, ‹ › pour passer de l'une à
 * l'autre, ✕ pour sortir) et fichiers (📄 nom · taille, « Ouvrir »). Chargées seulement à l'affichage, une fois.
 */
export const PiecesContext = createContext<((e: Echange) => Promise<PieceJointe[]>) | null>(null);

const cache = new Map<string, Promise<PieceJointe[]>>();
export const idsPieces = (e: Pick<Echange, 'pieces_jointes'>) => (e.pieces_jointes ?? '').split(';').filter(Boolean);
export const estImage = (p: { type: string }) => p.type.startsWith('image/');
export const taillePiece = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1000))} Ko`);

/** Pièces jointes d'un échange reçu ou envoyé */
export function PiecesEchange({ e }: { e: Echange }) {
  const charger = useContext(PiecesContext);
  const ids = idsPieces(e);
  const cle = `${e.id}:${e.pieces_jointes ?? ''}`;
  const [pieces, setPieces] = useState<PieceJointe[] | null>(null);
  const [erreur, setErreur] = useState(false);
  useEffect(() => {
    if (!ids.length || !charger) return;
    let p = cache.get(cle);
    if (!p) {
      p = charger(e);
      cache.set(cle, p);
      p.catch(() => cache.delete(cle));
    }
    let actif = true;
    p.then((x) => actif && setPieces(x)).catch(() => actif && setErreur(true));
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, charger]);
  if (!ids.length) return null;
  if (erreur) return <Text style={s.meta}>📎 {ids.length} pièce{ids.length > 1 ? 's' : ''} jointe{ids.length > 1 ? 's' : ''} : chargement impossible.</Text>;
  if (!pieces) return <Text style={s.meta}>📎 Chargement de {ids.length} pièce{ids.length > 1 ? 's' : ''} jointe{ids.length > 1 ? 's' : ''}…</Text>;
  return <ListePieces pieces={pieces} />;
}

/** Vignettes et fichiers ; `onRetirer` : pièces pas encore envoyées (✕ discret) */
export function ListePieces({ pieces, onRetirer }: { pieces: (PieceJointe | (PieceEntree & { id?: string }))[]; onRetirer?: (i: number) => void }) {
  const [vue, setVue] = useState<number | null>(null);
  const images = pieces.filter(estImage);
  const fichiers = pieces.filter((p) => !estImage(p));
  const indexDe = (p: (typeof pieces)[number]) => pieces.indexOf(p);
  return (
    <View style={s.pieces}>
      {images.length > 0 && (
        <View style={s.vignettes}>
          {images.map((p, k) => (
            <View key={`${p.nom}${k}`}>
              <Pressable onPress={() => setVue(k)} accessibilityRole="imagebutton" accessibilityLabel={`Voir ${p.nom}`}>
                <Image source={{ uri: adressePiece(p) }} style={s.vignette} resizeMode="cover" />
              </Pressable>
              {onRetirer && (
                <Pressable onPress={() => onRetirer(indexDe(p))} hitSlop={8} style={s.retirerImage} accessibilityRole="button" accessibilityLabel={`Retirer ${p.nom}`}>
                  <Text style={s.retirerImageTexte}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
      {fichiers.map((p, k) => (
        <View key={`${p.nom}${k}`} style={s.fichier}>
          <Text style={s.fichierNom} numberOfLines={1}>
            📄 {p.nom} <Text style={s.meta}>· {taillePiece('taille' in p ? p.taille : Math.floor((p.donnees.length * 3) / 4))}</Text>
          </Text>
          {onRetirer ? (
            <Pressable onPress={() => onRetirer(indexDe(p))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Retirer ${p.nom}`}>
              <Text style={s.croix}>✕</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => ouvrirPiece(p as PieceJointe)} hitSlop={6} accessibilityRole="button">
              <Text style={s.ouvrir}>Ouvrir</Text>
            </Pressable>
          )}
        </View>
      ))}
      <Visionneuse images={images} index={vue} onIndex={setVue} />
    </View>
  );
}

/** Image en plein écran : ‹ › pour naviguer, ✕ pour sortir */
export function Visionneuse({ images, index, onIndex }: { images: { nom: string; type: string; donnees: string }[]; index: number | null; onIndex: (i: number | null) => void }) {
  const p = index === null ? null : images[index];
  const n = images.length;
  return (
    <Modal visible={!!p} transparent animationType="fade" onRequestClose={() => onIndex(null)}>
      <SafeAreaView style={s.noir} edges={['top', 'bottom']}>
        <View style={s.haut}>
          <Text style={s.compteur} numberOfLines={1}>
            {index !== null ? `${index + 1} / ${n}` : ''} {p ? `· ${p.nom}` : ''}
          </Text>
          <Pressable onPress={() => onIndex(null)} hitSlop={12} style={s.fermer} accessibilityRole="button" accessibilityLabel="Fermer">
            <Text style={s.fermerTexte}>✕</Text>
          </Pressable>
        </View>
        <View style={s.centre}>{!!p && <Image source={{ uri: adressePiece(p) }} style={s.grande} resizeMode="contain" />}</View>
        {n > 1 && index !== null && (
          <View style={s.fleches}>
            <Pressable disabled={index === 0} onPress={() => onIndex(index - 1)} style={[s.fleche, index === 0 && s.inactif]} accessibilityRole="button" accessibilityLabel="Image précédente">
              <Text style={s.flecheTexte}>‹</Text>
            </Pressable>
            <Pressable disabled={index === n - 1} onPress={() => onIndex(index + 1)} style={[s.fleche, index === n - 1 && s.inactif]} accessibilityRole="button" accessibilityLabel="Image suivante">
              <Text style={s.flecheTexte}>›</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  pieces: { gap: 8, marginTop: 6 },
  vignettes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vignette: { width: 84, height: 84, borderRadius: 10, backgroundColor: '#EEF1F6', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  retirerImage: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  retirerImageTexte: { color: '#fff', fontSize: 12, fontWeight: '700' },
  fichier: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  fichierNom: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  meta: { fontSize: 12.5, color: colors.muted, fontWeight: '400' },
  ouvrir: { fontSize: 14, fontWeight: '700', color: colors.primary },
  croix: { fontSize: 14, color: '#9AA1AD', paddingHorizontal: 4 },
  noir: { flex: 1, backgroundColor: '#000' },
  haut: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  compteur: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  fermer: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  fermerTexte: { color: '#fff', fontSize: 17, fontWeight: '700' },
  centre: { flex: 1, paddingHorizontal: 8 },
  grande: { flex: 1, width: '100%' },
  fleches: { flexDirection: 'row', justifyContent: 'center', gap: 40, paddingVertical: 14 },
  fleche: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  flecheTexte: { color: '#fff', fontSize: 30, fontWeight: '600', lineHeight: 34 },
  inactif: { opacity: 0.3 },
});
