/**
 * Arbre des éléments (14/10, docs/regles-reunions.html bloc 13) : un seul composant pour toutes les réunions.
 * Chaque élément avec son état ; ses changements depuis la réunion précédente juste en dessous (↳) ; le filtre de
 * l'avancement règle l'affichage : « Éléments » (un point bleu ● sur ce qui a changé), « Avec changements »,
 * « Changés seulement » (les parents sans changement restent, en gris, pour le contexte).
 * On part des éléments de la réunion (`cles`) et on remonte (story › feature › epic) ; jamais toute l'arborescence.
 * Familles : « elements » (epics, features, stories, tâches, objectifs) et « budget » (enveloppes, demandes).
 */
import { eurosTexte } from '../../format';
import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { RangeePastilles } from '../RangeePastilles';
import { estFiltre, nbFiltresAv, focusDe, type LigneAv, type ModeAv, MODES_AV, phrase, statutFeature } from '../../avancement';
import { ETATS_EPIC, type Item } from '../../types';
import { useOrg } from '../../organisation';
import { BlocBrique } from './Brique';
import { colors } from '../../theme';
import { type Avancement, FiltreAvancement } from './Avancement';
import { PastilleStatut, Pastille, pastilleStatut, st, Vide } from './ui';

export type FamilleArbre = 'elements' | 'budget';
const PREFIXES: Record<FamilleArbre, string[]> = { elements: ['e', 'f', 'q', 'o', 'r', 't'], budget: ['v', 'd'] };
/** Ordre d'affichage d'un niveau (epics d'abord) */
const RANG: Record<string, number> = { e: 0, q: 1, f: 2, o: 3, r: 4, t: 5, v: 6, d: 7 };
const ICONE: Record<string, string> = { e: '🗂️ ', f: '🧩 ', q: '🎯 ', o: '🎯 ', r: '📏 ', v: '💶 ', d: '💶 ' };
const LIB_DEMANDE: Record<string, string> = { soumise: 'soumise', accordee: 'accordée', a_reprendre: 'à reprendre', refusee: 'refusée' };

interface Noeud {
  cle: string;
  enfants: Noeud[];
  /** Ajouté pour le contexte (parent d'un élément de la réunion), pas un élément de la réunion lui-même */
  contexte: boolean;
}

const euros = (v: string) => eurosTexte(v);

/**
 * Parent d'un nœud (clé), d'après les sources ; '' s'il n'en a pas. Budget (14/10) : une enveloppe de train sous celle
 * de son portfolio (même année), une demande sous l'enveloppe de sa destination (année de la demande, sinon la plus récente)
 */
function parentDe(cle: string, av: Avancement, portfolioDuTrain?: (train: string) => string): string {
  const [p, id] = [cle.slice(0, 1), cle.slice(2)];
  const src = av.sources;
  if (p === 'v') {
    const v = src.enveloppes?.find((x) => x.id === id);
    const pf = v?.niveau.startsWith('train:') && portfolioDuTrain ? portfolioDuTrain(v.niveau.slice(6)) : '';
    const haut = pf ? src.enveloppes?.find((x) => x.niveau === `portfolio:${pf}` && x.annee === v!.annee) : undefined;
    return haut ? `v:${haut.id}` : '';
  }
  if (p === 'd') {
    const d = src.demandes?.find((x) => x.id === id);
    if (!d) return '';
    const annee = (d.du || '').slice(0, 4);
    const env = (src.enveloppes ?? []).filter((x) => x.niveau === d.destination).sort((a, b) => b.annee.localeCompare(a.annee));
    const e = env.find((x) => x.annee === annee) ?? env[0];
    return e ? `v:${e.id}` : '';
  }
  if (p === 't') {
    const t = src.items.find((x) => x.id === id);
    if (!t) return '';
    if (t.parent && src.items.some((x) => x.id === t.parent)) return `t:${t.parent}`;
    if (t.feature && src.featureList?.some((x) => x.id === t.feature)) return `f:${t.feature}`;
    if (t.epic && src.epicList?.some((x) => x.id === t.epic)) return `e:${t.epic}`;
    if (t.objectif && src.objectifList?.some((x) => x.id === t.objectif)) return `o:${t.objectif}`;
    return '';
  }
  if (p === 'f') {
    const f = src.featureList?.find((x) => x.id === id);
    return f?.epic && src.epicList?.some((x) => x.id === f.epic) ? `e:${f.epic}` : '';
  }
  if (p === 'r') {
    const r = src.resultats?.find((x) => x.id === id);
    return r?.objectif ? `o:${r.objectif}` : '';
  }
  return '';
}

