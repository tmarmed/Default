import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Ecran } from '../espaces';
import { colors } from '../theme';

/** Écrans prévus dont les règles de gestion restent à définir : écran vide, avec ce qu'il contiendra. */
const CONTENU: Partial<Record<Ecran, { icone: string; titre: string; question: string; contenu: string[] }>> = {
  strategie: {
    icone: '🎯',
    titre: 'Stratégie',
    question: 'Pourquoi ? Quel résultat voulons-nous obtenir ?',
    contenu: ['Thèmes stratégiques', 'OKR : Objective et ses résultats clés (KR), avec leur avancement'],
  },
  backlog: {
    icone: '🌳',
    titre: 'Backlog',
    question: "Qu'allons-nous construire ?",
    contenu: ['Hiérarchie du travail en arbre : Epic → Capability → Feature → Story → Task'],
  },
  equipe: {
    icone: '👥',
    titre: 'Équipe',
    question: 'Qui réalise le travail ?',
    contenu: ['Membres et rôles (PO, SM, développeurs…)', 'Disponibilité et capacité de l’équipe'],
  },
  organisation: {
    icone: '🏛️',
    titre: 'Organisation',
    question: 'Qui porte, réalise et compose l’entreprise ?',
    contenu: [
      'Organisation SAFe : Value Streams, Solutions, ART, Teams',
      'Organisation réelle : services, managers, personnes',
      'Alignement : qui est affecté à quelle Team ou quel ART, avec quel rôle',
    ],
  },
  pilotage: {
    icone: '📊',
    titre: 'Pilotage',
    question: 'Comment arbitrons-nous et pilotons-nous ? Avons-nous obtenu le résultat ?',
    contenu: ['Gouvernance : décisions et arbitrages', 'Métriques : prévisibilité, vélocité, avancement des KR', 'Alertes de tous les écrans'],
  },
};

export const TITRE_A_VENIR = (e: Ecran) => CONTENU[e]?.titre ?? e;

export function EcranAVenir({ ecran }: { ecran: Ecran }) {
  const c = CONTENU[ecran];
  if (!c) return null;
  return (
    <ScrollView contentContainerStyle={s.box}>
      <Text style={s.icone}>{c.icone}</Text>
      <Text style={s.titre}>{c.titre}</Text>
      <Text style={s.question}>{c.question}</Text>
      <View style={s.card}>
        <Text style={s.soon}>Écran à venir</Text>
        {c.contenu.map((l) => (
          <Text key={l} style={s.item}>
            • {l}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  box: { padding: 24, alignItems: 'center', gap: 8 },
  icone: { fontSize: 44, marginTop: 20 },
  titre: { fontSize: 20, fontWeight: '800', color: colors.text },
  question: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  card: { alignSelf: 'stretch', marginTop: 16, backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 6, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  soon: { fontSize: 12, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  item: { fontSize: 14, lineHeight: 20, color: colors.text },
});
