import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EquipeEspace, RoleEquipe } from '../api';
import { libelleNature, membresDe, NATURES_PERSONNE, type Personne } from '../organisation';
import { colors } from '../theme';
import { ChampFiche, FeuilleChoix, LigneChoix, SaisieFiche, SectionFiche } from './Choix';
import { DeleteSection } from './DeleteSection';
import { FormSheet, TitreFiche } from './FormSheet';

/**
 * Onglet 👥 Équipe (espace Équipe, hors entreprise) : les rôles (Product Owner, Scrum Master) et les membres, rangés
 * dans le Google Sheet de l'équipe (onglets Personnes et EquipesAgiles). « ＋ » : nouveau membre, ou une personne
 * déjà connue ailleurs (autres espaces, conversations Synchro) — proposé seulement s'il y en a.
 */
export interface EquipeAffichee {
  espace: { id: string; nom: string };
  donnees: EquipeEspace;
}
export interface PersonneConnue {
  nom: string;
  email: string;
  nature: string;
  /** Où on la connaît (« 🏢 ACME », « 🔄 Synchronisation ») */
  ou: string;
}
type Ecrire = (espace: string, nomEquipe: string, m: { personne?: Partial<Personne> & { id?: string }; role?: RoleEquipe; retirer?: string }) => Promise<void>;

interface Props {
  equipes: EquipeAffichee[];
  connues: PersonneConnue[];
  moi: string;
  onEcrire: Ecrire;
}

const ICONE: Record<string, string> = { humain: '🧑', ia_chat: '💬', agent_ia: '🤖' };
const roleDe = (pid: string, eq?: { po: string; sm: string }): RoleEquipe => (eq?.po === pid ? 'po' : eq?.sm === pid ? 'sm' : 'membre');
const ROLES: { value: RoleEquipe; label: string }[] = [
  { value: 'membre', label: 'Membre' },
  { value: 'po', label: 'Product Owner' },
  { value: 'sm', label: 'Scrum Master' },
];

export function EquipeView({ equipes, connues, moi, onEcrire }: Props) {
  const [fiche, setFiche] = useState<{ espace: EquipeAffichee; membre: Personne | null } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const ecrire: Ecrire = async (...a) => {
    setErreur(null);
    try {
      await onEcrire(...a);
    } catch (e) {
      setErreur(`Non enregistré : ${(e as Error).message}`);
    }
  };
  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      {!!erreur && <Text style={s.erreur}>{erreur}</Text>}
      {equipes.map((x) => {
        const eq = x.donnees.equipes[0];
        const ids = eq ? membresDe(eq) : [];
        const membres = ids.map((id) => x.donnees.personnes.find((p) => p.id === id)).filter((p): p is Personne => !!p);
        const options = [{ options: membres.map((p) => ({ value: p.id, label: p.nom })) }];
        const nom = (id: string) => membres.find((p) => p.id === id)?.nom ?? '';
        return (
          <View key={x.espace.id} style={s.bloc}>
            {/* Plusieurs équipes affichées : le nom de chacune ; une seule : le titre de l'écran suffit */}
            {equipes.length > 1 && <Text style={s.titre}>{x.espace.nom}</Text>}
            <SectionFiche titre="Rôles">
              <LigneChoix
                fixe
                label="Product Owner"
                value={eq?.po ?? ''}
                vide={membres.length ? 'À choisir' : 'Ajoutez des membres'}
                fige={!membres.length}
                groupes={options}
                libelle={nom}
                sans="Aucun Product Owner"
                onChange={(v) => void ecrire(x.espace.id, x.espace.nom, v ? { personne: { id: v }, role: 'po' } : { personne: { id: eq!.po }, role: 'membre' })}
              />
              <LigneChoix
                fixe
                label="Scrum Master"
                value={eq?.sm ?? ''}
                vide={membres.length ? 'À choisir' : 'Ajoutez des membres'}
                fige={!membres.length}
                groupes={options}
                libelle={nom}
                sans="Aucun Scrum Master"
                onChange={(v) => void ecrire(x.espace.id, x.espace.nom, v ? { personne: { id: v }, role: 'sm' } : { personne: { id: eq!.sm }, role: 'membre' })}
              />
            </SectionFiche>
            <SectionFiche titre={`Membres · ${membres.length}`} onAjouter={() => setFiche({ espace: x, membre: null })} ajouterLabel="Nouveau membre">
              {membres.map((p, k) => {
                const r = roleDe(p.id, eq);
                const vous = !!moi && p.email.toLowerCase() === moi.toLowerCase() && p.nom.toLowerCase() !== 'vous';
                return (
                  <Pressable key={p.id} onPress={() => setFiche({ espace: x, membre: p })} style={[s.ligne, k > 0 && s.bord]} accessibilityRole="button">
                    <Text style={s.avatar}>{ICONE[p.nature || 'humain'] ?? '🧑'}</Text>
                    <View style={s.corps}>
                      <Text style={s.nom}>
                        {p.nom}
                        {vous ? ' (vous)' : ''} {r !== 'membre' && <Text style={s.tag}> {r.toUpperCase()} </Text>}
                      </Text>
                      <Text style={s.meta}>
                        {libelleNature(p.nature).replace(/^\S+ /, '')} · {p.email || (r === 'membre' ? 'Membre' : ROLES.find((o) => o.value === r)?.label)}
                      </Text>
                    </View>
                    <Text style={s.chev}>›</Text>
                  </Pressable>
                );
              })}
              {!membres.length && <Text style={s.vide}>Aucun membre : touchez ＋ pour ajouter le premier.</Text>}
            </SectionFiche>
          </View>
        );
      })}
      <MembreForm
        visible={!!fiche}
        equipe={fiche?.espace ?? null}
        membre={fiche?.membre ?? null}
        connues={connues.filter((c) => !c.email || !fiche?.espace.donnees.personnes.some((p) => p.email.toLowerCase() === c.email.toLowerCase()))}
        onClose={() => setFiche(null)}
        onEcrire={onEcrire}
      />
    </ScrollView>
  );
}

