import { useEffect, useState } from 'react';
import { iterationOf, iterationsOf, piLabel } from '../pi';
import { ChoiceSheet } from './ChoiceSheet';
import { LigneChoix } from './Choix';

export type AddKind = 'newFeature' | 'pickFeature' | 'newTask' | 'pickTask';

interface Props {
  visible: boolean;
  piKey: string;
  onClose: () => void;
  /** itKey vide = sans itération (features seulement) */
  onChoose: (kind: AddKind, itKey: string) => void;
}

/**
 * Écran PI : le ＋ ouvre la feuille commune — l'itération en ligne de choix en tête, puis « ＋ Nouvelle … » et
 * « ☑ Choisir des … » (features et tâches), comme partout.
 */
export function PIAddSheet({ visible, piKey, onClose, onChoose }: Props) {
  const its = iterationsOf(piKey);
  const [itKey, setItKey] = useState('');
  const courante = iterationOf(new Date()).key;

  useEffect(() => {
    if (!visible) return;
    setItKey(courante.startsWith(`${piKey}-`) ? courante : its[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, piKey]);

  const sansIt = !itKey;
  return (
    <ChoiceSheet
      visible={visible}
      title={`Ajouter au PI ${piLabel(piKey)}`}
      onClose={onClose}
      choices={[
        { label: '＋ Nouvelle feature', principal: true, onPress: () => onChoose('newFeature', itKey) },
        { label: '☑ Choisir des features', suite: true, onPress: () => onChoose('pickFeature', itKey) },
        { label: '＋ Nouvelle tâche', principal: !sansIt, inactif: sansIt, sous: sansIt ? 'Choisissez une itération' : undefined, onPress: () => onChoose('newTask', itKey) },
        { label: '☑ Choisir des tâches', suite: true, inactif: sansIt, sous: sansIt ? 'Choisissez une itération' : undefined, onPress: () => onChoose('pickTask', itKey) },
      ]}
    >
      <LigneChoix
        label="Itération"
        value={itKey}
        groupes={[
          {
            options: its.map((it) => ({
              value: it.key,
              label: it.code,
              meta: it.label.split(' · ')[1],
              badge: it.key === courante ? { texte: 'en cours', ton: 'vert' as const } : undefined,
            })),
          },
        ]}
        libelle={(v) => its.find((it) => it.key === v)?.code ?? v}
        vide="Sans itération"
        sans="Sans itération"
        onChange={setItKey}
      />
    </ChoiceSheet>
  );
}
