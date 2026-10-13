/**
 * Bloc « Avancement depuis … » (13/10, docs/regles-reunions.html bloc 13) : en première étape (entre les éléments et
 * « 📌 Suivis ») et dans le compte rendu, avec le même filtre (sorte, niveau).
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  comparer,
  depuis,
  estFiltre,
  FILTRE_TOUT,
  type FiltreAv,
  filtrer,
  focusDe,
  iconeNiveau,
  type LigneAv,
  messagePremiere,
  NIVEAUX_AV,
  type Perimetre,
  photoDe,
  photoDeLaReunion,
  photoPrecedente,
  photoPrecedenteAvec,
  phrase,
  pointsPhoto,
  SORTES_AV,
} from '../../avancement';
import type { DemandeBudget, Enveloppe, Epic, Feature, Item, Objectif, ObjectifPI, PointReunion, ResultatCle, TypeReunion } from '../../types';
import { useOrg } from '../../organisation';
import { LIBELLE_TYPE_POINT, libelleNote } from '../../daily';
import { SectionFiche } from '../Choix';
import { Ligne, PastilleFiltres, st, Vide } from './ui';

export interface Avancement {
  type: TypeReunion;
  /** null : pas encore de photo (première réunion) */
  lignes: LigneAv[] | null;
  vues: LigneAv[];
  titre: string;
  filtre: FiltreAv;
  setFiltre: (f: FiltreAv) => void;
  /** Lignes à écrire à l'envoi (photo) et anciennes lignes de cette réunion à retirer */
  envoi: (personne: string, patches?: (Partial<Item> & { id: string })[]) => { creer: Omit<PointReunion, 'id' | 'cree_le'>[]; retirer: string[] };
  /** Titre et élément d'une clé ; type de note d'un point de suivi */
  titreDe: (cle: string) => string;
  typeDe: (cle: string) => string;
  itemDe: (cle: string) => Item | undefined;
}

interface Sources {
  items: Item[];
  featureList?: Feature[];
  epicList?: Epic[];
  objectifList?: Objectif[];
  resultats?: ResultatCle[];
  objectifsPI?: ObjectifPI[];
  enveloppes?: Enveloppe[];
  demandes?: DemandeBudget[];
  points?: PointReunion[];
}

/**
 * Avancement d'une réunion : `points` contient les lignes des réunions précédentes (photos), `prefixes` les séries à
 * regarder (la sienne ; en perso, Point perso et Bilan du soir), `perimetre` ce que la réunion montre (règle A4).
 * `lecture` : compte rendu déjà envoyé, comparé à la photo de son envoi avec le filtre de ce moment-là.
 */
