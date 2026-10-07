import { createContext, useContext, useState } from 'react';
import { ChoiceSheet } from '../ChoiceSheet';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dateCourte, LIBELLE_TYPE_POINT } from '../../daily';
import { colors } from '../../theme';
import type { Concretisation, Item, Statut, TypePoint } from '../../types';
import { SectionFiche } from '../Choix';
import { FormSheet } from '../FormSheet';

/**
 * Éléments d'affichage communs des réunions (sortis du Daily le 07/10) : pastilles, lignes, compteurs, saisie d'un
 * point en une fenêtre, filtres par type. Toutes les réunions s'en servent : même apparence partout.
 */
export const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export type Ton = 'bleu' | 'vert' | 'rouge' | 'orange' | 'gris';
export const TONS: Record<Ton, { fond: string; texte: string }> = {
  bleu: { fond: '#E8F0FE', texte: '#1557B0' },
  vert: { fond: '#E6F4EA', texte: '#137333' },
  rouge: { fond: '#FCE8E6', texte: '#B3261E' },
  orange: { fond: '#FEF3E2', texte: '#B45309' },
  gris: { fond: '#EEF1F6', texte: colors.muted },
};
/**
 * Changer le statut d'une tâche depuis une réunion (08/10) : la pastille À faire / En cours / Terminé est touchable
 * partout ; l'application enregistre (même règle que l'écran Tâches) et affiche « … · Annuler »
 */
export const StatutTacheContext = createContext<((t: Item, statut: Statut) => void) | null>(null);
const STATUTS: { v: Statut; l: string }[] = [
  { v: 'a_faire', l: 'À faire' },
  { v: 'en_cours', l: 'En cours' },
  { v: 'termine', l: 'Terminé' },
];
/** Pastille du statut d'une tâche, touchable : ouvre le choix du statut */
export function PastilleStatut({ t, affiche }: { t: Item; affiche?: { texte: string; ton: Ton } }) {
  const changer = useContext(StatutTacheContext);
  const [ouvert, setOuvert] = useState(false);
  const p = affiche ?? pastilleStatut(t.statut);
  if (!changer) return <Pastille {...p} />;
  return (
    <>
      <Pressable onPress={() => setOuvert(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Statut : ${pastilleStatut(t.statut).texte}. Changer`}>
        <Pastille texte={`${p.texte} ▾`} ton={p.ton} />
      </Pressable>
      {ouvert && (
        <ChoiceSheet
          visible
          title={t.titre}
          message="Statut de la tâche"
          choices={STATUTS.filter((x) => x.v !== t.statut).map((x) => ({ label: x.l, onPress: () => (setOuvert(false), changer(t, x.v)) }))}
          onClose={() => setOuvert(false)}
        />
      )}
    </>
  );
}
export const pastilleStatut = (s: Statut): { texte: string; ton: Ton } =>
  s === 'termine' ? { texte: 'terminée', ton: 'vert' } : s === 'en_cours' ? { texte: 'en cours', ton: 'bleu' } : { texte: 'à faire', ton: 'gris' };
/** Couleur de la pastille d'un point selon son type */
export const tonType = (t: TypePoint): Ton => (t === 'blocage' ? 'rouge' : t === 'decision' || t === 'action' ? 'orange' : 'bleu');

/** Pastille ; `age` : une seconde pastille orange à côté, à partir de 2 jours (« depuis 3 j », règle du 07/10) */
export function Pastille({ texte, ton, age: date }: { texte: string; ton: Ton; age?: string }) {
  const une = (t: string, tn: Ton) => (
    <View style={[st.pastille, { backgroundColor: TONS[tn].fond }]}>
      <Text style={[st.pastilleTexte, { color: TONS[tn].texte }]} numberOfLines={1}>
        {t}
      </Text>
    </View>
  );
  if (!date) return une(texte, ton);
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {une(texte, ton)}
      {une(date, 'orange')}
    </View>
  );
}

export function Compteur({ valeur, libelle, ton }: { valeur: string; libelle: string; ton?: Ton }) {
  return (
    <View style={st.compteur}>
      <Text style={[st.compteurValeur, ton && { color: TONS[ton].texte }]} numberOfLines={1} adjustsFontSizeToFit>
        {valeur}
      </Text>
      <Text style={st.compteurLibelle}>{libelle}</Text>
    </View>
  );
}

/**
 * Ligne : texte seul, sous-ligne grise, pastille à droite au même niveau ; avec `onOuvrir`, toute la ligne ouvre la
 * fiche (chevron ›)
 */
export function Ligne({
  texte,
  sous,
  pastille,
  premiere,
  onRetirer,
  onOuvrir,
  tache,
}: {
  texte: string;
  sous?: string;
  pastille?: { texte: string; ton: Ton; age?: string };
  premiere?: boolean;
  onRetirer?: () => void;
  onOuvrir?: () => void;
  /** Tâche de la ligne : sa pastille de statut devient touchable */
  tache?: Item;
}) {
  const contenu = (
    <>
      <View style={st.corps}>
        <Text style={st.texte}>{texte}</Text>
        {!!sous && <Text style={st.sous}>{sous}</Text>}
      </View>
      {tache ? <PastilleStatut t={tache} affiche={pastille} /> : pastille && <Pastille {...pastille} />}
      {onRetirer && (
        <Pressable onPress={onRetirer} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Retirer « ${texte} »`}>
          <Text style={st.retirer}>✕</Text>
        </Pressable>
      )}
      {onOuvrir && <Text style={st.chevron}>›</Text>}
    </>
  );
  return onOuvrir ? (
    <Pressable onPress={onOuvrir} style={[st.ligne, !premiere && st.bord]} accessibilityRole="button" accessibilityLabel={`Ouvrir « ${texte} »`}>
      {contenu}
    </Pressable>
  ) : (
    <View style={[st.ligne, !premiere && st.bord]}>{contenu}</View>
  );
}

