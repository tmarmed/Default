import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { aRepartirPortfolio, montantDemande, repartitionProposee, trainDePersonne, avecDossiers, situationEnveloppe, cleDe, type Decision, libelleDecisionDossier, manquesDossier, depensesDe, iconeCategorie, libellePeriode, libelleStatutDemande, resumeDepense, useBudget } from '../budget';
import { coutJour, euros, joursOuvresAnnee } from '../pilotage';
import { colors } from '../theme';
import { useSafe } from '../safe';
import { CATEGORIES_DEPENSE, type CleRepartition, type DemandeBudget, type Depense, DECISIONS_DOSSIER, type DecisionDossier, type DossierInvestissement, type Epic, PERIODES_DEPENSE, type PeriodeDepense } from '../types';
import { ChampFiche, SaisieFiche, SectionFiche } from './Choix';
import { DateField } from './DateField';
import { useHierarchy } from '../hierarchyContext';
import { useOrg } from '../organisation';
import { consommeReel, type CtxConsomme } from '../consomme';
import type { OrgValue } from '../organisation';

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

/**
 * 💼 Dossier d'investissement d'une epic (lot 5, 09/10) : hypothèse, estimation, budget prévu, budget du MVP.
 * Préparé par l'Epic Owner, décidé à la Revue du portfolio. Rangé dans le Sheet « Budget » ; enregistré à la sortie
 * de chaque champ.
 */
