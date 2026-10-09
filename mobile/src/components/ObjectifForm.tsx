import { useEffect, useMemo, useState } from 'react';
import { BandeauAnnuler, decrireChangement, useEnregistrementAuto } from './EnregistrementAuto';
import { Text } from 'react-native';
import { alertesObjectif, type Alignement } from '../alerts';
import { addMonths, toDateString } from '../dates';
import { childrenOf, describeCounts, progressObjectif } from '../hierarchy';
import { HierarchyContext } from '../hierarchyContext';
import { EspaceChoix, useEspaceFiche, useEspaceFil } from './EspaceChoix';
import { formatEpicDates } from '../roadmap';
import { EPIC_COULEURS, Epic, idsDe, joindreIds, Objectif, ObjectifInput, type ResultatCle, type ValueStream } from '../types';
import { useMoi } from '../droits';
import { useOrg } from '../organisation';
import { droitsStrategie, epicsDeValueStream, epicsDirectesDeOkr, resultatsDeOkr, sansValueStream, texteResultat, valueStreamsDeOkr } from '../strategie';
import { DateField } from './DateField';
import { DeleteSection } from './DeleteSection';
import { AlertList, BlocLecture, ColorPicker, TitreFiche, FormSheet, formStyles as f, type Injection, type PileProps, Progress } from './FormSheet';
import { LinkPicker } from './LinkPicker';
import { ChampFiche, FeuilleMulti, LigneEnfant, ListeEnfants, SaisieFiche, SectionFiche } from './Choix';
import { SectionPointsReunion } from './PointsElement';
import { filTravail } from '../choixTravail';
import { useSafe } from '../safe';

interface Props {
  visible: boolean;
  objectif: Objectif | null;
  onClose: () => void;
  /** `rester` : objectif enregistré avant d'ouvrir un enfant (la fiche reste ouverte) ; renvoie l'objectif */
  onSave: (input: ObjectifInput, rester?: boolean, ranger?: string[]) => Promise<Objectif | void | undefined>;
  pile?: PileProps;
  injection?: Injection;
  /** « ＋ Nouveau domaine » depuis le choix du domaine */
  onNouveauDomaine?: () => void;
  onDelete: (o: Objectif, cascade: boolean) => Promise<void>;
  /** Objectif existant : epics choisies, ajoutées tout de suite (et « Annuler ») */
  onDeplacer?: (l: { kind: 'epic'; id: string; patch: Record<string, string> }[]) => Promise<void>;
  onOpenEpic: (e: Epic) => void;
  /** Valeurs proposées pour un nouvel objectif (ex. domaine) */
  defaults?: Partial<ObjectifInput>;
  onAddEpic?: (o: Objectif) => void;
  onOpenWizard?: (o: Objectif) => void;
  /** Aligner un élément (epic, tâche) sur l'objectif */
  onAlign?: (a: Alignement) => void;
  /** SAFe (lot 4) : l'objectif est l'OKR — résultats clés, value streams, epics liées directement */
  onOpenResultat?: (r: ResultatCle) => void;
  onNouveauResultat?: (o: Objectif) => void;
  onOpenVs?: (v: ValueStream) => void;
  onNouveauVs?: (o: Objectif) => void;
  /** Liens OKR ↔ value streams (portés par le value stream) */
  onLierVs?: (patchs: { id: string; okrs: string }[]) => Promise<void>;
}

const empty = (): ObjectifInput => {
  const today = new Date();
  return {
    titre: '',
    description: '',
    domaine: '',
    debut: toDateString(today),
    fin: toDateString(addMonths(today, 12)),
    couleur: EPIC_COULEURS[0],
    cible: '',
    actuel: '',
    unite: '',
  };
};

const number = (t: string) => t.replace(/[^0-9.,-]/g, '');

