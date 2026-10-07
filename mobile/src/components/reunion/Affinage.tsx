import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { dateCourte } from '../../daily';
import type { VoteEtat } from '../../etatReunion';
import { fmtPoints, pointsOf } from '../../pi';
import type { CatalogueParcours, EtapeCatalogue, ParcoursRole } from '../../reunions';
import { avecCriteres, criteresDe, etatPrete, MAX_POINTS_PRETE, storiesAAffiner, storiesPretes, velocite } from '../../reunionsEquipe';
import { useSafe } from '../../safe';
import { colors } from '../../theme';
import { type Item, type ItemInput, RECURRENCE_DEFAUTS } from '../../types';
import { SectionFiche } from '../Choix';
import { TitreFiche } from '../FormSheet';
import { BlocPoints, BlocSuivi, Compteurs, EtapeCompteRendu, EtapeConcretisation, FenetreEquipe, type PropsReunion, prenom, QuestionsEquipe, type R, useReunion } from './base';
import { Ligne, Pastilles, pastilleStatut, pluriel, st, Vide } from './ui';
import { CARTES_POKER, type DecisionVote, VoteAnimateur, VoteParticipant, votesDe } from './Vote';
import { AjoutElement, itemReunion } from './Ajout';

/**
 * Affinage du backlog (lot 6, maquette r05 validée le 07/10). Animateur : le SM ; le PO prépare (questions, ordre,
 * critères, découpage) ; chacun lit les stories et y note ses questions, puis vote en séance, story par story.
 * - Animer : Situation · À préparer · Stories (une par écran : critères, découpage, vote commun, état « Prête »
 *   calculé, points ; « Story suivante › », barre ‹ 1 · 2 · 3 ›, puis le bilan) · Concrétisation · Compte rendu ;
 * - Mon point : Mes tâches · Lire (une story par écran, « Mes points ») · Voter (« Envoyer mes points ») ;
 * - PO : Questions de l'équipe · Ordre · Stories (critères, découpage ; « Envoyer à Nina »).
 * Au compte rendu : estimations, critères et découpages écrits dans les stories (une écriture groupée).
 */
export const PARCOURS_AFFINAGE: CatalogueParcours = {
  membre: [
    { cle: 'taches', nom: 'Mes tâches' },
    { cle: 'lire', nom: 'Lire' },
    { cle: 'voter', nom: 'Voter' },
  ],
  po: [
    { cle: 'questions', nom: 'Questions de l’équipe' },
    { cle: 'ordre', nom: 'Ordre' },
    { cle: 'stories_po', nom: 'Stories' },
  ],
  sm: [
    { cle: 'situation', nom: 'Situation' },
    { cle: 'a_preparer', nom: 'À préparer' },
    { cle: 'stories', nom: 'Stories' },
    { cle: 'concretisation', nom: 'Concrétisation' },
    { cle: 'compte_rendu', nom: 'Compte rendu' },
  ],
};
const libelleEtape = (cle: string) => [...PARCOURS_AFFINAGE.sm, ...PARCOURS_AFFINAGE.membre, ...PARCOURS_AFFINAGE.po].find((x) => x.cle === cle)?.nom ?? '';

interface Decoupe {
  faire: boolean;
  l: { titre: string; criteres: string }[];
}