/** Arbre à partir des clés de la réunion, en remontant vers les parents (contexte) */
export function construireArbre(cles: string[], av: Avancement, famille: FamilleArbre, strict?: boolean, portfolioDuTrain?: (train: string) => string): Noeud[] {
  const ok = (k: string) => PREFIXES[famille].includes(k.slice(0, 1));
  const propres = new Set(cles.filter(ok));
  const noeuds = new Map<string, Noeud>();
  const parent = new Map<string, string>();
  const ajouter = (k: string, contexte: boolean): Noeud => {
    const deja = noeuds.get(k);
    if (deja) {
      if (!contexte) deja.contexte = false;
      return deja;
    }
    const n: Noeud = { cle: k, enfants: [], contexte };
    noeuds.set(k, n);
    const p = parentDe(k, av, portfolioDuTrain);
    if (p) {
      parent.set(k, p);
      // Parent dans la photo de la réunion : un élément de la réunion (ses changements comptent) ; au tour de table
      // (`strict`), seulement le contexte des éléments du membre
      ajouter(p, !propres.has(p) && (!!strict || !(p in av.actuelle)));
    }
    return n;
  };
  for (const k of propres) ajouter(k, false);
  const racines: Noeud[] = [];
  for (const [k, n] of noeuds) {
    const p = parent.get(k);
    if (p && noeuds.has(p)) noeuds.get(p)!.enfants.push(n);
    else racines.push(n);
  }
  const trier = (l: Noeud[]) => {
    l.sort((a, b) => RANG[a.cle[0]] - RANG[b.cle[0]] || av.titreDe(a.cle).localeCompare(av.titreDe(b.cle)));
    l.forEach((n) => trier(n.enfants));
  };
  trier(racines);
  return racines;
}

/**
 * Clés de la réunion dans une famille (la photo actuelle), selon son niveau : équipe = tâches, stories (et leurs
 * features, epics) ; train = features, objectifs du PI (et leurs epics) ; portfolio = epics et OKR ; perso = tâches
 * et objectifs
 */
export function clesDe(av: Avancement, famille: FamilleArbre, perso?: boolean): string[] {
  const focus = focusDe(av.type);
  const niveau = famille === 'budget' ? PREFIXES.budget : perso ? ['t', 'o', 'r'] : focus === 0 ? ['t'] : focus === 1 ? ['f', 'q'] : focus === 2 ? ['e', 'o', 'r'] : ['o', 'r', 'e'];
  const changees = new Set((av.lignes ?? []).map((l) => l.cle));
  // Perso : les tâches pas terminées, et celles qui ont changé depuis la réunion précédente (pas tout l'historique)
  const garder = (k: string) => !perso || !k.startsWith('t:') || changees.has(k) || av.itemDe(k)?.statut !== 'termine';
  return Object.keys(av.actuelle).filter((k) => niveau.includes(k.slice(0, 1)) && garder(k));
}

const compter = (l: Noeud[], f: (n: Noeud) => boolean): number => l.reduce((s, n) => s + (f(n) ? 1 : 0) + compter(n.enfants, f), 0);

/**
 * Bloc d'un arbre : titre (touchable : ouvre et ferme le bloc) avec son nombre d'éléments et de changés, pastille
 * « Filtres » (filtre partagé de la réunion), arbre ouvert à tous les niveaux (chaque niveau se ferme par ▾).
 * `cases` : tour de table, la case « je travaille dessus aujourd'hui » sur les tâches et stories (jamais le statut).
 */
