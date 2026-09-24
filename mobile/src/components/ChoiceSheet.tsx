import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

export interface Choice {
  label: string;
  onPress: () => void;
  principal?: boolean;
}

/** Petite fenêtre de choix (le navigateur n'affiche pas les boîtes de dialogue natives). */
export function ChoiceSheet({
  visible,
  title,
  message,
  choices,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  choices: Choice[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}} accessibilityRole="alert">
          <Text style={s.title}>{title}</Text>
          {!!message && <Text style={s.message}>{message}</Text>}
          {choices.map((c) => (
            <Pressable
              key={c.label}
              style={[s.btn, c.principal ? s.btnMain : s.btnSec]}
              onPress={() => {
                onClose();
                c.onPress();
              }}
              accessibilityRole="button"
            >
              <Text style={[s.btnText, !c.principal && s.btnTextSec]}>{c.label}</Text>
            </Pressable>
          ))}
          <Pressable style={s.cancel} onPress={onClose} accessibilityRole="button">
            <Text style={s.cancelText}>Annuler</Text>
          </Pressable>
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
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
    gap: 10,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  message: { fontSize: 14, lineHeight: 20, color: colors.muted },
  btn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
  btnMain: { backgroundColor: colors.primary },
  btnSec: { borderWidth: 1, borderColor: colors.primary },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' },
  btnTextSec: { color: colors.primary },
  cancel: { paddingVertical: 8, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 15 },
});
