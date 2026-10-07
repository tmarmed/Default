import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { LIBELLE_TYPE_POINT, pointsFinis } from '../../daily';
import { fmtPoints, pointsOf, shiftIteration } from '../../pi';
import type { CatalogueParcours, EtapeCatalogue, ParcoursRole } from '../../reunions';
import { criteresDe, velocite } from '../../reunionsEquipe';
import { useSafe } from '../../safe';
import type { Item, PointReunion } from '../../types';
import { SectionFiche } from '../Choix';
import { TitreFiche } from '../FormSheet';
import { MesTaches, Navigation } from './Affinage';
import { BlocPoints, BlocSuivi, Compteurs, EtapeCompteRendu, EtapeConcretisation, FenetreEquipe, type PropsReunion, prenom, QuestionsEquipe, useReunion } from './base';
import { Ligne, Pastilles, st, tonType, Vide } from './ui';

/**
 * Revue d'itération (lot 6, maquette r03 validée). Animateur : le SM ; le PO accepte (préparé avant, décidé en
 * séance) ; chacun prépare sa démo.
 * - Mon point : Mes tâches · Ma démo (démo en direct, capture, vidéo ; Mes points ; « Envoyer à Nina »)
 * - PO : Questions de l'équipe · Acceptation · Non terminées (« Envoyer à Nina »)
 * - Animer : Situation · Bilan (dont « ✓ Réglé pendant l'itération ») · Stories (une par écran : critères, démo,
 *   décision du PO, points) · Non terminées · Retours · Concrétisation · Compte rendu.
 * Au compte rendu, les stories suivent la décision (une écriture groupée) : refusée → backlog, reste à faire →
 * itération suivante ; non terminées : reportées ou rendues au backlog.
 */
export const PARCOURS_REVUE: CatalogueParcours = {
  membre: [
    { cle: 'taches', nom: 'Mes tâches' },
    { cle: 'demo', nom: 'Ma démo' },
  ],
  po: [
    { cle: 'questions', nom: 'Questions de l’équipe' },
    { cle: 'acceptation', nom: 'Acceptation' },
    { cle: 'non_terminees_po', nom: 'Non terminées' },
  ],
  sm: [
    { cle: 'situation', nom: 'Situation' },
    { cle: 'bilan', nom: 'Bilan' },
    { cle: 'stories', nom: 'Stories' },
    { cle: 'non_terminees', nom: 'Non terminées' },
    { cle: 'retours', nom: 'Retours' },
    { cle: 'concretisation', nom: 'Concrétisation' },
    { cle: 'compte_rendu', nom: 'Compte rendu' },
  ],
};
const libelleEtape = (cle: string) => [...PARCOURS_REVUE.sm, ...PARCOURS_REVUE.membre, ...PARCOURS_REVUE.po].find((x) => x.cle === cle)?.nom ?? '';
const ACCEPTATION = ['Acceptée', 'Refusée → backlog', 'Reste à faire'];
const SORT = ['Reporter', 'Backlog', 'Découper'];
const MODES_DEMO = ['Démo en direct', 'Capture', 'Vidéo'];

