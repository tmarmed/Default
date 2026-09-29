import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Alerte, Alignement } from '../alerts';
import { colors } from '../theme';
import { EPIC_COULEURS } from '../types';
import { TexteAjuste } from './TexteAjuste';

/** Largeur du bouton « ‹ Fiche d'en dessous » (pile de fiches) */
const RETOUR_MAX = 120;
/** Variantes du bouton « ‹ … » : le premier nom qui tient, sinon « ‹ Retour » */
const variantesRetour = (r: string | string[]) => [...(Array.isArray(r) ? r : [r]).map((v) => `‹ ${v}`), '‹ Retour'];
const nomRetour = (r: string | string[]) => (Array.isArray(r) ? r[0] : r);

interface Props {
  visible: boolean;
  title: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  /** Absent : fenêtre de consultation (« Fermer », pas d'« Enregistrer ») */
  onSave?: () => void;
  children: ReactNode;
  /**
   * Pile de fiches : fiche ouverte depuis une autre (« ＋ Train » dans un portfolio…). `retour` = nom de la fiche
   * d'en dessous (bouton « ‹ Digital » au lieu d'« Annuler »), `chemin` = fil en haut (« 💼 Digital › 🚆 Nouveau
   * train »), `onFermerTout` = fermer toute la pile.
   */
  retour?: string | string[];
  chemin?: string;
  onFermerTout?: () => void;
}

/** Pile de fiches : fiche d'en dessous (« ‹ … »), fil en haut, tout fermer */
export interface PileProps {
  retour?: string | string[];
  chemin?: string;
  onFermerTout?: () => void;
}
/** Élément créé dans la fiche du dessus, à choisir dans un champ de la fiche d'en dessous */
export interface Injection {
  champ: string;
  id: string;
  n: number;
}

/** En-tête de la pile pour les fiches qui ont leur propre en-tête (Tâche, Epic) : fil et « Tout fermer » */
export function CheminPile({ pile }: { pile?: PileProps }) {
  if (!pile?.chemin) return null;
  return (
    <View style={styles.chemin}>
      <Text style={styles.cheminTexte}>{pile.chemin}</Text>
      {pile.onFermerTout && (
        <Pressable onPress={pile.onFermerTout} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer toutes les fiches">
          <Text style={styles.fermerTout}>✕ Tout fermer</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Bouton gauche de l'en-tête : « ‹ fiche d'en dessous » dans une pile, sinon « Annuler » */
export function BoutonRetour({ pile, onPress, disabled, style }: { pile?: PileProps; onPress: () => void; disabled?: boolean; style: object }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} disabled={disabled} accessibilityRole="button" accessibilityLabel={pile?.retour ? `Retour à ${nomRetour(pile.retour)}` : undefined}>
      {pile?.retour ? <TexteAjuste variantes={variantesRetour(pile.retour)} taille={16} min={12} dispo={RETOUR_MAX} style={style} /> : <Text style={style}>Annuler</Text>}
    </Pressable>
  );
}

/** Fenêtre de formulaire : Annuler / titre / Enregistrer, message d'erreur, contenu défilant. */
export function FormSheet({ visible, title, busy, error, onClose, onSave, children, retour, chemin, onFermerTout }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} disabled={busy} accessibilityRole="button" accessibilityLabel={retour ? `Retour à ${nomRetour(retour)}` : undefined}>
            {retour ? (
              // Jamais coupé « … » : le texte rapetisse si le nom est long
              <TexteAjuste variantes={variantesRetour(retour)} taille={16} min={12} dispo={RETOUR_MAX} style={styles.headerBtn} />
            ) : (
              <Text style={styles.headerBtn}>{onSave ? 'Annuler' : 'Fermer'}</Text>
            )}
          </Pressable>
          {retour ? (
            <TexteAjuste variantes={[title]} taille={16} min={12} dispo={Math.min(Dimensions.get('window').width, 480) - RETOUR_MAX - 150} style={styles.headerTitle} />
          ) : (
            <Text style={styles.headerTitle}>{title}</Text>
          )}
          {onSave ? (
            <Pressable onPress={onSave} hitSlop={10} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.headerBtn, styles.bold]}>Enregistrer</Text>}
            </Pressable>
          ) : (
            <View style={{ width: 60, alignItems: 'flex-end' }}>{busy && <ActivityIndicator color={colors.primary} />}</View>
          )}
        </View>
        {!!chemin && (
          <View style={styles.chemin}>
            <Text style={styles.cheminTexte}>{chemin}</Text>
            {onFermerTout && (
              <Pressable onPress={onFermerTout} hitSlop={8} disabled={busy} accessibilityRole="button" accessibilityLabel="Fermer toutes les fiches">
                <Text style={styles.fermerTout}>✕ Tout fermer</Text>
              </Pressable>
            )}
          </View>
        )}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {error && <Text style={styles.error}>{error}</Text>}
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />;
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={styles.swatches}>
      {EPIC_COULEURS.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === c }}
          accessibilityLabel={`Couleur ${c}`}
          style={[styles.swatch, { backgroundColor: c }, value === c && styles.swatchOn]}
        />
      ))}
    </View>
  );
}

