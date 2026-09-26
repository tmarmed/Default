import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { moisAnnee, type Option, type Plan, pourcent, type Quota, SEUIL_ALERTE, SEUIL_CIBLE, taille } from '../stockage';
import { colors } from '../theme';

export type ActionStockage = { kind: 'corbeille' } | { kind: 'periode'; avant: string } | { kind: 'copie'; avant: string } | { kind: 'google' };

const ROUGE = '#D93025';

/** Texte d'une solution : titre et détail */
function texte(o: Option, plan: Plan): { titre: string; detail: string } {
  if (o.kind === 'corbeille')
    return {
      titre: '🗑️ Vider la corbeille de President',
      detail: `${o.nb} espace${o.nb > 1 ? 's' : ''} de travail supprimé${o.nb > 1 ? 's' : ''} · libère ${taille(o.octets)}${o.suffit ? '' : ' · ne suffit pas seul'}`,
    };
  if (o.kind === 'periode')
    return {
      titre: `📦 Supprimer les tâches terminées avant ${moisAnnee(o.avant)}`,
      detail: `${o.nb} tâche${o.nb > 1 ? 's' : ''} sur ${o.mois} mois · une copie est proposée avant · libère ${taille(o.octets)}${o.suffit ? '' : ' · ne suffit pas seul'}`,
    };
  return {
    titre: '☁️ Voir le stockage Google',
    detail: o.autres ? "La plupart de l'espace est pris par d'autres fichiers (photos, e-mails)" : `Gérer tous les fichiers du compte Google (${taille(plan.aLiberer)} à libérer)`,
  };
}

/**
 * Alerte de stockage Google Drive : jauge, espace à libérer, solutions (la recommandée en rouge). Les solutions
 * qui effacent demandent une confirmation ; « Supprimer les tâches terminées » propose d'abord une copie.
 */
