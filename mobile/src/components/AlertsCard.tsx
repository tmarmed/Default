import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Action, Check } from '../checks';
import type { Ignoree } from '../types';
import { colors } from '../theme';

/** Exécution des actions des alertes (fournie par l'application). */
export const CheckActionContext = createContext<(a: Action) => void>(() => {});

/**
 * Alertes ignorées (enregistrées dans le Google Sheet) : une alerte reste ignorée tant que sa situation
 * (son message) ne change pas ; si elle change, l'alerte revient.
 */
export interface IgnoreValue {
  ignorees: Ignoree[];
  ignorer: (c: Check) => void;
  retablir: (c: Check) => void;
}
export const IgnoreContext = createContext<IgnoreValue>({ ignorees: [], ignorer: () => {}, retablir: () => {} });
export const estIgnoree = (c: Check, ignorees: Ignoree[]) => ignorees.some((i) => i.cle === c.key && i.signature === c.message);
/** Alertes à afficher et à compter (sans les ignorées). */
export const actives = (checks: Check[], ignorees: Ignoree[]) => checks.filter((c) => !estIgnoree(c, ignorees));
/** Rappel (jaune) ou alerte (rouge) */
export const estRappel = (c: Check) => c.niveau === 'rappel';
/**
 * Nombre d'alertes (sans les ignorées, ni les raccourcis qui en regroupent d'autres) :
 * 'alerte' = rouges, 'rappel' = jaunes, 'tous' = les deux.
 */
export const nbAlertes = (checks: Check[], ignorees: Ignoree[], niveau: 'alerte' | 'rappel' | 'tous' = 'tous') =>
  actives(checks, ignorees).filter((c) => !c.groupe && (niveau === 'tous' || (niveau === 'rappel') === estRappel(c))).length;

const VISIBLES = 3;

const OUVERTES_KEY = 'mes-taches:alertes-ouvertes';
/** Cartes dépliées, par écran (mémorisé sur l'appareil ; repliées par défaut) */
let ouvertes: Record<string, boolean> | null = null;