/** Barre des éléments : ‹ 1 · 2 · 3 ›, point orange = à reprendre */
export function Navigation({ n, cur, aReprendre, onChoisir }: { n: number; cur: number; aReprendre?: Set<number>; onChoisir?: (i: number) => void }) {
  if (n < 2) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
      <Pressable onPress={() => onChoisir?.(Math.max(0, cur - 1))} disabled={!onChoisir || cur === 0} hitSlop={8}>
        <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 16 }}>‹</Text>
      </Pressable>
      {Array.from({ length: n }, (_, i) => (
        <Pressable
          key={i}
          onPress={() => onChoisir?.(i)}
          disabled={!onChoisir}
          style={{ paddingHorizontal: 11, paddingVertical: 4, borderRadius: 14, backgroundColor: i === cur ? colors.primary : colors.card, borderWidth: i === cur ? 0 : 1, borderColor: '#d0d5dd' }}
          accessibilityRole="button"
          accessibilityLabel={`Élément ${i + 1}${aReprendre?.has(i) ? ', à reprendre' : ''}`}
        >
          <Text style={{ fontWeight: '700', fontSize: 13, color: i === cur ? '#fff' : colors.text }}>
            {i + 1}
            {aReprendre?.has(i) ? <Text style={{ color: colors.warning }}> ●</Text> : null}
          </Text>
        </Pressable>
      ))}
      <Pressable onPress={() => onChoisir?.(Math.min(n - 1, cur + 1))} disabled={!onChoisir || cur >= n - 1} hitSlop={8}>
        <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 16 }}>›</Text>
      </Pressable>
    </View>
  );
}

/** Liste éditable (critères, sous-stories) : lignes avec ✕, « ＋ … » qui ajoute une ligne */
export function ListeEditable({ titre, l, onChange, placeholder, lecture }: { titre: string; l: string[]; onChange: (l: string[]) => void; placeholder: string; lecture?: boolean }) {
  const [saisie, setSaisie] = useState('');
  const ajouter = () => {
    const t = saisie.trim();
    if (!t) return;
    onChange([...l, t]);
    setSaisie('');
  };
  return (
    <SectionFiche titre={`${titre} · ${l.length}`}>
      {l.map((x, i) => (
        <Ligne key={`${i}-${x}`} premiere={i === 0} texte={x} onRetirer={lecture ? undefined : () => onChange(l.filter((_, k) => k !== i))} />
      ))}
      {!l.length && lecture && <Vide texte="Aucun." />}
      {!lecture && (
        <View style={[st.ligne, l.length > 0 && st.bord]}>
          <TextInput value={saisie} onChangeText={setSaisie} onSubmitEditing={ajouter} placeholder={`＋ ${placeholder}`} placeholderTextColor={colors.primary} style={[st.saisie, { color: colors.text }]} accessibilityLabel={placeholder} submitBehavior="submit" />
          {!!saisie.trim() && (
            <Pressable onPress={ajouter} style={st.ajouter} accessibilityRole="button">
              <Text style={st.ajouterTexte}>Ajouter</Text>
            </Pressable>
          )}
        </View>
      )}
    </SectionFiche>
  );
}

/** État « Prête » calculé, bloc séparé, avec « Forcer « Prête » » et son motif */
export function BlocPrete({ ok, manque, motif, lecture, onForcer }: { ok: boolean; manque: string[]; motif?: string; lecture?: boolean; onForcer: (m: string | undefined) => void }) {
  const [saisie, setSaisie] = useState<string | null>(null);
  return (
    <SectionFiche titre="✅ Prête pour la planification ?">
      {ok ? (
        <Ligne premiere texte="✓ Prête" sous="estimée · critères écrits · 8 pts au plus · rattachée à une feature" pastille={{ texte: 'Prête', ton: 'vert' }} />
      ) : motif ? (
        <>
          <Ligne premiere texte="⚠ Prête (forcée)" sous={`motif : ${motif}`} pastille={{ texte: 'forcée', ton: 'orange' }} onRetirer={lecture ? undefined : () => onForcer(undefined)} />
          <Ligne texte="Il manque" sous={manque.join(', ')} />
        </>
      ) : (
        <>
          <Ligne premiere texte="Pas encore prête" sous={`il manque : ${manque.join(', ')}`} pastille={{ texte: 'À préparer', ton: 'orange' }} />
          {!lecture &&
            (saisie === null ? (
              <Pressable onPress={() => setSaisie('')} style={[st.ligne, st.bord]} accessibilityRole="button">
                <View style={st.corps}>
                  <Text style={[st.texte, { color: colors.primary }]}>Forcer « Prête »…</Text>
                  <Text style={st.sous}>motif obligatoire ; visible jusqu’à la planification</Text>
                </View>
              </Pressable>
            ) : (
              <View style={[st.ligne, st.bord]}>
                <TextInput value={saisie} onChangeText={setSaisie} placeholder="Motif (obligatoire)" placeholderTextColor={colors.muted} style={st.saisie} autoFocus accessibilityLabel="Motif" />
                <Pressable onPress={() => saisie.trim() && (onForcer(saisie.trim()), setSaisie(null))} style={[st.ajouter, !saisie.trim() && { opacity: 0.4 }]} accessibilityRole="button">
                  <Text style={st.ajouterTexte}>Forcer</Text>
                </Pressable>
              </View>
            ))}
        </>
      )}
    </SectionFiche>
  );
}

