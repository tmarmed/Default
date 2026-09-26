import { type ReactElement, useState } from 'react';
import { Pressable, type RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Espace } from '../espaces';
import { useHierarchy } from '../hierarchyContext';
import { type EntiteOrg, type KindOrg, makeOrgValue, membresDe, nomPersonne, type OrgValue, porteurs, type Unite } from '../organisation';
import { colors } from '../theme';
import { Segmented } from './Segmented';

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
  onVoirBacklog,
  refreshControl,
}: {
  /** Organisation des entreprises affichées */
  org: OrgValue;
  /** Espaces de travail Entreprise affichés */
  entreprises: Espace[];
  safe: boolean;
  vue: VueOrg;
  onChangeVue: (v: VueOrg) => void;
  onOuvrir: (kind: KindOrg, e: EntiteOrg<KindOrg>) => void;
  onAjouter: (kind: KindOrg, espace: string, defaults?: Record<string, string>) => void;
  /** Lien vers le travail : portfolio → Portefeuille, train → PI, équipe → Itération (filtrés) */
  onVoirBacklog: (kind: 'portfolio' | 'train' | 'equipeagile', id: string) => void;
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const hv = useHierarchy();
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const basculer = (id: string) => setReplies((r) => new Set(r.has(id) ? [...r].filter((x) => x !== id) : [...r, id]));
  const v = safe ? vue : 'entreprise';

  if (!entreprises.length) {
    return (
      <View style={s.vide}>
        <Text style={s.videTitre}>🏛️ L'Organisation concerne une entreprise</Text>
        <Text style={s.videTexte}>
          Affichez un espace de travail 🏢 Entreprise dans la carte des espaces de travail pour décrire sa hiérarchie et, en mode SAFe, son delivery
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
      <ScrollView contentContainerStyle={s.scroll} refreshControl={refreshControl}>
        {entreprises.map((esp) => {
          const dans = <T extends { espace?: string }>(l: T[]) => l.filter((x) => (x.espace || 'moi') === esp.id);
          const o = makeOrgValue({ personnes: dans(org.personnes), unites: dans(org.unites), portfolios: dans(org.portfolios), trains: dans(org.trains), equipes: dans(org.equipes) });
          return (
            <View key={esp.id}>
              {entreprises.length > 1 && <Text style={s.entreprise}>🏢 {esp.nom}</Text>}
              {v === 'entreprise' ? (
                <VueEntreprise o={o} espace={esp.id} replies={replies} basculer={basculer} onOuvrir={onOuvrir} onAjouter={onAjouter} />
              ) : (
                <VueDelivery o={o} espace={esp.id} replies={replies} basculer={basculer} onOuvrir={onOuvrir} onAjouter={onAjouter} onVoirBacklog={onVoirBacklog} hv={hv} />
              )}
            </View>
          );
        })}
        {!safe && <Text style={s.astuce}>La vue Delivery SAFe (portfolios, trains, équipes) s'affiche en mode SAFe.</Text>}
      </ScrollView>
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
}) {
  return (
    <View style={{ marginLeft: niveau * 14 }}>
      <Pressable onPress={onPress} style={[s.noeud, { borderLeftColor: couleur }]} accessibilityRole="button" accessibilityLabel={`Ouvrir ${titre}`}>
        <View style={s.tete}>
          {onBasculer ? (
            <Pressable onPress={onBasculer} hitSlop={10} accessibilityRole="button" accessibilityLabel={deplie ? `Replier ${titre}` : `Déplier ${titre}`}>
              <Text style={s.chev}>{deplie ? '▾' : '▸'}</Text>
            </Pressable>
          ) : (
            <Text style={s.chev}> </Text>
          )}
          <Text style={s.titre}>{titre}</Text>
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

function Ajout({ niveau, label, onPress }: { niveau: number; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.ajout, { marginLeft: niveau * 14 + 16 }]} accessibilityRole="button" hitSlop={4}>
      <Text style={s.ajoutTexte}>＋ {label}</Text>
    </Pressable>
  );
}

/** Vue Entreprise : unités (directions › services) avec leur responsable et leurs personnes */
function VueEntreprise({ o, espace, replies, basculer, onOuvrir, onAjouter }: Commun) {
  const ids = new Set(o.unites.map((u) => u.id));
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
      >
        {enfants.map((x) => unite(x, niveau + 1))}
        {gens.map((p) => (
          <Personne key={p.id} niveau={niveau + 1} p={p} o={o} onPress={() => onOuvrir('personne', p)} />
        ))}
        <Ajout niveau={niveau + 1} label={`Personne dans ${u.nom}`} onPress={() => onAjouter('personne', espace, { unite: u.id, manager: u.responsable })} />
      </Noeud>
    );
  };
  const sansService = tri(o.personnes.filter((p) => !p.unite || !ids.has(p.unite)));
  return (
    <View>
      {tri(racines).map((u) => unite(u, 0))}
      <Ajout niveau={0} label="Unité (direction, service)" onPress={() => onAjouter('unite', espace)} />
      {(sansService.length > 0 || !o.personnes.length) && <Text style={s.section}>SANS SERVICE · {sansService.length}</Text>}
      {sansService.map((p) => (
        <Personne key={p.id} niveau={0} p={p} o={o} onPress={() => onOuvrir('personne', p)} />
      ))}
      <Ajout niveau={0} label="Personne" onPress={() => onAjouter('personne', espace)} />
    </View>
  );
}

