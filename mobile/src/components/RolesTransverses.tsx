/**
 * Rôles transverses (13/10, session 3 ; docs/regles-reunions.html bloc 15) : section de la fiche d'un niveau (équipe,
 * train, portfolio, entreprise) — saisie — et de la fiche d'une personne — lecture.
 */
import { dateFr } from '../format';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMoi } from '../droits';
import { nomPersonne, optionsPersonnes, type OrgValue } from '../organisation';
import { colors } from '../theme';
import { ecrireTransverses, libelleRole, lireTransverses, peutDonner, type RoleTransverse, ROLES_TRANSVERSES, type Transverse } from '../transverses';
import { LigneChoix, LigneEnfant, SectionFiche } from './Choix';
import { DateField } from './DateField';
import { Pastilles } from './reunion/ui';

type Niv = { kind: 'equipeagile' | 'train' | 'portfolio' | 'unite'; id: string };

const detail = (t: Transverse, org: OrgValue) =>
  [libelleRole(t.role), t.role === 'suppleant' && t.remplace ? `de ${nomPersonne(org, t.remplace)}` : '', t.du || t.au ? `${t.du ? `du ${dateFr(t.du)}` : ''}${t.au ? ` au ${dateFr(t.au)}` : ''}`.trim() : '']
    .filter(Boolean)
    .join(' · ');

/** Fiche d'un niveau : liste, ajout et retrait (selon « qui peut donner ») */
export function SectionRolesTransverses({ niveau, value, onChange, org, safe }: { niveau: Niv | null; value: string; onChange: (v: string) => void; org: OrgValue; safe: boolean }) {
  const moi = useMoi();
  const l = lireTransverses(value);
  const [ajout, setAjout] = useState<Transverse | null>(null);
  // Sans personne connue (pas d'Organisation chargée pour vous) : tous les droits
  const peut = (role: RoleTransverse, remplace = '') => !moi || !org.personne.has(moi) || (!!niveau && peutDonner(moi, role, niveau, org, remplace));
  const roles = ROLES_TRANSVERSES.filter((r) => safe || !r.safeSeulement);
  const personnes = { groupes: [{ options: optionsPersonnes(org.personnes) }] };
  const valider = () => {
    if (!ajout || !ajout.personne) return;
    onChange(ecrireTransverses([...l, ajout]));
    setAjout(null);
  };
  return (
    <SectionFiche titre={`Rôles transverses · ${l.length}`} onAjouter={niveau && !ajout ? () => setAjout({ personne: '', role: roles[0].v, du: '', au: '', remplace: '' }) : undefined} ajouterLabel="Rôle transverse">
      {l.map((t, i) => (
        <View key={`${t.personne}-${t.role}-${i}`} style={s.ligne}>
          <View style={{ flex: 1 }}>
            <LigneEnfant texte={nomPersonne(org, t.personne) || '?'} meta={detail(t, org)} />
          </View>
          {peut(t.role, t.remplace) && (
            <Pressable onPress={() => onChange(ecrireTransverses(l.filter((_, j) => j !== i)))} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Retirer le rôle de ${nomPersonne(org, t.personne)}`}>
              <Text style={s.retirer}>✕</Text>
            </Pressable>
          )}
        </View>
      ))}
      {!l.length && !ajout && <Text style={s.vide}>{niveau ? 'Aucun. ＋ pour donner un rôle à une personne en dehors de son rôle principal.' : 'Enregistrez d’abord la fiche.'}</Text>}
      {ajout && (
        <View style={s.ajout}>
          <LigneChoix label="Personne" value={ajout.personne} onChange={(v) => setAjout({ ...ajout, personne: v })} {...personnes} attendu />
          <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
            <Pastilles petit options={roles.map((r) => ({ value: r.v, label: r.l }))} value={ajout.role} onChange={(v) => setAjout({ ...ajout, role: v as RoleTransverse })} />
            <Text style={s.vide}>{roles.find((r) => r.v === ajout.role)?.sous}</Text>
          </View>
          {ajout.role === 'suppleant' && (
            <>
              <LigneChoix label="Remplace" value={ajout.remplace} onChange={(v) => setAjout({ ...ajout, remplace: v })} {...personnes} attendu />
              <View style={s.dates}>
                <Text style={s.vide}>Du</Text>
                <DateField mode="date" value={ajout.du} onChange={(v) => setAjout({ ...ajout, du: v })} placeholder="Début" />
                <Text style={s.vide}>au</Text>
                <DateField mode="date" value={ajout.au} onChange={(v) => setAjout({ ...ajout, au: v })} placeholder="Fin" />
              </View>
            </>
          )}
          {!!ajout.personne && !peut(ajout.role, ajout.remplace) && <Text style={s.refus}>Seul le responsable du niveau (ou du dessus) peut donner ce rôle ; chacun peut nommer son propre Suppléant.</Text>}
          <View style={s.boutons}>
            <Pressable onPress={() => setAjout(null)} accessibilityRole="button">
              <Text style={s.annuler}>Annuler</Text>
            </Pressable>
            <Pressable
              onPress={valider}
              disabled={!ajout.personne || !peut(ajout.role, ajout.remplace) || (ajout.role === 'suppleant' && !ajout.remplace)}
              style={[s.ok, (!ajout.personne || !peut(ajout.role, ajout.remplace) || (ajout.role === 'suppleant' && !ajout.remplace)) && { opacity: 0.4 }]}
              accessibilityRole="button"
            >
              <Text style={s.okTexte}>Donner le rôle</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SectionFiche>
  );
}

/** Fiche d'une personne : ses rôles transverses, en lecture */
export function RolesDeLaPersonne({ pid, org }: { pid: string; org: OrgValue }) {
  const sources: [string, { id: string; nom: string; transverses?: string }[]][] = [
    ['👥', org.equipes],
    ['🚆', org.trains],
    ['💼', org.portfolios],
    ['🏢', org.unites],
  ];
  const l = sources.flatMap(([icone, xs]) => xs.flatMap((x) => lireTransverses(x.transverses).filter((t) => t.personne === pid).map((t) => ({ t, ou: `${icone} ${x.nom}` }))));
  if (!l.length) return null;
  return (
    <SectionFiche titre={`Rôles transverses · ${l.length}`}>
      {l.map(({ t, ou }, i) => (
        <LigneEnfant key={i} texte={`${libelleRole(t.role)} · ${ou}`} meta={detail(t, org).split(' · ').slice(1).join(' · ') || 'Donné dans la fiche du niveau (et ceux du dessous)'} />
      ))}
    </SectionFiche>
  );
}

const s = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', paddingRight: 14 },
  retirer: { fontSize: 16, color: colors.muted ?? '#667085', paddingHorizontal: 6 },
  vide: { fontSize: 13, color: '#667085', paddingHorizontal: 14, paddingVertical: 6 },
  refus: { fontSize: 13, color: '#B3261E', paddingHorizontal: 14, paddingVertical: 6 },
  ajout: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  dates: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 6 },
  boutons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, padding: 12 },
  annuler: { fontSize: 15, color: colors.primary },
  ok: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  okTexte: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
