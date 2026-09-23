import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

interface Props {
  mode: 'date' | 'time';
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

/** Version navigateur : champ date / heure natif du navigateur. */
export function DateField({ mode, value, onChange, placeholder }: Props) {
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
          fontSize: 16,
          color: colors.text,
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          padding: '11px 12px',
          minHeight: 46,
          boxSizing: 'border-box',
          width: '100%',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row' } });
