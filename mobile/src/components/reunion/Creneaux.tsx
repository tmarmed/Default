import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { creneauxDuJour, type EvenementJour } from '../../daily';
import type { Item } from '../../types';
import { LigneChoix, SectionFiche } from '../Choix';
import { Ligne, st, Vide } from './ui';

/**
 * Créneaux du plan du jour (13/10, R5 et R6) : facultatifs, vus par moi seul (rangés dans 🔒 Moi). La journée :
 * réunions de l'application et événements perso ajoutés à la main ; chaque élément coché peut recevoir un créneau.
 */
export function BlocCreneaux({
  elements,
  creneaux,
  evenements,
  onCreneau,
  onAjouterEvt,
  onRetirerEvt,
}: {
  /** Éléments cochés dans le plan du jour */
  elements: Item[];
  /** Élément → créneau */
  creneaux: Record<string, string>;
  evenements: EvenementJour[];
  onCreneau: (element: string, creneau: string) => void;
  onAjouterEvt: (e: EvenementJour) => void;
  onRetirerEvt: (e: EvenementJour) => void;
}) {
  const [saisie, setSaisie] = useState(false);
  const [heure, setHeure] = useState('');
  const [titre, setTitre] = useState('');
  const heureOk = /^([01]?\d|2[0-3]):[0-5]\d$/.test(heure.trim());
  const options = creneauxDuJour(evenements).map((x) => ({ value: x, label: x }));
  const tries = [...evenements].sort((a, b) => a.heure.padStart(5, '0').localeCompare(b.heure.padStart(5, '0')));
  return (
    <>
      <SectionFiche titre="Ma journée · vue par moi seul">
        {tries.map((x, i) => (
          <Ligne key={`${x.heure}-${x.titre}-${i}`} premiere={i === 0} texte={`${x.heure} · ${x.titre}`} sous={x.perso ? 'événement perso' : 'réunion'} onRetirer={x.perso ? () => onRetirerEvt(x) : undefined} />
        ))}
        {!tries.length && !saisie && <Vide texte="Aucune réunion aujourd’hui." />}
        {saisie ? (
          <View style={[st.saisieBloc, tries.length > 0 && st.bord]}>
            <View style={st.saisieLigne}>
              <TextInput value={heure} onChangeText={setHeure} placeholder="11:00" style={[st.saisie, { flex: 0, width: 64 }]} accessibilityLabel="Heure de l’événement" />
              <TextInput value={titre} onChangeText={setTitre} placeholder="Rendez-vous médecin" style={st.saisie} accessibilityLabel="Titre de l’événement" />
              <Pressable
                disabled={!heureOk || !titre.trim()}
                onPress={() => {
                  onAjouterEvt({ heure: heure.trim(), titre: titre.trim(), perso: true });
                  setHeure('');
                  setTitre('');
                  setSaisie(false);
                }}
                style={[st.ajouter, (!heureOk || !titre.trim()) && { opacity: 0.4 }]}
                accessibilityRole="button"
              >
                <Text style={st.ajouterTexte}>Ajouter</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setSaisie(true)} style={[st.saisieBloc, tries.length > 0 && st.bord]} accessibilityRole="button">
            <Text style={st.ajouterLien}>＋ Événement perso</Text>
          </Pressable>
        )}
      </SectionFiche>
      {elements.length > 0 && (
        <SectionFiche titre="Mes créneaux · facultatif">
          {elements.map((t) => (
            <LigneChoix
              key={t.id}
              label={`${t.type === 'story' ? '📖 ' : ''}${t.titre}`}
              value={creneaux[t.id] ?? ''}
              onChange={(v) => onCreneau(t.id, v)}
              groupes={[{ options }]}
              titreFeuille="Créneau"
              sans="Sans créneau"
              vide="Sans créneau"
              fixe
            />
          ))}
        </SectionFiche>
      )}
    </>
  );
}
