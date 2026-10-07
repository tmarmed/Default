import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { type Reunion, TYPES_REUNION } from '../types';
import { SectionFiche } from './Choix';
import { FormSheet, TitreFiche } from './FormSheet';
import { Segmented } from './Segmented';

/**
 * Fenêtre d'une réunion (lot 6) : la même feuille superposée que la fenêtre de traitement des échanges, une étape à
 * la fois. En haut, toujours visible, la barre des étapes (faite : coche verte ; en cours : bleue ; à venir : grise),
 * où l'on touche une étape faite pour y revenir ; en bas, un seul bouton bleu : « Suivant », puis à la dernière étape
 * `libelleFin` (« Envoyer le compte rendu »…).
 * Deux modes : l'organisateur anime la réunion (étapes du catalogue) ; le participant prépare son point (ses propres
 * étapes, `etapes`) et l'envoie à l'organisateur, sans compte rendu.
 * Parcours séparés (règle du 06/10) : avec `onglets`, chaque rôle de la personne a son parcours dans un onglet, sous
 * l'en-tête, au-dessus de la barre des étapes (« Mon point », « PO », « Animer » ou « Suivre ») ; chaque onglet a sa
 * barre d'étapes, son « Suivant » et sa dernière étape, et garde son étape quand on change d'onglet.
 * « ↻ Actualiser » (en haut à droite, toutes les réunions) : relit les données de la réunion dans le Sheet
 * (`onActualiser`, une lecture groupée) sans perdre les saisies ni l'étape ; pas plus d'une fois toutes les 5 s.
 * Le contenu de chaque type de réunion est en cours de validation : `renduEtape` le fournira ; à défaut, « À venir ».
 * Bandeau de réunion « ● En direct » (07/10, `direct`) : chez le participant d'une réunion lancée à plusieurs, au-dessus
 * du bouton, fermé par défaut ; « ▴ » ouvre l'écran de l'animateur en lecture seule. L'animateur n'en a pas.
 */
export type ModeReunion = 'organisateur' | 'participant';

/** Parcours d'un onglet : ses étapes, son contenu, sa dernière étape */
export interface OngletReunion {
  /** Clé stable de l'onglet */
  cle: string;
  /** « Mon point », « PO », « Animer », « Suivre » */
  libelle: string;
  etapes: string[];
  /** Bouton de la dernière étape (« Envoyer au SM », « Fermer »…) */
  libelleFin?: string;
  /** Contenu de l'étape (index à partir de 0) ; par défaut, « À venir » */
  renduEtape?: (index: number) => ReactNode;
  /**
   * « Suivant » à l'intérieur d'une étape (tour de table : membre suivant) : renvoie vrai si l'étape l'a pris en
   * charge (on reste sur l'étape)
   */
  onSuivant?: (index: number) => boolean;
  /** Libellé de « Suivant » dans une étape (« Suivant · Paul ») */
  libelleSuivant?: (index: number) => string | undefined;
  /** Étape affichée (index à partir de 0), à chaque changement d'étape ou d'onglet */
  onEtape?: (index: number) => void;
  /** Dernière étape validée (point envoyé, compte rendu envoyé…) */
  onTerminer?: () => Promise<void> | void;
  /**
   * Après la dernière étape : fermer la fenêtre (compte rendu envoyé, « Fermer ») ; sinon l'onglet est marqué fait
   * (✓) et l'on passe au premier onglet pas encore fait (la fenêtre se ferme s'il n'y en a plus)
   */
  fermer?: boolean;
}

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
  /**
   * Parcours séparés : un onglet par rôle (remplace `etapes`, `libelleFin`, `renduEtape`, `onSuivant`,
   * `libelleSuivant`, `onEtape`, `onTerminer`). Un seul onglet : pas de barre d'onglets.
   */
  onglets?: OngletReunion[];
  /** Onglet ouvert à l'ouverture (index) ; par défaut, le premier */
  ongletInitial?: number;
  /** « ↻ Actualiser » : relit les données de la réunion (une lecture groupée) ; absent : pas de bouton */
  onActualiser?: () => Promise<void>;
  /** Bandeau « ● En direct » (participant d'une réunion lancée à plusieurs) : texte, et l'écran de l'animateur */
  direct?: { texte: string; contenu?: ReactNode; animateur: string };
}

/** Étapes de préparation d'un participant, en attendant celles de chaque réunion (en cours de validation) */
export const ETAPES_PARTICIPANT = ['Mon point', 'Mes blocages', 'Envoi'];
/** Délai minimal entre deux actualisations (quota Google Sheets) */
export const DELAI_ACTUALISER_MS = 5000;
/** « 9:42 » */
const heureCourte = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

