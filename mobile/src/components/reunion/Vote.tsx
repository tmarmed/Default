import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { VoteEtat } from '../../etatReunion';
import { colors } from '../../theme';
import { SectionFiche } from '../Choix';
import { prenom, type R } from './base';
import { Pastilles, st as stUi, Vide } from './ui';

/**
 * Bloc de vote commun (07/10) : un seul bloc, partout ; seul le contenu change (poker 1, 2, 3, 5, 8, 13, ? ; confiance
 * 1 à 5 ; étoiles ; points). Mécanique :
 * - l'animateur ouvre le vote (compteur « x sur y ont voté »), révèle, relance ou retient sans voter ;
 * - votes cachés jusqu'à la révélation ; chacun vote pour lui-même ; voter avant la séance est facultatif (son vote
 *   préparé est montré : le garder ou le changer) ;
 * - après la révélation, toujours 3 choix : Retenir (valeur choisie par l'animateur, présélectionnée seulement si
 *   tout le monde est d'accord) · Nouveau tour · Reporter.
 */
export const CARTES_POKER = ['1', '2', '3', '5', '8', '13', '?'];
export const CARTES_CONFIANCE = ['1', '2', '3', '4', '5'];
export type ChoixVote = 'retenir' | 'tour' | 'reporter';
export interface DecisionVote {
  choix: ChoixVote;
  val?: string;
}

/** Les votes d'un élément pour un tour : e-mail → valeur */
export function votesDe(r: R, el: string, tour: number) {
  const m = new Map<string, string>();
  for (const { p, v } of r.votes) if (v.el === el && v.tour === tour) m.set(p.personne, v.val);
  return m;
}
/** Accord (tous la même valeur) ou écart */
export function lectureVotes(vals: string[]) {
  const u = [...new Set(vals)];
  if (!vals.length) return { accord: false, texte: 'aucun vote' };
  if (u.length === 1) return { accord: true, texte: `accord · ${u[0]}`, valeur: u[0] };
  const num = vals.map(Number).filter((x) => !Number.isNaN(x));
  return { accord: false, texte: num.length ? `écart ${Math.min(...num)}–${Math.max(...num)}` : 'écart' };
}

