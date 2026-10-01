import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  aConcretiser,
  concretisationParDefaut,
  dateCourte,
  enRetard,
  jourReunion,
  LIBELLE_CONCRETISATION,
  LIBELLE_TYPE_POINT,
  pastillePoint,
  prefixeReunion,
  situationIteration,
  storiesBloquees,
  suivis as calculerSuivis,
  texteCompteRendu,
  veilleOuvree,
} from '../daily';
import { lireNiveau, personneParEmail } from '../echange/hierarchieEchange';
import { useHierarchy } from '../hierarchyContext';
import { type OrgValue, porteurs } from '../organisation';
import { fmtPoints, iterationOf } from '../pi';
import { participantsReunion } from '../reunions';
import { useSafe } from '../safe';
import { colors } from '../theme';
import {
  type Concretisation,
  type EchangeInput,
  type Item,
  type ItemInput,
  type PointReunion,
  RECURRENCE_DEFAUTS,
  type Reunion,
  type Statut,
  type TypePoint,
  TYPES_REUNION,
} from '../types';
import { SectionFiche } from './Choix';
import { FenetreReunion, type ModeReunion } from './FenetreReunion';
import { TitreFiche } from './FormSheet';

/**
 * Daily (lot 6, validé le 01/10) : contenu de la fenêtre de réunion, en deux modes.
 * - Organisateur (Scrum Master) : Situation (compteurs de l'itération, suivis, objectifs) · Tour de table (un membre
 *   à la fois : ses stories, un seul bloc « Points notés » pour ce qu'il a préparé et ce que note le SM) ·
 *   Concrétisation (chaque blocage, décision, action : sous-tâche de la story, tâche à part, rien, ou escalade au
 *   RTE ; avec un responsable) · Compte rendu (tâches créées en un lot, escalades et compte rendu envoyés au RTE).
 * - Participant : Mes suivis · Hier · Aujourd'hui · Blocages · Prêt (préparation facultative, envoyée au SM).
 * Points rangés dans l'onglet PointsReunion du Sheet de l'espace de l'équipe : une lecture à l'ouverture, une
 * relecture en arrivant sur chaque membre (au plus une par membre), une écriture groupée à l'envoi.
 */

/** Opérations du daily (fournies par l'application : Sheets, état des tâches et des échanges) */
export interface ActionsDaily {
  lirePoints: (espace: string, prefixe: string) => Promise<PointReunion[]>;
  ecrirePoints: (espace: string, creer: Omit<PointReunion, 'id' | 'cree_le'>[], modifier: (Partial<PointReunion> & { id: string })[], retirer: string[]) => Promise<unknown>;
  /** Crée des tâches en un seul passage ; renvoie les tâches créées dans l'ordre */
  creerTaches: (espace: string, inputs: ItemInput[]) => Promise<Item[]>;
  /** Envoie des échanges (escalades, compte rendu) en un seul passage */
  envoyerEchanges: (espace: string, inputs: EchangeInput[]) => Promise<void>;
  /** Statut d'une tâche suivie (tout de suite) */
  onSetStatut: (t: Item, statut: Statut) => void | Promise<void>;
}

interface Props {
  visible: boolean;
  reunion: Reunion | null;
  mode: ModeReunion;
  org: OrgValue;
  /** Vous (e-mail) */
  moi: string;
  /** AAAA-MM-JJ */
  aujourdhui: string;
  fil?: string;
  actions: ActionsDaily;
  onFermer: () => void;
  onInfo?: (texte: string) => void;
}

type Local = Omit<PointReunion, 'id' | 'cree_le'> & { id: string; cree_le: string };
const prenom = (nom: string) => nom.split(' ')[0] || nom;
const arrondi = (n: number) => String(Math.round(n * 10) / 10);
const STATUTS: { v: Statut; l: string }[] = [
  { v: 'a_faire', l: 'À faire' },
  { v: 'en_cours', l: 'En cours' },
  { v: 'termine', l: 'Fait ✓' },
];
let compteurLocal = 0;
const idLocal = () => `local-${Date.now()}-${++compteurLocal}`;

export function FenetreDaily(p: Props) {
  const { reunion } = p;
  if (!reunion) return null;
  return p.mode === 'organisateur' ? <DailyOrganisateur {...p} reunion={reunion} /> : <DailyParticipant {...p} reunion={reunion} />;
}

/** Équipe du daily, ses personnes, sa situation d'itération (commun aux deux modes) */
function useEquipeDaily(reunion: Reunion, org: OrgValue, aujourdhui: string, points: PointReunion[]) {
  const h = useHierarchy();
  const n = lireNiveau(reunion.niveau);
  const equipe = n?.kind === 'equipeagile' ? org.equipe.get(n.id) : undefined;
  const jour = jourReunion(reunion);
  const it = iterationOf(jour);
  const seuleEquipe = org.equipes.filter((e) => (e.espace || 'moi') === (reunion.espace || 'moi')).length === 1;
  const dansEquipe = (t: Item) => {
    const e = porteurs(t, h, org).equipe;
    return e ? e === equipe?.id : seuleEquipe && (t.espace || 'moi') === (reunion.espace || 'moi');
  };
  const bloquees = useMemo(() => storiesBloquees(points, h.items), [points, h.items]);
  const situation = useMemo(
    () => situationIteration(h.items, dansEquipe, jour, bloquees, aujourdhui),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [h.items, jour, bloquees, aujourdhui, equipe?.id, org],
  );
  const personnes = participantsReunion(reunion, org)
    .map((id) => org.personne.get(id))
    .filter((x): x is NonNullable<typeof x> => !!x && !!x.email);
  const role = (id: string) => (id === equipe?.sm ? 'Scrum Master' : id === equipe?.po ? 'Product Owner' : 'Membre');
  const nomDe = (email: string) => personneParEmail(email, org)?.nom ?? email.split('@')[0];
  const train = equipe?.train ? org.train.get(equipe.train) : undefined;
  const rte = train?.rte ? org.personne.get(train.rte) : undefined;
  const parId = new Map(h.items.map((t) => [t.id, t]));
  return { h, equipe, jour, it, situation, bloquees, personnes, role, nomDe, train, rte, parId };
}