function MembreForm({
  visible,
  equipe,
  membre,
  connues,
  onClose,
  onEcrire,
}: {
  visible: boolean;
  equipe: EquipeAffichee | null;
  membre: Personne | null;
  connues: PersonneConnue[];
  onClose: () => void;
  onEcrire: Ecrire;
}) {
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [nature, setNature] = useState('humain');
  const [role, setRole] = useState<RoleEquipe | ''>('');
  const [choisir, setChoisir] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ouvertPour, setOuvertPour] = useState<string | null>(null);
  const eq = equipe?.donnees.equipes[0];
  // Remise à zéro à chaque ouverture
  const cle = visible ? membre?.id ?? '·' : null;
  if (cle !== ouvertPour) {
    setOuvertPour(cle);
    if (visible) {
      setNom(membre?.nom ?? '');
      setEmail(membre?.email ?? '');
      setNature(membre?.nature || 'humain');
      setRole(membre ? roleDe(membre.id, eq) : '');
      setError(null);
    }
  }
  if (!equipe) return null;
  const enregistrer = async (m: Parameters<Ecrire>[2]) => {
    setBusy(true);
    setError(null);
    try {
      await onEcrire(equipe.espace.id, equipe.espace.nom, m);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    if (!nom.trim()) return setError('Écrivez le nom du membre.');
    if (!role) return setError('Choisissez son rôle dans l’équipe.');
    void enregistrer({ personne: { ...(membre ? { id: membre.id } : {}), nom: nom.trim(), email: email.trim(), nature }, role });
  };
  const aDefinir = role ? 0 : 1;
  return (
    <FormSheet visible={visible} title={membre ? 'Membre' : 'Nouveau membre'} busy={busy} error={error} onClose={onClose} onSave={save}>
      <TitreFiche icone={ICONE[nature] ?? '🧑'} titre={nom} vide="Nom du membre" sous={`👥 ${equipe.espace.nom}`} />
      <SectionFiche titre="Personne">
        <ChampFiche label="Nom">
          <SaisieFiche placeholder="À écrire" value={nom} onChangeText={setNom} autoFocus={!membre} />
        </ChampFiche>
        <ChampFiche label="E-mail">
          <SaisieFiche placeholder="Pour partager l'espace" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </ChampFiche>
        <LigneChoix fixe label="Type" value={nature} groupes={[{ options: NATURES_PERSONNE }]} onChange={(v) => v && setNature(v)} />
      </SectionFiche>
      <SectionFiche titre="Dans l'équipe" aDefinir={aDefinir}>
        <LigneChoix
          fixe
          attendu
          label="Rôle"
          value={role}
          groupes={[{ options: ROLES.map((r) => ({ ...r, meta: r.value === 'po' && eq?.po && eq.po !== membre?.id ? 'remplace l’actuel' : r.value === 'sm' && eq?.sm && eq.sm !== membre?.id ? 'remplace l’actuel' : undefined })) }]}
          onChange={(v) => setRole(v as RoleEquipe)}
        />
      </SectionFiche>
      <Text style={s.aide}>Un seul Product Owner et un seul Scrum Master. L'e-mail servira à partager le Google Sheet de l'équipe (lot 3).</Text>
      {/* Choisir une personne connue : seulement si on en connaît ailleurs (autres espaces, Synchro) */}
      {!membre && connues.length > 0 && (
        <SectionFiche titre="Ou">
          <Pressable onPress={() => setChoisir(true)} style={s.ligne} accessibilityRole="button">
            <Text style={s.lien}>☑ Choisir une personne connue</Text>
            <Text style={s.meta}>{connues.length}</Text>
            <Text style={s.chev}>›</Text>
          </Pressable>
        </SectionFiche>
      )}
      {choisir && (
        <FeuilleChoix
          titre="Personne connue"
          value=""
          groupes={[{ options: connues.map((c) => ({ value: c.email || c.nom, label: `${ICONE[c.nature] ?? '🧑'} ${c.nom}`, meta: c.ou })) }]}
          onChoisir={(v) => {
            setChoisir(false);
            const c = connues.find((x) => (x.email || x.nom) === v);
            if (c) {
              setNom(c.nom);
              setEmail(c.email);
              setNature(c.nature || 'humain');
            }
          }}
          onFermer={() => setChoisir(false)}
        />
      )}
      {!!membre && (
        <DeleteSection label="Retirer de l'équipe" name={membre.nom} disabled={busy} onDelete={() => void enregistrer({ retirer: membre.id })} />
      )}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 130 },
  bloc: { marginHorizontal: 16 },
  titre: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  erreur: { marginHorizontal: 16, marginTop: 12, color: colors.danger, fontWeight: '600' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46 },
  bord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF1F6', textAlign: 'center', lineHeight: 32, fontSize: 17, overflow: 'hidden' },
  corps: { flex: 1, gap: 2 },
  nom: { fontSize: 15, fontWeight: '700', color: colors.text },
  tag: { fontSize: 11, fontWeight: '800', color: colors.primary, backgroundColor: '#E8F0FE' },
  meta: { fontSize: 12.5, color: colors.muted },
  chev: { fontSize: 18, color: '#A0A6B1' },
  vide: { padding: 12, fontSize: 13, color: colors.muted },
  aide: { fontSize: 12.5, color: colors.muted, marginTop: 8, marginHorizontal: 4 },
  lien: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.primary },
});
