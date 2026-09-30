import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export interface Choice {
  label: string;
  onPress: () => void;
  /** Ligne mise en avant (bleu, gras) : « ＋ Nouvelle … », l'action attendue */
  principal?: boolean;
  /** Action qui détruit (supprimer) : en rouge */
  danger?: boolean;
  /** Ligne qui ouvre une autre feuille : « › » à droite */
  suite?: boolean;
  /** Aide en gris sous la ligne */
  sous?: string;
  /** Ligne grisée, pas touchable (avec la raison en `sous`) */
  inactif?: boolean;
  /** Garder la feuille ouverte après le toucher */
  garder?: boolean;
}

/**
 * Feuille de choix (menus du ＋, confirmations) : même modèle que les feuilles de choix — « Annuler » en haut à
 * gauche, titre centré, explication en gris, puis une ligne par choix. (Le navigateur n'affiche pas les boîtes
 * de dialogue natives.) Une seule action attendue : bouton bleu plein en bas, comme « Ajouter » des feuilles à cocher.
 */
export function ChoiceSheet({
  visible,
  title,
  message,
  choices,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  message?: string;
  choices: Choice[];
  onClose: () => void;
  /** Lignes de la feuille avant les choix (ex. l'itération du ＋ de l'écran PI, une date) */
  children?: ReactNode;
}) {
  // Une seule action attendue (question « Déplacer en IT2 ? ») : le bouton bleu plein de l'application, en bas
  const seul = choices.length === 1 && choices[0].principal ? choices[0] : null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}} accessibilityRole="alert">
          <View style={s.poignee} />
          <View style={s.entete}>
            <Pressable onPress={onClose} hitSlop={8} style={s.annuler} accessibilityRole="button">
              <Text style={s.annulerTexte}>Annuler</Text>
            </Pressable>
            <Text style={s.title} numberOfLines={2}>
              {title}
            </Text>
            <View style={s.annuler} />
          </View>
          {!!message && <Text style={s.message}>{message}</Text>}
          {children && <View style={s.haut}>{children}</View>}
          {seul ? (
            <>
              <Pressable
                style={[s.bouton, seul.inactif && s.inactif]}
                disabled={seul.inactif}
                onPress={() => {
                  if (!seul.garder) onClose();
                  seul.onPress();
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!seul.inactif }}
              >
                <Text style={s.boutonTexte}>{seul.label}</Text>
              </Pressable>
              {!!seul.sous && <Text style={[s.sous, s.sousBouton]}>{seul.sous}</Text>}
            </>
          ) : (
          <View style={s.liste}>
            {choices.map((c) => (
              <Pressable
                key={c.label}
                style={[s.ligne, c.inactif && s.inactif]}
                disabled={c.inactif}
                onPress={() => {
                  if (!c.garder) onClose();
                  c.onPress();
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!c.inactif }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.ligneTexte, c.principal && s.principal, c.danger && s.danger]}>{c.label}</Text>
                  {!!c.sous && <Text style={s.sous}>{c.sous}</Text>}
                </View>
                {c.suite && <Text style={s.chev}>›</Text>}
              </Pressable>
            ))}
          </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#C9CED6', marginTop: 8 },
  entete: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, gap: 8 },
  annuler: { width: 70 },
  annulerTexte: { color: colors.primary, fontSize: 16 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text },
  message: { fontSize: 13.5, lineHeight: 19, color: colors.muted, paddingHorizontal: 16, paddingBottom: 10 },
  liste: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  ligneTexte: { flex: 1, fontSize: 15, color: colors.text },
  principal: { color: colors.primary, fontWeight: '700' },
  danger: { color: colors.danger, fontWeight: '700' },
  sous: { fontSize: 12, color: colors.muted, marginTop: 2 },
  inactif: { opacity: 0.45 },
  haut: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.card, marginBottom: 10 },
  bouton: { marginHorizontal: 12, marginTop: 4, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  boutonTexte: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  sousBouton: { paddingHorizontal: 16, marginTop: 6, textAlign: 'center' },
  chev: { fontSize: 18, color: '#A0A6B1', marginLeft: 8 },
});
