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
import { assombrir, colors } from '../theme';
import { EPIC_COULEURS } from '../types';
import { TexteAjuste } from './TexteAjuste';
import { AutoContext, LectureContext } from './EnregistrementAuto';

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
  /** Où est rangé l'élément de la fiche (fil d'Ariane en haut) */
  fil?: string;
  /** Couleur de l'élément : le titre de la barre (son type) la prend */
  couleurTitre?: string;
  /** Espace de travail en tête du fil (plusieurs espaces affichés) */
  espaceFil?: string;
  /** Élément existant enregistré au fil de l'eau : « Fermer », pas d'« Enregistrer », pas de pastilles */
  auto?: boolean;
  /** Bandeau du bas (« … · Annuler ») */
  bandeau?: ReactNode;
  /** Toucher la fiche ferme le bandeau */
  onToucher?: () => void;
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
  /** Nom de l'élément créé (bandeau « … créé et choisi ») */
  nom?: string;
  /** Défaire la création (« Annuler » du bandeau de la fiche du dessous, si elle est enregistrée au fil de l'eau) */
  supprimer?: () => Promise<void>;
}

/**
 * Fil d'Ariane discret, seulement pour l'élément principal de la fiche : petite ligne grise sous le titre (« Pro ›
 * Fidéliser les clients › Application client ») ; dans une pile, un ✕ gris pour fermer toutes les fiches.
 */
export function CheminPile({ pile, fil, espace, disabled }: { pile?: PileProps; fil?: string; espace?: string; disabled?: boolean }) {
  // Le fil montre où est rangé l'élément de la fiche ; à défaut, les fiches de la pile.
  // `espace` : l'espace de travail (« 🏢 ACME »), en tête et en gras, quand plusieurs espaces sont affichés
  const texte = fil || pile?.chemin;
  if (!texte && !espace && !pile?.onFermerTout) return null;
  return (
    <View style={styles.chemin}>
      <Text style={styles.cheminTexte}>
        {!!espace && <Text style={styles.cheminEspace}>{espace}</Text>}
        {!!espace && !!texte && ' › '}
        {texte}
      </Text>
      {pile?.onFermerTout && (
        <Pressable onPress={pile.onFermerTout} hitSlop={10} disabled={disabled} accessibilityRole="button" accessibilityLabel="Fermer toutes les fiches">
          <Text style={styles.fermerTout}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Bouton gauche de l'en-tête : « Annuler » (dans une pile : revient à la fiche d'en dessous sans enregistrer) */
export function BoutonRetour({ pile, onPress, disabled, style, fermer }: { pile?: PileProps; onPress: () => void; disabled?: boolean; style: object; fermer?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={pile?.retour ? `${fermer ? 'Fermer' : 'Annuler'} et revenir à ${nomRetour(pile.retour)}` : undefined}
    >
      <Text style={style}>{fermer ? 'Fermer' : 'Annuler'}</Text>
    </Pressable>
  );
}

/** Fenêtre de formulaire : Annuler / titre / Enregistrer, message d'erreur, contenu défilant. */
export function FormSheet({ visible, title, busy, error, onClose, onSave, children, retour, chemin, onFermerTout, fil, couleurTitre, espaceFil, auto, bandeau, onToucher }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={[styles.header, (!!chemin || !!fil || !!espaceFil) && styles.headerAvecFil]}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={retour ? `Annuler et revenir à ${nomRetour(retour)}` : undefined}
          >
            <Text style={styles.headerBtn}>{onSave && !auto ? 'Annuler' : 'Fermer'}</Text>
          </Pressable>
          {/* Jamais coupé « … » : le titre rapetisse s'il est long */}
          <TitreBarre texte={title} couleur={couleurTitre} avecFil={!!chemin || !!fil || !!espaceFil} />
          {onSave && !auto ? (
            <Pressable onPress={onSave} hitSlop={10} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.headerBtn, styles.bold]}>Enregistrer</Text>}
            </Pressable>
          ) : (
            <View style={{ width: 60, alignItems: 'flex-end' }}>{busy && <ActivityIndicator color={colors.primary} />}</View>
          )}
        </View>
        <CheminPile pile={chemin || onFermerTout ? { chemin, onFermerTout } : undefined} fil={fil} espace={espaceFil} disabled={busy} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onTouchStart={onToucher} onScrollBeginDrag={onToucher}>
            {error && <Text style={styles.error}>{error}</Text>}
            <AutoContext.Provider value={!!auto}>{children}</AutoContext.Provider>
          </ScrollView>
        </KeyboardAvoidingView>
        {bandeau}
      </SafeAreaView>
    </Modal>
  );
}

