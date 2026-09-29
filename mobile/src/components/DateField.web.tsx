import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

interface Props {
  mode: 'date' | 'time';
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Dans une ligne de fiche : sans cadre, sur la carte blanche */
  nu?: boolean;
}

/** Version navigateur : champ date / heure natif du navigateur. */
export function DateField({ mode, value, onChange, placeholder, nu }: Props) {
  return (
    <View style={styles.row}>
      <input
        type={mode}
        value={value}
        aria-label={placeholder}
        onChange={(e) => onChange(e.currentTarget.value)}
        style={{
          flex: 1,
          font: 'inherit',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          fontSize: 16,
          color: colors.text,
          background: nu ? 'transparent' : colors.card,
          border: nu ? 'none' : `1px solid ${colors.border}`,
          borderRadius: 10,
          padding: nu ? '4px 0' : '11px 12px',
          minHeight: nu ? 30 : 46,
          fontWeight: nu && value ? 600 : undefined,
          outline: nu ? 'none' : undefined,
          boxSizing: 'border-box',
          width: '100%',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row' } });
