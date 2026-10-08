import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { type ACreer, type ChoixConcret, choixParDefaut, elementACreer, LIBELLE_TYPE_CREE, patchConcretise, type TypeCree } from '../../concretisation';
import type { HierarchyValue } from '../../hierarchyContext';
import {
  type ActionSuivi,
  appliquerPlan,
  enRetardSuivi,
  jourCourt,
  LIBELLE_STATUT,
  motifObligatoire,
  peutFaire,
  planSuivi,
  refPoint,
  roleEscalade,
  statutEffectif,
  TON_STATUT,
  validateurDe,
} from '../../pointsSuivi';
import { colors } from '../../theme';
import type { Echange, Item, PointReunion, StatutSuivi } from '../../types';
import type { ActionsDaily } from '../Daily';
import { FeuilleConcretiser, stylesFeuille as s } from './Concretiser';
import { Ligne, type Ton } from './ui';

type H = Pick<HierarchyValue, 'items' | 'featureList' | 'epicList' | 'objectifList' | 'objectifsPI' | 'resultats'>;

/** Ce que le Suivi d'une réunion sait de la réunion (vous, l'animateur, où écrire, comment créer) */
export interface CtxSuivi {
  espace: string;
  jour: string;
  moi: string;
  animateur: string;
  nomDe: (email: string) => string;
  h: H;
  items: Item[];
  echanges: Echange[];
  /** Niveau de l'Organisation de la réunion (« equipeagile:id »…), pour les messages */
  niveau: string;
  lecture: boolean;
  actions: ActionsDaily;
  /** Points modifiés (mise à jour de l'écran) */
  onPoints: (modifies: PointReunion[]) => void;
  /** Feuille Concrétiser (re-concrétiser) : personnes et contexte */
  concret: Omit<Parameters<typeof FeuilleConcretiser>[0], 'valeur' | 'onValider' | 'onFermer' | 'sous' | 'titre' | 'dessus'>;
  /** Échéance proposée (la prochaine réunion) */
  echeance: string;
  /** Ce que la re-concrétisation crée (espace, sprint, équipe…), voir elementACreer */
  ctxCreer: (pt: PointReunion) => Parameters<typeof elementACreer>[2];
  onInfo?: (t: string) => void;
}

/** Points de suivi (08/10) : concrétisés avec un statut, d'une réunion précédente de la série */
export const pointsDeSuivi = (points: PointReunion[], reunionId: string) => points.filter((p) => !!p.statut && p.reunion !== reunionId);

/** Statut affiché : celui du point (Fait si sa tâche est terminée) ; « Fait · réponse reçue » d'une escalade */
export function statutAffiche(p: PointReunion, items: Item[], jour: string): { s: StatutSuivi; texte: string; ton: Ton } {
  const st = statutEffectif(p, items);
  if (enRetardSuivi(p, st, jour)) return { s: st, texte: 'en retard', ton: 'orange' };
  if (!st) return { s: st, texte: '', ton: 'gris' };
  const texte = st === 'fait' && roleEscalade(p) === 'bas' ? 'Fait · réponse reçue' : st === 'valide' ? '✅ Validé' : LIBELLE_STATUT[st];
  return { s: st, texte, ton: TON_STATUT[st] };
}

/** Sous-titre en toutes lettres : « Tâche · Responsable : Emma Roy », « Réponse de Sara Martin : … », motif… */
export function sousSuivi(p: PointReunion, st: StatutSuivi, nomDe: (e: string) => string): string {
  const resp = p.responsable || p.personne;
  if (st === 'valide') return `${quoiSuivi(p)} · validé par ${nomDe(p.validateur || resp)}`;
  if ((st === 'fait' && roleEscalade(p) === 'bas') || ((st === 'a_reprendre' || st === 'abandonne') && p.note)) return p.note || '';
  return [quoiSuivi(p), `Responsable : ${nomDe(resp)}`, p.echeance ? `Échéance : ${jourCourt(p.echeance)}` : '', p.note && st === 'fait' ? p.note : ''].filter(Boolean).join(' · ');
}
const quoiSuivi = (p: PointReunion) =>
  p.concretisation === 'escalade' ? '⤴ Escaladé' : p.concretisation === 'suivi' ? '📌 Suivi' : p.type_cree ? LIBELLE_TYPE_CREE(p.type_cree as TypeCree) : p.concretisation === 'sous_tache' ? 'Sous-tâche' : 'Tâche';

