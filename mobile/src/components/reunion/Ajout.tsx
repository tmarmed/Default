import { type ReactNode, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../theme';
import { type ItemInput, RECURRENCE_DEFAUTS } from '../../types';
import { SectionFiche } from '../Choix';

/** Élément proposé à « Choisir un existant » */
export interface Ajoutable {
  id: string;
  titre: string;
  sous?: string;
}
/** Défaire un ajout (✕ sur la ligne ajoutée) */
export type Annuler = () => Promise<void>;

/**
 * « ＋ Ajouter … » d'une étape de réunion (08/10, validé) : chaque réunion ajoute l'élément qui la concerne
 * (tâche, objectif, story, feature, epic, résultat clé, domaine), à la bonne étape. La feuille propose toujours
 * « Nouveau » (titre, déjà rattaché au bon niveau, à la bonne date ou période) puis « Choisir un existant »
 * (recherche). Enregistré tout de suite ; les ajouts de la séance restent listés avec ✕ pour les défaire.
 */
export function AjoutElement({
  mot,
  feminin,
  existants,
  onNouveau,
  onChoisir,
  options,
  lecture,
  aide,
}: {
  /** « tâche », « objectif », « story »… */
  mot: string;
  feminin?: boolean;
  existants: Ajoutable[];
  /** Crée l'élément ; renvoie de quoi le défaire */
  onNouveau: (titre: string) => Promise<Annuler>;
  /** Rattache un élément existant ; renvoie de quoi le défaire */
  onChoisir?: (id: string) => Promise<Annuler>;
  /** Réglages en tête de la feuille (jour de la semaine…) */
  options?: ReactNode;
  lecture?: boolean;
  /** Ce que fait l'ajout (« pour demain », « échéance fin du trimestre »…) */
  aide?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [titre, setTitre] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajoutes, setAjoutes] = useState<{ cle: string; texte: string; annuler: Annuler }[]>([]);
  if (lecture) return null;
  const un = feminin ? 'une' : 'un';
  const nouveau = `${feminin ? 'Nouvelle' : 'Nouveau'} ${mot}`;
  const faire = async (texte: string, f: () => Promise<Annuler>) => {
    setBusy(true);
    setErreur(null);
    try {
      const annuler = await f();
      setAjoutes((l) => [...l, { cle: `${Date.now()}-${l.length}`, texte, annuler }]);
      setOuvert(false);
      setTitre('');
      setQ('');
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const mots = q.toLowerCase().split(/\s+/).filter(Boolean);
  const liste = existants.filter((x) => mots.every((m) => `${x.titre} ${x.sous ?? ''}`.toLowerCase().includes(m))).slice(0, 60);
  return (
    <>
      {ajoutes.length > 0 && (
        <SectionFiche titre={`Ajouté pendant la réunion · ${ajoutes.length}`}>
          {ajoutes.map((a, i) => (
            <View key={a.cle} style={[s.ligne, i > 0 && s.bord]}>
              <Text style={s.texte}>{a.texte}</Text>
              <Pressable
                onPress={() =>
                  a
                    .annuler()
                    .then(() => setAjoutes((l) => l.filter((x) => x.cle !== a.cle)))
                    .catch((e) => setErreur((e as Error).message))
                }
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Annuler l'ajout de « ${a.texte} »`}
              >
                <Text style={s.retirer}>✕</Text>
              </Pressable>
            </View>
          ))}
        </SectionFiche>
      )}
      <Pressable onPress={() => setOuvert(true)} style={s.plus} accessibilityRole="button">
        <Text style={s.plusTexte}>
          ＋ Ajouter {un} {mot}
        </Text>
      </Pressable>
      {!!erreur && !ouvert && <Text style={s.erreur}>{erreur}</Text>}
      {ouvert && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
          <View style={s.fond}>
            <View style={s.feuille}>
              <View style={s.poignee} />
              <View style={s.entete}>
                <Pressable onPress={() => setOuvert(false)} hitSlop={8} style={s.cote} accessibilityRole="button">
                  <Text style={s.annuler}>Annuler</Text>
                </Pressable>
                <Text style={s.titre}>
                  Ajouter {un} {mot}
                </Text>
                <View style={s.cote} />
              </View>
              {!!aide && <Text style={s.aide}>{aide}</Text>}
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
                {options}
                <Text style={s.section}>{nouveau.toUpperCase()}</Text>
                <View style={s.saisie}>
                  <TextInput
                    value={titre}
                    onChangeText={setTitre}
                    placeholder={`Titre ${feminin ? 'de la' : 'du'} ${mot}`}
                    placeholderTextColor={colors.muted}
                    style={s.input}
                    onSubmitEditing={() => titre.trim() && faire(titre.trim(), () => onNouveau(titre.trim()))}
                    returnKeyType="done"
                    autoFocus
                  />
                  <Pressable disabled={!titre.trim() || busy} onPress={() => faire(titre.trim(), () => onNouveau(titre.trim()))} style={[s.bouton, (!titre.trim() || busy) && s.inactif]} accessibilityRole="button">
                    <Text style={s.boutonTexte}>Créer</Text>
                  </Pressable>
                </View>
                {!!onChoisir && (
                  <>
                    <Text style={s.section}>CHOISIR {feminin ? 'UNE' : 'UN'} {mot.toUpperCase()} EXISTANT{feminin ? 'E' : ''}</Text>
                    <TextInput value={q} onChangeText={setQ} placeholder="🔍 Rechercher" placeholderTextColor={colors.muted} style={[s.input, s.recherche]} />
                    <View style={s.carte}>
                      {liste.length ? (
                        liste.map((x, i) => (
                          <Pressable key={x.id} disabled={busy} onPress={() => faire(x.titre, () => onChoisir(x.id))} style={[s.ligne, i > 0 && s.bord]} accessibilityRole="button">
                            <View style={{ flex: 1 }}>
                              <Text style={s.texte}>{x.titre}</Text>
                              {!!x.sous && <Text style={s.sous}>{x.sous}</Text>}
                            </View>
                            <Text style={s.chev}>＋</Text>
                          </Pressable>
                        ))
                      ) : (
                        <Text style={[s.sous, { padding: 12 }]}>{q ? 'Aucun résultat.' : 'Rien à choisir.'}</Text>
                      )}
                    </View>
                  </>
                )}
                {!!erreur && <Text style={s.erreur}>{erreur}</Text>}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

/** Tâche ou story à créer depuis une réunion (titre, puis le rattachement de l'étape) */
export function itemReunion(espace: string, titre: string, x: Partial<ItemInput>): ItemInput {
  return { ...RECURRENCE_DEFAUTS, espace, titre, type: 'tache', date: '', heure: '', heure_fin: '', date_fin: '', lieu: '', description: '', priorite: 'normale', statut: 'a_faire', parent: '', feature: '', epic: '', objectif: '', domaine: '', points: '', iteration: '', telephone: '', equipe: '', responsable: '', ...x } as ItemInput;
}

/** Jours d'une semaine à choisir (revue de la semaine) : « lun. 12 », « mar. 13 »… */
export function ChoixJour({ jours, value, onChange }: { jours: string[]; value: string; onChange: (j: string) => void }) {
  const nom = (j: string) => {
    const d = new Date(`${j}T12:00`);
    return `${['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d.getDay()]} ${d.getDate()}`;
  };
  return (
    <>
      <Text style={s.section}>JOUR</Text>
      <View style={s.jours}>
        {jours.map((j) => (
          <Pressable key={j} onPress={() => onChange(j)} style={[s.jour, j === value && s.jourOn]} accessibilityRole="radio" accessibilityState={{ selected: j === value }}>
            <Text style={[s.jourTexte, j === value && s.jourTexteOn]}>{nom(j)}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  plus: { marginHorizontal: 16, marginTop: 4, marginBottom: 8, paddingVertical: 10 },
  plusTexte: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  feuille: { width: '100%', maxWidth: 480, maxHeight: '88%', backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 12 },
  poignee: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: '#D0D5DD', marginTop: 8 },
  entete: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  cote: { width: 70 },
  annuler: { color: colors.primary, fontSize: 16 },
  titre: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text },
  aide: { fontSize: 13, color: colors.muted, paddingHorizontal: 16, paddingBottom: 6 },
  section: { fontSize: 12, fontWeight: '700', color: colors.muted, marginHorizontal: 16, marginTop: 14, marginBottom: 6, letterSpacing: 0.4 },
  saisie: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16 },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.text },
  recherche: { marginHorizontal: 16, marginBottom: 8, flex: 0 },
  bouton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  boutonTexte: { color: '#fff', fontWeight: '700', fontSize: 15 },
  inactif: { opacity: 0.4 },
  carte: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  bord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4E7EC' },
  texte: { flex: 1, fontSize: 15, color: colors.text },
  sous: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  chev: { fontSize: 18, color: colors.primary },
  retirer: { fontSize: 15, color: colors.muted },
  erreur: { color: colors.danger, marginHorizontal: 16, marginTop: 8 },
  jours: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 16 },
  jour: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#E9EDF2' },
  jourOn: { backgroundColor: colors.primary },
  jourTexte: { fontSize: 13, color: colors.text },
  jourTexteOn: { color: '#fff', fontWeight: '600' },
});
