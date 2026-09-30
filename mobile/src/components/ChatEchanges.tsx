import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import type { Echange } from '../types';
import type { MessageApp } from './EchangesView';

/**
 * Mode chat : une fenêtre qui fait défiler, bulle après bulle, ce qui attend votre réponse (à l'ouverture de
 * l'application, ou en ouvrant une conversation). Chaque bulle se traite sur place — répondre à une question,
 * « Lu ✓ », « Pris en compte ✓ » — puis la suivante arrive ; celles déjà traitées restent au-dessus, en gris.
 * « Plus tard » referme sans rien changer.
 */
export type ElementChat = { kind: 'echange'; e: Echange; avec: string } | { kind: 'message'; m: MessageApp };

interface Props {
  visible: boolean;
  titre: string;
  moi: string;
  elements: ElementChat[];
  onFermer: () => void;
  onRepondre: (e: Echange, reponse: string, note: string) => Promise<void>;
  onRetirer: (e: Echange) => Promise<void>;
  onLu: (id: string) => void;
}

const cle = (x: ElementChat) => (x.kind === 'echange' ? x.e.id : x.m.id);

export function ChatEchanges({ visible, titre, moi, elements, onFermer, onRepondre, onRetirer, onLu }: Props) {
  // La liste est figée à l'ouverture : les bulles traitées restent affichées (grisées) pendant la conversation
  const [liste, setListe] = useState<ElementChat[]>([]);
  const [faits, setFaits] = useState<Record<string, string>>({});
  const defile = useRef<ScrollView>(null);
  useEffect(() => {
    if (visible) {
      setListe(elements);
      setFaits({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const courant = liste.findIndex((x) => !faits[cle(x)]);
  const fini = courant < 0;
  const marquer = (x: ElementChat, texte: string) => setFaits((f) => ({ ...f, [cle(x)]: texte }));
  useEffect(() => {
    setTimeout(() => defile.current?.scrollToEnd({ animated: true }), 50);
  }, [courant]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
      <SafeAreaView style={s.ecran} edges={['top', 'bottom']}>
        <View style={s.entete}>
          <View style={{ flex: 1 }}>
            <Text style={s.titre} numberOfLines={1}>
              {titre}
            </Text>
            <Text style={s.sous}>{fini ? 'Tout est traité' : `${courant + 1} sur ${liste.length} à traiter`}</Text>
          </View>
          <Pressable onPress={onFermer} hitSlop={10} accessibilityRole="button">
            <Text style={s.fermer}>{fini ? 'Fermer' : 'Plus tard'}</Text>
          </Pressable>
        </View>
        <ScrollView ref={defile} contentContainerStyle={s.fil} keyboardShouldPersistTaps="handled">
          {liste.map((x, i) => {
            if (i > (fini ? liste.length : courant)) return null;
            const fait = faits[cle(x)];
            return (
              <View key={cle(x)} style={[s.groupe, fait && s.passe]}>
                <Bulle x={x} moi={moi} />
                {fait ? (
                  <View style={s.maReponse}>
                    <Text style={s.maReponseTexte}>{fait}</Text>
                  </View>
                ) : (
                  <Actions
                    x={x}
                    moi={moi}
                    onFait={(t) => marquer(x, t)}
                    onRepondre={onRepondre}
                    onRetirer={onRetirer}
                    onLu={onLu}
                  />
                )}
              </View>
            );
          })}
          {fini && (
            <View style={s.fin}>
              <Text style={s.finTexte}>✓ Plus rien à traiter.</Text>
              <Pressable onPress={onFermer} style={s.bouton} accessibilityRole="button">
                <Text style={s.boutonTexte}>Fermer</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** Bulle de l'autre : qui, quoi (question, message, réponse reçue, message de l'application) */
function Bulle({ x, moi }: { x: ElementChat; moi: string }) {
  if (x.kind === 'message')
    return (
      <View style={s.bulle}>
        <Text style={s.auteur}>🏛️ President · {x.m.date}</Text>
        <Text style={[s.texte, x.m.ton === 'alerte' && { color: colors.danger }]}>{x.m.texte}</Text>
      </View>
    );
  const e = x.e;
  const recue = e.de === moi && e.statut === 'repondu';
  return (
    <View style={s.bulle}>
      <Text style={s.auteur}>
        {recue ? `Réponse de ${x.avec}` : `${x.avec} · ${e.type === 'question' ? 'question' : 'message'}`}
      </Text>
      {!!e.titre && <Text style={s.titreBulle}>{e.titre}</Text>}
      {!!e.texte && <Text style={s.texte}>{e.texte}</Text>}
      {recue && (
        <Text style={s.reponse}>
          → {e.reponse}
          {e.note ? ` — ${e.note}` : ''}
        </Text>
      )}
    </View>
  );
}

function Actions({
  x,
  moi,
  onFait,
  onRepondre,
  onRetirer,
  onLu,
}: {
  x: ElementChat;
  moi: string;
  onFait: (texte: string) => void;
  onRepondre: (e: Echange, reponse: string, note: string) => Promise<void>;
  onRetirer: (e: Echange) => Promise<void>;
  onLu: (id: string) => void;
}) {
  const [choix, setChoix] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const faire = async (f: () => Promise<void> | void, texte: string) => {
    setBusy(true);
    try {
      await f();
      onFait(texte);
    } finally {
      setBusy(false);
    }
  };
  const Bouton = ({ label, onPress, principal }: { label: string; onPress: () => void; principal?: boolean }) => (
    <Pressable disabled={busy} onPress={onPress} style={[s.action, principal && s.actionPrincipale, busy && s.inactif]} accessibilityRole="button">
      <Text style={[s.actionTexte, principal && s.actionTexteBlanc]}>{busy ? '…' : label}</Text>
    </Pressable>
  );
  if (x.kind === 'message') return <Bouton principal label="Lu ✓" onPress={() => faire(() => onLu(x.m.id), 'Lu ✓')} />;
  const e = x.e;
  if (e.de === moi) return <Bouton principal label="Pris en compte ✓" onPress={() => faire(() => onRetirer(e), 'Pris en compte ✓')} />;
  if (e.type !== 'question') return <Bouton principal label="Lu ✓" onPress={() => faire(() => onRetirer(e), 'Lu ✓')} />;
  const options = e.choix.split(';').map((c) => c.trim()).filter(Boolean);
  return (
    <View style={s.repondre}>
      <View style={s.choix}>
        {options.map((o) => (
          <Pressable key={o} onPress={() => setChoix(o === choix ? '' : o)} style={[s.choixBouton, choix === o && s.choixOn]} accessibilityRole="radio" accessibilityState={{ checked: choix === o }}>
            <Text style={[s.choixTexte, choix === o && s.choixTexteOn]}>{o}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.saisie}>
        <TextInput value={note} onChangeText={setNote} placeholder="Remarque (facultatif)" placeholderTextColor="#9AA3AF" style={s.note} multiline />
        <Pressable
          disabled={!choix || busy}
          onPress={() => faire(() => onRepondre(e, choix, note.trim()), `${choix}${note.trim() ? ` — ${note.trim()}` : ''}`)}
          style={[s.envoyer, (!choix || busy) && s.inactif]}
          accessibilityRole="button"
          accessibilityLabel="Répondre"
        >
          <Text style={s.envoyerTexte}>➤</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  titre: { fontSize: 17, fontWeight: '700', color: colors.text },
  sous: { fontSize: 12.5, color: colors.muted },
  fermer: { fontSize: 15, fontWeight: '700', color: colors.primary },
  fil: { padding: 16, gap: 16, paddingBottom: 40 },
  groupe: { gap: 8 },
  passe: { opacity: 0.55 },
  bulle: { alignSelf: 'flex-start', maxWidth: '88%', backgroundColor: colors.card, borderRadius: 16, borderTopLeftRadius: 4, padding: 12, gap: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  auteur: { fontSize: 11.5, fontWeight: '700', color: colors.muted },
  titreBulle: { fontSize: 15, fontWeight: '700', color: colors.text },
  texte: { fontSize: 14.5, color: colors.text, lineHeight: 20 },
  reponse: { fontSize: 14, fontWeight: '700', color: colors.success },
  maReponse: { alignSelf: 'flex-end', maxWidth: '80%', backgroundColor: colors.primary, borderRadius: 16, borderTopRightRadius: 4, paddingHorizontal: 12, paddingVertical: 8 },
  maReponseTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  repondre: { alignSelf: 'flex-end', width: '92%', gap: 8 },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  choixBouton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card },
  choixOn: { backgroundColor: colors.primary },
  choixTexte: { fontSize: 14, fontWeight: '700', color: colors.primary },
  choixTexteOn: { color: '#fff' },
  saisie: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  note: { flex: 1, minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: colors.text, backgroundColor: colors.card },
  envoyer: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  envoyerTexte: { color: '#fff', fontSize: 16, fontWeight: '800' },
  action: { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.primary },
  actionPrincipale: { backgroundColor: colors.primary },
  actionTexte: { fontSize: 14, fontWeight: '700', color: colors.primary },
  actionTexteBlanc: { color: '#fff' },
  inactif: { opacity: 0.4 },
  fin: { alignItems: 'center', gap: 10, marginTop: 8 },
  finTexte: { fontSize: 15, fontWeight: '700', color: colors.success },
  bouton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.text },
  boutonTexte: { color: '#fff', fontWeight: '700' },
});
