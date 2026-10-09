import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { addDays, toDateString } from '../../dates';
import { dateCourte } from '../../daily';
import { useHierarchy } from '../../hierarchyContext';
import { useOrg } from '../../organisation';
import { BlocBudgetSimple } from '../Budget';
import { colors } from '../../theme';
import { type Echange, type Item, RECURRENCE_DEFAUTS, type Reunion } from '../../types';
import { SaisieFiche, SectionFiche } from '../Choix';
import type { ActionsDaily } from '../Daily';
import { FenetreReunion } from '../FenetreReunion';
import { TitreFiche } from '../FormSheet';
import { Navigation } from './Affinage';
import { AjoutElement, ChoixJour } from './Ajout';
import { Compteurs } from './base';
import { SuivisPerso } from './SuivisPerso';
import { Ligne, Pastilles, pastilleStatut, st, Vide } from './ui';

/**
 * Rituels personnels du mode Simple (lot 6, maquettes r12 à r15), seul : ni live, ni « ↻ Actualiser », ni compte
 * rendu. Ils agissent sur vos tâches : « Terminer » applique les choix en une écriture groupée par Sheet.
 * - Point perso du matin : Hier (refaire, reporter, abandonner) · Aujourd'hui (le plan, heures prévues) · Plan figé
 * - Bilan du soir : Prévu / fait · Pas fini (demain, reporter, abandonner)
 * - Revue de la semaine : Semaine écoulée · En retard · Semaine à venir · Priorités (3)
 * - Revue des objectifs : un objectif par écran (garder, décaler l'échéance, abandonner) · Domaines délaissés · Fin
 * Le plan du jour et les priorités de la semaine restent dans l'appareil (pas dans un Sheet).
 */
const TYPES_TACHE = new Set(['tache', 'rendez-vous', 'appel', 'demarche', 'mission']);
const CLE_PLAN = (jour: string) => `president:plan-${jour}`;
const CLE_PRIORITES = 'president:priorites-semaine';
const REPOUSSER = 'Repousser de 3 mois';
const CREER_TACHE = 'Créer une tâche';
/** Point annuel : garder, arrêter, commencer (dans l'appareil) */
const CLE_GAC = (jour: string) => `president:annuel-${jour.slice(0, 4)}`;
type Gac = { garder: string; arreter: string; commencer: string };
/** Durée d'une tâche en heures : son créneau, sinon 1 h */
const duree = (t: Item) => {
  if (t.heure && t.heure_fin) {
    const [a, b] = [t.heure, t.heure_fin].map((x) => Number(x.slice(0, 2)) + Number(x.slice(3)) / 60);
    return Math.max(0.25, b - a);
  }
  return 1;
};
const heures = (n: number) => `${Math.floor(n)} h${n % 1 ? ` ${String(Math.round((n % 1) * 60)).padStart(2, '0')}` : ''}`;
type Choix = 'auj' | 'demain' | 'reporter' | 'abandon' | 'semaine' | 'plustard';
const LIB: Record<Choix, string> = { auj: 'Refaire aujourd’hui', demain: 'Demain', reporter: 'Reporter', abandon: 'Abandonner', semaine: 'Cette semaine', plustard: 'Plus tard' };