export function StockagePanneau({
  quota,
  plan,
  onAction,
  onPlusTard,
  toujours = false,
}: {
  quota: Quota;
  plan: Plan;
  onAction: (a: ActionStockage) => Promise<void>;
  /** Carte d'alerte : « Plus tard » la cache jusqu'à demain */
  onPlusTard?: () => void;
  /** Fiche du compte : affichée même sous 85 % */
  toujours?: boolean;
}) {
  const [confirmer, setConfirmer] = useState<Option | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const agir = async (cle: string, a: ActionStockage) => {
    setEnCours(cle);
    setErreur(null);
    try {
      await onAction(a);
      if (a.kind === 'copie') setCopie(true);
      else if (a.kind !== 'google') setConfirmer(null);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(null);
    }
  };
  if (!plan.alerte && !toujours) return null;
  const illimite = quota.limite <= 0;
  const couleur = plan.alerte ? ROUGE : plan.taux >= SEUIL_CIBLE ? colors.warning : colors.success;

  return (
    <View style={[s.carte, !plan.alerte && s.carteOk]} accessibilityRole="summary">
      <Text style={[s.titre, { color: plan.alerte ? ROUGE : colors.text }]}>
        {plan.alerte ? '⚠ Stockage Google Drive presque plein' : '☁️ Stockage Google Drive'}
      </Text>
      {!illimite && (
        <View style={[s.jauge, { backgroundColor: plan.alerte ? '#F1D4D0' : '#E6EAF0' }]}>
          <View style={[s.plein, { width: `${Math.min(100, Math.round(plan.taux * 100))}%`, backgroundColor: couleur }]} />
        </View>
      )}
      <Text style={s.petit}>
        {illimite
          ? `${taille(quota.utilise)} utilisés · stockage illimité`
          : `${taille(quota.utilise)} utilisés sur ${taille(quota.limite)} (${pourcent(plan.taux)}) · alerte dès ${pourcent(SEUIL_ALERTE)}`}
      </Text>
      {plan.alerte ? (
        <Text style={s.texte}>
          Pour repasser sous {pourcent(SEUIL_CIBLE)}, il faut libérer environ <Text style={s.gras}>{taille(plan.aLiberer)}</Text>.
        </Text>
      ) : (
        <Text style={s.texte}>Tout va bien : l'alerte apparaîtra ici dès {pourcent(SEUIL_ALERTE)} du Drive rempli.</Text>
      )}

      {confirmer && confirmer.kind !== 'google' ? (
        <View style={s.confirme}>
          <Text style={s.confTitre}>{texte(confirmer, plan).titre.replace(/^\S+ /, '')} ?</Text>
          <Text style={s.confTexte}>
            {confirmer.kind === 'corbeille'
              ? `Les ${confirmer.nb} espace${confirmer.nb > 1 ? 's' : ''} de travail de la corbeille seront effacés définitivement : ils ne pourront plus être restaurés.`
              : `${confirmer.nb} tâche${confirmer.nb > 1 ? 's' : ''} terminée${confirmer.nb > 1 ? 's' : ''} avant ${moisAnnee(confirmer.avant)} seront effacées de tous les espaces de travail. Les tâches répétées et les parents de sous-tâches encore présentes sont gardés.`}
          </Text>
          {confirmer.kind === 'periode' && (
            <Pressable onPress={() => agir('copie', { kind: 'copie', avant: confirmer.avant })} style={s.btnSec} accessibilityRole="button">
              <Text style={s.btnSecText}>{copie ? '✓ Copie téléchargée' : '⬇ Télécharger une copie (CSV)'}</Text>
            </Pressable>
          )}
          <View style={s.ligne}>
            <Pressable onPress={() => setConfirmer(null)} style={s.btnSec} accessibilityRole="button">
              <Text style={s.btnSecText}>Annuler</Text>
            </Pressable>
            <Pressable
              onPress={() => agir('go', confirmer.kind === 'corbeille' ? { kind: 'corbeille' } : { kind: 'periode', avant: confirmer.avant })}
              style={s.btnDanger}
              accessibilityRole="button"
            >
              {enCours === 'go' ? <ActivityIndicator color="#fff" /> : <Text style={s.btnDangerText}>{confirmer.kind === 'corbeille' ? 'Vider' : 'Supprimer'}</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        plan.alerte &&
        plan.options.map((o) => {
          const t = texte(o, plan);
          const reco = plan.recommande === o.kind;
          return (
            <Pressable
              key={o.kind}
              onPress={() => {
                setCopie(false);
                if (o.kind === 'google') agir('google', { kind: 'google' });
                else setConfirmer(o);
              }}
              style={[s.option, reco && s.optionReco]}
              accessibilityRole="button"
              accessibilityLabel={`${reco ? 'Recommandé : ' : ''}${t.titre}`}
            >
              {reco && <Text style={s.reco}>RECOMMANDÉ</Text>}
              <Text style={s.optTitre}>{t.titre}</Text>
              <Text style={s.optDetail}>{t.detail}</Text>
            </Pressable>
          );
        })
      )}
      {!!erreur && <Text style={s.erreur}>{erreur}</Text>}
      {onPlusTard && !confirmer && (
        <Pressable onPress={onPlusTard} hitSlop={8} style={s.plusTard} accessibilityRole="button">
          <Text style={s.plusTardText}>Plus tard</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  carte: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#FFF4F2', borderWidth: 1, borderColor: '#F6C7C1', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  carteOk: { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 0 },
  titre: { fontSize: 15, fontWeight: '800' },
  jauge: { height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 8, marginBottom: 4 },
  plein: { height: '100%' },
  petit: { fontSize: 12, color: colors.muted },
  texte: { fontSize: 13, lineHeight: 19, color: '#3A4556', marginTop: 8 },
  gras: { fontWeight: '800', color: colors.text },
  option: { borderWidth: 1, borderColor: '#F6C7C1', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 8 },
  optionReco: { borderWidth: 2, borderColor: ROUGE },
  reco: { fontSize: 10.5, fontWeight: '800', color: ROUGE, letterSpacing: 0.5 },
  optTitre: { fontSize: 14, fontWeight: '700', color: colors.text },
  optDetail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  confirme: { marginTop: 10, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: '#F6C7C1', padding: 12, gap: 8 },
  confTitre: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  confTexte: { fontSize: 13, lineHeight: 19, color: '#3A4556' },
  ligne: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  btnSec: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center' },
  btnSecText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  btnDanger: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: ROUGE, minWidth: 96, alignItems: 'center' },
  btnDangerText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  erreur: { color: ROUGE, fontSize: 13, marginTop: 8 },
  plusTard: { alignSelf: 'flex-end', marginTop: 8 },
  plusTardText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