/** Fiche d'un objectif : échéance (ou permanent), indicateur, epics, alertes. */
export function ObjectifForm({ visible, objectif, onClose, onSave, onDelete, onDeplacer, onOpenEpic, defaults, onAddEpic, onAlign, pile, injection, onNouveauDomaine, onOpenResultat, onNouveauResultat, onOpenVs, onNouveauVs, onLierVs }: Props) {
  // Espace de la fiche ; les rattachements proposés ne viennent que de cet espace
  const { espace, setEspace, h } = useEspaceFiche(visible, objectif, defaults);
  const espaceFil = useEspaceFil(espace);
  const [form, setForm] = useState<ObjectifInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Epics existantes rangées dans l'objectif : faites à l'enregistrement */
  const [ranger, setRanger] = useState<string[]>([]);
  const safe = useSafe();
  const org = useOrg();
  const moi = useMoi();
  const [choixOkr, setChoixOkr] = useState<'vs' | 'epic' | null>(null);

  useEffect(() => {
    if (visible) {
      if (objectif) {
        const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = objectif;
        setForm(rest);
      } else setForm({ ...empty(), ...defaults });
      setError(null);
      setRanger([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, objectif?.id]);

  const set = <K extends keyof ObjectifInput>(k: K, v: ObjectifInput[K]) => setForm((x) => ({ ...x, [k]: v }));
  const epics = objectif ? h.epicList.filter((e) => e.objectif === objectif.id) : [];
  const alertes = objectif && form.debut ? alertesObjectif({ id: objectif.id, titre: form.titre || objectif.titre, debut: form.debut, fin: form.fin }, h.epicList, h.items) : [];
  const progress = objectif ? progressObjectif({ ...objectif, ...form }, h.data) : null;
  const children = objectif
    ? childrenOf('objectif', objectif.id, h.data)
    : null;
  const dom = form.domaine ? h.domaines.get(form.domaine) : undefined;

  const save = async (rester = false): Promise<Objectif | undefined> => {
    if (!form.titre.trim()) return void setError("Donnez un titre à l'objectif.");
    if (!form.debut) return void setError('Choisissez une date de début.');
    if (form.fin && form.fin < form.debut) return void setError("L'échéance est avant la date de début.");
    if ((form.cible && isNaN(parseFloat(form.cible))) || (form.actuel && isNaN(parseFloat(form.actuel)))) {
      return void setError("L'indicateur doit être un nombre.");
    }
    setError(null);
    setBusy(true);
    try {
      const saved = (await onSave({ ...form, espace, titre: form.titre.trim() }, rester, ranger)) || undefined;
      if (rester) setRanger([]);
      return saved;
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  /** Nouvel objectif : enregistré d'abord, puis l'epic s'ouvre par-dessus */
  const enregistrerPuis = async (suite: (o: Objectif) => void) => {
    const o = objectif ?? (await save(true));
    if (o) suite(o);
  };
  // Domaine créé dans la fiche du dessus : choisi ici
  /** Ce qui empêche d'enregistrer (null : tout va bien) */
  const erreurForm = !form.titre.trim()
    ? "Donnez un titre à l'objectif."
    : !form.debut
      ? 'Choisissez une date de début.'
      : form.fin && form.fin < form.debut
        ? "L'échéance est avant la date de début."
        : (form.cible && isNaN(parseFloat(form.cible))) || (form.actuel && isNaN(parseFloat(form.actuel)))
          ? "L'indicateur doit être un nombre."
          : null;
  // L'objectif tel qu'il est enregistré, à l'ouverture (même forme que le formulaire)
  const formInitial = useMemo(() => {
    if (!objectif) return form;
    const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = objectif;
    return rest;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectif?.id]);
  /** Objectif existant : enregistré au fil de l'eau (bandeau « Annuler »), sans bouton Enregistrer */
  const auto = useEnregistrementAuto({
    actif: !!objectif,
    cle: objectif?.id ?? '',
    initial: formInitial as ObjectifInput,
    form,
    setForm,
    bloque: erreurForm,
    enregistrer: (x) => onSave({ ...x, espace, titre: x.titre.trim() }, true),
    decrire: (a, b) =>
      decrireChangement(
        a,
        b,
        { titre: 'Titre', description: 'Description', debut: 'Début', fin: 'Échéance', couleur: 'Couleur', domaine: 'Domaine', actuel: 'Indicateur actuel', cible: 'Cible', unite: 'Unité' } as never,
        (k, v) => (k === 'domaine' ? (h.domaines.get(v)?.nom ?? v) : k === 'couleur' ? 'changée' : v),
        ['titre', 'description'] as never,
      ),
  });
  /** Objectif existant : epics choisies, ajoutées tout de suite (bandeau « Annuler ») */
  const ajouterEpics = async (ids: string[]) => {
    if (!objectif || !onDeplacer || !ids.length) return;
    const avant = ids.map((id) => ({ kind: 'epic' as const, id, patch: { objectif: h.epics.get(id)?.objectif ?? '', domaine: h.epics.get(id)?.domaine ?? '' } }));
    try {
      await onDeplacer(ids.map((id) => ({ kind: 'epic' as const, id, patch: { objectif: objectif.id, domaine: '' } })));
      auto.annoncer({ texte: ids.length > 1 ? `${ids.length} epics ajoutées` : `« ${h.epics.get(ids[0])?.titre ?? ''} » ajoutée`, annuler: () => onDeplacer(avant) });
    } catch (e) {
      setError(`Non enregistré : ${(e as Error).message}`);
    }
  };
  /** OKR (SAFe) : value streams et epics sans value stream liés tout de suite, avec « Annuler » */
  const okrSafe = safe.actif;
  const mesVs = objectif ? valueStreamsDeOkr(objectif.id, h.valueStreams) : [];
  const mesEpics = objectif ? epicsDirectesDeOkr(objectif.id, h.epicList) : [];
  const mesKr = objectif ? resultatsDeOkr(objectif.id, h.resultats) : [];
  const lierVs = async (ids: string[]) => {
    if (!objectif || !onLierVs || !ids.length) return;
    const avant = ids.map((id) => ({ id, okrs: h.valueStreams.find((v) => v.id === id)?.okrs ?? '' }));
    try {
      await onLierVs(ids.map((id) => ({ id, okrs: joindreIds([...idsDe(h.valueStreams.find((v) => v.id === id)?.okrs), objectif.id]) })));
      auto.annoncer({ texte: `${ids.length > 1 ? `${ids.length} value streams liés` : '1 value stream lié'} à « ${objectif.titre} »`, annuler: () => onLierVs(avant) });
    } catch (e) {
      setError(`Non enregistré : ${(e as Error).message}`);
    }
  };
  const lierEpicsOkr = async (ids: string[]) => {
    if (!objectif || !onDeplacer || !ids.length) return;
    const avant = ids.map((id) => ({ kind: 'epic' as const, id, patch: { okrs: h.epics.get(id)?.okrs ?? '' } }));
    try {
      await onDeplacer(ids.map((id) => ({ kind: 'epic' as const, id, patch: { okrs: joindreIds([...idsDe(h.epics.get(id)?.okrs), objectif.id]) } })));
      auto.annoncer({ texte: `${ids.length > 1 ? `${ids.length} epics liées` : '1 epic liée'} à « ${objectif.titre} »`, annuler: () => onDeplacer(avant) });
    } catch (e) {
      setError(`Non enregistré : ${(e as Error).message}`);
    }
  };
  const lectureOkr = okrSafe && !!objectif && !droitsStrategie(moi, org).tout;
  const fermer = async () => {
    if (!objectif) return onClose();
    if (erreurForm) return setError(erreurForm);
    if (await auto.avantFermer()) onClose();
  };
  useEffect(() => {
    if (injection?.champ === 'domaine') setForm((x) => ({ ...x, domaine: injection.id }));
    // Objectif existant : le prochain enregistrement annonce la création, et « Annuler » la défait aussi
    if (objectif && injection?.supprimer) auto.lierCreation({ texte: `« ${injection.nom ?? 'Élément'} » créé et choisi`, supprimer: injection.supprimer });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injection]);

  return (
    <HierarchyContext.Provider value={h}>
    <FormSheet
      visible={visible}
      title={objectif ? (okrSafe ? 'OKR' : 'Objectif (OKR)') : okrSafe ? 'Nouvel OKR' : 'Nouvel objectif (OKR)'}
      couleurTitre={form.couleur}
      busy={busy}
      error={error ?? auto.erreur ?? (objectif ? erreurForm : null)}
      onClose={objectif ? fermer : onClose}
      onSave={() => save()}
      auto={!!objectif}
      bandeau={<BandeauAnnuler bandeau={auto.bandeau} fermer={auto.fermerBandeau} />}
      onToucher={auto.fermerBandeau}
      retour={pile?.retour}
      espaceFil={espaceFil}
      fil={filTravail({ domaine: form.domaine }, h)}
      chemin={pile?.chemin}
      onFermerTout={pile?.onFermerTout}
    >
      <AlertList alertes={alertes} onFix={(a) => setForm((x) => ({ ...x, ...a.patch }))} onAlign={onAlign} />

      <TitreFiche
        icone="🎯"
        titre={form.titre}
        vide={okrSafe ? "Titre de l'OKR" : "Titre de l'objectif"}
        sous={form.debut ? (form.fin ? formatEpicDates(form) : `${formatEpicDates(form).split(' →')[0]} → permanent`) : undefined}
        couleur={form.couleur}
      />
      <BlocLecture raison={lectureOkr ? '🔒 Lecture seule' : undefined}>

      <SectionFiche titre="Élément">
        <ChampFiche label="Titre">
          <SaisieFiche placeholder="ex. Doubler le nombre de clients" value={form.titre} onChangeText={(v) => set('titre', v)} autoFocus={!objectif} />
        </ChampFiche>
      </SectionFiche>
      <EspaceChoix
        espace={espace}
        fige={!!objectif}
        onChange={(v) => {
          setEspace(v);
          setForm((x) => ({ ...x, domaine: '' }));
        }}
      />

      <LinkPicker
        levels={['domaine']}
        value={form}
        onChange={(p) => set('domaine', p.domaine ?? '')}
        onNouveau={onNouveauDomaine ? () => onNouveauDomaine() : undefined}
        initial={objectif ? { domaine: objectif.domaine } : undefined}
        attendu={safe.actif ? 'domaine' : undefined}
      />

      <SectionFiche titre="Quand">
        <ChampFiche label="Début">
          <DateField nu mode="date" value={form.debut} onChange={(v) => set('debut', v)} placeholder="Date de début" />
        </ChampFiche>
        <ChampFiche label="Échéance" sous="Vide : objectif permanent. Jamais modifiée d'office : une epic qui la dépasse est signalée par une alerte.">
          <DateField nu mode="date" value={form.fin} onChange={(v) => set('fin', v)} placeholder="Permanent (sans échéance)" />
        </ChampFiche>
      </SectionFiche>

      {/* SAFe : l'objectif est l'OKR, mesuré par ses résultats clés (éléments à part) */}
      {okrSafe && (
        <SectionFiche titre={`Résultats clés · ${mesKr.length}`} onAjouter={onNouveauResultat ? () => void enregistrerPuis(onNouveauResultat) : undefined} ajouterLabel="Nouveau résultat clé">
          {mesKr.map((r) => (
            <LigneEnfant key={r.id} texte={`📏 ${r.titre}`} meta={texteResultat(r)} onPress={onOpenResultat ? () => onOpenResultat(r) : undefined} />
          ))}
          {!mesKr.length && <Text style={f.videCarte}>{form.cible ? `Indicateur repris : ${texteResultat(form)}. Ajoutez vos résultats clés avec ＋.` : 'Aucun résultat clé pour l’instant.'}</Text>}
        </SectionFiche>
      )}
      {/* Indicateur (résultat clé) : sans indicateur, l'avancement suit les tâches terminées */}
      {!okrSafe && <SectionFiche titre="Indicateur">
        <ChampFiche label="Actuel">
          <SaisieFiche placeholder="Facultatif (ex. 8)" value={form.actuel} onChangeText={(v) => set('actuel', number(v))} keyboardType="decimal-pad" />
        </ChampFiche>
        <ChampFiche label="Cible">
          <SaisieFiche placeholder="Facultatif (ex. 20)" value={form.cible} onChangeText={(v) => set('cible', number(v))} keyboardType="decimal-pad" />
        </ChampFiche>
        <ChampFiche label="Unité" sous="Sans indicateur, l'avancement suit les tâches terminées.">
          <SaisieFiche placeholder="Facultatif (ex. clients)" value={form.unite} onChangeText={(v) => set('unite', v)} maxLength={30} />
        </ChampFiche>
        {objectif && progress && (
          <ChampFiche label="Avancement" colonne>
            {!!progress.label && <Text style={f.hint}>{progress.label}</Text>}
            <Progress ratio={progress.ratio} color={form.couleur} />
          </ChampFiche>
        )}
      </SectionFiche>}

      <SectionPointsReunion id={objectif?.id} espace={(objectif as { espace?: string } | undefined)?.espace} />
      <SectionFiche titre="Détails">
        <ChampFiche label="Couleur" colonne>
          <ColorPicker value={form.couleur} onChange={(c) => set('couleur', c)} />
        </ChampFiche>
        <ChampFiche label="Description" colonne>
          <SaisieFiche placeholder="Pourquoi, comment mesurer…" value={form.description} onChangeText={(v) => set('description', v)} multiline />
        </ChampFiche>
      </SectionFiche>

      {okrSafe && objectif && (
        <>
          <SectionFiche titre={`Value streams · ${mesVs.length}`} onAjouter={onLierVs ? () => setChoixOkr('vs') : undefined} ajouterLabel="Choisir des value streams">
            {mesVs.map((v) => {
              const n = epicsDeValueStream(v.id, h.epicList).length;
              return <LigneEnfant key={v.id} texte={`🌊 ${v.nom}`} meta={`${n} epic${n > 1 ? 's' : ''}`} onPress={onOpenVs ? () => onOpenVs(v) : undefined} />;
            })}
            {!mesVs.length && <Text style={f.videCarte}>Aucun value stream pour l'instant.</Text>}
          </SectionFiche>
          <SectionFiche titre={`Epics liées directement · ${mesEpics.length}`} onAjouter={onDeplacer ? () => setChoixOkr('epic') : undefined} ajouterLabel="Choisir des epics">
            {mesEpics.map((e) => (
              <LigneEnfant key={e.id} texte={`🗂️ ${e.titre}`} meta="sans value stream" onPress={() => onOpenEpic(e)} />
            ))}
            {!mesEpics.length && <Text style={f.videCarte}>Seulement les epics sans value stream ; les autres suivent leur value stream.</Text>}
          </SectionFiche>
        </>
      )}
      {!okrSafe && <ListeEnfants
        titre={`Epics · ${epics.length}`}
        enfants={epics.map((e) => ({ id: e.id, texte: `🗂️ ${e.titre} · ${formatEpicDates(e).split(' · ')[0]}`, onPress: () => onOpenEpic(e) }))}
        candidats={h.epicList
          .filter((e) => !objectif || e.objectif !== objectif.id)
          .map((e) => ({
            id: e.id,
            titre: `🗂️ ${e.titre}`,
            ailleurs: e.objectif ? `🎯 ${h.objectifs.get(e.objectif)?.titre ?? '?'}` : e.domaine ? `${h.domaines.get(e.domaine)?.icone ?? ''} ${h.domaines.get(e.domaine)?.nom ?? ''}` : undefined,
          }))}
        ranger={ranger}
        setRanger={setRanger}
        ajouterTout={objectif && onDeplacer ? (ids) => void ajouterEpics(ids) : undefined}
        nouveau={onAddEpic ? () => enregistrerPuis(onAddEpic) : undefined}
        mots={{
          nouveau: 'Nouvelle epic',
          ranger: 'Choisir des epics',
          feuille: "Ajouter à l'objectif",
          libres: 'Sans objectif',
          autres: 'Dans un autre objectif',
          un: "Ajoutée à l'objectif à l'enregistrement.",
          plusieurs: "Ajoutées à l'objectif à l'enregistrement.",
        }}
        vide="Aucune epic pour l'instant."
      />}

      {objectif && progress && !lectureOkr && (
        <>
          <DeleteSection
            label={okrSafe ? "Supprimer l'OKR" : "Supprimer l'objectif"}
            name={objectif.titre}
            children={children ? (children.epicIds.size + children.taskIds.size ? describeCounts({ objectifs: 0, epics: children.epicIds.size, taches: children.taskIds.size }) : '') : ''}
            keepText={dom ? `rattaché(e)s au domaine ${dom.icone} ${dom.nom}` : 'sans rattachement'}
            disabled={busy}
            onDelete={async (cascade) => {
              setBusy(true);
              try {
                await onDelete(objectif, cascade);
              } catch (e) {
                setError(`Échec de la suppression : ${(e as Error).message}`);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
      </BlocLecture>

      {choixOkr === 'vs' && objectif && (
        <FeuilleMulti
          titre="Choisir des value streams"
          groupes={[{ options: h.valueStreams.filter((v) => !idsDe(v.okrs).includes(objectif.id)).map((v) => ({ value: v.id, label: `🌊 ${v.nom}`, meta: org.portfolio.get(v.portfolio)?.nom ? `💼 ${org.portfolio.get(v.portfolio)?.nom}` : undefined })) }]}
          selection={[]}
          nouveau={onNouveauVs ? { label: 'Nouveau value stream', onPress: () => { setChoixOkr(null); onNouveauVs(objectif); } } : undefined}
          vide="Aucun autre value stream."
          libelleValider={(n) => (n ? `Ajouter ${n} value stream${n > 1 ? 's' : ''}` : 'Ajouter')}
          onValider={(l) => {
            setChoixOkr(null);
            void lierVs(l);
          }}
          onFermer={() => setChoixOkr(null)}
        />
      )}
      {choixOkr === 'epic' && objectif && (
        <FeuilleMulti
          titre="Choisir des epics"
          groupes={[{ titre: 'Sans value stream', options: h.epicList.filter((e) => sansValueStream(e) && !mesEpics.includes(e)).map((e) => ({ value: e.id, label: `🗂️ ${e.titre}` })) }]}
          selection={[]}
          nouveau={onAddEpic ? { label: 'Nouvelle epic', onPress: () => { setChoixOkr(null); onAddEpic(objectif); } } : undefined}
          vide="Aucune autre epic sans value stream (les autres suivent leur value stream)."
          libelleValider={(n) => (n ? `Ajouter ${n} epic${n > 1 ? 's' : ''}` : 'Ajouter')}
          onValider={(l) => {
            setChoixOkr(null);
            void lierEpicsOkr(l);
          }}
          onFermer={() => setChoixOkr(null)}
        />
      )}
    </FormSheet>
    </HierarchyContext.Provider>
  );
}
