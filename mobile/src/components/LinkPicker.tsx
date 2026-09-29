import { Pressable, StyleSheet, Text, View } from 'react-native';
import { domaineOf, epicOf, objectifOf } from '../hierarchy';
import { useHierarchy } from '../hierarchyContext';
import { colors } from '../theme';
import { Chips } from './Chips';
import { DomaineChoix } from './DomaineChoix';

type Links = { feature?: string; epic?: string; objectif?: string; domaine?: string };

interface Props {
  /** Niveaux proposés, du plus précis au plus large */
  levels: ('feature' | 'epic' | 'objectif' | 'domaine')[];
  value: Links;
  onChange: (patch: Links) => void;
  /** « ＋ Nouvelle feature / epic / objectif / nouveau domaine » : la fiche s'ouvre par-dessus, l'élément créé est choisi */
  onNouveau?: (niveau: 'feature' | 'epic' | 'objectif' | 'domaine') => void;
}

const NOUVEAU = { feature: 'Nouvelle feature', epic: 'Nouvelle epic', objectif: 'Nouvel objectif', domaine: 'Nouveau domaine' } as const;

/**
 * Rattachement à un niveau supérieur : on choisit le plus précis (epic, sinon objectif, sinon domaine) ;
 * les niveaux au-dessus s'en déduisent et sont simplement affichés.
 */
export function LinkPicker({ levels, value, onChange, onNouveau }: Props) {
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
  const Nouveau = ({ niveau }: { niveau: 'feature' | 'epic' | 'objectif' | 'domaine' }) =>
    onNouveau ? (
      <Pressable onPress={() => onNouveau(niveau)} hitSlop={6} style={styles.nouveau} accessibilityRole="button">
        <Text style={styles.nouveauTexte}>＋ {NOUVEAU[niveau]}</Text>
      </Pressable>
    ) : null;
  return (
    <View>
      {has('feature') && (h.featureList.length > 0 || !!onNouveau) && (
        <>
          <Text style={styles.label}>Feature</Text>
          <Chips
            options={[
              none('Aucune'),
              ...h.featureList.map((f) => {
                const e = f.epic ? h.epics.get(f.epic) : undefined;
                return { value: f.id, label: `🧩 ${f.titre}`, color: e?.couleur };
              }),
            ]}
            value={feature ? feature.id : ''}
            onChange={(v) => onChange({ feature: v, epic: '', objectif: '', domaine: '' })}
          />
          <Nouveau niveau="feature" />
        </>
      )}
      {has('epic') && !feature && (h.epicList.length > 0 || !!onNouveau) && (
        <>
          <Text style={styles.label}>Epic</Text>
          <Chips
            options={[none('Aucune'), ...h.epicList.map((e) => ({ value: e.id, label: e.titre, color: e.couleur }))]}
            value={epic ? epic.id : ''}
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
      {(inheritedEpic || inheritedObj || inheritedDom) && (
        <Text style={styles.inherited}>
          {inheritedEpic ? `Epic : ${inheritedEpic.titre}` : ''}
          {inheritedEpic && (inheritedObj || inheritedDom) ? ' · ' : ''}
          {inheritedObj ? `Objectif : ${inheritedObj.titre}` : ''}
          {inheritedObj && inheritedDom ? ' · ' : ''}
          {inheritedDom ? `Domaine : ${inheritedDom.icone} ${inheritedDom.nom}` : ''}
          {feature ? ' (via la feature)' : epic ? " (via l'epic)" : " (via l'objectif)"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.muted },
  inherited: { marginTop: 8, fontSize: 13, color: colors.muted },
  nouveau: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  nouveauTexte: { fontSize: 13.5, fontWeight: '700', color: colors.primary },
});
