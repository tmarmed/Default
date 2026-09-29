import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { domaineOf, epicOf, objectifOf } from '../hierarchy';
import { useHierarchy } from '../hierarchyContext';
import { colors } from '../theme';
import { Chips } from './Chips';
import { DomaineChoix } from './DomaineChoix';
import { Rattachement } from './Rattachement';

type Links = { feature?: string; epic?: string; objectif?: string; domaine?: string };

interface Props {
  /** Niveaux proposés, du plus précis au plus large */
  levels: ('feature' | 'epic' | 'objectif' | 'domaine')[];
  value: Links;
  onChange: (patch: Links) => void;
  /** « ＋ Nouvelle feature / epic / objectif / nouveau domaine » : la fiche s'ouvre par-dessus, l'élément créé est choisi */
  onNouveau?: (niveau: 'feature' | 'epic' | 'objectif' | 'domaine', defauts: Links) => void;
  /** Rattachement de l'élément enregistré : en choisir un autre est annoncé comme un déplacement */
  initial?: Links;
}

/** Lien le plus précis (« f:… », « e:… »…) pour comparer deux rattachements */
const precis = (v: Links) => (v.feature ? `f:${v.feature}` : v.epic ? `e:${v.epic}` : v.objectif ? `o:${v.objectif}` : v.domaine ? `d:${v.domaine}` : '');

const NOUVEAU = { feature: 'Nouvelle feature', epic: 'Nouvelle epic', objectif: 'Nouvel objectif', domaine: 'Nouveau domaine' } as const;
const VERS = { feature: 'Vers une nouvelle feature', epic: 'Vers une nouvelle epic', objectif: 'Vers un nouvel objectif', domaine: 'Vers un nouveau domaine' } as const;

/**
 * Rattachement à un niveau supérieur : on choisit le plus précis (epic, sinon objectif, sinon domaine) ;
 * les niveaux au-dessus s'en déduisent et sont simplement affichés.
 */