export function BlocArbre({
  av,
  titre,
  famille = 'elements',
  cles,
  fermeAuDepart,
  perso,
  nom,
  montrerResponsable,
  cases,
  strict,
  actions,
  sousEnPlus,
  pastilleDe: pastilleImposee,
  lecture,
  onOuvrir,
  onOuvrirEntite,
}: {
  /** Boutons sous la ligne d'un élément (accepter, décision…), 14/10 : listes à actions dans l'arbre */
  actions?: (t: Item) => ReactNode;
  /** Information ajoutée à la sous-ligne d'un élément */
  sousEnPlus?: (t: Item) => string;
  /** Pastille imposée pour un élément (ex. « trop grosse ») */
  pastilleDe?: (t: Item) => { texte: string; ton: 'bleu' | 'vert' | 'rouge' | 'orange' | 'gris' } | undefined;
  /** Tour de table : les parents (feature, epic) ne sont que le contexte des éléments du membre */
  strict?: boolean;
  av: Avancement;
  titre: string;
  famille?: FamilleArbre;
  /** Éléments de la réunion (clés « t:id »…) ; par défaut, toute la photo actuelle de la famille */
  cles?: string[];
  fermeAuDepart?: boolean;
  /** Réunion perso : tâches et objectifs */
  perso?: boolean;
  nom: (idOuMail: string) => string;
  montrerResponsable?: boolean;
  cases?: { coche: (t: Item) => boolean; basculer: (t: Item) => void; fige?: boolean };
  lecture?: boolean;
  onOuvrir?: (t: Item) => void;
  onOuvrirEntite?: (kind: 'feature' | 'epic' | 'objectif', id: string) => void;
}) {
  const org = useOrg();
  // Responsable : id de personne (Organisation) ou adresse ; un identifiant inconnu n'est pas affiché
  const nomComplet = (x: string) => org.personnes.find((y) => y.id === x)?.nom ?? (x.includes('@') ? nom(x) : '');
  const [fermes, setFermes] = useState<Set<string>>(new Set());
  /** Case « Arborescence » (14/10) : cochée par défaut ; décochée, seulement la liste des éléments du bloc, à plat */
  const [arbo, setArbo] = useState(true);
  const lesCles = cles ?? clesDe(av, famille, perso);
  const cleListe = lesCles.join(',');
  const racines = useMemo(() => {
    const arbre = construireArbre(lesCles, av, famille, strict, (t) => org.trains.find((x) => x.id === t)?.portfolio ?? '');
    if (arbo) return arbre;
    const propres = new Set(lesCles);
    // À plat : les éléments du bloc seulement (sans leurs parents : feature, epic), dans l'ordre de l'arbre
    const plats: Noeud[] = [];
    const v = (n: Noeud) => {
      if (propres.has(n.cle)) plats.push({ ...n, enfants: [] });
      n.enfants.forEach(v);
    };
    arbre.forEach(v);
    return plats;
  }, [cleListe, av.sources, famille, strict, arbo]); // eslint-disable-line react-hooks/exhaustive-deps
  const mode = av.filtre.mode;
  // Changements visibles (filtre de sorte, type, seuil) par élément
  const parCle = useMemo(() => {
    const m = new Map<string, LigneAv[]>();
    for (const l of av.vues) m.set(l.cle, [...(m.get(l.cle) ?? []), l]);
    return m;
  }, [av.vues]);
  const change = (n: Noeud) => !n.contexte && (parCle.get(n.cle)?.length ?? 0) > 0;
  const garde = (n: Noeud): boolean => change(n) || n.enfants.some(garde);
  const arboUtile = useMemo(() => construireArbre(lesCles, av, famille, strict, (t) => org.trains.find((x) => x.id === t)?.portfolio ?? '').some((n) => n.enfants.length > 0), [cleListe, av.sources, famille, strict]); // eslint-disable-line react-hooks/exhaustive-deps
  const dansBloc = useMemo(() => {
    const x = new Set<string>();
    const v = (n: Noeud) => {
      if (!n.contexte) x.add(n.cle);
      n.enfants.forEach(v);
    };
    racines.forEach(v);
    return x;
  }, [racines]);
  const lignesBloc = (av.lignes ?? []).filter((l) => dansBloc.has(l.cle));
  const nTous = compter(racines, (n) => !n.contexte);
  const nChanges = compter(racines, change);

  const src = av.sources;
  const sousDe = (k: string): string => {
    const [p, id] = [k.slice(0, 1), k.slice(2)];
    if (p === 't') {
      const t = src.items.find((x) => x.id === id);
      if (!t) return '';
      const genre = t.type === 'story' ? `${Number(t.points) || 0} points` : t.parent ? 'Sous-tâche' : t.points ? `Tâche · ${t.points} points` : 'Tâche';
      return [genre, montrerResponsable && t.responsable ? nomComplet(t.responsable) : '', sousEnPlus?.(t) ?? ''].filter(Boolean).join(' · ');
    }
    if (p === 'f') {
      const st2 = src.items.filter((x) => x.feature === id && !x.parent);
      const faites = st2.filter((x) => x.statut === 'termine');
      const pts = (l: Item[]) => l.reduce((s, x) => s + (Number(x.points) || 0), 0);
      return st2.length ? `Feature · ${faites.length} sur ${st2.length} terminée${faites.length > 1 ? 's' : ''} · ${pts(faites)} / ${pts(st2)} points` : 'Feature';
    }
    if (p === 'e') {
      const e = src.epicList?.find((x) => x.id === id);
      return ['Epic', e?.budget ? `${euros(e.budget)} prévus` : ''].filter(Boolean).join(' · ');
    }
    if (p === 'q') {
      const o = src.objectifsPI?.find((x) => x.id === id);
      return `Objectif du PI · ${o?.valeur_obtenue || '—'} sur ${o?.valeur_prevue || 10}`;
    }
    if (p === 'o') {
      const o = src.objectifList?.find((x) => x.id === id);
      return o ? `Objectif · ${o.actuel || '0'}${o.cible ? ` / ${o.cible}` : ''}${o.unite ? ` ${o.unite}` : ''}` : 'Objectif';
    }
    if (p === 'r') {
      const r = src.resultats?.find((x) => x.id === id);
      return r ? `Résultat clé · ${r.actuel || '0'}${r.cible ? ` / ${r.cible}` : ''}${r.unite ? ` ${r.unite}` : ''}` : '';
    }
    if (p === 'v') return euros(src.enveloppes?.find((x) => x.id === id)?.montant ?? '');
    if (p === 'd') {
      const d = src.demandes?.find((x) => x.id === id);
      return d ? `${euros(d.statut === 'accordee' ? d.montant_accorde || d.montant : d.montant)} · ${LIB_DEMANDE[d.statut] ?? d.statut}` : '';
    }
    return '';
  };
  const pastilleDe = (k: string) => {
    const [p, id] = [k.slice(0, 1), k.slice(2)];
    if (p === 'f') {
      const s = statutFeature({ id }, src.items);
      return s ? pastilleStatut(s as Item['statut']) : undefined;
    }
    if (p === 'e') {
      const e = src.epicList?.find((x) => x.id === id);
      const l = ETATS_EPIC.find((x) => x.value === e?.etat)?.label;
      return l ? { texte: l.toLowerCase(), ton: e?.etat === 'termine' ? ('vert' as const) : e?.etat === 'en_cours' ? ('bleu' as const) : ('gris' as const) } : undefined;
    }
    return undefined;
  };
  const KIND: Record<string, 'feature' | 'epic' | 'objectif'> = { f: 'feature', e: 'epic', o: 'objectif' };

  const rendre = (n: Noeud, profondeur: number, premier: boolean): React.ReactNode => {
    if (mode === 'changes' && !garde(n)) return null;
    const t = av.itemDe(n.cle);
    const ch = parCle.get(n.cle) ?? [];
    const gris = n.contexte || (mode === 'changes' && !change(n));
    const ferme = fermes.has(n.cle);
    const aEnfants = n.enfants.some((x) => mode !== 'changes' || garde(x));
    const k = KIND[n.cle[0]];
    const ouvrir = lecture ? undefined : t && onOuvrir ? () => onOuvrir(t) : k && onOuvrirEntite ? () => onOuvrirEntite(k, n.cle.slice(2)) : undefined;
    // Enveloppe : son niveau après l'année (« Enveloppe 2026 · train Clients »)
    const niveauV = n.cle[0] === 'v' ? av.sources.enveloppes?.find((x) => x.id === n.cle.slice(2))?.niveau ?? '' : '';
    const [kindV, idV] = niveauV.split(':');
    const nomV = kindV === 'train' ? `train ${org.trains.find((x) => x.id === idV)?.nom ?? ''}` : kindV === 'portfolio' ? `portfolio ${org.portfolios.find((x) => x.id === idV)?.nom ?? ''}` : kindV === 'equipeagile' ? `équipe ${org.equipes.find((x) => x.id === idV)?.nom ?? ''}` : kindV === 'entreprise' ? 'entreprise' : '';
    const texte = `${ICONE[n.cle[0]] ?? (t?.type === 'story' ? '📖 ' : '')}${av.titreDe(n.cle)}${nomV ? ` · ${nomV}` : ''}`;
    const p = pastilleDe(n.cle);
    const avecCase = !!cases && !!t && !n.contexte;
    const enfants = n.enfants.map((x) => rendre(x, profondeur + 1, false));
    return (
      <View key={n.cle}>
        <View style={[st.ligne, !premier && st.bord, { paddingLeft: 8 + profondeur * 14, gap: 8 }]}>
          <Pressable onPress={() => setFermes((s) => { const x = new Set(s); x.has(n.cle) ? x.delete(n.cle) : x.add(n.cle); return x; })} disabled={!aEnfants} hitSlop={8} accessibilityRole="button" accessibilityLabel={aEnfants ? `${ferme ? 'Ouvrir' : 'Fermer'} « ${texte} »` : undefined} style={{ width: 14 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{aEnfants ? (ferme ? '›' : '▾') : ''}</Text>
          </Pressable>
          {avecCase && (
            <Pressable onPress={() => cases!.basculer(t!)} disabled={cases!.fige || lecture} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: cases!.coche(t!), disabled: !!cases!.fige }} accessibilityLabel={texte}>
              <Text style={[st.caseACocher, cases!.coche(t!) && st.caseCochee, cases!.fige && !cases!.coche(t!) && st.caseFigee]}>{cases!.coche(t!) ? '✓' : ''}</Text>
            </Pressable>
          )}
          <Pressable onPress={ouvrir} disabled={!ouvrir} style={st.ligneCorps} accessibilityRole={ouvrir ? 'button' : undefined}>
            <View style={st.corps}>
              <Text style={[st.texte, gris && { color: colors.muted }]}>
                {mode === 'elements' && change(n) ? <Text style={{ color: colors.primary }}>● </Text> : null}
                {texte}
              </Text>
              {!!sousDe(n.cle) && <Text style={st.sous}>{sousDe(n.cle)}</Text>}
              {mode !== 'elements' &&
                !n.contexte &&
                ch.map((l) => (
                  <Text key={l.sorte} style={[st.sous, { color: l.sorte === 'ajoute' ? '#137333' : colors.primary }]}>
                    ↳ {l.sorte === 'ajoute' ? '🆕 ' : ''}
                    {phrase(l, nomComplet)}
                  </Text>
                ))}
              {t && !n.contexte && actions ? <View style={{ marginTop: 6 }}>{actions(t)}</View> : null}
            </View>
            {t && pastilleImposee?.(t) ? <Pastille {...pastilleImposee(t)!} /> : t && !lecture ? <PastilleStatut t={t} /> : t ? <Pastille {...pastilleStatut(t.statut)} /> : p ? <Pastille {...p} /> : null}
            {ouvrir && <Text style={st.chevron}>›</Text>}
          </Pressable>
        </View>
        {!ferme && enfants}
      </View>
    );
  };

  const corps = racines.map((n, i) => rendre(n, 0, i === 0)).filter(Boolean);
  // Coque commune des briques : titre « Éléments du sprint (12) (5 changés) », carte blanche, ouverture, case, filtres
  return (
    <BlocBrique
      titre={titre}
      n={nTous}
      nChanges={av.lignes ? nChanges : null}
      fermeAuDepart={fermeAuDepart}
      // Case 🌳 seulement quand elle change quelque chose (au moins un élément a un parent)
      arborescence={arboUtile ? { valeur: arbo, changer: setArbo } : undefined}
      filtres={av.lignes && lignesBloc.length > 0 ? { nb: nbFiltresAv(av.filtre), contenu: <FiltreAvancement av={av} lignes={lignesBloc} lecture={lecture} sansTypes /> } : undefined}
    >
      {corps.length ? corps : <Vide texte={mode === 'changes' ? (av.lignes ? 'Rien n’a changé.' : 'Les changements seront visibles à partir de la prochaine réunion.') : 'Rien à afficher.'} />}
    </BlocBrique>
  );
}