// ---------------------------------------------------------------------------
// Organisateur
// ---------------------------------------------------------------------------
function DailyOrganisateur({ visible, reunion, org, moi, aujourdhui, fil, actions, onFermer, onInfo }: Props & { reunion: Reunion }) {
  const safe = useSafe();
  const [serveur, setServeur] = useState<PointReunion[]>([]);
  const [charge, setCharge] = useState(false);
  const [locaux, setLocaux] = useState<Local[]>([]);
  const [choix, setChoix] = useState<Record<string, { c?: Concretisation; resp?: string }>>({});
  const [membre, setMembre] = useState(0);
  const [etape, setEtape] = useState(0);
  const relus = useRef(new Set<string>());
  const espace = reunion.espace || 'moi';
  const prefixe = prefixeReunion(reunion);

  const tous = useMemo(() => [...serveur, ...locaux] as PointReunion[], [serveur, locaux]);
  const e = useEquipeDaily(reunion, org, aujourdhui, tous);
  const { equipe, jour, it, situation, personnes, nomDe, rte, parId } = e;
  const dela = (pt: PointReunion) => pt.reunion === reunion.id;

  // Ouverture : une lecture (points de ce daily et des dailies précédents de l'équipe, pour le suivi)
  useEffect(() => {
    if (!visible) return;
    setServeur([]);
    setLocaux([]);
    setChoix({});
    setMembre(0);
    setCharge(false);
    relus.current = new Set();
    let actif = true;
    actions
      .lirePoints(espace, prefixe)
      .then((l) => actif && (setServeur(l), setCharge(true)))
      .catch((err) => actif && (setCharge(true), onInfo?.(`Points du daily non lus : ${(err as Error).message}`)));
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reunion.id]);

  // Tour de table : en arrivant sur un membre, on relit ses points (préparés depuis l'ouverture) — une fois par membre
  const courant = personnes[Math.min(membre, Math.max(0, personnes.length - 1))];
  useEffect(() => {
    if (!visible || etape !== 1 || !courant || relus.current.has(courant.email)) return;
    relus.current.add(courant.email);
    const mail = courant.email.toLowerCase();
    actions
      .lirePoints(espace, reunion.id)
      .then((l) => setServeur((avant) => [...avant.filter((x) => !(dela(x) && x.personne === mail)), ...l.filter((x) => x.personne === mail)]))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, etape, courant?.email]);

  // Suivi : points concrétisés (dailies précédents, ou celui-ci déjà envoyé) dont la tâche n'est pas finie
  const suivisEquipe = useMemo(() => calculerSuivis(serveur, e.h.items), [serveur, e.h.items]);
  // À concrétiser : ce qui ne l'a pas encore été (un compte rendu déjà envoyé ne recrée rien)
  const aDecider = tous.filter((x) => dela(x) && aConcretiser(x) && !x.concretisation);
  const choixDe = (pt: PointReunion) => {
    const c = choix[pt.id]?.c ?? concretisationParDefaut(pt);
    // Sous-tâche impossible sans story ; escalade impossible sans RTE
    const cc: Concretisation = (c === 'sous_tache' && !pt.element) || (c === 'escalade' && !rte?.email) ? 'tache' : c;
    return { c: cc, resp: choix[pt.id]?.resp ?? (pt.responsable || pt.personne) };
  };

  const ajouter = (x: { personne: string; type: TypePoint; texte: string; element: string }) =>
    setLocaux((l) => [
      ...l,
      { ...x, id: idLocal(), reunion: reunion.id, auteur: moi.toLowerCase(), personne: x.personne.toLowerCase(), concretisation: '', tache: '', responsable: '', cree_le: new Date().toISOString() },
    ]);

  // ---- Envoi du compte rendu : tâches (un lot), échanges (un lot), points (un lot) ----
  const terminer = async () => {
    const decides = aDecider.map((pt) => ({ pt, ...choixDe(pt) }));
    const aCreer = decides.filter((d) => d.c === 'sous_tache' || d.c === 'tache');
    const idDe = (email: string) => personneParEmail(email, org)?.id ?? '';
    const inputs: ItemInput[] = aCreer.map(({ pt, c, resp }) => ({
      ...RECURRENCE_DEFAUTS,
      espace,
      titre: pt.texte,
      type: 'tache',
      date: '',
      heure: '',
      heure_fin: '',
      date_fin: '',
      lieu: '',
      description: `${LIBELLE_TYPE_POINT[pt.type]} noté au daily ${equipe?.nom ?? ''} du ${dateCourte(jour)} (${prenom(nomDe(pt.personne))}).`,
      priorite: pt.type === 'blocage' ? 'haute' : 'normale',
      statut: 'a_faire',
      parent: c === 'sous_tache' ? pt.element : '',
      feature: '',
      epic: '',
      objectif: '',
      domaine: '',
      points: '',
      iteration: it.key,
      telephone: '',
      equipe: equipe?.id ?? '',
      responsable: idDe(resp),
    }));
    const creees = await actions.creerTaches(espace, inputs);
    const tacheDe = new Map(aCreer.map((d, i) => [d.pt.id, creees[i]?.id ?? '']));

    const escalades = decides.filter((d) => d.c === 'escalade');
    const decisions = decides.filter((d) => d.pt.type === 'decision');
    const story = (id: string) => (id ? parId.get(id)?.titre : undefined);
    if (rte?.email && e.train) {
      const base = { de: moi.toLowerCase(), a: rte.email.toLowerCase(), type: 'message' as const, choix: '', reponse: '', note: '', statut: 'envoye' as const, niveau: `train:${e.train.id}`, transmis_par: '', prive: '1', pieces_jointes: '', espace };
      const texte = texteCompteRendu({
        equipe: equipe?.nom ?? '',
        jour,
        decisions: decisions.map((d) => d.pt.texte),
        creees: aCreer.map((d) => ({ titre: d.pt.texte, sous: `${d.c === 'sous_tache' ? `sous-tâche de « ${story(d.pt.element) ?? 'la story'} »` : `tâche à part, ${it.code}`} · ${prenom(nomDe(d.resp))}` })),
        escalades: escalades.map((d) => `${d.pt.texte} (${prenom(nomDe(d.pt.personne))}${story(d.pt.element) ? `, « ${story(d.pt.element)} »` : ''})`),
        notes: decides.filter((d) => d.c === 'rien' && d.pt.type !== 'decision').length,
      });
      await actions.envoyerEchanges(espace, [
        ...escalades.map((d) => ({
          ...base,
          titre: `Blocage · ${d.pt.texte}`.slice(0, 200),
          texte: `Blocage noté au daily ${equipe?.nom ?? ''} du ${dateCourte(jour)} pour ${nomDe(d.pt.personne)}${story(d.pt.element) ? ` (story « ${story(d.pt.element)} »)` : ''} : l'équipe ne peut pas le lever seule.`,
          element: d.pt.element,
        })),
        { ...base, titre: `Compte rendu · Daily ${equipe?.nom ?? ''} du ${dateCourte(jour)}`, texte, element: '' },
      ]);
    }

    const patch = (d: (typeof decides)[number]) => ({ concretisation: d.c, tache: tacheDe.get(d.pt.id) ?? '', responsable: d.c === 'escalade' ? '' : d.resp });
    const parPoint = new Map(decides.map((d) => [d.pt.id, d]));
    const creer = locaux.map(({ id: _i, cree_le: _c, ...x }) => {
      const d = parPoint.get(_i);
      return d ? { ...x, ...patch(d) } : x;
    });
    const modifier = decides.filter((d) => !d.pt.id.startsWith('local-')).map((d) => ({ id: d.pt.id, ...patch(d) }));
    await actions.ecrirePoints(espace, creer, modifier, []);
    onInfo?.(
      `Compte rendu du daily : ${creees.length} tâche${creees.length > 1 ? 's' : ''} créée${creees.length > 1 ? 's' : ''}` +
        (escalades.length ? `, ${escalades.length} blocage${escalades.length > 1 ? 's' : ''} escaladé${escalades.length > 1 ? 's' : ''}` : '') +
        (rte?.email ? `, envoyé à ${nomDe(rte.email)} (RTE).` : ' ; pas de RTE : compte rendu non envoyé.'),
    );
  };

  const fmt = (n: number) => fmtPoints(n, safe.pointsJours);
  const rendu = (k: number) => {
    if (k === 0) {
      const s = situation;
      return (
        <>
          <TitreFiche icone="☀️" titre="Situation" vide="" sous={`${it.code} · du ${dateCourte(it.start)} au ${dateCourte(it.end)} · ${equipe?.nom ?? ''}`} />
          <View style={st.compteurs}>
            <Compteur valeur={`${arrondi(s.faits)} / ${arrondi(s.prevus)}`} libelle={`${safe.pointsJours ? 'jours' : 'pts'} faits / prévus`} />
            <Compteur valeur={String(s.bloquees)} libelle={s.bloquees > 1 ? 'stories bloquées' : 'story bloquée'} ton={s.bloquees ? 'rouge' : undefined} />
            <Compteur valeur={String(s.retard)} libelle="en retard" ton={s.retard ? 'orange' : undefined} />
          </View>
          <SectionFiche titre={`Suivi · concrétisé, pas encore fini · ${suivisEquipe.length}`}>
            {!charge ? (
              <Vide texte="Lecture des points…" />
            ) : suivisEquipe.length ? (
              suivisEquipe.map(({ point, tache }, i) => (
                <Ligne
                  key={point.id}
                  premiere={i === 0}
                  texte={tache.titre}
                  sous={`${LIBELLE_TYPE_POINT[point.type]} · ${LIBELLE_CONCRETISATION[point.concretisation]} · 👤 ${prenom(nomDe(point.responsable || point.personne))} · depuis le ${dateCourte(point.reunion.slice(-10))}`}
                  pastille={{ texte: tache.statut === 'en_cours' ? 'en cours' : 'à faire', ton: tache.statut === 'en_cours' ? 'bleu' : 'gris' }}
                />
              ))
            ) : (
              <Vide texte="✓ Rien en attente des dailies précédents." />
            )}
          </SectionFiche>
          <SectionFiche titre="Objectifs de la réunion">
            <Ligne premiere texte="🎯 Se synchroniser sur l’objectif d’itération" sous="Chacun dit ce qu’il a fait hier et ce qu’il fera aujourd’hui (15 min)" />
            <Ligne texte="🧱 Lever les blocages" sous="Les noter pendant le tour de table, les concrétiser ensuite" />
          </SectionFiche>
        </>
      );
    }
    if (k === 1) {
      if (!courant) return <Vide texte="Aucun participant dans l’équipe." />;
      const mail = courant.email.toLowerCase();
      const stories = situation.cartes.filter((t) => t.responsable === courant.id);
      const notes = tous.filter((x) => dela(x) && x.personne === mail).sort((a, b) => a.cree_le.localeCompare(b.cree_le));
      return (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.membres}>
            {personnes.map((x, i) => (
              <Pressable key={x.id} onPress={() => setMembre(i)} style={[st.membre, i === membre && st.membreOn]} accessibilityRole="button" accessibilityState={{ selected: i === membre }}>
                <Text style={[st.membreTexte, i === membre && st.membreTexteOn]}>{prenom(x.nom)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TitreFiche icone="👤" titre={courant.nom} vide="" sous={`${membre + 1} sur ${personnes.length} · ${e.role(courant.id)}`} />
          <SectionFiche titre={`Ses stories · ${stories.length}`}>
            {stories.length ? (
              stories.map((t, i) => <LigneStory key={t.id} t={t} premiere={i === 0} bloquee={e.bloquees.has(t.id)} retard={enRetard(t, aujourdhui)} fmt={fmt} />)
            ) : (
              <Vide texte="Aucune story de l’itération à son nom." />
            )}
          </SectionFiche>
          <SectionFiche titre={`Points notés · ${notes.length}`}>
            {notes.map((x, i) => (
              <Ligne
                key={x.id}
                premiere={i === 0}
                texte={x.texte}
                sous={`${x.auteur === x.personne ? `par ${prenom(courant.nom)}` : x.auteur === moi.toLowerCase() ? 'par le SM' : `par ${prenom(nomDe(x.auteur))}`}${x.element && parId.get(x.element)?.titre !== x.texte ? ` · sur 📖 ${parId.get(x.element)?.titre ?? 'story'}` : ''}`}
                pastille={{ texte: pastillePoint(x.type, jour), ton: x.type === 'blocage' ? 'rouge' : aConcretiser(x) ? 'orange' : 'bleu' }}
                onRetirer={x.id.startsWith('local-') ? () => setLocaux((l) => l.filter((y) => y.id !== x.id)) : undefined}
              />
            ))}
            <SaisiePoint
              premiere={!notes.length}
              types={['hier', 'aujourdhui', 'blocage', 'decision', 'action']}
              jour={jour}
              placeholder={`＋ Ajouter pour ${prenom(courant.nom)}…`}
              stories={stories}
              onAjouter={(type, texte, element) => ajouter({ personne: mail, type, texte, element })}
            />
          </SectionFiche>
        </>
      );
    }
    if (k === 2) {
      return (
        <>
          <TitreFiche icone="🧩" titre="Concrétisation" vide="" sous={`${aDecider.length} point${aDecider.length > 1 ? 's' : ''} : blocages, décisions, actions`} />
          {!aDecider.length && <Vide texte="Aucun blocage, décision ou action noté." />}
          {aDecider.map((pt) => {
            const { c, resp } = choixDe(pt);
            const poser = (x: { c?: Concretisation; resp?: string }) => setChoix((m) => ({ ...m, [pt.id]: { ...m[pt.id], ...x } }));
            const story = pt.element ? parId.get(pt.element) : undefined;
            const options: { v: Concretisation; l: string; off?: boolean }[] = [
              { v: 'sous_tache', l: 'Sous-tâche de la story', off: !pt.element },
              { v: 'tache', l: `Tâche à part (${it.code})` },
              { v: 'rien', l: 'Rien' },
              ...(pt.type === 'blocage' ? [{ v: 'escalade' as const, l: '⤴ Escalader au RTE', off: !rte?.email }] : []),
            ];
            return (
              <View key={pt.id} style={st.carteConcret}>
                <View style={st.ligneHaut}>
                  <View style={st.corps}>
                    <Text style={st.texte}>{pt.texte}</Text>
                    <Text style={st.sous}>
                      {prenom(nomDe(pt.personne))}
                      {story ? ` · sur 📖 ${story.titre}` : ''}
                    </Text>
                  </View>
                  <Pastille texte={LIBELLE_TYPE_POINT[pt.type]} ton={pt.type === 'blocage' ? 'rouge' : 'orange'} />
                </View>
                <Pastilles options={options.map((o) => ({ value: o.v, label: o.l, off: o.off }))} value={c} onChange={(v) => poser({ c: v as Concretisation })} />
                {(c === 'sous_tache' || c === 'tache') && (
                  <>
                    <Text style={st.petitTitre}>Responsable</Text>
                    <Pastilles options={personnes.map((x) => ({ value: x.email.toLowerCase(), label: prenom(x.nom) }))} value={resp} onChange={(v) => poser({ resp: v })} petit />
                  </>
                )}
              </View>
            );
          })}
          <SectionFiche titre="Point oublié">
            <SaisiePoint premiere types={['blocage', 'decision', 'action']} jour={jour} placeholder="＋ Blocage, décision ou action oublié" stories={situation.cartes} onAjouter={(type, texte, element) => ajouter({ personne: moi, type, texte, element })} />
          </SectionFiche>
        </>
      );
    }
    // Compte rendu
    const decides = aDecider.map((pt) => ({ pt, ...choixDe(pt) }));
    const crees = decides.filter((d) => d.c === 'sous_tache' || d.c === 'tache');
    const escalades = decides.filter((d) => d.c === 'escalade');
    const notes = decides.filter((d) => d.c === 'rien');
    return (
      <>
        <TitreFiche
          icone="📨"
          titre="Compte rendu"
          vide=""
          sous={rte?.email ? `Envoyé à ${rte.nom} (RTE du train ${e.train?.nom ?? ''})` : 'Pas de train ni de RTE : les tâches sont créées, le compte rendu n’est envoyé à personne.'}
        />
        <SectionFiche titre={`Créé · ${crees.length}`}>
          {crees.length ? (
            crees.map((d, i) => (
              <Ligne
                key={d.pt.id}
                premiere={i === 0}
                texte={d.pt.texte}
                sous={`${d.c === 'sous_tache' ? `Sous-tâche de 📖 ${parId.get(d.pt.element)?.titre ?? 'la story'}` : `Tâche à part · ${it.code}`} · 👤 ${prenom(nomDe(d.resp))}`}
                pastille={{ texte: LIBELLE_TYPE_POINT[d.pt.type], ton: d.pt.type === 'blocage' ? 'rouge' : 'orange' }}
              />
            ))
          ) : (
            <Vide texte="Aucune tâche à créer." />
          )}
        </SectionFiche>
        {escalades.length > 0 && (
          <SectionFiche titre={`Escaladé au RTE · ${escalades.length}`}>
            {escalades.map((d, i) => (
              <Ligne key={d.pt.id} premiere={i === 0} texte={d.pt.texte} sous={`👤 ${prenom(nomDe(d.pt.personne))} · ⤴ ${rte?.nom ?? 'RTE'}`} pastille={{ texte: 'Blocage', ton: 'rouge' }} />
            ))}
          </SectionFiche>
        )}
        <SectionFiche titre={`Noté seulement · ${notes.length}`}>
          {notes.length ? (
            notes.map((d, i) => <Ligne key={d.pt.id} premiere={i === 0} texte={d.pt.texte} sous={`par ${prenom(nomDe(d.pt.personne))}`} pastille={{ texte: LIBELLE_TYPE_POINT[d.pt.type], ton: 'gris' }} />)
          ) : (
            <Vide texte="Rien." />
          )}
        </SectionFiche>
      </>
    );
  };

  const dernier = personnes.length - 1;
  return (
    <FenetreReunion
      visible={visible}
      reunion={reunion}
      mode="organisateur"
      fil={fil}
      etapes={TYPES_REUNION.daily.etapes}
      renduEtape={rendu}
      onEtape={(k) => {
        setEtape(k);
        if (k === 1) setMembre((m) => Math.min(m, Math.max(0, dernier)));
      }}
      onSuivant={(k) => {
        if (k === 1 && membre < dernier) {
          setMembre(membre + 1);
          return true;
        }
        return false;
      }}
      libelleSuivant={(k) => (k === 1 && membre < dernier ? `Suivant · ${prenom(personnes[membre + 1]?.nom ?? '')}` : undefined)}
      onFermer={onFermer}
      onTerminer={terminer}
    />
  );
}

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------
function DailyParticipant({ visible, reunion, org, moi, aujourdhui, fil, actions, onFermer, onInfo }: Props & { reunion: Reunion }) {
  const mail = moi.toLowerCase();
  const espace = reunion.espace || 'moi';
  const [serveur, setServeur] = useState<PointReunion[]>([]);
  const [charge, setCharge] = useState(false);
  /** Préparation : points du participant pour ce daily */
  const [prep, setPrep] = useState<{ type: TypePoint; texte: string; element: string }[]>([]);
  /** Statuts changés pendant la préparation (affichage immédiat) */
  const [statuts, setStatuts] = useState<Record<string, Statut>>({});
  const e = useEquipeDaily(reunion, org, aujourdhui, serveur);
  const { jour, situation, parId, nomDe, equipe } = e;
  const veille = veilleOuvree(jour);
  const moiP = personneParEmail(mail, org);

  useEffect(() => {
    if (!visible) return;
    setServeur([]);
    setPrep([]);
    setStatuts({});
    setCharge(false);
    let actif = true;
    actions
      .lirePoints(espace, prefixeReunion(reunion))
      .then((l) => {
        if (!actif) return;
        setServeur(l);
        // Déjà envoyé : la préparation reprend ce qui a été envoyé
        setPrep(l.filter((x) => x.reunion === reunion.id && x.personne === mail && x.auteur === mail && !x.concretisation).map((x) => ({ type: x.type, texte: x.texte, element: x.element })));
        setCharge(true);
      })
      .catch((err) => actif && (setCharge(true), onInfo?.(`Points du daily non lus : ${(err as Error).message}`)));
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reunion.id]);

  const mesSuivis = useMemo(() => calculerSuivis(serveur.filter((x) => x.responsable === mail), e.h.items), [serveur, e.h.items, mail]);
  // Ses éléments de l'itération (stories, tâches, sous-tâches à son nom)
  const miens = situation.elements.filter((t) => !!moiP && t.responsable === moiP.id && !mesSuivis.some((x) => x.tache.id === t.id));
  const statutDe = (t: Item) => statuts[t.id] ?? t.statut;
  const hierListe = miens.filter((t) => statutDe(t) === 'en_cours' || (statutDe(t) === 'termine' && (!t.termine_le || t.termine_le >= veille)));
  const aujListe = miens.filter((t) => statutDe(t) !== 'termine');
  const coche = (type: TypePoint, t: Item) => prep.some((x) => x.type === type && x.element === t.id && x.texte === t.titre);
  const basculer = (type: TypePoint, t: Item) =>
    setPrep((l) => (coche(type, t) ? l.filter((x) => !(x.type === type && x.element === t.id && x.texte === t.titre)) : [...l, { type, texte: t.titre, element: t.id }]));
  const libres = (type: TypePoint, liste: Item[]) => prep.filter((x) => x.type === type && !liste.some((t) => x.element === t.id && x.texte === t.titre));
  const retirer = (x: (typeof prep)[number]) => setPrep((l) => l.filter((y) => y !== x));
  /** « sur 📖 story » (sauf pour la story elle-même, cochée) */
  const surStory = (x: { texte: string; element: string }) => {
    const titre = x.element ? (parId.get(x.element)?.titre ?? 'story') : '';
    return titre && titre !== x.texte ? `sur 📖 ${titre}` : undefined;
  };
  const sm = equipe?.sm ? org.personne.get(equipe.sm) : undefined;

  const envoyer = async () => {
    const anciens = serveur.filter((x) => x.reunion === reunion.id && x.personne === mail && x.auteur === mail && !x.concretisation).map((x) => x.id);
    await actions.ecrirePoints(
      espace,
      prep.map((x) => ({ ...x, reunion: reunion.id, personne: mail, auteur: mail, concretisation: '' as const, tache: '', responsable: '' })),
      [],
      anciens,
    );
    onInfo?.(prep.length ? `Point envoyé${sm ? ` à ${prenom(sm.nom)} (SM)` : ''} : ${prep.length} élément${prep.length > 1 ? 's' : ''}.` : 'Préparation vide envoyée : rien de noté.');
  };

  const listeCases = (type: TypePoint, liste: Item[], vide: string) =>
    liste.length ? (
      liste.map((t, i) => (
        <Pressable key={t.id} onPress={() => basculer(type, t)} style={[st.ligne, i > 0 && st.bord]} accessibilityRole="checkbox" accessibilityState={{ checked: coche(type, t) }}>
          <Text style={[st.caseACocher, coche(type, t) && st.caseCochee]}>{coche(type, t) ? '✓' : ''}</Text>
          <View style={st.corps}>
            <Text style={st.texte}>
              {t.type === 'story' ? '📖 ' : ''}
              {t.titre}
            </Text>
            {!!t.parent && <Text style={st.sous}>Sous-tâche de {parId.get(t.parent)?.titre ?? 'la story'}</Text>}
          </View>
          <Pastille {...pastilleStatut(statutDe(t))} />
        </Pressable>
      ))
    ) : (
      <Vide texte={vide} />
    );
  const listeLibres = (type: TypePoint, liste: Item[], decale: boolean) =>
    libres(type, liste).map((x, i) => (
      <Ligne key={`${x.texte}-${i}`} premiere={!decale && i === 0} texte={x.texte} sous={surStory(x) ?? 'ajouté par vous'} onRetirer={() => retirer(x)} />
    ));

  const rendu = (k: number) => {
    if (!charge) return <Vide texte="Lecture de votre préparation…" />;
    if (k === 0)
      return (
        <>
          <TitreFiche icone="📌" titre="Mes suivis" vide="" sous="Points concrétisés aux dailies précédents, à votre nom" />
          {mesSuivis.length ? (
            mesSuivis.map(({ point, tache }) => (
              <View key={point.id} style={st.carteConcret}>
                <Text style={st.texte}>{tache.titre}</Text>
                <Text style={st.sous}>
                  {LIBELLE_TYPE_POINT[point.type]} · {LIBELLE_CONCRETISATION[point.concretisation]}
                  {tache.parent ? ` de 📖 ${parId.get(tache.parent)?.titre ?? 'la story'}` : ''} · depuis le {dateCourte(point.reunion.slice(-10))}
                </Text>
                <Pastilles
                  options={STATUTS.map((x) => ({ value: x.v, label: x.l }))}
                  value={statutDe(tache)}
                  onChange={(v) => {
                    setStatuts((m) => ({ ...m, [tache.id]: v as Statut }));
                    void actions.onSetStatut(tache, v as Statut);
                  }}
                />
              </View>
            ))
          ) : (
            <SectionFiche titre="Suivis · 0">
              <Vide texte="✓ Rien à suivre." />
            </SectionFiche>
          )}
        </>
      );
    if (k === 1)
      return (
        <>
          <TitreFiche icone="⏪" titre={`Hier · ${dateCourte(veille)}`} vide="" sous="Cochez ce dont vous parlerez" />
          <SectionFiche titre={`Mes stories et tâches · ${hierListe.length}`}>
            {listeCases('hier', hierListe, 'Rien en cours ni terminé hier.')}
            {listeLibres('hier', hierListe, true)}
            <SaisiePoint types={[]} jour={jour} placeholder="＋ Autre chose fait hier" onAjouter={(_, texte) => setPrep((l) => [...l, { type: 'hier', texte, element: '' }])} />
          </SectionFiche>
        </>
      );
    if (k === 2)
      return (
        <>
          <TitreFiche icone="▶️" titre={`Aujourd’hui · ${dateCourte(jour)}`} vide="" sous="Ce que vous allez faire" />
          <SectionFiche titre={`Mes stories et tâches · ${aujListe.length}`}>
            {listeCases('aujourdhui', aujListe, 'Rien à votre nom dans l’itération.')}
            {listeLibres('aujourdhui', aujListe, true)}
            <SaisiePoint types={[]} jour={jour} placeholder="＋ Autre chose aujourd’hui" onAjouter={(_, texte) => setPrep((l) => [...l, { type: 'aujourdhui', texte, element: '' }])} />
          </SectionFiche>
        </>
      );
    if (k === 3) {
      const blocages = prep.filter((x) => x.type === 'blocage');
      return (
        <>
          <TitreFiche icone="🧱" titre="Blocages" vide="" sous="Ce qui vous empêche d’avancer" />
          <SectionFiche titre={`Blocages · ${blocages.length}`}>
            {blocages.map((x, i) => (
              <Ligne key={`${x.texte}-${i}`} premiere={i === 0} texte={x.texte} sous={x.element ? `sur 📖 ${parId.get(x.element)?.titre ?? 'story'}` : 'sans story'} onRetirer={() => retirer(x)} />
            ))}
            <SaisiePoint premiere={!blocages.length} types={[]} jour={jour} placeholder="＋ Blocage" stories={situation.cartes.filter((t) => !!moiP && t.responsable === moiP.id)} onAjouter={(_, texte, element) => setPrep((l) => [...l, { type: 'blocage', texte, element }])} />
          </SectionFiche>
        </>
      );
    }
    // Prêt : récapitulatif
    const ordre: TypePoint[] = ['hier', 'aujourdhui', 'blocage'];
    const recap = [...prep].sort((a, b) => ordre.indexOf(a.type) - ordre.indexOf(b.type));
    return (
      <>
        <TitreFiche icone="✅" titre="Prêt" vide="" sous={`Envoyé à ${sm ? `${sm.nom} (SM)` : 'l’organisateur'} · préparation facultative`} />
        <SectionFiche titre={`Mon point · ${recap.length + mesSuivis.length}`}>
          {mesSuivis.map(({ point, tache }, i) => {
            const s = statutDe(tache);
            return <Ligne key={point.id} premiere={i === 0} texte={tache.titre} sous={`${LIBELLE_TYPE_POINT[point.type]} · ${LIBELLE_CONCRETISATION[point.concretisation]}`} pastille={{ texte: `Suivi · ${s === 'termine' ? 'fait' : s === 'en_cours' ? 'en cours' : 'à faire'}`, ton: s === 'termine' ? 'vert' : s === 'en_cours' ? 'bleu' : 'gris' }} />;
          })}
          {recap.map((x, i) => (
            <Ligne
              key={`${x.type}-${x.texte}-${i}`}
              premiere={!mesSuivis.length && i === 0}
              texte={x.texte}
              sous={surStory(x)}
              pastille={{ texte: pastillePoint(x.type, jour), ton: x.type === 'blocage' ? 'rouge' : 'bleu' }}
            />
          ))}
          {!recap.length && !mesSuivis.length && <Vide texte="Rien de préparé : vous ferez votre point de vive voix." />}
        </SectionFiche>
      </>
    );
  };

  return (
    <FenetreReunion
      visible={visible}
      reunion={reunion}
      mode="participant"
      fil={fil}
      etapes={['Mes suivis', `Hier · ${dateCourte(veille)}`, `Aujourd’hui · ${dateCourte(jour)}`, 'Blocages', 'Prêt']}
      libelleFin={`Envoyer au SM${sm ? ` · ${prenom(sm.nom)}` : ''}`}
      renduEtape={rendu}
      onFermer={onFermer}
      onTerminer={envoyer}
    />
  );
}

// ---------------------------------------------------------------------------
// Éléments d'affichage
// ---------------------------------------------------------------------------
type Ton = 'bleu' | 'vert' | 'rouge' | 'orange' | 'gris';
const TONS: Record<Ton, { fond: string; texte: string }> = {
  bleu: { fond: '#E8F0FE', texte: '#1557B0' },
  vert: { fond: '#E6F4EA', texte: '#137333' },
  rouge: { fond: '#FCE8E6', texte: '#B3261E' },
  orange: { fond: '#FEF3E2', texte: '#B45309' },
  gris: { fond: '#EEF1F6', texte: colors.muted },
};
const pastilleStatut = (s: Statut): { texte: string; ton: Ton } =>
  s === 'termine' ? { texte: 'terminée', ton: 'vert' } : s === 'en_cours' ? { texte: 'en cours', ton: 'bleu' } : { texte: 'à faire', ton: 'gris' };

function Pastille({ texte, ton }: { texte: string; ton: Ton }) {
  return (
    <View style={[st.pastille, { backgroundColor: TONS[ton].fond }]}>
      <Text style={[st.pastilleTexte, { color: TONS[ton].texte }]} numberOfLines={1}>
        {texte}
      </Text>
    </View>
  );
}

function Compteur({ valeur, libelle, ton }: { valeur: string; libelle: string; ton?: Ton }) {
  return (
    <View style={st.compteur}>
      <Text style={[st.compteurValeur, ton && { color: TONS[ton].texte }]} numberOfLines={1} adjustsFontSizeToFit>
        {valeur}
      </Text>
      <Text style={st.compteurLibelle}>{libelle}</Text>
    </View>
  );
}

/** Ligne : texte seul, sous-ligne grise, pastille à droite au même niveau */
function Ligne({ texte, sous, pastille, premiere, onRetirer }: { texte: string; sous?: string; pastille?: { texte: string; ton: Ton }; premiere?: boolean; onRetirer?: () => void }) {
  return (
    <View style={[st.ligne, !premiere && st.bord]}>
      <View style={st.corps}>
        <Text style={st.texte}>{texte}</Text>
        {!!sous && <Text style={st.sous}>{sous}</Text>}
      </View>
      {pastille && <Pastille {...pastille} />}
      {onRetirer && (
        <Pressable onPress={onRetirer} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Retirer « ${texte} »`}>
          <Text style={st.retirer}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

function LigneStory({ t, premiere, bloquee, retard, fmt }: { t: Item; premiere: boolean; bloquee: boolean; retard: boolean; fmt: (n: number) => string }) {
  const p = parseFloat(t.points);
  return (
    <Ligne
      premiere={premiere}
      texte={`${t.type === 'story' ? '📖 ' : ''}${t.titre}`}
      sous={[pastilleStatut(t.statut).texte, p > 0 ? fmt(p) : '', t.date ? `prévu le ${dateCourte(t.date)}` : ''].filter(Boolean).join(' · ')}
      pastille={bloquee ? { texte: 'bloquée', ton: 'rouge' } : retard ? { texte: 'en retard', ton: 'orange' } : pastilleStatut(t.statut)}
    />
  );
}

function Vide({ texte }: { texte: string }) {
  return <Text style={st.vide}>{texte}</Text>;
}

/** Choix en pastilles (un seul) ; une option `off` est grisée */
function Pastilles({ options, value, onChange, petit }: { options: { value: string; label: string; off?: boolean }[]; value: string; onChange: (v: string) => void; petit?: boolean }) {
  return (
    <View style={st.choix}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            disabled={o.off}
            onPress={() => onChange(o.value)}
            style={[st.choixPastille, petit && st.choixPetit, on && st.choixOn, o.off && st.choixOff]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: !!o.off }}
          >
            <Text style={[st.choixTexte, petit && st.choixTextePetit, on && st.choixTexteOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Saisie rapide d'un point : type en pastilles (si plusieurs), story facultative, Entrée pour ajouter */
function SaisiePoint({
  types,
  jour,
  placeholder,
  stories = [],
  premiere,
  onAjouter,
}: {
  types: TypePoint[];
  jour: string;
  placeholder: string;
  stories?: Item[];
  premiere?: boolean;
  onAjouter: (type: TypePoint, texte: string, element: string) => void;
}) {
  const [type, setType] = useState<TypePoint>(types[types.length > 2 ? 2 : 0] ?? 'hier');
  const [texte, setTexte] = useState('');
  const [element, setElement] = useState('');
  const valider = () => {
    const t = texte.trim();
    if (!t) return;
    onAjouter(type, t, element);
    setTexte('');
  };
  const typeLibelle = (x: TypePoint) => (x === 'hier' || x === 'aujourdhui' ? pastillePoint(x, jour) : LIBELLE_TYPE_POINT[x]);
  return (
    <View style={[st.saisieBloc, !premiere && st.bord]}>
      {types.length > 1 && <Pastilles petit options={types.map((x) => ({ value: x, label: typeLibelle(x) }))} value={type} onChange={(v) => setType(v as TypePoint)} />}
      {stories.length > 0 && (
        <Pastilles
          petit
          options={[{ value: '', label: 'Sans story' }, ...stories.map((t) => ({ value: t.id, label: `📖 ${t.titre.length > 28 ? `${t.titre.slice(0, 27)}…` : t.titre}` }))]}
          value={element}
          onChange={setElement}
        />
      )}
      <View style={st.saisieLigne}>
        <TextInput
          value={texte}
          onChangeText={setTexte}
          placeholder={placeholder}
          placeholderTextColor={colors.primary}
          onSubmitEditing={valider}
          submitBehavior="submit"
          returnKeyType="done"
          style={st.saisie}
          accessibilityLabel={placeholder.replace('＋ ', '')}
        />
        {!!texte.trim() && (
          <Pressable onPress={valider} hitSlop={8} style={st.ajouter} accessibilityRole="button" accessibilityLabel="Ajouter">
            <Text style={st.ajouterTexte}>Ajouter</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  compteurs: { flexDirection: 'row', gap: 8 },
  compteur: { flex: 1, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  compteurValeur: { fontSize: 18, fontWeight: '800', color: colors.text },
  compteurLibelle: { fontSize: 11.5, color: colors.muted, textAlign: 'center' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  bord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  corps: { flex: 1, minWidth: 0, gap: 2 },
  texte: { fontSize: 15, color: colors.text },
  sous: { fontSize: 12.5, color: colors.muted },
  pastille: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, maxWidth: 150 },
  pastilleTexte: { fontSize: 12, fontWeight: '700' },
  retirer: { fontSize: 14, color: colors.muted, paddingHorizontal: 2 },
  vide: { fontSize: 14, color: colors.muted, paddingHorizontal: 14, paddingVertical: 12 },
  membres: { gap: 6, paddingBottom: 10, paddingHorizontal: 2 },
  membre: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  membreOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  membreTexte: { fontSize: 13, color: colors.text },
  membreTexteOn: { color: '#fff', fontWeight: '700' },
  carteConcret: { backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 8, marginTop: 10 },
  ligneHaut: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  petitTitre: { fontSize: 11.5, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choixPastille: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  choixPetit: { paddingHorizontal: 9, paddingVertical: 4 },
  choixOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choixOff: { opacity: 0.35 },
  choixTexte: { fontSize: 13, color: colors.text },
  choixTextePetit: { fontSize: 12.5 },
  choixTexteOn: { color: '#fff', fontWeight: '600' },
  saisieBloc: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  saisieLigne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saisie: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 6 },
  ajouter: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.primary },
  ajouterTexte: { color: '#fff', fontWeight: '700', fontSize: 13 },
  caseACocher: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#A0A6B1', textAlign: 'center', lineHeight: 19, fontSize: 14, color: '#fff', overflow: 'hidden' },
  caseCochee: { backgroundColor: colors.primary, borderColor: colors.primary },
});
