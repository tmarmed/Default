import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { type Reunion, TYPES_REUNION } from '../types';
import { SectionFiche } from './Choix';
import { FormSheet, TitreFiche } from './FormSheet';

/**
 * Fenêtre d'une réunion (lot 6) : la même feuille superposée que la fenêtre de traitement des échanges, une étape à
 * la fois. En haut, toujours visible, la barre des étapes (faite : coche verte ; en cours : bleue ; à venir : grise),
 * où l'on touche une étape faite pour y revenir ; en bas, un seul bouton bleu : « Suivant », puis à la dernière étape
 * `libelleFin` (« Envoyer le compte rendu »…).
 * Deux modes : l'organisateur anime la réunion (étapes du catalogue) ; le participant prépare son point (ses propres
 * étapes, `etapes`) et l'envoie à l'organisateur, sans compte rendu.
 * Le contenu de chaque type de réunion est en cours de validation : `renduEtape` le fournira ; à défaut, « À venir ».
 */
export type ModeReunion = 'organisateur' | 'participant';

interface Props {
  visible: boolean;
  reunion: Reunion | null;
  mode: ModeReunion;
  /** Étapes affichées (participant : ses étapes de préparation) ; par défaut, celles du type de réunion */
  etapes?: string[];
  /** Bouton de la dernière étape (« Envoyer le compte rendu », « Envoyer mon point »…) */
  libelleFin?: string;
  /** Contenu de l'étape (index à partir de 0) ; par défaut, « À venir » */
  renduEtape?: (index: number) => ReactNode;
  /** Fil sous l'en-tête (« 👥 Mobile · 9:30 · 15 min ») */
  fil?: string;
  onFermer: () => void;
  /**
   * « Suivant » à l'intérieur d'une étape (tour de table : membre suivant) : renvoie vrai si l'étape l'a pris en
   * charge (on reste sur l'étape)
   */
  onSuivant?: (index: number) => boolean;
  /** Libellé de « Suivant » dans une étape (« Suivant · Paul ») */
  libelleSuivant?: (index: number) => string | undefined;
  /** Étape affichée (index à partir de 0), pour le contenu qui en dépend */
  onEtape?: (index: number) => void;
  /** Dernière étape validée (compte rendu envoyé, point envoyé…) ; la fenêtre se referme ensuite */
  onTerminer?: () => Promise<void> | void;
}

/** Étapes de préparation d'un participant, en attendant celles de chaque réunion (en cours de validation) */
export const ETAPES_PARTICIPANT = ['Mon point', 'Mes blocages', 'Envoi'];

