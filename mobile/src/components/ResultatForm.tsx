import { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { BandeauAnnuler, decrireChangement, useEnregistrementAuto } from './EnregistrementAuto';
import { useHierarchy } from '../hierarchyContext';
import { avancementResultat, texteResultat } from '../strategie';
import type { ResultatCle, ResultatCleInput } from '../types';
import { ChampFiche, SaisieFiche, SectionFiche } from './Choix';
import { DeleteSection } from './DeleteSection';
import { FormSheet, formStyles as f, Progress, TitreFiche } from './FormSheet';

interface Props {
  visible: boolean;
  resultat: ResultatCle | null;
  /** OKR du nouveau résultat clé */
  okr: string;
  onClose: () => void;
  onSave: (input: ResultatCleInput, rester?: boolean) => Promise<ResultatCle | void | undefined>;
  onDelete: (r: ResultatCle) => Promise<void>;
}

const nombre = (t: string) => t.replace(/[^0-9.,-]/g, '');

/** Résultat clé d'un OKR (lot 4) : titre, actuel → cible, unité ; l'avancement de l'OKR en est la moyenne. */
export function ResultatForm({ visible, resultat, okr, onClose, onSave, onDelete }: Props) {
  const h = useHierarchy();
  const vide = (): ResultatCleInput => ({ objectif: okr, titre: '', actuel: '', cible: '', unite: '' });
  const [form, setForm] = useState<ResultatCleInput>(vide());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (resultat) {
      const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = resultat;
      setForm(rest);
    } else setForm(vide());
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, resultat?.id]);

  const set = <K extends keyof ResultatCleInput>(k: K, v: ResultatCleInput[K]) => setForm((x) => ({ ...x, [k]: v }));
  const erreurForm = !form.titre.trim()
    ? 'Donnez un titre au résultat clé.'
    : (form.cible && isNaN(parseFloat(form.cible))) || (form.actuel && isNaN(parseFloat(form.actuel)))
      ? 'Actuel et cible doivent être des nombres.'
      : null;
  const formInitial = useMemo(() => {
    if (!resultat) return form;
    const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = resultat;
    return rest;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultat?.id]);
  const auto = useEnregistrementAuto({
    actif: !!resultat,
    cle: resultat?.id ?? '',
    initial: formInitial as ResultatCleInput,
    form,
    setForm,
    bloque: erreurForm,
    enregistrer: (x) => onSave({ ...x, titre: x.titre.trim() }, true),
    decrire: (a, b) => decrireChangement(a, b, { titre: 'Titre', actuel: 'Actuel', cible: 'Cible', unite: 'Unité' } as never, (_k, v) => v, ['titre'] as never),
  });
  const save = async () => {
    if (erreurForm) return setError(erreurForm);
    setBusy(true);
    try {
      await onSave({ ...form, titre: form.titre.trim() });
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const fermer = async () => {
    if (!resultat) return onClose();
    if (erreurForm) return setError(erreurForm);
    if (await auto.avantFermer()) onClose();
  };
  const ratio = avancementResultat(form);
  const nomOkr = h.objectifs.get(form.objectif)?.titre ?? '';

  return (
    <FormSheet
      visible={visible}
      title={resultat ? 'Résultat clé' : 'Nouveau résultat clé'}
      busy={busy}
      error={error ?? auto.erreur ?? (resultat ? erreurForm : null)}
      onClose={resultat ? fermer : onClose}
      onSave={() => void save()}
      auto={!!resultat}
      bandeau={<BandeauAnnuler bandeau={auto.bandeau} fermer={auto.fermerBandeau} />}
      onToucher={auto.fermerBandeau}
      fil={nomOkr ? `🎯 ${nomOkr}` : undefined}
    >
      <TitreFiche icone="📏" titre={form.titre} vide="Titre du résultat clé" sous={form.actuel || form.cible ? texteResultat(form) : undefined} />
      <SectionFiche titre="Élément">
        <ChampFiche label="Titre">
          <SaisieFiche placeholder="ex. Clients fidèles" value={form.titre} onChangeText={(v) => set('titre', v)} autoFocus={!resultat} />
        </ChampFiche>
      </SectionFiche>
      <SectionFiche titre="Mesure">
        <ChampFiche label="Actuel">
          <SaisieFiche placeholder="ex. 82" value={form.actuel} onChangeText={(v) => set('actuel', nombre(v))} keyboardType="decimal-pad" />
        </ChampFiche>
        <ChampFiche label="Cible">
          <SaisieFiche placeholder="ex. 90" value={form.cible} onChangeText={(v) => set('cible', nombre(v))} keyboardType="decimal-pad" />
        </ChampFiche>
        <ChampFiche label="Unité">
          <SaisieFiche placeholder="Facultatif (ex. %)" value={form.unite} onChangeText={(v) => set('unite', v)} maxLength={30} />
        </ChampFiche>
        {ratio !== null && (
          <ChampFiche label="Avancement" colonne>
            <Text style={f.hint}>{Math.round(ratio * 100)} %</Text>
            <Progress ratio={ratio} color="#1E8E3E" />
          </ChampFiche>
        )}
      </SectionFiche>
      {resultat && (
        <DeleteSection
          label="Supprimer le résultat clé"
          name={resultat.titre}
          disabled={busy}
          onDelete={async () => {
            setBusy(true);
            try {
              await onDelete(resultat);
            } catch (e) {
              setError(`Échec de la suppression : ${(e as Error).message}`);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </FormSheet>
  );
}
