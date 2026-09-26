import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Espace, ICONE_ESPACE, LIBELLE_ESPACE, libelleEspace, nomFichier } from '../espaces';
import { colors } from '../theme';
import { FormSheet, formStyles as f, Label } from './FormSheet';

interface Props {
  visible: boolean;
  espaces: Espace[];
  nomApp: string;
  demo: boolean;
  onClose: () => void;
  /** Retirer : l'espace quitte l'application, son Google Sheet est gardé */
  onRetirer: (e: Espace) => Promise<void>;
  /** Supprimer : le Google Sheet part à la corbeille de Google Drive (30 jours) */
  onSupprimer: (e: Espace) => Promise<void>;
  retires: Espace[];
  onRetablir: (e: Espace) => Promise<void>;
  /** Corbeille ; null = en cours de lecture */
  corbeille: Espace[] | null;
  onRestaurer: (e: Espace) => Promise<void>;
}

/**
 * « Gérer » : tous les espaces au même endroit. Mes espaces (Retirer / Supprimer, sauf Moi), espaces retirés
 * (Rétablir), corbeille de Google Drive (Restaurer, 30 jours). Créer un espace : « ＋ Espace ».
 */
export function GererEspacesSheet({ visible, espaces, nomApp, demo, onClose, onRetirer, onSupprimer, retires, onRetablir, corbeille, onRestaurer }: Props) {
  const [enCours, setEnCours] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setEnCours(null);
      setConfirmer(null);
      setError(null);
    }
  }, [visible]);

  const agir = async (cle: string, action: () => Promise<void>) => {
    setEnCours(cle);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnCours(null);
      setConfirmer(null);
    }
  };

  const Ligne = ({ e, sous, children }: { e: Espace; sous: string; children?: React.ReactNode }) => (
    <View style={s.row}>
      <View style={s.flex}>
        <Text style={s.nom}>
          {ICONE_ESPACE[e.type]} {libelleEspace(e)}
        </Text>
        <Text style={s.sub} numberOfLines={2}>
          {sous}
        </Text>
      </View>
      {children}
    </View>
  );
  const Bouton = ({ label, onPress, danger, busy }: { label: string; onPress: () => void; danger?: boolean; busy?: boolean }) => (
    <Pressable onPress={onPress} disabled={!!enCours} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} style={s.btn}>
      <Text style={[s.btnText, danger && s.danger]}>{busy ? '…' : label.split(' ')[0]}</Text>
    </Pressable>
  );

  return (
    <FormSheet visible={visible} title="Mes espaces" busy={!!enCours} error={error} onClose={onClose}>
      <Label>Mes espaces</Label>
      {espaces.map((e) =>
        confirmer === e.id ? (
          <View key={e.id} style={s.confirm}>
            <Text style={s.confirmText}>
              Supprimer « {libelleEspace(e)} » ? Son Google Sheet part à la corbeille de Google Drive : récupérable 30 jours ici
              (Corbeille › Restaurer), puis effacé définitivement.{e.type !== 'moi' ? ' Espace partagé : il disparaît aussi pour les personnes qui y ont accès.' : ''}
            </Text>
            <View style={s.confirmRow}>
              <Pressable onPress={() => setConfirmer(null)} style={s.btn} accessibilityRole="button">
                <Text style={s.btnText}>Annuler</Text>
              </Pressable>
              <Pressable onPress={() => agir(e.id, () => onSupprimer(e))} style={s.btnDanger} accessibilityRole="button" accessibilityLabel={`Confirmer la suppression de ${libelleEspace(e)}`}>
                <Text style={s.btnDangerText}>{enCours === e.id ? '…' : 'Supprimer'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Ligne key={e.id} e={e} sous={`${LIBELLE_ESPACE[e.type]} · « ${nomFichier(nomApp, e)} »`}>
            {e.id !== 'moi' && (
              <>
                <Bouton label={`Retirer ${libelleEspace(e)}`} busy={enCours === e.id} onPress={() => agir(e.id, () => onRetirer(e))} />
                <Bouton label={`Supprimer ${libelleEspace(e)}`} danger onPress={() => setConfirmer(e.id)} />
              </>
            )}
          </Ligne>
        ),
      )}
      <Text style={f.hint}>
        Retirer : l'espace quitte l'application, son Google Sheet est gardé. Supprimer : le Google Sheet part à la corbeille
        (30 jours). Raccourci : appui long sur un espace, en haut de l'écran.
      </Text>

      <Label>Espaces retirés</Label>
      {retires.length === 0 ? (
        <Text style={f.muted}>Aucun.</Text>
      ) : (
        retires.map((e) => (
          <Ligne key={`r-${e.id}`} e={e} sous={`Google Sheet gardé · « ${nomFichier(nomApp, e)} »`}>
            <Bouton label={`Rétablir ${libelleEspace(e)}`} busy={enCours === `r-${e.id}`} onPress={() => agir(`r-${e.id}`, () => onRetablir(e))} />
          </Ligne>
        ))
      )}

      <Label>Corbeille (30 jours)</Label>
      {corbeille === null ? (
        <Text style={f.muted}>Lecture de la corbeille de Google Drive…</Text>
      ) : corbeille.length === 0 ? (
        <Text style={f.muted}>Vide.</Text>
      ) : (
        corbeille.map((e) => (
          <Ligne key={`c-${e.id}`} e={e} sous={demo ? 'Supprimé : récupérable 30 jours' : 'Dans la corbeille de Google Drive : récupérable 30 jours'}>
            <Bouton label={`Restaurer ${libelleEspace(e)}`} busy={enCours === `c-${e.id}`} onPress={() => agir(`c-${e.id}`, () => onRestaurer(e))} />
          </Ligne>
        ))
      )}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  flex: { flex: 1, minWidth: 0 },
  nom: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  btn: { paddingHorizontal: 8, paddingVertical: 6 },
  btnText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  danger: { color: colors.danger },
  confirm: { backgroundColor: '#FCE8E6', borderRadius: 10, padding: 12, marginBottom: 6, gap: 8 },
  confirmText: { fontSize: 13, lineHeight: 18, color: colors.text },
  confirmRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btnDanger: { backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnDangerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