/** Carte « ⚠ Alertes » en haut d'un écran : repliée sur une ligne par défaut ; dépliée, 3 premières visibles. */
export function AlertsCard({
  checks: toutes,
  style,
  ecran,
  titre,
  ignoreesEnPlus = [],
}: {
  checks: Check[];
  style?: object;
  ecran: string;
  /** ex. « IT4 · T4 2026 » */
  titre?: string;
  /** Alertes affichées ailleurs sur l'écran (dates de la roadmap) : seules les ignorées sont listées ici, pour « Ne plus ignorer » */
  ignoreesEnPlus?: Check[];
}) {
  const run = useContext(CheckActionContext);
  let checks = toutes;
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
  const [toutR, setToutR] = useState(false);
  const [toutJ, setToutJ] = useState(false);
  const [voirIgnorees, setVoirIgnorees] = useState(false);
  const { ignorees: liste, ignorer, retablir } = useContext(IgnoreContext);
  const ignorees = [...checks, ...ignoreesEnPlus].filter((c) => estIgnoree(c, liste));
  checks = actives(checks, liste);
  // Raccourci seul (toutes les alertes qu'il regroupe sont ignorées) : rien à afficher
  if (!checks.some((c) => !c.groupe)) checks = [];
  if (!checks.length && !ignorees.length) return null;
  // Alertes (rouges) d'abord, puis rappels (jaunes) ; le raccourci « Tout reporter » n'est pas une alerte de plus
  checks = [...checks.filter((c) => !estRappel(c)), ...checks.filter(estRappel)];
  const n = checks.filter((c) => !c.groupe && !estRappel(c)).length;
  const r = checks.filter(estRappel).length;
  const jaune = !n && r > 0;
  const rouges = checks.filter((c) => !estRappel(c));
  const jaunes = checks.filter(estRappel);
  const entete = [
    n ? `⚠ ${n} alerte${n > 1 ? 's' : ''}` : '',
    r ? `${n ? '' : '🟡 '}${r} rappel${r > 1 ? 's' : ''}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[s.card, jaune && s.cardJaune, !checks.length && s.cardCalme, style]}>
      <Pressable style={s.head} onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={[s.title, jaune && s.titleJaune, !checks.length && s.titleCalme]}>
          {checks.length ? entete : `✓ Aucune alerte · ${ignorees.length} ignorée${ignorees.length > 1 ? 's' : ''}`}
          {titre ? ` · ${titre}` : ''}
        </Text>
        <Text style={[s.chev, jaune && s.titleJaune]}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open && (
        <>
          {[rouges, jaunes].map((liste, k) => {
            // Chaque couleur a ses 3 premières visibles et son « Voir les N autres »
            const j = k === 1;
            const tous = j ? toutJ : toutR;
            const visibles = tous ? liste : liste.slice(0, VISIBLES);
            return (
              <View key={j ? 'jaunes' : 'rouges'}>
                {visibles.map((c) => (
                  <View key={c.key} style={[s.item, j && s.itemJaune]}>
                    <Text style={[s.msg, j && s.msgJaune]}>
                      {j ? '🟡 ' : ''}
                      {c.icone} {c.message}
                    </Text>
                    {c.actions.length > 0 && (
                      <View style={s.btns}>
                        {c.actions.map((a) => (
                          <Pressable
                            key={a.label}
                            style={[s.btn, a.principal ? (j ? s.btnMainJaune : s.btnMain) : j ? s.btnSecJaune : s.btnSec]}
                            onPress={() => run(a.action)}
                            accessibilityRole="button"
                          >
                            <Text style={[s.btnText, !a.principal && s.btnTextSec, j && (a.principal ? s.btnTextJaune : s.btnTextSecJaune)]}>{a.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    <Pressable onPress={() => ignorer(c)} hitSlop={6} style={s.ignorer} accessibilityRole="button" accessibilityLabel={`Ignorer : ${c.message}`}>
                      <Text style={s.ignorerText}>Ignorer</Text>
                    </Pressable>
                  </View>
                ))}
                {liste.length > VISIBLES && (
                  <Pressable onPress={() => (j ? setToutJ : setToutR)((v) => !v)} style={[s.more, j && s.itemJaune]} accessibilityRole="button">
                    <Text style={[s.moreText, j && s.titleJaune]}>
                      {tous ? 'Voir moins' : `Voir ${liste.length - VISIBLES > 1 ? `les ${liste.length - VISIBLES} autres` : "l'autre"} ${j ? 'rappel' : 'alerte'}${liste.length - VISIBLES > 1 ? 's' : ''}`}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          {ignorees.length > 0 && (
            <Pressable onPress={() => setVoirIgnorees((v) => !v)} style={s.more} accessibilityRole="button">
              <Text style={s.ignoreesText}>
                {voirIgnorees ? '▾' : '▸'} {ignorees.length} alerte{ignorees.length > 1 ? 's' : ''} ignorée{ignorees.length > 1 ? 's' : ''}
                {voirIgnorees ? '' : ' · les revoir'}
              </Text>
            </Pressable>
          )}
          {voirIgnorees &&
            ignorees.map((c) => (
              <View key={c.key} style={[s.item, s.itemIgnore]}>
                <Text style={s.msgIgnore}>
                  {c.icone} {c.message}
                </Text>
                <Pressable onPress={() => retablir(c)} hitSlop={6} style={s.ignorer} accessibilityRole="button" accessibilityLabel={`Ne plus ignorer : ${c.message}`}>
                  <Text style={s.retablirText}>Ne plus ignorer</Text>
                </Pressable>
              </View>
            ))}
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
  // Rappels (jaune)
  cardJaune: { backgroundColor: '#FFF8E1', borderColor: '#F3D98B' },
  titleJaune: { color: '#7A5A00' },
  itemJaune: { backgroundColor: '#FFF8E1', borderTopColor: '#F3D98B' },
  msgJaune: { color: '#5C4400' },
  btnMainJaune: { backgroundColor: '#F2C230' },
  btnSecJaune: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#C99700' },
  btnTextJaune: { color: '#3A2E00' },
  btnTextSecJaune: { color: '#7A5A00' },
  cardCalme: { backgroundColor: colors.card, borderColor: colors.border },
  titleCalme: { color: colors.muted, fontWeight: '700' },
  ignorer: { alignSelf: 'flex-start', paddingVertical: 2 },
  ignorerText: { color: colors.muted, fontSize: 12, textDecorationLine: 'underline' },
  ignoreesText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  itemIgnore: { backgroundColor: '#F4F6FA' },
  msgIgnore: { fontSize: 13, lineHeight: 18, color: colors.muted },
  retablirText: { color: colors.primary, fontSize: 12.5, fontWeight: '700' },
});
