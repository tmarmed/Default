import { useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { enMinutes } from '../../daily';
import { colors } from '../../theme';

/** Pixels par minute de la frise (9:00 → 18:00 ≈ 760 px) */
export const PX = 1.4;

export interface BlocFrise {
  de: string;
  a: string;
  quoi: 'fixe' | 'perso' | 'element' | 'libre' | 'dejeuner';
  titre: string;
  id?: string;
}

/** Ce qu'on glisse (bloc de la frise ou élément « À placer ») : suit le doigt, puis `onLacher(pageY)` */
export function Glissable({ onLacher, onToucher, children, style }: { onLacher: (pageY: number) => void; onToucher?: () => void; children: ReactNode; style?: object }) {
  const [dy, setDy] = useState(0);
  const [dx, setDx] = useState(0);
  const bouge = useRef(false);
  const cb = useRef({ onLacher, onToucher });
  cb.current = { onLacher, onToucher };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4 || Math.abs(g.dx) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        bouge.current = false;
      },
      onPanResponderMove: (_e, g) => {
        if (Math.abs(g.dy) > 4 || Math.abs(g.dx) > 4) bouge.current = true;
        setDy(g.dy);
        setDx(g.dx);
      },
      onPanResponderRelease: (e, g) => {
        setDy(0);
        setDx(0);
        if (bouge.current) cb.current.onLacher(e.nativeEvent.pageY ?? g.moveY);
        else cb.current.onToucher?.();
      },
      onPanResponderTerminate: () => {
        setDy(0);
        setDx(0);
      },
    }),
  ).current;
  const actif = dy !== 0 || dx !== 0;
  return (
    <View {...pan.panHandlers} style={[style, { userSelect: 'none' } as object, actif && { transform: [{ translateY: dy }, { translateX: dx }], zIndex: 10, opacity: 0.85, shadowOpacity: 0.25, shadowRadius: 8 }]}>
      {children}
    </View>
  );
}

/**
 * Frise de la journée (13/10, R5c) : les heures à gauche, les blocs à leur place. On glisse un élément placé vers
 * un moment libre (déplacé), sur un autre élément (échange) ou au-dessus de la journée (retour « À placer ») ; on
 * touche un moment libre pour y placer un élément, un élément pour régler sa durée.
 */
export function Frise({
  debut,
  fin,
  blocs,
  choisi,
  onMesure,
  onLibre,
  onElement,
  onLacher,
}: {
  debut: string;
  fin: string;
  blocs: BlocFrise[];
  choisi: string;
  /** Haut de la frise dans la fenêtre (pour situer un lâcher) */
  onMesure: (top: number) => void;
  onLibre: (b: BlocFrise) => void;
  onElement: (id: string) => void;
  onLacher: (id: string, pageY: number) => void;
}) {
  const d0 = enMinutes(debut);
  const d1 = enMinutes(fin);
  const ref = useRef<View>(null);
  const mesurer = () => ref.current?.measureInWindow((_x, y) => onMesure(y));
  const heures: number[] = [];
  for (let h = Math.ceil(d0 / 60) * 60; h <= d1; h += 60) heures.push(h);
  const y = (h: string) => (enMinutes(h) - d0) * PX;
  const haut = (b: BlocFrise) => Math.max(18, (enMinutes(b.a) - enMinutes(b.de)) * PX - 2);
  const couleurs: Record<BlocFrise['quoi'], { fond: string; texte: string; bord?: string }> = {
    fixe: { fond: '#E3E8F0', texte: colors.text },
    perso: { fond: '#EEF1F6', texte: colors.text },
    dejeuner: { fond: '#F6F7F9', texte: colors.muted },
    element: { fond: '#D2E3FC', texte: '#174EA6', bord: colors.primary },
    libre: { fond: 'transparent', texte: colors.primary, bord: '#A8C7FA' },
  };
  return (
    <View ref={ref} onLayout={mesurer} style={[{ userSelect: 'none' } as object, { height: (d1 - d0) * PX + 8, marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: 12 }]}>
      {heures.map((h) => (
        <View key={h} style={{ position: 'absolute', top: (h - d0) * PX, left: 0, right: 0, flexDirection: 'row', alignItems: 'center' }} pointerEvents="none">
          <Text style={{ width: 44, fontSize: 11, color: colors.muted, textAlign: 'right', paddingRight: 6, marginTop: -7 }}>{`${h / 60}:00`}</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E8EBF0' }} />
        </View>
      ))}
      {blocs.map((b) => {
        const c = couleurs[b.quoi];
        const pos = { position: 'absolute' as const, top: y(b.de) + 1, left: 50, right: 8, height: haut(b) };
        const contenu = (
          <View style={{ flex: 1, backgroundColor: c.fond, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, borderWidth: c.bord ? 1 : 0, borderColor: c.bord, borderStyle: b.quoi === 'libre' ? 'dashed' : 'solid', justifyContent: 'center' }}>
            <Text numberOfLines={haut(b) > 34 ? 2 : 1} style={{ fontSize: 12, color: c.texte, fontWeight: b.quoi === 'element' ? '600' : '400' }}>
              {b.quoi === 'libre' ? `${b.de} → ${b.a} · libre` : `${b.de} · ${b.titre}`}
            </Text>
          </View>
        );
        if (b.quoi === 'element')
          return (
            <Glissable
              key={`e-${b.id}`}
              style={[pos, choisi === b.id && { borderRadius: 9, borderWidth: 2, borderColor: colors.primary }]}
              onToucher={() => onElement(b.id!)}
              onLacher={(py) => (mesurer(), onLacher(b.id!, py))}
            >
              {contenu}
            </Glissable>
          );
        if (b.quoi === 'libre')
          return (
            <Pressable key={`l-${b.de}`} style={pos} onPress={() => onLibre(b)} accessibilityRole="button" accessibilityLabel={`Moment libre ${b.de} → ${b.a}`}>
              {contenu}
            </Pressable>
          );
        return (
          <View key={`${b.quoi}-${b.de}-${b.titre}`} style={pos} pointerEvents="none">
            {contenu}
          </View>
        );
      })}
    </View>
  );
}
