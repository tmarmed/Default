import { StyleSheet, Text } from 'react-native';
import { useChoixDomaine } from './DomainFilter';
import { colors } from '../theme';
import { Chips } from './Chips';

/**
 * Choix d'un domaine dans une fiche : les domaines principaux, puis — seulement une fois un domaine choisi et
 * s'il en a — ses sous-domaines. Un domaine qui n'a qu'un sous-domaine le sélectionne d'office
 * (« Tout <domaine> » pour revenir au domaine lui-même).
 */
export function DomaineChoix({ value, onChange, label = 'Domaine' }: { value: string; onChange: (v: string) => void; label?: string }) {
  // Même logique que le filtre des domaines (useChoixDomaine)
  const c = useChoixDomaine(value, onChange);
  if (c.vide) return null;
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Chips options={[{ value: '', label: 'Aucun' }, ...c.principauxSimples]} value={c.valeurPrincipale} onChange={c.choisir} />
      {c.sous && (
        <>
          <Text style={styles.label}>Sous-domaine</Text>
          <Chips options={[c.sous.tout, ...c.sous.options]} value={value} onChange={onChange} />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.muted },
});
