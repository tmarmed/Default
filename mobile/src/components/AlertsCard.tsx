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

/**
 * Alertes en haut d'un écran : deux cartes séparées, chacune repliée sur une ligne par défaut et
 * ouverte / fermée indépendamment (mémorisé par écran) : 🔴 alertes, puis 🟡 rappels.
 */
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
  const { ignorees: liste } = useContext(IgnoreContext);
  const ignorees = [...toutes, ...ignoreesEnPlus].filter((c) => estIgnoree(c, liste));
  let checks = actives(toutes, liste);
  // Raccourci seul (toutes les alertes qu'il regroupe sont ignorées) : rien à afficher
  if (!checks.some((c) => !c.groupe)) checks = [];
  const rouges = checks.filter((c) => !estRappel(c));
  const jaunes = checks.filter(estRappel);
  const ignR = ignorees.filter((c) => !estRappel(c));
  const ignJ = ignorees.filter(estRappel);
  if (!checks.length && !ignorees.length) return null;
  return (
    <View style={style}>
      {(rouges.length > 0 || ignR.length > 0) && <Carte checks={rouges} ignorees={ignR} cle={ecran} titre={titre} />}
      {(jaunes.length > 0 || ignJ.length > 0) && <Carte checks={jaunes} ignorees={ignJ} cle={`${ecran}:rappels`} titre={titre} jaune />}
    </View>
  );
}

/** Une carte d'une couleur (alertes rouges ou rappels jaunes) : titre qui ouvre / ferme, 3 visibles, ignorées. */
function Carte({ checks, ignorees, cle, titre, jaune = false }: { checks: Check[]; ignorees: Check[]; cle: string; titre?: string; jaune?: boolean }) {
  const run = useContext(CheckActionContext);
  const { ignorer, retablir } = useContext(IgnoreContext);
  const [open, setOpenState] = useState(!!ouvertes?.[cle]);
  useEffect(() => {
    if (ouvertes) {
      setOpenState(!!ouvertes[cle]);
      return;
    }
    AsyncStorage.getItem(OUVERTES_KEY)
      .then((v) => {
        ouvertes = v ? JSON.parse(v) : {};
        setOpenState(!!ouvertes![cle]);
      })
      .catch(() => (ouvertes = {}));
  }, [cle]);
  const toggle = () =>
    setOpenState((v) => {
      ouvertes = { ...(ouvertes ?? {}), [cle]: !v };
      AsyncStorage.setItem(OUVERTES_KEY, JSON.stringify(ouvertes)).catch(() => {});
      return !v;
    });
  const [tout, setTout] = useState(false);
  const [voirIgnorees, setVoirIgnorees] = useState(false);
  const j = jaune;
  const n = checks.filter((c) => !c.groupe).length;
  const calme = !checks.length;
  const shown = tout ? checks : checks.slice(0, VISIBLES);
  const entete = calme
    ? `✓ ${j ? 'Aucun rappel' : 'Aucune alerte'} · ${ignorees.length} ignoré${j ? '' : 'e'}${ignorees.length > 1 ? 's' : ''}`
    : j
      ? `🟡 ${n} rappel${n > 1 ? 's' : ''}`
      : `⚠ ${n} alerte${n > 1 ? 's' : ''}`;
  const reste = checks.length - VISIBLES;
  return (
    <View style={[s.card, j && s.cardJaune, calme && s.cardCalme]}>
      <Pressable style={s.head} onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={[s.title, j && s.titleJaune, calme && s.titleCalme]}>
          {entete}
          {titre ? ` · ${titre}` : ''}
        </Text>
        <Text style={[s.chev, j && s.titleJaune]}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open && (
        <>
          {shown.map((c) => (
            <View key={c.key} style={[s.item, j && s.itemJaune]}>
              <Text style={[s.msg, j && s.msgJaune]}>
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
          {reste > 0 && (
            <Pressable onPress={() => setTout((v) => !v)} style={[s.more, j && s.itemJaune]} accessibilityRole="button">
              <Text style={[s.moreText, j && s.titleJaune]}>
                {tout ? 'Voir moins' : `Voir ${reste > 1 ? `les ${reste} autres` : "l'autre"} ${j ? 'rappel' : 'alerte'}${reste > 1 ? 's' : ''}`}
              </Text>
            </Pressable>
          )}
          {ignorees.length > 0 && (
            <Pressable onPress={() => setVoirIgnorees((v) => !v)} style={[s.more, j && s.itemJaune]} accessibilityRole="button">
              <Text style={s.ignoreesText}>
                {voirIgnorees ? '▾' : '▸'} {ignorees.length} {j ? 'rappel' : 'alerte'}
                {ignorees.length > 1 ? 's' : ''} ignoré{j ? '' : 'e'}
                {ignorees.length > 1 ? 's' : ''}
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
