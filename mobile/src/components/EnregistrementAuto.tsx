import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * Enregistrement au fil de l'eau d'un élément EXISTANT (comme l'arbre de l'Organisation) : chaque changement de la
 * fiche est enregistré tout de suite (un court délai pour la saisie de texte), sans bouton Enregistrer ; un bandeau
 * dit ce qui a été enregistré et propose « Annuler », puis disparaît tout seul (6 s) ou dès qu'on touche ailleurs.
 * Un élément NOUVEAU garde « Annuler / Enregistrer » : rien n'est créé avant « Enregistrer ».
 */

/** Dans une fiche enregistrée au fil de l'eau, plus de pastille « changée / déplacée » : le bandeau la remplace */
export const AutoContext = createContext(false);

/** Délai après le dernier changement avant d'enregistrer (le temps de finir un mot) */
const DELAI = 900;
const DUREE_BANDEAU = 6000;

type Bandeau = { texte: string; annuler?: () => Promise<void> | void };

export function useBandeau() {
  const [bandeau, setBandeau] = useState<Bandeau | null>(null);
  useEffect(() => {
    if (!bandeau) return;
    const t = setTimeout(() => setBandeau(null), DUREE_BANDEAU);
    return () => clearTimeout(t);
  }, [bandeau]);
  const fermer = useCallback(() => setBandeau((b) => (b ? null : b)), []);
  return { bandeau, annoncer: setBandeau, fermer };
}

/** Bandeau du bas : ce qui vient d'être enregistré, « Annuler », ✕ */
export function BandeauAnnuler({ bandeau, fermer }: { bandeau: Bandeau | null; fermer: () => void }) {
  if (!bandeau) return null;
  return (
    <View style={s.bandeau} accessibilityRole="alert">
      <Text style={s.texte}>{bandeau.texte}</Text>
      {bandeau.annuler && (
        <Pressable
          onPress={() => {
            const a = bandeau.annuler!;
            fermer();
            a();
          }}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={s.btn}>Annuler</Text>
        </Pressable>
      )}
      <Pressable onPress={fermer} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer le message">
        <Text style={s.fermer}>✕</Text>
      </Pressable>
    </View>
  );
}

/**
 * Texte du bandeau d'un changement : « Responsable : Nina Dupont », « Titre enregistré », « 2 changements
 * enregistrés ». `libelles` : nom de chaque champ ; `textes` : champs de texte libre (juste « enregistré ») ;
 * `valeur` : valeur lisible (nom d'une personne, d'une epic…).
 */
export function decrireChangement<T extends object>(
  avant: T,
  apres: T,
  libelles: Partial<Record<keyof T, string>>,
  valeur: (k: keyof T, v: string) => string = (_k, v) => v,
  textes: (keyof T)[] = [],
): string {
  const champs = (Object.keys(apres) as (keyof T)[]).filter((k) => JSON.stringify(avant[k]) !== JSON.stringify(apres[k]));
  if (champs.length !== 1) return champs.length ? `${champs.length} changements enregistrés` : 'Enregistré';
  const k = champs[0];
  const nom = libelles[k] ?? 'Changement';
  if (textes.includes(k)) return `${nom} enregistré`;
  const v = apres[k];
  const s = Array.isArray(v) ? `${v.length}` : String(v ?? '');
  return `${nom} : ${s ? valeur(k, s) : 'aucun'}`;
}

/** Création faite depuis une ligne de cette fiche (« ＋ Nouvelle personne ») : annoncée et défaite avec le choix */
export type CreationLiee = { texte: string; supprimer: () => Promise<void> };

export function useEnregistrementAuto<T>({
  actif,
  cle,
  initial,
  form,
  setForm,
  enregistrer,
  decrire,
  bloque,
}: {
  /** Élément existant (sinon : rien d'automatique) */
  actif: boolean;
  /** Identifiant de l'élément : l'état enregistré repart de `initial` à chaque nouvel élément */
  cle: string;
  /** L'élément tel qu'il est enregistré, sous la forme du formulaire (à l'ouverture de la fiche) */
  initial: T;
  form: T;
  setForm: (f: T) => void;
  enregistrer: (f: T) => Promise<unknown>;
  /** Texte du bandeau pour ce changement (« Responsable : Nina Dupont ») */
  decrire: (avant: T, apres: T) => string;
  /** Raison d'attendre (valeur impossible, question sans réponse) : rien n'est enregistré tant qu'elle existe */
  bloque?: string | null;
}) {
  const { bandeau, annoncer, fermer } = useBandeau();
  const sauve = useRef<string>('');
  const sauveForm = useRef<T>(form);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creation = useRef<CreationLiee | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const formRef = useRef(form);
  formRef.current = form;
  const actifRef = useRef(actif);
  actifRef.current = actif;
  // Toujours les dernières fonctions (sans relancer le délai à chaque affichage)
  const fn = useRef({ enregistrer, decrire, setForm });
  fn.current = { enregistrer, decrire, setForm };

  // Élément ouvert (ou tout juste créé) : l'état enregistré est celui de l'élément
  const init = JSON.stringify(initial);
  const [pret, setPret] = useState(false);
  useEffect(() => {
    sauve.current = init;
    sauveForm.current = initial;
    creation.current = null;
    setPret(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, actif]);

  const valider = useCallback(async () => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = null;
    const f = formRef.current;
    const j = JSON.stringify(f);
    if (!actifRef.current || j === sauve.current) return true;
    const avant = sauveForm.current;
    const cree = creation.current;
    creation.current = null;
    sauve.current = j;
    sauveForm.current = f;
    try {
      setErreur(null);
      await fn.current.enregistrer(f);
      annoncer({
        texte: cree ? cree.texte : fn.current.decrire(avant, f),
        annuler: async () => {
          sauve.current = JSON.stringify(avant);
          sauveForm.current = avant;
          fn.current.setForm(avant);
          await fn.current.enregistrer(avant);
          if (cree) await cree.supprimer();
        },
      });
      return true;
    } catch (e) {
      // Pas enregistré : on le retentera au prochain changement
      sauve.current = JSON.stringify(avant);
      sauveForm.current = avant;
      setErreur(`Non enregistré : ${(e as Error).message}`);
      return false;
    }
  }, [annoncer]);

  // Chaque changement est enregistré après un court délai (sauf s'il est bloqué)
  useEffect(() => {
    if (!actif || !pret || bloque || JSON.stringify(form) === sauve.current) return;
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => void valider(), DELAI);
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [form, actif, pret, bloque, valider]);

  // Fiche fermée d'un coup (« Tout fermer ») avant la fin du délai : ce qui attend est quand même enregistré
  const validerRef = useRef(valider);
  validerRef.current = valider;
  useEffect(
    () => () => {
      if (minuteur.current) void validerRef.current();
    },
    [],
  );

  return {
    bandeau,
    annoncer,
    fermerBandeau: fermer,
    erreur,
    /** À la fermeture : enregistre ce qui attend ; false si c'est impossible (valeur à corriger) */
    avantFermer: async () => (bloque ? false : valider()),
    /** Le prochain changement vient d'une création depuis cette fiche */
    lierCreation: (c: CreationLiee) => {
      creation.current = c;
    },
  };
}

const s = StyleSheet.create({
  bandeau: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    boxShadow: '0 2px 10px rgba(20, 30, 50, 0.10)',
  },
  texte: { flex: 1, color: colors.text, fontSize: 13.5 },
  btn: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  fermer: { color: colors.muted, fontSize: 14 },
});

