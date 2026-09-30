import { ReactNode, useContext, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors } from '../theme';
import { ChoiceSheet } from './ChoiceSheet';
import { AutoContext } from './EnregistrementAuto';

/**
 * Choix d'une affectation dans une fiche (feature, équipe, responsable, itération, train…) : une ligne de réglage
 * qui ouvre une feuille de choix. Mêmes règles partout :
 * - ligne vide attendue (selon Simple / SAFe) : orange « À définir » ; vide facultative : gris « Facultatif » ;
 * - un autre choix que celui du départ : pastille « changée ▸ » (« déplacée ▸ » pour un parent) ; ouverte :
 *   « Avant : … » et « Annuler le changement » ; rien n'est fait avant « Enregistrer » ;
 * - feuille : « Annuler » en haut, recherche, « ＋ Nouvelle … » en tête, le même parent d'abord, « Autres … · n ▸ »
 *   fermé (la même ligne ouvre et referme), le choix actuel toujours visible, « Sans … » en bas s'il y a un choix ;
 *   toucher un élément le choisit et referme la feuille.
 */

export const ORANGE = '#C2410C';
const ORANGE_FOND = '#FFF4EC';
const JAUNE = '#FEF7E0';
const JAUNE_TEXTE = '#7A5A00';
const CLAIR = '#9AA1AD';

export interface OptionChoix {
  value: string;
  label: string;
  /** Texte à droite (dates, nombre de membres…) */
  meta?: string;
  /** Petite pastille (« en cours », « prévue ») */
  badge?: { texte: string; ton: 'vert' | 'bleu' };
  /** Élément en retrait (sous-domaine…) */
  retrait?: boolean;
}
export interface GroupeChoix {
  titre?: string;
  options: OptionChoix[];
}
export interface AutresChoix {
  /** « Autres epics », « Autres trains »… */
  titre: string;
  groupes: GroupeChoix[];
}

const toutes = (groupes: GroupeChoix[], autres?: AutresChoix) => [...groupes, ...(autres?.groupes ?? [])].flatMap((g) => g.options);

/** Section d'une fiche : titre en capitales, « n à définir » en orange, ＋ rond à droite, carte blanche. */
export function SectionFiche({
  titre,
  aDefinir = 0,
  auChoix,
  onAjouter,
  ajouterLabel,
  children,
  carte = true,
}: {
  titre: string;
  aDefinir?: number;
  /** Les lignes à définir sont au choix (une seule suffit) */
  auChoix?: boolean;
  onAjouter?: () => void;
  ajouterLabel?: string;
  children?: ReactNode;
  /** false : pas de carte blanche (contenu déjà présenté) */
  carte?: boolean;
}) {
  return (
    <View>
      <View style={s.titreSec}>
        <Text style={s.titreSecTexte}>{titre}</Text>
        {aDefinir > 0 && <Text style={s.aDefinir}>{aDefinir} à définir{auChoix ? ' (au choix)' : ''}</Text>}
        {onAjouter && (
          <Pressable onPress={onAjouter} hitSlop={10} style={s.rond} accessibilityRole="button" accessibilityLabel={ajouterLabel ?? `Ajouter : ${titre}`}>
            <Text style={s.rondTexte}>＋</Text>
          </Pressable>
        )}
      </View>
      {children != null && (carte ? <View style={s.carte}>{children}</View> : children)}
    </View>
  );
}

/** « ou » entre deux lignes attendues au choix (le trait orange reste continu) */
/**
 * Écart ou question : alerte jaune, toujours deux choix — appliquer (bouton plein) ou garder tel quel (contour).
 * (Une valeur calculée s'affiche en gris sans alerte ; une erreur qui empêche d'enregistrer est rouge, sans bouton.)
 */
