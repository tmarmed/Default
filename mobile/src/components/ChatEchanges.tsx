import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { Echange } from '../types';
import { ChampFiche, SaisieFiche, SectionFiche } from './Choix';
import { estAutre, exigeMotif, FilEchange, type Hierarchie, type MessageApp, placeholderNote, reponsePrete } from './EchangesView';
import { FormSheet, TitreFiche } from './FormSheet';
import { idsPieces, PiecesEchange } from './Pieces';
import { ActionsEchange } from './Transmettre';
import { TITRE_RAPPEL } from '../pointsSuivi';

/**
 * Fenêtre de traitement (à l'ouverture de l'application, ou en ouvrant une conversation) : un seul message à la
 * fois, au format standard des fiches. Dès qu'on répond (« Répondre », « Lu ✓ », « Pris en compte ✓ »), le message
 * suivant de la personne arrive, jusqu'à la fin : récapitulatif et bouton « Terminer ». « Passer » laisse le message
 * pour plus tard ; « Fermer » referme sans rien changer.
 */
export type ElementChat = { kind: 'echange'; e: Echange; avec: string } | { kind: 'message'; m: MessageApp };

interface Props {
  visible: boolean;
  titre: string;
  moi: string;
  elements: ElementChat[];
  onFermer: () => void;
  onRepondre: (e: Echange, reponse: string, note: string) => Promise<void>;
  /** Changer sa réponse tant que l'autre ne l'a pas prise en compte */
  onChangerReponse?: (e: Echange, reponse: string, note: string) => Promise<void>;
  onRetirer: (e: Echange) => Promise<void>;
  onLu: (id: string) => void;
  /** Échange reçu dans une entreprise : ⤴ Escalader (niveau au-dessus) et ↪ Transmettre (à quelqu'un d'autre) */
  hierarchie?: Hierarchie;
  /** Nom d'une personne d'après son e-mail (« Transmis par … ») */
  nomDe?: (id: string) => string;
}

const cle = (x: ElementChat) => (x.kind === 'echange' ? x.e.id : x.m.id);