export function LinkPicker({ levels, value, onChange, onNouveau, initial }: Props) {
  const h = useHierarchy();
  const has = (l: 'feature' | 'epic' | 'objectif' | 'domaine') => levels.includes(l);
  const feature = has('feature') && value.feature ? h.features.get(value.feature) : undefined;
  const inheritedEpic = feature ? epicOf({ feature: feature.id }, h) : undefined;
  // Feature non proposée (mode Simple) : la tâche d'une feature est montrée dans l'epic de cette feature,
  // et rechoisir cette epic garde son lien avec la feature (le lien tâche → epic n'est jamais perdu)
  const featureCachee = !has('feature') && value.feature ? h.features.get(value.feature) : undefined;
  const epic = feature ? undefined : value.epic ? h.epics.get(value.epic) : featureCachee?.epic ? h.epics.get(featureCachee.epic) : undefined;
  const objectif = has('objectif') && !feature && !epic && value.objectif ? h.objectifs.get(value.objectif) : undefined;
  const inheritedObj = feature || epic ? objectifOf(value, h) : undefined;
  const inheritedDom = feature || epic || objectif ? domaineOf(value, h) : undefined;

  const none = (label: string) => ({ value: '', label });
  const [voirTout, setVoirTout] = useState(false);
  // Un parent au départ : en choisir un autre le déplace ; un nouveau parent prend la place de l'actuel (même grand-parent)
  const verrouille = !!initial && !!precis(initial);
  const nomLien = (v: Links) =>
    v.feature
      ? `🧩 ${h.features.get(v.feature)?.titre ?? '?'}`
      : v.epic
        ? `🗂️ ${h.epics.get(v.epic)?.titre ?? '?'}`
        : v.objectif
          ? `🎯 ${h.objectifs.get(v.objectif)?.titre ?? '?'}`
          : v.domaine
            ? `${h.domaines.get(v.domaine)?.icone ?? ''} ${h.domaines.get(v.domaine)?.nom ?? '?'}`.trim()
            : '';
  // Features proposées : celles de l'epic de départ (avec « Voir les features des autres epics »)
  const epicDepart = verrouille && initial!.feature ? h.features.get(initial!.feature)?.epic : undefined;
  const autresFeatures = epicDepart ? h.featureList.filter((f) => f.epic !== epicDepart && f.id !== value.feature) : [];
  const featuresProposees = epicDepart && !voirTout ? h.featureList.filter((f) => f.epic === epicDepart || f.id === value.feature) : h.featureList;
  const epicCourante = feature ? inheritedEpic : epic;
  const objCourant = objectif ?? inheritedObj;
  const domCourant = inheritedDom ?? (value.domaine ? h.domaines.get(value.domaine) : undefined);
  const defauts = (niveau: 'feature' | 'epic' | 'objectif' | 'domaine'): Links =>
    niveau === 'feature'
      ? { epic: epicCourante?.id }
      : niveau === 'epic'
        ? objCourant
          ? { objectif: objCourant.id }
          : { domaine: domCourant?.id }
        : niveau === 'objectif'
          ? { domaine: domCourant?.id }
          : {};
  const resume = [
    domCourant ? `${domCourant.icone} ${domCourant.nom}` : '',
    objCourant ? `🎯 ${objCourant.titre}` : '',
    epicCourante ? `🗂️ ${epicCourante.titre}` : '',
    feature ? `🧩 ${feature.titre}` : '',
  ]
    .filter(Boolean)
    .join(' › ');
  const Nouveau = ({ niveau }: { niveau: 'feature' | 'epic' | 'objectif' | 'domaine' }) =>
    onNouveau ? (
      <Pressable onPress={() => onNouveau(niveau, verrouille ? defauts(niveau) : {})} hitSlop={6} style={styles.nouveau} accessibilityRole="button">
        <Text style={styles.nouveauTexte}>＋ {verrouille ? VERS[niveau] : NOUVEAU[niveau]}</Text>
      </Pressable>
    ) : null;
  return (
    <Rattachement
      deplace={verrouille && precis(value) !== precis(initial!)}
      depuis={verrouille ? nomLien(initial!) : ''}
      vers={nomLien(value)}
      onAnnuler={() => onChange({ feature: initial!.feature ?? '', epic: initial!.epic ?? '', objectif: initial!.objectif ?? '', domaine: initial!.domaine ?? '' })}
    >
    <View>
      {has('feature') && (h.featureList.length > 0 || !!onNouveau) && (
        <>
          <Text style={styles.label}>Feature</Text>
          <Chips
            options={[
              none('Aucune'),
              ...featuresProposees.map((f) => {
                const e = f.epic ? h.epics.get(f.epic) : undefined;
                return { value: f.id, label: `🧩 ${f.titre}`, color: e?.couleur };
              }),
            ]}
            value={feature ? feature.id : ''}
            onChange={(v) => onChange({ feature: v, epic: '', objectif: '', domaine: '' })}
            depart={initial?.feature}
          />
          {autresFeatures.length > 0 && !voirTout && (
            <Pressable onPress={() => setVoirTout(true)} hitSlop={6} style={styles.nouveau} accessibilityRole="button">
              <Text style={styles.voir}>Voir les features des autres epics ({autresFeatures.length})</Text>
            </Pressable>
          )}
          <Nouveau niveau="feature" />
        </>
      )}
      {has('epic') && !feature && (h.epicList.length > 0 || !!onNouveau) && (
        <>
          <Text style={styles.label}>Epic</Text>
          <Chips
            options={[none('Aucune'), ...h.epicList.map((e) => ({ value: e.id, label: e.titre, color: e.couleur }))]}
            value={epic ? epic.id : ''}
            depart={initial?.feature ? undefined : initial?.epic}
            onChange={(v) =>
              onChange(
                featureCachee && v === featureCachee.epic
                  ? { feature: featureCachee.id, epic: '', objectif: '', domaine: '' }
                  : { feature: '', epic: v, objectif: '', domaine: '' },
              )
            }
          />
          <Nouveau niveau="epic" />
        </>
      )}
      {has('objectif') && !feature && !epic && (h.objectifList.length > 0 || !!onNouveau) && (
        <>
          <Text style={styles.label}>Objectif</Text>
          <Chips
            options={[none('Aucun'), ...h.objectifList.map((o) => ({ value: o.id, label: o.titre, color: o.couleur }))]}
            value={objectif ? objectif.id : ''}
            depart={initial?.feature || initial?.epic ? undefined : initial?.objectif}
            onChange={(v) => onChange({ feature: '', epic: '', objectif: v, domaine: '' })}
          />
          <Nouveau niveau="objectif" />
        </>
      )}
      {has('domaine') && !feature && !epic && !objectif && (h.domaineList.length > 0 || !!onNouveau) && (
        <>
          {h.domaineList.length > 0 && (
            <DomaineChoix
              value={value.domaine && h.domaines.has(value.domaine) ? value.domaine : ''}
              onChange={(v) => onChange({ feature: '', epic: '', objectif: '', domaine: v })}
            />
          )}
          <Nouveau niveau="domaine" />
        </>
      )}
      {/* Chemin complet du rattachement choisi */}
      {!!resume && resume.includes('›') && <Text style={styles.inherited}>{resume}</Text>}
    </View>
    </Rattachement>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.muted },
  inherited: { marginTop: 8, fontSize: 13, color: colors.muted },
  nouveau: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  voir: { fontSize: 13, fontWeight: '600', color: colors.primary },
  nouveauTexte: { fontSize: 13.5, fontWeight: '700', color: colors.primary },
});