export function useAvancement(o: {
  type: TypeReunion;
  reunion: string;
  prefixes: string[];
  points: PointReunion[];
  perimetre: Perimetre;
  sources: Sources;
  lecture?: boolean;
  /** En perso : photos des Dailies de mes équipes, qui complètent ma réunion précédente (photoPrecedenteAvec) */
  complements?: PointReunion[];
}): Avancement {
  const { type, reunion, prefixes, points, perimetre, sources, lecture, complements } = o;
  const focus = focusDe(type);
  const [filtreLocal, setFiltre] = useState<FiltreAv>(FILTRE_TOUT);
  const cle = prefixes.join(',');
  const prec = useMemo(() => (complements ? photoPrecedenteAvec(points, reunion, prefixes, complements) : photoPrecedente(points, reunion, prefixes)), [points, reunion, cle, complements]); // eslint-disable-line react-hooks/exhaustive-deps
  const envoyee = useMemo(() => photoDeLaReunion(points, reunion), [points, reunion]);
  const actuelle = useMemo(() => photoDe(perimetre, focus), [perimetre, focus]);
  const lu = lecture && envoyee;
  const apres = lu ? envoyee.photo : actuelle;
  const filtre = lu ? envoyee.filtre : filtreLocal;
  const lignes = useMemo(() => (prec ? comparer(prec.photo, apres, focus) : null), [prec, apres, focus]);
  /** Type de note d'un point de suivi (Risque, Blocage…) */
  const typeDe = (k: string) => (k.startsWith('s:') ? (sources.points?.find((x) => x.id === k.slice(2))?.type ?? '') : '');
  const vues = useMemo(() => (lignes ? filtrer(lignes, filtre, typeDe) : []), [lignes, filtre, sources.points]); // eslint-disable-line react-hooks/exhaustive-deps
  const titreDe = (k: string) => {
    const [p, id] = [k.slice(0, 1), k.slice(2)];
    if (p === 't') return sources.items.find((x) => x.id === id)?.titre ?? 'Élément supprimé';
    if (p === 'f') return sources.featureList?.find((x) => x.id === id)?.titre ?? 'Feature supprimée';
    if (p === 'q') return sources.objectifsPI?.find((x) => x.id === id)?.titre ?? 'Objectif du PI supprimé';
    if (p === 'e') return sources.epicList?.find((x) => x.id === id)?.titre ?? 'Epic supprimée';
    if (p === 'o') return sources.objectifList?.find((x) => x.id === id)?.titre ?? 'Objectif supprimé';
    if (p === 'r') {
      const r = sources.resultats?.find((x) => x.id === id);
      const okr = r ? sources.objectifList?.find((x) => x.id === r.objectif)?.titre : '';
      return r ? `${okr ? `${okr} · ` : ''}${r.titre}${r.unite ? ` (${r.unite})` : ''}` : 'Résultat clé supprimé';
    }
    if (p === 'v') {
      const e = sources.enveloppes?.find((x) => x.id === id);
      return e ? `Enveloppe ${e.annee}` : 'Enveloppe supprimée';
    }
    if (p === 'd') return sources.demandes?.find((x) => x.id === id)?.motif ?? 'Demande supprimée';
    if (p === 's') {
      // « Risque · Retard du fournisseur » : le type de la note devant son texte
      const pt = sources.points?.find((x) => x.id === id);
      return pt ? `${libelleNote(pt)} · ${pt.texte}` : 'Suivi supprimé';
    }
    return k;
  };
  return {
    type,
    lignes,
    vues,
    titre: prec ? `Avancement ${depuis(prec.reunion)}` : 'Avancement',
    filtre,
    setFiltre,
    // `patches` : changements faits par la réunion elle-même à l'envoi (dates, stories acceptées…), déjà dans la photo
    envoi: (personne, patches) => {
      const avec = (l?: Item[]) => l?.map((t) => ({ ...t, ...(patches?.find((x) => x.id === t.id) ?? {}) }));
      const photo = patches?.length ? photoDe({ ...perimetre, items: avec(perimetre.items), tousItems: avec(perimetre.tousItems) }, focus) : actuelle;
      return { creer: pointsPhoto(reunion, personne, photo, filtreLocal), retirer: envoyee?.ids ?? [] };
    },
    titreDe,
    typeDe,
    itemDe: (k) => (k.startsWith('t:') ? sources.items.find((x) => x.id === k.slice(2)) : undefined),
  };
}

const bascule = <T,>(liste: T[], v: T) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]);

