import { useEffect, useMemo, useState } from 'react';
import { BandeauAnnuler, decrireChangement, useEnregistrementAuto } from './EnregistrementAuto';
import { domaineOf } from '../hierarchy';
import { HierarchyContext, inDomain } from '../hierarchyContext';
import { EspaceChoix, useEspaceFiche, useEspaceFil } from './EspaceChoix';
import { piLabel, piOf, shiftPi } from '../pi';
import type { ObjectifPI, ObjectifPIInput } from '../types';
import { colors } from '../theme';
import { ChampFiche, LigneChoix, SaisieFiche, SectionFiche } from './Choix';
import { listeDomaines, listeEpics } from '../choixTravail';
import { DeleteSection } from './DeleteSection';
import { FormSheet, formStyles as f, TitreFiche } from './FormSheet';

interface Props {
  visible: boolean;
  objectif: ObjectifPI | null;
  defaultPi: string;
  /** Domaine proposé (filtre en cours) */
  defaultDomaine: string;
  onClose: () => void;
  /** `rester` : objectif existant enregistré au fil de l'eau, la fiche reste ouverte */
  onSave: (input: ObjectifPIInput, rester?: boolean) => Promise<void>;
  onDelete: (x: ObjectifPI, cascade: boolean) => Promise<void>;
}

const VALEURS = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((v) => ({ value: v, label: v || '—' }));

