import { Children, cloneElement, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { filElement } from '../choixTravail';
import { useHierarchy } from '../hierarchyContext';
import { colors } from '../theme';
import { TYPE_ICONS } from '../types';
import type { Echange, EchangeInput } from '../types';
import { ChampFiche, FeuilleChoix, type GroupeChoix, LigneChoix, SaisieFiche, SectionFiche } from './Choix';
import { ChatEchanges, type ElementChat } from './ChatEchanges';
import { FormSheet, TitreFiche } from './FormSheet';
import { ListePieces, PiecesEchange } from './Pieces';
import type { PieceEntree } from '../api';
import { choisirFichiers, ecouterCollage, FICHIERS_DISPONIBLES, preparer } from '../fichiers';

/**
 * 🔄 Synchronisation (onglet « Synchro ») : vos conversations.
 * - 🏛️ President (l'application) : ses questions et alertes (par écran), ses messages, et l'aide à la demande ;
 * - 💬 Claude (IA chat) : le fil d'échange (questions, backlog des missions) et vos messages à Claude ;
 * - 🧑 les personnes (humains) : messages et questions à choix, rangés dans l'onglet « Echanges » du Google Sheet
 *   de l'espace. Pas d'historique : un message lu, ou une réponse prise en compte par celui qui a demandé, est
 *   supprimé.
 */

export interface Interlocuteur {
  /** e-mail, « claude » ou « president » */
  id: string;
  nom: string;
  /** humain, ia_chat, agent_ia, application */
  nature: string;
}
/** Message de l'application : ce qu'elle a fait ou signalé (mise à jour, écriture, erreur) */
export interface MessageApp {
  id: string;
  texte: string;
  date: string;
  ton: 'info' | 'alerte';
}
export interface AlertesEcran {
  ecran: string;
  titre: string;
  icone: string;
  rouge: number;
  jaune: number;
  /** Les alertes de l'écran, avec leurs boutons (même carte que sur l'écran) */
  contenu?: ReactNode;
}
interface Props {
  moi: string;
  echanges: Echange[];
  personnes: Interlocuteur[];
  espaces: { id: string; nom: string }[];
  /** President : les alertes de tous les onglets (des espaces affichés), regroupées, avec leurs boutons */
  president: {
    alertes: AlertesEcran[];
    onOuvrir: (ecran: string) => void;
    messages: MessageApp[];
    onLu: (id: string) => void;
  };
  /** Nouvel échange, avec ses pièces jointes (images réduites, fichiers de 1 Mo au plus) */
  onEnvoyer: (e: EchangeInput, pieces: PieceEntree[]) => Promise<void>;
  onRepondre: (e: Echange, reponse: string, note: string) => Promise<void>;
  /** Modifier un échange envoyé : sur place s'il n'est pas lu, sinon en nouvel échange */
  onModifier: (e: Echange, patch: Partial<EchangeInput>) => Promise<void>;
  /** Lu, pris en compte ou retiré : l'échange est supprimé */
  onRetirer: (e: Echange) => Promise<void>;
  /** Hiérarchie (entreprise) : niveau affiché, escalade au niveau au-dessus, transmission à quelqu'un d'autre */
  hierarchie: Hierarchie;
}
export interface Hierarchie {
  /** « 👥 Mobile » : où vit l'échange */
  libelle: (e: Echange) => string;
  /** À qui l'escalade peut l'envoyer (membre : SM ou PO ; SM / PO : RTE ; RTE : Epic Owner), vide sinon */
  escalade: (e: Echange) => { email: string; libelle: string; meta: string }[];
  /** Personnes à qui le transmettre, par groupe */
  transmission: (e: Echange) => GroupeChoix[];
  onEscalader: (e: Echange, email: string) => Promise<void>;
  onTransmettre: (e: Echange, email: string) => Promise<void>;
}

const ICONE_NATURE: Record<string, string> = { humain: '🧑', ia_chat: '💬', agent_ia: '🤖', application: '🏛️' };
const LIBELLE_NATURE: Record<string, string> = { humain: 'Humain', ia_chat: 'IA chat', agent_ia: 'Agent IA', application: 'Application' };

/** « lea.martin@… » → « Lea Martin » (personne absente de l'Organisation) */
export const nomDepuisEmail = (e: string) =>
  e
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((m) => m[0].toUpperCase() + m.slice(1))
    .join(' ') || e;

/** Fil d'Ariane de l'élément concerné par un échange (epic, feature, tâche…), en tête de sa carte */
export function FilEchange({ id }: { id: string }) {
  const h = useHierarchy();
  const fil = filElement(id, h, TYPE_ICONS);
  return fil ? (
    <Text style={s.filElement} numberOfLines={2}>
      📍 {fil}
    </Text>
  ) : null;
}

/** Ce qui attend une action de `moi` dans les échanges (à répondre, à lire, réponses à prendre en compte) */
export const aTraiter = (moi: string, l: Echange[]) => l.filter((e) => (e.a === moi && e.statut === 'envoye') || (e.de === moi && e.statut === 'repondu'));

/** Petite aide de l'application (en attendant le mode assistant, lot 19) */
const AIDE: { q: string; r: string }[] = [
  { q: 'Créer un espace de travail', r: 'Carte des espaces (touchez la pastille à côté de « President ») › ＋ : Équipe ou Entreprise, avec son propre Google Sheet.' },
  { q: 'Envoyer un échange à quelqu’un', r: '🔄 Synchronisation › ＋ Nouvel échange : un message ou une question à choix, rangé dans l’espace choisi. Il disparaît quand il est lu, ou quand la réponse est prise en compte.' },
  { q: 'Alertes', r: 'Chaque écran signale ce qui ne tient pas (dates, charge, estimation). Un bouton règle le problème, « Ignorer » le range.' },
  { q: 'Droits', r: 'Vos droits viennent de vos rôles : votre travail et celui de votre équipe selon le rôle (Scrum Master, PO, membre…), la lecture ailleurs.' },
  { q: 'Claude', r: '🔄 Synchronisation › Claude : une conversation comme avec une personne (IA chat). Claude lit et répond dans votre Sheet avec le connecteur Google Sheets.' },
];

export function EchangesView({ moi, echanges, personnes, espaces, president, onEnvoyer, onRepondre, onModifier, onRetirer, hierarchie }: Props) {
  const [ouvert, setOuvertEtat] = useState<string | null>(null);
  /** Mode chat : en ouvrant une conversation, ce qui attend votre réponse défile dans une fenêtre */
  const [chat, setChat] = useState<{ titre: string; elements: ElementChat[] } | null>(null);
  const [nouveau, setNouveau] = useState<{ a: string; existant?: Echange } | null>(null);
  const nomDe = (id: string) => (id === 'claude' ? 'Claude' : id === 'president' ? 'President' : personnes.find((p) => p.id === id)?.nom || nomDepuisEmail(id));
  const avecMoi = echanges.filter((e) => e.de === moi || e.a === moi);
  // Conversations avec des personnes : celles qui ont des échanges en cours, puis les autres connues
  const humains = useMemo(() => {
    const ids = new Set<string>();
    for (const e of avecMoi) ids.add(e.de === moi ? e.a : e.de);
    ids.delete('president');
    return [...ids].map((id) => ({ id, nom: nomDe(id), nature: id === 'claude' ? 'ia_chat' : personnes.find((p) => p.id === id)?.nature || 'humain' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avecMoi, personnes, moi]);
  const entre = (id: string) => avecMoi.filter((e) => e.de === id || e.a === id);
  const nbAlertes = president.alertes.reduce((n, a) => n + a.rouge, 0);
  const nbRappels = president.alertes.reduce((n, a) => n + a.jaune, 0);

  const setOuvert = (id: string | null) => {
    setOuvertEtat(id);
    if (!id) return;
    const elements: ElementChat[] =
      id === 'president'
        ? president.messages.map((m) => ({ kind: 'message' as const, m }))
        : aTraiter(moi, entre(id))
            .sort((a, b) => a.cree_le.localeCompare(b.cree_le))
            .map((e) => ({ kind: 'echange' as const, e, avec: nomDe(id) }));
    if (elements.length) setChat({ titre: id === 'president' ? '🏛️ President' : `🧑 ${nomDe(id)}`, elements });
  };
  const fenetreChat = (
    <ChatEchanges
      visible={!!chat}
      titre={chat?.titre ?? ''}
      moi={moi}
      elements={chat?.elements ?? []}
      onFermer={() => setChat(null)}
      onRepondre={onRepondre}
      onRetirer={onRetirer}
      onLu={president.onLu}
    />
  );

  if (ouvert === 'president')
    return (
      <>
        <President {...president} onRetour={() => setOuvert(null)} />
        {fenetreChat}
      </>
    );
  if (ouvert) {
    return (
      <>
        <Conversation
          moi={moi}
          titre={`${ICONE_NATURE[humains.find((h) => h.id === ouvert)?.nature ?? 'humain'] ?? '🧑'} ${nomDe(ouvert)}`}
          echanges={entre(ouvert)}
          onRetour={() => setOuvert(null)}
          onNouveau={() => setNouveau({ a: ouvert })}
          onModifier={(e) => setNouveau({ a: e.a, existant: e })}
          onOuvrir={(e) => setChat({ titre: `${ICONE_NATURE[humains.find((h) => h.id === ouvert)?.nature ?? 'humain'] ?? '🧑'} ${nomDe(ouvert)}`, elements: [{ kind: 'echange', e, avec: nomDe(ouvert) }] })}
          onRepondre={onRepondre}
          onRetirer={onRetirer}
          hierarchie={hierarchie}
          nomDe={nomDe}
        />
        <NouvelEchange a={nouveau?.a ?? ''} existant={nouveau?.existant} visible={!!nouveau} moi={moi} personnes={personnes} espaces={espaces} onClose={() => setNouveau(null)} onEnvoyer={onEnvoyer} onModifier={onModifier} />
        {fenetreChat}
      </>
    );
  }

  const ligne = (id: string, icone: string, nom: string, nature: string, meta: string, badge: number, i: number) => (
    <Pressable key={id} onPress={() => setOuvert(id)} style={[s.ligne, i > 0 && s.ligneBord]} accessibilityRole="button">
      <Text style={s.avatar}>{icone}</Text>
      <View style={s.corps}>
        <Text style={s.titre}>
          {nom} <Text style={s.nature}>· {LIBELLE_NATURE[nature] ?? nature}</Text>
        </Text>
        <Text style={s.meta}>{meta}</Text>
      </View>
      {badge > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeTexte}>{badge}</Text>
        </View>
      )}
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
  const resume = (l: Echange[]) => {
    const r = l.filter((e) => e.a === moi && e.statut === 'envoye').length;
    const p = l.filter((e) => e.de === moi && e.statut === 'repondu').length;
    const w = l.filter((e) => (e.de === moi && e.statut === 'envoye') || (e.a === moi && e.statut === 'repondu')).length;
    return [r && `${r} à traiter`, p && `${p} réponse${p > 1 ? 's' : ''} reçue${p > 1 ? 's' : ''}`, w && `${w} en attente de l'autre`].filter(Boolean).join(' · ') || 'Rien en cours';
  };
  // Seules les conversations où il y a quelque chose à faire (répondre, lire, prendre en compte) sont affichées ;
  // les autres restent accessibles par « Afficher aussi … »
  const aFaire = (id: string) => (id === 'president' ? president.messages.length + nbAlertes + nbRappels : aTraiter(moi, entre(id)).length) > 0;
  const toutes = [
    ligne('president', '🏛️', 'President', 'application', [nbAlertes && `${nbAlertes} alerte${nbAlertes > 1 ? 's' : ''}`, nbRappels && `${nbRappels} rappel${nbRappels > 1 ? 's' : ''}`, president.messages.length && `${president.messages.length} message${president.messages.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ') || 'Aucune alerte · aide à la demande', president.messages.length + nbAlertes, 0),
    // Claude (IA chat) : une conversation comme les autres, toujours proposée
    ...(humains.some((h) => h.id === 'claude') ? [] : [ligne('claude', '💬', 'Claude', 'ia_chat', 'Écrire à Claude', 0, 1)]),
    ...humains.map((h, k) => ligne(h.id, ICONE_NATURE[h.nature] ?? '🧑', h.nom, h.nature, resume(entre(h.id)), aTraiter(moi, entre(h.id)).length, k + 2)),
  ];
  // Deux sections : « En attente » (quelque chose à faire) puis « Conversations » (les autres, pour voir ce qui reste)
  const actives = toutes.filter((l) => aFaire(String(l.key))).map((l, i) => cloneElement(l, { style: [s.ligne, i > 0 && s.ligneBord] }));
  const autres = toutes.filter((l) => !aFaire(String(l.key))).map((l, i) => cloneElement(l, { style: [s.ligne, i > 0 && s.ligneBord] }));

  return (
    <>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.entete}>
          <Text style={s.section}>En attente · {actives.length}</Text>
          <Pressable onPress={() => setNouveau({ a: '' })} style={s.rond} hitSlop={8} accessibilityRole="button" accessibilityLabel="Nouvel échange">
            <Text style={s.rondTexte}>＋</Text>
          </Pressable>
        </View>
        {actives.length > 0 ? <View style={s.carte}>{actives}</View> : <Text style={s.videTexte}>✓ Rien à traiter. Touchez ＋ pour écrire à quelqu’un (Claude compris).</Text>}
        {autres.length > 0 && (
          <>
            <Text style={[s.section, s.sectionBloc]}>Conversations · {autres.length}</Text>
            <View style={s.carte}>{autres}</View>
          </>
        )}
        <Text style={s.aide}>Sans historique : un message lu, ou une réponse prise en compte, disparaît.</Text>
      </ScrollView>
      <NouvelEchange a={nouveau?.a ?? ''} existant={nouveau?.existant} visible={!!nouveau} moi={moi} personnes={personnes} espaces={espaces} onClose={() => setNouveau(null)} onEnvoyer={onEnvoyer} onModifier={onModifier} />
    </>
  );
}

function Retour({ titre, onRetour }: { titre: string; onRetour: () => void }) {
  return (
    <View style={s.fil}>
      <Pressable onPress={onRetour} accessibilityRole="button" hitSlop={8}>
        <Text style={s.filLien}>‹ Conversations</Text>
      </Pressable>
      <Text style={s.filTitre} numberOfLines={1}>
        {titre}
      </Text>
    </View>
  );
}

function Conversation({
  moi,
  titre,
  echanges,
  onRetour,
  onNouveau,
  onModifier,
  onOuvrir,
  onRepondre,
  onRetirer,
  hierarchie,
  nomDe,
}: {
  hierarchie: Hierarchie;
  nomDe: (id: string) => string;
  moi: string;
  titre: string;
  echanges: Echange[];
  onRetour: () => void;
  onNouveau: () => void;
  /** Ouvre la fiche de l'échange envoyé pour le modifier */
  onModifier: (e: Echange) => void;
  /** Ouvre un échange dans la fenêtre (consultation, ou pour y répondre) */
  onOuvrir: (e: Echange) => void;
  onRepondre: (e: Echange, reponse: string, note: string) => Promise<void>;
  onRetirer: (e: Echange) => Promise<void>;
}) {
  const aRepondre = echanges.filter((e) => e.a === moi && e.statut === 'envoye');
  const recues = echanges.filter((e) => e.de === moi && e.statut === 'repondu');
  const attente = echanges.filter((e) => e.de === moi && e.statut === 'envoye');
  const autres = echanges.filter((e) => e.a === moi && e.statut === 'repondu');
  const [transmettre, setTransmettre] = useState<Echange | null>(null);
  const [escalader, setEscalader] = useState<Echange | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const agir = async (e: Echange, f: () => Promise<void>) => {
    setOccupe(e.id);
    try {
      await f();
    } finally {
      setOccupe(null);
    }
  };
  // Sous chaque échange à traiter : où il vit, qui l'a transmis, Escalader et Transmettre
  const outils = (e: Echange) => {
    const vers = hierarchie.escalade(e);
    const unSeul = vers.length === 1 ? vers[0] : null;
    const niveau = hierarchie.libelle(e);
    return (
      <View style={s.outils}>
        <Text style={s.meta}>
          {[niveau && `📍 ${niveau}`, e.prive !== '0' && '🔒 Privé à deux', e.transmis_par && `Transmis par ${nomDe(e.transmis_par)}`, e.de !== moi && `De ${nomDe(e.de)}`].filter(Boolean).join(' · ')}
        </Text>
        <View style={s.choix}>
          {!!vers.length && (
            <Pressable
              disabled={occupe === e.id}
              onPress={() => (unSeul ? agir(e, () => hierarchie.onEscalader(e, unSeul.email)) : setEscalader(e))}
              style={s.action}
              accessibilityRole="button"
            >
              <Text style={s.actionTexte}>⤴ Escalader{unSeul ? ` · ${unSeul.libelle}` : ` · ${vers.map((v) => v.libelle.split(' ')[0]).join(' ou ')}`}</Text>
            </Pressable>
          )}
          {!!hierarchie.transmission(e).length && (
            <Pressable disabled={occupe === e.id} onPress={() => setTransmettre(e)} style={s.action} accessibilityRole="button">
              <Text style={s.actionTexte}>↪ Transmettre</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };
  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <Retour titre={titre} onRetour={onRetour} />
      <Bloc titre="À vous" vide="Rien à traiter.">
        {aRepondre.map((e) =>
          e.type === 'question' ? (
            <CarteQuestion key={e.id} e={e} onRepondre={onRepondre} pied={outils(e)} onOuvrir={() => onOuvrir(e)} />
          ) : (
            <CarteMessage key={e.id} e={e} action="Lu ✓" onAction={() => onRetirer(e)} pied={outils(e)} onOuvrir={() => onOuvrir(e)} />
          ),
        )}
      </Bloc>
      <Bloc titre="Réponses reçues" vide="Aucune réponse en attente de prise en compte.">
        {recues.map((e) => (
          <CarteMessage key={e.id} e={e} reponse action="Pris en compte ✓" onAction={() => onRetirer(e)} onOuvrir={() => onOuvrir(e)} />
        ))}
      </Bloc>
      {!!(attente.length || autres.length) && (
        <Bloc titre="En attente de l'autre" vide="">
          {attente.map((e) => (
            <CarteMessage key={e.id} e={e} gris action="Retirer" onAction={() => onRetirer(e)} modifier={() => onModifier(e)} onOuvrir={() => onOuvrir(e)} />
          ))}
          {autres.map((e) => (
            <CarteMessage key={e.id} e={e} reponse gris onOuvrir={() => onOuvrir(e)} />
          ))}
        </Bloc>
      )}
      <Pressable onPress={onNouveau} style={s.bouton} accessibilityRole="button">
        <Text style={s.boutonTexte}>＋ Nouvel échange</Text>
      </Pressable>
      {escalader && (
        <FeuilleChoix
          titre="Escalader à"
          value=""
          groupes={[{ options: hierarchie.escalade(escalader).map((v) => ({ value: v.email, label: v.libelle, meta: v.meta })) }]}
          onChoisir={(v) => {
            const e = escalader;
            setEscalader(null);
            if (v) agir(e, () => hierarchie.onEscalader(e, v));
          }}
          onFermer={() => setEscalader(null)}
        />
      )}
      {transmettre && (
        <FeuilleChoix
          titre="Transmettre à"
          value=""
          groupes={hierarchie.transmission(transmettre)}
          onChoisir={(v) => {
            const e = transmettre;
            setTransmettre(null);
            if (v) agir(e, () => hierarchie.onTransmettre(e, v));
          }}
          onFermer={() => setTransmettre(null)}
        />
      )}
    </ScrollView>
  );
}

function Bloc({ titre, vide, children }: { titre: string; vide: string; children: ReactNode }) {
  const n = Children.toArray(children).length;
  if (!n && !vide) return null;
  return (
    <>
      <Text style={[s.section, s.sectionBloc]}>
        {titre}
        {n ? ` · ${n}` : ''}
      </Text>
      {n ? <View style={s.pile}>{children}</View> : <Text style={s.videTexte}>{vide}</Text>}
    </>
  );
}

function CarteMessage({ e, action, onAction, reponse, gris, pied, modifier, onOuvrir }: { e: Echange; action?: string; onAction?: () => void; reponse?: boolean; gris?: boolean; pied?: ReactNode; modifier?: () => void; onOuvrir?: () => void }) {
  return (
    // Toucher la carte l'ouvre dans la fenêtre (consultation), par-dessus l'écran
    <Pressable onPress={onOuvrir} disabled={!onOuvrir} style={[s.carte, s.carteEchange, gris && s.gris]} accessibilityRole="button">
      {!!e.element && <FilEchange id={e.element} />}
      <Text style={s.type}>{e.type === 'question' ? '❓ Question' : '✉️ Message'}{onOuvrir ? '  ·  Ouvrir ›' : ''}</Text>
      {!!e.titre && <Text style={s.titre}>{e.titre}</Text>}
      {!!e.texte && <Text style={s.texte}>{e.texte}</Text>}
      <PiecesEchange e={e} />
      {e.type === 'question' && !reponse && <Text style={s.meta}>Choix : {e.choix.split(';').filter(Boolean).join(' · ')}</Text>}
      {reponse && !!e.reponse && (
        <Text style={s.reponse}>
          → {e.reponse}
          {e.note ? ` — ${e.note}` : ''}
        </Text>
      )}
      {(!!(action && onAction) || !!modifier) && (
        <View style={s.actionsLigne}>
          {!!modifier && (
            <Pressable onPress={modifier} style={s.action} accessibilityRole="button">
              <Text style={s.actionTexte}>✏️ Modifier</Text>
            </Pressable>
          )}
          {!!action && onAction && (
            <Pressable onPress={onAction} style={s.action} accessibilityRole="button">
              <Text style={s.actionTexte}>{action}</Text>
            </Pressable>
          )}
        </View>
      )}
      {pied}
    </Pressable>
  );
}

/** Réponse « Autre » : la personne précise laquelle (remarque obligatoire) */
export const estAutre = (c: string) => c.trim().toLowerCase() === 'autre';
export const placeholderNote = (c: string) => (estAutre(c) ? 'Précisez votre réponse « Autre » (obligatoire)' : 'Remarque (facultatif)');
export const reponsePrete = (c: string, note: string) => !!c && (!estAutre(c) || !!note.trim());

function CarteQuestion({ e, onRepondre, pied, onOuvrir }: { e: Echange; onRepondre: (e: Echange, reponse: string, note: string) => Promise<void>; pied?: ReactNode; onOuvrir?: () => void }) {
  const [choix, setChoix] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const options = e.choix.split(';').map((c) => c.trim()).filter(Boolean);
  return (
    <View style={[s.carte, s.carteEchange]}>
      {!!e.element && <FilEchange id={e.element} />}
      <Pressable onPress={onOuvrir} disabled={!onOuvrir} accessibilityRole="button">
        <Text style={s.type}>❓ Question{onOuvrir ? '  ·  Ouvrir ›' : ''}</Text>
        {!!e.titre && <Text style={s.titre}>{e.titre}</Text>}
        {!!e.texte && <Text style={s.texte}>{e.texte}</Text>}
      </Pressable>
      <PiecesEchange e={e} />
      <View style={s.choix}>
        {options.map((o) => (
          <Pressable key={o} onPress={() => setChoix(o === choix ? '' : o)} style={[s.choixBouton, choix === o && s.choixOn]} accessibilityRole="radio" accessibilityState={{ checked: choix === o }}>
            <Text style={[s.choixTexte, choix === o && s.choixTexteOn]}>{o}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={note} onChangeText={setNote} placeholder={placeholderNote(choix)} placeholderTextColor={estAutre(choix) ? colors.warning : '#9AA3AF'} multiline style={[s.note, estAutre(choix) && !note.trim() && { borderColor: colors.warning }]} />
      <Pressable
        disabled={!reponsePrete(choix, note) || busy}
        onPress={async () => {
          setBusy(true);
          try {
            await onRepondre(e, choix, note.trim());
          } finally {
            setBusy(false);
          }
        }}
        style={[s.action, s.actionPrincipale, (!reponsePrete(choix, note) || busy) && s.inactif]}
        accessibilityRole="button"
      >
        <Text style={[s.actionTexte, s.actionTexteBlanc]}>{busy ? 'Envoi…' : 'Répondre'}</Text>
      </Pressable>
      {pied}
    </View>
  );
}

function President({ alertes, onOuvrir, messages, onLu, onRetour }: Props['president'] & { onRetour: () => void }) {
  const [q, setQ] = useState('');
  const mots = q.toLowerCase().split(/\s+/).filter((m) => m.length > 2);
  const trouvees = mots.length ? AIDE.filter((a) => mots.some((m) => `${a.q} ${a.r}`.toLowerCase().includes(m))) : [];
  const avecAlertes = alertes.filter((a) => a.rouge || a.jaune);
  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <Retour titre="🏛️ President · Application" onRetour={onRetour} />
      <Text style={s.aide}>Trois niveaux : ses messages (mises à jour, écritures), les alertes de tous les onglets avec leurs boutons, et l'aide.</Text>
      <Text style={[s.section, s.sectionBloc]}>Messages{messages.length ? ` · ${messages.length}` : ''}</Text>
      {messages.length ? (
        <View style={s.pile}>
          {messages.map((m) => (
            <View key={m.id} style={[s.carte, s.carteEchange]}>
              <Text style={[s.texte, m.ton === 'alerte' && { color: colors.danger }]}>{m.texte}</Text>
              <Text style={s.meta}>{m.date}</Text>
              <Pressable onPress={() => onLu(m.id)} style={s.action} accessibilityRole="button">
                <Text style={s.actionTexte}>Lu ✓</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.videTexte}>Aucun message.</Text>
      )}
      <Text style={[s.section, s.sectionBloc]}>Alertes</Text>
      {avecAlertes.map((a) => (
        <View key={a.ecran}>
          <Pressable onPress={() => onOuvrir(a.ecran)} style={s.enteteEcran} accessibilityRole="button" accessibilityHint="Ouvre l'écran">
            <Text style={s.section}>
              {a.icone} {a.titre} · {[a.rouge && `${a.rouge} alerte${a.rouge > 1 ? 's' : ''}`, a.jaune && `${a.jaune} rappel${a.jaune > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
            </Text>
            <Text style={s.filLien}>Ouvrir ›</Text>
          </Pressable>
          {a.contenu}
        </View>
      ))}
      {!avecAlertes.length && <Text style={[s.videTexte, { marginTop: 14 }]}>Aucune alerte : tout tient.</Text>}
      <Text style={[s.section, s.sectionBloc]}>Aide</Text>
      <View style={[s.carte, s.carteEchange]}>
        <TextInput value={q} onChangeText={setQ} placeholder="Votre question (ex. droits, espace)" placeholderTextColor="#9AA3AF" style={s.note} />
        {(trouvees.length ? trouvees : mots.length ? [] : AIDE).map((a) => (
          <View key={a.q} style={s.aideLigne}>
            <Text style={s.titreAide}>{a.q}</Text>
            <Text style={s.texte}>{a.r}</Text>
          </View>
        ))}
        {!!mots.length && !trouvees.length && <Text style={s.meta}>Pas encore de réponse : l’aide complète viendra avec le mode assistant (lot 19).</Text>}
      </View>
    </ScrollView>
  );
}

function NouvelEchange({
  a,
  existant,
  visible,
  moi,
  personnes,
  espaces,
  onClose,
  onEnvoyer,
  onModifier,
}: {
  a: string;
  /** Échange envoyé à modifier (sinon : nouvel échange) */
  existant?: Echange;
  visible: boolean;
  moi: string;
  personnes: Interlocuteur[];
  espaces: { id: string; nom: string }[];
  onClose: () => void;
  onEnvoyer: (e: EchangeInput, pieces: PieceEntree[]) => Promise<void>;
  onModifier: (e: Echange, patch: Partial<EchangeInput>) => Promise<void>;
}) {
  const [pieces, setPieces] = useState<PieceEntree[]>([]);
  const [lecture, setLecture] = useState(false);
  const [dest, setDest] = useState(a);
  const [espace, setEspace] = useState(espaces.find((e) => e.id !== 'moi')?.id ?? espaces[0]?.id ?? 'moi');
  const [type, setType] = useState<'message' | 'question'>('message');
  const [titre, setTitre] = useState('');
  const [texte, setTexte] = useState('');
  const [choix, setChoix] = useState<string[]>([]);
  const [saisieChoix, setSaisieChoix] = useState('');
  const [element, setElement] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ouvertPour, setOuvertPour] = useState<string | null>(null);
  const h = useHierarchy();
  // Remise à zéro à chaque ouverture
  const cle = visible ? existant?.id ?? (a || '·') : null;
  if (cle !== ouvertPour) {
    setOuvertPour(cle);
    if (visible) {
      setDest(existant?.a ?? a);
      setEspace(existant?.espace ?? espaces.find((e) => e.id !== 'moi')?.id ?? espaces[0]?.id ?? 'moi');
      setType(existant?.type ?? 'message');
      setTitre(existant?.titre ?? '');
      setTexte(existant?.texte ?? '');
      setChoix(existant ? existant.choix.split(';').map((c) => c.trim()).filter(Boolean) : []);
      setSaisieChoix('');
      setElement(existant?.element ?? '');
      setPieces([]);
      setError(null);
    }
  }
  const options = personnes.filter((p) => p.id !== moi);
  const nomDest = (v: string) => (v === 'claude' ? '💬 Claude' : options.find((p) => p.id === v)?.nom ?? v);
  // Un échange avec un humain va dans un espace partagé (jamais 🔒 Moi, qu'il ne verrait pas)
  const espacesPartages = espaces.filter((e) => e.id !== 'moi');
  // Fichiers choisis ou collés (Ctrl + V) : images réduites, fichiers de 1 Mo au plus, 5 pièces au plus
  const joindre = async (fichiers: unknown[]) => {
    if (!fichiers.length) return;
    setLecture(true);
    setError(null);
    try {
      const prets: PieceEntree[] = [];
      for (const f of fichiers) {
        try {
          prets.push(await preparer(f));
        } catch (e) {
          setError((e as Error).message);
        }
      }
      setPieces((l) => {
        const tout = [...l, ...prets];
        if (tout.length > 5) setError('Au plus 5 pièces jointes par échange.');
        return tout.slice(0, 5);
      });
    } finally {
      setLecture(false);
    }
  };
  useEffect(() => (visible && !existant ? ecouterCollage((f) => void joindre(f)) : undefined), [visible, existant]);
  const envoyer = async () => {
    if (!dest) return setError('Choisissez à qui écrire.');
    if (dest !== 'claude' && !espacesPartages.length) return setError('Affichez un espace Équipe ou Entreprise partagé avec cette personne : 🔒 Moi est privé.');
    // Avec une personne : jamais 🔒 Moi (elle ne le verrait pas) ; avec Claude : l'espace concerné, Moi compris
    const espaceFinal = dest !== 'claude' && espace === 'moi' ? espacesPartages[0].id : espace;
    if (!titre.trim() && !texte.trim() && !pieces.length) return setError('Écrivez un titre ou un texte, ou joignez une image.');
    // Un choix tapé sans Entrée compte aussi ; « ; » est le séparateur du Sheet
    const liste = [...new Set([...choix, saisieChoix].map((c) => c.replace(/;/g, ',').trim()).filter(Boolean))];
    // Un seul choix : « Autre » est ajouté pour qu'on puisse répondre autrement
    if (type === 'question' && liste.length === 1) liste.push('Autre');
    if (type === 'question' && !liste.length) return setError('Ajoutez au moins un choix de réponse.');
    setBusy(true);
    try {
      const contenu = { type, titre: titre.trim(), texte: texte.trim(), choix: type === 'question' ? liste.join(';') : '', element };
      if (existant) {
        await onModifier(existant, contenu);
        onClose();
        return;
      }
      await onEnvoyer({ espace: espaceFinal, de: moi, a: dest, type, titre: titre.trim(), texte: texte.trim(), choix: type === 'question' ? liste.join(';') : '', reponse: '', note: '', statut: 'envoye', element, niveau: '', transmis_par: '', prive: '1' }, pieces);
      onClose();
    } catch (e) {
      setError(`Envoi impossible : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormSheet visible={visible} title={existant ? "Modifier l'échange" : "Nouvel échange"} busy={busy} error={error} onClose={onClose} onSave={() => void envoyer()} libelleEnregistrer="Envoyer">
      {/* Même modèle que les autres fiches : grand titre en haut, puis ce qu'on écrit en premier */}
      <TitreFiche icone={type === 'question' ? '❓' : '✉️'} titre={titre} vide={type === 'question' ? 'Votre question' : 'Titre du message'} sous={dest ? `À ${nomDest(dest)}` : undefined} />
      {!!existant && <Text style={s.aide}>Pas encore lu : l'échange est modifié. Lu entre-temps : votre modification part en nouvel échange.</Text>}
      <SectionFiche titre="Échange">
        <ChampFiche label="Titre">
          <SaisieFiche placeholder="À écrire" value={titre} onChangeText={setTitre} autoFocus returnKeyType="next" />
        </ChampFiche>
        <ChampFiche label="Message" colonne>
          <SaisieFiche placeholder="Écrivez votre message ici (facultatif)" value={texte} onChangeText={setTexte} multiline />
        </ChampFiche>
        <LigneChoix
          fixe
          label="Type"
          value={type}
          groupes={[{ options: [{ value: 'message', label: '✉️ Message' }, { value: 'question', label: '❓ Question', meta: 'avec des choix de réponse' }] }]}
          onChange={(v) => v && setType(v as 'message' | 'question')}
        />
      </SectionFiche>
      {/* Pièces jointes : images (vignettes, visionneuse) et fichiers ; pas encore sur téléphone (lot 18) */}
      {!existant && FICHIERS_DISPONIBLES && (
        <SectionFiche titre={`Pièces jointes · ${pieces.length}`} onAjouter={pieces.length < 5 ? () => void choisirFichiers().then(joindre) : undefined} ajouterLabel="Joindre une image ou un fichier">
          {pieces.length > 0 ? (
            <View style={s.piecesCarte}>
              <ListePieces pieces={pieces} onRetirer={(i) => setPieces((l) => l.filter((_, k) => k !== i))} />
            </View>
          ) : (
            <Pressable onPress={() => void choisirFichiers().then(joindre)} style={s.joindre} accessibilityRole="button">
              <Text style={s.joindreTexte}>{lecture ? 'Préparation…' : '📎 Joindre une image ou un fichier'}</Text>
              <Text style={s.entree}>ou collez une capture (Ctrl + V) · 5 pièces, 1 Mo par fichier</Text>
            </Pressable>
          )}
        </SectionFiche>
      )}
      {/* Choix de réponse : saisie rapide, comme les tâches d'une feature (Entrée pour ajouter) */}
      {type === 'question' && (
        <SectionFiche titre={`Choix de réponse · ${choix.length}`} aDefinir={choix.length ? 0 : 1}>
          {choix.map((c, i) => (
            <View key={`${c}${i}`} style={[s.ligneChoix, i > 0 && s.ligneBord]}>
              <Text style={s.texteChoix}>{c}</Text>
              <Pressable onPress={() => setChoix((l) => l.filter((_, k) => k !== i))} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Retirer ${c}`}>
                <Text style={s.retirer}>✕</Text>
              </Pressable>
            </View>
          ))}
          <TextInput
            style={s.saisieRapide}
            placeholder={choix.length ? '＋ Autre choix' : '＋ Premier choix (ex. Oui)'}
            placeholderTextColor={colors.muted}
            value={saisieChoix}
            onChangeText={setSaisieChoix}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              const c = saisieChoix.replace(/;/g, ',').trim();
              if (c && !choix.includes(c)) setChoix((l) => [...l, c]);
              setSaisieChoix('');
            }}
          />
          <Text style={s.entree}>{choix.length === 1 ? 'Entrée pour ajouter · « Autre » sera ajouté' : 'Entrée pour ajouter'}</Text>
        </SectionFiche>
      )}
      <SectionFiche titre="Destinataire" aDefinir={dest ? 0 : 1}>
        <LigneChoix
          label="À"
          value={dest}
          fige={!!existant}
          attendu
          groupes={[
            { titre: 'IA', options: [{ value: 'claude', label: '💬 Claude', meta: 'IA chat' }] },
            { titre: 'Personnes', options: options.filter((p) => p.id !== 'claude').map((p) => ({ value: p.id, label: `${ICONE_NATURE[p.nature] ?? '🧑'} ${p.nom}`, meta: p.id })) },
          ]}
          libelle={nomDest}
          onChange={setDest}
        />
        {(dest === 'claude' ? espaces : espacesPartages).length > 1 && !existant && (
          <LigneChoix
            fixe
            label="Espace"
            value={dest !== 'claude' && espace === 'moi' ? espacesPartages[0]?.id ?? '' : espace}
            sous={dest === 'claude' ? "L'espace concerné (celui de l'élément choisi) : pièces jointes comprises, tout y est rangé." : "Rangé au niveau commun le plus proche de l'Organisation (équipe, train, unité) ; privé à deux."}
            groupes={[{ options: (dest === 'claude' ? espaces : espacesPartages).map((e) => ({ value: e.id, label: e.nom })) }]}
            onChange={(v) => v && setEspace(v)}
          />
        )}
      </SectionFiche>
      <SectionFiche titre="Concerne">
        <LigneChoix
          label="Élément"
          value={element}
          vide="Facultatif"
          sans="Aucun élément"
          sous={element ? filElement(element, h, TYPE_ICONS) : undefined}
          groupes={[
            { titre: 'Epics', options: h.epicList.map((x) => ({ value: x.id, label: `🗂️ ${x.titre}` })) },
            { titre: 'Features', options: h.featureList.map((x) => ({ value: x.id, label: `🧩 ${x.titre}` })) },
            { titre: 'Objectifs', options: h.objectifList.map((x) => ({ value: x.id, label: `🎯 ${x.titre}` })) },
            { titre: 'Tâches', options: h.items.filter((x) => x.statut !== 'termine').map((x) => ({ value: x.id, label: `${TYPE_ICONS[x.type]} ${x.titre}` })) },
          ].filter((g) => g.options.length)}
          libelle={(v) => filElement(v, h, TYPE_ICONS).split(' › ').pop() ?? v}
          onChange={(v) => {
            setElement(v);
            // L'échange va dans l'espace de l'élément concerné
            const x = [...h.epicList, ...h.featureList, ...h.objectifList, ...h.items].find((y) => y.id === v) as { espace?: string } | undefined;
            if (x?.espace && espaces.some((e) => e.id === x.espace)) setEspace(x.espace);
          }}
        />
      </SectionFiche>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1 },
  scroll: { paddingBottom: 130 },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  sectionBloc: { marginHorizontal: 16, marginTop: 18, marginBottom: 8 },
  rond: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  rondTexte: { color: '#fff', fontSize: 17, fontWeight: '700', lineHeight: 20 },
  carte: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  carteEchange: { padding: 14, gap: 6 },
  gris: { opacity: 0.6 },
  pile: { gap: 10 },
  ligne: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF1F6', textAlign: 'center', lineHeight: 32, fontSize: 17, overflow: 'hidden' },
  corps: { flex: 1, gap: 3 },
  titre: { fontSize: 15, fontWeight: '700', color: colors.text },
  titreAide: { fontSize: 14, fontWeight: '700', color: colors.text },
  nature: { fontSize: 12.5, fontWeight: '600', color: colors.muted },
  meta: { fontSize: 12.5, color: colors.muted },
  texte: { fontSize: 14, color: colors.text, lineHeight: 20 },
  type: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  reponse: { fontSize: 14, fontWeight: '700', color: colors.success },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' },
  badgeTexte: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  chev: { fontSize: 18, color: '#A0A6B1' },
  aide: { marginHorizontal: 16, marginTop: 10, fontSize: 12.5, color: colors.muted },
  aideLigne: { gap: 2, marginTop: 6 },
  videTexte: { marginHorizontal: 16, fontSize: 13, color: colors.muted, paddingVertical: 4 },
  fil: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12 },
  filLien: { fontSize: 13.5, fontWeight: '700', color: colors.primary },
  filTitre: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choixBouton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  choixOn: { backgroundColor: colors.text, borderColor: colors.text },
  choixTexte: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  choixTexteOn: { color: '#fff' },
  note: { minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: colors.text, backgroundColor: '#FAFBFC' },
  action: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  actionPrincipale: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionTexte: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  actionTexteBlanc: { color: '#fff' },
  inactif: { opacity: 0.4 },
  piecesCarte: { padding: 12 },
  joindre: { paddingHorizontal: 12, paddingTop: 12, gap: 2 },
  joindreTexte: { fontSize: 15, fontWeight: '700', color: colors.primary },
  actionsLigne: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filElement: { fontSize: 12, fontWeight: '600', color: colors.primary },
  outils: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 6 },
  enteteEcran: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 16, marginBottom: 6 },
  bouton: { marginHorizontal: 16, marginTop: 18, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  boutonTexte: { fontSize: 14.5, fontWeight: '700', color: colors.primary },
  saisieRapide: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, fontSize: 15, color: colors.text, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, outlineStyle: 'none' as never },
  ligneChoix: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  texteChoix: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  retirer: { fontSize: 15, color: colors.muted, paddingHorizontal: 4 },
  entree: { fontSize: 11.5, color: colors.muted, paddingHorizontal: 12, paddingBottom: 10 },
});
