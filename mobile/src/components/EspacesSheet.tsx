import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Espace, ICONE_ESPACE, LIBELLE_ESPACE, libelleEspace, nomFichier, type TypeEspace } from '../espaces';
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
  /** Espaces retirés (Google Sheet gardé) : Rétablir */
  retires: Espace[];
  onRetablir: (e: Espace) => Promise<void>;
  /** Corbeille (30 jours) ; null = en cours de lecture : Restaurer */
  corbeille: Espace[] | null;
  onRestaurer: (e: Espace) => Promise<void>;
}

/**
 * ＋ (bloc Espaces) : créer un espace (Équipe ou Entreprise ; « Moi » existe toujours) avec ses domaines, ou
 * récupérer un espace (retiré : Rétablir ; dans la corbeille : Restaurer). Hors démo, l'application crée le Google
 * Sheet de l'espace dans le Drive du compte connecté. Après la création, un message le confirme ; « OK » referme.
 * (Retirer, supprimer : −.)
 */
export function EspacesSheet({ visible, espaces, nomApp, demo, onClose, onAdd, retires, onRetablir, corbeille, onRestaurer }: Props) {
  // Domaines du nouvel espace, saisis rapidement (propres à l'espace)
  const [domaines, setDomaines] = useState<string[]>([]);
  const [saisie, setSaisie] = useState('');
  const [type, setType] = useState<TypeEspace>('equipe');
  const [nom, setNom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Espace créé : message de confirmation (OK referme) */
  const [cree, setCree] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCree(null);
      setEnCours(null);
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
      const doms = modeles();
      await onAdd({ id: `${type}-${Date.now()}`, type, nom: n }, doms);
      setCree(
        `${ICONE_ESPACE[type]} ${n}${doms.length ? ` avec ${doms.length} domaine${doms.length > 1 ? 's' : ''} (${doms.map((d) => d.nom).join(', ')})` : ''}`,
      );
    } catch (e) {
      setError(`Espace non ajouté : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const recuperer = async (cle: string, action: () => Promise<void>) => {
    setEnCours(cle);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnCours(null);
    }
  };

  if (cree)
    return (
      <FormSheet visible={visible} title="＋ Ajouter un espace" busy={false} error={null} onClose={onClose}>
        <View style={s.succes}>
          <View style={s.coche}>
            <Text style={s.cocheText}>✓</Text>
          </View>
          <Text style={s.succesTitre}>Espace créé</Text>
          <Text style={s.succesTexte}>{cree}</Text>
          <Text style={f.hint}>Il est affiché dans le bloc Espaces.</Text>
          <Pressable onPress={onClose} style={[s.ok, s.okLarge]} accessibilityRole="button">
            <Text style={s.okText}>OK</Text>
          </Pressable>
        </View>
      </FormSheet>
    );

  return (
    <FormSheet visible={visible} title="＋ Ajouter un espace" busy={busy || !!enCours} error={error} onClose={onClose} onSave={save}>
      <Label>Nouvel espace</Label>
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
      <Pressable onPress={save} disabled={busy} style={[s.ok, !nom.trim() && s.okOff]} accessibilityRole="button">
        <Text style={s.okText}>{busy ? '…' : "Créer l'espace"}</Text>
      </Pressable>

      <Label>Récupérer</Label>
      {retires.length === 0 && corbeille !== null && corbeille.length === 0 && <Text style={f.muted}>Aucun espace retiré ni dans la corbeille.</Text>}
      {retires.map((e) => (
        <View key={`r-${e.id}`} style={s.ligne}>
          <View style={s.flex}>
            <Text style={s.nom} numberOfLines={1}>
              {ICONE_ESPACE[e.type]} {libelleEspace(e)}
            </Text>
            <Text style={s.sub}>Retiré · son Google Sheet est gardé</Text>
          </View>
          <Pressable onPress={() => recuperer(`r-${e.id}`, () => onRetablir(e))} disabled={!!enCours} style={s.btn} accessibilityRole="button" accessibilityLabel={`Rétablir ${libelleEspace(e)}`}>
            <Text style={s.btnText}>{enCours === `r-${e.id}` ? '…' : 'Rétablir'}</Text>
          </Pressable>
        </View>
      ))}
      {corbeille === null ? (
        <Text style={f.muted}>Lecture de la corbeille de Google Drive…</Text>
      ) : (
        corbeille.map((e) => (
          <View key={`c-${e.id}`} style={s.ligne}>
            <View style={s.flex}>
              <Text style={s.nom} numberOfLines={1}>
                {ICONE_ESPACE[e.type]} {libelleEspace(e)}
              </Text>
              <Text style={s.sub}>{demo ? 'Supprimé : récupérable 30 jours' : 'Corbeille de Google Drive : récupérable 30 jours'}</Text>
            </View>
            <Pressable onPress={() => recuperer(`c-${e.id}`, () => onRestaurer(e))} disabled={!!enCours} style={s.btn} accessibilityRole="button" accessibilityLabel={`Restaurer ${libelleEspace(e)}`}>
              <Text style={s.btnText}>{enCours === `c-${e.id}` ? '…' : 'Restaurer'}</Text>
            </Pressable>
          </View>
        ))
      )}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  doms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  dom: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  domText: { fontSize: 14, color: colors.text },
  ok: { marginTop: 12, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  okOff: { opacity: 0.45 },
  okLarge: { alignSelf: 'stretch' },
  okText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  flex: { flex: 1, minWidth: 0 },
  nom: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  btn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#B9D2F8' },
  btnText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  succes: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  coche: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E6F4EA', alignItems: 'center', justifyContent: 'center' },
  cocheText: { color: colors.success, fontSize: 26, fontWeight: '900' },
  succesTitre: { fontSize: 18, fontWeight: '800', color: colors.text },
  succesTexte: { fontSize: 14, color: colors.text, textAlign: 'center', lineHeight: 20 },
});
