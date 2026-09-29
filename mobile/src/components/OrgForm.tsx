import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type EntiteOrg, type EquipeAgile, ICONE_ORG, type KindOrg, membresDe, NOM_ORG, nomPersonne, type OrgValue, type Personne } from '../organisation';
import { colors } from '../theme';
import { Rattachement } from './Rattachement';
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
  pile,
  onOuvrir,
  injection,
  onDirty,
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
  /** Enregistre ; `rester` : la fiche reste ouverte (parent enregistré avant d'ouvrir un enfant) ; renvoie l'élément */
  onSave: (data: Donnees, rester?: boolean) => Promise<EntiteOrg<KindOrg> | void>;
  onDelete: () => Promise<void>;
  /** Pile de fiches : fiche d'en dessous (« ‹ Digital »), fil en haut, tout fermer */
  pile?: { retour?: string | string[]; chemin: string; onFermerTout: () => void };
  /**
   * Ouvre une fiche par-dessus celle-ci : un enfant (« ＋ Train » d'un portfolio, un train de la liste) ou un élément
   * créé à la volée pour un choix (`champ` : « ＋ Nouvelle personne » pour le PO → la personne créée devient PO)
   */
  onOuvrir?: (kind: KindOrg, entite: EntiteOrg<KindOrg> | null, defaults?: Donnees, champ?: string) => void;
  /** Élément créé à la volée pour un champ de cette fiche : il y est choisi (ajouté pour les membres) */
  injection?: { champ: string; id: string; n: number };
  /** Changements non enregistrés (pour « Tout fermer ») */
  onDirty?: (dirty: boolean) => void;
}) {
  const [form, setForm] = useState<Donnees>(VIDES[kind]);
  const [initial, setInitial] = useState<Donnees>(VIDES[kind]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const e = entite as unknown as Donnees | null;
    const v = Object.fromEntries(Object.keys(VIDES[kind]).map((k) => [k, e?.[k] ?? defaults?.[k] ?? VIDES[kind][k]]));
    setForm(v);
    setInitial(v);
    setError(null);
  }, [visible, entite, kind, defaults]);

  // Élément créé à la volée (fiche du dessus enregistrée) : choisi dans son champ
  useEffect(() => {
    if (!injection) return;
    setForm((x) =>
      injection.champ === 'membres'
        ? { ...x, membres: [...new Set([...membresDe({ membres: x.membres ?? '' }), injection.id])].join(';') }
        : { ...x, [injection.champ]: injection.id },
    );
  }, [injection]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);

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

  const save = async (rester = false) => {
    if (!form.nom.trim()) {
      setError('Donnez un nom.');
      return undefined;
    }
    setError(null);
    setBusy(true);
    try {
      const o = await onSave({ ...form, nom: form.nom.trim() }, rester);
      if (rester) setInitial(form);
      return o;
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Ouvre un enfant par-dessus (« ＋ Train » d'un portfolio…) : un nouvel élément est d'abord enregistré (l'enfant
   * a besoin de lui), puis l'enfant s'ouvre avec son parent déjà choisi.
   */
  const ouvrirEnfant = async (k: KindOrg, champParent: string, extra: Donnees = {}) => {
    if (!onOuvrir) return;
    let parentId = id;
    if (!parentId) {
      const o = await save(true);
      if (!o) return;
      parentId = o.id;
    }
    onOuvrir(k, null, { [champParent]: parentId, ...extra });
  };

  /**
   * Choix d'un champ. `parent` : champ de rattachement (service, unité au-dessus, portfolio, train) ; s'il était
   * rempli à l'ouverture, on en change par « Déplacer » et « ＋ Vers un nouveau … » (même grand-parent).
   */
  const Choix = ({ label, k, options, nouveau, parent }: { label: string; k: string; options: { value: string; label: string }[]; nouveau?: { kind: KindOrg; label: string; defaults?: Donnees }; parent?: { vers: string; defaults?: Donnees } }) => {
    const depart = parent ? String((entite as unknown as Donnees | null)?.[k] ?? '') : '';
    const verrouille = !!depart;
    return (
      <>
        <Label>{label}</Label>
        <Rattachement
          verrouille={verrouille}
          resume={options.find((o) => o.value && o.value === form[k])?.label ?? ''}
          deplace={verrouille && (form[k] ?? '') !== depart}
          onAnnuler={() => set(k)(depart)}
        >
          {options.length <= 1 ? (
            <Text style={f.muted}>Rien à choisir pour l'instant.</Text>
          ) : (
            <Chips options={options} value={options.some((o) => o.value === form[k]) ? form[k] : ''} onChange={set(k)} compact wrap />
          )}
          {nouveau && onOuvrir && (
            <Pressable onPress={() => onOuvrir(nouveau.kind, null, verrouille ? parent?.defaults : nouveau.defaults, k)} hitSlop={6} style={s.nouveau} accessibilityRole="button">
              <Text style={s.nouveauTexte}>＋ {verrouille ? parent!.vers : nouveau.label}</Text>
            </Pressable>
          )}
        </Rattachement>
      </>
    );
  };
  /** Valeurs par défaut sans les champs vides */
  const sansVide = (d: Record<string, string | undefined>): Donnees => Object.fromEntries(Object.entries(d).filter(([, v]) => !!v)) as Donnees;
  const nouvellePersonne = { kind: 'personne' as const, label: 'Nouvelle personne' };

  /** Liste d'enfants (trains d'un portfolio…) : toucher en ouvre la fiche par-dessus ; « ＋ » en crée un */
  const Enfants = ({ titre, liste, kindEnfant, icone, sous, ajouter }: { titre: string; liste: { id: string; nom: string }[]; kindEnfant: KindOrg; icone: string; sous?: (x: { id: string; nom: string }) => string; ajouter: { label: string; champ: string; extra?: Donnees } }) => (
    <>
      <Label>
        {titre} · {liste.length}
      </Label>
      {liste.map((x) => (
        <Pressable key={x.id} onPress={() => onOuvrir?.(kindEnfant, x as EntiteOrg<KindOrg>)} style={s.enfant} accessibilityRole="button" accessibilityLabel={`Ouvrir ${x.nom}`}>
          <Text style={s.enfantNom}>
            {icone} {x.nom}
          </Text>
          {!!sous?.(x) && <Text style={s.enfantSous}>{sous(x)}</Text>}
          <Text style={s.enfantChev}>›</Text>
        </Pressable>
      ))}
      {onOuvrir && (
        <Pressable onPress={() => ouvrirEnfant(kindEnfant, ajouter.champ, ajouter.extra)} hitSlop={6} style={s.nouveau} accessibilityRole="button">
          <Text style={s.nouveauTexte}>＋ {ajouter.label}</Text>
        </Pressable>
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
    <FormSheet
      visible={visible}
      title={`${ICONE_ORG[kind]} ${TITRES[kind][entite ? 0 : 1]}`}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={() => save()}
      retour={pile?.retour}
      chemin={pile?.chemin}
      onFermerTout={pile?.onFermerTout}
    >
      <Text style={s.entreprise}>🏢 {nomEntreprise} · Organisation</Text>
      <Field style={f.titleInput} placeholder={PLACEHOLDERS[kind]} value={form.nom} onChangeText={set('nom')} autoFocus={!entite} />

      {kind === 'personne' && (
        <>
          <Label>E-mail (compte Google)</Label>
          <Field placeholder="prenom.nom@gmail.com" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
          <Choix label="Service (vue Entreprise)" k="unite" options={[{ value: '', label: 'Aucun' }, ...org.unites.map((u) => ({ value: u.id, label: `${u.type === 'direction' ? '🏛️' : '🧩'} ${u.nom}` }))]} nouveau={{ kind: 'unite', label: 'Nouvelle unité' }} parent={{ vers: 'Vers une nouvelle unité', defaults: sansVide({ parent: org.unite.get(form.unite)?.parent }) }} />
          <Choix label="Manager" k="manager" options={optionsPersonnes(id).map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} nouveau={{ ...nouvellePersonne, defaults: { unite: form.unite } }} />
          <Label>Capacité par itération (jours, facultatif)</Label>
          <Field placeholder="ex. 8" value={form.capacite} onChangeText={set('capacite')} keyboardType="decimal-pad" />
          <Text style={f.hint}>Ajouter une personne ne lui donne aucun accès : l'accès viendra de son équipe et de ses rôles delivery.</Text>
        </>
      )}

      {kind === 'unite' && (
        <>
          <Label>Type</Label>
          <Chips options={[{ value: 'direction', label: '🏛️ Direction' }, { value: 'service', label: '🧩 Service' }]} value={form.type === 'direction' ? 'direction' : 'service'} onChange={set('type')} compact />
          <Choix label="Au-dessus (facultatif)" k="parent" options={[{ value: '', label: 'Aucune (premier niveau)' }, ...org.unites.filter((u) => !descendants.has(u.id)).map((u) => ({ value: u.id, label: u.nom }))]} nouveau={{ kind: 'unite', label: 'Nouvelle unité au-dessus' }} parent={{ vers: 'Vers une nouvelle unité au-dessus', defaults: sansVide({ parent: org.unite.get(form.parent)?.parent }) }} />
          <Choix label="Responsable" k="responsable" options={optionsPersonnes().map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} nouveau={{ ...nouvellePersonne, defaults: id ? { unite: id } : undefined }} />
          <Enfants
            titre="Sous-unités"
            liste={org.unites.filter((u) => u.parent === id && !!id)}
            kindEnfant="unite"
            icone="🧩"
            ajouter={{ label: 'Sous-unité', champ: 'parent', extra: { type: 'service' } }}
          />
          <Enfants
            titre="Personnes"
            liste={org.personnes.filter((p) => p.unite === id && !!id)}
            kindEnfant="personne"
            icone="👤"
            sous={(x) => nomPersonne(org, (x as Personne).manager) && `Manager : ${nomPersonne(org, (x as Personne).manager)}`}
            ajouter={{ label: 'Personne dans cette unité', champ: 'unite', extra: form.responsable ? { manager: form.responsable } : {} }}
          />
        </>
      )}

      {kind === 'portfolio' && (
        <>
          <Choix label="Epic Owner" k="epic_owner" options={optionsPersonnes().map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} nouveau={nouvellePersonne} />
          <Enfants
            titre="Trains"
            liste={org.trains.filter((t) => t.portfolio === id && !!id)}
            kindEnfant="train"
            icone="🚆"
            sous={(x) => `${org.equipes.filter((e) => e.train === x.id).length} équipe(s)`}
            ajouter={{ label: 'Train', champ: 'portfolio' }}
          />
        </>
      )}

      {kind === 'train' && (
        <>
          <Choix label="Portfolio" k="portfolio" options={[{ value: '', label: 'Aucun' }, ...org.portfolios.map((p) => ({ value: p.id, label: `💼 ${p.nom}` }))]} nouveau={{ kind: 'portfolio', label: 'Nouveau portfolio' }} parent={{ vers: 'Vers un nouveau portfolio' }} />
          <Choix label="RTE (Release Train Engineer)" k="rte" options={optionsPersonnes().map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} nouveau={nouvellePersonne} />
          <Choix label="Product Manager" k="pm" options={optionsPersonnes().map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} nouveau={nouvellePersonne} />
          <Enfants
            titre="Équipes agiles"
            liste={org.equipes.filter((e) => e.train === id && !!id)}
            kindEnfant="equipeagile"
            icone="👥"
            sous={(x) => `${membresDe(x as EquipeAgile).length} membre(s)`}
            ajouter={{ label: 'Équipe agile', champ: 'train' }}
          />
        </>
      )}

      {kind === 'equipeagile' && (
        <>
          <Choix label="Train" k="train" options={[{ value: '', label: 'Aucun' }, ...org.trains.map((t) => ({ value: t.id, label: `🚆 ${t.nom}` }))]} nouveau={{ kind: 'train', label: 'Nouveau train' }} parent={{ vers: 'Vers un nouveau train', defaults: sansVide({ portfolio: org.train.get(form.train)?.portfolio }) }} />
          <Choix label="Product Owner" k="po" options={optionsPersonnes().map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} nouveau={nouvellePersonne} />
          <Choix label="Scrum Master" k="sm" options={optionsPersonnes().map((o) => (o.value ? o : { ...o, label: 'Aucun' }))} nouveau={nouvellePersonne} />
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
          {onOuvrir && (
            <Pressable onPress={() => onOuvrir('personne', null, undefined, 'membres')} hitSlop={6} style={s.nouveau} accessibilityRole="button">
              <Text style={s.nouveauTexte}>＋ Nouvelle personne (membre)</Text>
            </Pressable>
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
  nouveau: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  nouveauTexte: { fontSize: 13.5, fontWeight: '700', color: colors.primary },
  enfant: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  enfantNom: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  enfantSous: { flex: 1, fontSize: 12, color: colors.muted },
  enfantChev: { marginLeft: 'auto', fontSize: 18, color: colors.muted },
  entreprise: { fontSize: 12.5, fontWeight: '700', color: colors.muted, marginBottom: 6 },
  membres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  membre: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  membreOn: { backgroundColor: colors.text, borderColor: colors.text },
  membreText: { fontSize: 13, fontWeight: '600', color: colors.text },
  membreTextOn: { color: '#fff' },
});
