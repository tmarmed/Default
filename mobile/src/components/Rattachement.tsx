import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * Parent d'un élément enregistré (feature d'une tâche, epic d'une feature, portfolio d'un train…) : affiché sur une
 * ligne avec « ↪ Déplacer », pour ne pas en changer d'un simple appui. « Déplacer » montre le choix (`children`) :
 * parents existants, « ＋ Vers un nouveau … », Aucun. Le déplacement n'est fait qu'à l'enregistrement de la fiche.
 * Sans parent au départ (ou élément nouveau), le choix est montré directement.
 */
export function Rattachement({
  label,
  verrouille,
  resume,
  deplace,
  onAnnuler,
  children,
}: {
  label?: string;
  /** L'élément avait un parent à l'ouverture de la fiche */
  verrouille: boolean;
  /** Parent actuel (« 🧩 Préparation physique › Epic Plan d'entraînement ») ; vide = aucun */
  resume: string;
  /** Le parent choisi n'est plus celui du départ */
  deplace: boolean;
  /** Revenir au parent du départ */
  onAnnuler: () => void;
  children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  if (!verrouille) return <>{children}</>;
  return (
    <View>
      {!!label && <Text style={s.label}>{label}</Text>}
      {ouvert ? (
        <>
          {children}
          <Pressable onPress={() => setOuvert(false)} hitSlop={6} style={s.lien} accessibilityRole="button">
            <Text style={s.lienTexte}>✓ Terminer le déplacement</Text>
          </Pressable>
        </>
      ) : (
        <View style={s.ligne}>
          <Text style={s.resume} numberOfLines={3}>
            {resume || 'Aucun rattachement'}
          </Text>
          <Pressable onPress={() => setOuvert(true)} hitSlop={8} style={s.bouton} accessibilityRole="button" accessibilityLabel="Déplacer">
            <Text style={s.boutonTexte}>↪ Déplacer</Text>
          </Pressable>
        </View>
      )}
      {deplace && (
        <View style={s.note}>
          <Text style={s.noteTexte}>{resume ? `Déplacement vers ${resume} à l'enregistrement.` : "Plus de rattachement à l'enregistrement."}</Text>
          <Pressable onPress={onAnnuler} hitSlop={6} accessibilityRole="button">
            <Text style={s.lienTexte}>Annuler le déplacement</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  label: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.muted },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F4F6FA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  resume: { flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: '600', color: colors.text },
  bouton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.primary },
  boutonTexte: { fontSize: 13.5, fontWeight: '700', color: colors.primary },
  lien: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  lienTexte: { fontSize: 13.5, fontWeight: '700', color: colors.primary },
  note: { marginTop: 8, gap: 4, backgroundColor: '#FEF7E0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  noteTexte: { fontSize: 13, color: '#7A5A00' },
});