/**
 * Ligne à cocher (Hier, Aujourd'hui, stories à accepter…) : la case coche ; une tâche qui a des sous-tâches s'ouvre
 * (le reste de la ligne et ›), sinon toute la ligne coche
 */
export function LigneCase({
  texte,
  sous,
  pastille,
  tache,
  premiere,
  coche,
  onBasculer,
  onOuvrir,
}: {
  texte: string;
  sous?: string;
  pastille: { texte: string; ton: Ton; age?: string };
  premiere?: boolean;
  coche: boolean;
  onBasculer: () => void;
  onOuvrir?: () => void;
  /** Tâche de la ligne : pastille de statut touchable */
  tache?: Item;
}) {
  return (
    <View style={[st.ligne, !premiere && st.bord]}>
      <Pressable onPress={onBasculer} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: coche }} accessibilityLabel={texte}>
        <Text style={[st.caseACocher, coche && st.caseCochee]}>{coche ? '✓' : ''}</Text>
      </Pressable>
      <Pressable onPress={onOuvrir ?? onBasculer} style={st.ligneCorps} accessibilityRole="button" accessibilityLabel={onOuvrir ? `Ouvrir « ${texte} »` : texte}>
        <View style={st.corps}>
          <Text style={st.texte}>{texte}</Text>
          {!!sous && <Text style={st.sous}>{sous}</Text>}
        </View>
        {tache ? <PastilleStatut t={tache} affiche={pastille} /> : <Pastille {...pastille} />}
        {onOuvrir && <Text style={st.chevron}>›</Text>}
      </Pressable>
    </View>
  );
}

export function LigneStory({
  t,
  premiere,
  bloquee,
  retard,
  fmt,
  nbSous,
  onOuvrir,
}: {
  t: Item;
  premiere: boolean;
  bloquee: boolean;
  retard: boolean;
  fmt: (n: number) => string;
  nbSous: number;
  onOuvrir?: () => void;
}) {
  const p = parseFloat(t.points);
  return (
    <Ligne
      premiere={premiere}
      texte={`${t.type === 'story' ? '📖 ' : ''}${t.titre}`}
      sous={[pastilleStatut(t.statut).texte, p > 0 ? fmt(p) : '', t.date ? `prévu le ${dateCourte(t.date)}` : '', nbSous ? pluriel(nbSous, 'sous-tâche') : ''].filter(Boolean).join(' · ')}
      pastille={bloquee ? { texte: 'bloquée', ton: 'rouge' } : retard ? { texte: 'en retard', ton: 'orange' } : pastilleStatut(t.statut)}
      tache={t}
      onOuvrir={onOuvrir}
    />
  );
}

