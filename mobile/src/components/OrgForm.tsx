import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { type EntiteOrg, type EquipeAgile, ICONE_ORG, type KindOrg, membresDe, NOM_ORG, nomPersonne, type OrgValue } from '../organisation';
import { useSafe } from '../safe';
import { colors } from '../theme';
import { Chips } from './Chips';
import { type GroupeChoix, LigneChoix, LigneMulti, ListeEnfants, SectionFiche, type AutresChoix } from './Choix';
import { DeleteSection } from './DeleteSection';
import { Field, FormSheet, formStyles as f, Label, TitreFiche } from './FormSheet';

type Donnees = Record<string, string>;
/** Éléments existants rangés dans la fiche : leur champ `champ` prendra l'id de la fiche */
export type RangerOrg = { kind: KindOrg; champ: string; ids: string[] };

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
  /**
   * Enregistre ; `rester` : la fiche reste ouverte (parent enregistré avant d'ouvrir un enfant) ; `ranger` : éléments
   * existants rangés dans celui-ci (« Ranger un train existant »…), faits à l'enregistrement ; renvoie l'élément
   */
  onSave: (data: Donnees, rester?: boolean, ranger?: RangerOrg[]) => Promise<EntiteOrg<KindOrg> | void>;
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
  const safe = useSafe();
  /** Enfants existants rangés ici (clé : « train:portfolio »…) : faits à l'enregistrement */
  const [ranger, setRangerTout] = useState<Record<string, string[]>>({});
  const rangerDe = (k: KindOrg, champ: string) => ranger[`${k}:${champ}`] ?? [];
  const setRanger = (k: KindOrg, champ: string) => (l: string[]) => setRangerTout((r) => ({ ...r, [`${k}:${champ}`]: l }));

  useEffect(() => {
    if (!visible) return;
    const e = entite as unknown as Donnees | null;
    const v = Object.fromEntries(Object.keys(VIDES[kind]).map((k) => [k, e?.[k] ?? defaults?.[k] ?? VIDES[kind][k]]));
    setForm(v);
    setInitial(v);
    setError(null);
    setRangerTout({});
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

  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || Object.values(ranger).some((l) => l.length > 0);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);

  const set = (k: string) => (v: string) => setForm((x) => ({ ...x, [k]: v }));
  const id = entite?.id ?? '';
  const personnes = [...org.personnes].sort((a, b) => a.nom.localeCompare(b.nom));
  const nomUnite = (id: string) => {
    const u = org.unite.get(id);
    return u ? `${u.type === 'direction' ? '🏛️' : '🧩'} ${u.nom}` : '';
  };
  /** Personnes : un groupe d'abord (membres de l'équipe, gens du service), les autres repliées */
  const listePersonnes = (premiers?: { titre: string; ids: Set<string> }, sauf?: string): { groupes: GroupeChoix[]; autres?: AutresChoix } => {
    const l = personnes.filter((p) => p.id !== sauf);
    const opt = (p: { id: string; nom: string; unite: string }) => ({ value: p.id, label: p.nom, meta: nomUnite(p.unite) });
    if (!premiers || !l.some((p) => premiers.ids.has(p.id))) return { groupes: [{ options: l.map(opt) }] };
    const autres = l.filter((p) => !premiers.ids.has(p.id));
    return {
      groupes: [{ titre: premiers.titre, options: l.filter((p) => premiers.ids.has(p.id)).map(opt) }],
      autres: autres.length ? { titre: 'Autres personnes', groupes: [{ options: autres.map(opt) }] } : undefined,
    };
  };

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
      const liste = Object.entries(ranger)
        .filter(([, ids]) => ids.length)
        .map(([cle, ids]) => ({ kind: cle.split(':')[0] as KindOrg, champ: cle.split(':')[1], ids }));
      const o = await onSave({ ...form, nom: form.nom.trim() }, rester, liste);
      if (rester) {
        setInitial(form);
        setRangerTout({});
      }
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
   * Ligne de choix d'un champ (appelée comme une fonction : la ligne garde son état entre deux saisies). `parent` :
   * champ de rattachement (service, unité au-dessus, portfolio, train) : en changer « déplace » l'élément ; `nouveau` :
   * « ＋ Nouvelle … » en tête de la feuille (sous le même grand-parent quand l'élément en avait un).
   */
  const choix = ({
    label,
    k,
    liste,
    nouveau,
    parent,
    attendu,
    sans,
  }: {
    label: string;
    k: string;
    liste: { groupes: GroupeChoix[]; autres?: AutresChoix };
    nouveau?: { kind: KindOrg; label: string; defaults?: Donnees };
    parent?: boolean;
    attendu?: boolean;
    sans: string;
  }) => (
    <LigneChoix
      key={k}
      label={label}
      value={form[k] ?? ''}
      depart={initial[k] || undefined}
      parent={parent}
      attendu={attendu}
      {...liste}
      libelle={(v) => (k === 'unite' || k === 'parent' ? nomUnite(v) : k === 'portfolio' ? `💼 ${org.portfolio.get(v)?.nom ?? '?'}` : k === 'train' ? `🚆 ${org.train.get(v)?.nom ?? '?'}` : nomPersonne(org, v) || '?')}
      nouveau={nouveau && onOuvrir ? { label: nouveau.label, onPress: () => onOuvrir(nouveau.kind, null, nouveau.defaults, k) } : undefined}
      sans={sans}
      onChange={set(k)}
    />
  );
  /** Valeurs par défaut sans les champs vides */
  const sansVide = (d: Record<string, string | undefined>): Donnees => Object.fromEntries(Object.entries(d).filter(([, v]) => !!v)) as Donnees;
  const nouvellePersonne = (defaults?: Donnees) => ({ kind: 'personne' as const, label: 'Nouvelle personne', defaults });

  /** Enfants (trains d'un portfolio…) : toucher en ouvre la fiche par-dessus ; ＋ rond : nouveau ou ranger un existant */
  const enfants = ({
    titre,
    liste,
    kindEnfant,
    icone,
    sous,
    champ,
    extra,
    candidats,
    mots,
  }: {
    titre: string;
    liste: { id: string; nom: string }[];
    kindEnfant: KindOrg;
    icone: string;
    sous?: (x: { id: string; nom: string }) => string;
    champ: string;
    extra?: Donnees;
    candidats: { id: string; nom: string; ailleurs?: string }[];
    mots: { nouveau: string; ranger: string; libres: string; autres: string; un: string; plusieurs: string };
  }) => (
    <ListeEnfants
      key={`${kindEnfant}-${champ}`}
      titre={`${titre} · ${liste.length}`}
      enfants={liste.map((x) => ({ id: x.id, texte: `${icone} ${x.nom}${sous?.(x) ? `  · ${sous(x)}` : ''}`, onPress: onOuvrir ? () => onOuvrir(kindEnfant, x as EntiteOrg<KindOrg>) : undefined }))}
      candidats={candidats.filter((c) => c.id !== id).map((c) => ({ id: c.id, titre: `${icone} ${c.nom}`, ailleurs: c.ailleurs }))}
      ranger={rangerDe(kindEnfant, champ)}
      setRanger={setRanger(kindEnfant, champ)}
      nouveau={onOuvrir ? () => ouvrirEnfant(kindEnfant, champ, extra) : undefined}
      mots={{ ...mots, feuille: `Ranger dans : ${form.nom || TITRES[kind][1].toLowerCase()}` }}
      vide="Aucun pour l'instant."
    />
  );

  const membres = membresDe({ membres: form.membres ?? '' });

  // Fil d'Ariane en haut : où est rangé l'élément (services au-dessus ; portfolio › train)
  const chaineUnites = (u: string) => {
    const l: string[] = [];
    const vus = new Set<string>();
    for (let x = org.unite.get(u); x && !vus.has(x.id); x = x.parent ? org.unite.get(x.parent) : undefined) {
      vus.add(x.id);
      l.unshift(nomUnite(x.id));
    }
    return l;
  };
  const trainFil = kind === 'equipeagile' && form.train ? org.train.get(form.train) : undefined;
  const fil = (
    kind === 'personne'
      ? chaineUnites(form.unite)
      : kind === 'unite'
        ? chaineUnites(form.parent)
        : kind === 'train'
          ? [form.portfolio ? `💼 ${org.portfolio.get(form.portfolio)?.nom ?? '?'}` : '']
          : kind === 'equipeagile'
            ? [trainFil?.portfolio ? `💼 ${org.portfolio.get(trainFil.portfolio)?.nom ?? '?'}` : '', trainFil ? `🚆 ${trainFil.nom}` : '']
            : []
  )
    .filter(Boolean)
    .join(' › ');

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
      title={TITRES[kind][entite ? 0 : 1]}
      couleurTitre={colors.primary}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={() => save()}
      retour={pile?.retour}
      fil={fil}
      chemin={pile?.chemin}
      onFermerTout={pile?.onFermerTout}
    >
      <TitreFiche icone={ICONE_ORG[kind]} titre={form.nom} vide="Nom" />
      <Text style={s.entreprise}>🏢 {nomEntreprise} · Organisation</Text>
      <Field style={f.titleInput} placeholder={PLACEHOLDERS[kind]} value={form.nom} onChangeText={set('nom')} autoFocus={!entite} />

      {kind === 'personne' && (
        <>
          <Label>E-mail (compte Google)</Label>
          <Field placeholder="prenom.nom@gmail.com" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
          <SectionFiche titre="Hiérarchie">
            {choix({
              label: 'Service',
              k: 'unite',
              liste: { groupes: [{ options: org.unites.map((u) => ({ value: u.id, label: nomUnite(u.id) })) }] },
              nouveau: { kind: 'unite', label: 'Nouvelle unité', defaults: sansVide({ parent: org.unite.get(form.unite)?.parent }) },
              parent: true,
              sans: 'Sans service',
            })}
            {choix({
              label: 'Manager',
              k: 'manager',
              liste: listePersonnes(form.unite ? { titre: `Service : ${org.unite.get(form.unite)?.nom ?? ''}`, ids: new Set(org.personnes.filter((p) => p.unite === form.unite && !!form.unite).map((p) => p.id)) } : undefined, id),
              nouveau: nouvellePersonne(sansVide({ unite: form.unite })),
              sans: 'Sans manager',
            })}
          </SectionFiche>
          <Label>Capacité par itération (jours, facultatif)</Label>
          <Field placeholder="ex. 8" value={form.capacite} onChangeText={set('capacite')} keyboardType="decimal-pad" />
          <Text style={f.hint}>Ajouter une personne ne lui donne aucun accès : l'accès viendra de son équipe et de ses rôles delivery.</Text>
        </>
      )}

      {kind === 'unite' && (
        <>
          <Label>Type</Label>
          <Chips options={[{ value: 'direction', label: '🏛️ Direction' }, { value: 'service', label: '🧩 Service' }]} value={form.type === 'direction' ? 'direction' : 'service'} onChange={set('type')} compact />
          <SectionFiche titre="Hiérarchie">
            {choix({
              label: 'Au-dessus',
              k: 'parent',
              liste: { groupes: [{ options: org.unites.filter((u) => !descendants.has(u.id)).map((u) => ({ value: u.id, label: nomUnite(u.id) })) }] },
              nouveau: { kind: 'unite', label: 'Nouvelle unité au-dessus', defaults: sansVide({ parent: org.unite.get(form.parent)?.parent }) },
              parent: true,
              sans: 'Premier niveau',
            })}
            {choix({
              label: 'Responsable',
              k: 'responsable',
              liste: listePersonnes(id ? { titre: 'Dans cette unité', ids: new Set(org.personnes.filter((p) => p.unite === id).map((p) => p.id)) } : undefined),
              nouveau: nouvellePersonne(id ? { unite: id } : undefined),
              sans: 'Sans responsable',
            })}
          </SectionFiche>
          {enfants({
            titre: 'Sous-unités',
            liste: org.unites.filter((u) => u.parent === id && !!id),
            kindEnfant: 'unite',
            icone: '🧩',
            champ: 'parent',
            extra: { type: 'service' },
            candidats: org.unites.filter((u) => !descendants.has(u.id) && (!id || u.parent !== id)).map((u) => ({ id: u.id, nom: u.nom, ailleurs: u.parent ? nomUnite(u.parent) : undefined })),
            mots: { nouveau: 'Nouvelle sous-unité', ranger: 'Ranger une unité existante', libres: 'Premier niveau', autres: 'Sous une autre unité', un: "Rangée ici à l'enregistrement.", plusieurs: "Rangées ici à l'enregistrement." },
          })}
          {enfants({
            titre: 'Personnes',
            liste: org.personnes.filter((p) => p.unite === id && !!id),
            kindEnfant: 'personne',
            icone: '👤',
            sous: (x) => {
              const m = nomPersonne(org, org.personne.get(x.id)?.manager);
              return m ? `Manager : ${m}` : '';
            },
            champ: 'unite',
            extra: form.responsable ? { manager: form.responsable } : {},
            candidats: org.personnes.filter((p) => !id || p.unite !== id).map((p) => ({ id: p.id, nom: p.nom, ailleurs: p.unite ? nomUnite(p.unite) : undefined })),
            mots: { nouveau: 'Nouvelle personne', ranger: 'Ranger une personne existante', libres: 'Sans service', autres: 'Dans un autre service', un: "Rangée ici à l'enregistrement.", plusieurs: "Rangées ici à l'enregistrement." },
          })}
        </>
      )}

      {kind === 'portfolio' && (
        <>
          <SectionFiche titre="Rôles">
            {choix({ label: 'Epic Owner', k: 'epic_owner', liste: listePersonnes(), nouveau: nouvellePersonne(), sans: 'Sans Epic Owner' })}
          </SectionFiche>
          {enfants({
            titre: 'Trains',
            liste: org.trains.filter((t) => t.portfolio === id && !!id),
            kindEnfant: 'train',
            icone: '🚆',
            sous: (x) => `${org.equipes.filter((e) => e.train === x.id).length} équipe(s)`,
            champ: 'portfolio',
            candidats: org.trains.filter((t) => !id || t.portfolio !== id).map((t) => ({ id: t.id, nom: t.nom, ailleurs: t.portfolio ? `💼 ${org.portfolio.get(t.portfolio)?.nom ?? '?'}` : undefined })),
            mots: { nouveau: 'Nouveau train', ranger: 'Ranger un train existant', libres: 'Sans portfolio', autres: 'Dans un autre portfolio', un: "Rangé ici à l'enregistrement.", plusieurs: "Rangés ici à l'enregistrement." },
          })}
        </>
      )}

      {kind === 'train' && (
        <>
          <SectionFiche titre="Rattachement" aDefinir={safe.actif && !form.portfolio ? 1 : 0}>
            {choix({
              label: 'Portfolio',
              k: 'portfolio',
              liste: { groupes: [{ options: org.portfolios.map((p) => ({ value: p.id, label: `💼 ${p.nom}` })) }] },
              nouveau: { kind: 'portfolio', label: 'Nouveau portfolio' },
              parent: true,
              attendu: safe.actif,
              sans: 'Sans portfolio',
            })}
          </SectionFiche>
          <SectionFiche titre="Rôles" aDefinir={safe.actif && !form.rte ? 1 : 0}>
            {choix({ label: 'RTE', k: 'rte', liste: listePersonnes(), nouveau: nouvellePersonne(), attendu: safe.actif, sans: 'Sans RTE' })}
            {choix({ label: 'Product Manager', k: 'pm', liste: listePersonnes(), nouveau: nouvellePersonne(), sans: 'Sans Product Manager' })}
          </SectionFiche>
          {enfants({
            titre: 'Équipes agiles',
            liste: org.equipes.filter((e) => e.train === id && !!id),
            kindEnfant: 'equipeagile',
            icone: '👥',
            sous: (x) => `${membresDe(x as EquipeAgile).length} membre(s)`,
            champ: 'train',
            candidats: org.equipes.filter((e) => !id || e.train !== id).map((e) => ({ id: e.id, nom: e.nom, ailleurs: e.train ? `🚆 ${org.train.get(e.train)?.nom ?? '?'}` : undefined })),
            mots: { nouveau: 'Nouvelle équipe agile', ranger: 'Ranger une équipe existante', libres: 'Sans train', autres: 'Dans un autre train', un: "Rangée ici à l'enregistrement.", plusieurs: "Rangées ici à l'enregistrement." },
          })}
        </>
      )}

      {kind === 'equipeagile' && (
        <>
          <SectionFiche titre="Rattachement" aDefinir={safe.actif && !form.train ? 1 : 0}>
            {choix({
              label: 'Train',
              k: 'train',
              liste: { groupes: [{ options: org.trains.map((t) => ({ value: t.id, label: `🚆 ${t.nom}`, meta: t.portfolio ? `💼 ${org.portfolio.get(t.portfolio)?.nom ?? ''}` : undefined })) }] },
              nouveau: { kind: 'train', label: 'Nouveau train', defaults: sansVide({ portfolio: org.train.get(form.train)?.portfolio }) },
              parent: true,
              attendu: safe.actif,
              sans: 'Sans train',
            })}
          </SectionFiche>
          <SectionFiche titre="Rôles et membres" aDefinir={[form.po, form.sm, membres.length ? 'x' : ''].filter((v) => safe.actif && !v).length}>
            {choix({ label: 'Product Owner', k: 'po', liste: listePersonnes({ titre: 'Membres de l’équipe', ids: new Set(membres) }), nouveau: nouvellePersonne(), attendu: safe.actif, sans: 'Sans Product Owner' })}
            {choix({ label: 'Scrum Master', k: 'sm', liste: listePersonnes({ titre: 'Membres de l’équipe', ids: new Set(membres) }), nouveau: nouvellePersonne(), attendu: safe.actif, sans: 'Sans Scrum Master' })}
            <LigneMulti
              label="Membres"
              values={membres}
              depart={membresDe({ membres: initial.membres ?? '' })}
              onChange={(l) => setForm((x) => ({ ...x, membres: l.join(';') }))}
              {...listePersonnes()}
              attendu={safe.actif}
              nouveau={onOuvrir ? { label: 'Nouvelle personne', onPress: () => onOuvrir('personne', null, undefined, 'membres') } : undefined}
              resume={(n) => `${n} membre${n > 1 ? 's' : ''}`}
            />
          </SectionFiche>
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
});
