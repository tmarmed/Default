import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { joursOuvres } from '../budget';
import { useConges } from '../conges';
import { colors } from '../theme';
import { type Conge, NATURES_CONGE, type NatureConge } from '../types';
import { ChampFiche, SectionFiche } from './Choix';
import { DateField } from './DateField';
import { FormSheet } from './FormSheet';

/**
 * 📅 Congés (lot 2 du budget, 09/10) : chacun déclare ses congés une fois (modifiables) ; l'entreprise déclare ses
 * fermetures. Ils remplissent d'avance la capacité (Planification, Pilotage, « Absents aujourd'hui » au Daily) ;
 * le Scrum Master affine et valide les jours réels en Rétrospective.
 */
const jourCourt = (j: string) => `${Number(j.slice(8, 10))}/${j.slice(5, 7)}`;
const icone = (n: string) => NATURES_CONGE.find((x) => x.value === n)?.icone ?? '📅';
const libelle = (n: string) => NATURES_CONGE.find((x) => x.value === n)?.label ?? n;

/** Section « 📅 Congés · n » d'une personne (e-mail), ou « Fermetures de l'entreprise » (personne vide) */
export function SectionConges({ espace, personne, titre }: { espace: string; personne: string; titre?: string }) {
  const c = useConges();
  const fermeture = !personne;
  const liste = c.conges.filter((x) => (x.espace || 'moi') === espace && (fermeture ? !x.personne : x.personne === personne.toLowerCase())).sort((a, b) => a.du.localeCompare(b.du));
  const [ouvert, setOuvert] = useState<Conge | 'nouveau' | null>(null);
  return (
    <SectionFiche titre={`📅 ${titre ?? (fermeture ? 'Fermetures de l’entreprise' : 'Congés')} · ${liste.length}`}>
      {liste.map((x, i) => {
        const n = joursOuvres(x.du, x.au);
        return (
          <Pressable key={x.id} onPress={() => setOuvert(x)} style={[s.ligne, i > 0 && s.bord]} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={s.texte}>
                {icone(x.nature)} {x.du === x.au ? jourCourt(x.du) : `${jourCourt(x.du)} → ${jourCourt(x.au)}`}
              </Text>
              <Text style={s.sous}>
                {libelle(x.nature)} · {n} jour{n > 1 ? 's' : ''} ouvré{n > 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={s.chev}>✎</Text>
          </Pressable>
        );
      })}
      {!liste.length && <Text style={[s.sous, s.pad]}>{fermeture ? 'Aucune fermeture.' : 'Aucun congé déclaré.'}</Text>}
      <Pressable onPress={() => setOuvert('nouveau')} style={[s.ligne, s.bord]} accessibilityRole="button">
        <Text style={s.ajout}>＋ {fermeture ? 'Déclarer une fermeture' : 'Déclarer des congés'}</Text>
      </Pressable>
      {ouvert && <FicheConge espace={espace} personne={personne} conge={ouvert === 'nouveau' ? null : ouvert} onFermer={() => setOuvert(null)} />}
    </SectionFiche>
  );
}

function FicheConge({ espace, personne, conge, onFermer }: { espace: string; personne: string; conge: Conge | null; onFermer: () => void }) {
  const c = useConges();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<Partial<Conge>>(conge ?? { personne, du: aujourdhui, au: aujourdhui, nature: personne ? 'conge' : 'fermeture' });
  const [err, setErr] = useState('');
  const enregistrer = () =>
    c
      .ecrireConge(espace, { ...f, personne })
      .then(onFermer)
      .catch((e: Error) => setErr(e.message));
  return (
    <View style={s.fiche}>
      {!!personne && (
        <View style={[s.seg, { paddingHorizontal: 14, paddingTop: 10 }]}>
          {NATURES_CONGE.filter((n) => n.value !== 'fermeture').map((n) => (
            <Pressable key={n.value} onPress={() => setF((x) => ({ ...x, nature: n.value as NatureConge }))} style={[s.puce, f.nature === n.value && s.puceOn]} accessibilityRole="button">
              <Text style={[s.puceTexte, f.nature === n.value && s.puceTexteOn]}>
                {n.icone} {n.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <ChampFiche label="Du">
        <DateField nu mode="date" value={f.du ?? ''} onChange={(v) => setF((x) => ({ ...x, du: v, au: !x.au || x.au < v ? v : x.au }))} placeholder="Début" />
      </ChampFiche>
      <ChampFiche label="Au" sous="Inclus. Week-ends et jours fériés ne comptent pas.">
        <DateField nu mode="date" value={f.au ?? ''} onChange={(v) => setF((x) => ({ ...x, au: v }))} placeholder="Fin" />
      </ChampFiche>
      {!!err && <Text style={s.err}>{err}</Text>}
      <View style={s.actions}>
        <Pressable onPress={enregistrer} style={s.btn} accessibilityRole="button">
          <Text style={s.btnTexte}>Enregistrer</Text>
        </Pressable>
        <Pressable onPress={onFermer} style={s.btn2} accessibilityRole="button">
          <Text style={s.btn2Texte}>Annuler</Text>
        </Pressable>
        {conge && (
          <Pressable onPress={() => c.supprimerConge(espace, conge.id).then(onFermer)} style={s.btn2} accessibilityRole="button">
            <Text style={[s.btn2Texte, { color: '#B3261E' }]}>Supprimer</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Menu du compte › « 📅 Mes congés » : une section par espace (entreprise, équipe) où vous êtes membre */
export function FeuilleMesConges({ visible, onClose, moi, espaces }: { visible: boolean; onClose: () => void; moi: string; espaces: { id: string; nom: string }[] }) {
  return (
    <FormSheet visible={visible} title="Mes congés" onClose={onClose} busy={false} error={null}>
      {espaces.map((e) => (
        <SectionConges key={e.id} espace={e.id} personne={moi} titre={espaces.length > 1 ? `Congés · ${e.nom}` : 'Mes congés'} />
      ))}
      {!espaces.length && <Text style={[s.sous, s.pad]}>Aucune équipe ni entreprise : les congés servent à la capacité des équipes.</Text>}
      <Text style={[s.sous, s.pad]}>Déclarés une fois, ils remplissent la capacité de vos sprints ; le Scrum Master valide les jours réels en Rétrospective.</Text>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 8 },
  bord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  texte: { fontSize: 15, color: colors.text },
  sous: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  pad: { paddingHorizontal: 14, paddingVertical: 10 },
  chev: { fontSize: 15, color: '#B0B7C3' },
  ajout: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  fiche: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#F8FAFD', paddingBottom: 10 },
  seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  puce: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  puceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  puceTexte: { fontSize: 13, color: colors.text },
  puceTexteOn: { color: '#fff', fontWeight: '600' },
  err: { color: '#B3261E', fontSize: 13, paddingHorizontal: 14, paddingTop: 6 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 10 },
  btn: { backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  btnTexte: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btn2: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  btn2Texte: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});