/** Crée l'élément d'une re-concrétisation ; renvoie son id */
async function creerUn(a: ActionsDaily, espace: string, x: ACreer, niveau: string): Promise<string> {
  if (x.kind === 'item') return (await a.creerTaches(espace, [x.input]))[0]?.id ?? '';
  if (x.kind === 'feature') return a.creerEntites ? ((await a.creerEntites(espace, 'feature', [x.input]))[0]?.id ?? '') : '';
  return a.creerReunions ? ((await a.creerReunions(espace, [{ titre: x.titre, jour: x.jour, animateur: x.animateur, participants: x.participants, niveau }]))[0] ?? '') : '';
}

/**
 * Lignes du Suivi (Situation) : chaque point de suivi avec son statut (« en retard » en orange) ; le toucher ouvre sa
 * feuille (Fait pour le responsable ou l'animateur ; Valider · Re-concrétiser · À reprendre · Abandonner pour le
 * validateur). `aValider` : seulement ceux à valider par vous.
 */
export function LignesSuivi({ points, ctx, aValider, premiere = true }: { points: PointReunion[]; ctx: CtxSuivi; aValider?: boolean; premiere?: boolean }) {
  const [ouvert, setOuvert] = useState<PointReunion | null>(null);
  const [reconc, setReconc] = useState<PointReunion | null>(null);
  const liste = points
    .map((p) => ({ p, a: statutAffiche(p, ctx.items, ctx.jour) }))
    .filter((x) => !aValider || (x.a.s === 'fait' && validateurDe(x.p, ctx.animateur) === ctx.moi.toLowerCase()));
  const ecrire = async (pt: PointReunion, action: ActionSuivi, note: string) => {
    const plan = planSuivi({ pt, espace: ctx.espace, action, note, moi: ctx.moi, animateur: ctx.animateur, nomDe: ctx.nomDe, echanges: ctx.echanges, niveau: ctx.niveau });
    const modifies = await appliquerPlan(plan, ctx.actions);
    ctx.onPoints(modifies.filter((x) => x.espace === ctx.espace));
    const autres = plan.points.filter((x) => x.espace !== ctx.espace).length;
    ctx.onInfo?.(
      `« ${pt.texte} » : ${action === 'valider' ? 'validé' : action === 'reprendre' ? 'à reprendre' : action === 'abandonner' ? 'abandonné' : action === 'fait' ? 'fait' : 'en cours'}` +
        (plan.envoyer.length ? ` · ${plan.envoyer.length} message${plan.envoyer.length > 1 ? 's' : ''} dans le Chat` : '') +
        (autres ? ' · l’autre niveau de l’escalade est mis à jour' : '') +
        '.',
    );
  };
  return (
    <>
      {liste.map(({ p, a }, i) => (
        <Ligne key={p.id} premiere={premiere && i === 0} texte={p.texte} sous={sousSuivi(p, a.s, ctx.nomDe)} pastille={a.texte ? { texte: a.texte, ton: a.ton } : undefined} onOuvrir={ctx.lecture ? undefined : () => setOuvert(p)} />
      ))}
      {ouvert && (
        <FeuilleSuivi
          pt={ouvert}
          ctx={ctx}
          onFermer={() => setOuvert(null)}
          onEnregistrer={async (action, note) => {
            await ecrire(ouvert, action, note);
            setOuvert(null);
          }}
          onReconcretiser={() => {
            setReconc(ouvert);
            setOuvert(null);
          }}
        />
      )}
      {reconc && (
        <FeuilleConcretiser
          titre="Re-concrétiser"
          sous={`« ${reconc.texte} »${reconc.note ? ` · ${reconc.note}` : ''}`}
          valeur={{ ...choixParDefaut({ ...reconc, type: 'action', responsable: reconc.responsable }, { animateur: ctx.animateur, echeance: ctx.echeance, h: ctx.h, moi: ctx.moi }), valid: validateurDe(reconc, ctx.animateur) }}
          dessus={[]}
          {...ctx.concret}
          onFermer={() => setReconc(null)}
          onValider={async (c: ChoixConcret) => {
            const pt = reconc;
            setReconc(null);
            try {
              const lien = c.que === 'creer' ? await creerUn(ctx.actions, ctx.espace, elementACreer(c, pt, ctx.ctxCreer(pt)), ctx.niveau) : c.que === 'suivre' ? pt.tache : '';
              const patch = { id: pt.id, ...patchConcretise(c, lien), note: '', ...(c.que === 'rien' ? { statut: 'valide' as const } : {}) };
              const { modifies } = await ctx.actions.ecrirePoints(ctx.espace, [], [patch], []);
              // Les « Valider ? » encore ouverts sur ce point sont réglés : le point repart
              const ref = refPoint(ctx.espace, pt.id);
              const ouvertes = ctx.echanges.filter((e) => e.type === 'question' && e.statut === 'envoye' && !!e.point && (e.point === ref || e.point.startsWith(`${ref}|`)));
              if (ouvertes.length && ctx.actions.modifierEchanges) await ctx.actions.modifierEchanges(ouvertes.map((e) => ({ e, patch: { statut: 'pris_en_compte' as const, reponse: 'Re-concrétiser', note: '' } })));
              ctx.onPoints(modifies.map((x) => ({ ...x, espace: ctx.espace })));
              ctx.onInfo?.(`« ${pt.texte} » re-concrétisé${c.que === 'creer' ? ` : ${LIBELLE_TYPE_CREE(c.type).toLowerCase()} « ${c.titre} » créé` : ''}.`);
            } catch (e) {
              ctx.onInfo?.((e as Error).message);
            }
          }}
        />
      )}
    </>
  );
}