export function FenetreReunion(p: Props) {
  const { visible, reunion, mode, fil, onFermer, onglets, ongletInitial = 0, onActualiser } = p;
  const info = reunion ? TYPES_REUNION[reunion.type] : null;
  // Sans onglets : un seul parcours, celui des props
  const liste: OngletReunion[] = onglets?.length
    ? onglets
    : [
        {
          cle: 'unique',
          libelle: '',
          etapes: p.etapes ?? (mode === 'participant' ? ETAPES_PARTICIPANT : (info?.etapes ?? [])),
          libelleFin: p.libelleFin,
          renduEtape: p.renduEtape,
          onSuivant: p.onSuivant,
          libelleSuivant: p.libelleSuivant,
          onEtape: p.onEtape,
          onTerminer: p.onTerminer,
          fermer: true,
        },
      ];
  const [actif, setActif] = useState(ongletInitial);
  const courant = liste[Math.min(actif, liste.length - 1)];
  /** Par onglet : étape en cours et étapes passées avec « Suivant » (on peut y revenir) */
  const [etats, setEtats] = useState<Record<string, { etape: number; faites: number[] }>>({});
  /** Onglets terminés (point envoyé) */
  const [finis, setFinis] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Actualiser : lecture en cours, dernier résultat, attente de 5 s entre deux lectures
  const [lecture, setLecture] = useState(false);
  const [maj, setMaj] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [attente, setAttente] = useState(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (visible) {
      setActif(Math.min(ongletInitial, Math.max(0, liste.length - 1)));
      setEtats({});
      setFinis([]);
      setError(null);
      setMaj(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reunion?.id, mode]);
  useEffect(() => () => void (minuterie.current && clearTimeout(minuterie.current)), []);

  const { etape, faites } = etats[courant.cle] ?? { etape: 0, faites: [] };
  const etapes = courant.etapes;
  const poser = (x: { etape?: number; faites?: number[] }) => setEtats((m) => ({ ...m, [courant.cle]: { etape, faites, ...x } }));
  useEffect(() => {
    courant.onEtape?.(etape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape, courant.cle]);

  const derniere = etape >= etapes.length - 1;
  const fin = courant.libelleFin ?? (mode === 'participant' ? "Envoyer mon point à l'organisateur" : etapes[etapes.length - 1] === 'Compte rendu' ? 'Envoyer le compte rendu' : 'Terminer');
  const suivant = async () => {
    setError(null);
    if (courant.onSuivant?.(etape)) return;
    if (!derniere) {
      // Après un retour en arrière : on reprend à la première étape pas encore faite
      let n = etape + 1;
      while (n < etapes.length - 1 && faites.includes(n)) n++;
      poser({ etape: n, faites: faites.includes(etape) ? faites : [...faites, etape] });
      return;
    }
    setBusy(true);
    try {
      await courant.onTerminer?.();
      const restants = liste.filter((o) => o.cle !== courant.cle && !finis.includes(o.cle));
      if (courant.fermer || !restants.length) return onFermer();
      setFinis((l) => [...l, courant.cle]);
      // Onglet suivant pas encore fait (dans l'ordre des onglets, après celui-ci)
      const apres = liste.slice(actif + 1).find((o) => restants.includes(o)) ?? restants[0];
      setActif(liste.indexOf(apres));
    } catch (e) {
      setError(`Non envoyé : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const actualiser = async () => {
    if (!onActualiser || lecture || attente) return;
    setLecture(true);
    setAttente(true);
    minuterie.current = setTimeout(() => setAttente(false), DELAI_ACTUALISER_MS);
    try {
      await onActualiser();
      setMaj({ texte: `À jour · ${heureCourte(new Date())}` });
    } catch (e) {
      setMaj({ texte: `Échec · ${heureCourte(new Date())}`, erreur: true });
      setError(`Non actualisé : ${(e as Error).message}`);
    } finally {
      setLecture(false);
    }
  };

  /** Onglets des parcours (plusieurs rôles) : segments pleine largeur */
  const barreOnglets = liste.length > 1 && (
    <View style={s.onglets}>
      <Segmented
        options={liste.map((o) => ({ value: o.cle, label: finis.includes(o.cle) ? `${o.libelle} ✓` : o.libelle }))}
        value={courant.cle}
        onChange={(v) => !busy && setActif(Math.max(0, liste.findIndex((o) => o.cle === v)))}
      />
    </View>
  );

  /** Parcours longs (7 étapes et plus) : libellés plus serrés, sur 3 lignes au plus */
  const serre = etapes.length > 6;
  const barre = (
    <View style={[s.barre, serre && s.barreSerree]} accessibilityRole="tablist">
      {etapes.map((nom, k) => {
        const faite = faites.includes(k) && k !== etape;
        const enCours = k === etape;
        const premiere = k === 0;
        const dernier = k === etapes.length - 1;
        return (
          <Pressable
            key={`${courant.cle}-${k}-${nom}`}
            onPress={() => faites.includes(k) && poser({ etape: k })}
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

  /** En-tête, à droite : « ↻ Actualiser », puis « À jour · 9:42 » */
  const droite = onActualiser && (
    <Pressable
      onPress={actualiser}
      disabled={lecture || attente || busy}
      hitSlop={10}
      style={s.actualiser}
      accessibilityRole="button"
      accessibilityLabel="Actualiser : relire les données de la réunion"
      accessibilityHint={attente && !lecture ? 'Patientez quelques secondes entre deux actualisations' : undefined}
    >
      {lecture ? (
        <View style={s.actualiserLigne}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={s.actualiserTexte}>Lecture…</Text>
        </View>
      ) : (
        <Text style={[s.actualiserTexte, attente && s.actualiserAttente]}>↻ Actualiser</Text>
      )}
      {!!maj && !lecture && (
        <Text style={[s.maj, maj.erreur && s.majErreur]} numberOfLines={1}>
          {maj.texte}
        </Text>
      )}
    </Pressable>
  );

  const [directOuvert, setDirectOuvert] = useState(false);
  const bas = (
    <View style={s.bas}>
      {!!p.direct && (
        <View style={s.direct}>
          <Pressable onPress={() => setDirectOuvert((o) => !o)} style={s.directBarre} accessibilityRole="button" accessibilityLabel={`En direct : ${p.direct.texte}. ${directOuvert ? 'Fermer' : 'Voir'} l’écran de l’animateur`}>
            <Text style={s.directPoint}>●</Text>
            <Text style={s.directTexte} numberOfLines={1}>
              <Text style={s.gras}>En direct · </Text>
              {p.direct.texte}
            </Text>
            <Text style={s.directFleche}>{directOuvert ? '▾' : '▴'}</Text>
          </Pressable>
          {directOuvert && (
            <View style={[s.directPanneau, { maxHeight: Math.round(Dimensions.get('window').height * 0.45) }]}>
              <ScrollView contentContainerStyle={s.directContenu}>{p.direct.contenu ?? <Text style={s.aVenir}>L’animateur n’a pas encore commencé.</Text>}</ScrollView>
              <Text style={s.directLecture}>🔒 Lecture seule · écran de {p.direct.animateur}</Text>
            </View>
          )}
        </View>
      )}
      <Pressable onPress={suivant} disabled={busy || !reunion} style={[s.bouton, (busy || !reunion) && s.inactif]} accessibilityRole="button">
        <Text style={s.boutonTexte}>{busy ? 'Envoi…' : (courant.libelleSuivant?.(etape) ?? (derniere ? fin : 'Suivant'))}</Text>
      </Pressable>
    </View>
  );

  return (
    <FormSheet
      superpose
      visible={visible}
      title={reunion?.titre ?? 'Réunion'}
      busy={busy}
      error={error}
      onClose={onFermer}
      fil={fil}
      droite={droite || undefined}
      contexte={`${courant.libelle ? `${courant.libelle} · ` : ''}étape ${etape + 1} sur ${etapes.length} : ${etapes[etape] ?? ''}`}
      haut={
        <>
          {barreOnglets}
          {barre}
        </>
      }
      bandeau={bas}
    >
      {!!reunion &&
        !!info &&
        (courant.renduEtape ? courant.renduEtape(etape) : <EtapeAVenir icone={info.icone} nom={etapes[etape] ?? ''} index={etape} total={etapes.length} mode={mode} />)}
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
  onglets: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2, backgroundColor: colors.card },
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
  actualiser: { alignItems: 'flex-end' },
  actualiserLigne: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actualiserTexte: { fontSize: 15, color: colors.primary },
  actualiserAttente: { opacity: 0.45 },
  maj: { fontSize: 10.5, color: colors.muted, marginTop: 1 },
  majErreur: { color: colors.danger },
  bas: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  bouton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.primary },
  boutonTexte: { color: '#fff', fontSize: 16, fontWeight: '700' },
  inactif: { opacity: 0.4 },
  direct: { marginBottom: 10, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1d2433' },
  directBarre: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  directPoint: { color: '#ff5a5a', fontSize: 12 },
  directTexte: { flex: 1, color: '#fff', fontSize: 13.5 },
  gras: { fontWeight: '800' },
  directFleche: { color: '#fff', fontWeight: '800', fontSize: 13 },
  directPanneau: { backgroundColor: colors.bg },
  directContenu: { padding: 12, gap: 6 },
  directLecture: { fontSize: 11.5, color: colors.muted, textAlign: 'center', paddingVertical: 6, backgroundColor: colors.bg },
});
