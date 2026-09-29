import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * Choix du parent d'un élément (feature d'une tâche, epic d'une feature, train d'une équipe…) : les puces restent
 * visibles, un appui suffit. Si l'élément avait un parent et qu'on en choisit un autre, un encadré annonce le
 * déplacement, fait à l'enregistrement, avec « Annuler le déplacement » (l'ancien parent est en pointillés).
 */
export function Rattachement({
  deplace,
  depuis,
  vers,
  onAnnuler,
  children,
}: {
  /** Un parent au départ, et un autre choisi maintenant */
  deplace: boolean;
  /** Parent du départ (« 🧩 Compte client mobile ») */
  depuis: string;
  /** Parent choisi ; vide = aucun */
  vers: string;
  /** Revenir au parent du départ */
  onAnnuler: () => void;
  children: ReactNode;
}) {
  return (
    <View>
      {children}
      {deplace && (
        <View style={s.note}>
          <Text style={s.noteTexte}>
            {vers ? `Déplacement de ${depuis} vers ${vers} à l'enregistrement.` : `Retrait de ${depuis} à l'enregistrement (plus de rattachement).`}
          </Text>
          <Pressable onPress={onAnnuler} hitSlop={6} accessibilityRole="button">
            <Text style={s.lienTexte}>Annuler le déplacement</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  lienTexte: { fontSize: 13.5, fontWeight: '700', color: colors.primary },
  note: { marginTop: 8, gap: 4, backgroundColor: '#FEF7E0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  noteTexte: { fontSize: 13, color: '#7A5A00' },
});
