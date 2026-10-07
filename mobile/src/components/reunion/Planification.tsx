import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { dateCourte } from '../../daily';
import type { VoteEtat } from '../../etatReunion';
import { fmtPoints, iterationOfItem, pointsOf, shiftIteration, nomSprintDe } from '../../pi';
import type { CatalogueParcours, EtapeCatalogue, ParcoursRole } from '../../reunions';
import { capacite, joursTravailles, lireNombre, nombreFr, PTS_JOUR_DEFAUT, storiesPretes, velocite } from '../../reunionsEquipe';
import { useSafe } from '../../safe';
import { colors } from '../../theme';
import type { Item } from '../../types';
import { FeuilleChoix, SectionFiche } from '../Choix';
import { TitreFiche } from '../FormSheet';
import { ListeEditable, MesTaches } from './Affinage';
import { BlocPoints, BlocSuivi, Compteurs, EtapeCompteRendu, EtapeConcretisation, FenetreEquipe, type PropsReunion, prenom, QuestionsEquipe, useReunion } from './base';
import { AjoutElement, itemReunion } from './Ajout';
import { Ligne, Pastilles, pastilleStatut, st, Vide } from './ui';
import { CARTES_POKER, type DecisionVote, VoteAnimateur } from './Vote';

/**
 * Planification d'itération (lot 6, maquette r02 validée). Animateur : le SM.
 * - Mon point : Mes tâches (que faire d'une story pas finie) · Disponibilités (absences : description et nombre de
 *   jours, 0,5 possible ; jours fériés ajoutés tout seuls ; capacité informative) · Stories (celles que je prends,
 *   Mes points ; « Envoyer à Nina »)
 * - PO : Questions de l'équipe · Objectifs d'itération · Priorités (« Envoyer à Nina »)
 * - Animer : Situation · Capacité (jours × points par jour, modifiables) · Objectifs · Stories (affectation : choix
 *   de chacun, une personne si deux choix, ＋ backlog sous un membre qui a de la place, poker rapide d'une story non
 *   estimée) · Concrétisation · Compte rendu (stories engagées : itération et responsable, une écriture groupée).
 */
export const PARCOURS_PLANIF: CatalogueParcours = {
  membre: [
    { cle: 'taches', nom: 'Mes tâches' },
    { cle: 'dispos', nom: 'Disponibilités' },
    { cle: 'prises', nom: 'Stories' },
  ],
  po: [
    { cle: 'questions', nom: 'Questions de l’équipe' },
    { cle: 'objectifs_po', nom: 'Objectifs' },
    { cle: 'priorites', nom: 'Priorités' },
  ],
  sm: [
    { cle: 'situation', nom: 'Situation' },
    { cle: 'capacite', nom: 'Capacité' },
    { cle: 'objectifs', nom: 'Objectifs' },
    { cle: 'stories', nom: 'Stories' },
    { cle: 'concretisation', nom: 'Concrétisation' },
    { cle: 'compte_rendu', nom: 'Compte rendu' },
  ],
};
const libelleEtape = (cle: string) => [...PARCOURS_PLANIF.sm, ...PARCOURS_PLANIF.membre, ...PARCOURS_PLANIF.po].find((x) => x.cle === cle)?.nom ?? '';

