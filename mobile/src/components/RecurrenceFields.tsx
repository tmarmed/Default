import { describeRecurrence } from '../recurrence';
import type { ItemInput, Periodicite } from '../types';
import { Chips } from './Chips';
import { ChampFiche, LigneChoix, SaisieFiche } from './Choix';
import { DateField } from './DateField';

type Value = Pick<ItemInput, 'periodicite' | 'echeance' | 'debut' | 'fin'>;

interface Props {
  value: Value;
  onChange: (patch: Partial<Value>) => void;
}

const REPETITIONS: { value: Periodicite | 'aucune'; label: string }[] = [
  { value: 'aucune', label: 'Aucune' },
  { value: 'hebdomadaire', label: 'Semaine' },
  { value: 'mensuelle', label: 'Mois' },
  { value: 'trimestrielle', label: 'Trimestre' },
  { value: 'annuelle', label: 'Année' },
];
const JOURS = ['Libre', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((label, i) => ({
  value: i === 0 ? '' : String(i),
  label,
}));
const MOIS_TRIMESTRE = ['Libre', '1er mois', '2e mois', '3e mois'].map((label, i) => ({
  value: i === 0 ? '' : String(i),
  label,
}));
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((label, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label,
}));

/**
 * Réglages de répétition : des lignes de la section « Quand » de la fiche. 5 choix ou plus : ligne de choix avec sa
 * feuille (répétition, jour de la semaine, mois) ; 4 ou moins : pastilles (moment dans le trimestre).
 */
export function RecurrenceFields({ value, onChange }: Props) {
  const p = value.periodicite;
  const [a = '', b = ''] = value.echeance.split('-');
  const compose = (x: string, y: string) => (x ? (y ? `${x}-${y}` : x) : '');
  const dayOnly = (t: string) => t.replace(/\D/g, '').slice(0, 2);
  const jour = (x: string, placeholder: string) => (
    <SaisieFiche value={x} onChangeText={(t) => onChange({ echeance: compose(a, dayOnly(t)) })} placeholder={placeholder} keyboardType="number-pad" maxLength={2} />
  );

  return (
    <>
      <LigneChoix
        fixe label="Répétition"
        value={p}
        groupes={[{ options: REPETITIONS.filter((r) => r.value !== 'aucune').map((r) => ({ value: r.value, label: `🔁 ${r.label}` })) }]}
        vide="Aucune"
        sans="Aucune"
        onChange={(v) => {
          const periodicite = v as Periodicite | '';
          // L'année demande un mois : on propose le mois en cours.
          const echeance = periodicite === 'annuelle' ? String(new Date().getMonth() + 1).padStart(2, '0') : '';
          onChange({ periodicite, echeance });
        }}
      />

      {p === 'hebdomadaire' && (
        <LigneChoix fixe label="Jour" value={a} groupes={[{ options: JOURS.filter((j) => j.value) }]} vide="Libre" sans="Libre" onChange={(v) => onChange({ echeance: v })} />
      )}

      {p === 'mensuelle' && (
        <ChampFiche label="Jour du mois">
          <SaisieFiche value={a} onChangeText={(t) => onChange({ echeance: dayOnly(t) })} placeholder="Libre : dans le mois" keyboardType="number-pad" maxLength={2} />
        </ChampFiche>
      )}

      {p === 'trimestrielle' && (
        <>
          <ChampFiche label="Moment">
            <Chips options={MOIS_TRIMESTRE} value={a} onChange={(v) => onChange({ echeance: compose(v, v ? b : '') })} compact wrap />
          </ChampFiche>
          {!!a && <ChampFiche label="Jour">{jour(b, 'Libre : dans le mois')}</ChampFiche>}
        </>
      )}

      {p === 'annuelle' && (
        <>
          <LigneChoix fixe label="Mois" value={a} groupes={[{ options: MOIS }]} onChange={(v) => v && onChange({ echeance: compose(v, b) })} />
          <ChampFiche label="Jour">{jour(b, 'Libre : dans le mois')}</ChampFiche>
        </>
      )}

      {!!p && (
        <>
          <ChampFiche label="À partir du" sous={`🔁 ${describeRecurrence(value)}`}>
            <DateField nu mode="date" value={value.debut} onChange={(v) => onChange({ debut: v })} placeholder="Aujourd'hui" />
          </ChampFiche>
          <ChampFiche label="Jusqu'au">
            <DateField nu mode="date" value={value.fin} onChange={(v) => onChange({ fin: v })} placeholder="Sans fin" />
          </ChampFiche>
        </>
      )}
    </>
  );
}

/** Message d'erreur si les réglages sont incomplets, sinon null. */
export function checkRecurrence(v: Value): string | null {
  const [a, b] = v.echeance.split('-');
  const day = (s?: string) => !s || (Number(s) >= 1 && Number(s) <= 31);
  if (v.periodicite === 'mensuelle' && !day(a)) return 'Jour du mois : entre 1 et 31.';
  if (v.periodicite === 'annuelle' && !a) return 'Choisissez le mois de la répétition.';
  if ((v.periodicite === 'annuelle' || v.periodicite === 'trimestrielle') && !day(b)) return 'Jour : entre 1 et 31.';
  if (v.debut && v.fin && v.fin < v.debut) return 'La date de fin est avant la date de début.';
  return null;
}
