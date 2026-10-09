import { type ReactElement, useEffect, useState } from 'react';
import { Pressable, type RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Espace } from '../espaces';
import { useHierarchy } from '../hierarchyContext';
import { type EntiteOrg, type KindOrg, makeOrgValue, membresDe, nomPersonne, type OrgValue, porteurs, type Unite } from '../organisation';
import { colors } from '../theme';
import { useSafe } from '../safe';
import { enfantsRepartition } from '../budget';
import { SectionDepenses } from './Budget';
import { ChoiceSheet } from './ChoiceSheet';
import { libelleMoi } from '../droits';
import { type AutresChoix, FeuilleMulti, type GroupeChoix, LigneChoix } from './Choix';
import { Segmented } from './Segmented';

/** Un changement de rattachement dans l'arbre (appliqué tout de suite ; l'inverse sert à « Annuler ») */
export type Deplacement = { kind: KindOrg; id: string; champ: string; valeur: string; avant: string };

/**
 * ＋ d'un élément de l'arbre : le même menu que dans sa fiche — « ＋ Nouvelle … » ou « ☑ Choisir des … » existants
 * (cases à cocher : les libres d'abord, ceux d'un autre parent repliés).
 */
type Plus = {
  titre: string;
  nouveaux: { label: string; onPress: () => void }[];
  choisir: { label: string; titre: string; kind: KindOrg; champ: string; valeur: string; un: string; plusieurs: string; groupes: GroupeChoix[]; autres?: AutresChoix; avant: (id: string) => string }[];
};

/** Candidats rangés par parent actuel : « libres » (sans parent) d'abord, les autres repliés, un groupe par parent */
function grouperOrg<T extends { id: string }>(items: T[], parent: (x: T) => string, nomParent: (id: string) => string, label: (x: T) => string, libres: string, autres: string) {
  const par = new Map<string, T[]>();
  for (const x of items) par.set(parent(x), [...(par.get(parent(x)) ?? []), x]);
  const opt = (x: T) => ({ value: x.id, label: label(x) });
  const g: GroupeChoix[] = [{ titre: libres, options: (par.get('') ?? []).map(opt) }];
  const a = [...par.entries()].filter(([k]) => k).map(([k, l]) => ({ titre: nomParent(k), options: l.map(opt) }));
  return { groupes: g, autres: a.length ? { titre: autres, groupes: a } : undefined };
}

export type VueOrg = 'entreprise' | 'delivery';

/**
 * Onglet Organisation d'une entreprise : vue Entreprise (hiérarchie : directions, services, personnes) et, en mode
 * SAFe, vue Delivery SAFe (portfolios › trains › équipes, rôles). Chaque élément du delivery montre son backlog
 * (portfolio → epics, train → features, équipe → stories et tâches) avec un lien vers l'écran de travail filtré.
 */