export function FenetrePlanification(p: PropsReunion) {
  const safe = useSafe();
  const r = useReunion(p, PARCOURS_PLANIF, { nomCourt: 'à la planification', libelleEtape });
  const { e } = r;
  const fmt = (n: number) => fmtPoints(n, safe.pointsJours);
  const [cleAnim, setCleAnim] = useState('');
  const precedente = shiftIteration(e.it.key, -1);
  const [ptsJour, setPtsJour] = useState<Record<string, string>>({});
  /** Affectation décidée par l'animateur : story → e-mail ('' = pas prise) */
  const [affect, setAffect] = useState<Record<string, string>>({});
  const [ouvertMembre, setOuvertMembre] = useState('');
  const [feuille, setFeuille] = useState('');
  const [vote, setVote] = useState<VoteEtat | undefined>(undefined);
  const [estimations, setEstimations] = useState<Record<string, DecisionVote>>({});
  const [objectifsAjoutes, setObjectifsAjoutes] = useState<string[]>([]);
  const [desc, setDesc] = useState('');
  const [jours, setJours] = useState('');

  // Données de préparation
  const absences = r.donneesDe<{ desc: string; jours: number }>('absence');
  const absencesDe = (m: string) => absences.filter((x) => x.p.personne === m);
  const prises = r.donneesDe<{ v: boolean }>('prise').filter((x) => x.d.v);
  const reports = r.donneesDe<{ v: string }>('report');
  const objectifsPO = r.donneesDe<{ l: string[] }>('objectifs').slice(-1)[0]?.d.l ?? [];
  const objectifs = [...objectifsPO, ...objectifsAjoutes];
  const ordre = r.donneesDe<{ l: string[] }>('ordre').slice(-1)[0]?.d.l ?? [];
  // Reportées : stories de l'itération précédente pas terminées ; backlog prêt
  const reportees = useMemo(() => e.h.items.filter((t) => t.type === 'story' && !t.parent && e.dansEquipe(t) && iterationOfItem(t) === precedente && t.statut !== 'termine'), [e.h.items, precedente]); // eslint-disable-line react-hooks/exhaustive-deps
  const backlog = useMemo(() => {
    const l = storiesPretes(e.h.items, e.dansEquipe, e.it.key).filter((t) => !reportees.includes(t));
    const rang = (t: Item) => (ordre.includes(t.id) ? ordre.indexOf(t.id) : 999);
    return [...l].sort((a, b) => rang(a) - rang(b));
  }, [e.h.items, e.it.key, reportees, ordre]); // eslint-disable-line react-hooks/exhaustive-deps
  const sansEstimation = useMemo(() => e.h.items.filter((t) => t.type === 'story' && t.statut !== 'termine' && e.dansEquipe(t) && !pointsOf(t) && (!iterationOfItem(t) || iterationOfItem(t) >= e.it.key)), [e.h.items, e.it.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const candidates = [...reportees, ...backlog, ...sansEstimation.filter((t) => !backlog.includes(t) && !reportees.includes(t))];
  const pts = (t: Item) => (estimations[t.id]?.choix === 'retenir' && estimations[t.id].val ? Number(estimations[t.id].val) || 0 : pointsOf(t));
  /** Qui a choisi la story (préparation de chacun) ; une story reportée garde son responsable */
  const choisiPar = (t: Item) => {
    const l = [...new Set(prises.filter((x) => x.d.c === t.id).map((x) => x.p.personne))];
    if (!l.length && reportees.includes(t) && t.responsable) {
      const rep = reports.find((x) => x.d.c === t.id)?.d.v;
      const resp = r.org.personne.get(t.responsable)?.email?.toLowerCase() ?? '';
      if (rep !== 'backlog' && resp) return [resp];
    }
    return l;
  };
  const assigne = (t: Item) => (t.id in affect ? affect[t.id] : choisiPar(t).length === 1 ? choisiPar(t)[0] : '');
  const engagees = candidates.filter((t) => !!assigne(t));
  const ptsJourDe = (m: string) => {
    const n = lireNombre(ptsJour[m] ?? '');
    return Number.isFinite(n) && n > 0 ? n : PTS_JOUR_DEFAUT;
  };
  const dispo = (m: string) => joursTravailles(e.it.key, absencesDe(m).map((x) => Number(x.d.jours) || 0));
  const capa = (m: string) => capacite(dispo(m).jours, ptsJourDe(m));
  const charge = (m: string) => engagees.filter((t) => assigne(t) === m).reduce((s, t) => s + pts(t), 0);
  const capaTotale = e.personnes.reduce((s, x) => s + capa(x.email.toLowerCase()), 0);
  const pris = engagees.reduce((s, t) => s + pts(t), 0);
  const v = useMemo(() => velocite(e.h.items, e.dansEquipe, e.it.key), [e.h.items, e.it.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const ligneStory = (t: Item, i: number, lecture: boolean) => {
    const c = choisiPar(t);
    const a = assigne(t);
    const conflit = c.length > 1 && !(t.id in affect);
    return (
      <Pressable key={t.id} disabled={lecture} onPress={() => setFeuille(t.id)} style={[st.ligne, i > 0 && st.bord]} accessibilityRole="button">
        <Text style={[st.caseACocher, !!a && st.caseCochee]}>{a ? '✓' : ''}</Text>
        <View style={st.corps}>
          <Text style={st.texte}>{t.titre}</Text>
          <Text style={st.sous}>{[pts(t) ? fmt(pts(t)) : 'sans estimation', reportees.includes(t) ? 'reportée' : '', a ? `👤 ${prenom(e.nomDe(a))}` : conflit ? `choisie par ${c.map((m) => prenom(e.nomDe(m))).join(' et ')}` : 'pas prise'].filter(Boolean).join(' · ')}</Text>
        </View>
        {conflit && <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 12 }}>⚠ {c.length} choix</Text>}
        {!lecture && <Text style={st.chevron}>›</Text>}
      </Pressable>
    );
  };

  const rendu = (x: EtapeCatalogue, _o: ParcoursRole, lecture: boolean) => {
    const voteVu = lecture || !r.anime ? r.live.etat?.vote : vote;
    switch (x.cle) {
      case 'situation': {
        const vp = v.iterations[v.iterations.length - 1]?.points ?? 0;
        return (
          <>
            <TitreFiche icone="📊" titre="Situation" vide="" sous={`${nomSprintDe(precedente)} terminé · ${e.it.nom} du ${dateCourte(e.it.start)} au ${dateCourte(e.it.end)}`} />
            <Compteurs l={[{ valeur: String(vp), libelle: `vélocité ${nomSprintDe(precedente)}` }, { valeur: String(v.moyenne), libelle: 'moyenne 3 sprints' }, { valeur: String(reportees.length), libelle: 'reportées', ton: reportees.length ? 'orange' : undefined }]} />
            <BlocSuivi r={r} lecture={lecture} onAjouter />
            <SectionFiche titre={`Reportées de ${nomSprintDe(precedente)} · ${reportees.length}`}>
              {reportees.length ? reportees.map((t, i) => <Ligne key={t.id} premiere={i === 0} texte={t.titre} sous={`${fmt(pointsOf(t))}${t.responsable ? ` · 👤 ${prenom(r.org.personne.get(t.responsable)?.nom ?? '')}` : ''}`} pastille={{ texte: 'à reprendre', ton: 'orange' }} />) : <Vide texte="✓ Rien de reporté." />}
            </SectionFiche>
            <SectionFiche titre="Objectifs de la réunion">
              <Ligne premiere texte="🎯 S’engager sur le sprint" sous="Fixer la capacité, valider les objectifs du PO, s’engager sur les stories." />
            </SectionFiche>
          </>
        );
      }
      case 'capacite':
        return (
          <>
            <TitreFiche icone="👥" titre={`Capacité · ${capaTotale} pts`} vide="" sous="Déduite des jours travaillés · points par jour modifiables" />
            <SectionFiche titre="Par membre · jours × pts/jour">
              {e.personnes.map((y, i) => {
                const m = y.email.toLowerCase();
                const d = dispo(m);
                const abs = absencesDe(m);
                return (
                  <View key={y.id} style={[st.ligne, i > 0 && st.bord]}>
                    <View style={st.corps}>
                      <Text style={st.texte}>{y.nom}</Text>
                      <Text style={st.sous}>{[`${nombreFr(d.jours)} j`, ...abs.map((a) => `${a.d.desc} (${nombreFr(Number(a.d.jours) || 0)} j)`), d.feries.length ? `${d.feries.length} férié${d.feries.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}</Text>
                    </View>
                    {!lecture && (
                      <TextInput value={ptsJour[m] ?? nombreFr(PTS_JOUR_DEFAUT)} onChangeText={(t) => setPtsJour((mm) => ({ ...mm, [m]: t }))} keyboardType="decimal-pad" style={[st.note, { width: 56, textAlign: 'center' }]} accessibilityLabel={`Points par jour de ${y.nom}`} />
                    )}
                    <Text style={[st.texte, { fontWeight: '700', minWidth: 52, textAlign: 'right' }]}>{capa(m)} pts</Text>
                  </View>
                );
              })}
            </SectionFiche>
            <SectionFiche titre="Repère">
              <Ligne premiere texte="Vélocité moyenne (3 sprints)" pastille={{ texte: `${v.moyenne} pts`, ton: 'bleu' }} />
            </SectionFiche>
            <Text style={[st.sous, { marginHorizontal: 16, marginTop: 8 }]}>Les absences viennent du point de chacun, jours fériés compris. Les points par jour se saisissent (ex. 1,1). Engagement conseillé : {Math.min(capaTotale, v.moyenne || capaTotale)} pts au plus.</Text>
          </>
        );
      case 'objectifs':
        return (
          <>
            <TitreFiche icone="🎯" titre={`Objectifs de sprint · ${objectifs.length}`} vide="" sous="Préparés par le PO, validés par l’équipe" />
            <ListeEditable titre="Objectifs" l={objectifs} lecture={lecture} onChange={(l) => setObjectifsAjoutes(l.filter((o) => !objectifsPO.includes(o)))} placeholder="Objectif de sprint" />
          </>
        );
      case 'stories': {
        const t = candidates.find((y) => y.id === feuille);
        const noms = e.personnes.map((y) => y.email.toLowerCase());
        return (
          <>
            <TitreFiche icone="📖" titre="Stories à prendre" vide="" sous="Choix de chacun · vous validez l’affectation" />
            <Compteurs l={[{ valeur: `${pris}`, libelle: 'pts pris' }, { valeur: String(capaTotale), libelle: 'capacité' }, { valeur: String(v.moyenne), libelle: 'vélocité' }]} />
            <SectionFiche titre={`Stories · ${candidates.length}`}>{candidates.length ? candidates.map((y, i) => ligneStory(y, i, lecture)) : <Vide texte="Aucune story prête dans le backlog." />}</SectionFiche>
            <AjoutElement
              mot="story"
              feminin
              lecture={lecture}
              aide={`Engagée dans le ${e.it.nom} de l’équipe ${e.nomNiveau}`}
              existants={e.h.items
                .filter((t) => t.type === 'story' && t.statut !== 'termine' && !candidates.includes(t) && iterationOfItem(t) !== e.it.key && (e.dansEquipe(t) || !t.equipe))
                .map((t) => ({ id: t.id, titre: t.titre, sous: [t.equipe ? 'backlog de l’équipe' : 'sans équipe', iterationOfItem(t) ? nomSprintDe(iterationOfItem(t)) : ''].filter(Boolean).join(' · ') }))}
              onNouveau={async (titre) => {
                const [t] = await p.actions.creerTaches(p.reunion.espace || 'moi', [itemReunion(p.reunion.espace || 'moi', titre, { type: 'story', equipe: e.equipe?.id ?? '', iteration: e.it.key })]);
                return async () => p.actions.supprimer?.('item', t.id);
              }}
              onChoisir={async (id) => {
                const t = e.h.items.find((x) => x.id === id)!;
                const avant = { iteration: t.iteration, equipe: t.equipe ?? '' };
                await p.actions.modifierItems?.(t.espace || 'moi', [{ id, iteration: e.it.key, equipe: e.equipe?.id ?? avant.equipe }]);
                return async () => void (await p.actions.modifierItems?.(t.espace || 'moi', [{ id, ...avant }]));
              }}
            />
            <SectionFiche titre="Charge par membre · pris / capacité">
              {noms.map((m, i) => {
                const c = charge(m);
                const cap = capa(m);
                const place = cap - c;
                return (
                  <View key={m}>
                    <Pressable disabled={lecture || place <= 0} onPress={() => setOuvertMembre(ouvertMembre === m ? '' : m)} style={[st.ligne, i > 0 && st.bord]} accessibilityRole="button">
                      <View style={st.corps}>
                        <Text style={st.texte}>{e.nomDe(m)}</Text>
                      </View>
                      <Text style={{ fontWeight: '700', color: c > cap ? colors.danger : c === cap ? colors.success : colors.warning }}>
                        {fmt(c)} / {fmt(cap)}
                      </Text>
                      {!lecture && place > 0 && <Text style={[st.ajouterLien, { paddingHorizontal: 6 }]}>{ouvertMembre === m ? '▴' : '＋'}</Text>}
                    </Pressable>
                    {ouvertMembre === m && (
                      <View style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, marginLeft: 14 }}>
                        <Text style={[st.sous, { paddingHorizontal: 12, paddingTop: 6 }]}>Backlog · {fmt(place)} de place</Text>
                        {backlog
                          .filter((y) => !assigne(y))
                          .map((y) => (
                            <Pressable key={y.id} onPress={() => setAffect((a) => ({ ...a, [y.id]: m }))} style={st.ligne} accessibilityRole="button" disabled={pts(y) > place}>
                              <View style={st.corps}>
                                <Text style={[st.texte, pts(y) > place && { color: colors.muted }]}>{y.titre}</Text>
                                <Text style={st.sous}>{pts(y) > place ? 'trop grande' : fmt(pts(y))}</Text>
                              </View>
                              {pts(y) <= place && <Text style={st.ajouterLien}>＋</Text>}
                            </Pressable>
                          ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </SectionFiche>
            {/* Poker rapide : les stories non estimées qu'on veut prendre, un tour */}
            {candidates
              .filter((y) => !pointsOf(y) && (assigne(y) || choisiPar(y).length))
              .map((y) => (
                <VoteAnimateur
                  key={y.id}
                  r={r}
                  el={y.id}
                  titre={`🃏 Poker rapide · ${y.titre}`}
                  valeurs={CARTES_POKER}
                  vote={voteVu}
                  decision={estimations[y.id]}
                  lecture={lecture}
                  onVote={(vv) => (setVote(vv), r.live.publier({ vote: vv }))}
                  onDecision={(d) => setEstimations((m) => (d ? { ...m, [y.id]: d } : Object.fromEntries(Object.entries(m).filter(([k]) => k !== y.id))))}
                />
              ))}
            <BlocPoints r={r} points={r.tous.filter((y) => r.ici(y))} lecture={lecture} stories={candidates} />
            {t && !lecture && (
              <FeuilleChoix
                titre={t.titre}
                value={assigne(t)}
                groupes={[{ options: [{ value: '-', label: 'Pas prise ce sprint' }, ...noms.map((m) => ({ value: m, label: e.nomDe(m), meta: `${choisiPar(t).includes(m) ? 'l’a choisie · ' : ''}${fmt(charge(m))}/${fmt(capa(m))}` }))] }]}
                onChoisir={(val) => {
                  if (val) setAffect((a) => ({ ...a, [t.id]: val === '-' ? '' : val }));
                  setFeuille('');
                }}
                onFermer={() => setFeuille('')}
              />
            )}
          </>
        );
      }
      case 'concretisation':
        return <EtapeConcretisation r={r} lecture={lecture} iterationCode={e.it.nom} />;
      case 'compte_rendu':
        return (
          <EtapeCompteRendu
            r={r}
            lecture={lecture}
            iterationCode={e.it.nom}
            entete={
              <SectionFiche titre="Engagé">
                <Ligne premiere texte={`${engagees.length} stor${engagees.length > 1 ? 'ies' : 'y'} · ${fmt(pris)}`} sous={engagees.map((t) => t.titre).join(' · ')} pastille={{ texte: e.it.nom, ton: 'bleu' }} />
                {objectifs.map((o, i) => (
                  <Ligne key={o} texte={o} sous={`objectif ${i + 1}`} />
                ))}
              </SectionFiche>
            }
          />
        );
      // ---- Mon point ----
      case 'taches': {
        const moiP = e.personnes.find((y) => y.email.toLowerCase() === r.mail);
        const pasFinies = reportees.filter((t) => t.responsable === moiP?.id);
        return (
          <>
            <MesTaches r={r} />
            {pasFinies.map((t) => (
              <SectionFiche key={t.id} titre={`${t.titre} · non terminée`}>
                <View style={{ padding: 12 }}>
                  <Pastilles petit options={[{ value: 'continuer', label: `Continuer en ${e.it.nom}` }, { value: 'backlog', label: 'Rendre au backlog' }]} value={reports.find((y) => y.d.c === t.id)?.d.v ?? 'continuer'} onChange={(y) => r.poserDonnee('report', t.id, { v: y }, 'membre', t.id)} />
                </View>
              </SectionFiche>
            ))}
          </>
        );
      }
      case 'dispos': {
        const mes = absencesDe(r.mail);
        const d = dispo(r.mail);
        const ajouter = () => {
          const j = lireNombre(jours);
          if (!desc.trim() || !(j > 0)) return;
          r.poserDonnee('absence', `${Date.now()}`, { desc: desc.trim(), jours: j });
          setDesc('');
          setJours('');
        };
        return (
          <>
            <TitreFiche icone="📅" titre="Mes disponibilités" vide="" sous={`${e.it.nom} du ${dateCourte(e.it.start)} au ${dateCourte(e.it.end)}`} />
            <SectionFiche titre="Mes absences · description et jours">
              <Ligne premiere texte="Jours fériés" sous={d.feries.length ? d.feries.map((f) => dateCourte(f)).join(', ') : 'aucun pendant le sprint'} pastille={{ texte: 'Auto', ton: 'bleu' }} />
              {mes.map((a) => (
                <Ligne key={a.p.id} texte={a.d.desc} pastille={{ texte: `${nombreFr(Number(a.d.jours) || 0)} j`, ton: 'orange' }} onRetirer={() => r.poserDonnee('absence', a.d.c ?? '', null)} />
              ))}
              <View style={[st.ligne, st.bord]}>
                <TextInput value={desc} onChangeText={setDesc} placeholder="Description (ex. formation le 10/10 après-midi)" placeholderTextColor={colors.muted} style={[st.note, { flex: 1 }]} accessibilityLabel="Description de l’absence" />
                <TextInput value={jours} onChangeText={setJours} placeholder="Jours" placeholderTextColor={colors.muted} keyboardType="decimal-pad" style={[st.note, { width: 60 }]} accessibilityLabel="Nombre de jours (0,5 possible)" />
                <Pressable onPress={ajouter} style={st.ajouter} accessibilityRole="button">
                  <Text style={st.ajouterTexte}>Ajouter</Text>
                </Pressable>
              </View>
            </SectionFiche>
            <SectionFiche titre="Ma capacité · informative">
              <Ligne premiere texte={`${nombreFr(d.jours)} j travaillés × ${nombreFr(PTS_JOUR_DEFAUT)} pt/j`} sous="jours fériés et absences déduits · points par jour fixés par le SM" pastille={{ texte: fmt(capa(r.mail)), ton: 'bleu' }} />
            </SectionFiche>
          </>
        );
      }
      case 'prises':
        return (
          <>
            <TitreFiche icone="📖" titre="Stories que je prends" vide="" sous="Backlog prêt · cochez · le SM valide l’affectation" />
            <SectionFiche titre={`Backlog prêt · ${backlog.length}`}>
              {backlog.length ? (
                backlog.map((t, i) => {
                  const coche = prises.some((y) => y.d.c === t.id && y.p.personne === r.mail);
                  return (
                    <Pressable key={t.id} onPress={() => r.poserDonnee('prise', t.id, coche ? null : { v: true }, 'membre', t.id)} style={[st.ligne, i > 0 && st.bord]} accessibilityRole="checkbox" accessibilityState={{ checked: coche }}>
                      <Text style={[st.caseACocher, coche && st.caseCochee]}>{coche ? '✓' : ''}</Text>
                      <View style={st.corps}>
                        <Text style={st.texte}>{t.titre}</Text>
                        <Text style={st.sous}>{fmt(pointsOf(t))}</Text>
                      </View>
                      <Text style={st.sous}>{pastilleStatut(t.statut).texte}</Text>
                    </Pressable>
                  );
                })
              ) : (
                <Vide texte="Aucune story prête : voir l’affinage." />
              )}
            </SectionFiche>
            <BlocPoints r={r} titre="Mes points" points={r.prep.filter((y) => y.type !== 'donnee')} pourPrep stories={candidates} />
          </>
        );
      // ---- PO ----
      case 'questions':
        return <QuestionsEquipe r={r} />;
      case 'objectifs_po':
        return (
          <>
            <TitreFiche icone="🎯" titre="Objectifs de sprint" vide="" sous={`Ce que l’équipe pourrait viser en ${e.it.nom}`} />
            <ListeEditable titre="Objectifs" l={objectifsPO} onChange={(l) => r.poserDonnee('objectifs', 'objectifs', { l }, 'po')} placeholder="Objectif" />
          </>
        );
      case 'priorites': {
        const l = backlog;
        const deplacer = (i: number, d: number) => {
          const ids = l.map((t) => t.id);
          const j = i + d;
          if (j < 0 || j >= ids.length) return;
          [ids[i], ids[j]] = [ids[j], ids[i]];
          r.poserDonnee('ordre', 'ordre', { l: ids }, 'po');
        };
        return (
          <>
            <TitreFiche icone="📖" titre="Priorités du backlog" vide="" sous="Stories prêtes, les plus importantes d’abord" />
            <SectionFiche titre={`Stories prêtes · ${l.length}`}>
              {l.map((t, i) => (
                <View key={t.id} style={[st.ligne, i > 0 && st.bord]}>
                  <Text style={[st.texte, { width: 22, color: colors.muted }]}>{i + 1}</Text>
                  <View style={st.corps}>
                    <Text style={st.texte}>{t.titre}</Text>
                    <Text style={st.sous}>{fmt(pointsOf(t))}</Text>
                  </View>
                  <Pressable onPress={() => deplacer(i, -1)} disabled={i === 0} hitSlop={8} accessibilityLabel={`Monter « ${t.titre} »`}>
                    <Text style={{ fontSize: 18, color: i === 0 ? colors.border : colors.primary }}>↑</Text>
                  </Pressable>
                  <Pressable onPress={() => deplacer(i, 1)} disabled={i === l.length - 1} hitSlop={8} accessibilityLabel={`Descendre « ${t.titre} »`}>
                    <Text style={{ fontSize: 18, color: i === l.length - 1 ? colors.border : colors.primary }}>↓</Text>
                  </Pressable>
                </View>
              ))}
              {!l.length && <Vide texte="Aucune story prête : voir l’affinage." />}
            </SectionFiche>
          </>
        );
      }
      default:
        return null;
    }
  };

  const envoyerCR = async () => {
    const stories = engagees.map((t) => ({
      id: t.id,
      iteration: e.it.key,
      responsable: r.org.personne.get(e.personnes.find((y) => y.email.toLowerCase() === assigne(t))?.id ?? '')?.id ?? t.responsable ?? '',
      ...(estimations[t.id]?.val && estimations[t.id].val !== '?' ? { points: estimations[t.id].val } : {}),
    }));
    // Reportées rendues au backlog
    for (const t of reportees) if (!assigne(t)) stories.push({ id: t.id, iteration: '', responsable: t.responsable ?? '' });
    await r.envoyerCompteRendu({
      iteration: e.it.key,
      stories,
      lignes: [`Engagé · ${engagees.length} stories · ${pris} pts (capacité ${capaTotale}, vélocité ${v.moyenne})`, ...engagees.map((t) => `• ${t.titre} · ${prenom(e.nomDe(assigne(t)))}`), ...(objectifs.length ? [`Objectifs : ${objectifs.join(' ; ')}`] : [])],
    });
  };

  return (
    <FenetreEquipe
      p={p}
      r={r}
      catalogue={PARCOURS_PLANIF}
      rendu={rendu}
      libelleFin={() => `Envoyer à ${prenom(e.nomDe(p.reunion.organisateur))}`}
      etapeAnim={{ cle: cleAnim, setCle: setCleAnim, detail: cleAnim === 'stories' ? `${pris} pts pris sur ${capaTotale}` : '' }}
      envoyerCR={envoyerCR}
      renduCR={(rid) => <EtapeCompteRendu r={r} lecture reunionId={rid} iterationCode={e.it.nom} />}
    />
  );
}
