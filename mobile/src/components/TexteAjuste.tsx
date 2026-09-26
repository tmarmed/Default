import { useState } from 'react';
import { StyleSheet, Text, type TextStyle, View, type StyleProp } from 'react-native';

/**
 * Texte sur une ligne, jamais coupé « … » : si la place manque, la taille du texte baisse (jusqu'à `min`) ; si
 * cela ne suffit pas, la variante suivante est prise (ex. « 🔒 Moi · 👥 Mobile » → « 🔒 Moi +1 »).
 * `dispo` : largeur disponible (mesurée par le parent) ; tant qu'elle est inconnue, la première variante est
 * affichée à sa taille normale. Les variantes sont mesurées hors écran, à la taille normale.
 */
export function TexteAjuste({
  variantes,
  taille,
  min,
  dispo,
  style,
}: {
  variantes: string[];
  taille: number;
  min: number;
  dispo: number | null;
  style?: StyleProp<TextStyle>;
}) {
  const [largeurs, setLargeurs] = useState<Record<string, number>>({});
  let texte = variantes[0];
  let fontSize = taille;
  if (dispo !== null && dispo > 0) {
    const mesurees = variantes.map((v) => largeurs[v]);
    if (mesurees.every((l) => l !== undefined)) {
      const i = mesurees.findIndex((l) => (l * min) / taille <= dispo);
      const k = i < 0 ? variantes.length - 1 : i;
      texte = variantes[k];
      fontSize = Math.max(min, Math.min(taille, Math.floor(((taille * dispo) / mesurees[k]) * 10) / 10));
    }
  }
  return (
    <>
      {/* Mesure hors écran, à la taille normale */}
      <View style={s.mesure} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        {variantes.map((v) => (
          <Text
            key={v}
            style={[style, s.brut, { fontSize: taille }]}
            onLayout={(e) => {
              const l = Math.ceil(e.nativeEvent.layout.width);
              setLargeurs((m) => (m[v] === l ? m : { ...m, [v]: l }));
            }}
          >
            {v}
          </Text>
        ))}
      </View>
      <Text style={[style, s.brut, { fontSize }]} numberOfLines={1}>
        {texte}
      </Text>
    </>
  );
}

const s = StyleSheet.create({
  mesure: { position: 'absolute', left: 0, top: 0, width: 3000, opacity: 0, flexDirection: 'column', alignItems: 'flex-start' },
  brut: { flexShrink: 0 },
});
