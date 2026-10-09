import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cleDe, depensesDe, iconeCategorie, resumeDepense, useBudget } from '../budget';
import { coutJour, euros, joursOuvresAnnee } from '../pilotage';
import { colors } from '../theme';
import { CATEGORIES_DEPENSE, type CleRepartition, type Depense, PERIODES_DEPENSE, type PeriodeDepense } from '../types';
import { ChampFiche, SaisieFiche, SectionFiche } from './Choix';
import { DateField } from './DateField';

/**
 * 💶 Budget (lot 1, 09/10) : coût annuel d'une personne, dépenses d'un porteur (entreprise, portfolio, train,
 * équipe, epic, feature) et fiche d'une dépense. Les montants vont dans le Google Sheet « Budget » de l'entreprise.
 */

/** Coût annuel d'une personne (fiche Personne) : enregistré à la sortie du champ */
export function ChampCoutAnnuel({ espace, personne }: { espace: string; personne: string }) {
  const b = useBudget();
  const actuel = b.couts.get(personne) ?? '';
  const [v, setV] = useState(actuel);
  const [err, setErr] = useState('');
  useEffect(() => setV(actuel), [actuel]);
  const annee = new Date().getFullYear();
  const enregistrer = () => {
    if (v === actuel) return;
    setErr('');
    b.ecrireCout(espace, personne, v).catch((e: Error) => setErr(e.message));
  };
  return (
    <ChampFiche
      label="Coût annuel"
      sous={
        err ||
        `En euros (salaire chargé…). Coût d’un jour ouvré : coût annuel ÷ ${joursOuvresAnnee(annee)} jours ouvrés de ${annee}${v ? ` = ${euros(coutJour(v, annee))}` : ''}. Rangé dans le Google Sheet « Budget », visible seulement des personnes qui y ont accès.`
      }
    >
      <SaisieFiche placeholder="Facultatif (ex. 75000)" value={v} onChangeText={(x) => setV(x.replace(/[^0-9.,]/g, ''))} onEndEditing={enregistrer} onBlur={enregistrer} keyboardType="decimal-pad" />
    </ChampFiche>
  );
}

/** Enfant d'un porteur entre lesquels une dépense se répartit */
export interface EnfantRepartition {
  cle: string;
  nom: string;
  effectif: number;
}

/** Section « 💶 Dépenses · n » d'une fiche : liste et ＋ */
export function SectionDepenses({ espace, porteur, enfants = [], titre = 'Dépenses' }: { espace: string; porteur: string; enfants?: EnfantRepartition[]; titre?: string }) {
  const b = useBudget();
  const [ouverte, setOuverte] = useState<Depense | 'nouvelle' | null>(null);
  const liste = depensesDe(b.depenses, porteur);
  const acces = b.parEspace[espace]?.accessible !== false || liste.length > 0;
  return (
    <SectionFiche titre={`💶 ${titre} · ${liste.length}`}>
      {liste.map((d, i) => (
        <Pressable key={d.id} onPress={() => setOuverte(d)} style={[s.ligne, i > 0 && s.bord]} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={s.texte}>
              {iconeCategorie(d.categorie)} {d.motif}
            </Text>
            <Text style={s.sous}>{resumeDepense(d)}</Text>
          </View>
          <Text style={s.chev}>›</Text>
        </Pressable>
      ))}
      {!liste.length && <Text style={[s.sous, s.pad]}>{acces ? 'Aucune dépense.' : 'Budget non partagé avec vous.'}</Text>}
      <Pressable onPress={() => setOuverte('nouvelle')} style={[s.ligne, s.bord]} accessibilityRole="button">
        <Text style={s.ajout}>＋ Nouvelle dépense</Text>
      </Pressable>
      {ouverte && <FicheDepense espace={espace} porteur={porteur} enfants={enfants} depense={ouverte === 'nouvelle' ? null : ouverte} onFermer={() => setOuverte(null)} />}
    </SectionFiche>
  );
}