export function ChatEchanges({ visible, titre, moi, elements, onFermer, onRepondre, onChangerReponse, onRetirer, onLu, hierarchie, nomDe = (id) => id }: Props) {
  // La liste est figée à l'ouverture ; `faits` : ce qui a été répondu (ou passé) pendant cette fenêtre
  const [liste, setListe] = useState<ElementChat[]>([]);
  const [faits, setFaits] = useState<Record<string, { texte: string; passe?: boolean }>>({});
  const [choix, setChoix] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setListe(elements);
      setFaits({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const i = liste.findIndex((y) => !faits[cle(y)]);
  const x = i >= 0 ? liste[i] : null;
  useEffect(() => {
    // Réponse déjà donnée (en attente de prise en compte) : on repart d'elle pour pouvoir la changer
    const deja = x?.kind === 'echange' && x.e.a === moi && x.e.statut === 'repondu' ? x.e : null;
    setChoix(deja?.reponse ?? '');
    setNote(deja?.note ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, liste]);

  const faire = async (f: () => Promise<void> | void, texte: string) => {
    if (!x) return;
    setBusy(true);
    setError(null);
    try {
      await f();
      // Un seul échange ouvert (consultation) : la fenêtre se referme directement
      if (liste.length === 1) return onFermer();
      setFaits((l) => ({ ...l, [cle(x)]: { texte } }));
    } catch (e) {
      setError(`Non enregistré : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const passer = () => x && setFaits((l) => ({ ...l, [cle(x)]: { texte: 'Passé', passe: true } }));

  const reste = x ? liste.length - i - 1 : 0;
  let contenu;
  if (!x) {
    const passes = liste.filter((y) => faits[cle(y)]?.passe).length;
    contenu = (
      <>
        <TitreFiche icone="✓" titre="Tout est traité" vide="" sous={`${titre}${passes ? ` · ${passes} passé${passes > 1 ? 's' : ''}, à traiter plus tard` : ''}`} couleur={colors.success} />
        <SectionFiche titre={`Récapitulatif · ${liste.length}`}>
          {liste.map((y, k) => (
            <View key={cle(y)} style={[s.ligne, k > 0 && s.bord]}>
              <Text style={s.recapTitre} numberOfLines={1}>
                {y.kind === 'message' ? y.m.texte : y.e.titre || y.e.texte}
              </Text>
              <Text style={[s.recapFait, faits[cle(y)]?.passe && s.recapPasse]} numberOfLines={1}>
                {faits[cle(y)]?.texte}
              </Text>
            </View>
          ))}
        </SectionFiche>
        <Bouton label="Terminer" busy={false} onPress={onFermer} />
      </>
    );
  } else if (x.kind === 'message') {
    contenu = (
      <>
        <TitreFiche icone="🏛️" titre="Message de President" vide="" sous={x.m.date} />
        <SectionFiche titre="Message">
          <Text style={[s.texte, x.m.ton === 'alerte' && { color: colors.danger }]}>{x.m.texte}</Text>
        </SectionFiche>
        <Bouton label={'Lu ✓'} busy={busy} onPress={() => faire(() => onLu(x.m.id), 'Lu ✓')} />
      </>
    );
  } else {
    const e = x.e;
    const recue = e.de === moi && e.statut === 'repondu';
    // Consultation : rien à faire de votre côté (envoyé, en attente de l'autre ; ou déjà répondu, en attente de sa prise en compte)
    const attente = (e.de === moi && e.statut === 'envoye') || (e.a === moi && e.statut === 'repondu');
    // Votre réponse attend sa prise en compte : elle peut encore être changée
    const modifiable = !!onChangerReponse && e.a === moi && e.statut === 'repondu' && e.type === 'question';
    const question = (!recue && !attente && e.type === 'question') || modifiable;
    const change = choix !== e.reponse || note.trim() !== (e.note ?? '');
    const options = e.choix.split(';').map((c) => c.trim()).filter(Boolean);
    contenu = (
      <>
        {!!e.element && (
          <View style={s.fil}>
            <FilEchange id={e.element} />
          </View>
        )}
        <TitreFiche
          icone={recue ? '↩️' : question ? '❓' : '✉️'}
          titre={e.titre || (question ? 'Question' : 'Message')}
          vide=""
          sous={
            attente
              ? e.de === moi
                ? `À ${x.avec} · en attente de sa réponse`
                : `De ${x.avec} · votre réponse attend sa prise en compte`
              : recue
                ? `Réponse de ${x.avec}`
                : `De ${x.avec} · ${question ? 'question' : 'message'}`
          }
        />
        {!!e.texte && (
          <SectionFiche titre="Message">
            <Text style={s.texte}>{e.texte}</Text>
          </SectionFiche>
        )}
        {idsPieces(e).length > 0 && (
          <SectionFiche titre={`Pièces jointes · ${idsPieces(e).length}`}>
            <View style={s.pieces}>
              <PiecesEchange e={e} />
            </View>
          </SectionFiche>
        )}
        {e.type === 'question' && attente && !modifiable && (
          <SectionFiche titre={e.statut === 'repondu' ? 'Votre réponse' : 'Choix proposés'}>
            <ChampFiche label={e.statut === 'repondu' ? 'Choix' : 'Choix'}>
              <Text style={e.statut === 'repondu' ? s.reponse : s.texteNote}>{e.statut === 'repondu' ? e.reponse : options.join(' · ')}</Text>
            </ChampFiche>
            {!!e.note && (
              <ChampFiche label="Précision" colonne>
                <Text style={s.texteNote}>{e.note}</Text>
              </ChampFiche>
            )}
          </SectionFiche>
        )}
        {recue && (
          <SectionFiche titre="Réponse">
            <ChampFiche label="Choix">
              <Text style={s.reponse}>{e.reponse}</Text>
            </ChampFiche>
            {!!e.note && (
              <ChampFiche label="Précision" colonne>
                <Text style={s.texteNote}>{e.note}</Text>
              </ChampFiche>
            )}
          </SectionFiche>
        )}
        {question && (
          <>
            <SectionFiche titre={modifiable ? 'Votre réponse · modifiable' : 'Votre réponse'} aDefinir={choix ? 0 : 1}>
              {options.map((o, k) => (
                <Pressable key={o} onPress={() => setChoix(o)} style={[s.ligne, k > 0 && s.bord]} accessibilityRole="radio" accessibilityState={{ checked: choix === o }}>
                  <View style={[s.rond, choix === o && s.rondOn]}>{choix === o && <View style={s.point} />}</View>
                  <Text style={[s.option, choix === o && s.optionOn]}>{o}</Text>
                </Pressable>
              ))}
            </SectionFiche>
            <SectionFiche titre={estAutre(choix) ? 'Précision' : exigeMotif(choix) ? 'Motif' : 'Remarque'} aDefinir={(estAutre(choix) || exigeMotif(choix)) && !note.trim() ? 1 : 0}>
              <ChampFiche label={estAutre(choix) ? 'Pourquoi « Autre »' : exigeMotif(choix) ? 'Motif' : 'Remarque'} colonne>
                <SaisieFiche placeholder={placeholderNote(choix)} value={note} onChangeText={setNote} multiline />
              </ChampFiche>
            </SectionFiche>
          </>
        )}
        {/* Message lié à une note de réunion : la note est suivie là-bas (contenu reformulé) */}
        {!!hierarchie?.suivi?.(e) && (
          <SectionFiche titre="Suivi en réunion">
            <Text style={s.ou}>{`📌 ${hierarchie.suivi(e)} · une note reformulée y est liée ; elle se valide en réunion.`}</Text>
          </SectionFiche>
        )}
        {/* Transmettre, suivre en réunion, s'en occuper ; accepter ou faire reprendre une réponse (validation du 08/10) */}
        {!!hierarchie && (e.a === moi && e.statut === 'envoye' ? !e.titre.startsWith(TITRE_RAPPEL) || !!e.point : recue) && (
          <SectionFiche titre={recue ? 'La réponse' : 'Ou bien'}>
            <Text style={s.ou}>
              {[hierarchie.libelle(e) && `📍 ${hierarchie.libelle(e)}`, e.transmis_par && `Transmis par ${nomDe(e.transmis_par)}`].filter(Boolean).join(' · ') || (recue ? 'Acceptez-la, ou faites-la reprendre.' : 'Transmettez-le, suivez-le en réunion ou occupez-vous-en.')}
            </Text>
            <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
              <ActionsEchange e={e} moi={moi} hierarchie={hierarchie} nomDe={nomDe} onFait={(t) => (liste.length === 1 ? onFermer() : x && setFaits((l) => ({ ...l, [cle(x)]: { texte: t } })))} />
            </View>
          </SectionFiche>
        )}
        {modifiable ? (
          <>
            <Bouton
              label="Changer la réponse"
              busy={busy}
              disabled={!change || !reponsePrete(choix, note)}
              onPress={() => faire(() => onChangerReponse!(e, choix, note.trim()), `Réponse changée : ${choix}${note.trim() ? ` — ${note.trim()}` : ''}`)}
            />
            <Text style={s.aide}>Possible tant que {x.avec} ne l’a pas prise en compte.</Text>
          </>
        ) : attente ? (
          <Bouton label={reste > 0 ? 'Suivant ›' : 'Fermer'} busy={false} onPress={() => (reste > 0 ? passer() : onFermer())} />
        ) : question ? (
          <Bouton
            label={'Répondre'}
            busy={busy}
            disabled={!reponsePrete(choix, note)}
            onPress={() => faire(() => onRepondre(e, choix, note.trim()), `${choix}${note.trim() ? ` — ${note.trim()}` : ''}`)}
          />
        ) : (
          recue && hierarchie ? null : <Bouton label={recue ? 'Accepter ✓' : 'Lu ✓'} busy={busy} onPress={() => faire(() => onRetirer(e), recue ? 'Accepter ✓' : 'Lu ✓')} />
        )}
      </>
    );
  }

  return (
    <FormSheet superpose visible={visible} title={x ? (liste.length > 1 ? `${i + 1} sur ${liste.length}` : 'Message') : 'Terminé'} busy={busy} error={error} onClose={onFermer} fil={titre}>
      {contenu}
      {!!x && !(x.kind === 'echange' && ((x.e.de === moi && x.e.statut === 'envoye') || (x.e.a === moi && x.e.statut === 'repondu'))) && (
        <Pressable onPress={passer} disabled={busy} style={s.passer} accessibilityRole="button">
          <Text style={s.passerTexte}>{reste > 0 ? 'Passer, voir le suivant ›' : 'Passer, traiter plus tard ›'}</Text>
        </Pressable>
      )}
    </FormSheet>
  );
}

function Bouton({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} style={[s.bouton, (busy || disabled) && s.inactif]} accessibilityRole="button">
      <Text style={s.boutonTexte}>{busy ? 'Envoi…' : label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fil: { alignItems: 'center', marginBottom: 6 },
  pieces: { padding: 12, paddingTop: 6 },
  texte: { fontSize: 15, color: colors.text, lineHeight: 21, padding: 12 },
  texteNote: { fontSize: 15, color: colors.text, lineHeight: 21 },
  reponse: { fontSize: 15, fontWeight: '700', color: colors.success },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, minHeight: 46 },
  bord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rond: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  rondOn: { borderColor: colors.primary },
  point: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  option: { flex: 1, fontSize: 15, color: colors.text },
  optionOn: { fontWeight: '700' },
  bouton: { marginTop: 24, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.primary },
  boutonTexte: { color: '#fff', fontSize: 16, fontWeight: '700' },
  inactif: { opacity: 0.4 },
  ou: { fontSize: 12.5, color: colors.muted, paddingHorizontal: 12, paddingVertical: 10 },
  action: { fontSize: 15, fontWeight: '700', color: colors.primary },
  actionMeta: { flex: 1, textAlign: 'right', fontSize: 13.5, color: colors.muted },
  aide: { fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 8 },
  passer: { alignSelf: 'center', marginTop: 14, padding: 6 },
  passerTexte: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  recapTitre: { flex: 1, fontSize: 14.5, color: colors.text },
  recapFait: { maxWidth: '45%', fontSize: 13.5, fontWeight: '700', color: colors.success },
  recapPasse: { color: colors.muted, fontWeight: '600' },
});