export function Vide({ texte }: { texte: string }) {
  return <Text style={st.vide}>{texte}</Text>;
}

/** Choix en pastilles (un seul) ; une option `off` est grisée */
export function Pastilles({ options, value, onChange, petit }: { options: { value: string; label: string; off?: boolean }[]; value: string; onChange: (v: string) => void; petit?: boolean }) {
  return (
    <View style={st.choix}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            disabled={o.off}
            onPress={() => onChange(o.value)}
            style={[st.choixPastille, petit && st.choixPetit, on && st.choixOn, o.off && st.choixOff]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: !!o.off }}
          >
            <Text style={[st.choixTexte, petit && st.choixTextePetit, on && st.choixTexteOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Saisie rapide d'un point : type en pastilles (si plusieurs), story facultative, Entrée pour ajouter */
/** Titre de la fenêtre d'ajout (règle 07/10) : « Nouveau … » selon le seul type possible, sinon « Nouveau point » */
export const TITRE_TYPE: Record<string, string> = {
  hier: 'Nouvelle tâche faite hier',
  aujourdhui: 'Nouvelle tâche prévue aujourd’hui',
  blocage: 'Nouveau blocage',
  decision: 'Nouvelle décision',
  action: 'Nouvelle action',
};
export const titreAjout = (types: TypePoint[]) => (types.length === 1 ? (TITRE_TYPE[types[0]] ?? 'Nouveau point') : 'Nouveau point');

export function SaisiePoint({
  types,
  jour,
  placeholder,
  stories = [],
  elementDefaut = '',
  typeDefaut,
  titre,
  concretiser,
  premiere,
  aide,
  onAjouter,
}: {
  /** Ligne d'aide sous le lien */
  aide?: string;
  /** Types possibles : un seul → pas de choix ; Hier / Aujourd'hui ne se mélangent pas aux points */
  types: TypePoint[];
  jour: string;
  placeholder: string;
  stories?: Item[];
  /** Élément en cours (story affichée) : prérempli, modifiable */
  elementDefaut?: string;
  /** Type prérempli (celui du filtre, Blocage si « Tous ») */
  typeDefaut?: TypePoint;
  /** Titre imposé (sinon calculé d'après les types) */
  titre?: string;
  /** Point ajouté au Suivi (un oubli) : la fenêtre contient aussi la Concrétisation et le responsable */
  concretiser?: { personnes: { value: string; label: string }[]; respDefaut: string };
  premiere?: boolean;
  onAjouter: (type: TypePoint, texte: string, element: string, conc?: { c: Concretisation; resp: string }) => void;
}) {
  // Règle commune (07/10) : un simple « ＋ … » sous la liste, qui ouvre une seule fenêtre
  const [ouvert, setOuvert] = useState(false);
  const parDefaut = (): TypePoint => (typeDefaut && types.includes(typeDefaut) ? typeDefaut : (types[0] ?? 'blocage'));
  const [type, setType] = useState<TypePoint>(parDefaut());
  const [texte, setTexte] = useState('');
  const [element, setElement] = useState(elementDefaut);
  const [c, setC] = useState<Concretisation>('tache');
  const [resp, setResp] = useState(concretiser?.respDefaut ?? '');
  const ouvrir = () => {
    setType(parDefaut());
    setElement(elementDefaut);
    setTexte('');
    setC('tache');
    setResp(concretiser?.respDefaut ?? '');
    setOuvert(true);
  };
  const valider = () => {
    const t = texte.trim();
    if (!t) return;
    const cc: Concretisation = c === 'sous_tache' && !element ? 'tache' : c;
    onAjouter(type, t, element, concretiser ? { c: cc, resp } : undefined);
    setOuvert(false);
  };
  const libelle = placeholder.replace(/^＋\s*/, '');
  return (
    <View style={[st.saisieBloc, !premiere && st.bord]}>
      <Pressable onPress={ouvrir} style={st.saisieLigne} accessibilityRole="button" accessibilityLabel={libelle}>
        <Text style={st.ajouterLien}>＋ {libelle}</Text>
      </Pressable>
      {!!aide && <Text style={st.sous}>{aide}</Text>}
      <FormSheet superpose visible={ouvert} title={titre ?? titreAjout(types)} busy={false} error={null} onClose={() => setOuvert(false)} onSave={valider} libelleEnregistrer="Ajouter">
        {types.length > 1 && (
          <SectionFiche titre="Type">
            <View style={st.champ}>
              <Pastilles petit options={types.map((x) => ({ value: x, label: LIBELLE_TYPE_POINT[x] }))} value={type} onChange={(v) => setType(v as TypePoint)} />
            </View>
          </SectionFiche>
        )}
        {/* Une seule fenêtre : la story se choisit ici, sans seconde feuille */}
        {stories.length > 0 && (
          <SectionFiche titre="Story">
            <View style={st.champ}>
              <Pastilles petit options={[{ value: '', label: 'Aucune' }, ...stories.map((t) => ({ value: t.id, label: `📖 ${t.titre}` }))]} value={element} onChange={setElement} />
            </View>
          </SectionFiche>
        )}
        <SectionFiche titre="Point">
          <View style={st.champPoint}>
            <TextInput
              value={texte}
              onChangeText={setTexte}
              placeholder="Écrivez le point…"
              placeholderTextColor={colors.muted}
              onSubmitEditing={valider}
              submitBehavior="submit"
              returnKeyType="done"
              autoFocus
              style={st.saisie}
              accessibilityLabel="Point"
            />
          </View>
        </SectionFiche>
        {/* Point de suivi oublié : on le concrétise tout de suite (Transmettre ou Escalader : à l'étape Concrétisation) */}
        {!!concretiser && (
          <>
            <SectionFiche titre="Concrétiser">
              <View style={st.champ}>
                <Pastilles
                  petit
                  options={[
                    { value: 'sous_tache', label: 'Sous-tâche de la story', off: !element },
                    { value: 'tache', label: 'Tâche à part' },
                    { value: 'rien', label: 'Rien' },
                  ]}
                  value={c}
                  onChange={(v) => setC(v as Concretisation)}
                />
              </View>
            </SectionFiche>
            {(c === 'tache' || c === 'sous_tache') && (
              <SectionFiche titre="Responsable">
                <View style={st.champ}>
                  <Pastilles petit options={concretiser.personnes} value={resp} onChange={setResp} />
                </View>
              </SectionFiche>
            )}
          </>
        )}
      </FormSheet>
    </View>
  );
}

/** Pastille « Filtres ▾ / ▴ » à côté d'un titre de section, comme dans l'en-tête des écrans */
export function PastilleFiltres({ actif, ouvert, onPress }: { actif: boolean; ouvert: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[st.pastilleFiltres, actif && st.pastilleFiltresActive]} accessibilityRole="button" accessibilityLabel={`${ouvert ? 'Replier' : 'Déplier'} les filtres`}>
      <Entonnoir couleur={actif ? colors.primary : colors.text} />
      <Text style={[st.pastilleFiltresTexte, actif && { color: colors.primary }]}>Filtres {ouvert ? '▴' : '▾'}</Text>
      {actif && (
        <View style={st.pastilleFiltresNb}>
          <Text style={st.pastilleFiltresNbTexte}>1</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Filtres dépliés : « Tous » puis un type à la fois, sans nombre */
export function FiltresType({ types, value, onChange }: { types: TypePoint[]; value: TypePoint | ''; onChange: (v: TypePoint | '') => void }) {
  return (
    <View style={st.filtresBloc}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filtreLigne}>
        {(['', ...types] as const).map((x) => {
          const on = value === x;
          return (
            <Pressable key={x || 'tous'} onPress={() => onChange(x)} style={[st.itChip, on && st.itChipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text style={[st.itChipText, on && st.itChipTextOn]}>{x ? LIBELLE_TYPE_POINT[x] : 'Tous'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Entonnoir des filtres (même dessin que l'en-tête des écrans) */
export function Entonnoir({ couleur }: { couleur: string }) {
  return (
    <View style={{ alignItems: 'center', width: 12 }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: couleur }} />
      <View style={{ width: 2.5, height: 5, backgroundColor: couleur, marginTop: -1 }} />
    </View>
  );
}

export const st = StyleSheet.create({
  filtresTete: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginHorizontal: 4 },
  pastilleFiltres: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 8, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  pastilleFiltresActive: { backgroundColor: '#EAF2FE', borderColor: '#CFE0FB' },
  pastilleFiltresTexte: { fontSize: 12, fontWeight: '700', color: colors.text },
  pastilleFiltresNb: { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  pastilleFiltresNbTexte: { color: '#fff', fontSize: 10, fontWeight: '800' },
  filtresBloc: { marginBottom: 8, backgroundColor: colors.bg, borderRadius: 14, borderWidth: 1, borderColor: '#EEF1F5', padding: 9 },
  filtreLigne: { gap: 6, alignItems: 'center' },
  itChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card },
  itChipOn: { backgroundColor: colors.primary },
  itChipText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  itChipTextOn: { color: '#fff' },
  compteurs: { flexDirection: 'row', gap: 8 },
  compteur: { flex: 1, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  compteurValeur: { fontSize: 18, fontWeight: '800', color: colors.text },
  compteurLibelle: { fontSize: 11.5, color: colors.muted, textAlign: 'center' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  bord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  champ: { gap: 6 },
  champLibelle: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  champStory: { marginHorizontal: -14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  corps: { flex: 1, minWidth: 0, gap: 2 },
  texte: { fontSize: 15, color: colors.text },
  sous: { fontSize: 12.5, color: colors.muted },
  pastille: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, maxWidth: 150 },
  pastilleTexte: { fontSize: 12, fontWeight: '700' },
  retirer: { fontSize: 14, color: colors.muted, paddingHorizontal: 2 },
  ligneCorps: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { fontSize: 14.5, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  chevron: { fontSize: 22, lineHeight: 24, color: colors.muted, marginLeft: -2 },
  vide: { fontSize: 14, color: colors.muted, paddingHorizontal: 14, paddingVertical: 12 },
  membres: { gap: 6, paddingBottom: 10, paddingHorizontal: 2 },
  membre: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  membreOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  membreTexte: { fontSize: 13, color: colors.text },
  membreTexteOn: { color: '#fff', fontWeight: '700' },
  carteConcret: { backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 8, marginTop: 10 },
  boutonSynchro: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '100%' },
  boutonSynchroChoisi: { backgroundColor: colors.primary },
  boutonSynchroTexte: { color: colors.primary, fontSize: 13.5, fontWeight: '700' },
  boutonSynchroTexteChoisi: { color: '#fff' },
  // « Suivre » (lecture seule) : le choix du SM, en texte ; le bandeau discret en haut de l'onglet
  choixLecture: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  choixADecider: { color: colors.muted, fontStyle: 'italic', fontWeight: '500' },
  bandeauLecture: { alignSelf: 'center', backgroundColor: '#EEF1F6', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  bandeauLectureTexte: { fontSize: 12.5, color: colors.muted, fontWeight: '600' },
  ligneHaut: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  petitTitre: { fontSize: 11.5, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choixPastille: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  choixPetit: { paddingHorizontal: 9, paddingVertical: 4 },
  choixOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choixOff: { opacity: 0.35 },
  choixTexte: { fontSize: 13, color: colors.text },
  choixTextePetit: { fontSize: 12.5 },
  choixTexteOn: { color: '#fff', fontWeight: '600' },
  saisieBloc: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  saisieLigne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ajouterLien: { color: colors.primary, fontSize: 15, fontWeight: '600', paddingVertical: 4 },
  saisie: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 6, outlineStyle: 'none' as never },
  champPoint: { backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, marginHorizontal: 16 },
  ajouter: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.primary },
  ajouterTexte: { color: '#fff', fontWeight: '700', fontSize: 13 },
  caseACocher: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#A0A6B1', textAlign: 'center', lineHeight: 19, fontSize: 14, color: '#fff', overflow: 'hidden' },
  caseCochee: { backgroundColor: colors.primary, borderColor: colors.primary },
});
