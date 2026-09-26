import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type EntiteOrg, ICONE_ORG, type KindOrg, membresDe, NOM_ORG, type OrgValue, type Personne } from '../organisation';
import { colors } from '../theme';
import { Chips } from './Chips';
import { DeleteSection } from './DeleteSection';
import { Field, FormSheet, formStyles as f, Label } from './FormSheet';

type Donnees = Record<string, string>;

const VIDES: Record<KindOrg, Donnees> = {
  personne: { nom: '', email: '', unite: '', manager: '', capacite: '' },
  unite: { nom: '', type: 'service', parent: '', responsable: '' },
  portfolio: { nom: '', epic_owner: '' },
  train: { nom: '', portfolio: '', rte: '', pm: '' },
  equipeagile: { nom: '', train: '', po: '', sm: '', membres: '' },
};

const TITRES: Record<KindOrg, [string, string]> = {
  personne: ['Personne', 'Nouvelle personne'],
  unite: ['Unité', 'Nouvelle unité'],
  portfolio: ['Portfolio', 'Nouveau portfolio'],
  train: ['Train', 'Nouveau train'],
  equipeagile: ['Équipe agile', 'Nouvelle équipe agile'],
};

const PLACEHOLDERS: Record<KindOrg, string> = {
  personne: 'Nom (ex. Tom Faure)',
  unite: 'Nom (ex. Direction technique, Développement)',
  portfolio: 'Nom du portfolio (ex. Digital)',
  train: 'Nom du train (ex. Clients)',
  equipeagile: "Nom de l'équipe (ex. Mobile)",
};

/**
 * Fiche d'un élément de l'Organisation d'une entreprise : personne, unité (direction, service), portfolio, train,
 * équipe agile. Les choix (service, manager, rôles, membres) viennent de la même entreprise.
 */
