import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Espace, ICONE_ESPACE, LIBELLE_ESPACE, libelleEspace, nomFichier, type TypeEspace } from '../espaces';
import { colors } from '../theme';
import { Chips } from './Chips';
import { Field, FormSheet, formStyles as f, Label } from './FormSheet';

interface Props {
  visible: boolean;
  espaces: Espace[];
  /** Nom de l'application (début du nom des fichiers) */
  nomApp: string;
  /** Démo : un nouvel espace est stocké dans le navigateur, sans Google Sheet */
  demo: boolean;
  onClose: () => void;
  onAdd: (e: Espace) => Promise<void>;
  onRemove: (e: Espace) => void;
}

/**
 * Espaces : la liste, et la création d'un espace avec son type (Équipe ou Entreprise ; « Moi » existe toujours).
 * En attendant la connexion Google directe (détection et création automatiques des fichiers), un espace se
 * relie à son Google Sheet par l'adresse de son script et sa clé.
 */
export function EspacesSheet({ visible, espaces, nomApp, demo, onClose, onAdd, onRemove }: Props) {
  const [type, setType] = useState<TypeEspace>('equipe');
  const [nom, setNom] = useState('');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrait, setRetrait] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setType('equipe');
      setNom('');
      setUrl('');
      setKey('');
      setError(null);
      setRetrait(null);
    }
  }, [visible]);

  const save = async () => {
    const n = nom.trim();
    if (!n) return setError("Donnez un nom à l'espace.");
    if (espaces.some((e) => e.type === type && e.nom.trim().toLowerCase() === n.toLowerCase()))
      return setError(`Un espace ${LIBELLE_ESPACE[type]} « ${n} » existe déjà.`);
    if (!demo && (!url.trim() || !key.trim())) return setError("Indiquez l'adresse du script et la clé de son Google Sheet.");
    setError(null);
    setBusy(true);
    try {
      await onAdd({ id: `${type}-${Date.now()}`, type, nom: n, ...(demo ? {} : { url: url.trim(), key: key.trim() }) });
      onClose();
    } catch (e) {
      setError(`Espace non ajouté : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet visible={visible} title="Espaces" busy={busy} error={error} onClose={onClose} onSave={save}>
      <Label>Mes espaces</Label>
      {espaces.map((e) => (
        <View key={e.id} style={s.row}>
          <View style={s.flex}>
            <Text style={s.nom}>
              {ICONE_ESPACE[e.type]} {libelleEspace(e)}
            </Text>
            <Text style={s.sub} numberOfLines={1}>
              {LIBELLE_ESPACE[e.type]} · fichier « {nomFichier(nomApp, e)} »
            </Text>
          </View>
          {e.id !== 'moi' &&
            (retrait === e.id ? (
              <Pressable onPress={() => onRemove(e)} hitSlop={6} accessibilityRole="button">
                <Text style={s.danger}>Confirmer</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setRetrait(e.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Retirer ${libelleEspace(e)}`}>
                <Text style={s.retirer}>Retirer</Text>
              </Pressable>
            ))}
        </View>
      ))}
      <Text style={f.hint}>Retirer un espace l'enlève de l'application ; son Google Sheet n'est pas supprimé.</Text>

      <Label>Créer un espace</Label>
      <Chips
        options={[
          { value: 'equipe', label: `${ICONE_ESPACE.equipe} Équipe` },
          { value: 'entreprise', label: `${ICONE_ESPACE.entreprise} Entreprise` },
        ]}
        value={type}
        onChange={(v) => setType(v as TypeEspace)}
      />
      <Field style={f.titleInput} placeholder={type === 'equipe' ? "Nom de l'équipe (ex. Mobile)" : "Nom de l'entreprise (ex. ACME)"} value={nom} onChangeText={setNom} />
      {!!nom.trim() && <Text style={f.hint}>Fichier : « {nomFichier(nomApp, { type, nom })} »</Text>}
      {!demo && (
        <>
          <Label>Google Sheet de l'espace</Label>
          <Field placeholder="Adresse du script (…/exec)" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} />
          <Field placeholder="Clé d'accès" value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} />
          <Text style={f.hint}>
            En attendant la connexion Google directe (détection et création automatiques des fichiers), un espace se relie
            à son Google Sheet par son script et sa clé, comme l'espace Moi.
          </Text>
        </>
      )}
      {demo && <Text style={f.hint}>Démo : l'espace est créé dans ce navigateur, vide.</Text>}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  flex: { flex: 1, minWidth: 0 },
  nom: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  retirer: { color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },
  danger: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});
