import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { BandeauAnnuler, decrireChangement, useEnregistrementAuto } from './EnregistrementAuto';
import { useHierarchy } from '../hierarchyContext';
import { useOrg } from '../organisation';
import { useMoi } from '../droits';
import { droitsStrategie, epicsDeValueStream, libelleTypeVs, TYPES_VS } from '../strategie';
import { type Epic, idsDe, joindreIds, type Objectif, type ValueStream, type ValueStreamInput } from '../types';
import { ChampFiche, FeuilleMulti, LigneChoix, LigneEnfant, SaisieFiche, SectionFiche } from './Choix';
import { DeleteSection } from './DeleteSection';
import { BlocLecture, FormSheet, formStyles as f, TitreFiche } from './FormSheet';

interface Props {
  visible: boolean;
  vs: ValueStream | null;
  /** Nouveau value stream : valeurs proposées (ex. l'OKR d'où on le crée, déjà lié) */
  defaults?: Partial<ValueStreamInput>;
  onClose: () => void;
  /** `rester` : value stream existant, enregistré au fil de l'eau */
  onSave: (input: ValueStreamInput, rester?: boolean) => Promise<ValueStream | void | undefined>;
  onDelete: (v: ValueStream) => Promise<void>;
  /** Epics ajoutées ou retirées du value stream (lien porté par l'epic) */
  onLierEpics: (patchs: { id: string; value_streams: string }[]) => Promise<void>;
  onOpenEpic: (e: Epic) => void;
  onOpenOkr: (o: Objectif) => void;
  /** « ＋ Nouvel OKR » / « ＋ Nouvelle epic » : fiche de création habituelle, liée à ce value stream à l'enregistrement */
  onNouvelOkr?: (v: ValueStream) => void;
  onNouvelleEpic?: (v: ValueStream) => void;
}

const vide = (): ValueStreamInput => ({ nom: '', type: 'operationnel', description: '', portfolio: '', trains: '', okrs: '' });

/**
 * Fiche d'un value stream (lot 4) : Élément (nom, type), Rattachement (portfolio, trains), OKR liés, epics liées
 * (les features en découlent par les trains, sans lien direct). Même logique que les autres fiches : un value
 * stream existant s'enregistre au fil de l'eau ; ＋ d'une section de liens ouvre directement « Choisir des … »,
 * avec « ＋ Nouveau … » en tête.
 */