export function FenetreRevue(p: PropsReunion) {
  const safe = useSafe();
  const r = useReunion(p, PARCOURS_REVUE, { nomCourt: 'à la revue', libelleEtape });
  const { e } = r;
  const fmt = (n: number) => fmtPoints(n, safe.pointsJours);
  const [cleAnim, setCleAnim] = useState('');
  const [idx, setIdx] = useState(0);
  const [idxPo, setIdxPo] = useState(0);
  /** Décisions changées en séance (sinon : la proposition du PO) */
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [sorts, setSorts] = useState<Record<string, string>>({});
  // « Réglé pendant l'itération » : points de toutes les réunions de l'équipe (une lecture à l'ouverture)
  const [equipePts, setEquipePts] = useState<PointReunion[]>([]);
  useEffect(() => {
    if (!p.visible || !r.anime) return;
    p.actions.lirePoints(r.espace, '').then(setEquipePts).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.visible, r.anime]);
  const suivante = shiftIteration(e.it.key, 1);
  const terminees = e.situation.cartes.filter((t) => t.type === 'story' && t.statut === 'termine');
  const nonTerminees = e.situation.cartes.filter((t) => t.statut !== 'termine');
  const accPO = (t: Item) => r.donneesDe<{ v: string }>('acceptation').filter((x) => x.d.c === t.id).slice(-1)[0]?.d.v ?? '';
  const sortPO = (t: Item) => r.donneesDe<{ v: string }>('sort').filter((x) => x.d.c === t.id).slice(-1)[0]?.d.v ?? '';
  const decision = (t: Item) => decisions[t.id] ?? accPO(t);
  const sortDe = (t: Item) => sorts[t.id] ?? sortPO(t);
  const demos = r.donneesDe<{ v: string }>('demo');
  const demoDe = (t: Item) => demos.filter((x) => x.d.c === t.id).slice(-1)[0];
  const n = terminees.length;
  const story = terminees[Math.min(idx, Math.max(0, n - 1))];
  const v = useMemo(() => velocite(e.h.items, e.dansEquipe, suivante), [e.h.items, suivante]); // eslint-disable-line react-hooks/exhaustive-deps
  const regles = useMemo(() => {
    const niv = p.reunion.niveau;
    const ids = new Set((['daily', 'planification', 'affinage', 'revue', 'retro'] as const).flatMap((t) => pointsFinis(equipePts, `${t}-${niv}-${e.jour}`, e.h.items)));
    return equipePts.filter((x) => ids.has(x.id));
  }, [equipePts, e.h.items, e.jour, p.reunion.niveau]);

  const pointsDe = (t: Item, lecture: boolean, prep = false) => (
    <BlocPoints r={r} titre={prep ? 'Mes points' : 'Points notés'} points={(prep ? r.prep : r.tous).filter((x) => r.ici(x) && (!t || x.element === t.id))} lecture={lecture} element={t?.id ?? ''} pourPrep={prep} />
  );
  const blocDecision = (t: Item, lecture: boolean, po = false) => {
    const val = po ? accPO(t) : decision(t);
    return (
      <SectionFiche titre={po ? 'Votre décision' : `Décision du PO${accPO(t) ? ' · préparée' : ''}`}>
        <Ligne
          premiere
          texte={val || 'À décider'}
          sous={po ? 'Avant la revue, critère par critère' : accPO(t) && decisions[t.id] && decisions[t.id] !== accPO(t) ? `préparée : ${accPO(t)} · changée en séance` : ''}
        />
        {!lecture && (
          <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
            <Pastilles petit options={ACCEPTATION.map((x) => ({ value: x, label: x }))} value={val} onChange={(x) => (po ? r.poserDonnee('acceptation', t.id, { v: x }, 'po', t.id) : setDecisions((m) => ({ ...m, [t.id]: x })))} />
          </View>
        )}
      </SectionFiche>
    );
  };

  const rendu = (x: EtapeCatalogue, _o: ParcoursRole, lecture: boolean) => {
    switch (x.cle) {
      case 'situation':
        return (
          <>
            <TitreFiche icone="📊" titre="Situation" vide="" sous={`${e.it.code} · du ${e.it.start.slice(8)}/${e.it.start.slice(5, 7)} au ${e.it.end.slice(8)}/${e.it.end.slice(5, 7)}`} />
            <Compteurs l={[{ valeur: String(terminees.length), libelle: 'stories à revoir' }, { valeur: String(nonTerminees.length), libelle: 'non terminées', ton: nonTerminees.length ? 'orange' : undefined }, { valeur: String(r.reponsesPO.length), libelle: 'réponses du PO' }]} />
            <BlocSuivi r={r} lecture={lecture} onAjouter />
            <SectionFiche titre="Objectifs de la réunion">
              <Ligne premiere texte="🎯 Montrer ce qui est fini" sous="Faire accepter chaque story par le PO, décider du sort des non terminées, recueillir les retours." />
            </SectionFiche>
          </>
        );
      case 'bilan': {
        const prev = e.situation.prevus ? Math.round((100 * e.situation.faits) / e.situation.prevus) : 0;
        return (
          <>
            <TitreFiche icone="📈" titre="Bilan de l’itération" vide="" sous={`Calculé · ${e.it.code}`} />
            <Compteurs l={[{ valeur: `${Math.round(e.situation.faits)}/${Math.round(e.situation.prevus)}`, libelle: 'pts faits' }, { valeur: `${prev} %`, libelle: 'prévisibilité', ton: prev < 80 ? 'orange' : 'vert' }, { valeur: String(v.moyenne), libelle: 'vélocité moyenne' }]} />
            <SectionFiche titre="Vélocité · 3 dernières">
              <Ligne premiere texte={v.iterations.map((y) => y.key.split('-').pop()).join(' · ')} sous={`moyenne ${v.moyenne} pts`} pastille={{ texte: v.iterations.map((y) => y.points).join(' · '), ton: 'bleu' }} />
            </SectionFiche>
            <SectionFiche titre={`✓ Réglé pendant l’itération · ${regles.length}`}>
              {regles.length ? regles.map((y, i) => <Ligne key={y.id} premiere={i === 0} texte={y.texte} sous={`${y.concretisation === 'rien' ? 'noté' : y.concretisation === 'escalade' ? 'escaladé, réglé' : 'fait'} · ${y.reunion.split('-')[0]} du ${y.reunion.slice(-2)}/${y.reunion.slice(-5, -3)}`} pastille={{ texte: LIBELLE_TYPE_POINT[y.type], ton: tonType(y.type) }} />) : <Vide texte={lecture ? 'Vu par l’animateur.' : 'Rien de réglé pour l’instant.'} />}
            </SectionFiche>
          </>
        );
      }
      case 'stories': {
        if (!n) return <Vide texte="Aucune story terminée dans l’itération." />;
        const k = lecture ? Math.max(0, terminees.findIndex((t) => t.id === r.live.etat?.element)) : Math.min(idx, n - 1);
        const t = terminees[k] ?? story;
        const crit = criteresDe(t.description);
        const d = demoDe(t);
        const resp = t.responsable ? r.org.personne.get(t.responsable) : undefined;
        return (
          <>
            <Navigation n={n} cur={k} onChoisir={lecture ? undefined : setIdx} aReprendre={new Set(terminees.map((y, i) => (!decision(y) ? i : -1)).filter((i) => i >= 0 && i < k))} />
            <TitreFiche icone="📖" titre={t.titre} vide="" sous={`Terminée${resp ? ` par ${prenom(resp.nom)}` : ''} · ${fmt(pointsOf(t))} · story ${k + 1} sur ${n}`} />
            <SectionFiche titre={`Critères d’acceptation · ${crit.length}`}>{crit.length ? crit.map((c, i) => <Ligne key={i} premiere={i === 0} texte={c} />) : <Vide texte="Pas de critères écrits." />}</SectionFiche>
            {d && (
              <SectionFiche titre="Démo">
                <Ligne premiere texte={d.d.v} sous={`par ${prenom(e.nomDe(d.p.personne))}`} />
              </SectionFiche>
            )}
            {blocDecision(t, lecture)}
            {pointsDe(t, lecture)}
          </>
        );
      }
      case 'non_terminees':
        return (
          <>
            <TitreFiche icone="⏳" titre={`Non terminées · ${nonTerminees.length}`} vide="" sous="Proposition du PO, décidée ensemble" />
            {nonTerminees.map((t) => (
              <SectionFiche key={t.id} titre={t.titre}>
                <Ligne premiere texte={sortDe(t) ? `→ ${sortDe(t)}` : 'À décider'} sous={sortPO(t) ? `proposé par le PO : ${sortPO(t)}` : `${fmt(pointsOf(t))} · ${t.statut === 'en_cours' ? 'en cours' : 'pas commencée'}`} />
                {!lecture && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
                    <Pastilles petit options={SORT.map((y) => ({ value: y, label: y === 'Reporter' ? `Reporter en ${suivante.split('-').pop()}` : y }))} value={sortDe(t)} onChange={(y) => setSorts((m) => ({ ...m, [t.id]: y }))} />
                  </View>
                )}
              </SectionFiche>
            ))}
            {!nonTerminees.length && <Vide texte="✓ Tout est terminé." />}
            <BlocPoints r={r} points={r.tous.filter((y) => r.ici(y) && nonTerminees.some((t) => t.id === y.element))} lecture={lecture} stories={nonTerminees} />
          </>
        );
      case 'retours':
        return (
          <>
            <TitreFiche icone="💬" titre="Retours des parties prenantes" vide="" sous="Notés en séance" />
            <BlocPoints r={r} titre="Retours" points={r.tous.filter((y) => r.ici(y) && !y.element)} lecture={lecture} placeholder="＋ Retour" />
          </>
        );
      case 'concretisation':
        return <EtapeConcretisation r={r} lecture={lecture} iterationCode={suivante.split('-').pop() ?? ''} />;
      case 'compte_rendu': {
        const acc = terminees.filter((t) => decision(t) === 'Acceptée').length;
        return (
          <EtapeCompteRendu
            r={r}
            lecture={lecture}
            iterationCode={suivante.split('-').pop() ?? ''}
            entete={<Compteurs l={[{ valeur: String(acc), libelle: 'acceptées', ton: 'vert' }, { valeur: String(terminees.filter((t) => decision(t) && decision(t) !== 'Acceptée').length), libelle: 'à reprendre', ton: 'orange' }, { valeur: String(nonTerminees.filter((t) => sortDe(t) === 'Reporter').length), libelle: 'reportées' }]} />}
          />
        );
      }
      // ---- Mon point ----
      case 'taches':
        return <MesTaches r={r} />;
      case 'demo': {
        const moiP = e.personnes.find((y) => y.email.toLowerCase() === r.mail);
        const mes = terminees.filter((t) => t.responsable === moiP?.id);
        return (
          <>
            <TitreFiche icone="🖥️" titre="Ma démo" vide="" sous="Ce que je montre, et comment" />
            {mes.map((t) => (
              <SectionFiche key={t.id} titre={t.titre}>
                <View style={{ padding: 12 }}>
                  <Pastilles petit options={MODES_DEMO.map((y) => ({ value: y, label: y }))} value={demoDe(t)?.d.v ?? ''} onChange={(y) => r.poserDonnee('demo', t.id, { v: y }, 'membre', t.id)} />
                </View>
              </SectionFiche>
            ))}
            {!mes.length && (
              <SectionFiche titre="Démo">
                <Vide texte="Aucune story terminée à votre nom." />
              </SectionFiche>
            )}
            <BlocPoints r={r} titre="Mes points" points={r.prep.filter((y) => y.type !== 'donnee')} pourPrep stories={e.situation.cartes} />
          </>
        );
      }
      // ---- PO ----
      case 'questions':
        return <QuestionsEquipe r={r} />;
      case 'acceptation': {
        if (!n) return <Vide texte="Aucune story terminée dans l’itération." />;
        const k = Math.min(idxPo, n - 1);
        const t = terminees[k];
        const crit = criteresDe(t.description);
        return (
          <>
            <Navigation n={n} cur={k} onChoisir={setIdxPo} />
            <TitreFiche icone="✅" titre={t.titre} vide="" sous={`Story ${k + 1} sur ${n} · ${crit.length} critère${crit.length > 1 ? 's' : ''}`} />
            <SectionFiche titre={`Critères d’acceptation · ${crit.length}`}>{crit.length ? crit.map((c, i) => <Ligne key={i} premiere={i === 0} texte={c} />) : <Vide texte="Pas de critères écrits." />}</SectionFiche>
            {blocDecision(t, false, true)}
            <BlocPoints r={r} titre="Mes points" points={r.prep.filter((y) => y.type !== 'donnee' && y.element === t.id)} pourPrep onglet="po" element={t.id} stories={terminees} />
          </>
        );
      }
      case 'non_terminees_po':
        return (
          <>
            <TitreFiche icone="⏳" titre={`Non terminées · ${nonTerminees.length}`} vide="" sous="Votre proposition" />
            {nonTerminees.map((t) => (
              <SectionFiche key={t.id} titre={`${t.titre} · ${fmt(pointsOf(t))}`}>
                <View style={{ padding: 12 }}>
                  <Pastilles petit options={SORT.map((y) => ({ value: y, label: y === 'Reporter' ? `Reporter en ${suivante.split('-').pop()}` : y }))} value={sortPO(t)} onChange={(y) => r.poserDonnee('sort', t.id, { v: y }, 'po', t.id)} />
                </View>
              </SectionFiche>
            ))}
            {!nonTerminees.length && <Vide texte="✓ Tout est terminé." />}
          </>
        );
      default:
        return null;
    }
  };

  const envoyerCR = async () => {
    const stories: (Partial<Item> & { id: string })[] = [];
    for (const t of terminees) {
      const d = decision(t);
      if (d === 'Refusée → backlog') stories.push({ id: t.id, statut: 'a_faire', iteration: '' });
      if (d === 'Reste à faire') stories.push({ id: t.id, statut: 'en_cours', iteration: suivante });
    }
    for (const t of nonTerminees) {
      const s = sortDe(t);
      if (s === 'Reporter') stories.push({ id: t.id, iteration: suivante });
      if (s === 'Backlog') stories.push({ id: t.id, iteration: '' });
    }
    await r.envoyerCompteRendu({
      iteration: suivante,
      stories,
      lignes: [
        ...ACCEPTATION.map((a) => {
          const l = terminees.filter((t) => decision(t) === a);
          return l.length ? `${a} · ${l.length} : ${l.map((t) => t.titre).join(', ')}` : '';
        }).filter(Boolean),
        ...SORT.map((a) => {
          const l = nonTerminees.filter((t) => sortDe(t) === a);
          return l.length ? `Non terminées · ${a} : ${l.map((t) => t.titre).join(', ')}` : '';
        }).filter(Boolean),
      ],
    });
  };

  return (
    <FenetreEquipe
      p={p}
      r={r}
      catalogue={PARCOURS_REVUE}
      rendu={rendu}
      libelleFin={() => `Envoyer à ${prenom(e.nomDe(p.reunion.organisateur))}`}
      etapeAnim={{ cle: cleAnim, setCle: setCleAnim, element: cleAnim === 'stories' ? (story?.id ?? '') : '', detail: cleAnim === 'stories' && story ? `Story ${Math.min(idx, n - 1) + 1} sur ${n} · ${story.titre}` : '' }}
      onSuivant={(role, cle) => {
        if (role === 'sm' && cle === 'stories' && idx < n - 1) return (setIdx(idx + 1), true);
        if (role === 'po' && cle === 'acceptation' && idxPo < n - 1) return (setIdxPo(idxPo + 1), true);
        return false;
      }}
      libelleSuivant={(role, cle) => ((role === 'sm' && cle === 'stories' && idx < n - 1) || (role === 'po' && cle === 'acceptation' && idxPo < n - 1) ? 'Story suivante ›' : undefined)}
      envoyerCR={envoyerCR}
      renduCR={(rid) => <EtapeCompteRendu r={r} lecture reunionId={rid} iterationCode={e.it.code} />}
    />
  );
}
