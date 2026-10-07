import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { pointsFinis } from '../../daily';
import type { VoteEtat } from '../../etatReunion';
import { shiftIteration } from '../../pi';
import type { CatalogueParcours, EtapeCatalogue, ParcoursRole } from '../../reunions';
import { velocite } from '../../reunionsEquipe';
import { TYPES_REUNION } from '../../types';
import { SectionFiche } from '../Choix';
import { TitreFiche } from '../FormSheet';
import { MesTaches } from './Affinage';
import { BlocPoints, BlocSuivi, Compteurs, EtapeCompteRendu, EtapeConcretisation, FenetreEquipe, type PropsReunion, prenom, useReunion } from './base';
import { Ligne, Pastilles, pastilleStatut, st, Vide } from './ui';
import { ListeEditable } from './Affinage';
import { type ChoixVote, VoteEtoiles, votesDe } from './Vote';

/**
 * Rétrospective (lot 6, maquette r04 validée). Animateur : le SM. Le PO y participe comme membre (pas d'onglet PO).
 * - Mon point : Mes tâches · Mes idées (Ce qui va, À améliorer, avec son nom ou anonyme ; « Envoyer mes idées ») ·
 *   Voter (étoiles : 1 par idée, 3 au total ; « Envoyer mes votes »)
 * - Animer : Situation · Indicateurs · Ce qui va · À améliorer (compteur d'idées reçues, Ouvrir le vote, révélation,
 *   3 choix par idée) · Actions (atelier sur les idées retenues) · Concrétisation · Compte rendu.
 * Au compte rendu, la rétro supprime du Sheet les points réglés de l'itération (daily, planification, affinage,
 * revue, rétro) : fin de vie des points (NETTOYAGE).
 */
export const PARCOURS_RETRO: CatalogueParcours = {
  membre: [
    { cle: 'taches', nom: 'Mes tâches' },
    { cle: 'idees', nom: 'Mes idées' },
    { cle: 'voter', nom: 'Voter' },
  ],
  po: [],
  sm: [
    { cle: 'situation', nom: 'Situation' },
    { cle: 'indicateurs', nom: 'Indicateurs' },
    { cle: 'va', nom: 'Ce qui va' },
    { cle: 'ameliorer', nom: 'À améliorer' },
    { cle: 'actions', nom: 'Actions' },
    { cle: 'concretisation', nom: 'Concrétisation' },
    { cle: 'compte_rendu', nom: 'Compte rendu' },
  ],
};
const libelleEtape = (cle: string) => [...PARCOURS_RETRO.sm, ...PARCOURS_RETRO.membre].find((x) => x.cle === cle)?.nom ?? '';
interface Idee {
  col: 'va' | 'ameliorer';
  texte: string;
  anonyme?: boolean;
}
/** Idées retenues pour l'atelier, par défaut les 2 plus votées */
const NB_ATELIER = 2;