export function ValueStreamForm({ visible, vs, defaults, onClose, onSave, onDelete, onLierEpics, onOpenEpic, onOpenOkr, onNouvelOkr, onNouvelleEpic }: Props) {
  const h = useHierarchy();
  const org = useOrg();
  const moi = useMoi();
  const [form, setForm] = useState<ValueStreamInput>(vide());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choix, setChoix] = useState<'okr' | 'epic' | 'train' | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (vs) {
      const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = vs;
      setForm(rest);
    } else setForm({ ...vide(), ...defaults });
    setError(null);
    setChoix(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, vs?.id]);

  const set = <K extends keyof ValueStreamInput>(k: K, v: ValueStreamInput[K]) => setForm((x) => ({ ...x, [k]: v }));
  const erreurForm = !form.nom.trim() ? 'Donnez un nom au value stream.' : null;
  const formInitial = useMemo(() => {
    if (!vs) return form;
    const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = vs;
    return rest;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vs?.id]);
  const nomPortfolio = (id: string) => org.portfolio.get(id)?.nom ?? '';
  const nomTrain = (id: string) => org.train.get(id)?.nom ?? '';
  const auto = useEnregistrementAuto({
    actif: !!vs,
    cle: vs?.id ?? '',
    initial: formInitial as ValueStreamInput,
    form,
    setForm,
    bloque: erreurForm,
    enregistrer: (x) => onSave({ ...x, nom: x.nom.trim() }, true),
    decrire: (a, b) =>
      decrireChangement(
        a,
        b,
        { nom: 'Nom', type: 'Type', description: 'Description', portfolio: 'Portfolio', trains: 'Trains', okrs: 'OKR' } as never,
        (k, v) =>
          k === 'type' ? libelleTypeVs(v) : k === 'portfolio' ? nomPortfolio(v) : k === 'trains' ? idsDe(v).map(nomTrain).join(', ') : k === 'okrs' ? `${idsDe(v).length} OKR` : v,
        ['nom', 'description'] as never,
      ),
  });

  const save = async () => {
    if (erreurForm) return setError(erreurForm);
    setBusy(true);
    try {
      await onSave({ ...form, nom: form.nom.trim() });
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const fermer = async () => {
    if (!vs) return onClose();
    if (erreurForm) return setError(erreurForm);
    if (await auto.avantFermer()) onClose();
  };

  const droits = droitsStrategie(moi, org);
  const lecture = !!vs && !droits.lierVs(vs);
  const okrs = idsDe(form.okrs).map((id) => h.objectifs.get(id)).filter((o): o is Objectif => !!o);
  const epics = vs ? epicsDeValueStream(vs.id, h.epicList) : [];
  // Parcours train › epics : les epics d'un train sont celles dont une feature est dans ce train
  const parTrain = idsDe(form.trains).map((t) => {
    const fs = h.featureList.filter((x) => x.train === t);
    const ids = [...new Set(fs.map((x) => x.epic).filter(Boolean))];
    const eps = ids.map((id) => h.epics.get(id)).filter((e): e is Epic => !!e).map((e) => ({ e, n: fs.filter((x) => x.epic === e.id).length }));
    return { id: t, nom: nomTrain(t), eps, sansEpic: fs.filter((x) => !x.epic).length };
  });
  const dansTrains = new Set(parTrain.flatMap((t) => t.eps.map((x) => x.e.id)));
  const autresEpics = epics.filter((e) => !dansTrains.has(e.id));
  const portfolios = org.portfolios.map((p) => ({ value: p.id, label: `💼 ${p.nom}` }));
  const trains = org.trains.filter((t) => !form.portfolio || t.portfolio === form.portfolio).map((t) => ({ value: t.id, label: `🚆 ${t.nom}` }));

  /** Epics : le lien est porté par l'epic ; ajoutées tout de suite, avec « Annuler » */
  const lierEpics = async (ids: string[]) => {
    if (!vs || !ids.length) return;
    const avant = ids.map((id) => ({ id, value_streams: h.epics.get(id)?.value_streams ?? '' }));
    try {
      await onLierEpics(ids.map((id) => ({ id, value_streams: joindreIds([...idsDe(h.epics.get(id)?.value_streams), vs.id]) })));
      auto.annoncer({ texte: ids.length > 1 ? `${ids.length} epics liées à « ${vs.nom} »` : `« ${h.epics.get(ids[0])?.titre ?? ''} » liée à « ${vs.nom} »`, annuler: () => onLierEpics(avant) });
    } catch (e) {
      setError(`Non enregistré : ${(e as Error).message}`);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title={vs ? 'Value stream' : 'Nouveau value stream'}
      busy={busy}
      error={error ?? auto.erreur ?? (vs ? erreurForm : null)}
      onClose={vs ? fermer : onClose}
      onSave={() => void save()}
      auto={!!vs}
      bandeau={<BandeauAnnuler bandeau={auto.bandeau} fermer={auto.fermerBandeau} />}
      onToucher={auto.fermerBandeau}
      fil={form.portfolio ? `💼 ${nomPortfolio(form.portfolio)}` : '🎯 Stratégie'}
    >
      <TitreFiche icone="🌊" titre={form.nom} vide="Nom du value stream" sous={libelleTypeVs(form.type)} />
      <BlocLecture raison={lecture ? '🔒 Lecture seule' : undefined}>
        <SectionFiche titre="Élément">
          <ChampFiche label="Nom">
            <SaisieFiche placeholder="ex. Parcours client en ligne" value={form.nom} onChangeText={(v) => set('nom', v)} autoFocus={!vs} />
          </ChampFiche>
          <LigneChoix
            fixe
            label="Type"
            value={form.type}
            groupes={[{ options: TYPES_VS.map((t) => ({ value: t.value, label: t.label, meta: t.aide })) }]}
            onChange={(v) => v && set('type', v as ValueStreamInput['type'])}
          />
        </SectionFiche>

        <SectionFiche titre="Rattachement">
          <LigneChoix label="Portfolio" value={form.portfolio} groupes={[{ options: portfolios }]} sans="Sans portfolio" onChange={(v) => setForm((x) => ({ ...x, portfolio: v, trains: '' }))} />
        </SectionFiche>

        <SectionFiche titre={`OKR · ${okrs.length}`} onAjouter={() => setChoix('okr')} ajouterLabel="Choisir des OKR">
          {okrs.map((o) => (
            <LigneEnfant key={o.id} texte={`🎯 ${o.titre}`} onPress={() => onOpenOkr(o)} />
          ))}
          {!okrs.length && <Text style={f.videCarte}>Aucun OKR pour l'instant.</Text>}
        </SectionFiche>

        <SectionFiche titre={`Trains · ${parTrain.length}`} onAjouter={() => setChoix('train')} ajouterLabel="Choisir les trains">
          {parTrain.map((t) => (
            <View key={t.id} style={st.train}>
              <View style={st.trainLigne}>
                <Text style={st.trainNom}>🚆 {t.nom}</Text>
                <Text style={st.meta}>
                  {t.eps.length} epic{t.eps.length > 1 ? 's' : ''}
                </Text>
              </View>
              {t.eps.map(({ e, n }) => (
                <Pressable key={e.id} onPress={() => onOpenEpic(e)} style={st.epic} accessibilityRole="button">
                  <Text style={st.epicTexte} numberOfLines={1}>🗂️ {e.titre}</Text>
                  <Text style={st.meta}>
                    {n} feature{n > 1 ? 's' : ''} ›
                  </Text>
                </Pressable>
              ))}
              {t.sansEpic > 0 && <Text style={[st.meta, st.epic]}>{t.sansEpic} feature{t.sansEpic > 1 ? 's' : ''} sans epic</Text>}
            </View>
          ))}
          {!parTrain.length && <Text style={f.videCarte}>Aucun train pour l'instant.</Text>}
        </SectionFiche>
        {parTrain.length > 0 && <Text style={f.hint}>Les epics d'un train : celles dont une feature est dans ce train.</Text>}

        {vs && (
          <SectionFiche titre={`Autres epics hors trains · ${autresEpics.length}`} onAjouter={() => setChoix('epic')} ajouterLabel="Choisir des epics">
            {autresEpics.map((e) => (
              <LigneEnfant key={e.id} texte={`🗂️ ${e.titre}`} onPress={() => onOpenEpic(e)} />
            ))}
            {!autresEpics.length && <Text style={f.videCarte}>Aucune autre epic.</Text>}
          </SectionFiche>
        )}
        {vs && autresEpics.length > 0 && <Text style={f.hint}>Liées directement au value stream, sans feature dans un de ses trains.</Text>}

        <SectionFiche titre="Détails">
          <ChampFiche label="Description" colonne>
            <SaisieFiche placeholder="Pour quels clients, quelle valeur…" value={form.description} onChangeText={(v) => set('description', v)} multiline />
          </ChampFiche>
        </SectionFiche>

        {vs && droits.tout && (
          <DeleteSection
            label="Supprimer le value stream"
            name={vs.nom}
            disabled={busy}
            onDelete={async () => {
              setBusy(true);
              try {
                await onDelete(vs);
              } catch (e) {
                setError(`Échec de la suppression : ${(e as Error).message}`);
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
      </BlocLecture>

      {choix === 'okr' && (
        <FeuilleMulti
          titre="Choisir des OKR"
          groupes={[{ options: h.objectifList.filter((o) => !idsDe(form.okrs).includes(o.id)).map((o) => ({ value: o.id, label: `🎯 ${o.titre}` })) }]}
          selection={[]}
          nouveau={vs && onNouvelOkr ? { label: 'Nouvel OKR', onPress: () => { setChoix(null); onNouvelOkr(vs); } } : undefined}
          vide="Aucun autre OKR."
          libelleValider={(n) => (n ? `Ajouter ${n} OKR` : 'Ajouter')}
          onValider={(l) => {
            setChoix(null);
            if (l.length) set('okrs', joindreIds([...idsDe(form.okrs), ...l]));
          }}
          onFermer={() => setChoix(null)}
        />
      )}
      {choix === 'train' && (
        <FeuilleMulti
          titre="Choisir les trains"
          groupes={[{ options: trains }]}
          selection={idsDe(form.trains)}
          vide={form.portfolio ? 'Aucun train dans ce portfolio.' : 'Aucun train.'}
          libelleValider={() => 'Valider'}
          onValider={(l) => {
            setChoix(null);
            set('trains', joindreIds(l));
          }}
          onFermer={() => setChoix(null)}
        />
      )}
      {choix === 'epic' && vs && (
        <FeuilleMulti
          titre="Choisir des epics"
          groupes={[{ options: h.epicList.filter((e) => !idsDe(e.value_streams).includes(vs.id)).map((e) => ({ value: e.id, label: `🗂️ ${e.titre}`, meta: e.portfolio ? `💼 ${nomPortfolio(e.portfolio)}` : undefined })) }]}
          selection={[]}
          nouveau={onNouvelleEpic ? { label: 'Nouvelle epic', onPress: () => { setChoix(null); onNouvelleEpic(vs); } } : undefined}
          vide="Aucune autre epic."
          libelleValider={(n) => (n ? `Ajouter ${n} epic${n > 1 ? 's' : ''}` : 'Ajouter')}
          onValider={(l) => {
            setChoix(null);
            void lierEpics(l);
          }}
          onFermer={() => setChoix(null)}
        />
      )}
    </FormSheet>
  );
}

const st = StyleSheet.create({
  train: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: 6 },
  trainLigne: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6, gap: 8 },
  trainNom: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  epic: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 34, paddingRight: 12, paddingVertical: 6 },
  epicTexte: { flex: 1, fontSize: 14, color: colors.text },
  meta: { fontSize: 12.5, color: colors.muted },
});
