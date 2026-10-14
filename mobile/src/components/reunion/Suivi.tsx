import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { type ACreer, type ChoixConcret, choixParDefaut, elementACreer, LIBELLE_TYPE_CREE, patchConcretise, type TypeCree } from '../../concretisation';
import type { HierarchyValue } from '../../hierarchyContext';
import {
  type ActionSuivi,
  appliquerPlan,
  enRetardSuivi,
  jourCourt,
  estFini,
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
  /** Changements d'un suivi depuis la réunion précédente (14/10, même affichage que l'arbre des éléments) */
  changements?: (p: PointReunion) => { point: boolean; lignes: string[]; garder: boolean };
}

/**
 * Points de suivi (08/10) : concrétisés avec un statut, d'une réunion précédente de la série, ou du jour (note suivie
 * depuis le Chat, « 📌 Suivre à », ou concrétisée à un compte rendu déjà envoyé)
 */
export const pointsDeSuivi = (points: PointReunion[], reunionId: string) => points.filter((p) => !!p.statut && p.reunion <= reunionId);

/** Statut affiché : celui du point (Fait si sa tâche est terminée) ; « Fait · réponse reçue » d'une escalade */
export function statutAffiche(p: PointReunion, items: Item[], jour: string): { s: StatutSuivi; texte: string; ton: Ton } {
  const st = statutEffectif(p, items);
  if (enRetardSuivi(p, st, jour)) return { s: st, texte: 'en retard', ton: 'orange' };
  if (!st) return { s: st, texte: '', ton: 'gris' };
  const texte = st === 'fait' && roleEscalade(p) === 'bas' ? 'Fait · réponse reçue' : st === 'valide' ? '✅ Validé' : LIBELLE_STATUT[st];
  return { s: st, texte, ton: TON_STATUT[st] };
}

/** Sous-titre en toutes lettres : « Tâche · Responsable : Emma Roy », « Réponse de Sara Martin : … », motif… */
export function sousSuivi(p: PointReunion, st: StatutSuivi, nomDe: (e: string) => string, echanges?: Echange[]): string {
  const base = sousSuiviSansLien(p, st, nomDe);
  return echanges && p.echange ? [base, lienPrive(p, echanges, nomDe)].filter(Boolean).join(' · ') : base;
}
/**
 * Note liée à un message du Chat (validation du 08/10) : les noms sont visibles, pas le contenu ; le message disparu,
 * la note reste avec « 🔒 Échange privé terminé »
 */
export function lienPrive(p: Pick<PointReunion, 'echange'>, echanges: Echange[], nomDe: (e: string) => string): string {
  if (!p.echange) return '';
  const e = echanges.find((x) => x.id === p.echange);
  return e ? `🔒 Échange privé · ${nomDe(e.de)} → ${nomDe(e.a)}` : '🔒 Échange privé terminé';
}
function sousSuiviSansLien(p: PointReunion, st: StatutSuivi, nomDe: (e: string) => string): string {
  const resp = p.responsable || p.personne;
  if (st === 'valide') return `${quoiSuivi(p)} · validé par ${nomDe(p.validateur || resp)}`;
  if ((st === 'fait' && roleEscalade(p) === 'bas') || ((st === 'a_reprendre' || st === 'abandonne') && p.note)) return p.note || '';
  return [quoiSuivi(p), `Responsable : ${nomDe(resp)}`, p.validateur ? `Validation : ${nomDe(p.validateur)}` : '', p.echeance ? `Échéance : ${jourCourt(p.echeance)}` : '', p.note && st === 'fait' ? p.note : ''].filter(Boolean).join(' · ');
}
const quoiSuivi = (p: PointReunion) =>
  p.concretisation === 'escalade' ? '📌 Suivi · ↪ Transmis' : p.concretisation === 'suivi' ? '📌 Suivi' : p.type_cree ? LIBELLE_TYPE_CREE(p.type_cree as TypeCree) : p.concretisation === 'sous_tache' ? 'Sous-tâche' : 'Tâche';

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
/**
 * Chemin d'un élément pour la case « Arborescence » des suivis (14/10) : « 🗂️ Epic › 🧩 Feature › 📖 Story » ;
 * '' si le suivi n'est rattaché à rien
 */
export function cheminElement(id: string, h: H): string {
  if (!id) return '';
  const t = h.items.find((x) => x.id === id);
  const f = h.featureList.find((x) => x.id === (t ? t.feature : id));
  const e = h.epicList.find((x) => x.id === (t ? t.epic || f?.epic : f ? f.epic : id));
  const parent = t?.parent ? h.items.find((x) => x.id === t.parent) : undefined;
  const morceaux = [e && `🗂️ ${e.titre}`, f && `🧩 ${f.titre}`, parent && `📖 ${parent.titre}`, t && `${t.type === 'story' ? '📖 ' : ''}${t.titre}`].filter(Boolean);
  return morceaux.join(' › ');
}