/**
 * Titre de la barre du haut (le type : « Epic », « Équipe agile »…), en noir, toujours au centre exact de la barre
 * (quelle que soit la largeur d'« Annuler » et d'« Enregistrer »). `couleur` : gardée pour les appels, non utilisée.
 */
export function TitreBarre({ texte, avecFil }: { texte: string; couleur?: string; avecFil?: boolean }) {
  return (
    // Avec le fil d'Ariane, la barre a moins de marge en bas : le titre reste aligné sur Annuler / Enregistrer
    <View pointerEvents="none" style={[styles.titreBarre, avecFil && { top: 6 }]}>
      <TexteAjuste variantes={[texte]} taille={17} min={12} dispo={Math.min(Dimensions.get('window').width, 480) - 200} style={styles.headerTitle} />
    </View>
  );
}

/**
 * Titre d'une fiche : le nom de l'élément, centré en haut de la page (pas dans un cadre), précédé de son logo ;
 * une ligne d'infos dessous (dates, PI…). Le même dans toutes les fiches.
 */
export function TitreFiche({ icone, titre, vide, sous, couleur = colors.primary }: { icone: string; titre: string; vide: string; sous?: string; couleur?: string }) {
  return (
    <View style={styles.titreFiche}>
      <Text style={[styles.titreFicheTexte, !titre && styles.titreFicheVide]}>
        <Text style={{ color: assombrir(couleur) }}>{icone} </Text>
        {titre || vide}
      </Text>
      {!!sous && <Text style={styles.titreFicheSous}>{sous}</Text>}
    </View>
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
  /** Ligne « Aucun … pour l'instant » dans une carte de section */
  videCarte: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.muted },
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
  lecture: { marginBottom: 6, padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.bg },
  lectureTexte: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  lectureContenu: { opacity: 0.85 },
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
  headerAvecFil: { borderBottomWidth: 0, paddingBottom: 6 },
  // Fil d'Ariane discret : collé sous l'en-tête, petit et gris
  chemin: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 0, paddingBottom: 7, backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  cheminTexte: { flex: 1, fontSize: 11.5, color: '#9AA1AD' },
  cheminEspace: { fontWeight: '700', color: colors.text },
  fermerTout: { fontSize: 13, color: '#9AA1AD', paddingHorizontal: 2 },
  headerBtn: { fontSize: 16, color: colors.primary },
  bold: { fontWeight: '600' },
  content: { padding: 16, paddingBottom: 48 },
  error: { color: colors.danger, backgroundColor: '#FCE8E6', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 14 },
  titreFiche: { alignItems: 'center', gap: 4, paddingTop: 4, paddingBottom: 16, paddingHorizontal: 8 },
  titreBarre: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  titreFicheTexte: { fontSize: 21, fontWeight: '700', color: colors.text, textAlign: 'center' },
  titreFicheVide: { color: colors.muted, fontWeight: '600' },
  titreFicheSous: { fontSize: 13, color: colors.muted, textAlign: 'center' },
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

/** Fiche en lecture seule (droits d'après les rôles) : la raison en haut, puis le contenu, qu'on ne peut pas toucher */
export function BlocLecture({ raison, children }: { raison?: string; children: ReactNode }) {
  if (!raison) return <>{children}</>;
  return (
    <>
      <View style={styles.lecture} accessibilityRole="text">
        <Text style={styles.lectureTexte}>{raison}</Text>
      </View>
      <View pointerEvents="none" style={styles.lectureContenu}>
        <LectureContext.Provider value>{children}</LectureContext.Provider>
      </View>
    </>
  );
}
