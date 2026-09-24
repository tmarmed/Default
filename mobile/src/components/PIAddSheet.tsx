import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { iterationOf, iterationsOf, piLabel } from '../pi';
import { colors } from '../theme';
import { Chips } from './Chips';

export type AddKind = 'newFeature' | 'pickFeature' | 'newTask' | 'pickTask';

interface Props {
  visible: boolean;
  piKey: string;
  onClose: () => void;
  /** itKey vide = sans itération (features seulement) */
  onChoose: (kind: AddKind, itKey: string) => void;
}

const CHOIX: { kind: AddKind; icon: string; label: string; sub: string; tache: boolean }[] = [
  { kind: 'newFeature', icon: '🧩', label: 'Nouvelle feature', sub: 'Choix de l’epic dans la fiche', tache: false },
  { kind: 'pickFeature', icon: '📥', label: 'Feature existante', sub: 'Toutes les epics, avec recherche', tache: false },
  { kind: 'newTask', icon: '✓', label: 'Nouvelle tâche hors feature', sub: 'Directement dans l’itération', tache: true },
  { kind: 'pickTask', icon: '📥', label: 'Tâche existante', sub: 'Tâches sans feature ni date', tache: true },
];

/** Écran PI : un seul « + » → itération, puis quoi ajouter. */
export function PIAddSheet({ visible, piKey, onClose, onChoose }: Props) {
  const its = iterationsOf(piKey);
  const [itKey, setItKey] = useState('');

  useEffect(() => {
    if (!visible) return;
    const now = iterationOf(new Date()).key;
    setItKey(now.startsWith(`${piKey}-`) ? now : its[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, piKey]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.title}>Ajouter au PI {piLabel(piKey)}</Text>
          <Text style={s.label}>Itération</Text>
          <Chips
            options={[...its.map((it) => ({ value: it.key, label: it.code })), { value: '', label: 'Sans itération' }]}
            value={itKey}
            onChange={setItKey}
            compact
            wrap
          />
          <Text style={s.label}>Quoi ?</Text>
          {CHOIX.map((c) => {
            const off = c.tache && !itKey;
            return (
              <Pressable
                key={c.kind}
                style={[s.row, off && s.off]}
                disabled={off}
                accessibilityRole="button"
                accessibilityState={{ disabled: off }}
                onPress={() => onChoose(c.kind, itKey)}
              >
                <Text style={s.icon}>{c.icon}</Text>
                <View style={s.flex}>
                  <Text style={s.rowTitle}>{c.label}</Text>
                  <Text style={s.sub}>{off ? 'Choisissez une itération' : c.sub}</Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable onPress={onClose} style={s.cancel}>
            <Text style={s.cancelText}>Annuler</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28, gap: 4 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  label: { marginTop: 12, marginBottom: 6, fontSize: 13, fontWeight: '600', color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  off: { opacity: 0.4 },
  icon: { fontSize: 20, width: 26, textAlign: 'center' },
  flex: { flex: 1 },
  rowTitle: { fontSize: 15.5, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12.5, color: colors.muted },
  cancel: { alignSelf: 'center', paddingTop: 10 },
  cancelText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
