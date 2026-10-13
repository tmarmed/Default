import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { type ChoixConcret, erreurChoix, estSuivi, LIBELLE_TYPE_CREE, type QueFaire, type QuiCharge, rattachementPour, typeParDefaut, TYPES_CREES, type TypeCree } from '../../concretisation';
import { congesDe, useConges } from '../../conges';
import { addDays, toDateString } from '../../dates';
import { elementDe } from '../../elementConcerne';
import { useHierarchy } from '../../hierarchyContext';
import { jourCourt } from '../../pointsSuivi';
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
 * Feuille « Concrétiser » (refonte validée le 13/10) : trois questions indépendantes, tout prérempli, un seul bouton.
 * Type (Rien · Créer un élément · ⚡ Action rapide · Demande de budget) · À qui (moi ou mon équipe ; « ↪ Transmettre » à
 * part : remplaçant d'un absent, autre équipe, niveau du dessus) · Suivi (oui : validation et échéance ; non : la note
 * est close). L'élément concerné est celui du point ; « Rattaché à › » part de lui et peut monter plus haut.
 */
export function FeuilleConcretiser({
  titre = 'Concrétiser',
  sous,
  valeur,
  moi,
  equipe,
  dessus,
  autres = [],
  nomEquipe = '',
  nomDessus = '',
  validateurs,
  contexte,
  budget,
  onValider,
  onFermer,
}: {
  /** 💶 Demande de budget (13/10) : proposée à qui a le droit « Gérer le budget » ; éléments possibles (epics, niveau) */
  budget?: { pour: { value: string; label: string }[]; decideur: string };
  titre?: string;
  /** « Blocage noté par Tom Faure : « … » » */
  sous: string;
  valeur: ChoixConcret;
  moi: PersonneChoix;
  /** Mon équipe (transmettre) */
  equipe: PersonneChoix[];
  /** Niveau du dessus (transmettre au train : ex-escalade) */
  dessus: PersonneChoix[];
  /** Autres équipes du même train (transmettre sur le côté), par équipe */
  autres?: { titre: string; personnes: PersonneChoix[] }[];
  /** « Mobile » (équipe) et « Train Clients » (niveau du dessus) : titres des groupes de « Responsable › » */
  nomEquipe?: string;
  nomDessus?: string;
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
  // Responsable (validation du 08/10) : un seul champ groupé ; la façon de transmettre se déduit de la personne
  const autresTous = autres.flatMap((g) => g.personnes);
  const quiDe = (email: string): QuiCharge => (email === moi.email ? 'moi' : 'equipe');
  // Une personne du niveau du dessus est choisie « ↑e-mail » : la même personne peut aussi être de l'équipe (ou vous)
  const changerResp = (v: string) => {
    const email = v.replace(/^↑/, '');
    const q = v.startsWith('↑') ? 'dessus' : quiDe(email);
    // Transmis au train : le niveau du dessus décide, on suit seulement (re-concrétiser au retour de la réponse)
    set({ resp: email, qui: q, transmis: true, ...(q === 'dessus' && c.que === 'creer' ? { que: 'suivre' as QueFaire } : {}) });
  };
  const nom = (l: PersonneChoix[], v: string) => l.find((x) => x.email === v)?.nom ?? v;
  // Responsable absent d'ici l'échéance (congés, fermetures) : on prévient et on propose de transmettre (13/10)
  const { conges } = useConges();
  const absence = (() => {
    if (c.que === 'rien' || c.que === 'budget' || !c.resp || c.qui === 'dessus') return '';
    const auj = toDateString(new Date());
    const fin = c.ech && c.ech > auj ? c.ech : toDateString(addDays(new Date(), 7));
    const ab = congesDe(conges, c.resp, auj, fin);
    if (!ab.length) return '';
    const du = ab.reduce((m, x) => (x.du < m ? x.du : m), ab[0].du);
    const au = ab.reduce((m, x) => (x.au > m ? x.au : m), ab[0].au);
    const qui = nom([moi, ...equipe, ...autresTous], c.resp);
    const debut = du < auj ? auj : du;
    return debut === au ? `Absence de ${qui} le ${jourCourt(au)}.` : `Absence de ${qui} du ${jourCourt(debut)} au ${jourCourt(au)}.`;
  })();
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
            <Text style={s.section}>TYPE</Text>
            <View style={s.carte}>
              {puces<QueFaire>(
                [
                  { v: 'rien', l: '⊘ Rien', aide: 'clos' },
                  { v: 'creer', l: '✓ Créer un élément', off: c.qui === 'dessus' },
                  { v: 'suivre', l: '⚡ Action rapide', aide: 'sans élément' },
                  ...(budget ? [{ v: 'budget' as QueFaire, l: '💶 Demande de budget', aide: budget.decideur }] : []),
                ],
                c.que,
                (v) => set({ que: v, ...(v === 'creer' && !rattMain ? { type: typeParDefaut(c.element, h) } : {}) }),
              )}
              {c.que === 'suivre' && <Text style={[s.aide, s.aideBloc]}>Une action à faire, sans créer d’élément : suivie jusqu’à validation.</Text>}
              {c.que === 'budget' && budget && (
                <>
                  <View style={[s.ligne, s.bord]}>
                    <Text style={s.cle}>Montant (€)</Text>
                    <TextInput value={c.montant ?? ''} onChangeText={(v) => set({ montant: v.replace(/[^0-9.,]/g, '') })} style={s.input} placeholder="Ex. 1200" placeholderTextColor={colors.muted} keyboardType="decimal-pad" accessibilityLabel="Montant de la demande" />
                  </View>
                  <View style={s.bord}>
                    {puces<string>(
                      [
                        { v: 'ponctuel', l: 'Ponctuel' },
                        { v: 'mois', l: 'Par mois' },
                        { v: 'an', l: 'Par an' },
                      ],
                      c.periode || 'ponctuel',
                      (v) => set({ periode: v }),
                    )}
                  </View>
                  <View style={s.bord}>
                    <LigneChoix label="Pour" value={c.pour || budget.pour[0]?.value || ''} onChange={(v) => v && set({ pour: v })} groupes={[{ options: budget.pour }]} libelle={(v) => budget.pour.find((x) => x.value === v)?.label ?? v} fixe />
                  </View>
                  <Text style={[s.aide, { paddingHorizontal: 12, paddingBottom: 8 }]}>Soumise à l’envoi du compte rendu ; la note est close, la demande suit son circuit (décision en réunion ou depuis le Chat).</Text>
                </>
              )}
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

            {c.que !== 'rien' && c.que !== 'budget' && (
              <>
                <Text style={s.section}>À QUI ?</Text>
                <View style={s.carte}>
                  {!c.transmis ? (
                    <LigneChoix
                      label="Responsable"
                      value={c.resp}
                      onChange={(v) => v && set({ resp: v, qui: v === moi.email ? 'moi' : 'equipe' })}
                      groupes={[
                        { titre: 'Moi', options: [{ value: moi.email, label: moi.nom, meta: moi.meta }] },
                        { titre: nomEquipe ? `Équipe ${nomEquipe}` : 'Mon équipe', options: equipe.filter((x) => x.email !== moi.email).map((x) => ({ value: x.email, label: x.nom, meta: x.meta })) },
                      ].filter((g) => g.options.length)}
                      libelle={(v) => nom([moi, ...equipe, ...autresTous, ...dessus], v)}
                      fixe
                    />
                  ) : (
                    <LigneChoix
                      label="↪ Transmettre à"
                      value={c.qui === 'dessus' ? `↑${c.resp}` : c.resp}
                      onChange={(v) => v && changerResp(v)}
                      groupes={[
                        { titre: nomEquipe ? `Équipe ${nomEquipe} · remplaçant` : 'Mon équipe · remplaçant', options: equipe.filter((x) => x.email !== moi.email).map((x) => ({ value: x.email, label: x.nom, meta: x.meta })) },
                        ...autres.map((g) => ({ titre: g.titre, options: g.personnes.filter((x) => x.email !== moi.email).map((x) => ({ value: x.email, label: x.nom, meta: x.meta })) })),
                        ...(dessus.length ? [{ titre: `${nomDessus || 'Niveau du dessus'} · escalade`, options: [...new Map(dessus.map((x) => [x.email, x])).keys()].map((m) => ({ value: `↑${m}`, label: dessus.find((x) => x.email === m)!.nom, meta: dessus.filter((x) => x.email === m).map((x) => x.meta).filter(Boolean).join(' · ') })) }] : []),
                      ].filter((g) => g.options.length)}
                      libelle={(v) => !v || v === '↑' ? 'À choisir' : `${nom([moi, ...equipe, ...autresTous, ...dessus], v.replace(/^↑/, ''))}${v.startsWith('↑') ? ` · ${nomDessus || 'niveau du dessus'}` : ''}`}
                      fixe
                    />
                  )}
                  {!!absence && (
                    <View style={[s.bord, s.alerte]}>
                      <Text style={s.alerteTexte}>⚠️ {absence}</Text>
                      {!c.transmis && (
                        <Pressable onPress={() => set({ transmis: true, resp: '' })} hitSlop={6} accessibilityRole="button">
                          <Text style={s.lien}>↪ Transmettre à un remplaçant</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                  <Pressable
                    onPress={() => (c.transmis ? set({ transmis: false, qui: c.resp === moi.email ? 'moi' : 'equipe', resp: c.qui === 'dessus' || !equipe.some((x) => x.email === c.resp) ? moi.email : c.resp }) : set({ transmis: true, resp: '' }))}
                    style={[s.ligne, s.bord]}
                    accessibilityRole="button"
                  >
                    <Text style={s.lien}>{c.transmis ? '← Affecter dans l’équipe' : '↪ Transmettre'}</Text>
                    <Text style={[s.aide, { flex: 1 }]} numberOfLines={2}>
                      {c.transmis ? (c.qui === 'dessus' ? `${nomDessus || 'Le niveau du dessus'} décide ; vous pourrez re-concrétiser au retour de la réponse.` : 'Toujours suivi jusqu’à validation.') : 'responsable absent, autre équipe ou niveau du dessus'}
                    </Text>
                  </Pressable>
                </View>

                {c.que === 'creer' && !c.transmis && c.qui !== 'dessus' && (
                  <>
                    <Text style={s.section}>SUIVI</Text>
                    <View style={s.carte}>
                      {puces<'oui' | 'non'>(
                        [
                          { v: 'oui', l: '📌 Suivi', aide: 'jusqu’à validation' },
                          { v: 'non', l: 'Sans suivi', aide: 'la note est close' },
                        ],
                        c.suivi === false ? 'non' : 'oui',
                        (v) => set({ suivi: v === 'oui' }),
                      )}
                      {c.suivi === false && <Text style={[s.aide, s.aideBloc]}>L’élément est créé et vit sa vie ; la note n’est plus suivie en réunion.</Text>}
                    </View>
                  </>
                )}

                {estSuivi(c) && (
                  <>
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
  aideBloc: { paddingHorizontal: 12, paddingBottom: 8 },
  alerte: { paddingHorizontal: 12, paddingVertical: 10, gap: 6, backgroundColor: '#FFF7ED' },
  alerteTexte: { fontSize: 13, color: '#9A3412' },
  lien: { fontSize: 14, color: colors.primary, fontWeight: '600' },
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