/** Mes tâches de l'itération (participant) : stories et tâches à mon nom, réunions comprises */
export function MesTaches({ r }: { r: R }) {
  const { e } = r;
  const moiP = e.personnes.find((x) => x.email.toLowerCase() === r.mail);
  const miens = moiP ? e.situation.elements.filter((t) => t.responsable === moiP.id) : [];
  return (
    <>
      <TitreFiche icone="📋" titre="Mes tâches" vide="" sous={`${moiP?.nom ?? ''} · ${e.it.nom}, tâches des réunions comprises`} />
      <SectionFiche titre={`Mes stories et tâches · ${miens.length}`}>
        {miens.length ? miens.map((t, i) => <Ligne key={t.id} premiere={i === 0} texte={`${t.type === 'story' ? '📖 ' : ''}${t.titre}`} sous={t.type === 'story' ? 'story' : 'tâche'} pastille={pastilleStatut(t.statut)} tache={t} />) : <Vide texte="Rien à votre nom dans le sprint." />}
      </SectionFiche>
    </>
  );
}

export function FenetreAffinage(p: PropsReunion) {
  const safe = useSafe();
  const r = useReunion(p, PARCOURS_AFFINAGE, { nomCourt: 'à l’affinage', libelleEtape });
  const { e } = r;
  const fmt = (n: number) => fmtPoints(n, safe.pointsJours);
  // Stories à affiner, dans l'ordre du PO
  const ordre = r.donneesDe<{ l: string[] }>('ordre').slice(-1)[0]?.d.l ?? [];
  const base = useMemo(() => storiesAAffiner(e.h.items, e.dansEquipe, e.it.key), [e.h.items, e.it.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const stories = useMemo(() => {
    if (!ordre.length) return base;
    const rang = (t: Item) => (ordre.includes(t.id) ? ordre.indexOf(t.id) : 999);
    return [...base].sort((a, b) => rang(a) - rang(b));
  }, [base, ordre]);
  const criteres = (t: Item) => r.donneesDe<{ l: string[] }>('criteres').filter((x) => x.d.c === t.id).slice(-1)[0]?.d.l ?? criteresDe(t.description);
  const decoupe = (t: Item): Decoupe | undefined => r.donneesDe<Decoupe>('decoupe').filter((x) => x.d.c === t.id).slice(-1)[0]?.d;

  // Animateur : vote en cours, décisions, prêtes forcées
  const [vote, setVote] = useState<VoteEtat | undefined>(undefined);
  const [decisions, setDecisions] = useState<Record<string, DecisionVote>>({});
  const [forcees, setForcees] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [idxLire, setIdxLire] = useState(0);
  const [idxPo, setIdxPo] = useState(0);
  const [cleAnim, setCleAnim] = useState('');
  useEffect(() => {
    if (r.anime && r.live.etat?.vote && !vote) setVote(r.live.etat.vote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.live.etat?.v]);
  const poserVote = (v: VoteEtat | undefined) => {
    setVote(v);
    r.live.publier({ vote: v });
  };
  const pointsDe = (t: Item) => (decisions[t.id]?.choix === 'retenir' && decisions[t.id].val ? Number(decisions[t.id].val) || 0 : pointsOf(t));
  const prete = (t: Item) => etatPrete({ points: pointsDe(t), criteres: criteres(t), feature: t.feature });
  const aReprendre = new Set(stories.map((t, i) => (decisions[t.id]?.choix === 'reporter' || (i < idx && !decisions[t.id]) ? i : -1)).filter((i) => i >= 0));
  const n = stories.length;
  const story = stories[Math.min(idx, Math.max(0, n - 1))];
  const animateur = prenom(e.nomDe(p.reunion.organisateur));

  /** Une story, telle que tout le monde la lit (critères, découpage) */
  const enTete = (t: Item, k: number, nb: number) => {
    const f = t.feature ? e.h.features.get(t.feature) : undefined;
    const pts = pointsDe(t);
    return (
      <>
        <TitreFiche icone="📖" titre={t.titre} vide="" sous={`Story ${k + 1} sur ${nb} · ${pts ? fmt(pts) : 'sans estimation'}${pts > MAX_POINTS_PRETE ? ' · trop grosse' : ''}${f ? ` · 🧩 ${f.titre}` : ''}`} />
      </>
    );
  };
  const blocCriteres = (t: Item) => {
    const l = criteres(t);
    return (
      <SectionFiche titre={`Critères d’acceptation · ${l.length}`}>
        {l.length ? l.map((c, i) => <Ligne key={i} premiere={i === 0} texte={c} />) : <Vide texte="Pas encore de critères." />}
      </SectionFiche>
    );
  };
  const blocDecoupe = (t: Item) => {
    const d = decoupe(t);
    if (!d?.faire || !d.l.length) return null;
    return (
      <SectionFiche titre={`✂️ Découpage proposé · ${d.l.length}`}>
        {d.l.map((x, i) => (
          <Ligne key={i} premiere={i === 0} texte={x.titre} sous={x.criteres ? `critères : ${x.criteres}` : ''} />
        ))}
      </SectionFiche>
    );
  };
  const pointsStory = (t: Item, lecture: boolean, prep = false) => (
    <BlocPoints
      r={r}
      titre={prep ? 'Mes points' : 'Points notés'}
      points={(prep ? r.prep : r.tous).filter((x) => r.ici(x) && x.element === t.id)}
      lecture={lecture}
      element={t.id}
      stories={stories}
      pourPrep={prep}
      placeholder={prep ? '＋ Question, blocage…' : '＋ Ajouter un point'}
    />
  );

  const bilan = () => {
    const pretes = stories.filter((t) => decisions[t.id]?.choix === 'retenir' && prete(t).ok);
    const votees = stories.filter((t) => decisions[t.id]?.choix === 'retenir' && !prete(t).ok);
    const reprendre = stories.filter((t) => !decisions[t.id] || decisions[t.id].choix !== 'retenir');
    return { pretes, votees, reprendre };
  };
  const sectionsBilan = (lecture: boolean) => {
    const b = bilan();
    return (
      <>
        <Compteurs l={[{ valeur: String(b.pretes.length), libelle: 'prêtes', ton: 'vert' }, { valeur: String(b.votees.length), libelle: 'votées, pas prêtes', ton: 'orange' }, { valeur: String(b.reprendre.length), libelle: 'à reprendre', ton: b.reprendre.length ? 'rouge' : undefined }]} />
        <SectionFiche titre={`✓ Prêtes · ${b.pretes.length}`}>
          {b.pretes.length ? b.pretes.map((t, i) => <Ligne key={t.id} premiere={i === 0} texte={t.titre} pastille={{ texte: fmt(pointsDe(t)), ton: 'vert' }} />) : <Vide texte="Aucune." />}
        </SectionFiche>
        {b.votees.length > 0 && (
          <SectionFiche titre={`⚠ Votées, pas prêtes · ${b.votees.length}`}>
            {b.votees.map((t, i) => (
              <Ligne key={t.id} premiere={i === 0} texte={t.titre} sous={`${forcees[t.id] ? `forcée · motif : ${forcees[t.id]} · ` : ''}manque : ${prete(t).manque.join(', ')}`} pastille={{ texte: fmt(pointsDe(t)), ton: 'orange' }} />
            ))}
          </SectionFiche>
        )}
        {b.reprendre.length > 0 && (
          <SectionFiche titre={`⏭ Pas estimées · à reprendre · ${b.reprendre.length}`}>
            {b.reprendre.map((t, i) => (
              <Ligne key={t.id} premiere={i === 0} texte={t.titre} sous={`manque : ${prete(t).manque.join(', ')}`} onOuvrir={lecture ? undefined : () => setIdx(stories.indexOf(t))} />
            ))}
          </SectionFiche>
        )}
      </>
    );
  };

  const rendu = (x: EtapeCatalogue, o: ParcoursRole, lecture: boolean) => {
    const voteVu = lecture || !r.anime ? r.live.etat?.vote : vote;
    switch (x.cle) {
      case 'situation': {
        const pretes = storiesPretes(e.h.items, e.dansEquipe, e.it.key);
        const v = velocite(e.h.items, e.dansEquipe, e.it.key);
        return (
          <>
            <TitreFiche icone="📊" titre="Situation" vide="" sous={`${e.it.nom} · avant la planification du sprint suivant`} />
            <Compteurs
              l={[
                { valeur: String(stories.length), libelle: 'à préparer', ton: stories.length ? 'orange' : undefined },
                { valeur: String(pretes.reduce((s, t) => s + pointsOf(t), 0)), libelle: 'pts prêts', ton: 'vert' },
                { valeur: String(v.moyenne * 2), libelle: 'pts visés (2 sprints)' },
              ]}
            />
            <BlocSuivi r={r} lecture={lecture} onAjouter />
            <SectionFiche titre="Objectifs de la réunion">
              <Ligne premiere texte="🎯 Deux sprints de stories prêtes" sous="Estimées, critères écrits, 8 pts au plus, rattachées à une feature." />
            </SectionFiche>
          </>
        );
      }
      case 'a_preparer':
        return (
          <>
            <TitreFiche icone="🧹" titre={`À préparer · ${stories.length}`} vide="" sous={`Ordre du PO · ${ordre.length ? 'ordonnées' : 'pas encore ordonnées'}`} />
            <SectionFiche titre="Stories">
              {stories.length ? (
                stories.map((t, i) => {
                  const nbv = votesDe(r, t.id, 1).size;
                  const f = t.feature ? e.h.features.get(t.feature) : undefined;
                  return <Ligne key={t.id} premiere={i === 0} texte={t.titre} sous={[f ? `🧩 ${f.titre}` : '', nbv ? `${nbv} vote${nbv > 1 ? 's' : ''} préparé${nbv > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')} pastille={{ texte: prete(t).manque[0] ?? 'prête', ton: 'orange' }} />;
                })
              ) : (
                <Vide texte="✓ Rien à préparer : le backlog est prêt." />
              )}
            </SectionFiche>
            <AjoutElement
              mot="story"
              feminin
              lecture={lecture}
              aide={`Dans le backlog de l’équipe ${e.nomNiveau} · à préparer`}
              existants={e.h.items.filter((t) => t.type === 'story' && t.statut !== 'termine' && !t.equipe && !e.dansEquipe(t)).map((t) => ({ id: t.id, titre: t.titre, sous: 'sans équipe' }))}
              onNouveau={async (titre) => {
                const [t] = await p.actions.creerTaches(p.reunion.espace || 'moi', [itemReunion(p.reunion.espace || 'moi', titre, { type: 'story', equipe: e.equipe?.id ?? '' })]);
                return async () => p.actions.supprimer?.('item', t.id);
              }}
              onChoisir={async (id) => {
                const t = e.h.items.find((x) => x.id === id)!;
                await p.actions.modifierItems?.(t.espace || 'moi', [{ id, equipe: e.equipe?.id ?? '' }]);
                return async () => void (await p.actions.modifierItems?.(t.espace || 'moi', [{ id, equipe: '' }]));
              }}
            />
            <SectionFiche titre="Prête, c’est">
              <Ligne premiere texte="Estimée par l’équipe · critères d’acceptation écrits · 8 pts au plus · rattachée à une feature" />
            </SectionFiche>
          </>
        );
      case 'stories': {
        if (!n) return <Vide texte="Aucune story à affiner." />;
        const k = lecture ? Math.max(0, stories.findIndex((t) => t.id === r.live.etat?.element)) : idx;
        if (!lecture && idx >= n)
          return (
            <>
              <TitreFiche icone="📋" titre="Bilan des stories" vide="" sous="Avant de quitter l’étape : il part aussi dans le compte rendu" />
              {sectionsBilan(false)}
            </>
          );
        const t = stories[k] ?? story;
        const pr = prete(t);
        return (
          <>
            <Navigation n={n} cur={k} aReprendre={aReprendre} onChoisir={lecture ? undefined : setIdx} />
            {enTete(t, k, n)}
            {blocDecoupe(t)}
            {blocCriteres(t)}
            <VoteAnimateur
              r={r}
              el={t.id}
              valeurs={CARTES_POKER}
              vote={voteVu}
              decision={decisions[t.id]}
              lecture={lecture}
              onVote={poserVote}
              onDecision={(d) => {
                setDecisions((m) => {
                  const c = { ...m };
                  if (d) c[t.id] = d;
                  else delete c[t.id];
                  return c;
                });
                if (vote?.elements.includes(t.id)) poserVote(undefined);
              }}
            />
            <BlocPrete ok={pr.ok} manque={pr.manque} motif={forcees[t.id]} lecture={lecture} onForcer={(m) => setForcees((f) => (m ? { ...f, [t.id]: m } : Object.fromEntries(Object.entries(f).filter(([id]) => id !== t.id))))} />
            {pointsStory(t, lecture)}
          </>
        );
      }
      case 'concretisation':
        return <EtapeConcretisation r={r} lecture={lecture} iterationCode={e.it.nom} />;
      case 'compte_rendu':
        return <EtapeCompteRendu r={r} lecture={lecture} iterationCode={e.it.nom} entete={sectionsBilan(true)} />;
      // ---- Mon point ----
      case 'taches':
        return <MesTaches r={r} />;
      case 'lire': {
        if (!n) return <Vide texte="Aucune story à lire." />;
        const t = stories[Math.min(idxLire, n - 1)];
        return (
          <>
            <Navigation n={n} cur={Math.min(idxLire, n - 1)} onChoisir={setIdxLire} />
            {enTete(t, Math.min(idxLire, n - 1), n)}
            {blocDecoupe(t)}
            {blocCriteres(t)}
            <VoteParticipant r={r} el={t.id} valeurs={CARTES_POKER} vote={r.live.etat?.vote} animateur={animateur} titre="🃏 Mon vote (facultatif)" />
            {pointsStory(t, false, true)}
          </>
        );
      }
      case 'voter': {
        const en = r.live.etat?.vote?.elements[0];
        const t = stories.find((y) => y.id === en);
        return (
          <>
            <TitreFiche icone="🗳️" titre="Voter" vide="" sous={t ? `Story ${stories.indexOf(t) + 1} sur ${n} · vote ouvert par ${animateur}` : `En séance, quand ${animateur} ouvre le vote`} />
            {t ? (
              <>
                {enTete(t, stories.indexOf(t), n)}
                <VoteParticipant r={r} el={t.id} valeurs={CARTES_POKER} vote={r.live.etat?.vote} animateur={animateur} />
              </>
            ) : (
              <SectionFiche titre="🗳️ Vote">
                <Vide texte={`Aucun vote ouvert : ${animateur} ouvre le vote de chaque story après sa présentation (↻ Actualiser).`} />
              </SectionFiche>
            )}
            <SectionFiche titre="Mes points">
              <Vide texte={`${pluriel(r.prep.filter((y) => y.type !== 'donnee').length, 'point')} à envoyer avec « Envoyer mes points ».`} />
            </SectionFiche>
          </>
        );
      }
      // ---- PO ----
      case 'questions':
        return <QuestionsEquipe r={r} />;
      case 'ordre': {
        const l = stories;
        const deplacer = (i: number, d: number) => {
          const ids = l.map((t) => t.id);
          const j = i + d;
          if (j < 0 || j >= ids.length) return;
          [ids[i], ids[j]] = [ids[j], ids[i]];
          r.poserDonnee('ordre', 'ordre', { l: ids }, 'po');
        };
        return (
          <>
            <TitreFiche icone="🧹" titre="Ordre des stories" vide="" sous="Les plus importantes d’abord : l’équipe les affine dans cet ordre" />
            <SectionFiche titre={`Stories · ${l.length}`}>
              {l.map((t, i) => (
                <View key={t.id} style={[st.ligne, i > 0 && st.bord]}>
                  <Text style={[st.texte, { width: 22, color: colors.muted }]}>{i + 1}</Text>
                  <View style={st.corps}>
                    <Text style={st.texte}>{t.titre}</Text>
                    <Text style={st.sous}>{prete(t).manque.join(', ')}</Text>
                  </View>
                  <Pressable onPress={() => deplacer(i, -1)} disabled={i === 0} hitSlop={8} accessibilityLabel={`Monter « ${t.titre} »`}>
                    <Text style={{ fontSize: 18, color: i === 0 ? colors.border : colors.primary }}>↑</Text>
                  </Pressable>
                  <Pressable onPress={() => deplacer(i, 1)} disabled={i === l.length - 1} hitSlop={8} accessibilityLabel={`Descendre « ${t.titre} »`}>
                    <Text style={{ fontSize: 18, color: i === l.length - 1 ? colors.border : colors.primary }}>↓</Text>
                  </Pressable>
                </View>
              ))}
              {!l.length && <Vide texte="✓ Rien à préparer." />}
            </SectionFiche>
          </>
        );
      }
      case 'stories_po': {
        if (!n) return <Vide texte="Aucune story à préparer." />;
        const k = Math.min(idxPo, n - 1);
        const t = stories[k];
        const d = decoupe(t) ?? { faire: pointsOf(t) > MAX_POINTS_PRETE, l: [] };
        const poserDecoupe = (x: Partial<Decoupe>) => r.poserDonnee('decoupe', t.id, { ...d, ...x }, 'po', t.id);
        return (
          <>
            <Navigation n={n} cur={k} onChoisir={setIdxPo} />
            {enTete(t, k, n)}
            <ListeEditable titre="Critères d’acceptation" l={criteres(t)} onChange={(l) => r.poserDonnee('criteres', t.id, { l }, 'po', t.id)} placeholder="Critère" />
            <SectionFiche titre={`✂️ Découpage${pointsOf(t) > MAX_POINTS_PRETE ? ' · proposé car plus de 8 pts' : ''}`}>
              <View style={[st.ligne, { flexWrap: 'wrap' }]}>
                <Pastilles options={[{ value: 'non', label: 'Ne pas découper' }, { value: 'oui', label: 'Découper' }]} value={d.faire ? 'oui' : 'non'} onChange={(v) => poserDecoupe({ faire: v === 'oui' })} />
              </View>
            </SectionFiche>
            {d.faire && <ListeEditable titre="Nouvelles stories" l={d.l.map((x) => x.titre)} onChange={(l) => poserDecoupe({ l: l.map((titre) => ({ titre, criteres: d.l.find((x) => x.titre === titre)?.criteres ?? '' })) })} placeholder="Story" />}
            {d.faire && <Text style={[st.sous, { marginHorizontal: 16, marginTop: 6 }]}>Estimées en séance ; créées au compte rendu à la place de « {t.titre} », sous la même feature.</Text>}
          </>
        );
      }
      default:
        return null;
    }
  };

  const envoyerCR = async () => {
    const b = bilan();
    const stories_: (Partial<Item> & { id: string })[] = [];
    const creerStories: ItemInput[] = [];
    for (const t of stories) {
      const dec = decisions[t.id];
      const cr = criteres(t);
      const patch: Partial<Item> & { id: string } = { id: t.id };
      if (dec?.choix === 'retenir' && dec.val && dec.val !== '?') patch.points = dec.val;
      if (cr.join('|') !== criteresDe(t.description).join('|')) patch.description = avecCriteres(t.description, cr);
      if (forcees[t.id]) patch.description = `${patch.description ?? t.description}\n\n⚠ Prête (forcée) le ${dateCourte(e.jour)} : ${forcees[t.id]}`.trim();
      const d = decoupe(t);
      if (d?.faire && d.l.length) {
        for (const x of d.l)
          creerStories.push({
            ...RECURRENCE_DEFAUTS,
            espace: r.espace,
            titre: x.titre,
            type: 'story',
            date: '',
            heure: '',
            heure_fin: '',
            date_fin: '',
            lieu: '',
            description: x.criteres ? avecCriteres('', [x.criteres]) : '',
            priorite: 'normale',
            statut: 'a_faire',
            parent: '',
            feature: t.feature,
            epic: t.epic,
            objectif: '',
            domaine: t.domaine,
            points: '',
            iteration: '',
            telephone: '',
            equipe: t.equipe ?? e.equipe?.id ?? '',
            responsable: '',
          });
        patch.statut = 'termine';
        patch.description = `${patch.description ?? t.description}\n\nDécoupée à l’affinage du ${dateCourte(e.jour)} en : ${d.l.map((x) => x.titre).join(', ')}.`.trim();
      }
      if (Object.keys(patch).length > 1) stories_.push(patch);
    }
    await r.envoyerCompteRendu({
      iteration: e.it.key,
      stories: stories_,
      creerStories,
      lignes: [
        `Prêtes · ${b.pretes.length} (${b.pretes.reduce((s, t) => s + pointsDe(t), 0)} pts)${b.pretes.length ? ` : ${b.pretes.map((t) => t.titre).join(', ')}` : ''}`,
        ...(b.votees.length ? [`Votées, pas prêtes · ${b.votees.length} : ${b.votees.map((t) => `${t.titre}${forcees[t.id] ? ` (forcée : ${forcees[t.id]})` : ''}`).join(', ')}`] : []),
        ...(b.reprendre.length ? [`À reprendre · ${b.reprendre.length} : ${b.reprendre.map((t) => t.titre).join(', ')}`] : []),
        ...(creerStories.length ? [`Découpées : ${creerStories.length} nouvelles stories`] : []),
      ],
    });
  };

  return (
    <FenetreEquipe
      p={p}
      r={r}
      catalogue={PARCOURS_AFFINAGE}
      rendu={rendu}
      libelleFin={(o) => (o.role === 'po' ? `Envoyer à ${prenom(e.nomDe(p.reunion.organisateur))}` : 'Envoyer mes points')}
      etapeAnim={{ cle: cleAnim, setCle: setCleAnim, element: cleAnim === 'stories' ? (story?.id ?? '') : '', detail: cleAnim === 'stories' && story ? `Story ${Math.min(idx, n - 1) + 1} sur ${n} · ${story.titre}` : '' }}
      onSuivant={(role, cle) => {
        if (role === 'sm' && cle === 'stories' && idx < n) return (setIdx(idx + 1), true);
        if (role === 'membre' && cle === 'lire' && idxLire < n - 1) return (setIdxLire(idxLire + 1), true);
        if (role === 'po' && cle === 'stories_po' && idxPo < n - 1) return (setIdxPo(idxPo + 1), true);
        return false;
      }}
      libelleSuivant={(role, cle) => {
        if (role === 'sm' && cle === 'stories') return idx < n - 1 ? 'Story suivante ›' : idx === n - 1 ? 'Bilan des stories ›' : undefined;
        if (role === 'membre' && cle === 'lire' && idxLire < n - 1) return 'Story suivante ›';
        if (role === 'po' && cle === 'stories_po' && idxPo < n - 1) return 'Story suivante ›';
        return undefined;
      }}
      envoyerCR={envoyerCR}
      renduCR={(rid) => <EtapeCompteRendu r={r} lecture reunionId={rid} iterationCode={e.it.nom} />}
    />
  );
}