/** Cartes à toucher */
export function Cartes({ valeurs, value, onChange, disabled }: { valeurs: string[]; value: string; onChange?: (v: string) => void; disabled?: boolean }) {
  return (
    <View style={s.cartes}>
      {valeurs.map((v) => (
        <Pressable key={v} disabled={disabled || !onChange} onPress={() => onChange?.(v === value ? '' : v)} style={[s.carte, v === value && s.carteOn]} accessibilityRole="radio" accessibilityState={{ selected: v === value }}>
          <Text style={[s.carteTexte, v === value && s.carteTexteOn]}>{v}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Bouton secondaire du bloc */
function Bt({ texte, onPress }: { texte: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.bt} accessibilityRole="button">
      <Text style={s.btTexte}>{texte}</Text>
    </Pressable>
  );
}

/**
 * Vote d'un élément chez l'animateur : à ouvrir · ouvert · révélé (3 choix). `vote` : l'état du vote publié ;
 * `decision` : ce que l'animateur a déjà retenu pour cet élément.
 */
export function VoteAnimateur({
  r,
  el,
  titre = '🃏 Vote de cette story',
  valeurs,
  vote,
  decision,
  lecture,
  onVote,
  onDecision,
}: {
  r: R;
  el: string;
  titre?: string;
  valeurs: string[];
  vote?: VoteEtat;
  decision?: DecisionVote;
  lecture?: boolean;
  onVote: (v: VoteEtat | undefined) => void;
  onDecision: (d: DecisionVote | undefined) => void;
}) {
  const votants = r.e.personnes.map((x) => x.email.toLowerCase());
  const tour = vote?.elements.includes(el) ? vote.tour : 1;
  const prepares = votesDe(r, el, tour);
  const ouvert = !!vote && vote.elements.includes(el) && vote.ouvert;
  const revele = !!vote && vote.elements.includes(el) && vote.revele;
  const nb = votants.filter((m) => prepares.has(m)).length;
  const lecteur = lectureVotes([...prepares.values()]);
  const [valeur, setValeur] = useState(decision?.val ?? '');
  if (decision?.choix === 'retenir')
    return (
      <SectionFiche titre={titre}>
        <View style={stUi.ligne}>
          <View style={stUi.corps}>
            <Text style={stUi.texte}>✓ Retenu : {decision.val || 'sans valeur'}</Text>
            <Text style={stUi.sous}>{revele ? lecteur.texte : 'sans vote'}</Text>
          </View>
          {!lecture && <Bt texte="Modifier" onPress={() => onDecision(undefined)} />}
        </View>
      </SectionFiche>
    );
  if (decision?.choix === 'reporter')
    return (
      <SectionFiche titre={titre}>
        <View style={stUi.ligne}>
          <View style={stUi.corps}>
            <Text style={stUi.texte}>⏭ Reportée : à reprendre</Text>
          </View>
          {!lecture && <Bt texte="↩ Revenir" onPress={() => onDecision(undefined)} />}
        </View>
      </SectionFiche>
    );
  if (!ouvert && !revele)
    return (
      <SectionFiche titre={titre}>
        <View style={stUi.ligne}>
          <View style={stUi.corps}>
            <Text style={stUi.texte}>{nb === votants.length && nb > 0 ? 'Tout le monde a déjà voté en préparation' : 'Pas encore ouvert'}</Text>
            <Text style={stUi.sous}>{`${nb} vote${nb > 1 ? 's' : ''} préparé${nb > 1 ? 's' : ''} sur ${votants.length}`}</Text>
          </View>
        </View>
        {!lecture && (
          <View style={s.boutons}>
            {nb === votants.length && nb > 0 ? (
              <Bt texte="🃏 Révéler tout de suite" onPress={() => onVote({ ouvert: false, revele: true, tour, elements: [el] })} />
            ) : (
              <Bt texte="🃏 Ouvrir le vote" onPress={() => onVote({ ouvert: true, revele: false, tour, elements: [el] })} />
            )}
            <Bt texte="✓ Retenir sans voter" onPress={() => onDecision({ choix: 'retenir', val: '' })} />
          </View>
        )}
      </SectionFiche>
    );
  if (ouvert)
    return (
      <SectionFiche titre={titre}>
        <View style={stUi.ligne}>
          <View style={stUi.corps}>
            <Text style={stUi.texte}>{`${nb} sur ${votants.length} ont voté`}</Text>
            <Text style={stUi.sous}>{votants.filter((m) => !prepares.has(m)).map((m) => prenom(r.e.nomDe(m))).join(', ') || 'tout le monde a voté'}</Text>
          </View>
        </View>
        <View style={s.jauge}>
          <View style={[s.jaugeIn, { width: `${Math.round((100 * nb) / Math.max(1, votants.length))}%` }]} />
        </View>
        {!lecture && (
          <View style={s.boutons}>
            <Bt texte="🃏 Révéler les votes" onPress={() => onVote({ ...vote!, ouvert: false, revele: true })} />
            <Bt texte="🔁 Relancer le vote" onPress={() => onVote({ ...vote!, tour: vote!.tour + 1 })} />
          </View>
        )}
      </SectionFiche>
    );
  // Révélé : toujours le même écran, 3 choix
  const preselection = lecteur.accord ? (lecteur.valeur ?? '') : '';
  return (
    <SectionFiche titre={titre}>
      <View style={stUi.ligne}>
        <View style={stUi.corps}>
          <Text style={stUi.texte}>Votes révélés · tour {tour}</Text>
          <Text style={stUi.sous}>{[...prepares.entries()].map(([m, v]) => `${prenom(r.e.nomDe(m))} ${v}`).join(' · ') || 'aucun vote'}</Text>
        </View>
        <View style={[s.tag, lecteur.accord ? s.tagVert : s.tagOrange]}>
          <Text style={[s.tagTexte, lecteur.accord ? s.tagTexteVert : s.tagTexteOrange]}>{lecteur.texte}</Text>
        </View>
      </View>
      {!lecture && (
        <>
          <View style={s.choix3}>
            <Text style={stUi.sous}>{lecteur.accord ? 'Tous d’accord : valeur présélectionnée, modifiable.' : 'Écart : rien n’est présélectionné ; on discute, puis un des 3 choix.'}</Text>
            <Cartes valeurs={valeurs} value={valeur || preselection} onChange={setValeur} />
          </View>
          <View style={s.boutons}>
            <Bt texte={`✓ Retenir${valeur || preselection ? ` ${valeur || preselection}` : ''}`} onPress={() => (valeur || preselection) && onDecision({ choix: 'retenir', val: valeur || preselection })} />
            <Bt texte="🔁 Nouveau tour" onPress={() => onVote({ ouvert: true, revele: false, tour: tour + 1, elements: [el] })} />
            <Bt texte="⏭ Reporter" onPress={() => onDecision({ choix: 'reporter' })} />
          </View>
        </>
      )}
    </SectionFiche>
  );
}

/** Vote d'un élément chez le participant : son vote préparé (facultatif), puis le vote ouvert par l'animateur */
export function VoteParticipant({ r, el, titre = '🃏 Votre vote', valeurs, vote, animateur }: { r: R; el: string; titre?: string; valeurs: string[]; vote?: VoteEtat; animateur: string }) {
  const ouvert = !!vote && vote.elements.includes(el) && vote.ouvert;
  const revele = !!vote && vote.elements.includes(el) && vote.revele;
  const tour = vote?.elements.includes(el) ? vote.tour : 1;
  const mien = votesDe(r, el, tour).get(r.mail) ?? '';
  const [envoi, setEnvoi] = useState(false);
  const poser = async (v: string) => {
    setEnvoi(true);
    try {
      await r.voter(el, v, tour);
    } finally {
      setEnvoi(false);
    }
  };
  if (revele) {
    const tous = votesDe(r, el, tour);
    return (
      <SectionFiche titre={titre}>
        <View style={stUi.ligne}>
          <View style={stUi.corps}>
            <Text style={stUi.texte}>Votes révélés</Text>
            <Text style={stUi.sous}>{[...tous.entries()].map(([m, v]) => `${prenom(r.e.nomDe(m))} ${v}`).join(' · ')}</Text>
          </View>
        </View>
      </SectionFiche>
    );
  }
  return (
    <SectionFiche titre={titre}>
      <View style={s.choix3}>
        <Text style={stUi.sous}>
          {ouvert
            ? `Vote ouvert par ${animateur}${tour > 1 ? ` · tour ${tour}` : ''} : votre vote reste caché jusqu’à la révélation.`
            : mien
              ? 'Votre vote préparé : gardez-le ou changez-le ; le vote se fait en séance.'
              : `Aucun vote ouvert : ${animateur} l’ouvre en séance. Voter avant est facultatif.`}
        </Text>
        <Cartes valeurs={valeurs} value={mien} onChange={(v) => !envoi && poser(v)} disabled={envoi} />
        {envoi && <Text style={stUi.sous}>Envoi…</Text>}
      </View>
    </SectionFiche>
  );
}

/** Étoiles : 1 par élément, `total` au plus ; participant ; « Envoyer mes votes » écrit tout en une fois */
export function VoteEtoiles({ r, elements, vote, animateur, total = 3 }: { r: R; elements: { id: string; texte: string; sous?: string }[]; vote?: VoteEtat; animateur: string; total?: number }) {
  const ouvert = !!vote && vote.ouvert;
  const tour = vote?.tour ?? 1;
  const mes = new Set(elements.filter((x) => votesDe(r, x.id, tour).get(r.mail)).map((x) => x.id));
  const [choix, setChoix] = useState<Set<string> | null>(null);
  const sel = choix ?? mes;
  const reste = total - sel.size;
  const [envoi, setEnvoi] = useState(false);
  if (!ouvert)
    return (
      <SectionFiche titre="🗳️ Vote">
        <Vide texte={vote?.revele ? 'Votes révélés : voir l’écran de l’animateur.' : `Aucun vote ouvert : ${animateur} l’ouvre en séance.`} />
      </SectionFiche>
    );
  const basculer = (id: string) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else if (n.size < total) n.add(id);
    setChoix(n);
  };
  const envoyer = async () => {
    setEnvoi(true);
    try {
      await r.voterLot(elements.map((x) => ({ el: x.id, val: sel.has(x.id) ? '1' : '' })), tour);
      setChoix(null);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <SectionFiche titre={`Touchez ☆ pour voter · ★ ${reste} restante${reste > 1 ? 's' : ''}`}>
      {elements.map((x, i) => (
        <Pressable key={x.id} onPress={() => basculer(x.id)} style={[stUi.ligne, i > 0 && stUi.bord]} accessibilityRole="checkbox" accessibilityState={{ checked: sel.has(x.id) }}>
          <View style={stUi.corps}>
            <Text style={stUi.texte}>{x.texte}</Text>
            {!!x.sous && <Text style={stUi.sous}>{x.sous}</Text>}
          </View>
          <Text style={[s.etoile, sel.has(x.id) && s.etoileOn]}>{sel.has(x.id) ? '★' : '☆'}</Text>
        </Pressable>
      ))}
      <View style={s.boutons}>
        <Bt texte={envoi ? 'Envoi…' : choix ? 'Envoyer mes votes' : mes.size ? '✓ Votes envoyés' : 'Envoyer mes votes'} onPress={() => !envoi && envoyer()} />
      </View>
    </SectionFiche>
  );
}

/** Choix en pastilles réutilisé (ex. Garder / Changer) */
export { Pastilles };

const s = StyleSheet.create({
  cartes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  carte: { minWidth: 40, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center' },
  carteOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  carteTexte: { fontSize: 15, fontWeight: '800', color: colors.text },
  carteTexteOn: { color: '#fff' },
  boutons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  bt: { borderWidth: 1, borderColor: colors.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  btTexte: { color: colors.primary, fontWeight: '700', fontSize: 13.5 },
  jauge: { height: 6, borderRadius: 3, backgroundColor: '#E6EAF0', marginHorizontal: 14, marginBottom: 10, overflow: 'hidden' },
  jaugeIn: { height: 6, backgroundColor: colors.primary },
  choix3: { paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  tagVert: { backgroundColor: '#E6F4EA' },
  tagOrange: { backgroundColor: '#FEF3E2' },
  tagTexte: { fontSize: 12, fontWeight: '700' },
  tagTexteVert: { color: '#137333' },
  tagTexteOrange: { color: '#B45309' },
  etoile: { fontSize: 24, color: '#C9CED6' },
  etoileOn: { color: '#F5A623' },
});
