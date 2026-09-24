import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Action, Check } from '../checks';
import { colors } from '../theme';

/** Exécution des actions des alertes (fournie par l'application). */
export const CheckActionContext = createContext<(a: Action) => void>(() => {});

const VISIBLES = 3;

const OUVERTES_KEY = 'mes-taches:alertes-ouvertes';
/** Cartes dépliées, par écran (mémorisé sur l'appareil ; repliées par défaut) */
let ouvertes: Record<string, boolean> | null = null;

/** Carte « ⚠ Alertes » en haut d'un écran : repliée sur une ligne par défaut ; dépliée, 3 premières visibles. */
export function AlertsCard({ checks, style, ecran }: { checks: Check[]; style?: object; ecran: string }) {
  const run = useContext(CheckActionContext);
  const [open, setOpenState] = useState(!!ouvertes?.[ecran]);
  useEffect(() => {
    if (ouvertes) return;
    AsyncStorage.getItem(OUVERTES_KEY)
      .then((v) => {
        ouvertes = v ? JSON.parse(v) : {};
        setOpenState(!!ouvertes![ecran]);
      })
      .catch(() => (ouvertes = {}));
  }, [ecran]);
  const setOpen = (f: (v: boolean) => boolean) =>
    setOpenState((v) => {
      const next = f(v);
      ouvertes = { ...(ouvertes ?? {}), [ecran]: next };
      AsyncStorage.setItem(OUVERTES_KEY, JSON.stringify(ouvertes)).catch(() => {});
      return next;
    });
  const [tout, setTout] = useState(false);
  if (!checks.length) return null;
  const shown = tout ? checks : checks.slice(0, VISIBLES);
  return (
    <View style={[s.card, style]}>
      <Pressable style={s.head} onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={s.title}>
          ⚠ {checks.length} alerte{checks.length > 1 ? 's' : ''}
        </Text>
        <Text style={s.chev}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open && (
        <>
          {shown.map((c) => (
            <View key={c.key} style={s.item}>
              <Text style={s.msg}>
                {c.icone} {c.message}
              </Text>
              {c.actions.length > 0 && (
                <View style={s.btns}>
                  {c.actions.map((a) => (
                    <Pressable
                      key={a.label}
                      style={[s.btn, a.principal ? s.btnMain : s.btnSec]}
                      onPress={() => run(a.action)}
                      accessibilityRole="button"
                    >
                      <Text style={[s.btnText, !a.principal && s.btnTextSec]}>{a.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ))}
          {checks.length > VISIBLES && (
            <Pressable onPress={() => setTout((v) => !v)} style={s.more} accessibilityRole="button">
              <Text style={s.moreText}>{tout ? 'Voir moins' : `Voir les ${checks.length - VISIBLES} autres`}</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#FFF4F2', borderRadius: 12, borderWidth: 1, borderColor: '#F6C7C1', overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 9 },
  title: { fontSize: 14, fontWeight: '800', color: colors.danger },
  chev: { fontSize: 14, color: colors.danger },
  item: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F6C7C1', gap: 6 },
  msg: { fontSize: 13.5, lineHeight: 19, color: '#7A1C12' },
  btns: { gap: 6, alignItems: 'flex-start' },
  btn: { maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  btnMain: { backgroundColor: colors.danger },
  btnSec: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.danger },
  btnText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  btnTextSec: { color: colors.danger },
  more: { paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F6C7C1' },
  moreText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
