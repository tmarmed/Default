import { StyleSheet, Text, View } from 'react-native';
import { useHierarchy } from '../hierarchyContext';
import { makeOrgValue, membresDe, nomPersonne, porteurs, useOrg } from '../organisation';
import { useSafe } from '../safe';
import { colors } from '../theme';
import { Chips } from './Chips';
import { formStyles as f, Label } from './FormSheet';

type Valeurs = { portfolio?: string; train?: string; equipe?: string; responsable?: string; epic?: string; feature?: string };

/**
 * Liaison avec l'Organisation dans la fiche d'un élément de travail (mode SAFe, entreprise avec un delivery) :
 * epic → portfolio ; feature → train et équipe ; story ou tâche → équipe et responsable. Un fil d'Ariane montre
 * les deux chemins : organisation (portfolio › train › équipe · personne) et travail (epic › feature).
 */
export function LiaisonOrg({ espace, niveau, valeurs, onChange }: { espace: string; niveau: 'epic' | 'feature' | 'item'; valeurs: Valeurs; onChange: (patch: Valeurs) => void }) {
  const safe = useSafe();
  const tout = useOrg();
  const h = useHierarchy();
  const dans = <T extends { espace?: string }>(l: T[]) => l.filter((x) => (x.espace || 'moi') === espace);
  const o = makeOrgValue({ personnes: dans(tout.personnes), unites: dans(tout.unites), portfolios: dans(tout.portfolios), trains: dans(tout.trains), equipes: dans(tout.equipes) });
  if (!safe.actif || !o.delivery) return null;

  const p = porteurs(valeurs, h, o);
  const epic = valeurs.epic ? h.epics.get(valeurs.epic) : valeurs.feature ? h.epics.get(h.features.get(valeurs.feature)?.epic ?? '') : undefined;
  const feature = valeurs.feature ? h.features.get(valeurs.feature) : undefined;
  const cheminOrg = [
    p.portfolio ? `💼 ${o.portfolio.get(p.portfolio)?.nom ?? '?'}` : '',
    p.train ? `🚆 ${o.train.get(p.train)?.nom ?? '?'}` : '',
    p.equipe ? `👥 ${o.equipe.get(p.equipe)?.nom ?? '?'}` : '',
  ].filter(Boolean);
  const responsable = niveau === 'item' ? nomPersonne(o, valeurs.responsable) : '';
  const cheminTravail = [epic ? `Epic ${epic.titre}` : '', feature && niveau === 'item' ? `Feature ${feature.titre}` : ''].filter(Boolean);

  const equipe = valeurs.equipe ? o.equipe.get(valeurs.equipe) : undefined;
  const equipesProposees = niveau === 'feature' && valeurs.train ? o.equipes.filter((e) => e.train === valeurs.train) : o.equipes;
  const gensEquipe = equipe ? new Set([...membresDe(equipe), equipe.po, equipe.sm].filter(Boolean)) : null;
  const responsables = [...o.personnes].filter((x) => !gensEquipe || gensEquipe.has(x.id)).sort((a, b) => a.nom.localeCompare(b.nom));

  return (
    <View>
      <Label>Delivery (organisation)</Label>
      {(cheminOrg.length > 0 || cheminTravail.length > 0) && (
        <View style={s.ariane} accessibilityLabel="Fil d'Ariane">
          {cheminOrg.length > 0 && (
            <Text style={s.arianeTexte}>
              {cheminOrg.join(' › ')}
              {responsable ? ` · ${responsable}` : ''}
            </Text>
          )}
          {cheminTravail.length > 0 && <Text style={s.arianeTravail}>{cheminTravail.join(' › ')}</Text>}
        </View>
      )}
      {niveau === 'epic' && (
        <>
          <Text style={s.sousLabel}>Portfolio</Text>
          <Chips options={[{ value: '', label: 'Aucun' }, ...o.portfolios.map((x) => ({ value: x.id, label: `💼 ${x.nom}` }))]} value={valeurs.portfolio ?? ''} onChange={(v) => onChange({ portfolio: v })} compact wrap />
        </>
      )}
      {niveau === 'feature' && (
        <>
          <Text style={s.sousLabel}>Train</Text>
          <Chips
            options={[{ value: '', label: 'Aucun' }, ...o.trains.map((x) => ({ value: x.id, label: `🚆 ${x.nom}` }))]}
            value={valeurs.train ?? ''}
            onChange={(v) => onChange({ train: v, equipe: v && equipe && equipe.train !== v ? '' : (valeurs.equipe ?? '') })}
            compact
            wrap
          />
          <Text style={s.sousLabel}>Équipe qui la réalise</Text>
          <Chips
            options={[{ value: '', label: 'Aucune' }, ...equipesProposees.map((x) => ({ value: x.id, label: `👥 ${x.nom}` }))]}
            value={valeurs.equipe ?? ''}
            onChange={(v) => onChange({ equipe: v, train: v ? (o.equipe.get(v)?.train ?? valeurs.train ?? '') : (valeurs.train ?? '') })}
            compact
            wrap
          />
        </>
      )}
      {niveau === 'item' && (
        <>
          <Text style={s.sousLabel}>Équipe</Text>
          <Chips
            options={[{ value: '', label: feature?.equipe ? 'Celle de la feature' : 'Aucune' }, ...o.equipes.map((x) => ({ value: x.id, label: `👥 ${x.nom}` }))]}
            value={valeurs.equipe ?? ''}
            onChange={(v) => {
              const eq = v ? o.equipe.get(v) : undefined;
              const garde = !eq || !valeurs.responsable || [...membresDe(eq), eq.po, eq.sm].includes(valeurs.responsable);
              onChange({ equipe: v, responsable: garde ? (valeurs.responsable ?? '') : '' });
            }}
            compact
            wrap
          />
          <Text style={s.sousLabel}>Responsable{equipe ? ` (membres de 👥 ${equipe.nom})` : ''}</Text>
          {responsables.length ? (
            <Chips options={[{ value: '', label: 'Non attribuée' }, ...responsables.map((x) => ({ value: x.id, label: x.nom }))]} value={valeurs.responsable ?? ''} onChange={(v) => onChange({ responsable: v })} compact wrap />
          ) : (
            <Text style={f.muted}>Aucun membre dans cette équipe.</Text>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  ariane: { backgroundColor: '#F4F6FA', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8, gap: 3 },
  arianeTexte: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  arianeTravail: { fontSize: 12, color: colors.muted },
  sousLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 8, marginBottom: 6 },
});
