import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * Bandeaux du bas de l'application (07/10), au-dessus des onglets, toujours au même endroit :
 * - bandeau du chat (clair), séparé : « 🔄 2 échanges à traiter · Voir › » ;
 * - bandeau de réunion, juste en dessous, 3 états hors de la fenêtre d'une réunion : « bientôt » (clair, 10 min avant,
 *   « Préparer › »), « en cours » (sombre, ● rouge, « Rejoindre › » ou « Reprendre › » pour l'animateur) et « seul »
 *   (sombre, sans point rouge, « Reprendre › »). Le 4e état, « ● En direct », est dans la fenêtre de la réunion.
 */
export interface InfoBandeauReunion {
  etat: 'bientot' | 'encours' | 'seul';
  titre: string;
  sous: string;
  action: string;
  /** Autres réunions lancées en même temps */
  plus?: number;
  onPress: () => void;
}
export interface InfoBandeauChat {
  n: number;
  sous: string;
  onPress: () => void;
}
/** Hauteur réservée (le bouton ＋ et le bandeau « Annuler » se posent au-dessus) */
export const hauteurBandeaux = (r: InfoBandeauReunion | null, c: InfoBandeauChat | null) => (r ? 62 : 0) + (c ? 54 : 0);

export function BandeauxBas({ reunion, chat }: { reunion: InfoBandeauReunion | null; chat: InfoBandeauChat | null }) {
  if (!reunion && !chat) return null;
  return (
    <View style={s.pile} pointerEvents="box-none">
      {chat && (
        <Pressable onPress={chat.onPress} style={[s.bandeau, s.clair]} accessibilityRole="button" accessibilityLabel={`${chat.n} message${chat.n > 1 ? 's' : ''} à traiter : voir`}>
          <View style={s.corps}>
            <Text style={[s.titre, s.titreClair]} numberOfLines={1}>
              💬 {chat.n} message{chat.n > 1 ? 's' : ''} à traiter
            </Text>
            {!!chat.sous && (
              <Text style={[s.sous, s.sousClair]} numberOfLines={1}>
                {chat.sous}
              </Text>
            )}
          </View>
          <Text style={[s.action, s.actionClair]}>Voir ›</Text>
        </Pressable>
      )}
      {reunion && (
        <Pressable
          onPress={reunion.onPress}
          style={[s.bandeau, reunion.etat === 'bientot' ? s.clair : s.sombre]}
          accessibilityRole="button"
          accessibilityLabel={`${reunion.titre}. ${reunion.sous}. ${reunion.action.replace(' ›', '')}`}
        >
          <Text style={[s.point, reunion.etat === 'encours' ? s.pointRouge : s.pointGris]}>●</Text>
          <View style={s.corps}>
            <Text style={[s.titre, reunion.etat === 'bientot' && s.titreClair]} numberOfLines={1}>
              {reunion.titre}
            </Text>
            {!!reunion.sous && (
              <Text style={[s.sous, reunion.etat === 'bientot' && s.sousClair]} numberOfLines={1}>
                {reunion.sous}
              </Text>
            )}
          </View>
          <Text style={[s.action, reunion.etat === 'bientot' && s.actionClair]}>{reunion.action}</Text>
          {!!reunion.plus && (
            <View style={s.plus}>
              <Text style={s.plusTexte}>+{reunion.plus}</Text>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  pile: { gap: 6, paddingHorizontal: 10 },
  bandeau: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, minHeight: 48 },
  sombre: { backgroundColor: '#1d2433', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  clair: { backgroundColor: '#E8F0FE', borderWidth: 1, borderColor: '#C6D8FB' },
  point: { fontSize: 12 },
  pointRouge: { color: '#ff5a5a' },
  pointGris: { color: '#9AA4B2' },
  corps: { flex: 1, minWidth: 0 },
  titre: { color: '#fff', fontSize: 14, fontWeight: '800' },
  titreClair: { color: '#174EA6' },
  sous: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 1 },
  sousClair: { color: '#3A5A9A' },
  action: { color: '#fff', fontSize: 14, fontWeight: '800' },
  actionClair: { color: colors.primary },
  plus: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  plusTexte: { color: '#1d2433', fontWeight: '800', fontSize: 12 },
});
