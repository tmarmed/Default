import { typeColors } from '../theme';
import { ItemType, TYPE_ICONS, TYPE_LABELS } from '../types';
import { RangeeFiltre } from './RangeeFiltre';

export type TypeFiltre = 'tous' | ItemType | 'recurrents';

/** Filtre par type : « Tous » + liste déroulante des 8 types (et des éléments répétés), rangée standard (14/10). */
export function TypeFilter({ value, onChange }: { value: TypeFiltre; onChange: (v: TypeFiltre) => void }) {
  return (
    <RangeeFiltre<TypeFiltre>
      famille="Type"
      tous="tous"
      options={[
        ...(Object.keys(TYPE_LABELS) as ItemType[]).map((t) => ({ value: t as TypeFiltre, label: `${TYPE_ICONS[t]} ${TYPE_LABELS[t]}`, color: typeColors[t] })),
        { value: 'recurrents', label: '🔁 Répétés' },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}
