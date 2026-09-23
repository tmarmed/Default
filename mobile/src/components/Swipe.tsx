import { ReactNode, useEffect, useRef } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';

interface Props {
  /** Change à chaque période : déclenche l'animation d'arrivée. */
  pageKey: string;
  onPrev: () => void;
  onNext: () => void;
  children: ReactNode;
}

const SEUIL = 50;

/**
 * Zone où l'on glisse le doigt à gauche / à droite pour changer de période.
 * Les mouvements verticaux restent pour le défilement de la liste.
 */
export function Swipe({ pageKey, onPrev, onNext, children }: Props) {
  const translate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const direction = useRef(0);
  const handlers = useRef({ onPrev, onNext });
  handlers.current = { onPrev, onNext };

  const horizontal = (dx: number, dy: number) => Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 2;

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => horizontal(g.dx, g.dy),
      onPanResponderMove: (_, g) => translate.setValue(g.dx * 0.4),
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -SEUIL || g.vx < -0.5) {
          direction.current = 1;
          handlers.current.onNext();
        } else if (g.dx >= SEUIL || g.vx > 0.5) {
          direction.current = -1;
          handlers.current.onPrev();
        } else {
          Animated.spring(translate, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(translate, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  // La nouvelle période arrive du côté vers lequel on a glissé.
  useEffect(() => {
    translate.setValue(direction.current * 60);
    opacity.setValue(direction.current ? 0.3 : 1);
    direction.current = 0;
    Animated.parallel([
      Animated.timing(translate, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [pageKey, translate, opacity]);

  return (
    <Animated.View
      style={[styles.flex, { opacity, transform: [{ translateX: translate }] }]}
      {...responder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