/** Fiche d'une dépense (dans la section, dépliée) : motif, catégorie, montant, période, dates, répartition */
export function FicheDepense({ espace, porteur, enfants, depense, onFermer }: { espace: string; porteur: string; enfants: EnfantRepartition[]; depense: Depense | null; onFermer: () => void }) {
  const b = useBudget();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<Partial<Depense>>(depense ?? { motif: '', categorie: 'autre', montant: '', periode: 'ponctuel', du: aujourdhui, au: '', porteur, cle: '', parts: '' });
  const [err, setErr] = useState('');
  const set = <K extends keyof Depense>(k: K, v: Depense[K]) => setF((x) => ({ ...x, [k]: v }));
  const cle = cleDe({ cle: (f.cle ?? '') as Depense['cle'], categorie: (f.categorie ?? 'autre') as Depense['categorie'] });
  let parts: Record<string, number> = {};
  try {
    parts = f.parts ? JSON.parse(f.parts) : {};
  } catch {
    parts = {};
  }
  const totalEff = enfants.reduce((x, e) => x + e.effectif, 0);
  const pctDe = (e: EnfantRepartition) => (cle === 'pct' ? (parts[e.cle] ?? 0) : cle === 'effectif' && totalEff ? Math.round((100 * e.effectif) / totalEff) : Math.round(100 / enfants.length));
  const enregistrer = async () => {
    setErr('');
    try {
      await b.ecrireDepense(espace, { ...f, porteur });
      onFermer();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const choix = <T extends string>(liste: { value: T; label: string }[], v: string, onV: (x: T) => void) => (
    <View style={s.seg}>
      {liste.map((o) => (
        <Pressable key={o.value} onPress={() => onV(o.value)} style={[s.puce, v === o.value && s.puceOn]} accessibilityRole="button" accessibilityState={{ selected: v === o.value }}>
          <Text style={[s.puceTexte, v === o.value && s.puceTexteOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
  return (
    <View style={s.fiche}>
      <Text style={s.titreFiche}>{depense ? '💶 Dépense' : '💶 Nouvelle dépense'}</Text>
      <ChampFiche label="Motif">
        <SaisieFiche placeholder="Ex. Loyer du bâtiment" value={f.motif ?? ''} onChangeText={(v) => set('motif', v)} />
      </ChampFiche>
      <ChampFiche label="Catégorie" colonne>
        {choix(
          CATEGORIES_DEPENSE.map((c) => ({ value: c.value, label: `${c.icone} ${c.label}` })),
          f.categorie ?? 'autre',
          (v) => set('categorie', v),
        )}
      </ChampFiche>
      <ChampFiche label="Période" colonne>
        {choix(PERIODES_DEPENSE, f.periode ?? 'ponctuel', (v: PeriodeDepense) => set('periode', v))}
      </ChampFiche>
      <ChampFiche label={f.periode === 'pct' ? 'Pourcentage' : 'Montant'} sous={f.periode === 'pct' ? 'En % (ex. frais généraux : 15).' : 'En euros.'}>
        <SaisieFiche placeholder={f.periode === 'pct' ? 'Ex. 15' : 'Ex. 8000'} value={f.montant ?? ''} onChangeText={(v) => set('montant', v.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" />
      </ChampFiche>
      <ChampFiche label={f.periode === 'ponctuel' ? 'Date' : 'Du'}>
        <DateField nu mode="date" value={f.du ?? ''} onChange={(v) => set('du', v)} placeholder="Date" />
      </ChampFiche>
      {f.periode !== 'ponctuel' && (
        <ChampFiche label="Au" sous="Vide : sans fin.">
          <DateField nu mode="date" value={f.au ?? ''} onChange={(v) => set('au', v)} placeholder="Sans fin" />
        </ChampFiche>
      )}
      {!!enfants.length && (
        <ChampFiche label="Répartition" colonne sous="Toujours modifiable à la main en %.">
          {choix<CleRepartition>(
            [
              { value: 'effectif', label: 'Par effectif' },
              { value: 'egal', label: 'Parts égales' },
              { value: 'pct', label: '% à la main' },
            ],
            cle,
            (v) => setF((x) => ({ ...x, cle: v, parts: v === 'pct' && !x.parts ? JSON.stringify(Object.fromEntries(enfants.map((e) => [e.cle, pctDe(e)]))) : x.parts })),
          )}
          {enfants.map((e) => (
            <View key={e.cle} style={s.part}>
              <Text style={[s.texte, { flex: 1 }]}>
                {e.nom} <Text style={s.sous}>· {e.effectif} personne{e.effectif > 1 ? 's' : ''}</Text>
              </Text>
              {cle === 'pct' ? (
                <SaisieFiche
                  style={s.pctSaisie}
                  value={String(parts[e.cle] ?? 0)}
                  onChangeText={(v) => set('parts', JSON.stringify({ ...parts, [e.cle]: Number(v.replace(',', '.')) || 0 }))}
                  keyboardType="decimal-pad"
                />
              ) : (
                <Text style={s.pct}>{pctDe(e)} %</Text>
              )}
            </View>
          ))}
        </ChampFiche>
      )}
      {!!err && <Text style={s.err}>{err}</Text>}
      <View style={s.actions}>
        <Pressable onPress={enregistrer} style={s.btn} accessibilityRole="button">
          <Text style={s.btnTexte}>Enregistrer</Text>
        </Pressable>
        <Pressable onPress={onFermer} style={s.btn2} accessibilityRole="button">
          <Text style={s.btn2Texte}>Annuler</Text>
        </Pressable>
        {depense && (
          <Pressable onPress={() => b.supprimerDepense(espace, depense.id).then(onFermer)} style={s.btn2} accessibilityRole="button">
            <Text style={[s.btn2Texte, { color: '#B3261E' }]}>Supprimer</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 8 },
  bord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  texte: { fontSize: 15, color: colors.text },
  sous: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  pad: { paddingHorizontal: 14, paddingVertical: 10 },
  chev: { fontSize: 18, color: '#B0B7C3' },
  ajout: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  fiche: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#F8FAFD', paddingBottom: 10 },
  titreFiche: { fontSize: 15, fontWeight: '700', color: colors.text, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  puce: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  puceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  puceTexte: { fontSize: 13, color: colors.text },
  puceTexteOn: { color: '#fff', fontWeight: '600' },
  part: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  pct: { fontSize: 14, fontWeight: '600', color: colors.text, minWidth: 48, textAlign: 'right' },
  pctSaisie: { width: 64, flexGrow: 0, textAlign: 'right' },
  err: { color: '#B3261E', fontSize: 13, paddingHorizontal: 14, paddingTop: 6 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 10 },
  btn: { backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  btnTexte: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btn2: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  btn2Texte: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});