/**
 * Feuille d'un point de suivi (maquette escalade-retour, écran 5) : Statut (En cours · Fait), un mot, et pour le
 * validateur : Valider · Re-concrétiser · À reprendre (motif) · Abandonner (motif).
 */
function FeuilleSuivi({ pt, ctx, onEnregistrer, onReconcretiser, onFermer }: { pt: PointReunion; ctx: CtxSuivi; onEnregistrer: (a: ActionSuivi, note: string) => Promise<void>; onReconcretiser: () => void; onFermer: () => void }) {
  const st = statutEffectif(pt, ctx.items);
  const fini = st === 'valide' || st === 'abandonne';
  const faire = peutFaire(pt, ctx.moi, ctx.animateur) && !fini;
  const valideur = validateurDe(pt, ctx.animateur) === ctx.moi.toLowerCase();
  const [statut, setStatut] = useState<'en_cours' | 'fait'>(st === 'fait' ? 'fait' : 'en_cours');
  const [decision, setDecision] = useState<ActionSuivi | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');
  const motif = motifObligatoire(decision || null);
  const action: ActionSuivi | '' = decision || (statut !== (st === 'fait' ? 'fait' : 'en_cours') || note.trim() ? statut : '');
  const pret = !!action && (!motif || !!note.trim()) && !busy;
  const role = roleEscalade(pt);
  const puces = <T extends string>(options: { v: T; l: string }[], value: T | '', onChange: (v: T) => void) => (
    <View style={s.puces}>
      {options.map((o) => (
        <Pressable key={o.v} onPress={() => onChange(o.v)} style={[s.puce, o.v === value && s.puceOn]} accessibilityRole="radio" accessibilityState={{ selected: o.v === value }}>
          <Text style={[s.puceTexte, o.v === value && s.puceTexteOn]}>{o.l}</Text>
        </Pressable>
      ))}
    </View>
  );
  const origine = [
    role === 'haut' ? 'Suivi reçu par escalade' : role === 'bas' ? 'Escaladé au niveau du dessus' : quoiSuivi(pt),
    `Responsable : ${ctx.nomDe(pt.responsable || pt.personne)}`,
    `Validation : ${ctx.nomDe(validateurDe(pt, ctx.animateur))}`,
    pt.echeance ? `Échéance : ${jourCourt(pt.echeance)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFermer}>
      <View style={s.fond}>
        <View style={s.feuille}>
          <View style={s.poignee} />
          <View style={s.entete}>
            <Pressable onPress={onFermer} hitSlop={8} style={s.cote} accessibilityRole="button">
              <Text style={s.annuler}>Annuler</Text>
            </Pressable>
            <Text style={s.titre} numberOfLines={1}>
              {pt.texte}
            </Text>
            <View style={s.cote} />
          </View>
          <Text style={s.sousTitre}>{origine}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
            {!!pt.note && (
              <>
                <Text style={s.section}>{role === 'bas' && st === 'fait' ? 'RÉPONSE' : 'DERNIER MOT'}</Text>
                <View style={[s.carte, s.ligne]}>
                  <Text style={{ flex: 1, fontSize: 14.5, color: colors.text }}>{pt.note}</Text>
                </View>
              </>
            )}
            <Text style={s.section}>STATUT</Text>
            <View style={s.carte}>
              {fini ? (
                <View style={s.ligne}>
                  <Text style={s.valeur}>{st === 'valide' ? '✅ Validé' : '⊘ Abandonné'}</Text>
                </View>
              ) : faire ? (
                puces<'en_cours' | 'fait'>(
                  [
                    { v: 'en_cours', l: '🔵 En cours' },
                    { v: 'fait', l: '🟢 Fait' },
                  ],
                  decision ? '' : statut,
                  (v) => {
                    setStatut(v);
                    setDecision('');
                  },
                )
              ) : (
                <View style={s.ligne}>
                  <Text style={s.valeur}>{LIBELLE_STATUT[st || 'en_cours']}</Text>
                  <Text style={{ fontSize: 12.5, color: colors.muted }}>le responsable ou l’animateur le passe à Fait</Text>
                </View>
              )}
            </View>
            {valideur && !fini && (
              <>
                <Text style={s.section}>VALIDATION (VOUS)</Text>
                <View style={s.carte}>
                  {puces<ActionSuivi>(
                    [
                      { v: 'valider', l: '✅ Valider' },
                      { v: 'reconcretiser', l: '✎ Re-concrétiser' },
                      { v: 'reprendre', l: '↩ À reprendre' },
                      { v: 'abandonner', l: '⊘ Abandonner' },
                    ],
                    decision,
                    (v) => setDecision(v === decision ? '' : v),
                  )}
                </View>
                {role === 'haut' && (decision === 'valider' || decision === 'abandonner') && (
                  <Text style={[s.sousTitre, { paddingTop: 6 }]}>Validé ici → le point du niveau du dessous passe à « Fait · réponse reçue », et son validateur reçoit « Valider ? » dans le Chat.</Text>
                )}
              </>
            )}
            {decision !== 'reconcretiser' && !fini && (
              <>
                <Text style={s.section}>{motif ? 'MOTIF (OBLIGATOIRE)' : role === 'haut' && decision === 'valider' ? 'RÉPONSE (REDESCEND AU NIVEAU DU DESSOUS)' : 'UN MOT'}</Text>
                <View style={[s.carte, s.ligne]}>
                  <TextInput value={note} onChangeText={setNote} multiline placeholder={motif ? 'Pourquoi ?' : 'Facultatif'} placeholderTextColor={colors.muted} style={[s.input, { fontWeight: '400', minHeight: 40 }]} />
                </View>
              </>
            )}
            {!!erreur && <Text style={s.erreur}>{erreur}</Text>}
          </ScrollView>
          {!fini && (
            <Pressable
              disabled={decision === 'reconcretiser' ? false : !pret}
              onPress={async () => {
                if (decision === 'reconcretiser') return onReconcretiser();
                if (!action) return;
                setBusy(true);
                setErreur('');
                try {
                  await onEnregistrer(action, note);
                } catch (e) {
                  setErreur((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              style={[s.bouton, decision !== 'reconcretiser' && !pret && s.inactif]}
              accessibilityRole="button"
            >
              <Text style={s.boutonTexte}>{decision === 'reconcretiser' ? 'Re-concrétiser…' : busy ? 'Enregistrement…' : 'Enregistrer'}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