/** Objectif du PI : engagement d'un trimestre, valeur prévue en début, valeur obtenue en fin (sur 10). */
export function ObjectifPIForm({ visible, objectif, defaultPi, defaultDomaine, onClose, onSave, onDelete }: Props) {
  // Espace de la fiche ; les rattachements proposés ne viennent que de cet espace
  const { espace, setEspace, h } = useEspaceFiche(visible, objectif, { domaine: defaultDomaine });
  const espaceFil = useEspaceFil(espace);
  const empty = (): ObjectifPIInput => ({ titre: '', pi: defaultPi, type: 'engage', valeur_prevue: '', valeur_obtenue: '', domaine: defaultDomaine, epic: '' });
  const [form, setForm] = useState<ObjectifPIInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (objectif) {
        const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = objectif;
        setForm({ ...rest, domaine: rest.domaine ?? '', epic: rest.epic ?? '' });
      } else setForm(empty());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, objectif?.id]);

  const set = <K extends keyof ObjectifPIInput>(k: K, v: ObjectifPIInput[K]) => setForm((x) => ({ ...x, [k]: v }));
  const domEpic = (id: string) => domaineOf({ epic: id }, h)?.id ?? '';
  // Epics proposées : celles du domaine choisi (toutes sans domaine), sauf les terminées (garder celle déjà choisie)
  const epics = h.epicList.filter((e) => (e.id === form.epic || e.etat !== 'termine') && (!form.domaine || inDomain(form.domaine, domEpic(e.id), h)));
  const current = piOf(new Date());
  const pis = [-1, 0, 1, 2].map((n) => shiftPi(current, n));
  if (form.pi && !pis.includes(form.pi)) pis.push(form.pi);

  const erreurForm = !form.titre.trim() ? "Donnez un titre à l'objectif du PI." : !form.pi ? 'Choisissez le PI.' : null;
  // L'objectif tel qu'il est enregistré, à l'ouverture (même forme que le formulaire)
  const formInitial = useMemo(() => {
    if (!objectif) return form;
    const { id: _i, cree_le: _c, modifie_le: _m, ...rest } = objectif;
    return { ...rest, domaine: rest.domaine ?? '', epic: rest.epic ?? '' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectif?.id]);
  /** Objectif du PI existant : enregistré au fil de l'eau (bandeau « Annuler »), sans bouton Enregistrer */
  const auto = useEnregistrementAuto({
    actif: !!objectif,
    cle: objectif?.id ?? '',
    initial: formInitial as ObjectifPIInput,
    form,
    setForm,
    bloque: erreurForm,
    enregistrer: (x) => onSave({ ...x, espace, titre: x.titre.trim() }, true),
    decrire: (a, b) =>
      decrireChangement(
        a,
        b,
        { titre: 'Titre', pi: 'PI', type: 'Type', valeur_prevue: 'Valeur prévue', valeur_obtenue: 'Valeur obtenue', domaine: 'Domaine', epic: 'Epic' } as never,
        (k, v) => (k === 'pi' ? `PI ${piLabel(v)}` : k === 'domaine' ? (h.domaines.get(v)?.nom ?? v) : k === 'epic' ? (h.epics.get(v)?.titre ?? v) : k === 'type' ? (v === 'bonus' ? 'Bonus' : 'Engagé') : v),
        ['titre'] as never,
      ),
  });
  const fermer = async () => {
    if (!objectif) return onClose();
    if (erreurForm) return setError(erreurForm);
    if (await auto.avantFermer()) onClose();
  };

  const save = async () => {
    if (!form.titre.trim()) return setError("Donnez un titre à l'objectif du PI.");
    if (!form.pi) return setError('Choisissez le PI.');
    setError(null);
    setBusy(true);
    try {
      await onSave({ ...form, espace, titre: form.titre.trim() });
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HierarchyContext.Provider value={h}>
    <FormSheet
      visible={visible}
      title={objectif ? 'Objectif du PI' : 'Nouvel objectif du PI'}
      couleurTitre={colors.primary}
      espaceFil={espaceFil}
      busy={busy}
      error={error ?? auto.erreur ?? (objectif ? erreurForm : null)}
      onClose={objectif ? fermer : onClose}
      onSave={save}
      auto={!!objectif}
      bandeau={<BandeauAnnuler bandeau={auto.bandeau} fermer={auto.fermerBandeau} />}
      onToucher={auto.fermerBandeau}
    >
      <TitreFiche icone="🎯" titre={form.titre} vide="Titre de l’objectif du PI" sous={form.pi ? `PI ${piLabel(form.pi)}` : undefined} />
      <SectionFiche titre="Élément">
        <ChampFiche label="Titre">
          <SaisieFiche placeholder="Résultat à livrer (ex. Nouveau site en ligne)" value={form.titre} onChangeText={(v) => set('titre', v)} autoFocus={!objectif} />
        </ChampFiche>
        <LigneChoix
          fixe label="Type"
          value={form.type}
          depart={objectif?.type}
          groupes={[
            {
              options: [
                { value: 'engage', label: '🤝 Engagé' },
                { value: 'bonus', label: '✨ Bonus' },
              ],
            },
          ]}
          sous="Engagé : je m'y engage. Bonus : si j'ai le temps (ne compte pas dans la prévisibilité)."
          onChange={(v) => v && set('type', v as typeof form.type)}
        />
      </SectionFiche>
      <EspaceChoix
        espace={espace}
        fige={!!objectif}
        onChange={(v) => {
          setEspace(v);
          setForm((x) => ({ ...x, domaine: '', epic: '' }));
        }}
      />
      <SectionFiche titre="Planification">
        <LigneChoix
          fixe label="PI"
          value={form.pi}
          depart={objectif?.pi}
          attendu
          groupes={[{ options: pis.map((p) => ({ value: p, label: `PI ${piLabel(p)}`, badge: p === current ? { texte: 'en cours', ton: 'vert' as const } : undefined })) }]}
          libelle={(v) => `PI ${piLabel(v)}`}
          onChange={(v) => v && set('pi', v)}
        />
      </SectionFiche>
      <SectionFiche titre="Rattachement">
        <LigneChoix
          label="Domaine"
          value={form.domaine}
          depart={objectif?.domaine || undefined}
          parent
          {...listeDomaines(h)}
          sans="Sans domaine"
          // Un autre domaine : l'epic choisie n'en fait plus partie
          onChange={(v) => setForm((x) => ({ ...x, domaine: v, epic: x.epic && v && !inDomain(v, domEpic(x.epic), h) ? '' : x.epic }))}
        />
        <LigneChoix
          label="Epic"
          value={form.epic}
          depart={objectif?.epic || undefined}
          parent
          {...listeEpics({ ...h, epicList: epics }, form.epic || objectif?.epic || undefined)}
          libelle={(v) => `🗂️ ${h.epics.get(v)?.titre ?? '?'}`}
          sous="Porté par les features et les tâches de cette epic prévues dans le PI"
          sans="Sans epic"
          // Choisir une epic range aussi l'objectif dans son domaine
          onChange={(v) => setForm((x) => ({ ...x, epic: v, domaine: v ? domEpic(v) || x.domaine : x.domaine }))}
        />
      </SectionFiche>
      {/* Engagement : valeurs sur 10 (ligne de choix) */}
      <SectionFiche titre="Engagement">
        <LigneChoix
          fixe label="Valeur prévue"
          value={form.valeur_prevue}
          depart={objectif?.valeur_prevue}
          groupes={[{ options: VALEURS.filter((v) => v.value).map((v) => ({ value: v.value, label: `${v.label} / 10` })) }]}
          sous="Importance, en début de PI"
          sans="Sans valeur"
          onChange={(v) => set('valeur_prevue', v)}
        />
        <LigneChoix
          fixe label="Valeur obtenue"
          value={form.valeur_obtenue}
          depart={objectif?.valeur_obtenue}
          groupes={[{ options: VALEURS.filter((v) => v.value).map((v) => ({ value: v.value, label: `${v.label} / 10` })) }]}
          sous="À noter en fin de PI"
          sans="Sans valeur"
          onChange={(v) => set('valeur_obtenue', v)}
        />
      </SectionFiche>
      {objectif && (
        <DeleteSection
          label="Supprimer l'objectif du PI"
          name={objectif.titre}
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
      )}
    </FormSheet>
    </HierarchyContext.Provider>
  );
}