export function OrganisationView({
  org,
  entreprises,
  safe,
  vue,
  onChangeVue,
  onOuvrir,
  onAjouter,
  onDeplacer,
  onVoirBacklog,
  refreshControl,
  moi,
  onChangerMoi,
}: {
  /** Démo : personne dont on voit les droits (« Voir en tant que ») ; null = vous, tous les droits */
  moi?: string | null;
  onChangerMoi?: (id: string | null) => void;
  /** Organisation des entreprises affichées */
  org: OrgValue;
  /** Espaces de travail Entreprise affichés */
  entreprises: Espace[];
  safe: boolean;
  vue: VueOrg;
  onChangeVue: (v: VueOrg) => void;
  onOuvrir: (kind: KindOrg, e: EntiteOrg<KindOrg>) => void;
  onAjouter: (kind: KindOrg, espace: string, defaults?: Record<string, string>) => void;
  /** « Choisir des … » dans l'arbre : rattachements changés tout de suite (et « Annuler ») */
  onDeplacer: (espace: string, d: Deplacement[]) => Promise<void>;
  /** Lien vers le travail : portfolio → Portefeuille, train → PI, équipe → Itération (filtrés) */
  onVoirBacklog: (kind: 'portfolio' | 'train' | 'equipeagile', id: string) => void;
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const hv = useHierarchy();
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const basculer = (id: string) => setReplies((r) => new Set(r.has(id) ? [...r].filter((x) => x !== id) : [...r, id]));
  const v = safe ? vue : 'entreprise';
  // ＋ : menu, feuille « Choisir des … », bandeau « Annuler » et éléments surlignés après un choix
  const [plus, setPlus] = useState<(Plus & { espace: string }) | null>(null);
  const [choix, setChoix] = useState<(Plus['choisir'][number] & { espace: string }) | null>(null);
  const [bandeau, setBandeau] = useState<{ texte: string; espace: string; d: Deplacement[] } | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [erreur, setErreur] = useState('');
  const appliquer = async (espace: string, d: Deplacement[], texte: string) => {
    try {
      setErreur('');
      await onDeplacer(espace, d);
      setFlash(new Set(d.map((x) => x.id)));
      setBandeau({ texte, espace, d });
    } catch (e) {
      setErreur(`Non enregistré : ${(e as Error).message}`);
    }
  };
  // Le bandeau disparaît tout seul après 6 s, ou dès qu'on touche ailleurs (l'élément reste surligné jusque-là)
  useEffect(() => {
    if (!bandeau) return;
    const t = setTimeout(() => {
      setBandeau(null);
      setFlash(new Set());
    }, 6000);
    return () => clearTimeout(t);
  }, [bandeau]);
  const fermerBandeau = () => {
    if (!bandeau) return;
    setBandeau(null);
    setFlash(new Set());
  };
  const annuler = async () => {
    if (!bandeau) return;
    const { espace, d } = bandeau;
    setBandeau(null);
    setFlash(new Set());
    try {
      await onDeplacer(espace, d.map((x) => ({ ...x, valeur: x.avant, avant: x.valeur })));
    } catch (e) {
      setErreur(`Non annulé : ${(e as Error).message}`);
    }
  };

  if (!entreprises.length) {
    return (
      <View style={s.vide}>
        <Text style={s.videTitre}>🏛️ L'Organisation concerne une entreprise</Text>
        <Text style={s.videTexte}>
          Affichez un espace de travail 🏢 Entreprise dans la carte des espaces de travail pour décrire sa hiérarchie et son delivery
          (portfolios, trains, équipes).
        </Text>
      </View>
    );
  }

  return (
    <View style={s.flex}>
      {safe && (
        <View style={s.vues}>
          <Segmented
            options={[
              { value: 'entreprise', label: '🏢 Entreprise' },
              { value: 'delivery', label: '🚆 Delivery SAFe' },
            ]}
            value={vue}
            onChange={onChangeVue}
          />
        </View>
      )}
      {onChangerMoi && org.personnes.length > 0 && (
        <View style={s.moi}>
          <LigneChoix
            label="Voir en tant que"
            value={moi ?? 'vous'}
            groupes={[{ options: [{ value: 'vous', label: 'Vous · tous les rôles' }, ...org.personnes.map((p) => ({ value: p.id, label: p.nom, meta: libelleMoi(p.id, org) }))] }]}
            libelle={(v) => (v && v !== 'vous' ? (org.personne.get(v)?.nom ?? '') : 'Vous · tous les rôles')}
            onChange={(v) => onChangerMoi(v && v !== 'vous' ? v : null)}
          />
        </View>
      )}
      <ScrollView contentContainerStyle={s.scroll} refreshControl={refreshControl} onTouchStart={fermerBandeau} onScrollBeginDrag={fermerBandeau}>
        {entreprises.map((esp) => {
          const dans = <T extends { espace?: string }>(l: T[]) => l.filter((x) => (x.espace || 'moi') === esp.id);
          const o = makeOrgValue({ personnes: dans(org.personnes), unites: dans(org.unites), portfolios: dans(org.portfolios), trains: dans(org.trains), equipes: dans(org.equipes) });
          return (
            <View key={esp.id}>
              {entreprises.length > 1 && <Text style={s.entreprise}>🏢 {esp.nom}</Text>}
              {v === 'entreprise' ? (
                <VueEntreprise o={o} espace={esp.id} replies={replies} basculer={basculer} onOuvrir={onOuvrir} onAjouter={onAjouter} onPlus={(p) => setPlus({ ...p, espace: esp.id })} flash={flash} />
              ) : (
                <VueDelivery o={o} espace={esp.id} replies={replies} basculer={basculer} onOuvrir={onOuvrir} onAjouter={onAjouter} onPlus={(p) => setPlus({ ...p, espace: esp.id })} flash={flash} onVoirBacklog={onVoirBacklog} hv={hv} />
              )}
            </View>
          );
        })}
      </ScrollView>
      {!!erreur && <Text style={s.erreur}>{erreur}</Text>}
      {bandeau && (
        <View style={s.bandeau} accessibilityRole="alert">
          <Text style={s.bandeauTexte}>{bandeau.texte}</Text>
          <Pressable onPress={annuler} hitSlop={8} accessibilityRole="button">
            <Text style={s.bandeauBtn}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setBandeau(null);
              setFlash(new Set());
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <Text style={s.bandeauFermer}>✕</Text>
          </Pressable>
        </View>
      )}
      <ChoiceSheet
        key={`plus-${plus?.titre ?? ''}`}
        visible={!!plus}
        title={plus?.titre ?? ''}
        choices={
          plus
            ? [
                ...plus.nouveaux.map((n) => ({ label: `＋ ${n.label}`, principal: true, onPress: n.onPress })),
                ...plus.choisir.map((c) => ({ label: `☑ ${c.label}`, suite: true, onPress: () => setChoix({ ...c, espace: plus.espace }) })),
              ]
            : []
        }
        onClose={() => setPlus(null)}
      />
      {choix && (
        <FeuilleMulti
          titre={choix.titre}
          groupes={choix.groupes}
          autres={choix.autres}
          selection={[]}
          vide="Rien à ajouter."
          libelleValider={(n) => (n ? `Ajouter ${n} ${n > 1 ? choix.plusieurs : choix.un}` : 'Ajouter')}
          onValider={(ids) => {
            const c = choix;
            setChoix(null);
            if (!ids.length) return;
            const noms = ids.map((id) => c.groupes.concat(c.autres?.groupes ?? []).flatMap((g) => g.options).find((x) => x.value === id)?.label ?? '?');
            appliquer(
              c.espace,
              ids.map((id) => ({ kind: c.kind, id, champ: c.champ, valeur: c.valeur, avant: c.avant(id) })),
              `${ids.length > 1 ? `${ids.length} ${c.plusieurs} ajoutés` : `« ${noms[0]} » ajouté`} ${c.titre.replace(/^Ajouter /, '')}`,
            );
          }}
          onFermer={() => setChoix(null)}
        />
      )}
    </View>
  );
}

type Commun = {
  o: OrgValue;
  espace: string;
  replies: Set<string>;
  basculer: (id: string) => void;
  onOuvrir: (kind: KindOrg, e: EntiteOrg<KindOrg>) => void;
  onAjouter: (kind: KindOrg, espace: string, defaults?: Record<string, string>) => void;
  onPlus: (p: Plus) => void;
  /** Éléments qui viennent d'être ajoutés (surlignés) */
  flash: Set<string>;
};

function Noeud({
  niveau,
  couleur,
  titre,
  sous,
  deplie,
  onBasculer,
  onPress,
  children,
  lien,
  ajout,
  surligne,
}: {
  niveau: number;
  couleur: string;
  titre: string;
  sous?: string;
  deplie?: boolean;
  onBasculer?: () => void;
  onPress: () => void;
  children?: React.ReactNode;
  lien?: { label: string; onPress: () => void };
  /** ＋ rond à droite de l'en-tête (même bouton que les sections des fiches) */
  ajout?: { label: string; onPress: () => void };
  surligne?: boolean;
}) {
  return (
    <View style={{ marginLeft: niveau * 14 }}>
      <Pressable onPress={onPress} style={[s.noeud, { borderLeftColor: couleur }, surligne && s.surligne]} accessibilityRole="button" accessibilityLabel={`Ouvrir ${titre}`}>
        <View style={s.tete}>
          {onBasculer ? (
            <Pressable onPress={onBasculer} hitSlop={10} accessibilityRole="button" accessibilityLabel={deplie ? `Replier ${titre}` : `Déplier ${titre}`}>
              <Text style={s.chev}>{deplie ? '▾' : '▸'}</Text>
            </Pressable>
          ) : (
            <Text style={s.chev}> </Text>
          )}
          <Text style={s.titre}>{titre}</Text>
          {ajout && <Rond label={ajout.label} onPress={ajout.onPress} />}
        </View>
        {!!sous && <Text style={s.sous}>{sous}</Text>}
        {lien && (
          <Pressable onPress={lien.onPress} hitSlop={6} style={s.lien} accessibilityRole="link">
            <Text style={s.lienTexte}>{lien.label}</Text>
          </Pressable>
        )}
      </Pressable>
      {deplie !== false && children}
    </View>
  );
}

function Rond({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={s.rond} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={s.rondTexte}>＋</Text>
    </Pressable>
  );
}

/** Titre de section (capitales, nombre) avec le ＋ rond à droite */
function Section({ titre, ajout }: { titre: string; ajout?: { label: string; onPress: () => void } }) {
  return (
    <View style={s.sectionLigne}>
      <Text style={[s.section, s.flex]}>{titre}</Text>
      {ajout && <Rond label={ajout.label} onPress={ajout.onPress} />}
    </View>
  );
}

/** Vue Entreprise : unités (directions › services) avec leur responsable et leurs personnes */
function VueEntreprise({ o, espace, replies, basculer, onOuvrir, onAjouter, onPlus, flash }: Commun) {
  const ids = new Set(o.unites.map((u) => u.id));
  const nomU = (id: string) => {
    const u = o.unites.find((x) => x.id === id);
    return u ? `${u.type === 'direction' ? '🏛️' : '🧩'} ${u.nom}` : '?';
  };
  /** ＋ d'une unité : nouvelle personne ou sous-unité, ou choisir des personnes / unités existantes */
  const plusUnite = (u: Unite): Plus => {
    // Pas l'unité elle-même ni celles au-dessus d'elle (une unité ne va pas dans sa propre sous-unité)
    const au_dessus = new Set<string>();
    for (let x: Unite | undefined = u; x && !au_dessus.has(x.id); x = o.unites.find((y) => y.id === x!.parent)) au_dessus.add(x.id);
    const parentDe = (id: string) => (id && ids.has(id) ? id : '');
    const personnes = o.personnes.filter((p) => p.unite !== u.id);
    const unites = o.unites.filter((x) => !au_dessus.has(x.id) && x.parent !== u.id);
    return {
      titre: `Ajouter dans ${u.nom}`,
      nouveaux: [
        { label: 'Nouvelle personne', onPress: () => onAjouter('personne', espace, { unite: u.id, manager: u.responsable }) },
        { label: 'Nouvelle sous-unité', onPress: () => onAjouter('unite', espace, { parent: u.id }) },
      ],
      choisir: [
        {
          label: 'Choisir des personnes',
          titre: `Ajouter à ${u.nom}`,
          kind: 'personne',
          champ: 'unite',
          valeur: u.id,
          un: 'personne',
          plusieurs: 'personnes',
          avant: (id) => o.personnes.find((p) => p.id === id)?.unite ?? '',
          ...grouperOrg(personnes, (p) => parentDe(p.unite), nomU, (p) => p.nom, 'Sans service', 'Dans une autre unité'),
        },
        {
          label: 'Choisir des unités',
          titre: `Ajouter à ${u.nom}`,
          kind: 'unite',
          champ: 'parent',
          valeur: u.id,
          un: 'unité',
          plusieurs: 'unités',
          avant: (id) => o.unites.find((x) => x.id === id)?.parent ?? '',
          ...grouperOrg(unites, (x) => parentDe(x.parent), nomU, (x) => nomU(x.id), 'Unités principales', 'Dans une autre unité'),
        },
      ],
    };
  };
  const racines = o.unites.filter((u) => !u.parent || !ids.has(u.parent));
  const tri = <T extends { nom: string }>(l: T[]) => [...l].sort((a, b) => a.nom.localeCompare(b.nom));
  const unite = (u: Unite, niveau: number): React.ReactNode => {
    const enfants = tri(o.unites.filter((x) => x.parent === u.id));
    const gens = tri(o.personnes.filter((p) => p.unite === u.id));
    const total = (id: string): number => o.personnes.filter((p) => p.unite === id).length + o.unites.filter((x) => x.parent === id).reduce((n, x) => n + total(x.id), 0);
    const resp = nomPersonne(o, u.responsable);
    return (
      <Noeud
        key={u.id}
        niveau={niveau}
        couleur={u.type === 'direction' ? '#7B2FBF' : '#1A73E8'}
        titre={`${u.type === 'direction' ? '🏛️' : '🧩'} ${u.nom}`}
        sous={[resp ? `Responsable : ${resp}` : 'Sans responsable', `${total(u.id)} personne${total(u.id) > 1 ? 's' : ''}`].join(' · ')}
        deplie={!replies.has(u.id)}
        onBasculer={() => basculer(u.id)}
        onPress={() => onOuvrir('unite', u)}
        ajout={{ label: `Ajouter dans ${u.nom}`, onPress: () => onPlus(plusUnite(u)) }}
        surligne={flash.has(u.id)}
      >
        {enfants.map((x) => unite(x, niveau + 1))}
        {gens.map((p) => (
          <Personne key={p.id} niveau={niveau + 1} p={p} o={o} surligne={flash.has(p.id)} onPress={() => onOuvrir('personne', p)} />
        ))}
      </Noeud>
    );
  };
  const safeE = useSafe();
  const hE = useHierarchy();
  const sansService = tri(o.personnes.filter((p) => !p.unite || !ids.has(p.unite)));
  return (
    <View>
      <Section titre={`DIRECTIONS ET SERVICES · ${racines.length}`} ajout={{ label: 'Nouvelle unité (direction, service)', onPress: () => onAjouter('unite', espace) }} />
      {tri(racines).map((u) => unite(u, 0))}
      <Section titre={`SANS SERVICE · ${sansService.length}`} ajout={{ label: 'Nouvelle personne sans service', onPress: () => onAjouter('personne', espace) }} />
      {sansService.map((p) => (
        <Personne key={p.id} niveau={0} p={p} o={o} onPress={() => onOuvrir('personne', p)} />
      ))}
      {safeE.actif && (
        <View style={{ marginTop: 14 }}>
          <SectionDepenses espace={espace} porteur={`entreprise:${espace}`} enfants={enfantsRepartition(`entreprise:${espace}`, o, hE)} titre="Dépenses de l’entreprise" />
        </View>
      )}
    </View>
  );
}

function Personne({ niveau, p, o, onPress, surligne }: { niveau: number; p: OrgValue['personnes'][number]; o: OrgValue; onPress: () => void; surligne?: boolean }) {
  const equipes = o.equipes.filter((e) => membresDe(e).includes(p.id) || e.po === p.id || e.sm === p.id).map((e) => `👥 ${e.nom}`);
  const initiales = p.nom
    .split(/\s+/)
    .map((m) => m[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <Pressable onPress={onPress} style={[s.personne, { marginLeft: niveau * 14 + 4 }, surligne && s.surligne]} accessibilityRole="button" accessibilityLabel={`Ouvrir ${p.nom}`}>
      <View style={s.avatar}>
        <Text style={s.avatarTexte}>{initiales}</Text>
      </View>
      <View style={s.flex}>
        <Text style={s.personneNom}>{p.nom}</Text>
        <Text style={s.sous}>
          {[p.manager ? `Manager : ${nomPersonne(o, p.manager)}` : '', equipes.join(', '), p.capacite ? `${String(parseFloat(p.capacite) || 0).replace('.', ',')} j par sprint` : ''].filter(Boolean).join(' · ') || p.email || 'Sans e-mail'}
        </Text>
      </View>
    </Pressable>
  );
}

/** Vue Delivery SAFe : portfolios › trains › équipes, rôles et backlog de chacun */
function VueDelivery({ o, espace, replies, basculer, onOuvrir, onAjouter, onPlus, flash, onVoirBacklog, hv }: Commun & { onVoirBacklog: (kind: 'portfolio' | 'train' | 'equipeagile', id: string) => void; hv: ReturnType<typeof useHierarchy> }) {
  const dansEsp = <T extends { espace?: string }>(l: T[]) => l.filter((x) => (x.espace || 'moi') === espace);
  const epics = dansEsp(hv.epicList);
  const features = dansEsp(hv.featureList);
  const items = dansEsp(hv.items).filter((t) => t.statut !== 'termine');
  const nb = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
  const role = (label: string, id: string) => (id ? `${label} ${nomPersonne(o, id)}` : '');
  const nbEpics = (id: string) => epics.filter((e) => e.portfolio === id).length;
  const nbFeatures = (id: string) => features.filter((f) => porteurs({ train: f.train, equipe: f.equipe }, hv, o).train === id).length;
  const nbStories = (id: string) => items.filter((t) => porteurs(t, hv, o).equipe === id).length;
  const trainsDe = (pf: string) => o.trains.filter((t) => t.portfolio === pf);
  const equipesDe = (tr: string) => o.equipes.filter((e) => e.train === tr);
  const pfIds = new Set(o.portfolios.map((p) => p.id));
  const trIds = new Set(o.trains.map((t) => t.id));
  const nomPf = (id: string) => `💼 ${o.portfolios.find((p) => p.id === id)?.nom ?? '?'}`;
  const nomTr = (id: string) => `🚆 ${o.trains.find((t) => t.id === id)?.nom ?? '?'}`;
  /** ＋ d'un portfolio : nouveau train, ou choisir des trains existants */
  const plusPortfolio = (p: OrgValue['portfolios'][number]): Plus => ({
    titre: `Ajouter dans ${p.nom}`,
    nouveaux: [{ label: 'Nouveau train', onPress: () => onAjouter('train', espace, { portfolio: p.id }) }],
    choisir: [
      {
        label: 'Choisir des trains',
        titre: `Ajouter à ${p.nom}`,
        kind: 'train',
        champ: 'portfolio',
        valeur: p.id,
        un: 'train',
        plusieurs: 'trains',
        avant: (id) => o.trains.find((t) => t.id === id)?.portfolio ?? '',
        ...grouperOrg(o.trains.filter((t) => t.portfolio !== p.id), (t) => (pfIds.has(t.portfolio) ? t.portfolio : ''), nomPf, (t) => `🚆 ${t.nom}`, 'Sans portfolio', 'Dans un autre portfolio'),
      },
    ],
  });
  /** ＋ d'un train : nouvelle équipe, ou choisir des équipes existantes */
  const plusTrain = (t: OrgValue['trains'][number]): Plus => ({
    titre: `Ajouter dans ${t.nom}`,
    nouveaux: [{ label: 'Nouvelle équipe', onPress: () => onAjouter('equipeagile', espace, { train: t.id }) }],
    choisir: [
      {
        label: 'Choisir des équipes',
        titre: `Ajouter à ${t.nom}`,
        kind: 'equipeagile',
        champ: 'train',
        valeur: t.id,
        un: 'équipe',
        plusieurs: 'équipes',
        avant: (id) => o.equipes.find((e) => e.id === id)?.train ?? '',
        ...grouperOrg(o.equipes.filter((e) => e.train !== t.id), (e) => (trIds.has(e.train) ? e.train : ''), nomTr, (e) => `👥 ${e.nom}`, 'Sans train', 'Dans un autre train'),
      },
    ],
  });

  const equipe = (e: OrgValue['equipes'][number], niveau: number) => (
    <Noeud
      key={e.id}
      niveau={niveau}
      couleur="#00897B"
      titre={`👥 ${e.nom}`}
      sous={[role('PO', e.po), role('SM', e.sm), nb(membresDe(e).length, 'membre', 'membres')].filter(Boolean).join(' · ')}
      onPress={() => onOuvrir('equipeagile', e)}
      surligne={flash.has(e.id)}
      lien={{ label: `${nb(nbStories(e.id), 'story ou tâche', 'stories et tâches')} en cours › Sprint`, onPress: () => onVoirBacklog('equipeagile', e.id) }}
    />
  );
  const train = (t: OrgValue['trains'][number], niveau: number) => (
    <Noeud
      key={t.id}
      niveau={niveau}
      couleur="#1A73E8"
      titre={`🚆 Train ${t.nom}`}
      sous={[role('RTE', t.rte), role('PM', t.pm), nb(equipesDe(t.id).length, 'équipe', 'équipes')].filter(Boolean).join(' · ')}
      deplie={!replies.has(t.id)}
      onBasculer={() => basculer(t.id)}
      onPress={() => onOuvrir('train', t)}
      lien={{ label: `${nb(nbFeatures(t.id), 'feature', 'features')} › PI`, onPress: () => onVoirBacklog('train', t.id) }}
      ajout={{ label: `Ajouter dans ${t.nom}`, onPress: () => onPlus(plusTrain(t)) }}
      surligne={flash.has(t.id)}
    >
      {equipesDe(t.id).map((e) => equipe(e, niveau + 1))}
    </Noeud>
  );
  const orphelinsT = o.trains.filter((t) => !t.portfolio || !pfIds.has(t.portfolio));
  const orphelinsE = o.equipes.filter((e) => !e.train || !trIds.has(e.train));
  return (
    <View>
      <Section titre={`PORTFOLIOS · ${o.portfolios.length}`} ajout={{ label: 'Nouveau portfolio', onPress: () => onAjouter('portfolio', espace) }} />
      {o.portfolios.map((p) => (
        <Noeud
          key={p.id}
          niveau={0}
          couleur="#7B2FBF"
          titre={`💼 Portfolio ${p.nom}`}
          sous={[role('Epic Owner', p.epic_owner), nb(trainsDe(p.id).length, 'train', 'trains')].filter(Boolean).join(' · ')}
          deplie={!replies.has(p.id)}
          onBasculer={() => basculer(p.id)}
          onPress={() => onOuvrir('portfolio', p)}
          lien={{ label: `${nb(nbEpics(p.id), 'epic', 'epics')} › Portefeuille`, onPress: () => onVoirBacklog('portfolio', p.id) }}
          ajout={{ label: `Ajouter dans ${p.nom}`, onPress: () => onPlus(plusPortfolio(p)) }}
        >
          {trainsDe(p.id).map((t) => train(t, 1))}
        </Noeud>
      ))}
      {orphelinsT.length > 0 && <Text style={s.section}>TRAINS SANS PORTFOLIO · {orphelinsT.length}</Text>}
      {orphelinsT.map((t) => train(t, 0))}
      {orphelinsE.length > 0 && <Text style={s.section}>ÉQUIPES SANS TRAIN · {orphelinsE.length}</Text>}
      {orphelinsE.map((e) => equipe(e, 0))}
      {!o.portfolios.length && !o.trains.length && !o.equipes.length && (
        <Text style={s.astuce}>Commencez par un portfolio, puis ses trains et leurs équipes agiles. Les personnes se créent dans la vue Entreprise.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  vues: { paddingHorizontal: 10, paddingBottom: 8 },
  moi: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  scroll: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 130 },
  entreprise: { fontSize: 12.5, fontWeight: '800', color: colors.muted, letterSpacing: 0.4, marginTop: 8, marginBottom: 6 },
  surligne: { backgroundColor: '#FEF7E0', borderColor: '#F3D98B' },
  bandeau: { position: 'absolute', left: 12, right: 12, bottom: 96, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, boxShadow: '0 2px 10px rgba(20, 30, 50, 0.10)' },
  bandeauTexte: { flex: 1, color: colors.text, fontSize: 13.5 },
  bandeauBtn: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  bandeauFermer: { color: colors.muted, fontSize: 14 },
  erreur: { color: colors.danger, fontSize: 13, paddingHorizontal: 14, paddingVertical: 6 },
  noeud: { borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 7 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chev: { width: 14, fontSize: 11, color: colors.muted, textAlign: 'center' },
  titre: { flex: 1, fontSize: 14.5, fontWeight: '800', color: colors.text },
  sous: { fontSize: 12, color: colors.muted, marginTop: 3, marginLeft: 20, lineHeight: 17 },
  lien: { marginTop: 5, marginLeft: 20, alignSelf: 'flex-start' },
  lienTexte: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  rond: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  rondTexte: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 18 },
  sectionLigne: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 2 },
  section: { fontSize: 11.5, fontWeight: '800', color: colors.muted, letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  personne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 6, marginBottom: 2 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E6EAF0', alignItems: 'center', justifyContent: 'center' },
  avatarTexte: { fontSize: 11.5, fontWeight: '800', color: colors.text },
  personneNom: { fontSize: 14, fontWeight: '600', color: colors.text },
  astuce: { fontSize: 12.5, color: colors.muted, lineHeight: 18, marginTop: 12 },
  vide: { padding: 24, alignItems: 'center' },
  videTitre: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 30, textAlign: 'center' },
  videTexte: { fontSize: 13.5, color: colors.muted, lineHeight: 20, marginTop: 8, textAlign: 'center' },
});