/**
 * Alertes de dates avec deux boutons : ajuster le parent (champs du formulaire) ou aligner l'élément
 * (tâche, epic) sur le parent, enregistré tout de suite.
 */
export function AlertList({
  alertes,
  onFix,
  onAlign,
}: {
  alertes: Alerte[];
  onFix: (a: Alerte) => void;
  onAlign?: (a: Alignement) => void;
}) {
  return (
    <>
      {alertes.map((a) => (
        <View key={a.key} style={styles.alert}>
          <Text style={styles.alertText}>⚠ {a.message}</Text>
          <View style={styles.alertBtns}>
            <Pressable style={styles.alertBtn} onPress={() => onFix(a)} accessibilityRole="button">
              <Text style={styles.alertBtnText}>{a.bouton}</Text>
            </Pressable>
            {a.aligner && onAlign && (
              <Pressable style={[styles.alertBtn, styles.alertBtn2]} onPress={() => onAlign(a.aligner!)} accessibilityRole="button">
                <Text style={[styles.alertBtnText, styles.alertBtnText2]}>{a.aligner.bouton}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </>
  );
}

/** Boutons « + niveau suivant » et « Ouvrir dans l'assistant » d'une fiche existante. */
export function ChildActions({ actions }: { actions: { label: string; onPress: () => void; primary?: boolean }[] }) {
  return (
    <View style={styles.actions}>
      {actions.map((a) => (
        <Pressable key={a.label} style={[styles.action, a.primary && styles.actionPrimary]} onPress={a.onPress} accessibilityRole="button">
          <Text style={[styles.actionText, a.primary && styles.actionTextPrimary]}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Progress({ ratio, color }: { ratio: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

export const formStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  // minWidth 0 : sinon un champ texte garde sa largeur naturelle et déborde
  flex: { flex: 1, minWidth: 0 },
  notes: { minHeight: 90, textAlignVertical: 'top' },
  hint: { marginTop: 6, fontSize: 12, lineHeight: 17, color: colors.muted },
  muted: { fontSize: 13, color: colors.muted },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  linkTitle: { flex: 1, fontSize: 15, color: colors.text },
  preview: { borderRadius: 12, padding: 14, marginBottom: 16 },
  previewTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  previewSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 },
  titleInput: { fontSize: 18, fontWeight: '500' },
  pickBtn: { alignSelf: 'flex-start', marginTop: 8, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.primary },
  pickText: { color: colors.primary, fontSize: 13.5, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  chemin: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#EEF3FD', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  cheminTexte: { flex: 1, fontSize: 12.5, fontWeight: '700', color: colors.primary },
  fermerTout: { fontSize: 12.5, fontWeight: '700', color: colors.muted },
  headerBtn: { fontSize: 16, color: colors.primary },
  bold: { fontWeight: '600' },
  content: { padding: 16, paddingBottom: 48 },
  error: { color: colors.danger, backgroundColor: '#FCE8E6', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 14 },
  label: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  swatchOn: { borderWidth: 3, borderColor: colors.text },
  alert: { marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: '#FCE8E6', gap: 8 },
  alertText: { color: '#A50E0E', fontSize: 13.5, lineHeight: 19 },
  alertBtn: { maxWidth: '100%', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.danger },
  alertBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  // Boutons l'un sous l'autre : leur texte (avec les noms) peut passer à la ligne
  alertBtns: { gap: 8, alignItems: 'flex-start' },
  alertBtn2: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.danger },
  alertBtnText2: { color: colors.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  action: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.primary },
  actionPrimary: { backgroundColor: colors.primary },
  actionText: { color: colors.primary, fontSize: 13.5, fontWeight: '700' },
  actionTextPrimary: { color: '#fff' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginVertical: 8 },
  progressFill: { height: 8, borderRadius: 4 },
});