export function SectionDossier({ espace, epic, lecture, simple }: { espace: string; epic: Epic; lecture?: boolean; simple?: boolean }) {
  const b = useBudget();
  const d = b.dossiers.get(epic.id);
  const depart = { hypothese: d?.hypothese ?? '', estimation: d?.estimation ?? '', budget_prevu: d?.budget_prevu || epic.budget || '', budget_mvp: d?.budget_mvp ?? '', estimation_fin: d?.estimation_fin ?? '' };
  const [f, setF] = useState(depart);
  const [err, setErr] = useState('');
  const cle = JSON.stringify(depart);
  useEffect(() => setF(JSON.parse(cle)), [cle]);
  if (b.parEspace[espace]?.accessible === false && !d) return null;
  const enregistrer = (k: keyof typeof f) => {
    if (f[k] === depart[k]) return;
    setErr('');
    b.ecrireDossier(espace, { id: epic.id, [k]: f[k] } as Partial<DossierInvestissement> & { id: string }).catch((e: Error) => setErr(e.message));
  };
  const champ = (k: keyof typeof f, placeholder: string, nombre = true) => (
    <SaisieFiche
      placeholder={placeholder}
      value={f[k]}
      editable={!lecture}
      multiline={!nombre}
      onChangeText={(v) => setF((x) => ({ ...x, [k]: nombre ? v.replace(/[^0-9.,]/g, '') : v }))}
      onBlur={() => enregistrer(k)}
      onEndEditing={() => enregistrer(k)}
      keyboardType={nombre ? 'decimal-pad' : 'default'}
      accessibilityLabel={placeholder}
    />
  );
  const manques = manquesDossier({ ...d, ...f }, epic);
  // Mode Simple (09/10) : budget prévu seulement, et l'estimation à la fin saisie à la main si besoin
  if (simple)
    return (
      <SectionFiche titre="💶 Budget du projet">
        <ChampFiche label="Budget prévu (€)">{champ('budget_prevu', 'Ex. 20000')}</ChampFiche>
        <ChampFiche label="Estimation à la fin (€)" sous="Facultative : calculée si tout le reste est estimé en jours, sinon à saisir ici (saisie, elle compte).">
          {champ('estimation_fin', 'Facultatif')}
        </ChampFiche>
        <View style={s.pad}>
          <Text style={s.sous}>Réglé par le mode Simple : pas de dossier d’investissement (hypothèse, MVP) ; il revient en SAFe, sans rien perdre.</Text>
          {!!err && <Text style={s.err}>{err}</Text>}
        </View>
      </SectionFiche>
    );
  return (
    <SectionFiche titre="💼 Dossier d'investissement" aDefinir={manques.length}>
      <ChampFiche label="Hypothèse" colonne>
        {champ('hypothese', 'Ex. Les clients commandent plus depuis l’application', false)}
      </ChampFiche>
      <ChampFiche label="Estimation (pts)">{champ('estimation', 'Ex. 90')}</ChampFiche>
      <ChampFiche label="Budget prévu (€)">{champ('budget_prevu', 'Ex. 120000')}</ChampFiche>
      <ChampFiche label="Budget du MVP (€)">{champ('budget_mvp', 'Ex. 30000')}</ChampFiche>
      <View style={s.pad}>
        <Text style={[s.sous, manques.length ? { color: colors.warning } : null]}>
          {d?.decision ? `Décision : ${libelleDecisionDossier(d)}` : manques.length ? `À compléter : ${manques.join(', ')}. Une epic sans dossier complet ne peut pas être lancée.` : 'Dossier complet : à décider à la Revue du portfolio (Lancer, Pas maintenant, Abandonner), ou depuis le Chat.'}
        </Text>
        {/* 13/10 : comme les suivis et les demandes, un dossier peut être décidé depuis le Chat (Confirmer en séance) */}
        {!lecture && !d?.decision && !manques.length && (
          <Pressable onPress={() => b.soumettreDossier(espace, epic).catch((e: Error) => setErr(e.message))} style={[s.btn2, { alignSelf: 'flex-start', marginTop: 8 }]} accessibilityRole="button">
            <Text style={s.btn2Texte}>📨 Soumettre pour décision</Text>
          </Pressable>
        )}
        {!!err && <Text style={s.err}>{err}</Text>}
      </View>
    </SectionFiche>
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
  // Mode Simple (09/10) : dépenses ponctuelles ou par mois, sans répartition (réglé, pas modifiable)
  const simple = !useSafe().actif;
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
      <ChampFiche label="Période" colonne sous={simple ? 'Réglé par le mode Simple : ponctuelle ou par mois, sur cet élément seulement (sans répartition).' : undefined}>
        {choix(simple ? PERIODES_DEPENSE.filter((x) => x.value === 'ponctuel' || x.value === 'mois') : PERIODES_DEPENSE, f.periode ?? 'ponctuel', (v: PeriodeDepense) => set('periode', v))}
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
      {!!enfants.length && !simple && (
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

/**
 * 💶 Demandes de budget dans une réunion (lot 4, 09/10), à l'étape Concrétisation : décidé hors réunion (Confirmer),
 * à décider (Accorder en totalité ou en partie, À reprendre, Refuser, Soumettre plus haut), nos demandes, et
 * la demande elle-même naît d'une note (Concrétiser › 💶 Demande de budget, 13/10), seulement pour qui a le droit.
 */
export function BlocDemandesBudget({ niveau, espace, reunion, moi, anime, lecture, gerants, gerantsDessus, epics, nomDe = (m: string) => m }: { niveau: string; espace: string; reunion: string; moi: string; anime: boolean; lecture: boolean; gerants: string[]; gerantsDessus: boolean; epics: { id: string; titre: string }[]; nomDe?: (m: string) => string }) {
  const b = useBudget();
  const droit = gerants.includes(moi.toLowerCase());
  const recues = b.demandes.filter((d) => d.destination === niveau && d.statut === 'soumise');
  const horsReunion = b.demandes.filter((d) => d.destination === niveau && d.hors_reunion === '1');
  const nos = b.demandes.filter((d) => d.demandeur === niveau);
  const [nouvelle, setNouvelle] = useState(false);
  const [err, setErr] = useState('');
  const peutDecider = droit && anime && !lecture;
  if (!droit && !recues.length && !nos.length && !horsReunion.length) return null;
  const agir = (p: Promise<void>) => p.then(() => setErr('')).catch((e: Error) => setErr(e.message));
  return (
    <SectionFiche titre={`💶 Demandes de budget · ${recues.length} à décider`}>
      {horsReunion.map((d, i) => (
        <View key={`h${d.id}`} style={[s.ligne, i > 0 && s.bord, { flexWrap: 'wrap' }]}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={s.texte}>{d.motif} · {libelleStatutDemande(d)}</Text>
            <Text style={s.sous}>Décidé hors réunion par {nomDe(d.decide_par)} · à revoir ensemble</Text>
          </View>
          {peutDecider && (
            <Pressable onPress={() => agir(b.confirmerDemande(d))} style={s.btn} accessibilityRole="button">
              <Text style={s.btnTexte}>✓ Confirmer</Text>
            </Pressable>
          )}
        </View>
      ))}
      {recues.map((d, i) => (
        <DecisionDemande key={d.id} d={d} nomDe={nomDe} premiere={!horsReunion.length && i === 0} peutDecider={peutDecider} plusHaut={gerantsDessus} onDecider={(x) => agir(b.deciderDemande(d, x, reunion))} />
      ))}
      {nos.map((d) => (
        <View key={`n${d.id}`} style={[s.ligne, s.bord]}>
          <View style={{ flex: 1 }}>
            <Text style={s.texte}>{d.motif}</Text>
            <Text style={s.sous}>
              Notre demande · {eurosTxtC(d.montant)} · {libelleStatutDemande(d)}
              {d.motif_decision ? ` — ${d.motif_decision}` : ''}
            </Text>
          </View>
        </View>
      ))}
      {/* 13/10 : une demande naît d'une note (Concrétiser › 💶 Demande de budget), comme un suivi ou une escalade */}
      {droit && anime && !lecture && !nouvelle && (
        <Text style={[s.sous, s.pad, s.bord]}>Pour demander du budget : notez-le, puis « Concrétiser › 💶 Demande de budget ».</Text>
      )}
      {nouvelle && (
        <NouvelleDemande
          epics={epics}
          niveau={niveau}
          onAnnuler={() => setNouvelle(false)}
          onSoumettre={(x) =>
            b
              .soumettreDemande(espace, { ...x, demandeur: niveau, soumis_par: moi.toLowerCase(), origine: reunion })
              .then(() => setNouvelle(false))
              .catch((e: Error) => setErr(e.message))
          }
        />
      )}
      {!!err && <Text style={s.err}>{err}</Text>}
    </SectionFiche>
  );
}
const eurosTxtC = (m: string) => euros(Number(m) || 0);

function DecisionDemande({ d, premiere, peutDecider, plusHaut, onDecider, nomDe }: { d: DemandeBudget; premiere: boolean; peutDecider: boolean; plusHaut: boolean; onDecider: (x: Decision) => void; nomDe: (m: string) => string }) {
  const [montant, setMontant] = useState(d.montant);
  const [motif, setMotif] = useState('');
  return (
    <View style={[!premiere && s.bord, { paddingBottom: 8 }]}>
      <View style={s.ligne}>
        <View style={{ flex: 1 }}>
          <Text style={s.texte}>
            {d.motif} · {eurosTxtC(d.montant)}
          </Text>
          <Text style={s.sous}>
            {libellePeriode(d.periode)} · soumise par {nomDe(d.soumis_par)} · {d.origine}
          </Text>
        </View>
      </View>
      {peutDecider && (
        <>
          <LigneEnveloppe niveau={d.destination} apres={(Number(montant.replace(',', '.')) || 0) * (d.periode === 'mois' ? 12 : 1)} />
          <View style={[s.actions, { flexWrap: 'wrap', alignItems: 'center' }]}>
            <SaisieFiche style={s.pctSaisie} value={montant} onChangeText={(v) => setMontant(v.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" accessibilityLabel="Montant accordé" />
            <Pressable onPress={() => onDecider({ choix: 'accorder', montant: Number(montant.replace(',', '.')) || Number(d.montant) })} style={s.btn} accessibilityRole="button">
              <Text style={s.btnTexte}>💶 Accorder</Text>
            </Pressable>
            {plusHaut && (
              <Pressable onPress={() => onDecider({ choix: 'plus_haut' })} style={s.btn2} accessibilityRole="button">
                <Text style={s.btn2Texte}>⬆ Soumettre plus haut</Text>
              </Pressable>
            )}
          </View>
          <View style={[s.actions, { flexWrap: 'wrap', alignItems: 'center' }]}>
            <SaisieFiche style={{ flex: 1, minWidth: 140 }} placeholder="Motif (À reprendre, Refuser)" value={motif} onChangeText={setMotif} />
            <Pressable disabled={!motif.trim()} onPress={() => onDecider({ choix: 'a_reprendre', motif: motif.trim() })} style={[s.btn2, !motif.trim() && { opacity: 0.4 }]} accessibilityRole="button">
              <Text style={s.btn2Texte}>↩ À reprendre</Text>
            </Pressable>
            <Pressable disabled={!motif.trim()} onPress={() => onDecider({ choix: 'refuser', motif: motif.trim() })} style={[s.btn2, !motif.trim() && { opacity: 0.4 }]} accessibilityRole="button">
              <Text style={[s.btn2Texte, { color: '#B3261E' }]}>✖ Refuser</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function NouvelleDemande({ epics, niveau, onAnnuler, onSoumettre }: { epics: { id: string; titre: string }[]; niveau: string; onAnnuler: () => void; onSoumettre: (x: Pick<DemandeBudget, 'motif' | 'montant' | 'periode' | 'du' | 'au' | 'pour'>) => void }) {
  const simpleD = !useSafe().actif;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ motif: '', montant: '', periode: 'ponctuel' as PeriodeDepense, du: aujourdhui, au: '', pour: epics[0] ? `epic:${epics[0].id}` : niveau });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <View style={s.fiche}>
      <Text style={s.titreFiche}>💶 Nouvelle demande de budget</Text>
      <ChampFiche label="Motif">
        <SaisieFiche placeholder="Ex. Licence de l’outil de test" value={f.motif} onChangeText={(v) => set('motif', v)} />
      </ChampFiche>
      <ChampFiche label="Montant" sous="En euros.">
        <SaisieFiche placeholder="Ex. 1200" value={f.montant} onChangeText={(v) => set('montant', v.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" />
      </ChampFiche>
      <ChampFiche label="Période" colonne>
        <View style={s.seg}>
          {PERIODES_DEPENSE.filter((p) => p.value !== 'pct' && (!simpleD || p.value === 'ponctuel' || p.value === 'mois')).map((p) => (
            <Pressable key={p.value} onPress={() => set('periode', p.value)} style={[s.puce, f.periode === p.value && s.puceOn]} accessibilityRole="button">
              <Text style={[s.puceTexte, f.periode === p.value && s.puceTexteOn]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      </ChampFiche>
      <ChampFiche label={f.periode === 'ponctuel' ? 'Date' : 'Du'}>
        <DateField nu mode="date" value={f.du} onChange={(v) => set('du', v)} placeholder="Date" />
      </ChampFiche>
      {f.periode !== 'ponctuel' && (
        <ChampFiche label="Au" sous="Vide : sans fin.">
          <DateField nu mode="date" value={f.au} onChange={(v) => set('au', v)} placeholder="Sans fin" />
        </ChampFiche>
      )}
      <ChampFiche label="Pour" colonne sous="La dépense accordée sera portée par cet élément.">
        <View style={s.seg}>
          {[...epics.map((e) => ({ v: `epic:${e.id}`, l: `🗂️ ${e.titre}` })), { v: niveau, l: simpleD ? 'L’équipe (sans projet)' : 'Le niveau (sans epic)' }].map((o) => (
            <Pressable key={o.v} onPress={() => set('pour', o.v)} style={[s.puce, f.pour === o.v && s.puceOn]} accessibilityRole="button">
              <Text style={[s.puceTexte, f.pour === o.v && s.puceTexteOn]}>{o.l}</Text>
            </Pressable>
          ))}
        </View>
      </ChampFiche>
      <View style={s.actions}>
        <Pressable onPress={() => onSoumettre(f)} style={s.btn} accessibilityRole="button">
          <Text style={s.btnTexte}>⬆ Soumettre</Text>
        </Pressable>
        <Pressable onPress={onAnnuler} style={s.btn2} accessibilityRole="button">
          <Text style={s.btn2Texte}>Annuler</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * 💼 Revue du portfolio (lot 5, 09/10) : décision sur les dossiers d'investissement. Epics à décider : ✅ Lancer
 * (dossier complet seulement), ⏸ Pas maintenant, ✖ Abandonner. Budget du MVP atteint (consommé réel ≥ budget du
 * MVP) : ▶ Continuer, ↪ Changer de direction, ⏹ Arrêter. Décision écrite tout de suite dans le Sheet Budget.
 */
export function BlocDossiers({ epics, h, org, espace, reunion, moi, peutDecider, nomDe = (m: string) => m, onEtat, onDecision }: { epics: Epic[]; h: CtxConsomme['h']; org: OrgValue; espace: string; reunion: string; moi: string; peutDecider: boolean; nomDe?: (m: string) => string; onEtat?: (e: Epic, etat: Epic['etat']) => Promise<void>; onDecision?: (e: Epic, libelle: string) => void }) {
  const b = useBudget();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const ed = avecDossiers(epics, b.dossiers);
  const conso = consommeReel({ org, h: { ...h, epicList: avecDossiers(h.epicList, b.dossiers) }, couts: b.couts, depenses: b.depenses, today });
  const lance = (d?: DossierInvestissement) => d?.decision === 'lancer' || d?.decision === 'changer';
  const aDecider = ed.filter((e) => e.etat !== 'termine' && (!b.dossiers.get(e.id)?.decision || b.dossiers.get(e.id)?.decision === 'pas_maintenant'));
  const mvp = ed.filter((e) => {
    const d = b.dossiers.get(e.id);
    return lance(d) && Number(d?.budget_mvp) > 0 && conso.detail(e).consomme >= Number(d!.budget_mvp);
  });
  const decides = ed.filter((e) => b.dossiers.get(e.id)?.decision && !aDecider.includes(e) && !mvp.includes(e));
  // Décidés depuis le Chat : en tête, « Confirmer » les range (13/10)
  const horsReunion = ed.filter((e) => b.dossiers.get(e.id)?.hors_reunion === '1');
  const decider = async (e: Epic, decision: DecisionDossier) => {
    setErr('');
    setBusy(e.id);
    try {
      await b.ecrireDossier(espace, { id: e.id, decision, decide_le: today, decide_par: moi, decide_a: reunion });
      onDecision?.(e, DECISIONS_DOSSIER.find((q) => q.value === decision)?.fait ?? decision);
      if (decision === 'lancer' && (e.etat === 'idee' || e.etat === 'analyse' || !e.etat)) await onEtat?.(e, 'pret');
      if (decision === 'arreter') await onEtat?.(e, 'termine');
    } catch (x) {
      setErr(`Non enregistré : ${(x as Error).message}`);
    } finally {
      setBusy('');
    }
  };
  const boutons = (e: Epic, mvpAtteint: boolean, manques: string[]) =>
    peutDecider && (
      <View style={[s.actions, { flexWrap: 'wrap', paddingHorizontal: 0 }]}>
        {DECISIONS_DOSSIER.filter((q) => !!q.mvp === mvpAtteint).map((q, k) => {
          const bloque = q.value === 'lancer' && manques.length > 0;
          return (
            <Pressable key={q.value} disabled={bloque || !!busy} onPress={() => decider(e, q.value)} style={[k === 0 ? s.btn : s.btn2, (bloque || busy === e.id) && { opacity: 0.45 }]} accessibilityRole="button">
              <Text style={k === 0 ? s.btnTexte : s.btn2Texte}>{q.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  const chiffres = (e: Epic) => {
    const d = b.dossiers.get(e.id);
    return [d?.estimation ? `${d.estimation} pts` : '', Number(e.budget) ? `Budget prévu ${euros(Number(e.budget))}` : '', Number(d?.budget_mvp) ? `MVP ${euros(Number(d!.budget_mvp))}` : ''].filter(Boolean).join(' · ');
  };
  return (
    <>
      {horsReunion.length > 0 && (
        <SectionFiche titre={`Décidé hors réunion · ${horsReunion.length}`}>
          {horsReunion.map((e, i) => (
            <View key={e.id} style={[s.pad, i > 0 && s.bord]}>
              <Text style={s.texte}>🗂️ {e.titre}</Text>
              <Text style={s.sous}>{libelleDecisionDossier(b.dossiers.get(e.id))}{b.dossiers.get(e.id)?.decide_par ? ` · par ${nomDe(b.dossiers.get(e.id)!.decide_par)}` : ''}</Text>
              {peutDecider && (
                <Pressable onPress={() => b.ecrireDossier(espace, { id: e.id, hors_reunion: '2' }).catch((x: Error) => setErr(x.message))} style={[s.btn, { alignSelf: 'flex-start', marginTop: 8 }]} accessibilityRole="button">
                  <Text style={s.btnTexte}>Confirmer</Text>
                </Pressable>
              )}
            </View>
          ))}
        </SectionFiche>
      )}
      <SectionFiche titre={`💼 Dossiers d'investissement · ${aDecider.length} à décider`}>
        {aDecider.map((e, i) => {
          const d = b.dossiers.get(e.id);
          const manques = manquesDossier(d, e);
          return (
            <View key={e.id} style={[s.pad, i > 0 && s.bord]}>
              <Text style={s.texte}>🗂️ {e.titre}{d?.decision === 'pas_maintenant' ? ' · ⏸ remise à plus tard' : ''}</Text>
              {!!d?.hypothese && <Text style={s.sous}>Hypothèse : {d.hypothese}</Text>}
              {!!chiffres(e) && <Text style={s.sous}>{chiffres(e)}</Text>}
              <Text style={[s.sous, manques.length ? { color: colors.warning } : null]}>{manques.length ? `Dossier : ${4 - manques.length} sur 4 renseignés · à compléter : ${manques.join(', ')} (ne peut pas être lancée)` : 'Dossier complet'}</Text>
              {boutons(e, false, manques)}
            </View>
          );
        })}
        {!aDecider.length && <Text style={[s.sous, s.pad]}>Aucune epic à décider.</Text>}
      </SectionFiche>
      {mvp.length > 0 && (
        <SectionFiche titre={`🎯 Budget du MVP atteint · ${mvp.length}`}>
          {mvp.map((e, i) => (
            <View key={e.id} style={[s.pad, i > 0 && s.bord]}>
              <Text style={s.texte}>🗂️ {e.titre} · MVP atteint</Text>
              <Text style={s.sous}>{euros(conso.detail(e).consomme)} consommés sur {euros(Number(b.dossiers.get(e.id)!.budget_mvp))} de MVP · l'hypothèse est-elle vérifiée ?</Text>
              {boutons(e, true, [])}
            </View>
          ))}
        </SectionFiche>
      )}
      {decides.length > 0 && (
        <SectionFiche titre={`Décidés · ${decides.length}`}>
          {decides.map((e, i) => (
            <View key={e.id} style={[s.pad, i > 0 && s.bord]}>
              <Text style={s.texte}>🗂️ {e.titre}</Text>
              <Text style={s.sous}>{libelleDecisionDossier(b.dossiers.get(e.id))}{b.dossiers.get(e.id)?.decide_par ? ` · par ${nomDe(b.dossiers.get(e.id)!.decide_par)}` : ''}</Text>
            </View>
          ))}
        </SectionFiche>
      )}
      {!!err && <Text style={s.err}>{err}</Text>}
    </>
  );
}

/**
 * 💶 Budget simplifié (mode Simple, validé le 09/10) : par projet (epic), Prévu · Dépensé · Reste, et l'Estimation
 * à la fin — calculée si tout le reste à faire est estimé (dépensé + reste × coût + dépenses à venir), sinon saisie à
 * la main (facultative ; saisie, elle passe avant le calcul). Dépensé = dépenses + coût des personnes s'il y a un coût
 * annuel. Revue du mois : suivi ; trimestre : révision du budget prévu ; année : budget de l'année.
 */
export function BlocBudgetSimple({ epics, h, org, espace, mode, peutModifier }: { epics: Epic[]; h: CtxConsomme['h']; org: OrgValue; espace: string; mode: 'suivi' | 'revision' | 'annee'; peutModifier: boolean }) {
  const simpleB = !useSafe().actif;
  const b = useBudget();
  const [err, setErr] = useState('');
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const today = new Date().toISOString().slice(0, 10);
  const ed = avecDossiers(epics, b.dossiers);
  const conso = consommeReel({ org, h: { ...h, epicList: avecDossiers(h.epicList, b.dossiers) }, couts: b.couts, depenses: b.depenses, today });
  const lignes = ed.map((e) => {
    const d = conso.detail(e);
    const dos = b.dossiers.get(e.id);
    const prevu = Number(e.budget) || 0;
    const calculable = d.sansEstimation === 0;
    const manuelle = Number(dos?.estimation_fin) || 0;
    const fin = manuelle || (calculable ? d.consomme + d.restePts * d.coutPoint + d.fixesAVenir : 0);
    return { e, d, dos, prevu, fin, calculable, manuelle };
  });
  const tot = (f: (x: (typeof lignes)[number]) => number) => lignes.reduce((x, y) => x + f(y), 0);
  const ecrire = (id: string, k: 'budget_prevu' | 'estimation_fin') => {
    const v = saisies[`${k}:${id}`];
    if (v === undefined) return;
    setErr('');
    b.ecrireDossier(espace, { id, [k]: v } as Partial<DossierInvestissement> & { id: string }).catch((x: Error) => setErr(`Non enregistré : ${x.message}`));
  };
  const champ = (id: string, k: 'budget_prevu' | 'estimation_fin', actuel: string, label: string) => (
    <ChampFiche label={label}>
      <SaisieFiche
        placeholder="Ex. 20000"
        value={saisies[`${k}:${id}`] ?? actuel}
        onChangeText={(v) => setSaisies((m) => ({ ...m, [`${k}:${id}`]: v.replace(/[^0-9.,]/g, '') }))}
        onBlur={() => ecrire(id, k)}
        onEndEditing={() => ecrire(id, k)}
        keyboardType="decimal-pad"
        accessibilityLabel={`${label} · ${id}`}
      />
    </ChampFiche>
  );
  if (b.parEspace[espace]?.accessible === false && !lignes.some((x) => x.prevu)) return <Text style={[s.sous, s.pad]}>Pas d’accès au Sheet « Budget » de cet espace : aucun montant n’est montré.</Text>;
  return (
    <>
      <SectionFiche titre={`💶 Budget · ${mode === 'annee' ? 'budget de l’année' : mode === 'revision' ? 'révision du trimestre' : 'suivi du mois'}`}>
        <View style={s.pad}>
          <Text style={s.texte}>
            Prévu {euros(tot((x) => x.prevu))} · Dépensé {euros(tot((x) => x.d.consomme))} · Reste {euros(tot((x) => x.prevu - x.d.consomme))}
          </Text>
          {lignes.length > 0 && (lignes.every((x) => x.fin) ? <Text style={s.sous}>Estimation à la fin : {euros(tot((x) => x.fin))}</Text> : <Text style={s.sous}>Estimation à la fin : {lignes.filter((x) => !x.fin).length} projet{lignes.filter((x) => !x.fin).length > 1 ? 's' : ''} sans estimation</Text>)}
        </View>
      </SectionFiche>
      {lignes.map(({ e, d, dos, prevu, fin, calculable, manuelle }) => (
        <SectionFiche key={e.id} titre={`🗂️ ${simpleB ? 'Projet' : 'Epic'} · ${e.titre}`}>
          <View style={s.pad}>
            <Text style={[s.texte, prevu && d.consomme > prevu ? { color: '#B3261E' } : null]}>
              Prévu {prevu ? euros(prevu) : 'non renseigné'} · Dépensé {euros(d.consomme)} · Reste {prevu ? euros(prevu - d.consomme) : '—'}
            </Text>
            <Text style={s.sous}>
              Dépenses {euros(d.depenses + d.frais)}
              {d.personnes ? ` · personnes ${euros(d.personnes)} (coût annuel saisi)` : ''}
              {fin ? ` · Estimation à la fin ${euros(fin)}${manuelle ? ' (saisie)' : ' (calculée)'}` : ''}
            </Text>
            {!!fin && fin > prevu && !!prevu && <Text style={[s.sous, { color: colors.warning }]}>⚠ Estimation à la fin au-dessus du prévu (+{euros(fin - prevu)})</Text>}
          </View>
          {peutModifier && mode !== 'suivi' && champ(e.id, 'budget_prevu', dos?.budget_prevu || e.budget || '', mode === 'annee' ? 'Budget de l’année (€)' : 'Budget prévu révisé (€)')}
          {peutModifier && (!calculable || !!manuelle) && champ(e.id, 'estimation_fin', dos?.estimation_fin ?? '', calculable ? 'Estimation à la fin saisie (€)' : 'Estimation à la fin (€) · à saisir, le reste n’est pas estimé')}
        </SectionFiche>
      ))}
      {!lignes.length && <Text style={[s.sous, s.pad]}>Aucun projet ici.</Text>}
      <Text style={[s.sous, s.pad]}>Réglé par le mode Simple : dépenses ponctuelles ou par mois, sur un seul élément, sans répartition ; coût des personnes compté seulement si un coût annuel est saisi.</Text>
      {!!err && <Text style={s.err}>{err}</Text>}
    </>
  );
}

/**
 * « Ma préparation » de l'Epic Owner avant la Revue du portfolio (lot 5, maquette écran 5) : ses dossiers
 * d'investissement à compléter (ce qui manque) et ceux prêts pour la décision. Ils se complètent dans la fiche.
 */
export function BlocPrepDossiers({ epics }: { epics: Epic[] }) {
  const b = useBudget();
  const l = epics.filter((e) => e.etat !== 'termine' && (!b.dossiers.get(e.id)?.decision || b.dossiers.get(e.id)?.decision === 'pas_maintenant'));
  return (
    <SectionFiche titre={`💼 Mes dossiers d'investissement · ${l.length}`}>
      {l.map((e, i) => {
        const m = manquesDossier(b.dossiers.get(e.id), e);
        return (
          <View key={e.id} style={[s.pad, i > 0 && s.bord]}>
            <Text style={s.texte}>🗂️ {e.titre}</Text>
            <Text style={[s.sous, m.length ? { color: colors.warning } : null]}>{m.length ? `Dossier : ${4 - m.length} sur 4 renseignés · à compléter : ${m.join(', ')} (dans la fiche de l'epic)` : 'Dossier complet : prêt pour la décision en séance'}</Text>
          </View>
        );
      })}
      {!l.length && <Text style={[s.sous, s.pad]}>Aucun dossier à préparer.</Text>}
    </SectionFiche>
  );
}

/** Enveloppe · Engagé · Disponible d'un niveau pour l'année (13/10) ; `apres` : montant qu'on s'apprête à accorder */
export function useEnveloppe(niveau: string, annee = String(new Date().getFullYear())) {
  const b = useBudget();
  const h = useHierarchy();
  const org = useOrg();
  return situationEnveloppe(niveau, annee, {
    enveloppes: b.enveloppes,
    dossiers: b.dossiers,
    demandes: b.demandes,
    epics: h.epicList,
    portfoliosDe: (esp) => org.portfolios.filter((p) => (p.espace || 'moi') === esp).map((p) => p.id),
    // Trains (13/10) : part des epics selon les points de leurs features ; enveloppes des trains du portfolio
    features: h.featureList,
    trainsDe: (pf) => org.trains.filter((t) => t.portfolio === pf).map((t) => t.id),
  });
}
export function LigneEnveloppe({ niveau, apres = 0 }: { niveau: string; apres?: number }) {
  const x = useEnveloppe(niveau);
  if (!x.defini) return <Text style={[s.sous, { paddingHorizontal: 14 }]}>Pas d’enveloppe pour {new Date().getFullYear()} ({niveau.startsWith('train:') || niveau.startsWith('equipeagile:') ? 'à fixer par le niveau du dessus, au Budget participatif' : 'à fixer au Comité budgétaire'}).</Text>;
  const reste = x.disponible - apres;
  return (
    <Text style={[s.sous, { paddingHorizontal: 14 }, reste < 0 ? { color: '#B3261E' } : null]}>
      Enveloppe {euros(x.enveloppe)} · Engagé {euros(x.engage)} · Disponible {euros(x.disponible)}
      {apres ? ` · après cet accord : ${euros(reste)}${reste < 0 ? ' (dépasse l’enveloppe)' : ''}` : ''}
    </Text>
  );
}

/** Pilotage (13/10, session 3) : enveloppe de chaque train du portfolio */
export function LignesEnveloppesTrains({ portfolio }: { portfolio: string }) {
  const org = useOrg();
  const trains = org.trains.filter((t) => t.portfolio === portfolio);
  if (!trains.length) return null;
  return (
    <>
      {trains.map((t) => (
        <View key={t.id}>
          <Text style={[s.sous, { paddingHorizontal: 14, paddingTop: 8, fontWeight: '600' }]}>🚆 {t.nom}</Text>
          <LigneEnveloppe niveau={`train:${t.id}`} />
        </View>
      ))}
    </>
  );
}

/**
 * 💶 Budget participatif · Répartition (13/10, session 3) : une ligne par train du portfolio — enveloppe actuelle,
 * montant demandé (écrit dans ses demandes), part du vote, montant proposé (part du vote × reste à répartir),
 * modifiable ; enregistré à l'envoi du compte rendu (`montants`, tenus par la réunion).
 */
export function RepartitionTrains({
  portfolio,
  demandes,
  montants,
  onMontant,
  peutModifier,
  onPropose,
  annee: anneeSeance,
}: {
  portfolio: string;
  demandes: { texte: string; par: string; pts: number }[];
  montants: Record<string, string>;
  onMontant: (train: string, v: string) => void;
  peutModifier: boolean;
  /** Montants proposés (pour l'envoi, si l'animateur ne les a pas modifiés) */
  onPropose?: (p: Record<string, number>) => void;
  /** Année des enveloppes : celle de la séance (un Budget participatif de janvier fixe l'année qui commence) */
  annee?: string;
}) {
  const b = useBudget();
  const h = useHierarchy();
  const org = useOrg();
  const annee = anneeSeance ?? String(new Date().getFullYear());
  const trains = org.trains.filter((t) => t.portfolio === portfolio);
  const ctx = { enveloppes: b.enveloppes, dossiers: b.dossiers, demandes: b.demandes, epics: h.epicList, features: h.featureList, trainsDe: (pf: string) => org.trains.filter((t) => t.portfolio === pf).map((t) => t.id) };
  const env = situationEnveloppe(`portfolio:${portfolio}`, annee, ctx);
  const aRepartir = aRepartirPortfolio(portfolio, annee, ctx);
  const dem = demandes.map((d) => ({ ...d, train: trainDePersonne(d.par, org), montant: montantDemande(d.texte) }));
  const propose = repartitionProposee(
    trains.map((t) => t.id),
    dem,
    aRepartir,
  );
  const ptsTot = dem.reduce((x, d) => x + d.pts, 0);
  const cleP = JSON.stringify(propose);
  useEffect(() => {
    onPropose?.(propose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleP]);
  const actuel = (t: string) => b.enveloppes.find((x) => x.niveau === `train:${t}` && x.annee === annee)?.montant ?? '';
  const valeur = (t: string) => montants[t] ?? (propose[t] !== undefined ? String(propose[t]) : actuel(t));
  const total = trains.reduce((x, t) => x + (Number(valeur(t.id).replace(',', '.')) || 0), 0);
  const sansTrain = dem.filter((d) => !d.train);
  return (
    <SectionFiche titre={`💶 Enveloppes des trains ${annee}`}>
      {!env.defini && <Text style={[s.sous, s.pad]}>Le portfolio n’a pas d’enveloppe pour {annee} : à fixer d’abord au Comité budgétaire.</Text>}
      {trains.map((t, i) => {
        const l = dem.filter((d) => d.train === t.id);
        const pts = l.reduce((x, d) => x + d.pts, 0);
        return (
          <View key={t.id} style={i > 0 ? s.bord : undefined}>
            <ChampFiche label={`🚆 ${t.nom}`}>
              <SaisieFiche
                placeholder="Montant (€)"
                value={valeur(t.id)}
                editable={peutModifier}
                onChangeText={(v) => onMontant(t.id, v.replace(/[^0-9.,]/g, ''))}
                keyboardType="decimal-pad"
                accessibilityLabel={`Enveloppe du train ${t.nom}`}
              />
            </ChampFiche>
            <Text style={[s.sous, { paddingHorizontal: 14, paddingBottom: 8 }]}>
              {`Enveloppe actuelle ${actuel(t.id) ? euros(Number(actuel(t.id))) : 'à définir'} · Demandé ${euros(l.reduce((x, d) => x + d.montant, 0))} (${l.length} demande${l.length > 1 ? 's' : ''}) · Vote ${ptsTot ? Math.round((100 * pts) / ptsTot) : 0} %${propose[t.id] !== undefined ? ` · Proposé ${euros(propose[t.id])}` : ' · Sans demande : enveloppe actuelle gardée'}`}
            </Text>
          </View>
        );
      })}
      <Text style={[s.sous, s.pad, total > aRepartir ? { color: colors.warning } : undefined]}>
        {`Total réparti ${euros(total)} sur ${euros(aRepartir)} à répartir${total > aRepartir ? ` · dépasse de ${euros(total - aRepartir)}` : ''}. À répartir = enveloppe du portfolio ${euros(env.enveloppe)} − epics sans train − demandes accordées au portfolio. Enregistré à l’envoi du compte rendu.`}
      </Text>
      {!!sansTrain.length && <Text style={[s.sous, s.pad]}>{`${sansTrain.length} demande${sansTrain.length > 1 ? 's' : ''} sans train (auteur hors des trains du portfolio) : non comptée${sansTrain.length > 1 ? 's' : ''}.`}</Text>}
    </SectionFiche>
  );
}

/**
 * 🏛️ Comité budgétaire (13/10) : l'enveloppe de l'année de l'entreprise et de chacun de ses portfolios ; Engagé et
 * Disponible de chacun. Enregistré à la sortie du champ (Sheet Budget, onglet Enveloppes).
 */
export function BlocEnveloppes({ espace, portfolios, peutModifier }: { espace: string; portfolios: { id: string; nom: string }[]; peutModifier: boolean }) {
  const b = useBudget();
  const annee = String(new Date().getFullYear());
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const niveaux = [{ niveau: `entreprise:${espace}`, nom: '🏢 Entreprise (total)' }, ...portfolios.map((p) => ({ niveau: `portfolio:${p.id}`, nom: `💼 ${p.nom}` }))];
  const actuel = (n: string) => b.enveloppes.find((x) => x.niveau === n && x.annee === annee)?.montant ?? '';
  const ecrire = (n: string) => {
    const v = saisies[n];
    if (v === undefined || v === actuel(n)) return;
    setErr('');
    b.ecrireEnveloppe(espace, n, annee, v).catch((x: Error) => setErr(`Non enregistré : ${x.message}`));
  };
  return (
    <SectionFiche titre={`💶 Enveloppes ${annee}`}>
      {niveaux.map((x, i) => (
        <View key={x.niveau} style={i > 0 ? s.bord : undefined}>
          <ChampFiche label={x.nom}>
            <SaisieFiche
              placeholder="Ex. 500000"
              value={saisies[x.niveau] ?? actuel(x.niveau)}
              editable={peutModifier}
              onChangeText={(v) => setSaisies((m) => ({ ...m, [x.niveau]: v.replace(/[^0-9.,]/g, '') }))}
              onBlur={() => ecrire(x.niveau)}
              onEndEditing={() => ecrire(x.niveau)}
              keyboardType="decimal-pad"
              accessibilityLabel={`Enveloppe ${x.nom}`}
            />
          </ChampFiche>
          <LigneEnveloppe niveau={x.niveau} />
        </View>
      ))}
      <Text style={[s.sous, s.pad]}>Engagé : budgets prévus des epics lancées + demandes accordées ; pour l’entreprise, les enveloppes données aux portfolios ; pour un portfolio, celles données à ses trains (les epics qu’ils réalisent sont alors payées par eux). Disponible = Enveloppe − Engagé.</Text>
      {!!err && <Text style={s.err}>{err}</Text>}
    </SectionFiche>
  );
}

/**
 * 📈 Écarts budgétaires (13/10) : epics dont l'estimation à la fin dépasse le budget prévu. Trois choix : Réviser le
 * budget prévu (nouveau montant, écrit tout de suite, trace « Décision prise ») ; Réduire le périmètre (note d'action à
 * concrétiser) ; Accepter l'écart (motif obligatoire, trace « Décision prise »).
 */
export function BlocEcarts({ epics, h, org, espace, peutDecider, onDecision, onReduire }: { epics: Epic[]; h: CtxConsomme['h']; org: OrgValue; espace: string; peutDecider: boolean; onDecision: (e: Epic, texte: string) => void; onReduire: (e: Epic, ecart: number) => void }) {
  const b = useBudget();
  const today = new Date().toISOString().slice(0, 10);
  const ed = avecDossiers(epics, b.dossiers);
  const conso = consommeReel({ org, h: { ...h, epicList: avecDossiers(h.epicList, b.dossiers) }, couts: b.couts, depenses: b.depenses, today });
  const lignes = ed
    .map((e) => {
      const d = conso.detail(e);
      const fin = Number(b.dossiers.get(e.id)?.estimation_fin) || d.estimationFin;
      return { e, prevu: Number(e.budget) || 0, fin, consomme: d.consomme };
    })
    // Seulement les epics lancées (dossier) ou déjà prêtes / en cours : une idée n'a pas d'écart à traiter
    .filter((x) => x.prevu > 0 && x.fin > x.prevu && (['lancer', 'continuer', 'changer'].includes(b.dossiers.get(x.e.id)?.decision ?? '') || x.e.etat === 'pret' || x.e.etat === 'en_cours'));
  const [choix, setChoix] = useState<Record<string, { c: 'reviser' | 'reduire' | 'accepter'; v: string }>>({});
  const [faits, setFaits] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const valider = async (x: (typeof lignes)[number]) => {
    const c = choix[x.e.id];
    if (!c) return;
    setErr('');
    try {
      if (c.c === 'reviser') {
        if (!(Number(c.v.replace(',', '.')) > 0)) throw new Error('Nouveau budget prévu en euros.');
        await b.ecrireDossier(espace, { id: x.e.id, budget_prevu: c.v });
        onDecision(x.e, `Budget prévu de « ${x.e.titre} » révisé : ${euros(x.prevu)} → ${euros(Number(c.v.replace(',', '.')))}`);
      } else if (c.c === 'reduire') onReduire(x.e, x.fin - x.prevu);
      else {
        if (!c.v.trim()) throw new Error('Motif obligatoire pour accepter l’écart.');
        onDecision(x.e, `Écart de « ${x.e.titre} » accepté (+${euros(x.fin - x.prevu)}) : ${c.v.trim()}`);
      }
      setFaits((m) => ({ ...m, [x.e.id]: c.c === 'reviser' ? 'Budget révisé' : c.c === 'reduire' ? 'Périmètre à réduire (note à concrétiser)' : 'Écart accepté' }));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <SectionFiche titre={`📈 Écarts budgétaires · ${lignes.length}`}>
      {lignes.map((x, i) => {
        const c = choix[x.e.id];
        return (
          <View key={x.e.id} style={[s.pad, i > 0 && s.bord]}>
            <Text style={s.texte}>🗂️ {x.e.titre}</Text>
            <Text style={[s.sous, { color: '#B3261E' }]}>Prévu {euros(x.prevu)} · Consommé réel {euros(x.consomme)} · Estimation à la fin {euros(x.fin)} (+{euros(x.fin - x.prevu)})</Text>
            {faits[x.e.id] ? (
              <Text style={[s.sous, { color: colors.success }]}>✓ {faits[x.e.id]}</Text>
            ) : (
              peutDecider && (
                <>
                  <View style={[s.actions, { paddingHorizontal: 0, flexWrap: 'wrap' }]}>
                    {(
                      [
                        ['reviser', 'Réviser le budget prévu'],
                        ['reduire', 'Réduire le périmètre'],
                        ['accepter', 'Accepter l’écart'],
                      ] as const
                    ).map(([v, l]) => (
                      <Pressable key={v} onPress={() => setChoix((m) => ({ ...m, [x.e.id]: { c: v, v: v === 'reviser' ? String(Math.ceil(x.fin)) : '' } }))} style={[s.puce, c?.c === v && s.puceOn]} accessibilityRole="radio">
                        <Text style={[s.puceTexte, c?.c === v && s.puceTexteOn]}>{l}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {c && c.c !== 'reduire' && (
                    <SaisieFiche
                      placeholder={c.c === 'reviser' ? 'Nouveau budget prévu (€)' : 'Motif (obligatoire)'}
                      value={c.v}
                      onChangeText={(v) => setChoix((m) => ({ ...m, [x.e.id]: { ...c, v: c.c === 'reviser' ? v.replace(/[^0-9.,]/g, '') : v } }))}
                      keyboardType={c.c === 'reviser' ? 'decimal-pad' : 'default'}
                      accessibilityLabel={c.c === 'reviser' ? 'Nouveau budget prévu' : 'Motif'}
                    />
                  )}
                  {c && (
                    <Pressable onPress={() => void valider(x)} style={[s.btn, { alignSelf: 'flex-start', marginTop: 8 }]} accessibilityRole="button">
                      <Text style={s.btnTexte}>Valider</Text>
                    </Pressable>
                  )}
                </>
              )
            )}
          </View>
        );
      })}
      {!lignes.length && <Text style={[s.sous, s.pad]}>✓ Aucun écart : toutes les estimations à la fin tiennent dans le prévu.</Text>}
      {!!err && <Text style={s.err}>{err}</Text>}
    </SectionFiche>
  );
}