export function FenetreReunion({ visible, reunion, mode, etapes, libelleFin, renduEtape, fil, onFermer, onTerminer, onSuivant, libelleSuivant, onEtape }: Props) {
  const info = reunion ? TYPES_REUNION[reunion.type] : null;
  const liste = etapes ?? (mode === 'participant' ? ETAPES_PARTICIPANT : (info?.etapes ?? []));
  const [etape, setEtape] = useState(0);
  /** Étapes passées avec « Suivant » (on peut y revenir) */
  const [faites, setFaites] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setEtape(0);
      setFaites([]);
      setError(null);
    }
  }, [visible, reunion?.id, mode]);
  useEffect(() => {
    onEtape?.(etape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape]);

  const derniere = etape >= liste.length - 1;
  const fin = libelleFin ?? (mode === 'participant' ? "Envoyer mon point à l'organisateur" : liste[liste.length - 1] === 'Compte rendu' ? 'Envoyer le compte rendu' : 'Terminer');
  const suivant = async () => {
    setError(null);
    if (onSuivant?.(etape)) return;
    if (!derniere) {
      setFaites((l) => (l.includes(etape) ? l : [...l, etape]));
      // Après un retour en arrière : on reprend à la première étape pas encore faite
      let n = etape + 1;
      while (n < liste.length - 1 && faites.includes(n)) n++;
      setEtape(n);
      return;
    }
    setBusy(true);
    try {
      await onTerminer?.();
      onFermer();
    } catch (e) {
      setError(`Non envoyé : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  /** Parcours de plusieurs rôles (7 étapes et plus) : libellés plus serrés, sur 3 lignes au plus */
  const serre = liste.length > 6;
  const barre = (
    <View style={[s.barre, serre && s.barreSerree]} accessibilityRole="tablist">
      {liste.map((nom, k) => {
        const faite = faites.includes(k) && k !== etape;
        const enCours = k === etape;
        const premiere = k === 0;
        const dernier = k === liste.length - 1;
        return (
          <Pressable
            key={`${k}-${nom}`}
            onPress={() => faites.includes(k) && setEtape(k)}
            disabled={!faites.includes(k) || enCours || busy}
            style={s.etape}
            accessibilityRole="tab"
            accessibilityState={{ selected: enCours, disabled: !faites.includes(k) }}
            accessibilityLabel={`Étape ${k + 1} : ${nom}${faite ? ' (faite)' : enCours ? ' (en cours)' : ''}`}
          >
            {/* Trait entre les pastilles : vert jusqu'aux étapes faites */}
            <View style={[s.trait, premiere && s.traitDebut, dernier && s.traitFin, faites.includes(k) && s.traitFait]} />
            <View style={[s.pastille, faite && s.pastilleFaite, enCours && s.pastilleEnCours]}>
              <Text style={[s.pastilleTexte, (faite || enCours) && s.pastilleTexteOn]}>{faite ? '✓' : k + 1}</Text>
            </View>
            <Text style={[s.nom, serre && s.nomSerre, enCours && s.nomEnCours, faite && s.nomFait]} numberOfLines={serre ? 3 : 2}>
              {nom}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const bas = (
    <View style={s.bas}>
      <Pressable onPress={suivant} disabled={busy || !reunion} style={[s.bouton, (busy || !reunion) && s.inactif]} accessibilityRole="button">
        <Text style={s.boutonTexte}>{busy ? 'Envoi…' : (libelleSuivant?.(etape) ?? (derniere ? fin : 'Suivant'))}</Text>
      </Pressable>
    </View>
  );

  return (
    <FormSheet superpose visible={visible} title={reunion?.titre ?? 'Réunion'} busy={busy} error={error} onClose={onFermer} fil={fil} haut={barre} bandeau={bas}>
      {!!reunion && !!info && (renduEtape ? renduEtape(etape) : <EtapeAVenir icone={info.icone} nom={liste[etape] ?? ''} index={etape} total={liste.length} mode={mode} />)}
    </FormSheet>
  );
}

/** Contenu générique d'une étape, en attendant le contenu validé de chaque réunion */
export function EtapeAVenir({ icone, nom, index, total, mode }: { icone: string; nom: string; index: number; total: number; mode: ModeReunion }) {
  return (
    <>
      <TitreFiche icone={icone} titre={nom} vide="" sous={`Étape ${index + 1} sur ${total} · ${mode === 'organisateur' ? 'vous animez' : 'vous préparez votre point'}`} />
      <SectionFiche titre={nom}>
        <Text style={s.aVenir}>À venir : le contenu de cette étape est en cours de validation.</Text>
      </SectionFiche>
    </>
  );
}

const s = StyleSheet.create({
  barre: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 10, paddingBottom: 8, backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  etape: { flex: 1, alignItems: 'center', gap: 4, minWidth: 0 },
  trait: { position: 'absolute', top: 11, left: 0, right: 0, height: 2, backgroundColor: colors.border },
  traitDebut: { left: '50%' },
  traitFin: { right: '50%' },
  traitFait: { backgroundColor: colors.success },
  pastille: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E6EAF0', alignItems: 'center', justifyContent: 'center' },
  pastilleFaite: { backgroundColor: colors.success },
  pastilleEnCours: { backgroundColor: colors.primary },
  pastilleTexte: { fontSize: 12, fontWeight: '800', color: colors.muted },
  pastilleTexteOn: { color: '#fff' },
  nom: { fontSize: 10.5, lineHeight: 13, color: colors.muted, textAlign: 'center', paddingHorizontal: 1 },
  barreSerree: { paddingHorizontal: 2 },
  nomSerre: { fontSize: 9.5, lineHeight: 12, paddingHorizontal: 0 },
  nomEnCours: { color: colors.primary, fontWeight: '700' },
  nomFait: { color: colors.success, fontWeight: '600' },
  aVenir: { fontSize: 14.5, color: colors.muted, lineHeight: 20, padding: 12 },
  bas: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  bouton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.primary },
  boutonTexte: { color: '#fff', fontSize: 16, fontWeight: '700' },
  inactif: { opacity: 0.4 },
});
