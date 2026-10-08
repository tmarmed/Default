import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { type ChoixConcret, erreurChoix, LIBELLE_TYPE_CREE, type QueFaire, type QuiCharge, rattachementPour, typeParDefaut, TYPES_CREES, type TypeCree } from '../../concretisation';
import { elementDe } from '../../elementConcerne';
import { useHierarchy } from '../../hierarchyContext';
import { colors } from '../../theme';
import { TYPE_ICONS } from '../../types';
import { LigneChoix } from '../Choix';
import { DateField } from '../DateField';
import { LigneElement } from './ui';

export interface PersonneChoix {
  email: string;
  nom: string;
  /** « RTE du train Clients », « animatrice du daily »… */
  meta?: string;
}

/**
 * Feuille « Concrétiser » (08/10, maquettes/escalade-retour) : une section par question, tout prérempli, un seul
 * bouton. Que faire ? · Qui s'en charge ? · Validation · Échéance. L'élément concerné est celui du point (choisi en le
 * notant) : il n'est plus redemandé ici ; « Rattaché à › » part de lui et peut monter plus haut (08/10). « Créer une tâche… » :
 * Type › (tous les types), Titre, Rattaché à › (l'élément du dessus, qui change avec le type).
 */
export function FeuilleConcretiser({
  titre = 'Concrétiser',
  sous,
  valeur,
  moi,
  equipe,
  dessus,
  validateurs,
  contexte,
  onValider,
  onFermer,
}: {
  titre?: string;
  /** « Blocage noté par Tom Faure : « … » » */
  sous: string;
  valeur: ChoixConcret;
  moi: PersonneChoix;
  /** Mon équipe (transmettre) */
  equipe: PersonneChoix[];
  /** Niveau du dessus (escalader) */
  dessus: PersonneChoix[];
  validateurs: PersonneChoix[];
  /** Éléments du contexte de la réunion (ids), en tête de « Élément concerné » */
  contexte: string[];
  onValider: (c: ChoixConcret) => void;
  onFermer: () => void;
}) {
  const h = useHierarchy();
  const [c, setC] = useState<ChoixConcret>(valeur);
  const set = (x: Partial<ChoixConcret>) => setC((y) => ({ ...y, ...x }));
  const ratt = c.que === 'creer' ? rattachementPour(c.type, c.element, h) : null;
  // Le rattachement suit le type et l'élément concerné, sauf s'il a été choisi à la main
  const [rattMain, setRattMain] = useState(false);
  const rattId = rattMain ? c.ratt : (ratt?.id ?? '');
  const choix = { ...c, ratt: rattId };
  const erreur = erreurChoix(choix, h) ?? (c.que === 'creer' && (c.type === 'story' || c.type === 'feature') && !rattId ? 'Choisissez à quoi la rattacher.' : null);
  const personnesDe = (q: QuiCharge) => (q === 'moi' ? [moi] : q === 'equipe' ? equipe.filter((x) => x.email !== moi.email) : dessus);
  const changerQui = (q: QuiCharge) => {
    const l = personnesDe(q);
    // Escalader : le niveau du dessus décide, on suit seulement (re-concrétiser au retour de la réponse)
    set({ qui: q, resp: l.some((x) => x.email === c.resp) ? c.resp : (l[0]?.email ?? ''), ...(q === 'dessus' && c.que === 'creer' ? { que: 'suivre' as QueFaire } : {}) });
  };
  const nom = (l: PersonneChoix[], v: string) => l.find((x) => x.email === v)?.nom ?? v;
  const libRatt = (() => {
    if (!rattId) return c.type === 'story' || c.type === 'feature' ? 'À choisir' : 'Aucun · dans l’équipe et le sprint';
    const y = elementDe(rattId, h);
    return y ? `${y.icone} ${y.titre}` : rattId;
  })();

  const puces = <T extends string>(options: { v: T; l: string; aide?: string; off?: boolean }[], value: T, onChange: (v: T) => void) => (
    <View style={s.puces}>
      {options.map((o) => (
        <Pressable key={o.v} disabled={o.off} onPress={() => onChange(o.v)} style={[s.puce, o.v === value && s.puceOn, o.off && s.inactif]} accessibilityRole="radio" accessibilityState={{ selected: o.v === value, disabled: !!o.off }}>
          <Text style={[s.puceTexte, o.v === value && s.puceTexteOn]}>
            {o.l}
            {!!o.aide && <Text style={[s.aide, o.v === value && s.aideOn]}> ({o.aide})</Text>}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFermer}>
      <View style={s.fond}>
        <View style={s.feuille}>
          <View style={s.poignee} />
          <View style={s.entete}>
            <Pressable onPress={onFermer} hitSlop={8} style={s.cote} accessibilityRole="button">
              <Text style={s.annuler}>Annuler</Text>
            </Pressable>
            <Text style={s.titre}>{titre}</Text>
            <View style={s.cote} />
          </View>
          <Text style={s.sousTitre}>{sous}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
            <Text style={s.section}>QUE FAIRE ?</Text>
            <View style={s.carte}>
              {puces<QueFaire>(
                [
                  { v: 'suivre', l: '📌 Suivre', aide: 'point de suivi' },
                  { v: 'creer', l: '✓ Créer une tâche…', off: c.qui === 'dessus' },
                  { v: 'rien', l: '⊘ Rien', aide: 'clos' },
                ],
                c.que,
                (v) => set({ que: v, ...(v === 'creer' && !rattMain ? { type: typeParDefaut(c.element, h) } : {}) }),
              )}
              {c.qui === 'dessus' && <Text style={[s.aide, { paddingHorizontal: 12, paddingBottom: 8 }]}>Escaladé : le niveau du dessus décide ; vous pourrez re-concrétiser au retour de la réponse.</Text>}
              {c.que === 'creer' && (
                <>
                  <View style={s.bord}>
                    <LigneChoix
                      label="Type"
                      value={c.type}
                      onChange={(v) => {
                        setRattMain(false);
                        set({ type: (v || c.type) as TypeCree });
                      }}
                      groupes={[{ options: TYPES_CREES.map((t) => ({ value: t, label: `${t === 'feature' ? '🧩' : t === 'reunion' ? '🗓️' : (TYPE_ICONS[t] ?? '✓')} ${LIBELLE_TYPE_CREE(t)}` })) }]}
                      libelle={(v) => {
                        const t = v as TypeCree;
                        const sousEl = rattId && t !== 'reunion' && t !== 'story' && t !== 'feature' && elementDe(rattId, h)?.genre === 'item';
                        return `${LIBELLE_TYPE_CREE(t)}${sousEl ? ' (sous-tâche)' : ''}`;
                      }}
                      fixe
                    />
                  </View>
                  <View style={[s.ligne, s.bord]}>
                    <Text style={s.cle}>Titre</Text>
                    <TextInput value={c.titre} onChangeText={(v) => set({ titre: v })} style={s.input} placeholder="Titre" placeholderTextColor={colors.muted} />
                  </View>
                  <View style={s.bord}>
                    <LigneElementRatt
                      label={c.type === 'reunion' ? 'Liée à' : 'Rattaché à'}
                      value={rattId}
                      libelle={libRatt}
                      orange={!rattId && (c.type === 'story' || c.type === 'feature')}
                      onChange={(v) => {
                        setRattMain(true);
                        set({ ratt: v });
                      }}
                      contexte={[c.element, ...contexte]}
                    />
                  </View>
                </>
              )}
            </View>

            {c.que !== 'rien' && (
              <>
                <Text style={s.section}>QUI S'EN CHARGE ?</Text>
                <View style={s.carte}>
                  {puces<QuiCharge>(
                    [
                      { v: 'moi', l: 'Moi', aide: 'suivre' },
                      { v: 'equipe', l: 'Mon équipe', aide: 'transmettre' },
                      ...(dessus.length ? [{ v: 'dessus' as QuiCharge, l: '⤴ Niveau du dessus', aide: 'escalader' }] : []),
                    ],
                    c.qui,
                    changerQui,
                  )}
                  <View style={s.bord}>
                    <LigneChoix
                      label="Responsable"
                      value={c.resp}
                      onChange={(v) => v && set({ resp: v })}
                      groupes={[{ options: personnesDe(c.qui).map((x) => ({ value: x.email, label: x.nom, meta: x.meta })) }]}
                      libelle={(v) => nom([moi, ...equipe, ...dessus], v)}
                      fixe
                    />
                  </View>
                </View>

                <Text style={s.section}>VALIDATION</Text>
                <View style={s.carte}>
                  <LigneChoix
                    label="Validé par"
                    value={c.valid}
                    onChange={(v) => v && set({ valid: v })}
                    groupes={[{ options: validateurs.map((x) => ({ value: x.email, label: x.nom, meta: x.meta })) }]}
                    libelle={(v) => {
                      const x = validateurs.find((y) => y.email === v);
                      return x ? `${x.nom}${x.meta ? ` · ${x.meta}` : ''}` : v;
                    }}
                    fixe
                  />
                </View>

                <Text style={s.section}>ÉCHÉANCE</Text>
                <View style={[s.carte, s.ligne]}>
                  <DateField nu mode="date" value={c.ech} onChange={(v) => set({ ech: v })} placeholder="Sans échéance" />
                </View>
              </>
            )}
            {!!erreur && <Text style={s.erreur}>{erreur}</Text>}
          </ScrollView>
          <Pressable disabled={!!erreur} onPress={() => onValider(choix)} style={[s.bouton, !!erreur && s.inactif]} accessibilityRole="button">
            <Text style={s.boutonTexte}>{titre === 'Concrétiser' ? 'Concrétiser' : 'Valider'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** « Rattaché à › » : l'élément du dessus (calculé), modifiable ; orange « À choisir » s'il manque */
function LigneElementRatt({ label, value, libelle, orange, onChange, contexte }: { label: string; value: string; libelle: string; orange: boolean; onChange: (v: string) => void; contexte: string[] }) {
  const [ouvert, setOuvert] = useState(false);
  return ouvert ? (
    <View>
      <LigneElement value={value} onChange={(v) => (onChange(v), setOuvert(false))} contexte={contexte} />
    </View>
  ) : (
    <Pressable onPress={() => setOuvert(true)} style={s.ligne} accessibilityRole="button">
      <Text style={s.cle}>{label}</Text>
      <Text style={[s.valeur, orange && s.orange]} numberOfLines={1}>
        {libelle}
      </Text>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  feuille: { width: '100%', maxWidth: 480, maxHeight: '94%', backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 14 },
  poignee: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: '#D0D5DD', marginTop: 8 },
  entete: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10 },
  cote: { width: 70 },
  annuler: { color: colors.primary, fontSize: 16 },
  titre: { flex: 1, textAlign: 'center', fontSize: 16.5, fontWeight: '700', color: colors.text },
  sousTitre: { fontSize: 13, color: colors.muted, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2 },
  section: { fontSize: 12, fontWeight: '700', color: colors.muted, marginHorizontal: 16, marginTop: 14, marginBottom: 6, letterSpacing: 0.4 },
  carte: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, overflow: 'hidden' },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10 },
  puce: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#EEF0F3' },
  puceOn: { backgroundColor: colors.primary },
  puceTexte: { fontSize: 13.5, color: colors.text },
  puceTexteOn: { color: '#fff', fontWeight: '600' },
  aide: { fontSize: 11.5, color: colors.muted, fontWeight: '400' },
  aideOn: { color: '#DCE8FD' },
  bord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4E7EC' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, minHeight: 46 },
  cle: { width: 104, fontSize: 13, color: colors.muted },
  valeur: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  orange: { color: '#C2410C' },
  chev: { fontSize: 18, color: '#B0B7C3' },
  input: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, paddingVertical: 2 },
  erreur: { color: '#C2410C', marginHorizontal: 16, marginTop: 10, fontSize: 13 },
  bouton: { marginHorizontal: 16, marginTop: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  inactif: { opacity: 0.4 },
  boutonTexte: { color: '#fff', fontWeight: '700', fontSize: 15.5 },
});
/** Styles de la feuille (repris par la feuille du point de suivi) */
export const stylesFeuille = s;