export function AlerteChoix({ texte, oui, non }: { texte: string; oui: { label: string; onPress: () => void }; non: { label: string; onPress: () => void } }) {
  return (
    <View style={s.alerteChoix} accessibilityRole="alert">
      <Text style={s.alerteTexte}>{texte}</Text>
      <View style={s.alerteBoutons}>
        <Pressable onPress={oui.onPress} style={[s.alerteBtn, s.alerteOui]} accessibilityRole="button">
          <Text style={s.alerteOuiTexte}>{oui.label}</Text>
        </Pressable>
        <Pressable onPress={non.onPress} style={[s.alerteBtn, s.alerteNon]} accessibilityRole="button">
          <Text style={s.alerteNonTexte}>{non.label}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Ligne d'une section de fiche pour une saisie libre (date, heure, estimation, lieu, notes…) : même dessin que les
 * lignes de choix — le libellé à gauche, le champ à droite, sur la carte blanche.
 */
export function ChampFiche({ label, children, sous, colonne }: { label: string; children: ReactNode; sous?: string; colonne?: boolean }) {
  return (
    <View style={s.ligneBloc}>
      <View style={[s.ligne, colonne && s.champColonne]}>
        <Text style={[s.cle, colonne && s.cleColonne]}>{label}</Text>
        <View style={s.champ}>{children}</View>
      </View>
      {!!sous && <Text style={s.sous}>{sous}</Text>}
    </View>
  );
}

/** Champ de texte d'une ligne de fiche (sans cadre) ; vide : « Facultatif » en gris, comme les lignes de choix */
export function SaisieFiche(props: TextInputProps) {
  return (
    <TextInput
      placeholder="Facultatif"
      placeholderTextColor={colors.muted}
      {...props}
      style={[s.saisie, !props.value && s.saisieVide, props.multiline && s.saisieMulti, props.style]}
    />
  );
}

/** Estimation d'une fiche (tâche, feature) : le nombre suivi de son unité (« 3 j », « 5 pts »), le même partout */
export function ChampEstimation({ value, onChange, jours, placeholder }: { value: string; onChange: (v: string) => void; jours: boolean; placeholder?: string }) {
  return (
    <ChampFiche label="Estimation">
      <View style={s.estimation}>
        <SaisieFiche
          style={value ? { width: Math.max(12, value.length * 9 + 2), flexGrow: 0 } : s.estimationVide}
          placeholder={placeholder ?? 'Facultatif'}
          value={value}
          onChangeText={(v) => onChange(v.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          accessibilityLabel="Estimation"
        />
        {!!value && <Text style={s.unite}>{jours ? 'j' : parseFloat(value) > 1 ? 'pts' : 'pt'}</Text>}
      </View>
    </ChampFiche>
  );
}

export function SeparateurOu() {
  return (
    <View style={s.ou}>
      <Text style={s.ouTexte}>ou</Text>
    </View>
  );
}

/** Nombre d'affectations attendues encore vides */
export const compteADefinir = (l: { attendu?: boolean; vide: boolean }[]) => l.filter((x) => x.attendu && x.vide).length;

/** Ligne de réglage simple (consultation, ou action) : « Clé — valeur › » */
export function LigneFiche({ label, valeur, sous, onPress, gris }: { label: string; valeur: string; sous?: string; onPress?: () => void; gris?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={s.ligneBloc} accessibilityRole={onPress ? 'button' : undefined}>
      <View style={s.ligne}>
        <Text style={s.cle}>{label}</Text>
        <Text style={[s.valeur, gris && s.valeurGris]}>{valeur}</Text>
        {onPress && <Text style={s.chev}>›</Text>}
      </View>
      {!!sous && <Text style={s.sous}>{sous}</Text>}
    </Pressable>
  );
}

/**
 * Titre d'un groupe dans une feuille (« 🗂️ Application client », « Sans feature ») : la même ligne ouvre et referme
 * le groupe (▾ / ▸). `autres` : « Autres epics · n », détaché des groupes au-dessus (bandeau à part, fermé d'office).
 */
function EnteteGroupe({ titre, n, ouvert, onPress, autres }: { titre: string; n: number; ouvert: boolean; onPress: () => void; autres?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[s.grpLigne, autres && s.grpAutres]} accessibilityRole="button" accessibilityState={{ expanded: ouvert }} accessibilityLabel={`${titre} · ${n}`}>
      <Text style={[s.grp, s.grpTexte]}>
        {titre} · {n}
      </Text>
      <Text style={s.fleche}>{ouvert ? '▾' : '▸'}</Text>
    </Pressable>
  );
}

/** Pastille « changée ▸ » et sa ligne « Avant : … · Annuler le changement » */
function useChangement() {
  const [ouvert, setOuvert] = useState(false);
  return { ouvert, basculer: () => setOuvert((o) => !o), fermer: () => setOuvert(false) };
}
function Pastille({ texte, ouvert, onPress }: { texte: string; ouvert: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={s.pastille} accessibilityRole="button" accessibilityLabel={`${texte} : voir le détail`}>
      <Text style={s.pastilleTexte}>
        {texte} {ouvert ? '▾' : '▸'}
      </Text>
    </Pressable>
  );
}
function DetailChangement({ avant, onAnnuler }: { avant: string; onAnnuler: () => void }) {
  return (
    <View style={s.detail}>
      <Text style={s.detailTexte}>Avant : {avant || 'rien'}</Text>
      <Pressable onPress={onAnnuler} hitSlop={6} accessibilityRole="button">
        <Text style={s.detailLien}>Annuler le changement</Text>
      </Pressable>
    </View>
  );
}

export interface LigneChoixProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  groupes: GroupeChoix[];
  autres?: AutresChoix;
  /** Valeur au départ (élément enregistré) : si elle change, pastille « changée » / « déplacée » */
  depart?: string;
  /** Changer ce champ déplace l'élément (parent) : « déplacée » au lieu de « changée » */
  parent?: boolean;
  /** Attendu (orange « À définir » s'il est vide) */
  attendu?: boolean;
  /** Petit chemin sous la ligne (« Pro › Fidéliser les clients ») */
  sous?: string;
  /** « ＋ Nouvelle feature » en tête de la feuille */
  nouveau?: { label: string; onPress: () => void };
  /** « Sans équipe » en bas de la feuille (seulement s'il y a un choix) ; absent = on ne peut pas retirer */
  sans?: string;
  /** Titre de la feuille (par défaut : le libellé) */
  titreFeuille?: string;
  /** Libellé affiché sur la ligne (sinon celui de l'option ; utile pour une valeur absente des options) */
  libelle?: (v: string) => string;
  /** Texte d'une ligne vide non attendue (par défaut « Facultatif ») */
  vide?: string;
  /** Lecture seule : la ligne n'ouvre rien */
  fige?: boolean;
  /** Changement calculé ailleurs (rattachement sur plusieurs lignes) : remplace `depart` */
  changement?: { avant: string; annuler: () => void };
}

/** Ligne de choix + sa feuille */
export function LigneChoix(p: LigneChoixProps) {
  const [ouvert, setOuvert] = useState(false);
  const ch = useChangement();
  const opts = toutes(p.groupes, p.autres);
  const nom = (v: string) => (v ? (p.libelle?.(v) ?? opts.find((o) => o.value === v)?.label ?? '?') : '');
  // Fiche enregistrée au fil de l'eau : pas de pastille, le bandeau « Annuler » la remplace
  const auto = useContext(AutoContext);
  const change = !auto && (p.changement ? true : !!p.depart && p.value !== p.depart);
  const afaire = !!p.attendu && !p.value;
  return (
    <View style={s.ligneBloc}>
      <Pressable
        onPress={() => setOuvert(true)}
        disabled={p.fige}
        style={[s.ligne, afaire && s.ligneAFaire]}
        accessibilityRole="button"
        accessibilityLabel={`${p.label} : ${p.value ? nom(p.value) : afaire ? 'à définir' : (p.vide ?? 'facultatif')}`}
      >
        <Text style={[s.cle, afaire && s.orange]}>{p.label}</Text>
        <Text style={[s.valeur, !p.value && !afaire && s.valeurGris, afaire && s.orange]}>{p.value ? nom(p.value) : afaire ? 'À définir' : (p.vide ?? 'Facultatif')}</Text>
        {change && <Pastille texte={p.parent ? 'déplacée' : 'changée'} ouvert={ch.ouvert} onPress={ch.basculer} />}
        {!p.fige && <Text style={s.chev}>›</Text>}
      </Pressable>
      {change && ch.ouvert && (
        <DetailChangement
          avant={p.changement ? p.changement.avant : nom(p.depart!)}
          onAnnuler={() => {
            if (p.changement) p.changement.annuler();
            else p.onChange(p.depart!);
            ch.fermer();
          }}
        />
      )}
      {!!p.sous && <Text style={s.sous}>{p.sous}</Text>}
      {ouvert && (
        <FeuilleChoix
          titre={p.titreFeuille ?? p.label}
          value={p.value}
          groupes={p.groupes}
          autres={p.autres}
          nouveau={
            p.nouveau && {
              label: p.nouveau.label,
              onPress: () => {
                setOuvert(false);
                p.nouveau!.onPress();
              },
            }
          }
          sans={p.value ? p.sans : undefined}
          onChoisir={(v) => {
            setOuvert(false);
            p.onChange(v);
          }}
          onFermer={() => setOuvert(false)}
        />
      )}
    </View>
  );
}

/** Feuille de choix unique (monte au premier plan : rendue seulement quand elle est ouverte) */
export function FeuilleChoix({
  titre,
  value,
  groupes,
  autres,
  nouveau,
  sans,
  onChoisir,
  onFermer,
}: {
  titre: string;
  value: string;
  groupes: GroupeChoix[];
  autres?: AutresChoix;
  nouveau?: { label: string; onPress: () => void };
  sans?: string;
  onChoisir: (v: string) => void;
  onFermer: () => void;
}) {
  const [q, setQ] = useState('');
  const [autresOuverts, setAutresOuverts] = useState(false);
  // Groupes repliés par l'utilisateur (chaque titre de groupe ouvre et referme sa liste)
  const [fermes, setFermes] = useState<string[]>([]);
  const basculerGroupe = (k: string) => setFermes((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));
  const recherche = toutes(groupes, autres).length > 7;
  const cherche = !!q.trim();
  const filtre = (o: OptionChoix) => !q.trim() || o.label.toLowerCase().includes(q.trim().toLowerCase());
  // Le choix actuel reste visible même s'il est dans « Autres … »
  const dansAutres = autres?.groupes.find((g) => g.options.some((o) => o.value === value));
  const nbAutres = (autres?.groupes ?? []).reduce((n, g) => n + g.options.filter((o) => o.value !== value).length, 0);
  const Opt = ({ o }: { o: OptionChoix }) => {
    const on = o.value === value;
    return (
      <Pressable onPress={() => onChoisir(o.value)} style={[s.opt, on && s.optOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
        <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioPoint} />}</View>
        <View style={s.optCorps}>
          <Text style={[s.optLibelle, on && s.optTexteOn, o.retrait && { paddingLeft: 14 }]}>{o.label}</Text>
          {!!o.meta && <Text style={s.optMeta}>{o.meta}</Text>}
        </View>
        {o.badge && (
          <Text style={[s.badge, o.badge.ton === 'vert' ? s.badgeVert : s.badgeBleu]}>{o.badge.texte}</Text>
        )}
      </Pressable>
    );
  };
  const Groupe = ({ g, sauf, k }: { g: GroupeChoix; sauf?: string; k: string }) => {
    const l = g.options.filter((o) => o.value !== sauf && filtre(o));
    if (!l.length) return null;
    const ouvert = cherche || !fermes.includes(k);
    return (
      <>
        {!!g.titre && <EnteteGroupe titre={g.titre} n={l.length} ouvert={ouvert} onPress={() => basculerGroupe(k)} />}
        {ouvert && l.map((o) => <Opt key={o.value} o={o} />)}
      </>
    );
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable style={s.fond} onPress={onFermer} accessibilityLabel="Fermer sans rien changer">
        <Pressable style={s.feuille} onPress={() => {}}>
          <View style={s.poignee} />
          <View style={s.fEntete}>
            <Pressable onPress={onFermer} hitSlop={10} accessibilityRole="button">
              <Text style={s.fAnnuler}>Annuler</Text>
            </Pressable>
            <Text style={s.fTitre}>{titre}</Text>
            <View style={{ width: 64 }} />
          </View>
          {recherche && <TextInput style={s.recherche} placeholder="🔍 Rechercher" placeholderTextColor={colors.muted} value={q} onChangeText={setQ} />}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
            {nouveau && !cherche && (
              <Pressable onPress={nouveau.onPress} style={s.opt} accessibilityRole="button">
                <View style={s.icoPlus}>
                  <Text style={s.icoPlusTexte}>＋</Text>
                </View>
                <Text style={[s.optTexte, s.nouveauTexte]}>{nouveau.label}</Text>
              </Pressable>
            )}
            {groupes.map((g, i) => (
              <Groupe key={`g${i}`} k={`g${i}`} g={g} />
            ))}
            {autres && cherche && autres.groupes.map((g, i) => <Groupe key={`a${i}`} k={`a${i}`} g={g} />)}
            {autres && !cherche && (
              <>
                {dansAutres && <Groupe k="actuel" g={{ titre: dansAutres.titre, options: dansAutres.options.filter((o) => o.value === value) }} />}
                {nbAutres > 0 && (
                  <EnteteGroupe titre={autres.titre} n={nbAutres} ouvert={autresOuverts} onPress={() => setAutresOuverts((o) => !o)} autres />
                )}
                {autresOuverts && autres.groupes.map((g, i) => <Groupe key={`a${i}`} k={`a${i}`} g={g} sauf={value} />)}
              </>
            )}
            {cherche && !toutes(groupes, autres).some(filtre) && <Text style={s.rien}>Aucun résultat.</Text>}
            {!!sans && !cherche && (
              <Pressable onPress={() => onChoisir('')} style={[s.opt, s.sans]} accessibilityRole="button">
                <Text style={s.sansTexte}>⊘  {sans}</Text>
              </Pressable>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Choix multiple (membres d'une équipe…) : ligne « 4 membres › », feuille avec cases à cocher */
export function LigneMulti({
  label,
  values,
  depart,
  onChange,
  groupes,
  autres,
  attendu,
  nouveau,
  resume,
}: {
  label: string;
  values: string[];
  depart?: string[];
  onChange: (v: string[]) => void;
  groupes: GroupeChoix[];
  autres?: AutresChoix;
  attendu?: boolean;
  nouveau?: { label: string; onPress: () => void };
  /** « 4 membres » */
  resume: (n: number) => string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ch = useChangement();
  const opts = toutes(groupes, autres);
  const nom = (v: string) => opts.find((o) => o.value === v)?.label ?? '?';
  const cle = (l: string[]) => [...l].sort().join('|');
  const auto = useContext(AutoContext);
  const change = !auto && !!depart && cle(values) !== cle(depart);
  const afaire = !!attendu && !values.length;
  return (
    <View style={s.ligneBloc}>
      <Pressable onPress={() => setOuvert(true)} style={[s.ligne, afaire && s.ligneAFaire]} accessibilityRole="button">
        <Text style={[s.cle, afaire && s.orange]}>{label}</Text>
        <Text style={[s.valeur, !values.length && !afaire && s.valeurGris, afaire && s.orange]}>
          {values.length ? resume(values.length) : afaire ? 'À définir' : 'Facultatif'}
        </Text>
        {change && <Pastille texte="changée" ouvert={ch.ouvert} onPress={ch.basculer} />}
        <Text style={s.chev}>›</Text>
      </Pressable>
      {change && ch.ouvert && (
        <DetailChangement
          avant={depart!.length ? depart!.map(nom).join(', ') : 'personne'}
          onAnnuler={() => {
            onChange(depart!);
            ch.fermer();
          }}
        />
      )}
      {!!values.length && <Text style={s.sous}>{values.map(nom).join(' · ')}</Text>}
      {ouvert && (
        <FeuilleMulti
          titre={label}
          groupes={groupes}
          autres={autres}
          selection={values}
          nouveau={
            nouveau && {
              label: nouveau.label,
              onPress: () => {
                setOuvert(false);
                nouveau.onPress();
              },
            }
          }
          libelleValider={(n) => (n ? `Valider (${n})` : 'Valider')}
          onValider={(l) => {
            setOuvert(false);
            onChange(l);
          }}
          onFermer={() => setOuvert(false)}
        />
      )}
    </View>
  );
}

/** Feuille à cases à cocher (membres, « Ranger une tâche existante ») */
export function FeuilleMulti({
  titre,
  groupes,
  autres,
  selection,
  nouveau,
  libelleValider,
  onValider,
  onFermer,
  vide = 'Rien à choisir.',
}: {
  titre: string;
  groupes: GroupeChoix[];
  autres?: AutresChoix;
  selection: string[];
  nouveau?: { label: string; onPress: () => void };
  libelleValider: (n: number) => string;
  onValider: (l: string[]) => void;
  onFermer: () => void;
  vide?: string;
}) {
  const [sel, setSel] = useState<string[]>(selection);
  const [q, setQ] = useState('');
  const [autresOuverts, setAutresOuverts] = useState(false);
  // Groupes repliés par l'utilisateur (chaque titre de groupe ouvre et referme sa liste)
  const [fermes, setFermes] = useState<string[]>([]);
  const basculerGroupe = (k: string) => setFermes((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));
  const tout = toutes(groupes, autres);
  const filtre = (o: OptionChoix) => !q.trim() || o.label.toLowerCase().includes(q.trim().toLowerCase());
  const cherche = !!q.trim();
  const basculer = (v: string) => setSel((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  // Les éléments déjà cochés dans « Autres … » restent visibles
  const cochesAutres = (autres?.groupes ?? []).flatMap((g) => g.options).filter((o) => selection.includes(o.value));
  const nbAutres = (autres?.groupes ?? []).reduce((n, g) => n + g.options.filter((o) => !selection.includes(o.value)).length, 0);
  const Case = ({ o }: { o: OptionChoix }) => {
    const on = sel.includes(o.value);
    return (
      <Pressable onPress={() => basculer(o.value)} style={s.opt} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
        <View style={[s.coche, on && s.cocheOn]}>{on && <Text style={s.cocheMarque}>✓</Text>}</View>
        <View style={s.optCorps}>
          <Text style={s.optLibelle}>{o.label}</Text>
          {!!o.meta && <Text style={s.optMeta}>{o.meta}</Text>}
        </View>
      </Pressable>
    );
  };
  const Groupe = ({ g, sauf, k }: { g: GroupeChoix; sauf?: string[]; k: string }) => {
    const l = g.options.filter((o) => !sauf?.includes(o.value) && filtre(o));
    if (!l.length) return null;
    const ouvert = cherche || !fermes.includes(k);
    return (
      <>
        {!!g.titre && <EnteteGroupe titre={g.titre} n={l.length} ouvert={ouvert} onPress={() => basculerGroupe(k)} />}
        {ouvert && l.map((o) => <Case key={o.value} o={o} />)}
      </>
    );
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable style={s.fond} onPress={onFermer}>
        <Pressable style={s.feuille} onPress={() => {}}>
          <View style={s.poignee} />
          <View style={s.fEntete}>
            <Pressable onPress={onFermer} hitSlop={10} accessibilityRole="button">
              <Text style={s.fAnnuler}>Annuler</Text>
            </Pressable>
            <Text style={s.fTitre}>{titre}</Text>
            <View style={{ width: 64 }} />
          </View>
          {tout.length > 7 && <TextInput style={s.recherche} placeholder="🔍 Rechercher" placeholderTextColor={colors.muted} value={q} onChangeText={setQ} />}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
            {nouveau && !cherche && (
              <Pressable onPress={nouveau.onPress} style={s.opt} accessibilityRole="button">
                <View style={s.icoPlus}>
                  <Text style={s.icoPlusTexte}>＋</Text>
                </View>
                <Text style={[s.optTexte, s.nouveauTexte]}>{nouveau.label}</Text>
              </Pressable>
            )}
            {groupes.map((g, i) => (
              <Groupe key={`g${i}`} k={`g${i}`} g={g} />
            ))}
            {autres && cherche && autres.groupes.map((g, i) => <Groupe key={`a${i}`} k={`a${i}`} g={g} />)}
            {autres && !cherche && (
              <>
                {cochesAutres.length > 0 && <Groupe k="coches" g={{ options: cochesAutres }} />}
                {nbAutres > 0 && (
                  <EnteteGroupe titre={autres.titre} n={nbAutres} ouvert={autresOuverts} onPress={() => setAutresOuverts((o) => !o)} autres />
                )}
                {autresOuverts && autres.groupes.map((g, i) => <Groupe key={`a${i}`} k={`a${i}`} g={g} sauf={selection} />)}
              </>
            )}
            {!tout.length && <Text style={s.rien}>{vide}</Text>}
          </ScrollView>
          <Pressable onPress={() => onValider(sel)} style={s.valider} accessibilityRole="button">
            <Text style={s.validerTexte}>{libelleValider(sel.length)}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Élément d'une liste d'enfants (tâches d'une feature…) : toucher l'ouvre ; pastille « ajoutée » / « déplacée » */
export function LigneEnfant({
  texte,
  sous,
  onPress,
  ajoute,
  avant,
  onAnnuler,
  coche,
  meta,
}: {
  texte: string;
  sous?: string;
  /** Tâche : case à cocher pour la terminer (même ligne pour les tâches d'une feature, d'une epic, les sous-tâches) */
  coche?: { fait: boolean; enCours?: boolean; onPress?: () => void };
  /** Détail en gris sous le titre (date, estimation…) */
  meta?: string;
  onPress?: () => void;
  /** Rangée ici, pas encore enregistrée */
  ajoute?: boolean;
  /** Venait d'un autre parent (déplacée) */
  avant?: string;
  onAnnuler?: () => void;
}) {
  const ch = useChangement();
  return (
    <View style={s.ligneBloc}>
      <Pressable onPress={onPress} disabled={!onPress} style={s.ligne} accessibilityRole="button">
        {coche && (
          <Pressable
            onPress={coche.onPress}
            disabled={!coche.onPress}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: coche.fait }}
            accessibilityLabel={`Terminer ${texte}`}
            style={[s.caseRonde, coche.enCours && s.caseEnCours, coche.fait && s.caseFaite]}
          >
            {coche.fait && <Text style={s.caseMarque}>✓</Text>}
          </Pressable>
        )}
        <View style={s.enfantCorps}>
          <Text style={[s.enfantTexte, coche?.fait && s.enfantFait]}>{texte}</Text>
          {!!meta && <Text style={s.optMeta}>{meta}</Text>}
        </View>
        {ajoute && !avant && <Text style={[s.badge, s.badgeVert]}>ajoutée</Text>}
        {ajoute && !!avant && <Pastille texte="déplacée" ouvert={ch.ouvert} onPress={ch.basculer} />}
        {onPress && <Text style={s.chev}>›</Text>}
      </Pressable>
      {ajoute && ch.ouvert && onAnnuler && <DetailChangement avant={avant ?? ''} onAnnuler={onAnnuler} />}
      {ajoute && !avant && onAnnuler && (
        <Pressable onPress={onAnnuler} hitSlop={6} style={s.retirer} accessibilityRole="button">
          <Text style={s.detailLien}>Annuler le changement</Text>
        </Pressable>
      )}
      {!!sous && <Text style={s.sous}>{sous}</Text>}
    </View>
  );
}


/**
 * Liste d'enfants d'une fiche (epics d'un objectif, features d'une epic, objectifs d'un domaine…) avec le ＋ rond :
 * « ＋ Nouvelle … » (fiche par-dessus) ou « ↘ Ranger … existante » (cases à cocher). Les éléments rangés sont
 * montrés « ajoutée » / « déplacée » et ne sont rangés qu'à l'enregistrement.
 */
export function ListeEnfants({
  titre,
  enfants,
  candidats,
  ranger,
  setRanger,
  ajouterTout,
  nouveau,
  mots,
  vide,
  haut,
}: {
  titre: string;
  enfants: { id: string; texte: string; onPress?: () => void }[];
  /** Éléments qu'on peut ranger ici ; `ailleurs` : leur parent actuel (sinon ils sont libres) */
  candidats: { id: string; titre: string; ailleurs?: string }[];
  ranger: string[];
  setRanger: (l: string[]) => void;
  /** Élément existant (enregistré au fil de l'eau) : les éléments choisis sont ajoutés tout de suite */
  ajouterTout?: (ids: string[]) => void;
  nouveau?: () => void;
  /** « tâche » / « epic »… : « Nouvelle tâche », « Ranger une tâche existante » ; feuille : « Ranger dans l'epic » */
  mots: { nouveau: string; ranger: string; feuille: string; libres: string; autres: string; un: string; plusieurs: string };
  vide: string;
  /** Contenu en haut de la carte (barre d'avancement…) */
  haut?: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const [feuille, setFeuille] = useState(false);
  const libres = candidats.filter((c) => !c.ailleurs && !ranger.includes(c.id));
  const ailleurs = candidats.filter((c) => c.ailleurs && !ranger.includes(c.id));
  return (
    <>
      <SectionFiche titre={titre} onAjouter={() => setMenu(true)} ajouterLabel={`Ajouter : ${mots.nouveau}`}>
        {haut}
        {enfants.map((e) => (
          <LigneEnfant key={e.id} texte={e.texte} onPress={e.onPress} />
        ))}
        {ranger.map((id) => {
          const c = candidats.find((x) => x.id === id);
          return <LigneEnfant key={id} texte={c?.titre ?? '?'} ajoute avant={c?.ailleurs} onAnnuler={() => setRanger(ranger.filter((x) => x !== id))} />;
        })}
        {!enfants.length && !ranger.length && <Text style={s.rien}>{vide}</Text>}
      </SectionFiche>
      {ranger.length > 0 && <Text style={s.rangees}>{ranger.length > 1 ? mots.plusieurs : mots.un}</Text>}
      <ChoiceSheet
        key={`menu-${menu}`}
        visible={menu}
        title={`Ajouter : ${mots.nouveau.replace(/^Nouvel(le)? /, '')}`}
        choices={[...(nouveau ? [{ label: `＋ ${mots.nouveau}`, principal: true, onPress: nouveau }] : []), { label: `☑ ${mots.ranger}`, suite: true, onPress: () => setFeuille(true) }]}
        onClose={() => setMenu(false)}
      />
      {feuille && (
        <FeuilleMulti
          titre={mots.feuille}
          groupes={[{ titre: mots.libres, options: libres.map((c) => ({ value: c.id, label: c.titre })) }]}
          autres={ailleurs.length ? { titre: mots.autres, groupes: [{ options: ailleurs.map((c) => ({ value: c.id, label: c.titre, meta: c.ailleurs })) }] } : undefined}
          selection={[]}
          vide="Rien à ajouter."
          libelleValider={(n) => (n ? `Ajouter (${n})` : 'Ajouter')}
          onValider={(l) => {
            setFeuille(false);
            if (ajouterTout) return ajouterTout(l);
            setRanger([...ranger, ...l.filter((id) => !ranger.includes(id))]);
          }}
          onFermer={() => setFeuille(false)}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  titreSec: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 7, paddingHorizontal: 4, minHeight: 24 },
  titreSecTexte: { flex: 1, fontSize: 11.5, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  aDefinir: { fontSize: 12, fontWeight: '700', color: ORANGE },
  ou: { backgroundColor: ORANGE_FOND, borderLeftWidth: 3, borderLeftColor: ORANGE, paddingLeft: 9, paddingVertical: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  ouTexte: { fontSize: 11.5, fontWeight: '700', color: ORANGE, fontStyle: 'italic' },
  rond: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  rondTexte: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 18 },
  carte: { backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden' },
  ligneBloc: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, minHeight: 46 },
  champColonne: { flexDirection: 'column', alignItems: 'stretch', gap: 4 },
  cleColonne: { width: 'auto' as unknown as number },
  champ: { flex: 1, minWidth: 0 },
  saisie: { fontSize: 15, fontWeight: '600', color: colors.text, paddingVertical: 4, outlineStyle: 'none' as never },
  saisieVide: { fontWeight: '400' },
  estimation: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  estimationVide: { flex: 1 },
  unite: { fontSize: 15, fontWeight: '600', color: colors.text },
  saisieMulti: { minHeight: 70, fontWeight: '400', textAlignVertical: 'top' },
  caseRonde: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#B8BFCA', alignItems: 'center', justifyContent: 'center' },
  caseEnCours: { borderColor: colors.primary },
  caseFaite: { backgroundColor: colors.success, borderColor: colors.success },
  caseMarque: { color: '#fff', fontSize: 12, fontWeight: '800' },
  enfantCorps: { flex: 1, minWidth: 0 },
  enfantTexte: { fontSize: 15, color: colors.text },
  enfantFait: { color: colors.muted, textDecorationLine: 'line-through' },
  alerteChoix: { backgroundColor: JAUNE, borderWidth: 1, borderColor: '#F3D98B', borderRadius: 10, padding: 10, marginBottom: 10, gap: 8 },
  alerteTexte: { color: JAUNE_TEXTE, fontSize: 13.5, lineHeight: 19 },
  alerteBoutons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  alerteBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  alerteOui: { backgroundColor: colors.primary },
  alerteOuiTexte: { color: '#fff', fontSize: 13, fontWeight: '700' },
  alerteNon: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.primary },
  alerteNonTexte: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  ligneAFaire: { backgroundColor: ORANGE_FOND, borderLeftWidth: 3, borderLeftColor: ORANGE, paddingLeft: 9 },
  cle: { width: 104, fontSize: 13, color: colors.muted },
  valeur: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '600', color: colors.text },
  valeurGris: { color: CLAIR, fontWeight: '400' },
  orange: { color: ORANGE, fontWeight: '700' },
  chev: { fontSize: 20, color: '#A0A6B1', marginLeft: 2 },
  sous: { fontSize: 11.5, color: colors.muted, paddingHorizontal: 12, paddingBottom: 9, marginTop: -6 },
  pastille: { backgroundColor: JAUNE, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  pastilleTexte: { fontSize: 11, fontWeight: '700', color: JAUNE_TEXTE },
  detail: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, backgroundColor: JAUNE, paddingHorizontal: 12, paddingVertical: 7 },
  detailTexte: { flex: 1, minWidth: 120, fontSize: 12.5, color: JAUNE_TEXTE },
  detailLien: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  retirer: { paddingHorizontal: 12, paddingBottom: 8, alignSelf: 'flex-start' },
  // Feuille
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  feuille: { width: '100%', maxWidth: 520, maxHeight: '82%', backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 12 },
  poignee: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#C9CED8', marginTop: 8, marginBottom: 4 },
  fEntete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 },
  fAnnuler: { fontSize: 16, color: colors.primary, width: 64 },
  fTitre: { flex: 1, textAlign: 'center', fontSize: 16.5, fontWeight: '700', color: colors.text },
  recherche: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#E4E7ED', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: colors.text },
  grp: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 5 },
  grpLigne: { flexDirection: 'row', alignItems: 'flex-end', paddingRight: 14 },
  grpTexte: { flex: 1 },
  // « Autres … » : bandeau à part, bien séparé du groupe du dessus
  grpAutres: { marginTop: 18, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: '#E9ECF2' },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  optOn: { backgroundColor: '#EEF4FE' },
  optTexte: { flex: 1, minWidth: 0, fontSize: 15, color: colors.text },
  optTexteOn: { fontWeight: '700' },
  optCorps: { flex: 1, minWidth: 0 },
  optLibelle: { fontSize: 15, color: colors.text },
  optMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#C4C9D2', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioPoint: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  coche: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#C4C9D2', alignItems: 'center', justifyContent: 'center' },
  cocheOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  cocheMarque: { color: '#fff', fontSize: 12, fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '700', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  badgeVert: { color: '#1E8E3E', backgroundColor: '#E6F4EA' },
  badgeBleu: { color: colors.primary, backgroundColor: '#E8F0FE' },
  icoPlus: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  icoPlusTexte: { color: '#fff', fontSize: 15, fontWeight: '800', lineHeight: 17 },
  nouveauTexte: { color: colors.primary, fontWeight: '700' },
  replie: { color: colors.muted, fontSize: 14 },
  fleche: { fontSize: 13, color: colors.muted },
  sans: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sansTexte: { fontSize: 15, color: '#B3261E' },
  rien: { padding: 14, fontSize: 14, color: colors.muted },
  rangees: { marginTop: 6, marginHorizontal: 4, fontSize: 12, color: colors.muted },
  valider: { marginHorizontal: 12, marginTop: 8, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  validerTexte: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
});
