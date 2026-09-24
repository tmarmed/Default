import { StyleSheet, Text, View } from 'react-native';
import { domaineOf, objectifOf } from '../hierarchy';
import { useHierarchy } from '../hierarchyContext';
import { colors } from '../theme';
import { Chips } from './Chips';

type Links = { epic?: string; objectif?: string; domaine?: string };

interface Props {
  /** Niveaux proposés, du plus précis au plus large */
  levels: ('epic' | 'objectif' | 'domaine')[];
  value: Links;
  onChange: (patch: Links) => void;
}

/**
 * Rattachement à un niveau supérieur : on choisit le plus précis (epic, sinon objectif, sinon domaine) ;
 * les niveaux au-dessus s'en déduisent et sont simplement affichés.
 */
export function LinkPicker({ levels, value, onChange }: Props) {
  const h = useHierarchy();
  const has = (l: 'epic' | 'objectif' | 'domaine') => levels.includes(l);
  const epic = value.epic ? h.epics.get(value.epic) : undefined;
  const objectif = has('objectif') && !epic && value.objectif ? h.objectifs.get(value.objectif) : undefined;
  const inheritedObj = epic ? objectifOf({ epic: epic.id }, h) : undefined;
  const inheritedDom = epic || objectif ? domaineOf(value, h) : undefined;

  const none = (label: string) => ({ value: '', label });
  return (
    <View>
      {has('epic') && h.epicList.length > 0 && (
        <>
          <Text style={styles.label}>Epic</Text>
          <Chips
            options={[none('Aucune'), ...h.epicList.map((e) => ({ value: e.id, label: e.titre, color: e.couleur }))]}
            value={epic ? epic.id : ''}
            onChange={(v) => onChange({ epic: v, objectif: '', domaine: '' })}
          />
        </>
      )}
      {has('objectif') && !epic && h.objectifList.length > 0 && (
        <>
          <Text style={styles.label}>Objectif</Text>
          <Chips
            options={[none('Aucun'), ...h.objectifList.map((o) => ({ value: o.id, label: o.titre, color: o.couleur }))]}
            value={objectif ? objectif.id : ''}
            onChange={(v) => onChange({ epic: '', objectif: v, domaine: '' })}
          />
        </>
      )}
      {has('domaine') && !epic && !objectif && h.domaineList.length > 0 && (
        <>
          <Text style={styles.label}>Domaine</Text>
          <Chips
            options={[
              none('Aucun'),
              ...h.domaineList.map((d) => ({ value: d.id, label: `${d.icone} ${d.nom}`, color: d.couleur })),
            ]}
            value={value.domaine && h.domaines.has(value.domaine) ? value.domaine : ''}
            onChange={(v) => onChange({ epic: '', objectif: '', domaine: v })}
          />
        </>
      )}
      {(inheritedObj || inheritedDom) && (
        <Text style={styles.inherited}>
          {inheritedObj ? `Objectif : ${inheritedObj.titre}` : ''}
          {inheritedObj && inheritedDom ? ' · ' : ''}
          {inheritedDom ? `Domaine : ${inheritedDom.icone} ${inheritedDom.nom}` : ''}
          {epic ? " (via l'epic)" : " (via l'objectif)"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.muted },
  inherited: { marginTop: 8, fontSize: 13, color: colors.muted },
});