/** Rangées du filtre : sorte puis niveau, avec leur nombre (seuls les niveaux présents) */
function Filtre({ av, lecture }: { av: Avancement; lecture?: boolean }) {
  const toutes = av.lignes ?? [];
  const niveaux = NIVEAUX_AV.filter((n) => toutes.some((l) => l.niveau === n.v));
  // Type de note des points de suivi (Risque, Blocage, Demande d'action…), s'il y en a
  const suivis = toutes.filter((l) => l.niveau === 'suivi');
  const types = [...new Set(suivis.map((l) => av.typeDe(l.cle)).filter(Boolean))];
  const rangee = (cles: { v: string; l: string; n: number; off: boolean; onPress: () => void }[]) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filtreLigne}>
      {cles.map((c) => (
        <Pressable key={c.v} disabled={lecture} onPress={c.onPress} style={[st.itChip, !c.off && st.itChipOn]} accessibilityRole="checkbox" accessibilityState={{ checked: !c.off }}>
          <Text style={[st.itChipText, !c.off && st.itChipTextOn]}>{`${c.l} · ${c.n}`}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
  return (
    <View style={[st.filtresBloc, { gap: 6 }]}>
      {rangee(SORTES_AV.map((s) => ({ v: s.v, l: s.l, n: toutes.filter((l) => l.sorte === s.v).length, off: av.filtre.sortes.includes(s.v), onPress: () => av.setFiltre({ ...av.filtre, sortes: bascule(av.filtre.sortes, s.v) }) })))}
      {niveaux.length > 1 && rangee(niveaux.map((n) => ({ v: n.v, l: n.l, n: toutes.filter((l) => l.niveau === n.v).length, off: av.filtre.niveaux.includes(n.v), onPress: () => av.setFiltre({ ...av.filtre, niveaux: bascule(av.filtre.niveaux, n.v) }) })))}
      {types.length > 0 &&
        rangee(types.map((t) => ({ v: t, l: LIBELLE_TYPE_POINT[t as keyof typeof LIBELLE_TYPE_POINT] ?? t, n: suivis.filter((l) => av.typeDe(l.cle) === t).length, off: !!av.filtre.types?.includes(t), onPress: () => av.setFiltre({ ...av.filtre, types: bascule(av.filtre.types ?? [], t) }) })))}
    </View>
  );
}

/**
 * Bloc Avancement. `compteRendu` : section du compte rendu (filtre fermé, ouvert d'office si filtré, règle A6).
 * Toucher une ligne ouvre la fiche de l'élément ; la pastille de statut se change sur place (règle A7).
 */
export function BlocAvancement({
  av,
  nom,
  compteRendu,
  lecture,
  onOuvrir,
  onOuvrirEntite,
}: {
  av: Avancement;
  nom: (idOuMail: string) => string;
  compteRendu?: boolean;
  lecture?: boolean;
  onOuvrir?: (t: Item) => void;
  onOuvrirEntite?: (kind: 'feature' | 'epic' | 'objectif', id: string) => void;
}) {
  // Responsable d'un élément : id de personne (Organisation) ; d'un suivi : adresse e-mail
  const org = useOrg();
  const nomComplet = (x: string) => org.personnes.find((y) => y.id === x)?.nom ?? nom(x);
  // Feature, epic, objectif : leur fiche (un objectif du PI, une enveloppe, une demande ou un suivi n'en ont pas ici)
  const KIND: Record<string, 'feature' | 'epic' | 'objectif'> = { f: 'feature', e: 'epic', o: 'objectif' };
  const ouvrirEntite = (cle: string) => {
    const k = KIND[cle.slice(0, 1)];
    return k && onOuvrirEntite ? () => onOuvrirEntite(k, cle.slice(2)) : undefined;
  };
  const filtre = estFiltre(av.filtre);
  const [ouvert, setOuvert] = useState(compteRendu ? filtre : false);
  if (!av.lignes) {
    return (
      <SectionFiche titre="Avancement">
        <Vide texte={messagePremiere(av.type)} />
      </SectionFiche>
    );
  }
  return (
    <SectionFiche
      titre={`${av.titre} · ${av.vues.length}`}
      droite={av.lignes.length ? <PastilleFiltres actif={filtre} ouvert={ouvert} onPress={() => setOuvert((x) => !x)} /> : undefined}
      entete={ouvert && av.lignes.length ? <Filtre av={av} lecture={lecture} /> : undefined}
    >
      {av.vues.length ? (
        av.vues.map((l, i) => {
          const t = av.itemDe(l.cle);
          return (
            <Ligne
              key={`${l.cle}-${l.sorte}`}
              premiere={i === 0}
              texte={`${l.cle.startsWith('q:') ? '🎯 ' : iconeNiveau(l.niveau)}${av.titreDe(l.cle)}`}
              sous={phrase(l, nomComplet)}
              tache={!lecture && t ? t : undefined}
              onOuvrir={lecture ? undefined : t && onOuvrir ? () => onOuvrir(t) : ouvrirEntite(l.cle)}
            />
          );
        })
      ) : (
        <Vide texte={av.lignes.length ? 'Rien à afficher avec ce filtre.' : 'Rien n’a bougé.'} />
      )}
    </SectionFiche>
  );
}