function Personne({ niveau, p, o, onPress }: { niveau: number; p: OrgValue['personnes'][number]; o: OrgValue; onPress: () => void }) {
  const equipes = o.equipes.filter((e) => membresDe(e).includes(p.id) || e.po === p.id || e.sm === p.id).map((e) => `👥 ${e.nom}`);
  const initiales = p.nom
    .split(/\s+/)
    .map((m) => m[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <Pressable onPress={onPress} style={[s.personne, { marginLeft: niveau * 14 + 4 }]} accessibilityRole="button" accessibilityLabel={`Ouvrir ${p.nom}`}>
      <View style={s.avatar}>
        <Text style={s.avatarTexte}>{initiales}</Text>
      </View>
      <View style={s.flex}>
        <Text style={s.personneNom}>{p.nom}</Text>
        <Text style={s.sous}>
          {[p.manager ? `Manager : ${nomPersonne(o, p.manager)}` : '', equipes.join(', '), p.capacite ? `${p.capacite} j` : ''].filter(Boolean).join(' · ') || p.email || 'Sans e-mail'}
        </Text>
      </View>
    </Pressable>
  );
}

/** Vue Delivery SAFe : portfolios › trains › équipes, rôles et backlog de chacun */
function VueDelivery({ o, espace, replies, basculer, onOuvrir, onAjouter, onVoirBacklog, hv }: Commun & { onVoirBacklog: (kind: 'portfolio' | 'train' | 'equipeagile', id: string) => void; hv: ReturnType<typeof useHierarchy> }) {
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

  const equipe = (e: OrgValue['equipes'][number], niveau: number) => (
    <Noeud
      key={e.id}
      niveau={niveau}
      couleur="#00897B"
      titre={`👥 ${e.nom}`}
      sous={[role('PO', e.po), role('SM', e.sm), nb(membresDe(e).length, 'membre', 'membres')].filter(Boolean).join(' · ')}
      onPress={() => onOuvrir('equipeagile', e)}
      lien={{ label: `${nb(nbStories(e.id), 'story ou tâche', 'stories et tâches')} en cours › Itération`, onPress: () => onVoirBacklog('equipeagile', e.id) }}
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
    >
      {equipesDe(t.id).map((e) => equipe(e, niveau + 1))}
      <Ajout niveau={niveau + 1} label={`Équipe dans ${t.nom}`} onPress={() => onAjouter('equipeagile', espace, { train: t.id })} />
    </Noeud>
  );
  const orphelinsT = o.trains.filter((t) => !t.portfolio || !pfIds.has(t.portfolio));
  const orphelinsE = o.equipes.filter((e) => !e.train || !trIds.has(e.train));
  return (
    <View>
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
        >
          {trainsDe(p.id).map((t) => train(t, 1))}
          <Ajout niveau={1} label={`Train dans ${p.nom}`} onPress={() => onAjouter('train', espace, { portfolio: p.id })} />
        </Noeud>
      ))}
      <Ajout niveau={0} label="Portfolio" onPress={() => onAjouter('portfolio', espace)} />
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
  scroll: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 130 },
  entreprise: { fontSize: 12.5, fontWeight: '800', color: colors.muted, letterSpacing: 0.4, marginTop: 8, marginBottom: 6 },
  noeud: { borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 7 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chev: { width: 14, fontSize: 11, color: colors.muted, textAlign: 'center' },
  titre: { flex: 1, fontSize: 14.5, fontWeight: '800', color: colors.text },
  sous: { fontSize: 12, color: colors.muted, marginTop: 3, marginLeft: 20, lineHeight: 17 },
  lien: { marginTop: 5, marginLeft: 20, alignSelf: 'flex-start' },
  lienTexte: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  ajout: { paddingVertical: 5, marginBottom: 6, alignSelf: 'flex-start' },
  ajoutTexte: { fontSize: 13, fontWeight: '700', color: colors.primary },
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
