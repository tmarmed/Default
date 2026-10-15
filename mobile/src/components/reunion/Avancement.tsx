/**
 * Avancement depuis la réunion précédente (13/10, docs/regles-reunions.html bloc 13) : photos et comparaison
 * (useAvancement) et rangées du filtre (FiltreAvancement). L'affichage passe par l'arbre des éléments (Arbre.tsx) ;
 * l'ancien bloc « Avancement » a été retiré le 15/10 (plus utilisé).
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { RangeePastilles } from '../RangeePastilles';
import {
  comparer,
  depuis,
  FILTRE_TOUT,
  type FiltreAv,
  filtrer,
  focusDe,
  type LigneAv,
  type Perimetre,
  photoDe,
  photoDeLaReunion,
  photoPrecedente,
  photoPrecedenteAvec,
  pointsPhoto,
  SEUILS_AV,
  type ModeAv,
  MODES_AV,
  type SorteAv,
  SORTES_AV,
} from '../../avancement';
import type { DemandeBudget, Enveloppe, Epic, Feature, Item, Objectif, ObjectifPI, PointReunion, ResultatCle, TypeReunion } from '../../types';
import { LIBELLE_TYPE_POINT, libelleNote } from '../../daily';
import { st } from './ui';

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
  /** Situation actuelle (photo) et sources : pour l'arbre des éléments (14/10) */
  actuelle: Record<string, string>;
  sources: Sources;
}

export interface Sources {
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
    actuelle: apres,
    sources,
  };
}

/** Rangée du filtre : la rangée de pastilles commune (« Tous » puis un seul choix) */
function Rangee<T extends string>({ options, value, onChange, lecture, tous = '' as T, libelleTous = 'Tous' }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; lecture?: boolean; tous?: T; libelleTous?: string }) {
  return <RangeePastilles options={[{ value: tous, label: libelleTous }, ...options]} value={value} onChange={onChange} inactif={lecture} />;
}

/**
 * Filtre (14/10) : l'affichage (Éléments · Avec changements · Changés seulement), puis, pour les changements, la sorte,
 * le type de note des suivis et le seuil des valeurs ; un seul choix par rangée
 */
export function FiltreAvancement({ av, lignes, lecture, sansTypes }: { av: Avancement; lignes: LigneAv[]; lecture?: boolean; sansTypes?: boolean }) {
  // Type de note des points de suivi (Risque, Blocage, Demande d'action…), s'il y en a
  const suivis = lignes.filter((l) => l.niveau === 'suivi');
  const types = sansTypes ? [] : [...new Set(suivis.map((l) => av.typeDe(l.cle)).filter(Boolean))];
  const f = av.filtre;
  return (
    <View style={[st.filtresBloc, { gap: 6 }]}>
      <RangeePastilles<ModeAv> options={MODES_AV.map((m) => ({ value: m.v, label: m.l }))} value={f.mode} onChange={(v) => av.setFiltre({ ...f, mode: v })} inactif={lecture} />
      {f.mode !== 'elements' && (
        <>
          <Rangee<SorteAv | ''> lecture={lecture} options={SORTES_AV.filter((x) => lignes.some((l) => l.sorte === x.v)).map((x) => ({ value: x.v, label: `${x.l} · ${lignes.filter((l) => l.sorte === x.v).length}` }))} value={f.sorte} onChange={(v) => av.setFiltre({ ...f, sorte: v })} libelleTous="Tous les changements" />
          {types.length > 0 && (
            <Rangee lecture={lecture} options={types.map((t) => ({ value: t, label: `${LIBELLE_TYPE_POINT[t as keyof typeof LIBELLE_TYPE_POINT] ?? t} · ${suivis.filter((l) => av.typeDe(l.cle) === t).length}` }))} value={f.type} onChange={(v) => av.setFiltre({ ...f, type: v })} />
          )}
          {lignes.some((l) => l.sorte === 'valeur') && (
            <Rangee lecture={lecture} tous="0" libelleTous="Seuil : tout changement" options={SEUILS_AV.filter((x) => x > 0).map((x) => ({ value: String(x), label: `≥ ${x} %` }))} value={String(f.seuil)} onChange={(v) => av.setFiltre({ ...f, seuil: Number(v) })} />
          )}
        </>
      )}
    </View>
  );
}