export function OrgForm({
  visible,
  kind,
  entite,
  defaults,
  org,
  nomEntreprise,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  kind: KindOrg;
  entite: EntiteOrg<KindOrg> | null;
  /** Valeurs proposées pour un nouvel élément (ex. le train d'une nouvelle équipe) */
  defaults?: Donnees;
  /** Organisation de l'entreprise de la fiche */
  org: OrgValue;
  nomEntreprise: string;
  onClose: () => void;
  onSave: (data: Donnees) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [form, setForm] = useState<Donnees>(VIDES[kind]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const e = entite as unknown as Donnees | null;
    setForm(Object.fromEntries(Object.keys(VIDES[kind]).map((k) => [k, e?.[k] ?? defaults?.[k] ?? VIDES[kind][k]])));
    setError(null);
  }, [visible, entite, kind, defaults]);

  const set = (k: string) => (v: string) => setForm((x) => ({ ...x, [k]: v }));
  const id = entite?.id ?? '';
  const personnes = [...org.personnes].sort((a, b) => a.nom.localeCompare(b.nom));
  const optionsPersonnes = (sauf?: string) => [{ value: '', label: 'Personne' }, ...personnes.filter((p) => p.id !== sauf).map((p) => ({ value: p.id, label: p.nom }))];

  // Unités proposées comme parent : pas elle-même ni ses sous-unités (pas de boucle)
  const descendants = new Set<string>();
  if (kind === 'unite' && id) {
    const pile = [id];
    while (pile.length) {
      const u = pile.pop()!;
      descendants.add(u);
      org.unites.filter((x) => x.parent === u).forEach((x) => pile.push(x.id));
    }
  }

  const save = async () => {
    if (!form.nom.trim()) return setError('Donnez un nom.');
    setError(null);
    setBusy(true);
    try {
      await onSave({ ...form, nom: form.nom.trim() });
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const Choix = ({ label, k, options }: { label: string; k: string; options: { value: string; label: string }[] }) => (
    <>
      <Label>{label}</Label>
      {options.length <= 1 ? (
        <Text style={f.muted}>Rien à choisir pour l'instant.</Text>
      ) : (
        <Chips options={options} value={options.some((o) => o.value === form[k]) ? form[k] : ''} onChange={set(k)} compact wrap />
      )}
    </>
  );

  const membres = membresDe({ membres: form.membres ?? '' });
  const basculerMembre = (p: Personne) =>
    setForm((x) => {
      const l = membresDe({ membres: x.membres ?? '' });
      return { ...x, membres: (l.includes(p.id) ? l.filter((m) => m !== p.id) : [...l, p.id]).join(';') };
    });

  // Ce que la suppression change (rien d'autre n'est supprimé)
  const consequence: Record<KindOrg, string> = {
    personne: 'ses rôles, son rattachement de manager et ses équipes sont vidés ; ses tâches restent, sans responsable',
    unite: 'ses sous-unités remontent d’un niveau ; ses personnes restent, sans service',
    portfolio: 'ses trains et ses epics restent, sans portfolio',
    train: 'ses équipes et ses features restent, sans train',
    equipeagile: 'ses features et ses tâches restent, sans équipe',
  };

  return (
    <FormSheet visible={visible} title={`${ICONE_ORG[kind]} ${TITRES[kind][entite ? 0 : 1]}`} busy={busy} error={error} onClose={onClose} onSave={save}>
      <Text style={s.entreprise}>🏢 {nomEntreprise} · Organisation</Text>
      <Field style={f.titleInput} placeholder={PLACEHOLDERS[kind]} value={form.nom} onChangeText={set('nom')} autoFocus={!entite} />

      {kind === 'personne' && (
        <>
          <Label>E-mail (compte Google)</Label>
          <Field placeholder="prenom.nom@gmail.com" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
          <Choix label="Service (vue Entreprise)" k="unite" options={[{ value: '', label: 'Aucun' }, ...org.unites.map((u) => ({ value: u.id, label: `${u.type === 'direction' ? '🏛️' : '🧩'} ${u.nom}` }))]} />
          <Choix label="Manager" k="manager" options={optionsPersonnes(id).map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} />
          <Label>Capacité par itération (jours, facultatif)</Label>
          <Field placeholder="ex. 8" value={form.capacite} onChangeText={set('capacite')} keyboardType="decimal-pad" />
          <Text style={f.hint}>Ajouter une personne ne lui donne aucun accès : l'accès viendra de son équipe et de ses rôles delivery.</Text>
        </>
      )}

      {kind === 'unite' && (
        <>
          <Label>Type</Label>
          <Chips options={[{ value: 'direction', label: '🏛️ Direction' }, { value: 'service', label: '🧩 Service' }]} value={form.type === 'direction' ? 'direction' : 'service'} onChange={set('type')} compact />
          <Choix label="Au-dessus (facultatif)" k="parent" options={[{ value: '', label: 'Aucune (premier niveau)' }, ...org.unites.filter((u) => !descendants.has(u.id)).map((u) => ({ value: u.id, label: u.nom }))]} />
          <Choix label="Responsable" k="responsable" options={optionsPersonnes().map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} />
        </>
      )}

      {kind === 'portfolio' && <Choix label="Epic Owner" k="epic_owner" options={optionsPersonnes().map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} />}

      {kind === 'train' && (
        <>
          <Choix label="Portfolio" k="portfolio" options={[{ value: '', label: 'Aucun' }, ...org.portfolios.map((p) => ({ value: p.id, label: `💼 ${p.nom}` }))]} />
          <Choix label="RTE (Release Train Engineer)" k="rte" options={optionsPersonnes().map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} />
          <Choix label="Product Manager" k="pm" options={optionsPersonnes().map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} />
        </>
      )}

      {kind === 'equipeagile' && (
        <>
          <Choix label="Train" k="train" options={[{ value: '', label: 'Aucun' }, ...org.trains.map((t) => ({ value: t.id, label: `🚆 ${t.nom}` }))]} />
          <Choix label="Product Owner" k="po" options={optionsPersonnes().map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} />
          <Choix label="Scrum Master" k="sm" options={optionsPersonnes().map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} />
          <Label>Membres · {membres.length}</Label>
          {personnes.length === 0 ? (
            <Text style={f.muted}>Ajoutez d'abord des personnes (vue Entreprise).</Text>
          ) : (
            <View style={s.membres}>
              {personnes.map((p) => {
                const on = membres.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => basculerMembre(p)}
                    style={[s.membre, on && s.membreOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`Membre : ${p.nom}`}
                  >
                    <Text style={[s.membreText, on && s.membreTextOn]}>
                      {on ? '✓ ' : ''}
                      {p.nom}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <Text style={f.hint}>Le PO et le Scrum Master pilotent le travail de l'équipe (attribution, onglet Équipe, alertes).</Text>
        </>
      )}

      {entite && <Text style={[f.hint, s.consequence]}>Suppression : {consequence[kind]}. Rien d'autre n'est supprimé.</Text>}
      {entite && (
        <DeleteSection
          label={`Supprimer : ${NOM_ORG[kind].toLowerCase()}`}
          name={entite.nom}
          onDelete={() => {
            setBusy(true);
            onDelete()
              .catch((e) => setError(`Échec de la suppression : ${(e as Error).message}`))
              .finally(() => setBusy(false));
          }}
        />
      )}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  consequence: { marginTop: 18 },
  entreprise: { fontSize: 12.5, fontWeight: '700', color: colors.muted, marginBottom: 6 },
  membres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  membre: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  membreOn: { backgroundColor: colors.text, borderColor: colors.text },
  membreText: { fontSize: 13, fontWeight: '600', color: colors.text },
  membreTextOn: { color: '#fff' },
});
