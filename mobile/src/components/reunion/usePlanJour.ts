import { useEffect, useMemo, useState } from 'react';
import { type EvenementJour, JOURNEE_DEFAUT, type Journee, type PlaceJour, reunionPlanJour } from '../../daily';
import { libelleNiveau, lireNiveau } from '../../echange/hierarchieEchange';
import { lireDonnee } from '../../etatReunion';
import type { OrgValue } from '../../organisation';
import { reunionsAVenir } from '../../reunions';
import type { ActionsDaily } from '../Daily';

/** Réglage de la journée de travail dans 🔒 Moi (une ligne, hors des jours) */
const PREFIXE_REGLAGE = 'plan_reglage-moi-2000-01-01';
/** « 9:30 » + 15 min → « 9:45 » */
const minutesVersHeure = (h: string, duree: number) => {
  const [a, b] = h.split(':').map(Number);
  const n = a * 60 + b + (duree || 30);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

/**
 * Plan du jour (13/10, R5) partagé par le Daily et le Point perso : places des éléments, événements perso et journée
 * de travail, rangés dans 🔒 Moi (vus par moi seul). Lus à l'ouverture ; `ecrire` remplace ceux du jour en un appel.
 */
export function usePlanJour({ visible, actions, mail, jour, org, safeActif, onInfo }: { visible: boolean; actions: Pick<ActionsDaily, 'lirePoints' | 'ecrirePoints'>; mail: string; jour: string; org: OrgValue; safeActif: boolean; onInfo?: (t: string) => void }) {
  const [places, setPlaces] = useState<Record<string, PlaceJour>>({});
  const [evtsPerso, setEvtsPerso] = useState<EvenementJour[]>([]);
  const [anciensPlan, setAnciensPlan] = useState<string[]>([]);
  /** Journée de travail réglée par chacun (🔒 Moi, une ligne à part, gardée d'un jour à l'autre) */
  const [journee, setJournee] = useState<Journee>(JOURNEE_DEFAUT);
  const [ligneJournee, setLigneJournee] = useState('');
  useEffect(() => {
    if (!visible) return;
    setPlaces({});
    setEvtsPerso([]);
    setAnciensPlan([]);
    let actif = true;
    actions
      .lirePoints('moi', PREFIXE_REGLAGE)
      .then((l) => {
        const x = l.find((y) => y.type === 'donnee' && y.personne === mail && lireDonnee(y)?.k === 'journee');
        const d = x && lireDonnee<Partial<Journee>>(x);
        if (actif && x && d) (setJournee({ ...JOURNEE_DEFAUT, ...d }), setLigneJournee(x.id));
      })
      .catch(() => {});
    actions
      .lirePoints('moi', reunionPlanJour(jour))
      .then((l) => {
        if (!actif) return;
        const miens = l.filter((x) => x.type === 'donnee' && x.personne === mail);
        setAnciensPlan(miens.map((x) => x.id));
        const c: Record<string, PlaceJour> = {};
        const ev: EvenementJour[] = [];
        for (const x of miens) {
          const d = lireDonnee<{ d?: string; h?: string; f?: string; t?: string }>(x);
          if (d?.k === 'place' && x.element && (d.d === 'Matin' || d.d === 'Après-midi' || d.h)) c[x.element] = { demi: d.d === 'Matin' || d.d === 'Après-midi' ? d.d : '', debut: d.h || undefined, fin: d.f || undefined };
          if (d?.k === 'evt' && d.h && d.t) ev.push({ heure: d.h, fin: d.f, titre: d.t, perso: true, id: x.id });
        }
        setPlaces(c);
        setEvtsPerso(ev);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, jour]);
  const reunionsDuJour: EvenementJour[] = useMemo(
    () =>
      reunionsAVenir(org, mail, jour, safeActif, 1)
        .filter((r) => r.debut.slice(0, 10) === jour)
        .map((r) => ({ heure: r.debut.slice(11, 16).replace(/^0/, ''), fin: minutesVersHeure(r.debut.slice(11, 16), r.duree_min), titre: [r.titre, libelleNiveau(lireNiveau(r.niveau), org)].filter(Boolean).join(' · ') })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org, mail, jour, safeActif],
  );
  const ecrireCreneaux = async (garder: Set<string>) => {
    const base = { reunion: reunionPlanJour(jour), personne: mail, auteur: mail, type: 'donnee' as const, concretisation: '' as const, tache: '', responsable: '' };
    const creer = [
      ...Object.entries(places).filter(([id, p]) => (p.demi || p.debut) && garder.has(id)).map(([id, p]) => ({ ...base, element: id, texte: JSON.stringify({ k: 'place', d: p.demi, h: p.debut ?? '', f: p.fin ?? '' }) })),
      ...evtsPerso.map((x) => ({ ...base, element: '', texte: JSON.stringify({ k: 'evt', h: x.heure, f: x.fin, t: x.titre }) })),
    ];
    if (!creer.length && !anciensPlan.length) return;
    try {
      const { crees } = await actions.ecrirePoints('moi', creer, [], anciensPlan);
      setAnciensPlan(crees.map((x) => x.id));
    } catch (err) {
      onInfo?.(`Créneaux non enregistrés dans 🔒 Moi : ${(err as Error).message}`);
    }
  };

  /** Réglage de la journée : écrit tout de suite (rare), remplace la ligne précédente */
  const changerJournee = async (j: Journee) => {
    setJournee(j);
    try {
      const { crees } = await actions.ecrirePoints(
        'moi',
        [{ reunion: PREFIXE_REGLAGE, personne: mail, auteur: mail, type: 'donnee', concretisation: '', tache: '', responsable: '', element: '', texte: JSON.stringify({ k: 'journee', ...j }) }],
        [],
        ligneJournee ? [ligneJournee] : [],
      );
      setLigneJournee(crees[0]?.id ?? '');
    } catch (err) {
      onInfo?.(`Journée non enregistrée dans 🔒 Moi : ${(err as Error).message}`);
    }
  };

  // Plan commun (R5b, 13/10) : les éléments cochés « aujourd'hui » à mes autres réunions du jour (Dailies de mes
  // équipes, quel que soit l'espace) ; une lecture par réunion, à l'ouverture
  const [planAilleurs, setPlanAilleurs] = useState<{ element: string; reunion: string; titre: string }[]>([]);
  useEffect(() => {
    if (!visible) return;
    setPlanAilleurs([]);
    let actif = true;
    const dailies = reunionsAVenir(org, mail, jour, safeActif, 1).filter((r) => r.debut.slice(0, 10) === jour && r.type === 'daily');
    Promise.all(
      dailies.map((r) =>
        actions
          .lirePoints(r.espace || 'moi', r.id)
          .then((l) => l.filter((x) => x.reunion === r.id && x.personne === mail && x.type === 'aujourdhui' && !!x.element).map((x) => ({ element: x.element, reunion: r.id, titre: [r.titre, libelleNiveau(lireNiveau(r.niveau), org)].filter(Boolean).join(' · ') })))
          .catch(() => []),
      ),
    ).then((ll) => actif && setPlanAilleurs(ll.flat()));
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, jour]);
  return { planAilleurs, places, setPlaces, evtsPerso, setEvtsPerso, journee, changerJournee, ecrire: ecrireCreneaux, reunionsDuJour };
}
