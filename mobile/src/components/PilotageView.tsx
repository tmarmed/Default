import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { libelleNote } from '../daily';
import { useHierarchy } from '../hierarchyContext';
import type { OrgValue } from '../organisation';
import { nomSprintDe, piLabel } from '../pi';
import {
  decisionsDuNiveau,
  type NiveauPilotage,
  niveauxDeRoles,
  piloteEquipe,
  pilotePerso,
  pilotePortfolio,
  piloteTrain,
  suivisDuNiveau,
} from '../pilotage';
import { jourCourt } from '../pointsSuivi';
import { colors } from '../theme';
import type { Echange, PointReunion } from '../types';
import { SectionFiche } from './Choix';
import { TitreFiche } from './FormSheet';
import { Compteur, Ligne, st, Vide } from './reunion/ui';

/**
 * 📊 Pilotage (lot 5, maquette validée le 09/10 : docs/maquette-pilotage.html). Un écran par niveau, proposé selon vos
 * rôles (équipe ; RTE ou PM : train et ses équipes ; Epic Owner : portfolio ; mode Simple : 🔒 Moi). Lecture seule :
 * avancement, charge, prévisibilité, suivis de toutes les réunions du niveau, décisions prises, alertes.
 */
export function PilotageView({
  org,
  moi,
  simple,
  echanges,
  today,
  lirePoints,
  alertes,
  onOuvrirEcran,
}: {
  org: OrgValue;
  moi: string;
  simple: boolean;
  echanges: Echange[];
  today: string;
  /** Notes et suivis d'un espace (lecture gardée une minute par l'application) */
  lirePoints: (espace: string) => Promise<PointReunion[]>;
  /** Alertes par écran (« Sprint · 3 ») et leur onglet */
  alertes: { ecran: string; titre: string; n: number }[];
  onOuvrirEcran: (ecran: string) => void;
}) {
  const h = useHierarchy();
  const niveaux = useMemo(() => niveauxDeRoles(org, moi, simple), [org, moi, simple]);
  const [choisi, setChoisi] = useState('');
  const n: NiveauPilotage | undefined = niveaux.find((x) => `${x.kind}:${x.id}` === choisi) ?? niveaux[0];
  // Notes et suivis des réunions du niveau : une lecture du Sheet de l'espace (groupée par l'application)
  const [points, setPoints] = useState<PointReunion[]>([]);
  useEffect(() => {
    if (!n) return;
    let vivant = true;
    lirePoints(n.espace)
      .then((l) => vivant && setPoints(l))
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [n?.espace, lirePoints]);
  if (!n)
    return (
      <ScrollView contentContainerStyle={s.page}>
        <TitreFiche icone="📊" titre="Pilotage" vide="" sous="Aucun niveau à piloter : vos rôles (équipe, train, portfolio) viennent de l’Organisation." />
      </ScrollView>
    );
  const suivis = suivisDuNiveau(points, n, h.items, today);
  const decisions = decisionsDuNiveau(points, n);
  const nom = (m: string) => org.personnes.find((p) => p.email?.toLowerCase() === m.toLowerCase())?.nom ?? m;
  const reunionDe = (p: PointReunion) => p.reunion.split('-')[0].replace(/_/g, ' ');
  const pourcent = (x: number, ton?: string) => (
    <View style={s.jauge}>
      <View style={[s.jaugeIn, { width: `${Math.max(2, Math.min(100, x))}%` }, ton === 'rouge' && { backgroundColor: colors.danger }, ton === 'vert' && { backgroundColor: '#188038' }]} />
    </View>
  );
  const ligneJauge = (k: string, texte: string, sous: string, pct: number, ton?: string, premiere?: boolean, pastille?: { texte: string; ton: 'rouge' | 'vert' | 'orange' | 'bleu' | 'gris' }) => (
    <View key={k} style={[st.ligne, !premiere && st.bord]}>
      <View style={st.corps}>
        <Text style={st.texte}>{texte}</Text>
        {pourcent(pct, ton)}
        <Text style={st.sous}>{sous}</Text>
      </View>
      {pastille && <Text style={[s.pastille, pastille.ton === 'rouge' && s.pRouge, pastille.ton === 'vert' && s.pVert, pastille.ton === 'orange' && s.pOrange]}>{pastille.texte}</Text>}
    </View>
  );

  const blocSuivis = (
    <SectionFiche titre={`Suivis · ${suivis.enRetard.length + suivis.aValider.length + suivis.enCours.length}${suivis.notes.length ? ` · Notes à concrétiser · ${suivis.notes.length}` : ''}`}>
      {[...suivis.enRetard.map((p) => ({ p, past: { texte: 'en retard', ton: 'orange' as const } })), ...suivis.aValider.map((p) => ({ p, past: { texte: 'À valider', ton: 'vert' as const } })), ...suivis.enCours.slice(0, 5).map((p) => ({ p, past: { texte: 'En cours', ton: 'bleu' as const } })), ...suivis.notes.slice(0, 5).map((p) => ({ p, past: { texte: 'À concrétiser', ton: 'gris' as const } }))].map(({ p, past }, i) => (
        <Ligne
          key={p.id}
          premiere={i === 0}
          texte={p.texte}
          sous={[reunionDe(p), p.statut ? `Responsable : ${nom(p.responsable || p.personne)}` : `notée le ${jourCourt(p.reunion.slice(-10))} par ${nom(p.personne)}`, p.echeance ? `Échéance : ${jourCourt(p.echeance)}` : ''].filter(Boolean).join(' · ')}
          pastille={past}
        />
      ))}
      {!suivis.enRetard.length && !suivis.aValider.length && !suivis.enCours.length && !suivis.notes.length && <Vide texte="✓ Rien en attente." />}
    </SectionFiche>
  );
  const blocDecisions = (
    <SectionFiche titre={`Gouvernance · décisions prises · ${decisions.length}`}>
      {decisions.slice(0, 6).map((p, i) => (
        <Ligne key={p.id} premiere={i === 0} texte={p.texte} sous={`${reunionDe(p)} du ${jourCourt(p.reunion.slice(-10))} · ${nom(p.personne)}`} pastille={{ texte: libelleNote(p), ton: 'gris' }} />
      ))}
      {!decisions.length && <Vide texte="Aucune décision prise notée." />}
    </SectionFiche>
  );
  const blocAlertes = alertes.some((a) => a.n > 0) && (
    <SectionFiche titre="Alertes">
      {alertes
        .filter((a) => a.n > 0)
        .map((a, i) => (
          <Ligne key={a.ecran} premiere={i === 0} texte={`${a.titre} · ${a.n} alerte${a.n > 1 ? 's' : ''}`} onOuvrir={() => onOuvrirEcran(a.ecran)} />
        ))}
    </SectionFiche>
  );

  let contenu = null;
  if (n.kind === 'equipeagile') {
    const x = piloteEquipe(n.id, org, h, points, echanges, today);
    const max = Math.max(1, x.prevus);
    contenu = (
      <>
        <SectionFiche titre={`Avancement · ${nomSprintDe(x.it.key)} · ${jourCourt(x.it.start)} → ${jourCourt(x.it.end)}`}>
          <View style={[st.compteurs, s.pad]}>
            <Compteur valeur={`${x.faits} / ${x.prevus}`} libelle="pts faits / prévus" />
            <Compteur valeur={String(x.nbBloquees)} libelle={x.nbBloquees > 1 ? 'stories bloquées' : 'story bloquée'} ton={x.nbBloquees ? 'rouge' : undefined} />
            <Compteur valeur={String(x.retard)} libelle="en retard" ton={x.retard ? 'orange' : undefined} />
          </View>
          <View style={s.pad}>
            <Text style={st.sous}>Burndown · points restants par jour (orange : au-dessus de l’idéal, trait gris)</Text>
            {/* Une barre par jour : points restants ; le trait gris est l'idéal ce jour-là */}
            <View style={s.burndown}>
              {x.jours.map((j, k) => (
                <View key={j} style={s.colonne}>
                  <View style={[s.ideal, { bottom: `${(100 * x.ideal[k]) / max}%` }]} />
                  {x.reste[k] !== null && <View style={[s.barre, { height: `${Math.max(2, (100 * (x.reste[k] as number)) / max)}%` }, (x.reste[k] as number) > x.ideal[k] + 0.01 && { backgroundColor: '#E37400' }]} />}
                </View>
              ))}
            </View>
          </View>
        </SectionFiche>
        <SectionFiche titre="Charge · capacité / engagé">
          {ligneJauge('eq', 'Équipe', `${x.charge.engage} pts engagés sur ${x.charge.capacite} de capacité (somme des membres)`, x.charge.capacite ? (100 * x.charge.engage) / x.charge.capacite : 0, x.charge.capacite && x.charge.engage > x.charge.capacite ? 'rouge' : undefined, true)}
          {x.charge.personnes.map((p) =>
            ligneJauge(p.id, p.nom, p.capacite ? `${p.engage} pts sur ${p.capacite}${p.engage > p.capacite ? ' · surcharge' : ''}` : `${p.engage} pts · capacité non renseignée (fiche Personne)`, p.capacite ? (100 * p.engage) / p.capacite : 0, p.capacite && p.engage > p.capacite ? 'rouge' : undefined, false, p.capacite && p.engage > p.capacite ? { texte: `+${Math.round((p.engage - p.capacite) * 10) / 10}`, ton: 'rouge' } : undefined),
          )}
        </SectionFiche>
        <SectionFiche titre="Prévisibilité">
          <View style={[st.compteurs, s.pad]}>
            <Compteur valeur={x.velocite ? String(x.velocite) : '—'} libelle="vélocité (3 derniers sprints)" />
            <Compteur valeur={x.tenu === null ? '—' : `${x.tenu} %`} libelle="engagé tenu" ton={x.tenu !== null && x.tenu >= 80 ? 'vert' : x.tenu !== null ? 'orange' : undefined} />
            <Compteur valeur={`1 pt = ${String(x.charge.jpp).replace('.', ',')} j`} libelle={x.jppCalcule ? `calculé : ${String(x.jppCalcule).replace('.', ',')} j` : 'réglé à la main'} />
          </View>
        </SectionFiche>
      </>
    );
  } else if (n.kind === 'train') {
    const x = piloteTrain(n.id, org, h, points, today);
    contenu = (
      <>
        <SectionFiche titre={`Avancement · ${piLabel(x.pi)}`}>
          <View style={[st.compteurs, s.pad]}>
            <Compteur valeur={`${x.pct} %`} libelle="features du PI" />
            <Compteur valeur={String(x.objectifs.length)} libelle="objectifs du PI" />
            <Compteur valeur={String(x.risques.length + x.dependances.length)} libelle="risques et dépendances" ton={x.risques.length + x.dependances.length ? 'orange' : undefined} />
          </View>
          {x.features.map((y, i) => ligneJauge(y.f.id, `🧩 ${y.f.titre}`, `${y.f.equipe ? (org.equipe.get(y.f.equipe)?.nom ?? '') : 'sans équipe'} · ${y.pct} %`, y.pct, y.pct >= 60 ? 'vert' : undefined, i === 0))}
          {!x.features.length && <Vide texte="Aucune feature dans ce PI." />}
        </SectionFiche>
        <SectionFiche titre={`Charge par équipe · ${nomSprintDe(x.it.key)}`}>
          {x.equipes.map((y, i) => ligneJauge(y.e.id, `Équipe ${y.e.nom}`, `${y.charge.engage} / ${y.charge.capacite} pts${y.charge.capacite && y.charge.engage > y.charge.capacite ? ' · surcharge' : ''}`, y.charge.capacite ? (100 * y.charge.engage) / y.charge.capacite : 0, y.charge.capacite && y.charge.engage > y.charge.capacite ? 'rouge' : undefined, i === 0))}
        </SectionFiche>
        <SectionFiche titre="Prévisibilité du train">
          <View style={[st.compteurs, s.pad]}>
            <Compteur valeur={x.velocite ? String(x.velocite) : '—'} libelle="vélocité du train" />
            <Compteur valeur={x.prevue ? `${Math.round((100 * x.obtenue) / x.prevue)} %` : '—'} libelle="valeur obtenue / prévue" />
            <Compteur valeur={String(x.risques.length)} libelle="risques ouverts" ton={x.risques.length ? 'rouge' : undefined} />
          </View>
          {[...x.risques, ...x.dependances].slice(0, 6).map((p, i) => (
            <Ligne key={p.id} premiere={i === 0} texte={p.texte} sous={`${reunionDe(p)} · notée par ${nom(p.personne)}`} pastille={{ texte: libelleNote(p), ton: p.type === 'risque' ? 'rouge' : 'orange' }} />
          ))}
        </SectionFiche>
      </>
    );
  } else if (n.kind === 'portfolio') {
    const x = pilotePortfolio(n.id, org, h, today);
    contenu = (
      <>
        <SectionFiche titre="Epics par état">
          <View style={[st.compteurs, s.pad]}>
            <Compteur valeur={String(x.idee)} libelle="idée" />
            <Compteur valeur={String(x.analysePret)} libelle="analyse · prêt" />
            <Compteur valeur={String(x.enCours)} libelle="en cours" ton={x.enCours ? 'vert' : undefined} />
          </View>
          {x.epics.map((y, i) => ligneJauge(y.e.id, `🗂️ ${y.e.titre}`, `${y.e.etat || 'idée'} · ${y.pct} %`.replace('en_cours', 'en cours').replace('termine', 'terminé').replace(/^pret/, 'prêt'), y.pct, undefined, i === 0))}
          {!x.epics.length && <Vide texte="Aucun epic dans ce portfolio." />}
        </SectionFiche>
        <SectionFiche titre="OKR · résultats clés">
          {x.okrs.map((y, i) => ligneJauge(y.o.id, `🎯 ${y.o.titre}`, `${y.nbKr} résultat${y.nbKr > 1 ? 's' : ''} clé${y.nbKr > 1 ? 's' : ''} · ${y.pct} %${y.clos ? ' · clos' : ''}`, y.pct, y.pct >= 60 ? 'vert' : undefined, i === 0, y.clos ? { texte: 'Clos', ton: 'gris' } : undefined))}
          {!x.okrs.length && <Vide texte="Aucun OKR avec des résultats clés." />}
        </SectionFiche>
      </>
    );
  } else {
    const x = pilotePerso(h, today);
    const max = Math.max(1, ...x.parJour.map((d) => d.h));
    contenu = (
      <>
        <SectionFiche titre={`Ma semaine · du ${jourCourt(x.lundi)}`}>
          <View style={[st.compteurs, s.pad]}>
            <Compteur valeur={`${String(x.planifiees).replace('.', ',')} h`} libelle="planifiées" />
            <Compteur valeur={`${x.disponibles} h`} libelle="disponibles" />
            <Compteur valeur={String(x.retard)} libelle="tâches en retard" ton={x.retard ? 'rouge' : undefined} />
          </View>
          {x.parJour.map((d, i) => ligneJauge(d.j, ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'][i], `${String(d.h).replace('.', ',')} h sur 7 h`, (100 * d.h) / Math.max(7, max), d.h > 7 ? 'rouge' : undefined, i === 0))}
        </SectionFiche>
        <SectionFiche titre="Objectifs">
          {x.objectifs.map((y, i) => ligneJauge(y.o.id, `🎯 ${y.o.titre}`, `${y.o.fin ? `fin le ${jourCourt(y.o.fin)} · ` : ''}${y.total ? `${y.faites} tâche${y.faites > 1 ? 's' : ''} faite${y.faites > 1 ? 's' : ''} sur ${y.total}` : 'aucune tâche rattachée'}`, y.total ? (100 * y.faites) / y.total : 0, 'vert', i === 0))}
          {x.delaisses.map((d, i) => (
            <Ligne key={d.id} premiere={!x.objectifs.length && i === 0} texte={`${d.icone} Domaine délaissé : ${d.nom}`} sous="rien fait depuis 30 jours" pastille={{ texte: 'à revoir', ton: 'orange' }} />
          ))}
          {!x.objectifs.length && !x.delaisses.length && <Vide texte="Aucun objectif en cours." />}
        </SectionFiche>
      </>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.page}>
      <TitreFiche icone="📊" titre="Pilotage" vide="" sous="Selon vos rôles · lecture seule" />
      {niveaux.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.puces}>
          {niveaux.map((x) => {
            const on = x === n;
            return (
              <Pressable key={`${x.kind}:${x.id}`} onPress={() => setChoisi(`${x.kind}:${x.id}`)} style={[s.puce, on && s.puceOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Text style={[s.puceTexte, on && s.puceTexteOn]}>{x.nom}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {contenu}
      {blocSuivis}
      {n.kind !== 'perso' && blocDecisions}
      {blocAlertes}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingBottom: 40 },
  pad: { padding: 10 },
  puces: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  puce: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  puceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  puceTexte: { fontSize: 13.5, color: colors.text },
  puceTexteOn: { color: '#fff', fontWeight: '600' },
  burndown: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 2, marginTop: 6 },
  colonne: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barre: { backgroundColor: colors.primary, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  ideal: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#9AA3AF' },
  jauge: { height: 8, backgroundColor: '#EEF1F6', borderRadius: 4, overflow: 'hidden', marginTop: 5, marginBottom: 3 },
  jaugeIn: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
  pastille: { fontSize: 12, fontWeight: '600', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden', backgroundColor: '#EEF1F6', color: colors.muted },
  pRouge: { backgroundColor: '#FCE8E6', color: '#B3261E' },
  pVert: { backgroundColor: '#E6F4EA', color: '#137333' },
  pOrange: { backgroundColor: '#FEF3E2', color: '#B45309' },
});
