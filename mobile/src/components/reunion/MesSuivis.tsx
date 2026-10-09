import { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { libelleNote, estFermee, mesSuivis, reunionDeNote } from '../../daily';
import { useHierarchy } from '../../hierarchyContext';
import { jourCourt } from '../../pointsSuivi';
import type { PointReunion } from '../../types';
import { SectionFiche } from '../Choix';
import { FormSheet, TitreFiche } from '../FormSheet';
import { Segmented } from '../Segmented';
import { statutAffiche } from './Suivi';
import { Ligne, Vide } from './ui';
import { colors } from '../../theme';

/**
 * 📌 Mes suivis (lot 5, validé le 09/10, docs/maquette-budget.html écran 13) : dans l'onglet Réunions, toutes les
 * notes où vous êtes responsable, valideur ou auteur, dans toutes vos réunions. Ouvertes : à concrétiser, en cours,
 * faites (à valider), à reprendre, en retard. Fermées : validées ou abandonnées, gardées jusqu'à leur suppression.
 * Une lecture des notes par espace (groupée par l'application).
 */

export function MesSuivis({ visible, espaces, moi, nomDe, aujourdhui, lirePoints, onFermer }: { visible: boolean; espaces: string[]; moi: string; nomDe: (m: string) => string; aujourdhui: string; lirePoints: (espace: string, prefixe: string) => Promise<PointReunion[]>; onFermer: () => void }) {
  const h = useHierarchy();
  const [points, setPoints] = useState<PointReunion[] | null>(null);
  const [vue, setVue] = useState<'ouvertes' | 'fermees'>('ouvertes');
  const cle = espaces.join('|');
  useEffect(() => {
    if (!visible) return;
    let vivant = true;
    setPoints(null);
    Promise.allSettled(espaces.map((e) => lirePoints(e, '').then((l) => l.map((p) => ({ ...p, espace: p.espace || e })))))
      .then((r) => vivant && setPoints(r.flatMap((x) => (x.status === 'fulfilled' ? x.value : []))))
      .catch(() => vivant && setPoints([]));
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, cle, lirePoints]);
  const { ouvertes, fermees } = useMemo(() => mesSuivis(points ?? [], moi), [points, moi]);
  const nom = (m: string) => (m.toLowerCase() === moi.toLowerCase() ? 'Vous' : nomDe(m));
  const sous = (p: PointReunion) =>
    [
      reunionDeNote(p),
      p.statut ? (p.responsable ? `Responsable : ${nom(p.responsable)}` : '') : `notée par ${nom(p.auteur || p.personne)}`,
      p.validateur ? `Validation : ${nom(p.validateur)}` : '',
      p.echeance ? `Échéance : ${jourCourt(p.echeance)}` : '',
      estFermee(p) && p.note ? (p.statut === 'abandonne' ? `Motif : ${p.note}` : p.note) : '',
    ]
      .filter(Boolean)
      .join(' · ');
  const pastille = (p: PointReunion) => {
    if (!p.statut) return { texte: 'À concrétiser', ton: 'bleu' as const };
    const a = statutAffiche(p, h.items, aujourdhui);
    return a.s === 'fait' && a.texte === 'Fait' ? { texte: 'À valider', ton: 'orange' as const } : { texte: a.texte, ton: a.ton };
  };
  const liste = vue === 'ouvertes' ? ouvertes : fermees;
  return (
    <FormSheet visible={visible} title="Mes suivis" busy={false} error={null} onClose={onFermer} superpose>
      <TitreFiche icone="📌" titre="Mes suivis" vide="" sous="Vous êtes responsable, valideur ou auteur · toutes vos réunions" />
      <Segmented
        options={[
          { value: 'ouvertes', label: `Ouvertes · ${ouvertes.length}` },
          { value: 'fermees', label: `Fermées · ${fermees.length}` },
        ]}
        value={vue}
        onChange={setVue}
      />
      <SectionFiche titre={vue === 'ouvertes' ? 'Ouvertes' : 'Fermées (gardées jusqu’à leur suppression)'}>
        {points === null ? (
          <Vide texte="Lecture des notes…" />
        ) : liste.length ? (
          liste.map((p, i) => <Ligne key={p.id} premiere={i === 0} texte={`${libelleNote(p)} · ${p.texte}`} sous={sous(p)} pastille={pastille(p)} />)
        ) : (
          <Vide texte={vue === 'ouvertes' ? '✓ Rien d’ouvert pour vous.' : 'Aucun suivi fermé.'} />
        )}
      </SectionFiche>
      <Text style={{ fontSize: 12.5, color: colors.muted, paddingHorizontal: 16, paddingTop: 8 }}>Une note se traite dans sa réunion (ou depuis le Chat : « ✅ Valider »). Fermée, elle reste ici jusqu’à sa suppression à la réunion de clôture.</Text>
    </FormSheet>
  );
}
