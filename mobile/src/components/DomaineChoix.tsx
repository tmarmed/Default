import { StyleSheet, Text } from 'react-native';
import { useHierarchy } from '../hierarchyContext';
import { colors } from '../theme';
import { Chips } from './Chips';

/**
 * Choix d'un domaine dans une fiche : les domaines principaux, puis — seulement une fois un domaine choisi et
 * s'il en a — ses sous-domaines. Un domaine qui n'a qu'un sous-domaine le sélectionne d'office
 * (« Tout <domaine> » pour revenir au domaine lui-même).
 */
export function DomaineChoix({ value, onChange, label = 'Domaine' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const h = useHierarchy();
  const courant = value ? h.domaines.get(value) : undefined;
  const principaux = h.domaineList.filter((d) => !d.parent || !h.domaines.has(d.parent));
  const principal = courant?.parent && h.domaines.has(courant.parent) ? h.domaines.get(courant.parent) : courant;
  const sous = principal ? h.domaineList.filter((d) => d.parent === principal.id) : [];
  const choisir = (v: string) => {
    const s = h.domaineList.filter((d) => d.parent === v);
    onChange(v && s.length === 1 ? s[0].id : v);
  };
  if (!h.domaineList.length) return null;
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Chips
        options={[{ value: '', label: 'Aucun' }, ...principaux.map((d) => ({ value: d.id, label: `${d.icone} ${d.nom}`, color: d.couleur }))]}
        value={principal ? principal.id : ''}
        onChange={choisir}
      />
      {principal && sous.length > 0 && (
        <>
          <Text style={styles.label}>Sous-domaine</Text>
          <Chips
            options={[
              { value: principal.id, label: `Tout ${principal.nom}` },
              ...sous.map((d) => ({ value: d.id, label: `${d.icone} ${d.nom}`, color: d.couleur })),
            ]}
            value={value}
            onChange={onChange}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.muted },
});
