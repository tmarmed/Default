import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { creneauxLibres, type EvenementJour, finDe, type Journee } from '../../daily';
import type { Item } from '../../types';
import { LigneChoix, SectionFiche } from '../Choix';
import { Ligne, st, Vide } from './ui';

const RE_HEURE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const plus30 = (h: string) => (RE_HEURE.test(h.trim()) ? finDe({ heure: h.trim() }) : '');

/**
 * Créneaux du plan du jour (13/10, R5 et R6) : facultatifs, vus par moi seul (rangés dans 🔒 Moi). Deux niveaux :
 * Matin ou Après-midi, puis, si on veut affiner, un créneau libre de cette demi-journée (au moins 30 minutes, entre
 * les réunions du jour et les événements perso). Valeur : « Matin » ou « Matin · 9:45 → 11:00 ».
 */
export function BlocCreneaux({
  elements,
  creneaux,
  evenements,
  journee,
  onCreneau,
  onAjouterEvt,
  onRetirerEvt,
  onJournee,
}: {
  /** Éléments cochés dans le plan du jour */
  elements: Item[];
  /** Élément → créneau */
  creneaux: Record<string, string>;
  evenements: EvenementJour[];
  journee: Journee;
  onCreneau: (element: string, creneau: string) => void;
  onAjouterEvt: (e: EvenementJour) => void;
  onRetirerEvt: (e: EvenementJour) => void;
  onJournee: (j: Journee) => void;
}) {
  const [saisie, setSaisie] = useState(false);
  const [heure, setHeure] = useState('');
  const [fin, setFin] = useState('');
  const [titre, setTitre] = useState('');
  const [reglage, setReglage] = useState<Journee | null>(null);
  const finOk = RE_HEURE.test(fin.trim()) && fin.trim().padStart(5, '0') > heure.trim().padStart(5, '0');
  const pret = RE_HEURE.test(heure.trim()) && finOk && !!titre.trim();
  const libres = creneauxLibres(journee, evenements);
  const tries = [...evenements].sort((a, b) => a.heure.padStart(5, '0').localeCompare(b.heure.padStart(5, '0')));
  const reglageOk = !!reglage && Object.values(reglage).every((x) => RE_HEURE.test(x.trim()));
  const champ = (v: string, set: (x: string) => void, label: string, place: string) => (
    <TextInput value={v} onChangeText={set} placeholder={place} style={[st.saisie, { flex: 0, width: 58 }]} accessibilityLabel={label} />
  );
  return (
    <>
      <SectionFiche titre="Ma journée · vue par moi seul">
        {reglage ? (
          <View style={st.saisieBloc}>
            <View style={st.saisieLigne}>
              <Text style={st.sous}>Journée</Text>
              {champ(reglage.debut, (x) => setReglage({ ...reglage, debut: x }), 'Début de journée', '9:00')}
              <Text style={st.sous}>→</Text>
              {champ(reglage.fin, (x) => setReglage({ ...reglage, fin: x }), 'Fin de journée', '18:00')}
            </View>
            <View style={st.saisieLigne}>
              <Text style={st.sous}>Déjeuner</Text>
              {champ(reglage.dejDebut, (x) => setReglage({ ...reglage, dejDebut: x }), 'Début du déjeuner', '12:00')}
              <Text style={st.sous}>→</Text>
              {champ(reglage.dejFin, (x) => setReglage({ ...reglage, dejFin: x }), 'Fin du déjeuner', '14:00')}
              <Pressable disabled={!reglageOk} onPress={() => (onJournee(reglage), setReglage(null))} style={[st.ajouter, !reglageOk && { opacity: 0.4 }]} accessibilityRole="button">
                <Text style={st.ajouterTexte}>OK</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Ligne premiere texte={`Journée ${journee.debut} → ${journee.fin} · Déjeuner ${journee.dejDebut} → ${journee.dejFin}`} sous="touchez pour régler" onOuvrir={() => setReglage(journee)} />
        )}
        {tries.map((x, i) => (
          <Ligne key={`${x.heure}-${x.titre}-${i}`} texte={`${x.heure} → ${finDe(x)} · ${x.titre}`} sous={x.perso ? 'événement perso' : 'réunion'} onRetirer={x.perso ? () => onRetirerEvt(x) : undefined} />
        ))}
        {!tries.length && !saisie && <Vide texte="Aucune réunion aujourd’hui." />}
        {saisie ? (
          <View style={[st.saisieBloc, st.bord]}>
            <View style={st.saisieLigne}>
              {champ(heure, (x) => (setHeure(x), !fin && setFin(plus30(x))), 'Début de l’événement', '11:00')}
              <Text style={st.sous}>→</Text>
              {champ(fin, setFin, 'Fin de l’événement', '11:30')}
            </View>
            <View style={st.saisieLigne}>
              <TextInput value={titre} onChangeText={setTitre} placeholder="Rendez-vous médecin" style={st.saisie} accessibilityLabel="Titre de l’événement" />
              <Pressable
                disabled={!pret}
                onPress={() => {
                  onAjouterEvt({ heure: heure.trim(), fin: fin.trim(), titre: titre.trim(), perso: true });
                  setHeure('');
                  setFin('');
                  setTitre('');
                  setSaisie(false);
                }}
                style={[st.ajouter, !pret && { opacity: 0.4 }]}
                accessibilityRole="button"
              >
                <Text style={st.ajouterTexte}>Ajouter</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setSaisie(true)} style={[st.saisieBloc, st.bord]} accessibilityRole="button">
            <Text style={st.ajouterLien}>＋ Événement perso</Text>
          </Pressable>
        )}
      </SectionFiche>
      {elements.length > 0 && (
        <SectionFiche titre="Mes créneaux · facultatif">
          {elements.map((t, i) => {
            const v = creneaux[t.id] ?? '';
            const demi = v.startsWith('Après-midi') ? 'Après-midi' : v.startsWith('Matin') ? 'Matin' : '';
            const precis = v.includes(' · ') ? v.split(' · ')[1] : '';
            const trous = demi === 'Matin' ? libres.matin : demi === 'Après-midi' ? libres.apresMidi : [];
            return (
              <View key={t.id} style={i > 0 ? st.bord : undefined}>
                <LigneChoix
                  label={`${t.type === 'story' ? '📖 ' : ''}${t.titre}`}
                  value={demi}
                  onChange={(x) => onCreneau(t.id, x)}
                  groupes={[{ options: [{ value: 'Matin', label: 'Matin', meta: `${journee.debut} → ${journee.dejDebut}` }, { value: 'Après-midi', label: 'Après-midi', meta: `${journee.dejFin} → ${journee.fin}` }] }]}
                  titreFeuille="Moment"
                  sans="Sans créneau"
                  vide="Sans créneau"
                  fixe
                />
                {!!demi && (
                  <LigneChoix
                    label="  ↳ Affiner"
                    value={precis}
                    onChange={(x) => onCreneau(t.id, x ? `${demi} · ${x}` : demi)}
                    groupes={[{ options: trous.map((x) => ({ value: x, label: x })) }]}
                    titreFeuille={`Créneau libre · ${demi === 'Matin' ? 'matin' : 'après-midi'}`}
                    sans={`Toute la ${demi === 'Matin' ? 'matinée' : 'demi-journée'}`}
                    vide={trous.length ? `Toute la ${demi === 'Matin' ? 'matinée' : 'demi-journée'}` : 'Aucun créneau libre de 30 min'}
                    fixe
                  />
                )}
              </View>
            );
          })}
        </SectionFiche>
      )}
    </>
  );
}
