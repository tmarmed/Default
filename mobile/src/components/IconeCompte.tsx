import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** Icône standard du compte : silhouette dans un rond ; point vert = connecté. */
export function IconeCompte({ taille = 32, connecte = true }: { taille?: number; connecte?: boolean }) {
  const k = taille / 32;
  return (
    <View style={[s.rond, { width: taille, height: taille, borderRadius: taille / 2 }]}>
      <View style={[s.tete, { width: 9 * k, height: 9 * k, borderRadius: 4.5 * k, borderWidth: 2 * k, marginTop: 2 * k }]} />
      <View style={[s.corps, { width: 17 * k, height: 7 * k, borderTopLeftRadius: 9 * k, borderTopRightRadius: 9 * k, borderWidth: 2 * k, marginTop: 2 * k }]} />
      {connecte && <View style={[s.point, { width: 10 * k, height: 10 * k, borderRadius: 5 * k }]} />}
    </View>
  );
}

const s = StyleSheet.create({
  rond: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tete: { borderColor: '#3A4556' },
  corps: { borderColor: '#3A4556', borderBottomWidth: 0 },
  point: { position: 'absolute', right: -1, bottom: -1, backgroundColor: '#1E8E3E', borderWidth: 2, borderColor: '#fff' },
});
