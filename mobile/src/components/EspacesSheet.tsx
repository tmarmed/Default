import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Espace, ICONE_ESPACE, LIBELLE_ESPACE, nomFichier, type TypeEspace } from '../espaces';
import { colors } from '../theme';
import { EPIC_COULEURS, type ModeleDomaine } from '../types';
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
  /** Nouvel espace, avec ses domaines saisis (créés dans son Google Sheet ; chaque espace a ses propres domaines) */
  onAdd: (e: Espace, domaines: ModeleDomaine[]) => Promise<void>;
}

/**
 * « ＋ Espace » : créer un espace (Équipe ou Entreprise ; « Moi » existe toujours), avec ses domaines. Hors démo,
 * l'application crée le Google Sheet de l'espace dans le Drive du compte connecté. (Retirer, supprimer, rétablir,
 * restaurer : « Gérer ».)
 */
export function EspacesSheet({ visible, espaces, nomApp, demo, onClose, onAdd }: Props) {
  // Domaines du nouvel espace, saisis rapidement (propres à l'espace)
  const [domaines, setDomaines] = useState<string[]>([]);
  const [saisie, setSaisie] = useState('');
  const [type, setType] = useState<TypeEspace>('equipe');
  const [nom, setNom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setType('equipe');
      setNom('');
      setError(null);
      setDomaines([]);
      setSaisie('');
    }
  }, [visible]);

  const ajouterDomaine = () => {
    const n = saisie.trim();
    if (n && !domaines.some((d) => d.toLowerCase() === n.toLowerCase())) setDomaines((l) => [...l, n]);
    setSaisie('');
  };
  const modeles = (): ModeleDomaine[] =>
    [...domaines, ...(saisie.trim() ? [saisie.trim()] : [])].map((nom, i) => ({
      nom,
      icone: '🏷️',
      couleur: EPIC_COULEURS[i % EPIC_COULEURS.length],
    }));

  const save = async () => {
    const n = nom.trim();
    if (!n) return setError("Donnez un nom à l'espace.");
    if (espaces.some((e) => e.type === type && e.nom.trim().toLowerCase() === n.toLowerCase()))
      return setError(`Un espace ${LIBELLE_ESPACE[type]} « ${n} » existe déjà.`);
    setError(null);
    setBusy(true);
    try {
      await onAdd({ id: `${type}-${Date.now()}`, type, nom: n }, modeles());
      onClose();
    } catch (e) {
      setError(`Espace non ajouté : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet visible={visible} title="Nouvel espace" busy={busy} error={error} onClose={onClose} onSave={save}>
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
      <Label>Domaines de l'espace (facultatif)</Label>
      {domaines.length > 0 && (
        <View style={s.doms}>
          {domaines.map((d, i) => (
            <Pressable
              key={d}
              onPress={() => setDomaines((l) => l.filter((x) => x !== d))}
              style={[s.dom, { borderColor: EPIC_COULEURS[i % EPIC_COULEURS.length] }]}
              accessibilityRole="button"
              accessibilityLabel={`Enlever le domaine ${d}`}
            >
              <Text style={s.domText}>
                🏷️ {d} ✕
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Field placeholder="+ Domaine (Entrée pour ajouter)" value={saisie} onChangeText={setSaisie} onSubmitEditing={ajouterDomaine} blurOnSubmit={false} returnKeyType="done" />
      <Text style={f.hint}>Chaque espace a ses propres domaines. Icône et couleur modifiables ensuite dans la fiche du domaine.</Text>
      {!demo && <Text style={f.hint}>Le Google Sheet de l'espace est créé dans votre Google Drive, avec ce nom.</Text>}
      {demo && <Text style={f.hint}>Démo : l'espace est créé dans ce navigateur.</Text>}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  doms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  dom: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  domText: { fontSize: 14, color: colors.text },
});