/** Changements d'un suivi (clé « s:id ») pour la ligne du suivi : point bleu, lignes ↳, ou rien selon l'affichage */
export function changementsSuivi(av: Avancement, id: string, nom: (x: string) => string): { point: boolean; lignes: string[]; garder: boolean } {
  const ch = av.vues.filter((l) => l.cle === `s:${id}`);
  const mode = av.filtre.mode;
  return { point: mode === 'elements' && ch.length > 0, lignes: mode === 'elements' ? [] : ch.map((l) => phrase(l, nom)), garder: mode !== 'changes' || ch.length > 0 };
}

/** Rangée « Éléments · Avec changements · Changés seulement » (filtre partagé de la réunion), pour les blocs de suivis */
export function ModeAffichage({ av, lecture }: { av: Avancement; lecture?: boolean }) {
  if (!av.lignes) return null;
  return (
    <View style={{ marginBottom: 6 }}>
      <RangeePastilles<ModeAv> options={MODES_AV.map((m) => ({ value: m.v, label: m.l }))} value={av.filtre.mode} onChange={(v) => av.setFiltre({ ...av.filtre, mode: v })} inactif={lecture} />
    </View>
  );
}

/** Nombre de suivis qui ont changé depuis la réunion précédente (titre de la brique Suivis) ; null : première réunion */
export const nbSuivisChanges = (av: Avancement, points: { id: string }[]): number | null => (av.lignes ? points.filter((p) => av.lignes!.some((l) => l.cle === `s:${p.id}`)).length : null);
