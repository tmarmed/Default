import type { Echange, EchangeInput, PointReunion } from './types';

/**
 * Parent et enfants (lot 3 du 16/10, docs/regles-reunions.html bloc 16 : L1, L2, L4, L5, Q2) : une seule relation
 * pour tout ce qui circule entre niveaux. Le parent est au niveau du dessus (il décide, valide, communique), l'enfant
 * au dessous (il demande, fait, confirme). Le lien passe par un échange du Chat (salle d'attente) qui garde la
 * référence du point parent (« espace|id ») ; l'enfant, mis en réunion, garde l'échange. Rien ici n'appelle Google.
 *
 * Escalade (↑) : l'enfant a envoyé, le parent répond (mécanisme existant de src/pointsSuivi.ts, rôle « bas » / « haut »).
 * Communication et répartition (↓) : le parent envoie un échange « ⤵ » par équipe du dessous (à son Scrum Master).
 */

/** Marque d'un échange de communication (↓) : un enfant attendu */
export const MARQUE_COMMUNICATION = '⤵ ';
export const estCommunication = (e: Pick<Echange, 'titre'>) => e.titre.startsWith(MARQUE_COMMUNICATION);

/** Enfants d'un point parent (sa référence « espace|id ») : les échanges ⤵ qui le citent */
export const enfantsDe = (ref: string, echanges: Echange[]) => echanges.filter((e) => estCommunication(e) && e.point === ref);

export type EtatEnfant = 'attente' | 'suivi' | 'fait' | 'abandonne';
/** État d'un enfant : en attente au Chat, suivi dans une réunion, fait (répondu), abandonné (sur demande acceptée) */
export function etatEnfant(e: Pick<Echange, 'statut' | 'suivi_a' | 'reponse'>): EtatEnfant {
  if (e.statut === 'repondu' || e.statut === 'pris_en_compte') return /abandon|plus suivi/i.test(e.reponse) ? 'abandonne' : 'fait';
  return e.suivi_a ? 'suivi' : 'attente';
}
const ICONE_ETAT: Record<EtatEnfant, string> = { attente: '⏳', suivi: '🔵', fait: '✓', abandonne: '⊘' };

/**
 * R3 · Ligne du parent : « 2 / 3 · Mobile ✓ · Web 🔵 · Studio ⏳ » (✓ fait, 🔵 suivi en réunion, ⏳ pas encore traité,
 * ⊘ abandonné) ; '' sans enfant
 */
export function ligneParent(enfants: Echange[], nomNiveau: (niveau: string) => string): string {
  if (!enfants.length) return '';
  const finis = enfants.filter((e) => etatEnfant(e) !== 'attente' && etatEnfant(e) !== 'suivi').length;
  return [`${finis} / ${enfants.length}`, ...enfants.map((e) => `${nomNiveau(e.niveau) || '?'} ${ICONE_ETAT[etatEnfant(e)]}`)].join(' · ');
}

/** L4 · Tous les enfants finis → l'application propose au parent « Valider » (ou « Ne plus suivre » si certains sont abandonnés) */
export function propositionParent(enfants: Echange[]): '' | 'valider' | 'plus_suivre' {
  if (!enfants.length || enfants.some((e) => etatEnfant(e) === 'attente' || etatEnfant(e) === 'suivi')) return '';
  return enfants.some((e) => etatEnfant(e) === 'abandonne') ? 'plus_suivre' : 'valider';
}

/** Une équipe (ou un niveau) du dessous à qui communiquer, par son Scrum Master (Q1 : à plusieurs équipes, par leurs SM) */
export interface CibleCommunication {
  niveau: string;
  libelle: string;
  /** E-mail de celui qui reçoit en premier (Scrum Master, RTE…) */
  a: string;
}

/** Échanges ⤵ d'une communication (ou d'une répartition) : un par niveau du dessous, liés au point parent */
export function messagesCommunication(o: { pt: Pick<PointReunion, 'texte' | 'element'>; ref: string; de: string; cibles: CibleCommunication[]; texte: string; espace: string; quoi: 'communiquer' | 'repartir' }): EchangeInput[] {
  return o.cibles.map((c) => ({
    de: o.de.toLowerCase(),
    a: c.a.toLowerCase(),
    type: 'message' as const,
    nature: 'action' as const,
    titre: `${MARQUE_COMMUNICATION}${o.pt.texte}`.slice(0, 200),
    texte: `${o.quoi === 'repartir' ? 'Suivi réparti' : 'Communication'} du niveau du dessus : ${o.texte || o.pt.texte}\nÀ mettre en réunion dans votre équipe (📌 Mettre en réunion), ou à répondre directement.`,
    choix: '',
    reponse: '',
    note: '',
    statut: 'envoye' as const,
    element: o.pt.element,
    niveau: c.niveau,
    transmis_par: '',
    prive: '1',
    pieces_jointes: '',
    point: o.ref,
    parent: '',
    espace: o.espace,
  }));
}

// ---- L4 / L5 · Demandes de l'enfant au parent (OK · Refuser) ----
export type DemandeParent = 'abandonner' | 'plus_suivre' | 'detacher';
export const TITRE_DEMANDE_PARENT = '🔗 Demande au parent ·';
export const CHOIX_DEMANDE_PARENT = ['OK', 'Refuser (motif)'];
const LIBELLE_DEMANDE: Record<DemandeParent, string> = { abandonner: 'Abandonner', plus_suivre: 'Ne plus suivre', detacher: 'Détacher' };
export const estDemandeParent = (e: Pick<Echange, 'titre'>) => e.titre.startsWith(TITRE_DEMANDE_PARENT);
/** « 🔗 Demande au parent · Abandonner · Préparer le gel des mises en production » */
export const titreDemandeParent = (d: DemandeParent, texte: string) => `${TITRE_DEMANDE_PARENT} ${LIBELLE_DEMANDE[d]} · ${texte}`.slice(0, 200);
export function lireDemandeParent(titre: string): DemandeParent | null {
  if (!titre.startsWith(TITRE_DEMANDE_PARENT)) return null;
  const l = titre.slice(TITRE_DEMANDE_PARENT.length).trim();
  return (Object.keys(LIBELLE_DEMANDE) as DemandeParent[]).find((d) => l.startsWith(LIBELLE_DEMANDE[d])) ?? null;
}

/** L4 · Le point est-il un enfant lié à un parent (communication ⤵ reçue et mise en réunion) ? Son échange, sinon undefined */
export const parentDe = (pt: Pick<PointReunion, 'echange'>, echanges: Echange[]) => (pt.echange ? echanges.find((e) => e.id === pt.echange && estCommunication(e)) : undefined);

/** L2 · Chez l'enfant : « 🔗 Lié au niveau du dessus » (il sait que c'est lié, pas à quoi) */
export const LIBELLE_LIE = '🔗 Lié au niveau du dessus';