export function FenetreRetro(p: PropsReunion) {
  const r = useReunion(p, PARCOURS_RETRO, { nomCourt: 'à la rétro', libelleEtape });
  const { e } = r;
  const animateur = prenom(e.nomDe(p.reunion.organisateur));
  const [cleAnim, setCleAnim] = useState('');
  const [vote, setVote] = useState<VoteEtat | undefined>(undefined);
  const [choixIdee, setChoixIdee] = useState<Record<string, ChoixVote>>({});
  const [anonyme, setAnonyme] = useState(false);
  useEffect(() => {
    if (r.anime && r.live.etat?.vote && !vote) setVote(r.live.etat.vote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.live.etat?.v]);
  const poserVote = (v: VoteEtat | undefined) => {
    setVote(v);
    r.live.publier({ vote: v });
  };
  const idees = r.donneesDe<Idee>('idee').map((x) => ({ id: x.d.c ?? x.p.id, ...x.d, par: x.p.personne, local: x.p.id.startsWith('local-') && x.p.personne === r.mail }));
  const ameliorer = idees.filter((x) => x.col === 'ameliorer');
  const va = idees.filter((x) => x.col === 'va');
  const auteurs = new Set(idees.map((x) => x.par));
  const tour = (r.anime ? vote : r.live.etat?.vote)?.tour ?? 1;
  const nbVotes = (id: string) => [...votesDe(r, id, tour).values()].filter(Boolean).length;
  const triees = [...ameliorer].sort((a, b) => nbVotes(b.id) - nbVotes(a.id));
  const retenues = triees.filter((x, i) => (choixIdee[x.id] ?? (i < NB_ATELIER && nbVotes(x.id) > 0 ? 'retenir' : 'reporter')) === 'retenir');
  const sousIdee = (x: (typeof idees)[number]) => (x.anonyme ? 'anonyme' : `par ${prenom(e.nomDe(x.par))}${x.par === r.mail ? ' (vous)' : ''}`);
  const v = useMemo(() => velocite(e.h.items, e.dansEquipe, shiftIteration(e.it.key, 1)), [e.h.items, e.it.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Actions de la dernière rétro : points de la série concrétisés en tâches
  const actionsPrec = r.serveur.filter((x) => !r.ici(x) && (x.concretisation === 'tache' || x.concretisation === 'sous_tache') && !!x.tache);

  const ajouterIdee = (col: Idee['col'], texte: string) => r.poserDonnee('idee', `${Date.now()}`, { col, texte, anonyme });
  const listeIdees = (col: Idee['col'], titre: string) => {
    const miennes = idees.filter((x) => x.col === col && x.par === r.mail);
    return (
      <ListeEditable
        titre={titre}
        l={miennes.map((x) => x.texte)}
        onChange={(l) => {
          // Retrait : on retire l'idée enlevée ; ajout : la dernière ligne est nouvelle
          for (const x of miennes) if (!l.includes(x.texte)) r.poserDonnee('idee', x.id, null);
          const nouvelle = l.find((t) => !miennes.some((x) => x.texte === t));
          if (nouvelle) ajouterIdee(col, nouvelle);
        }}
        placeholder={col === 'va' ? 'Ce qui va' : 'À améliorer'}
      />
    );
  };

  const rendu = (x: EtapeCatalogue, _o: ParcoursRole, lecture: boolean) => {
    const voteVu = lecture || !r.anime ? r.live.etat?.vote : vote;
    switch (x.cle) {
      case 'situation':
        return (
          <>
            <TitreFiche icone="📊" titre="Situation" vide="" sous={`${e.it.code} · ${auteurs.size} participant${auteurs.size > 1 ? 's' : ''} sur ${e.personnes.length} ont envoyé leurs idées`} />
            <Compteurs l={[{ valeur: String(idees.length), libelle: 'idées reçues' }, { valeur: String(idees.filter((y) => y.anonyme).length), libelle: 'anonymes' }, { valeur: String(actionsPrec.length), libelle: 'actions suivies', ton: 'orange' }]} />
            <BlocSuivi r={r} lecture={lecture} onAjouter />
            <SectionFiche titre="Objectifs de la réunion">
              <Ligne premiere texte="🎯 Regarder l’itération sans chercher de coupable" sous="Choisir 1 ou 2 améliorations concrètes, avec un responsable, pour l’itération suivante." />
            </SectionFiche>
          </>
        );
      case 'indicateurs': {
        const prev = e.situation.prevus ? Math.round((100 * e.situation.faits) / e.situation.prevus) : 0;
        return (
          <>
            <TitreFiche icone="📈" titre="Indicateurs" vide="" sous={`Calculés · ${v.iterations.map((y) => y.key.split('-').pop()).join(' à ')}`} />
            <Compteurs l={[{ valeur: String(v.iterations[v.iterations.length - 1]?.points ?? 0), libelle: 'vélocité' }, { valeur: `${prev} %`, libelle: 'prévisibilité', ton: prev < 80 ? 'orange' : 'vert' }, { valeur: String(e.situation.bloquees), libelle: 'stories bloquées', ton: e.situation.bloquees ? 'rouge' : undefined }]} />
            <SectionFiche titre="Vélocité">
              <Ligne premiere texte={v.iterations.map((y) => y.key.split('-').pop()).join(' → ')} sous={`moyenne ${v.moyenne} pts`} pastille={{ texte: v.iterations.map((y) => y.points).join(' · '), ton: 'bleu' }} />
            </SectionFiche>
            <SectionFiche titre={`Actions des rétros précédentes · ${actionsPrec.length}`}>
              {actionsPrec.length ? (
                actionsPrec.map((y, i) => {
                  const t = e.parId.get(y.tache);
                  return <Ligne key={y.id} premiere={i === 0} texte={y.texte} sous={`👤 ${prenom(e.nomDe(y.responsable || y.personne))}`} pastille={t ? pastilleStatut(t.statut) : { texte: 'supprimée', ton: 'gris' }} />;
                })
              ) : (
                <Vide texte="Aucune action suivie." />
              )}
            </SectionFiche>
          </>
        );
      }
      case 'va':
        return (
          <>
            <TitreFiche icone="👍" titre={`Ce qui va · ${va.length}`} vide="" sous="Idées envoyées par l’équipe" />
            <SectionFiche titre="Idées">{va.length ? va.map((y, i) => <Ligne key={y.id} premiere={i === 0} texte={y.texte} sous={sousIdee(y)} />) : <Vide texte="Aucune idée pour l’instant." />}</SectionFiche>
          </>
        );
      case 'ameliorer': {
        const ouvert = !!voteVu?.ouvert;
        const revele = !!voteVu?.revele;
        const votants = new Set(r.votes.filter((y) => ameliorer.some((a) => a.id === y.v.el) && y.v.tour === tour).map((y) => y.p.personne));
        return (
          <>
            <TitreFiche icone="🔧" titre={`À améliorer · ${ameliorer.length}`} vide="" sous={revele ? 'Votes révélés, triés : les idées retenues vont en atelier' : `Idées reçues : ${auteurs.size} sur ${e.personnes.length}`} />
            {!revele && (
              <SectionFiche titre={ouvert ? `🗳️ Vote ouvert · ${votants.size} sur ${e.personnes.length} ont voté` : '🗳️ Vote'}>
                {ameliorer.map((y, i) => (
                  <Ligne key={y.id} premiere={i === 0} texte={y.texte} sous={`${sousIdee(y)}${ouvert ? ' · votes cachés' : ''}`} />
                ))}
                {!ameliorer.length && <Vide texte="Aucune idée à améliorer pour l’instant." />}
                {!lecture && r.anime && (
                  <View style={{ flexDirection: 'row', gap: 8, padding: 12, flexWrap: 'wrap' }}>
                    {!ouvert ? (
                      <Pastilles options={[{ value: 'o', label: '🗳️ Ouvrir le vote' }]} value="" onChange={() => poserVote({ ouvert: true, revele: false, tour, elements: ameliorer.map((a) => a.id) })} />
                    ) : (
                      <Pastilles
                        options={[
                          { value: 'r', label: '🗳️ Révéler les votes' },
                          { value: 't', label: '🔁 Relancer le vote' },
                        ]}
                        value=""
                        onChange={(c) => poserVote(c === 'r' ? { ...vote!, ouvert: false, revele: true } : { ...vote!, tour: vote!.tour + 1 })}
                      />
                    )}
                  </View>
                )}
              </SectionFiche>
            )}
            {revele && (
              <SectionFiche titre="Votes révélés · 3 choix par idée">
                {triees.map((y, i) => {
                  const c = choixIdee[y.id] ?? (i < NB_ATELIER && nbVotes(y.id) > 0 ? 'retenir' : 'reporter');
                  return (
                    <View key={y.id} style={[st.ligne, { flexDirection: 'column', alignItems: 'stretch' }, i > 0 && st.bord]}>
                      <View style={st.ligneHaut}>
                        <View style={st.corps}>
                          <Text style={st.texte}>{y.texte}</Text>
                          <Text style={st.sous}>{sousIdee(y)}</Text>
                        </View>
                        <Text style={{ fontWeight: '800', color: '#B45309' }}>★ {nbVotes(y.id)}</Text>
                      </View>
                      {!lecture && r.anime && (
                        <Pastilles
                          petit
                          options={[
                            { value: 'retenir', label: '✓ Retenir' },
                            { value: 'tour', label: '🔁 Nouveau tour' },
                            { value: 'reporter', label: '⏭ Reporter' },
                          ]}
                          value={c}
                          onChange={(v2) => {
                            if (v2 === 'tour') return poserVote({ ouvert: true, revele: false, tour: tour + 1, elements: ameliorer.map((a) => a.id) });
                            setChoixIdee((m) => ({ ...m, [y.id]: v2 as ChoixVote }));
                          }}
                        />
                      )}
                    </View>
                  );
                })}
              </SectionFiche>
            )}
          </>
        );
      }
      case 'actions':
        return (
          <>
            <TitreFiche icone="🛠️" titre="Actions" vide="" sous={`Atelier sur ${retenues.length ? retenues.map((y) => `« ${y.texte} »`).join(', ') : 'les idées retenues'}`} />
            <BlocPoints r={r} points={r.tous.filter((y) => r.ici(y))} lecture={lecture} placeholder="＋ Action, décision ou blocage" />
          </>
        );
      case 'concretisation':
        return <EtapeConcretisation r={r} lecture={lecture} iterationCode={e.it.code} />;
      case 'compte_rendu':
        return (
          <EtapeCompteRendu
            r={r}
            lecture={lecture}
            iterationCode={shiftIteration(e.it.key, 1).split('-').pop() ?? ''}
            entete={
              <>
                <Compteurs l={[{ valeur: String(idees.length), libelle: 'idées' }, { valeur: String(retenues.length), libelle: 'en atelier', ton: 'vert' }, { valeur: `${auteurs.size}/${e.personnes.length}`, libelle: 'participants' }]} />
                <SectionFiche titre={`En atelier · ${retenues.length}`}>{retenues.length ? retenues.map((y, i) => <Ligne key={y.id} premiere={i === 0} texte={y.texte} />) : <Vide texte="Aucune." />}</SectionFiche>
                <Text style={[st.sous, { marginHorizontal: 16, marginTop: 8 }]}>À l’envoi, les points réglés de l’itération (daily, planification, affinage, revue, rétro) sont supprimés du Sheet : la trace reste dans les comptes rendus.</Text>
              </>
            }
          />
        );
      // ---- Mon point ----
      case 'taches':
        return <MesTaches r={r} />;
      case 'idees':
        return (
          <>
            <TitreFiche icone="💡" titre="Mes idées" vide="" sous="Avant la rétro, quand vous voulez" />
            {listeIdees('va', 'Ce qui va')}
            {listeIdees('ameliorer', 'À améliorer')}
            <SectionFiche titre="Affichage de mes idées">
              <View style={st.ligne}>
                <Pastilles options={[{ value: 'nom', label: 'Avec mon nom' }, { value: 'anonyme', label: 'Anonyme' }]} value={anonyme ? 'anonyme' : 'nom'} onChange={(v2) => setAnonyme(v2 === 'anonyme')} />
              </View>
            </SectionFiche>
          </>
        );
      case 'voter':
        return (
          <>
            <TitreFiche icone="🗳️" titre="Voter" vide="" sous={r.live.etat?.vote?.ouvert ? `Vote ouvert par ${animateur}` : 'En attente de l’ouverture du vote'} />
            <VoteEtoiles r={r} elements={ameliorer.map((y) => ({ id: y.id, texte: y.texte, sous: `${y.par === r.mail ? '(vous) · ' : ''}${sousIdee(y)}` }))} vote={r.live.etat?.vote} animateur={animateur} />
            <Text style={[st.sous, { marginHorizontal: 16, marginTop: 8 }]}>1 étoile par idée, 3 au total. Les idées anonymes le restent.</Text>
          </>
        );
      default:
        return null;
    }
  };

  const envoyerCR = async () => {
    // Fin de vie : points réglés de toutes les réunions de l'équipe (une lecture du Sheet de l'équipe)
    const tous = await p.actions.lirePoints(r.espace, '').catch(() => []);
    const niveau = p.reunion.niveau;
    const series = (['daily', 'planification', 'affinage', 'revue', 'retro'] as const).filter((t) => TYPES_REUNION[t]).map((t) => `${t}-${niveau}-`);
    const retirer = series.flatMap((s) => pointsFinis(tous, `${s}${e.jour}`, e.h.items));
    await r.envoyerCompteRendu({
      iteration: shiftIteration(e.it.key, 1),
      lignes: [`Idées · ${idees.length} (${va.length} ce qui va, ${ameliorer.length} à améliorer) ; ${auteurs.size} participants sur ${e.personnes.length}`, ...(retenues.length ? [`En atelier : ${retenues.map((y) => y.texte).join(' ; ')}`] : []), ...(retirer.length ? [`${retirer.length} points réglés retirés du Sheet`] : [])],
      retirer,
    });
  };

  return (
    <FenetreEquipe
      p={p}
      r={r}
      catalogue={PARCOURS_RETRO}
      rendu={rendu}
      libelleFin={() => 'Envoyer mes idées'}
      etapeAnim={{ cle: cleAnim, setCle: setCleAnim }}
      envoyerCR={envoyerCR}
      renduCR={(rid) => <EtapeCompteRendu r={r} lecture reunionId={rid} iterationCode={e.it.code} />}
    />
  );
}
