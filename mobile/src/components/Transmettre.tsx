import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MOTIFS_TRANSMISSION, type Transmission, transmissionPrete } from '../echange/transmettre';
import { colors } from '../theme';
import { type Echange, natureDe, seLitSeulement } from '../types';
import type { Hierarchie } from './EchangesView';
import { ChampFiche, type GroupeChoix, LigneChoix, SaisieFiche, SectionFiche } from './Choix';
import { FormSheet } from './FormSheet';
import { Pastilles } from './reunion/ui';

/**
 * « ↪ Transmettre » (validation du 08/10) : la même feuille pour un message reçu, une réponse à re-transmettre, ou
 * depuis une réunion. Destinataires (plusieurs : en parallèle), texte reformulé (obligatoire : le message reçu reste
 * privé), motif, « Je reste dans la boucle » ou « Je me retire », « 📌 Suivre à <réunion> » précoché (décochable,
 * réunion modifiable) avec le texte de la note, reformulé lui aussi.
 */
export function FeuilleTransmettre({
  e,
  destinataires,
  reunions,
  onFermer,
  onTransmettre,
}: {
  e: Echange;
  destinataires: GroupeChoix[];
  /** Réunions où suivre (valeur « espace|série ») : la première est proposée */
  reunions: { value: string; label: string }[];
  onFermer: () => void;
  onTransmettre: (t: Transmission) => Promise<void>;
}) {
  const [a, setA] = useState<string[]>([]);
  const [texte, setTexte] = useState('');
  const [motif, setMotif] = useState(MOTIFS_TRANSMISSION[0]);
  const [boucle, setBoucle] = useState(true);
  const [suivre, setSuivre] = useState(!!reunions.length);
  const [reunion, setReunion] = useState(reunions[0]?.value ?? '');
  const [texteNote, setTexteNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const toutes = destinataires.flatMap((g) => g.options);
  const nom = (v: string) => toutes.find((o) => o.value === v)?.label ?? v;
  const [espace, serie] = reunion.split('|');
  const t: Transmission = { a, texte, motif, boucle, suivre: suivre && reunion ? { serie, espace, texte: texteNote } : undefined };
  const pret = transmissionPrete(t);
  const envoyer = async () => {
    if (!pret) return;
    setBusy(true);
    setErreur(null);
    try {
      await onTransmettre(t);
      onFermer();
    } catch (x) {
      setErreur((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormSheet superpose visible title="Transmettre" busy={busy} error={erreur} onClose={onFermer} onSave={pret ? () => void envoyer() : undefined} libelleEnregistrer="Transmettre">
      <SectionFiche titre={`Message reçu`}>
        <Text style={s.texte} numberOfLines={3}>
          {e.titre || e.texte}
        </Text>
        <Text style={s.aide}>🔒 Il reste privé : seul votre texte part, sans les pièces jointes.</Text>
      </SectionFiche>
      <SectionFiche titre={`À · ${a.length}`} aDefinir={a.length ? 0 : 1}>
        {a.map((x) => (
          <View key={x} style={s.ligne}>
            <Text style={s.nom}>{nom(x)}</Text>
            <Pressable onPress={() => setA((l) => l.filter((y) => y !== x))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Retirer ${nom(x)}`}>
              <Text style={s.retirer}>Retirer</Text>
            </Pressable>
          </View>
        ))}
        <LigneChoix
          label={a.length ? 'Ajouter' : 'Destinataire'}
          value=""
          onChange={(v) => v && setA((l) => (l.includes(v) ? l : [...l, v]))}
          groupes={destinataires.map((g) => ({ ...g, options: g.options.filter((o) => !a.includes(o.value)) })).filter((g) => g.options.length)}
          vide="Choisir…"
          fixe
        />
        {a.length > 1 && <Text style={s.aide}>En parallèle : un maillon par personne ; fait quand toutes ont répondu.</Text>}
      </SectionFiche>
      <SectionFiche titre="Texte transmis" aDefinir={texte.trim() ? 0 : 1}>
        <ChampFiche label="Reformulé" colonne>
          <SaisieFiche placeholder="Écrivez ce que vous transmettez (obligatoire)" value={texte} onChangeText={setTexte} multiline />
        </ChampFiche>
      </SectionFiche>
      <SectionFiche titre="Motif">
        <View style={s.pad}>
          <Pastilles petit options={MOTIFS_TRANSMISSION.map((m) => ({ value: m, label: m }))} value={motif} onChange={setMotif} />
        </View>
      </SectionFiche>
      <SectionFiche titre="La réponse">
        <View style={s.pad}>
          <Pastilles
            petit
            options={[
              { value: 'boucle', label: 'Je reste dans la boucle' },
              { value: 'retire', label: 'Je me retire' },
            ]}
            value={boucle ? 'boucle' : 'retire'}
            onChange={(v) => setBoucle(v === 'boucle')}
          />
        </View>
        <Text style={s.aide}>{boucle ? 'Elle revient par vous : vous l’acceptez et la faites redescendre.' : 'Elle va directement à l’expéditeur ; vous n’êtes plus dérangé.'}</Text>
      </SectionFiche>
      {reunions.length > 0 && (
        <SectionFiche titre="Suivi en réunion" aDefinir={suivre && !texteNote.trim() ? 1 : 0}>
          <Pressable onPress={() => setSuivre((x) => !x)} style={s.ligne} accessibilityRole="checkbox" accessibilityState={{ checked: suivre }}>
            <Text style={s.nom}>{`${suivre ? '☑' : '☐'}  📌 Suivre à ${reunions.find((r) => r.value === reunion)?.label ?? ''}`}</Text>
          </Pressable>
          {suivre && (
            <>
              {reunions.length > 1 && <LigneChoix label="Réunion" value={reunion} onChange={(v) => v && setReunion(v)} groupes={[{ options: reunions }]} fixe />}
              <ChampFiche label="Texte de la note" colonne>
                <SaisieFiche placeholder="Reformulé, visible de toute la réunion (obligatoire)" value={texteNote} onChangeText={setTexteNote} multiline />
              </ChampFiche>
              <Text style={s.aide}>La note est liée au message : les noms sont visibles, pas son contenu.</Text>
            </>
          )}
        </SectionFiche>
      )}
      {!pret && <Text style={s.manque}>{!a.length ? 'Choisissez au moins un destinataire.' : !texte.trim() ? 'Écrivez le texte transmis.' : 'Écrivez le texte de la note, ou décochez « Suivre ».'}</Text>}
    </FormSheet>
  );
}

/**
 * Une feuille à un champ de texte obligatoire : faire redescendre une réponse (reformulée), « À reprendre » (motif),
 * accepter une réponse liée à une note (dernier mot reformulé), « 📌 Suivre en réunion » (texte de la note).
 */
export function FeuilleTexte({
  titre,
  explication,
  label,
  placeholder,
  bouton,
  reunions,
  onFermer,
  onValider,
}: {
  titre: string;
  explication: string;
  label: string;
  placeholder: string;
  bouton: string;
  /** Choix de la réunion (« 📌 Suivre en réunion ») : valeur « espace|série » */
  reunions?: { value: string; label: string }[];
  onFermer: () => void;
  onValider: (texte: string, reunion: string) => Promise<void>;
}) {
  const [texte, setTexte] = useState('');
  const [reunion, setReunion] = useState(reunions?.[0]?.value ?? '');
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const pret = !!texte.trim() && (!reunions || !!reunion);
  return (
    <FormSheet
      superpose
      visible
      title={titre}
      busy={busy}
      error={erreur}
      onClose={onFermer}
      libelleEnregistrer={bouton}
      onSave={
        pret
          ? () => {
              setBusy(true);
              onValider(texte.trim(), reunion)
                .then(onFermer)
                .catch((x) => setErreur((x as Error).message))
                .finally(() => setBusy(false));
            }
          : undefined
      }
    >
      <Text style={[s.aide, { marginTop: 10 }]}>{explication}</Text>
      {!!reunions?.length && (
        <SectionFiche titre="Réunion">
          <LigneChoix label="Réunion" value={reunion} onChange={(v) => v && setReunion(v)} groupes={[{ options: reunions }]} fixe />
        </SectionFiche>
      )}
      <SectionFiche titre={label} aDefinir={texte.trim() ? 0 : 1}>
        <ChampFiche label={label} colonne>
          <SaisieFiche placeholder={placeholder} value={texte} onChangeText={setTexte} multiline />
        </ChampFiche>
      </SectionFiche>
    </FormSheet>
  );
}

/**
 * Actions d'un échange (validation du 08/10), les mêmes dans la conversation et dans la fenêtre du Chat :
 * - reçu, à traiter : ↪ Transmettre · 📌 Suivre en réunion · ✓ Je m'en occupe ;
 * - réponse reçue, dans la boucle (maillon) : ✓ Accepter et faire redescendre · ↩ À reprendre · ↪ Re-transmettre ;
 * - réponse reçue, à l'origine : ✓ Accepter · ↩ À reprendre. « Valider » est réservé aux réunions.
 */
export function ActionsEchange({ e, moi, hierarchie, nomDe, onFait }: { e: Echange; moi: string; hierarchie: Hierarchie; nomDe: (id: string) => string; onFait?: (texte: string) => void }) {
  const [feuille, setFeuille] = useState<'' | 'transmettre' | 'suivre' | 'redescendre' | 'reprendre' | 'accepter'>('');
  const [busy, setBusy] = useState(false);
  const recu = e.a === moi && e.statut === 'envoye';
  const reponse = e.de === moi && e.statut === 'repondu';
  if (!recu && !reponse) return null;
  const parent = e.parent ? hierarchie.parentDe(e) : undefined;
  const vers = parent ? nomDe(parent.de) : '';
  const reunions = hierarchie.reunionsSuivi();
  const agir = async (f: () => Promise<void>, texte: string) => {
    setBusy(true);
    try {
      await f();
      onFait?.(texte);
    } finally {
      setBusy(false);
    }
  };
  const bouton = (libelle: string, onPress: () => void, principal = false) => (
    <Pressable key={libelle} disabled={busy} onPress={onPress} style={[s.action, principal && s.actionPrincipale]} accessibilityRole="button">
      <Text style={[s.actionTexte, principal && s.actionTexteP]}>{libelle}</Text>
    </Pressable>
  );
  return (
    <View style={s.actions}>
      {recu && (
        <>
          {bouton('↪ Transmettre', () => setFeuille('transmettre'))}
          {reunions.length > 0 && bouton('📌 Suivre en réunion', () => setFeuille('suivre'))}
          {!seLitSeulement(natureDe(e)) && bouton('✓ Je m’en occupe', () => void agir(() => hierarchie.onMOccuper(e), 'Pris en charge : une tâche à votre nom.'))}
        </>
      )}
      {reponse && (
        <>
          {parent
            ? bouton(`✓ Accepter et renvoyer à ${vers}`, () => setFeuille('redescendre'), true)
            : bouton('✓ Accepter', () => (e.point ? setFeuille('accepter') : void agir(() => hierarchie.onAccepter(e, ''), 'Réponse acceptée.')), true)}
          {bouton('↩ À reprendre', () => setFeuille('reprendre'))}
          {!!parent && bouton('↪ Re-transmettre', () => setFeuille('transmettre'))}
        </>
      )}
      {feuille === 'transmettre' && (
        <FeuilleTransmettre e={parent ?? e} destinataires={hierarchie.destinataires(parent ?? e)} reunions={reunions} onFermer={() => setFeuille('')} onTransmettre={(t) => agir(() => hierarchie.onTransmettre(e, t), `Transmis à ${t.a.map(nomDe).join(', ')}.`)} />
      )}
      {feuille === 'suivre' && (
        <FeuilleTexte
          titre="Suivre en réunion"
          explication="Une note reformulée est ajoutée à la réunion, liée à ce message (noms visibles, contenu non). Elle y est concrétisée ; quand elle est validée, la réponse part à l’expéditeur."
          label="Texte de la note"
          placeholder="Reformulé, visible de toute la réunion (obligatoire)"
          bouton="Ajouter à la réunion"
          reunions={reunions}
          onFermer={() => setFeuille('')}
          onValider={(texte, reunion) => agir(() => hierarchie.onSuivreEnReunion(e, reunion, texte), 'Note ajoutée à la réunion.')}
        />
      )}
      {feuille === 'redescendre' && (
        <FeuilleTexte
          titre={`Renvoyer à ${vers}`}
          explication={`Réponse de ${nomDe(e.a)} : ${e.reponse}${e.note ? ` — ${e.note}` : ''}. Reformulez ce que vous renvoyez à ${vers}.`}
          label="Réponse renvoyée"
          placeholder="Reformulée (obligatoire)"
          bouton="Renvoyer"
          onFermer={() => setFeuille('')}
          onValider={(texte) => agir(() => hierarchie.onRedescendre(e, texte), `Réponse renvoyée à ${vers}.`)}
        />
      )}
      {feuille === 'accepter' && (
        <FeuilleTexte
          titre="Accepter la réponse"
          explication="Ce message est suivi en réunion : écrivez le dernier mot de la note (reformulé). La note passe à « Fait · réponse reçue », à valider en réunion."
          label="Dernier mot"
          placeholder="Reformulé (obligatoire)"
          bouton="Accepter"
          onFermer={() => setFeuille('')}
          onValider={(texte) => agir(() => hierarchie.onAccepter(e, texte), 'Réponse acceptée ; la note est à valider en réunion.')}
        />
      )}
      {feuille === 'reprendre' && (
        <FeuilleTexte
          titre="À reprendre"
          explication={`La réponse repart chez ${nomDe(e.a)}, avec votre motif.`}
          label="Motif"
          placeholder="Motif (obligatoire)"
          bouton="Faire reprendre"
          onFermer={() => setFeuille('')}
          onValider={(texte) => agir(() => hierarchie.onAReprendre(e, texte), `À reprendre : renvoyé à ${nomDe(e.a)}.`)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 },
  action: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff' },
  actionPrincipale: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionTexte: { fontSize: 13.5, color: colors.primary, fontWeight: '600' },
  actionTexteP: { color: '#fff' },
  texte: { fontSize: 14.5, color: colors.text, paddingHorizontal: 14, paddingTop: 10 },
  aide: { fontSize: 12.5, color: colors.muted, paddingHorizontal: 14, paddingVertical: 8 },
  manque: { fontSize: 13, color: colors.warning, paddingHorizontal: 20, paddingVertical: 10 },
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  nom: { fontSize: 15, color: colors.text, flexShrink: 1 },
  retirer: { fontSize: 14, color: colors.danger },
  pad: { paddingHorizontal: 12, paddingVertical: 10 },
});