export function LignesSuivi({ points, ctx, aValider, premiere = true, notes = [], parElement }: { points: PointReunion[]; ctx: CtxSuivi; aValider?: boolean; premiere?: boolean; notes?: PointReunion[]; parElement?: boolean }) {
  const [ouvert, setOuvert] = useState<PointReunion | null>(null);
  const [reconc, setReconc] = useState<PointReunion | null>(null);
  // Notes pas encore concrétisées (mode Simple : même feuille, écrite tout de suite)
  const [conc, setConc] = useState<PointReunion | null>(null);
  const liste = points
    .map((p) => ({ p, a: statutAffiche(p, ctx.items, ctx.jour) }))
    .filter((x) => !aValider || (x.a.s === 'fait' && validateurDe(x.p, ctx.animateur) === ctx.moi.toLowerCase()))
    .filter((x) => !ctx.changements || ctx.changements(x.p).garder);
  const ecrire = async (pt: PointReunion, action: ActionSuivi, note: string) => {
    const plan = planSuivi({ pt, espace: ctx.espace, action, note, moi: ctx.moi, animateur: ctx.animateur, nomDe: ctx.nomDe, echanges: ctx.echanges, niveau: ctx.niveau });
    const modifies = await appliquerPlan(plan, ctx.actions);
    ctx.onPoints(modifies.filter((x) => x.espace === ctx.espace));
    const autres = plan.points.filter((x) => x.espace !== ctx.espace).length;
    ctx.onInfo?.(
      `« ${pt.texte} » : ${action === 'valider' ? 'validé' : action === 'reprendre' ? 'à reprendre' : action === 'abandonner' ? 'abandonné' : action === 'plus_suivre' ? 'plus suivi (l’élément lié continue)' : action === 'fait' ? 'fait' : 'en cours'}` +
        (plan.envoyer.length ? ` · ${plan.envoyer.length} message${plan.envoyer.length > 1 ? 's' : ''} dans le Chat` : '') +
        (autres ? ' · l’autre maillon de la transmission est mis à jour' : '') +
        '.',
    );
  };
  return (
    <>
      {(parElement ? [...liste].sort((x, y) => cheminElement(x.p.element, ctx.h).localeCompare(cheminElement(y.p.element, ctx.h)) || 0) : liste).map(({ p, a }, i, l) => (
        <View key={p.id}>
          {/* Arborescence (14/10) : un titre de groupe par élément concerné, puis ses suivis */}
          {parElement && (i === 0 || cheminElement(l[i - 1].p.element, ctx.h) !== cheminElement(p.element, ctx.h)) && (
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.muted, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 }}>{cheminElement(p.element, ctx.h) || 'Sans élément'}</Text>
          )}
        <Ligne premiere={premiere && i === 0 && !parElement} texte={p.texte} sous={sousSuivi(p, a.s, ctx.nomDe, ctx.echanges)} pastille={a.texte ? { texte: a.texte, ton: a.ton } : undefined} onOuvrir={ctx.lecture ? undefined : () => setOuvert(p)} point={ctx.changements?.(p).point} changements={ctx.changements?.(p).lignes} />
        </View>
      ))}
      {!aValider &&
        notes.map((p, i) => (
          <Ligne
            key={p.id}
            premiere={premiere && !liste.length && i === 0}
            texte={p.texte}
            sous={[`📝 Note à concrétiser · notée le ${jourCourt(p.reunion.slice(-10))}`, lienPrive(p, ctx.echanges, ctx.nomDe)].filter(Boolean).join(' · ')}
            pastille={{ texte: 'Concrétiser ›', ton: 'bleu' }}
            onOuvrir={ctx.lecture ? undefined : () => setConc(p)}
          />
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
      {(reconc || conc) && (
        <FeuilleConcretiser
          titre={reconc ? 'Re-concrétiser' : 'Concrétiser'}
          sous={`« ${(reconc ?? conc)!.texte} »${reconc?.note ? ` · ${reconc.note}` : ''}`}
          valeur={
            reconc
              ? { ...choixParDefaut({ ...reconc, type: 'action', responsable: reconc.responsable }, { animateur: ctx.animateur, echeance: ctx.echeance, h: ctx.h, moi: ctx.moi }), valid: validateurDe(reconc, ctx.animateur) }
              : choixParDefaut(conc!, { animateur: ctx.animateur, echeance: ctx.echeance, h: ctx.h, moi: ctx.moi })
          }
          dessus={[]}
          {...ctx.concret}
          onFermer={() => (setReconc(null), setConc(null))}
          onValider={async (c: ChoixConcret) => {
            const pt = (reconc ?? conc)!;
            const re = !!reconc;
            setReconc(null);
            setConc(null);
            try {
              const lien = c.que === 'creer' ? await creerUn(ctx.actions, ctx.espace, elementACreer(c, pt, ctx.ctxCreer(pt)), ctx.niveau) : c.que === 'suivre' ? pt.tache : '';
              const patch = { id: pt.id, ...patchConcretise(c, lien), note: '', ...(c.que === 'rien' ? { statut: 'valide' as const } : {}) };
              const { modifies } = await ctx.actions.ecrirePoints(ctx.espace, [], [patch], []);
              // Les rappels encore ouverts sur ce point sont réglés : le point repart
              const ref = refPoint(ctx.espace, pt.id);
              const ouvertes = ctx.echanges.filter((e) => e.statut === 'envoye' && !!e.point && (e.point === ref || e.point.startsWith(`${ref}|`)));
              if (ouvertes.length && ctx.actions.modifierEchanges) await ctx.actions.modifierEchanges(ouvertes.map((e) => ({ e, patch: { statut: 'pris_en_compte' as const, reponse: 'Re-concrétiser', note: '' } })));
              ctx.onPoints(modifies.map((x) => ({ ...x, espace: ctx.espace })));
              ctx.onInfo?.(`« ${pt.texte} » ${re ? 're-concrétisé' : 'concrétisé'}${c.que === 'creer' ? ` : ${LIBELLE_TYPE_CREE(c.type).toLowerCase()} « ${c.titre} » créé` : ''}.`);
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
  const fini = estFini(st);
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
    role === 'haut' ? 'Suivi reçu par transmission' : role === 'bas' ? 'Transmis à un autre niveau' : quoiSuivi(pt),
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
            <View style={{ flex: 1 }} />
            <View style={s.cote} />
          </View>
          {/* Titre en entier, sur plusieurs lignes si besoin (validation du 08/10) */}
          <Text style={[s.titre, { paddingHorizontal: 16, paddingTop: 6 }]}>{pt.texte}</Text>
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
                  <Text style={s.valeur}>{st === 'valide' ? '✅ Validé' : st === 'plus_suivi' ? '👁 Plus suivi' : '⊘ Abandonné'}</Text>
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
                      { v: 'plus_suivre', l: '👁 Ne plus suivre' },
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

/**
 * Suivis d'une réunion répartis (validé le 09/10) : ouverts ; fermés (validés, abandonnés : filtre « Fermées »,
 * gardés jusqu'à leur suppression) ; décidés depuis le Chat (« hors réunion »), mis en avant jusqu'à « Confirmer ».
 */
export function repartirSuivis(points: PointReunion[]) {
  const ferme = (x: PointReunion) => estFini(x.statut);
  return {
    horsReunion: points.filter((x) => x.hors_reunion === '1'),
    fermees: points.filter((x) => ferme(x) && x.hors_reunion !== '1'),
    ouverts: points.filter((x) => !ferme(x) && x.hors_reunion !== '1'),
  };
}

/** Suivis décidés hors réunion : en tête de la Situation, « Confirmer » (l'animateur) les range */
export function BlocHorsReunion({ points, ctx, peutConfirmer }: { points: PointReunion[]; ctx: CtxSuivi; peutConfirmer: boolean }) {
  const confirmer = async (x: PointReunion) => {
    const { modifies } = await ctx.actions.ecrirePoints(ctx.espace, [], [{ id: x.id, hors_reunion: '2' }], []);
    ctx.onPoints(modifies);
  };
  return (
    <>
      {points.map((x, i) => (
        <View key={x.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : undefined}>
          <Ligne
            premiere
            texte={x.texte}
            sous={`Décidé hors réunion (depuis le Chat) · ${x.statut === 'valide' ? '✅ validé' : x.statut === 'abandonne' ? '⊘ abandonné' : x.statut === 'plus_suivi' ? '👁 plus suivi' : '↩ à reprendre'}${x.note ? ` · ${x.note}` : ''}${x.validateur ? ` · par ${ctx.nomDe(x.validateur)}` : ''}`}
            pastille={{ texte: 'Décidé hors réunion', ton: 'orange' }}
          />
          {peutConfirmer && (
            <Pressable onPress={() => void confirmer(x)} style={{ alignSelf: 'flex-start', marginLeft: 14, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.primary }} accessibilityRole="button">
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Confirmer</Text>
            </Pressable>
          )}
        </View>
      ))}
    </>
  );
}