export function FenetreSimple({ reunion, actions, onFermer, onFini, onInfo, fil, moi = '', echanges = [] }: { reunion: Reunion; actions: ActionsDaily; onFermer: () => void; onFini?: () => void; onInfo?: (t: string) => void; fil?: string; moi?: string; echanges?: Echange[] }) {
  const h = useHierarchy();
  const org = useOrg();
  const jour = reunion.debut.slice(0, 10);
  const demain = toDateString(addDays(new Date(`${jour}T12:00`), 1));
  const dansSemaine = toDateString(addDays(new Date(`${jour}T12:00`), 7));
  const ilYa7 = toDateString(addDays(new Date(`${jour}T12:00`), -7));
  const taches = useMemo(() => h.items.filter((t) => TYPES_TACHE.has(t.type) && !t.periodicite && !t.parent), [h.items]);
  const [choix, setChoix] = useState<Record<string, Choix>>({});
  const [plan, setPlan] = useState<string[] | null>(null);
  const [priorites, setPriorites] = useState<string[]>([]);
  const [idxObj, setIdxObj] = useState(0);
  const [decObj, setDecObj] = useState<Record<string, string>>({});
  const [decDom, setDecDom] = useState<Record<string, string>>({});
  const [voirFaites, setVoirFaites] = useState(false);
  const [jourAjout, setJourAjout] = useState(reunion.debut.slice(0, 10));
  const [gac, setGac] = useState<Gac>({ garder: '', arreter: '', commencer: '' });
  useEffect(() => {
    AsyncStorage.getItem(CLE_PLAN(jour))
      .then((x) => setPlan(x ? JSON.parse(x) : null))
      .catch(() => {});
    AsyncStorage.getItem(CLE_PRIORITES)
      .then((x) => x && setPriorites(JSON.parse(x)))
      .catch(() => {});
    AsyncStorage.getItem(CLE_GAC(jour))
      .then((x) => x && setGac(JSON.parse(x)))
      .catch(() => {});
  }, [jour]);
  const poser = (id: string, c: Choix) => setChoix((m) => ({ ...m, [id]: c }));
  const ligneChoix = (t: Item, i: number, opts: Choix[], defaut: Choix) => (
    <View key={t.id} style={[st.ligne, { flexDirection: 'column', alignItems: 'stretch' }, i > 0 && st.bord]}>
      <View style={st.ligneHaut}>
        <View style={st.corps}>
          <Text style={st.texte}>{t.titre}</Text>
          <Text style={st.sous}>{[t.date ? `prévu le ${dateCourte(t.date)}` : '', t.heure ? t.heure : ''].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>
      <Pastilles petit options={opts.map((o) => ({ value: o, label: o === 'reporter' ? `Reporter · ${dateCourte(toDateString(addDays(new Date(`${jour}T12:00`), 2)))}` : LIB[o] }))} value={choix[t.id] ?? defaut} onChange={(v) => poser(t.id, v as Choix)} />
    </View>
  );

  // ---- Point perso ----
  const hier = taches.filter((t) => t.statut !== 'termine' && !!t.date && t.date < jour);
  // Aujourd'hui : prévu aujourd'hui, plus ce qu'on refait d'hier (choix par défaut)
  const auj = taches.filter((t) => t.statut !== 'termine' && (t.date === jour || (choix[t.id] ?? (hier.includes(t) ? 'auj' : '')) === 'auj'));
  const dansPlan = plan ?? auj.map((t) => t.id);
  const planifie = auj.filter((t) => dansPlan.includes(t.id));
  const hPlan = planifie.reduce((s, t) => s + duree(t), 0);
  // ---- Bilan du soir ----
  const prevus = taches.filter((t) => (plan ?? []).includes(t.id));
  const faits = prevus.filter((t) => t.statut === 'termine');
  const pasFinis = prevus.filter((t) => t.statut !== 'termine');
  // ---- Revue de la semaine ----
  const faitesSemaine = taches.filter((t) => t.statut === 'termine' && !!t.termine_le && t.termine_le > ilYa7 && t.termine_le <= jour);
  const enRetard = taches.filter((t) => t.statut !== 'termine' && !!t.date && t.date < jour);
  const aVenir = taches.filter((t) => t.statut !== 'termine' && !!t.date && t.date >= jour && t.date <= dansSemaine);
  const rdv = aVenir.filter((t) => t.type === 'rendez-vous');
  const candidatsPrio = taches.filter((t) => t.statut !== 'termine' && t.type !== 'rendez-vous');
  // ---- Revue des objectifs ----
  const objectifs = h.objectifList.filter((o) => !o.fin || o.fin >= jour);
  const il30 = toDateString(addDays(new Date(`${jour}T12:00`), -30));
  const delaisses = h.domaineList.filter((d) => !h.items.some((t) => t.domaine === d.id && ((t.termine_le && t.termine_le >= il30) || (t.statut !== 'termine' && t.date >= jour))));

  // ---- Revue du trimestre, point annuel : la période écoulée ----
  const annuel = reunion.type === 'point_annuel';
  const debutPeriode = toDateString(addDays(new Date(`${jour}T12:00`), annuel ? -365 : -91));
  const faitesPeriode = taches.filter((t) => t.statut === 'termine' && !!t.termine_le && t.termine_le >= debutPeriode && t.termine_le <= jour);
  const objectifsFinis = h.objectifList.filter((o) => !!o.fin && o.fin >= debutPeriode && o.fin < jour);
  const parDomaine = h.domaineList
    .map((d) => ({ d, n: faitesPeriode.filter((t) => t.domaine === d.id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  // ---- « ＋ Ajouter … » (08/10) : l'élément de chaque étape, nouveau ou existant, enregistré tout de suite ----
  const nouvelleTache = (titre: string, date: string) => ({ ...RECURRENCE_DEFAUTS, espace: 'moi', titre, type: 'tache' as const, date, heure: '', heure_fin: '', date_fin: '', lieu: '', description: '', priorite: 'normale' as const, statut: 'a_faire' as const, parent: '', feature: '', epic: '', objectif: '', domaine: '', points: '', iteration: '', telephone: '', equipe: '', responsable: '' });
  const ajoutTache = (date: string, auPlan = false) => ({
    existants: taches.filter((t) => t.statut !== 'termine' && t.date !== date).map((t) => ({ id: t.id, titre: t.titre, sous: t.date ? `prévue le ${dateCourte(t.date)}` : 'sans date' })),
    onNouveau: async (titre: string) => {
      const [t] = await actions.creerTaches('moi', [nouvelleTache(titre, date)]);
      if (auPlan) setPlan((p) => (p ? [...p, t.id] : p));
      return async () => {
        await actions.supprimer?.('item', t.id);
        if (auPlan) setPlan((p) => (p ? p.filter((x) => x !== t.id) : p));
      };
    },
    onChoisir: async (id: string) => {
      const t = taches.find((x) => x.id === id)!;
      const avant = t.date;
      await actions.modifierItems?.(t.espace || 'moi', [{ id, date }]);
      if (auPlan) setPlan((p) => (p ? [...p, id] : p));
      return async () => {
        await actions.modifierItems?.(t.espace || 'moi', [{ id, date: avant }]);
        if (auPlan) setPlan((p) => (p ? p.filter((x) => x !== id) : p));
      };
    },
  });
  const finTrimestre = (() => {
    const d = new Date(`${jour}T12:00`);
    return toDateString(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0));
  })();
  /** Échéance d'un objectif ajouté : 31/12 au point annuel, sinon fin du trimestre */
  const finObjectif = annuel ? `${jour.slice(0, 4)}-12-31` : finTrimestre;
  const ajoutObjectif = {
    existants: h.objectifList.filter((o) => !!o.fin && o.fin < jour).map((o) => ({ id: o.id, titre: o.titre, sous: `échu le ${dateCourte(o.fin)} · repris jusqu'au ${dateCourte(finObjectif)}` })),
    onNouveau: async (titre: string) => {
      const [o] = await actions.creerEntites!('moi', 'objectif', [{ titre, debut: jour, fin: finObjectif, description: '', domaine: '', couleur: '', cible: '', actuel: '', unite: '' }]);
      return async () => actions.supprimer!('objectif', o.id);
    },
    onChoisir: async (id: string) => {
      const o = h.objectifList.find((x) => x.id === id)!;
      const avant = o.fin;
      await actions.modifierEntites!(o.espace || 'moi', 'objectif', [{ id, fin: finObjectif }]);
      return async () => actions.modifierEntites!(o.espace || 'moi', 'objectif', [{ id, fin: avant }]);
    },
  };
  const ajoutDomaine = {
    existants: [],
    onNouveau: async (nom: string) => {
      const [d] = await actions.creerEntites!('moi', 'domaine', [{ nom, icone: '🌱', couleur: '', parent: '' }]);
      return async () => actions.supprimer!('domaine', d.id);
    },
  };
  const joursSemaine = Array.from({ length: 7 }, (_, k) => toDateString(addDays(new Date(`${jour}T12:00`), k)));

  // Étape « Suivis » toujours affichée (08/10) : les notes venues du Chat y arrivent, et on peut en ajouter
  const etapes = TYPES_ETAPES[reunion.type] ?? [];
  const rendu = (k: number) => {
    const cle = etapes[k]?.cle;
    switch (cle) {
      // Suivis et notes (08/10) : les mêmes que les réunions d'équipe ; le Chat peut y lier un message
      case 'suivis':
        return <SuivisPerso reunion={reunion} moi={moi} echanges={echanges} actions={actions} onInfo={onInfo} />;
      case 'hier':
        return (
          <>
            <TitreFiche icone="🌅" titre="Hier" vide="" sous={`${hier.length} tâche${hier.length > 1 ? 's' : ''} pas finie${hier.length > 1 ? 's' : ''}`} />
            <SectionFiche titre="Pas finies">{hier.length ? hier.map((t, i) => ligneChoix(t, i, ['auj', 'reporter', 'abandon'], 'auj')) : <Vide texte="✓ Tout est fait." />}</SectionFiche>
          </>
        );
      case 'aujourdhui':
        return (
          <>
            <TitreFiche icone="☀️" titre="Aujourd’hui" vide="" sous={dateCourte(jour)} />
            <Compteurs l={[{ valeur: heures(hPlan), libelle: 'prévues' }, { valeur: '7 h', libelle: 'disponibles' }, { valeur: String(planifie.length), libelle: 'tâches', ton: hPlan > 7 ? 'orange' : undefined }]} />
            <SectionFiche titre="Cochez votre plan">
              {auj.length ? (
                auj.map((t, i) => {
                  const on = dansPlan.includes(t.id);
                  return (
                    <Pressable key={t.id} onPress={() => setPlan(on ? dansPlan.filter((x) => x !== t.id) : [...dansPlan, t.id])} style={[st.ligne, i > 0 && st.bord]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                      <Text style={[st.caseACocher, on && st.caseCochee]}>{on ? '✓' : ''}</Text>
                      <View style={st.corps}>
                        <Text style={st.texte}>{`${t.type === 'rendez-vous' ? '📅 ' : ''}${t.titre}`}</Text>
                        <Text style={st.sous}>{[t.heure, heures(duree(t))].filter(Boolean).join(' · ')}</Text>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Vide texte="Rien de prévu aujourd’hui." />
              )}
            </SectionFiche>
            <AjoutElement mot="tâche" feminin aide="Ajoutée au plan d’aujourd’hui" {...ajoutTache(jour, true)} />
          </>
        );
      case 'plan':
        return (
          <>
            <TitreFiche icone="📌" titre="Plan figé" vide="" sous={`${planifie.length} tâche${planifie.length > 1 ? 's' : ''} · ${heures(hPlan)}`} />
            <SectionFiche titre="Mon plan">{planifie.length ? planifie.map((t, i) => <Ligne key={t.id} premiere={i === 0} texte={t.titre} pastille={{ texte: t.heure || heures(duree(t)), ton: 'bleu' }} />) : <Vide texte="Plan vide." />}</SectionFiche>
            <Text style={[st.sous, { marginHorizontal: 16, marginTop: 8 }]}>Une tâche ajoutée après le plan vous sera proposée au bilan du soir (« hors plan »).</Text>
          </>
        );
      case 'prevu':
        return (
          <>
            <TitreFiche icone="📊" titre="Prévu / fait" vide="" sous={plan ? `Plan du ${dateCourte(jour)}` : 'Pas de plan figé ce matin'} />
            <Compteurs l={[{ valeur: `${faits.length}/${prevus.length}`, libelle: 'du plan fait', ton: 'vert' }, { valeur: heures(faits.reduce((s, t) => s + duree(t), 0)), libelle: 'faites' }, { valeur: String(prevus.length - faits.length), libelle: 'pas fini', ton: prevus.length - faits.length ? 'orange' : undefined }]} />
            <SectionFiche titre="Plan">{prevus.length ? prevus.map((t, i) => <Ligne key={t.id} premiere={i === 0} texte={t.titre} pastille={pastilleStatut(t.statut)} tache={t} />) : <Vide texte="Pas de plan : faites le point perso le matin." />}</SectionFiche>
          </>
        );
      case 'pasfini':
        return (
          <>
            <TitreFiche icone="⏳" titre={`Pas fini · ${pasFinis.length}`} vide="" sous="Le reste part à demain par défaut" />
            <SectionFiche titre="Pas fini">{pasFinis.length ? pasFinis.map((t, i) => ligneChoix(t, i, ['demain', 'reporter', 'abandon'], 'demain')) : <Vide texte="✓ Tout le plan est fait." />}</SectionFiche>
            <AjoutElement mot="tâche" feminin aide={`Pour demain (${dateCourte(demain)})`} {...ajoutTache(demain)} />
          </>
        );
      case 'periode':
        return (
          <>
            <TitreFiche icone="📊" titre={annuel ? "Bilan de l'année" : 'Trimestre écoulé'} vide="" sous={`${dateCourte(debutPeriode)} → ${dateCourte(jour)}`} />
            <Compteurs l={[{ valeur: String(faitesPeriode.length), libelle: 'tâches faites', ton: 'vert' }, { valeur: String(objectifsFinis.length), libelle: 'objectifs échus' }, { valeur: String(enRetard.length), libelle: 'en retard', ton: enRetard.length ? 'rouge' : undefined }]} />
            <SectionFiche titre={`Tâches faites · ${faitesPeriode.length}`}>
              {faitesPeriode.length ? (
                [...faitesPeriode]
                  .sort((a, b) => (b.termine_le ?? '').localeCompare(a.termine_le ?? ''))
                  .slice(0, voirFaites ? 200 : 5)
                  .map((t, i) => <Ligne key={t.id} premiere={i === 0} texte={t.titre} sous={t.termine_le ? `faite le ${dateCourte(t.termine_le)}` : undefined} />)
              ) : (
                <Vide texte="Aucune tâche terminée sur la période." />
              )}
              {faitesPeriode.length > 5 && (
                <Pressable onPress={() => setVoirFaites((v) => !v)} style={{ padding: 12 }} accessibilityRole="button">
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>{voirFaites ? 'Voir moins' : `Voir les ${faitesPeriode.length}`}</Text>
                </Pressable>
              )}
            </SectionFiche>
            <SectionFiche titre={`Par domaine · ${parDomaine.length}`}>
              {parDomaine.length ? parDomaine.map((x, i) => <Ligne key={x.d.id} premiere={i === 0} texte={`${x.d.icone} ${x.d.nom}`} pastille={{ texte: `${x.n} faite${x.n > 1 ? 's' : ''}`, ton: 'bleu' }} />) : <Vide texte="Aucune tâche terminée sur la période." />}
            </SectionFiche>
            {objectifsFinis.length > 0 && (
              <SectionFiche titre={`Objectifs échus · ${objectifsFinis.length}`}>{objectifsFinis.map((o, i) => <Ligne key={o.id} premiere={i === 0} texte={o.titre} sous={o.fin ? `échéance ${dateCourte(o.fin)}` : undefined} />)}</SectionFiche>
            )}
          </>
        );
      case 'gac':
        return (
          <>
            <TitreFiche icone="🔁" titre="Garder · arrêter · commencer" vide="" sous="Une idée par ligne ; gardé dans l'appareil jusqu'au prochain point annuel" />
            {(['garder', 'arreter', 'commencer'] as const).map((k) => (
              <SectionFiche key={k} titre={k === 'garder' ? '✅ Garder' : k === 'arreter' ? '⛔ Arrêter' : '🌱 Commencer'}>
                <SaisieFiche multiline value={gac[k]} onChangeText={(v) => setGac((g) => ({ ...g, [k]: v }))} placeholder={k === 'garder' ? 'Ce qui marche' : k === 'arreter' ? 'Ce qui ne sert plus' : 'Ce que je veux essayer'} style={{ margin: 12 }} />
              </SectionFiche>
            ))}
          </>
        );
      case 'ecoulee':
        return (
          <>
            <TitreFiche icone="📊" titre="Semaine écoulée" vide="" sous={`${dateCourte(ilYa7)} → ${dateCourte(jour)}`} />
            <Compteurs l={[{ valeur: String(faitesSemaine.length), libelle: 'faites', ton: 'vert' }, { valeur: String(enRetard.length), libelle: 'en retard', ton: enRetard.length ? 'rouge' : undefined }, { valeur: String(priorites.length), libelle: 'priorités' }]} />
            <SectionFiche titre={`Priorités de la semaine · ${priorites.length}`}>
              {priorites.length ? priorites.map((id, i) => {
                const t = taches.find((x) => x.id === id);
                return <Ligne key={id} premiere={i === 0} texte={t?.titre ?? 'supprimée'} pastille={t?.statut === 'termine' ? { texte: 'fait', ton: 'vert' } : { texte: 'pas fait', ton: 'rouge' }} />;
              }) : <Vide texte="Pas de priorités choisies la semaine dernière." />}
            </SectionFiche>
          </>
        );
      case 'retard':
        return (
          <>
            <TitreFiche icone="⏳" titre={`En retard · ${enRetard.length}`} vide="" sous="" />
            <SectionFiche titre="En retard">{enRetard.length ? enRetard.map((t, i) => ligneChoix(t, i, ['semaine', 'plustard', 'abandon'], 'semaine')) : <Vide texte="✓ Rien en retard." />}</SectionFiche>
          </>
        );
      case 'avenir':
        return (
          <>
            <TitreFiche icone="📅" titre="Semaine à venir" vide="" sous={`Du ${dateCourte(jour)} au ${dateCourte(dansSemaine)}`} />
            <SectionFiche titre={`Rendez-vous · ${rdv.length}`}>{rdv.length ? rdv.map((t, i) => <Ligne key={t.id} premiere={i === 0} texte={`📅 ${t.titre}`} sous={`${dateCourte(t.date)}${t.heure ? ` · ${t.heure}` : ''}`} pastille={{ texte: heures(duree(t)), ton: 'bleu' }} />) : <Vide texte="Aucun rendez-vous." />}</SectionFiche>
            <SectionFiche titre={`Tâches prévues · ${aVenir.length - rdv.length}`}>{aVenir.filter((t) => t.type !== 'rendez-vous').map((t, i) => <Ligne key={t.id} premiere={i === 0} texte={t.titre} sous={dateCourte(t.date)} tache={t} />)}</SectionFiche>
            <AjoutElement mot="tâche" feminin aide={`Prévue le ${dateCourte(jourAjout)}`} options={<ChoixJour jours={joursSemaine} value={jourAjout} onChange={setJourAjout} />} {...ajoutTache(jourAjout)} />
          </>
        );
      case 'priorites':
        return (
          <>
            <TitreFiche icone="🎯" titre={`Priorités · ${priorites.length} sur 3`} vide="" sous="Proposées en premier à chaque point perso du matin" />
            <SectionFiche titre="Choisissez 3 priorités">
              {candidatsPrio.slice(0, 30).map((t, i) => {
                const on = priorites.includes(t.id);
                return (
                  <Pressable key={t.id} onPress={() => setPriorites(on ? priorites.filter((x) => x !== t.id) : priorites.length < 3 ? [...priorites, t.id] : priorites)} style={[st.ligne, i > 0 && st.bord]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <Text style={[st.caseACocher, on && st.caseCochee]}>{on ? String(priorites.indexOf(t.id) + 1) : ''}</Text>
                    <View style={st.corps}>
                      <Text style={st.texte}>{t.titre}</Text>
                      {!!t.date && <Text style={st.sous}>{dateCourte(t.date)}</Text>}
                    </View>
                  </Pressable>
                );
              })}
              {!candidatsPrio.length && <Vide texte="Aucune tâche." />}
            </SectionFiche>
          </>
        );
      case 'objectifs': {
        const plusObjectif = <AjoutElement mot="objectif" aide={`Échéance : ${dateCourte(finObjectif)}`} {...ajoutObjectif} />;
        if (!objectifs.length)
          return (
            <>
              <Vide texte="Aucun objectif en cours." />
              {plusObjectif}
            </>
          );
        const i = Math.min(idxObj, objectifs.length - 1);
        const o = objectifs[i];
        const pct = Number(o.cible) ? Math.round((100 * (Number(o.actuel) || 0)) / Number(o.cible)) : 0;
        return (
          <>
            <Navigation n={objectifs.length} cur={i} onChoisir={setIdxObj} />
            <TitreFiche icone="🎯" titre={o.titre} vide="" sous={`objectif ${i + 1} sur ${objectifs.length}${o.fin ? ` · échéance ${dateCourte(o.fin)}` : ''}`} />
            <Compteurs l={[{ valeur: `${pct} %`, libelle: 'avancement' }, { valeur: String(h.epicList.filter((x) => x.objectif === o.id).length), libelle: 'projets' }, { valeur: String(h.items.filter((t) => t.objectif === o.id && t.statut !== 'termine').length), libelle: 'tâches ouvertes' }]} />
            <SectionFiche titre="Objectif">
              <View style={{ padding: 12 }}>
                <Pastilles petit options={['Garder', REPOUSSER, 'Abandonner'].map((x) => ({ value: x, label: x }))} value={decObj[o.id] ?? 'Garder'} onChange={(x) => setDecObj((m) => ({ ...m, [o.id]: x }))} />
                <Text style={[st.sous, { marginTop: 8 }]}>
                  {o.fin
                    ? `Échéance : date à laquelle l'objectif doit être atteint (${dateCourte(o.fin)}). ${REPOUSSER} : ${dateCourte(o.fin)} → ${dateCourte(toDateString(addDays(new Date(`${(o.fin > jour ? o.fin : jour)}T12:00`), 91)))}.`
                    : `Pas d'échéance (date à laquelle l'objectif doit être atteint). ${REPOUSSER} : la fixe au ${dateCourte(toDateString(addDays(new Date(`${jour}T12:00`), 91)))}.`}
                </Text>
              </View>
            </SectionFiche>
            {plusObjectif}
          </>
        );
      }
      case 'domaines':
        return (
          <>
            <TitreFiche icone="🌱" titre="Domaines délaissés" vide="" sous="Aucune tâche faite ni prévue depuis 30 jours. « Créer une tâche » : une tâche « À planifier » pour demain, dans ce domaine ; « Garder tel quel » : rien ne change." />
            <SectionFiche titre={`Domaines · ${delaisses.length}`}>
              {delaisses.length ? (
                delaisses.map((d, i) => (
                  <View key={d.id} style={[st.ligne, { flexDirection: 'column', alignItems: 'stretch' }, i > 0 && st.bord]}>
                    <Text style={st.texte}>{`${d.icone} ${d.nom}`}</Text>
                    <Pastilles petit options={[CREER_TACHE, 'Garder tel quel'].map((x) => ({ value: x, label: x }))} value={decDom[d.id] ?? 'Garder tel quel'} onChange={(x) => setDecDom((m) => ({ ...m, [d.id]: x }))} />
                  </View>
                ))
              ) : (
                <Vide texte="✓ Aucun domaine délaissé." />
              )}
            </SectionFiche>
            {annuel && <AjoutElement mot="domaine" aide="Un nouveau domaine de votre vie ou de votre travail (🌱, modifiable ensuite)" {...ajoutDomaine} />}
          </>
        );
      // 💶 Budget simplifié (09/10) : Sheet Budget personnel ; projets (epics) de 🔒 Moi
      case 'budget':
        return (
          <>
            <TitreFiche icone="💶" titre={reunion.type === 'point_annuel' ? 'Budget de l’année' : 'Budget'} vide="" sous="Prévu · Dépensé · Reste · Estimation à la fin, par projet" />
            <BlocBudgetSimple epics={h.epicList.filter((x) => (x.espace || 'moi') === 'moi')} h={h} org={org} espace="moi" mode={reunion.type === 'point_annuel' ? 'annee' : 'suivi'} peutModifier />
          </>
        );
      case 'fin':
        return (
          <>
            <TitreFiche icone="✓" titre="Revue terminée" vide="" sous={`${objectifs.length} objectif${objectifs.length > 1 ? 's' : ''} revu${objectifs.length > 1 ? 's' : ''}`} />
            <SectionFiche titre="Décisions">{objectifs.map((o, i) => <Ligne key={o.id} premiere={i === 0} texte={o.titre} pastille={{ texte: decObj[o.id] ?? 'Gardé', ton: (decObj[o.id] ?? 'Garder') === 'Garder' ? 'vert' : 'orange' }} />)}</SectionFiche>
            {delaisses.length > 0 && (
              <SectionFiche titre="Domaines délaissés">
                {delaisses.map((d, i) => (
                  <Ligne key={d.id} premiere={i === 0} texte={`${d.icone} ${d.nom}`} pastille={decDom[d.id] === CREER_TACHE ? { texte: 'tâche créée demain', ton: 'bleu' } : { texte: 'gardé', ton: 'vert' }} />
                ))}
              </SectionFiche>
            )}
            {Object.values(decDom).some((x) => x === CREER_TACHE) && <Text style={[st.sous, { marginHorizontal: 16, marginTop: 8, color: colors.primary }]}>Une tâche « À planifier · domaine » sera créée pour demain pour chaque domaine choisi.</Text>}
          </>
        );
      default:
        return null;
    }
  };

  /** « Terminer » : les choix appliqués (une écriture par Sheet), le plan et les priorités gardés dans l'appareil */
  const terminer = async () => {
    const dateDe = (c: Choix): string | null => (c === 'auj' ? jour : c === 'demain' ? demain : c === 'reporter' ? toDateString(addDays(new Date(`${jour}T12:00`), 2)) : c === 'semaine' ? jour : c === 'plustard' ? dansSemaine : c === 'abandon' ? '' : null);
    const defaut = (t: Item): Choix | null => (reunion.type === 'point_perso' && hier.includes(t) ? 'auj' : reunion.type === 'bilan_soir' && pasFinis.includes(t) ? 'demain' : reunion.type === 'revue_semaine' && enRetard.includes(t) ? 'semaine' : null);
    const patches = new Map<string, (Partial<Item> & { id: string })[]>();
    for (const t of taches) {
      const c = choix[t.id] ?? defaut(t);
      if (!c) continue;
      const d = dateDe(c);
      if (d === null || d === t.date) continue;
      const esp = t.espace || 'moi';
      patches.set(esp, [...(patches.get(esp) ?? []), { id: t.id, date: d }]);
    }
    let n = 0;
    if (actions.modifierItems) for (const [esp, l] of patches) n += (await actions.modifierItems(esp, l)).length;
    // Revue des objectifs : échéance décalée de 3 mois, ou objectif arrêté aujourd'hui ; une tâche « à planifier »
    // par domaine délaissé choisi (une écriture groupée par Sheet)
    if (reunion.type === 'revue_objectifs' || reunion.type === 'revue_trimestre' || reunion.type === 'point_annuel') {
      const parEsp = new Map<string, { id: string; fin: string }[]>();
      for (const o of objectifs) {
        const d = decObj[o.id];
        if (!d || d === 'Garder') continue;
        const base = o.fin && o.fin > jour ? o.fin : jour;
        const fin = d === 'Abandonner' ? jour : toDateString(addDays(new Date(`${base}T12:00`), 91));
        const esp = o.espace || 'moi';
        parEsp.set(esp, [...(parEsp.get(esp) ?? []), { id: o.id, fin }]);
      }
      if (actions.modifierEntites) for (const [esp, l] of parEsp) await actions.modifierEntites(esp, 'objectif', l);
      const aPlanifier = delaisses.filter((d) => decDom[d.id] === CREER_TACHE);
      const parEspD = new Map<string, typeof aPlanifier>();
      for (const d of aPlanifier) parEspD.set(d.espace || 'moi', [...(parEspD.get(d.espace || 'moi') ?? []), d]);
      for (const [esp, l] of parEspD)
        await actions.creerTaches(
          esp,
          l.map((d) => ({ ...RECURRENCE_DEFAUTS, espace: esp, titre: `À planifier · ${d.nom}`, type: 'tache', date: demain, heure: '', heure_fin: '', date_fin: '', lieu: '', description: `Domaine délaissé (revue des objectifs du ${dateCourte(jour)}).`, priorite: 'normale', statut: 'a_faire', parent: '', feature: '', epic: '', objectif: '', domaine: d.id, points: '', iteration: '', telephone: '', equipe: '', responsable: '' })),
        );
    }
    if (reunion.type === 'point_perso') await AsyncStorage.setItem(CLE_PLAN(jour), JSON.stringify(dansPlan)).catch(() => {});
    if (reunion.type === 'revue_semaine') await AsyncStorage.setItem(CLE_PRIORITES, JSON.stringify(priorites)).catch(() => {});
    if (reunion.type === 'point_annuel') await AsyncStorage.setItem(CLE_GAC(jour), JSON.stringify(gac)).catch(() => {});
    onFini?.();
    onInfo?.(`${TITRES[reunion.type] ?? 'Rituel'} terminé${n ? ` : ${n} tâche${n > 1 ? 's' : ''} déplacée${n > 1 ? 's' : ''}` : ''}.`);
  };

  return (
    <FenetreReunion
      visible
      reunion={reunion}
      mode="organisateur"
      fil={fil}
      etapes={etapes.map((x) => x.nom)}
      libelleFin="Terminer"
      renduEtape={rendu}
      onSuivant={(k) => {
        if (etapes[k]?.cle === 'objectifs' && idxObj < objectifs.length - 1) {
          setIdxObj(idxObj + 1);
          return true;
        }
        return false;
      }}
      libelleSuivant={(k) => (etapes[k]?.cle === 'objectifs' && idxObj < objectifs.length - 1 ? 'Objectif suivant ›' : undefined)}
      onTerminer={terminer}
      onFermer={onFermer}
    />
  );
}
const TITRES: Partial<Record<Reunion['type'], string>> = { point_perso: 'Point perso', bilan_soir: 'Bilan du soir', revue_semaine: 'Revue de la semaine', revue_objectifs: 'Revue des objectifs', revue_trimestre: 'Revue du trimestre', point_annuel: 'Point annuel' };
const SUIVIS = { cle: 'suivis', nom: 'Suivis' };
const TYPES_ETAPES: Partial<Record<Reunion['type'], { cle: string; nom: string }[]>> = {
  point_perso: [
    SUIVIS,
    { cle: 'hier', nom: 'Hier' },
    { cle: 'aujourdhui', nom: 'Aujourd’hui' },
    { cle: 'plan', nom: 'Plan figé' },
  ],
  bilan_soir: [
    SUIVIS,
    { cle: 'prevu', nom: 'Prévu / fait' },
    { cle: 'pasfini', nom: 'Pas fini' },
  ],
  revue_semaine: [
    SUIVIS,
    { cle: 'ecoulee', nom: 'Semaine écoulée' },
    { cle: 'retard', nom: 'En retard' },
    { cle: 'avenir', nom: 'Semaine à venir' },
    { cle: 'priorites', nom: 'Priorités' },
  ],
  revue_objectifs: [
    SUIVIS,
    { cle: 'objectifs', nom: 'Objectifs' },
    { cle: 'domaines', nom: 'Domaines délaissés' },
    { cle: 'budget', nom: 'Budget' },
    { cle: 'fin', nom: 'Fin' },
  ],
  // Revue du trimestre et point annuel (07/10) : le bilan de la période, puis la revue des objectifs
  revue_trimestre: [
    SUIVIS,
    { cle: 'periode', nom: 'Trimestre écoulé' },
    { cle: 'objectifs', nom: 'Objectifs du trimestre' },
    { cle: 'domaines', nom: 'Domaines' },
    { cle: 'fin', nom: 'Fin' },
  ],
  point_annuel: [
    SUIVIS,
    { cle: 'periode', nom: "Bilan de l'année" },
    { cle: 'gac', nom: 'Garder · arrêter · commencer' },
    { cle: 'objectifs', nom: "Objectifs de l'année" },
    { cle: 'domaines', nom: 'Domaines' },
    { cle: 'budget', nom: "Budget de l'année" },
    { cle: 'fin', nom: 'Fin' },
  ],
};
export const estRituelSimple = (t: Reunion['type']) => !!TYPES_ETAPES[t];
