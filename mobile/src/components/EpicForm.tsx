import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { alertesEpic, type Alignement } from '../alerts';
import { addMonths, toDateString } from '../dates';
import { childrenOf, describeCounts, tasksOfEpic } from '../hierarchy';
import { formatEpicDates, progress } from '../roadmap';
import { colors } from '../theme';
import { Epic, EPIC_COULEURS, EpicInput, Feature, idsDe, Item, joindreIds } from '../types';
import { etatEpic, useSafe } from '../safe';
import { ETATS_EPIC } from '../types';
import { DateField } from './DateField';
import { DeleteSection } from './DeleteSection';
import { AutoContext, BandeauAnnuler, decrireChangement, useEnregistrementAuto } from './EnregistrementAuto';
import { TitreBarre, TitreFiche, BoutonRetour, ChildActions, CheminPile, formStyles as f, type Injection, type PileProps } from './FormSheet';
import { LinkPicker } from './LinkPicker';
import { HierarchyContext } from '../hierarchyContext';
import { EspaceChoix, useEspaceFiche, useEspaceFil } from './EspaceChoix';
import { LiaisonOrg } from './LiaisonOrg';
import { filTravail, metaTache } from '../choixTravail';
import { ChoiceSheet } from './ChoiceSheet';
import { ChampFiche, FeuilleMulti, LigneChoix, LigneEnfant, LigneMulti, ListeEnfants, SaisieFiche, SectionFiche } from './Choix';
import { SectionPointsReunion } from './PointsElement';
import { okrsParValueStreams } from '../strategie';
import { useOrg } from '../organisation';
import { consommeCalcule, euros } from '../pilotage';

interface Props {
  visible: boolean;
  /** Epic à afficher / modifier ; absente pour une création. */
  epic: Epic | null;
  items: Item[];
  onClose: () => void;
  /** `rester` : epic enregistrée avant d'ouvrir un enfant (la fiche reste ouverte) ; renvoie l'epic enregistrée */
  onSave: (input: EpicInput, rester?: boolean, ranger?: string[], rangerFeatures?: string[]) => Promise<Epic | void | undefined>;
  onDelete: (epic: Epic, cascade: boolean) => Promise<void>;
  /** Epic existante : features et tâches choisies, déplacées tout de suite (et « Annuler ») */
  onDeplacer?: (l: { kind: 'tache' | 'feature'; id: string; patch: Record<string, string> }[]) => Promise<void>;
  /** Pile de fiches (ouverte depuis une autre fiche) */
  pile?: PileProps;
  /** Élément créé dans une fiche du dessus (« ＋ Nouvel objectif ») : choisi ici */
  injection?: Injection;
  /** « ＋ Nouvel objectif / domaine » depuis le choix du rattachement */
  onNouveau?: (niveau: 'objectif' | 'domaine', defauts?: Record<string, string | undefined>) => void;
  /** Consulter une feature de l'epic (par-dessus) */
  onOpenFeature?: (f: Feature) => void;
  /** « ＋ Nouveau portfolio » (section Delivery) */
  onNouveauOrg?: (espace: string) => void;
  onOpenTask: (item: Item) => void;
  /** Case à cocher d'une tâche de la liste : la terminer (ou la rouvrir) */
  onCocherTache?: (item: Item) => void;
  /** Valeurs proposées pour une nouvelle epic (ex. objectif) */
  defaults?: Partial<EpicInput>;
  onAddFeature?: (e: Epic) => void;
  onAddTask?: (e: Epic) => void;
  onOpenWizard?: (e: Epic) => void;
  /** Aligner une tâche sur l'epic */
  onAlign?: (a: Alignement) => void;
}

const empty = (): EpicInput => {
  const today = new Date();
  return {
    titre: '',
    description: '',
    debut: toDateString(today),
    fin: toDateString(addMonths(today, 3)),
    couleur: EPIC_COULEURS[0],
    objectif: '',
    domaine: '',
    // Vide = état déduit des dates, tant qu'on n'en choisit pas un
    etat: '',
  };
};

/** Fiche d'une epic : dates, couleur, description, tâches rattachées. */
export function EpicForm({
  visible,
  epic,
  items,
  onClose,
  onSave,
  onDelete,
  onDeplacer,
  onOpenTask,
  onCocherTache,
  defaults,
  onAddFeature,
  onAddTask,
  onOpenWizard,
  onAlign,
  pile,
  injection,
  onNouveau,
  onOpenFeature,
  onNouveauOrg,
}: Props) {
  const [form, setForm] = useState<EpicInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Tâches existantes rangées dans l'epic (« Ranger une tâche existante ») : faites à l'enregistrement */
  const [ranger, setRanger] = useState<string[]>([]);
  const [rangerF, setRangerF] = useState<string[]>([]);
  const [menuPlus, setMenuPlus] = useState(false);
  const [picking, setPicking] = useState(false);
  // Espace de la fiche ; les rattachements proposés ne viennent que de cet espace
  const { espace, setEspace, h } = useEspaceFiche(visible, epic, defaults);
  const espaceFil = useEspaceFil(espace);
  const safe = useSafe();
  const org = useOrg();
  const features = epic ? h.featureList.filter((f) => f.epic === epic.id) : [];

  useEffect(() => {
    if (visible) {
      setForm(
        epic
          ? {
              titre: epic.titre,
              description: epic.description,
              debut: epic.debut,
              fin: epic.fin,
              couleur: epic.couleur,
              objectif: epic.objectif,
              domaine: epic.domaine,
              portfolio: epic.portfolio ?? '',
              value_streams: epic.value_streams ?? '',
              okrs: epic.okrs ?? '',
              budget: epic.budget ?? '',
              consomme: epic.consomme ?? '',
              // État enregistré seulement s'il a été choisi à la main (vide = déduit des dates)
              etat: epic.etat,
            }
          : { ...empty(), ...defaults },
      );
      setError(null);
      setRanger([]);
      setRangerF([]);
      setPicking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, epic?.id]);

  const set = <K extends keyof EpicInput>(key: K, value: EpicInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  /** SAFe (lot 4) : OKR directs (epic sans value stream) et OKR reçus par ses value streams (repliés) */
  const [choixOkr, setChoixOkr] = useState(false);
  const [okrVsOuverts, setOkrVsOuverts] = useState(false);
  const okrsDirects = idsDe(form.value_streams).length ? [] : [...new Set([...idsDe(form.okrs), ...(form.objectif ? [form.objectif] : [])])];
  const okrsVus = okrsDirects.map((id) => h.objectifs.get(id)).filter((o): o is NonNullable<typeof o> => !!o);
  const okrsVs = okrsParValueStreams({ ...(form as Epic), id: epic?.id ?? '' }, h.valueStreams).map((id) => h.objectifs.get(id)).filter((o): o is NonNullable<typeof o> => !!o);
  const tasks = epic ? tasksOfEpic(epic.id, items, h.featureList) : [];
  const kids = epic ? childrenOf('epic', epic.id, h.data) : null;
  // Tâches qu'on peut ranger dans l'epic : ni répétées, ni terminées, ni sous-tâches, pas déjà dans l'epic
  const dansEpic = new Set(tasks.map((t) => t.id));
  const candidats = h.items
    .filter((t) => !t.periodicite && !t.parent && t.statut !== 'termine' && !dansEpic.has(t.id) && !ranger.includes(t.id))
    .map((t) => {
      const ft = t.feature ? h.features.get(t.feature) : undefined;
      const ep = !ft && t.epic ? h.epics.get(t.epic) : undefined;
      const ailleurs = ft ? `🧩 ${ft.titre}` : ep ? `🗂️ ${ep.titre}` : t.objectif ? `🎯 ${h.objectifs.get(t.objectif)?.titre ?? ''}` : t.domaine ? (h.domaines.get(t.domaine)?.nom ?? '') : '';
      return { id: t.id, titre: t.titre, sub: ailleurs, dans: !!ailleurs };
    });
  const stats = epic ? progress(epic.id, items, h.featureList) : null;
  // Alertes calculées sur les dates en cours de saisie : le bouton ajuste les champs, puis on enregistre.
  const alertes = epic && form.debut ? alertesEpic({ id: epic.id, titre: form.titre || epic.titre, debut: form.debut, fin: form.fin }, items, h.featureList) : [];

  const save = async (rester = false): Promise<Epic | undefined> => {
    if (!form.titre.trim()) return void setError("Donnez un titre à l'epic.");
    if (!form.debut) return void setError('Choisissez une date de début.');
    if (form.fin && form.fin < form.debut) return void setError('La date de fin est avant la date de début.');
    setError(null);
    setBusy(true);
    try {
      const saved = (await onSave({ ...form, espace, titre: form.titre.trim() }, rester, ranger, rangerF)) || undefined;
      if (rester) {
        setRanger([]);
        setRangerF([]);
      }
      return saved;
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  /** Ce qui empêche d'enregistrer (null : tout va bien) */
  const verifier = (f: EpicInput): string | null =>
    !f.titre.trim() ? "Donnez un titre à l'epic." : !f.debut ? 'Choisissez une date de début.' : f.fin && f.fin < f.debut ? 'La date de fin est avant la date de début.' : null;
  const erreurForm = verifier(form);
  // L'epic telle qu'elle est enregistrée, à l'ouverture (même forme que le formulaire)
  const formInitial = useMemo(
    () =>
      epic
        ? { titre: epic.titre, description: epic.description, debut: epic.debut, fin: epic.fin, couleur: epic.couleur, objectif: epic.objectif, domaine: epic.domaine, portfolio: epic.portfolio ?? '', value_streams: epic.value_streams ?? '', okrs: epic.okrs ?? '', budget: epic.budget ?? '', consomme: epic.consomme ?? '', etat: epic.etat }
        : form,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [epic?.id],
  );
  /** Epic existante : enregistrée au fil de l'eau (bandeau « Annuler »), sans bouton Enregistrer */
  const auto = useEnregistrementAuto({
    actif: !!epic,
    cle: epic?.id ?? '',
    initial: formInitial as EpicInput,
    form,
    setForm,
    bloque: erreurForm,
    enregistrer: (f) => onSave({ ...f, espace, titre: f.titre.trim() }, true),
    decrire: (a, b) =>
      decrireChangement(a, b, { titre: 'Titre', description: 'Description', debut: 'Début', fin: 'Fin', couleur: 'Couleur', objectif: 'Objectif', domaine: 'Domaine', portfolio: 'Portfolio', etat: 'État', value_streams: 'Value streams', okrs: 'OKR', budget: 'Budget prévu', consomme: 'Consommé' }, (k, v) =>
        k === 'value_streams' ? idsDe(v).map((id) => h.valueStreams.find((x) => x.id === id)?.nom ?? '').join(', ') || 'aucun' : k === 'okrs' ? idsDe(v).map((id) => h.objectifs.get(id)?.titre ?? '').join(', ') || 'aucun' : k === 'objectif' ? (h.objectifs.get(v)?.titre ?? v) : k === 'domaine' ? (h.domaines.get(v)?.nom ?? v) : k === 'etat' ? (ETATS_EPIC.find((e) => e.value === v)?.label ?? v) : k === 'couleur' ? 'changée' : v,
      ['titre', 'description']),
  });
  /** Epic existante : features ou tâches choisies, ajoutées tout de suite (bandeau « Annuler ») */
  const ajouter = async (kind: 'feature' | 'tache', ids: string[]) => {
    if (!epic || !onDeplacer || !ids.length) return;
    const avant = ids.map((id): { kind: 'tache' | 'feature'; id: string; patch: Record<string, string> } => {
      if (kind === 'feature') return { kind, id, patch: { epic: h.features.get(id)?.epic ?? '' } };
      const t = h.items.find((x) => x.id === id);
      return { kind, id, patch: { epic: t?.epic ?? '', feature: t?.feature ?? '', objectif: t?.objectif ?? '', domaine: t?.domaine ?? '' } };
    });
    const patch: Record<string, string> = kind === 'feature' ? { epic: epic.id } : { epic: epic.id, feature: '', objectif: '', domaine: '' };
    try {
      await onDeplacer(ids.map((id) => ({ kind, id, patch })));
      const nom = kind === 'feature' ? h.features.get(ids[0])?.titre : h.items.find((x) => x.id === ids[0])?.titre;
      auto.annoncer({ texte: ids.length > 1 ? `${ids.length} ${kind === 'feature' ? 'features' : 'tâches'} ajoutées` : `« ${nom ?? ''} » ajoutée`, annuler: () => onDeplacer(avant) });
    } catch (e) {
      setError(`Non enregistré : ${(e as Error).message}`);
    }
  };
  /** Fermer (epic existante) : enregistre ce qui attend ; une valeur impossible reste affichée */
  const fermer = async () => {
    if (!epic) return onClose();
    if (erreurForm) return setError(erreurForm);
    if (await auto.avantFermer()) onClose();
  };

  /** Nouvelle epic : enregistrée d'abord, puis l'enfant s'ouvre par-dessus (il a besoin d'elle) */
  const enregistrerPuis = async (suite: (e: Epic) => void) => {
    const e = epic ?? (await save(true));
    if (e) suite(e);
  };

  // Élément créé dans une fiche du dessus (« ＋ Nouvel objectif ») : choisi ici
  useEffect(() => {
    if (!injection) return;
    // SAFe : l'OKR créé est lié à l'epic (plus de parent) ; sinon il devient son objectif
    if (injection.champ === 'objectif') setForm((x) => (safe.actif ? { ...x, okrs: joindreIds([...idsDe(x.okrs), injection.id]) } : { ...x, objectif: injection.id, domaine: '' }));
    if (injection.champ === 'domaine') setForm((x) => ({ ...x, domaine: injection.id, objectif: '' }));
    if (injection.champ === 'portfolio') setForm((x) => ({ ...x, portfolio: injection.id }));
    // Epic existante : le prochain enregistrement annonce la création, et « Annuler » la défait aussi
    if (epic && injection.supprimer) auto.lierCreation({ texte: `« ${injection.nom ?? 'Élément'} » créé et choisi`, supprimer: injection.supprimer });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injection]);

  const doDelete = async (cascade: boolean) => {
    if (!epic) return;
    setBusy(true);
    try {
      await onDelete(epic, cascade);
    } catch (e) {
      setError(`Échec de la suppression : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // Fil d'Ariane en haut : où est rangée l'epic
  const fil = filTravail({ objectif: form.objectif, domaine: form.domaine }, h);

  // Où vont les tâches si l'epic est supprimée sans cascade
  const parentObj = form.objectif ? h.objectifs.get(form.objectif) : undefined;
  const parentDom = !parentObj && form.domaine ? h.domaines.get(form.domaine) : undefined;
  const keepText = parentObj
    ? `rattachées à l'objectif « ${parentObj.titre} »`
    : parentDom
      ? `rattachées au domaine ${parentDom.icone} ${parentDom.nom}`
      : 'sans rattachement';

  return (
    <HierarchyContext.Provider value={h}>
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={[styles.header, (!!pile?.chemin || !!fil || !!espaceFil) && { borderBottomWidth: 0, paddingBottom: 6 }]}>
          <BoutonRetour pile={pile} onPress={epic ? fermer : onClose} disabled={busy} style={styles.headerBtn} fermer={!!epic} />
          <TitreBarre texte={epic ? 'Epic' : 'Nouvelle epic'} couleur={form.couleur} avecFil={!!pile?.chemin || !!fil || !!espaceFil} />
          {/* Nouvelle epic : « Enregistrer » ; epic existante : enregistrée au fil de l'eau */}
          {epic ? (
            <View style={{ width: 60 }} />
          ) : (
            <Pressable onPress={() => save()} hitSlop={10} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.headerBtn, styles.bold]}>Enregistrer</Text>}
            </Pressable>
          )}
        </View>
        <CheminPile pile={pile} fil={fil} espace={espaceFil} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onTouchStart={auto.fermerBandeau} onScrollBeginDrag={auto.fermerBandeau}>
            <AutoContext.Provider value={!!epic}>
            {(error || auto.erreur) && <Text style={styles.error}>{error ?? auto.erreur}</Text>}
            {!!epic && erreurForm && !error && <Text style={styles.error}>{erreurForm}</Text>}

            {alertes.map((a) => (
              <View key={a.key} style={styles.alert}>
                <Text style={styles.alertText}>⚠ {a.message}</Text>
                <View style={styles.alertBtns}>
                  <Pressable
                    style={styles.alertBtn}
                    onPress={() => setForm((f) => ({ ...f, ...a.patch }))}
                    accessibilityRole="button"
                  >
                    <Text style={styles.alertBtnText}>{a.bouton}</Text>
                  </Pressable>
                  {a.aligner && onAlign && (
                    <Pressable style={[styles.alertBtn, styles.alertBtn2]} onPress={() => onAlign(a.aligner!)} accessibilityRole="button">
                      <Text style={[styles.alertBtnText, styles.alertBtnText2]}>{a.aligner.bouton}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}

            <TitreFiche
              icone="🗂️"
              titre={form.titre}
              vide="Titre de l’epic"
              sous={form.debut && (!form.fin || form.fin >= form.debut) ? formatEpicDates(form) : undefined}
              couleur={form.couleur}
            />

            <SectionFiche titre="Élément">
              <ChampFiche label="Titre">
                <SaisieFiche placeholder="ex. Refonte du site web" value={form.titre} onChangeText={(v) => set('titre', v)} autoFocus={!epic} />
              </ChampFiche>
            </SectionFiche>
            <EspaceChoix
              espace={espace}
              fige={!!epic}
              onChange={(v) => {
                setEspace(v);
                setForm((x) => ({ ...x, objectif: '', domaine: '' }));
              }}
            />

            {/* SAFe : plus de domaine, l'epic est rattachée à son portfolio (section Rattachement ci-dessous) */}
            {!safe.actif && (
              <LinkPicker
                levels={['objectif', 'domaine']}
                value={form}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                onNouveau={onNouveau ? (n, d) => (n === 'objectif' || n === 'domaine') && onNouveau(n, d) : undefined}
                initial={epic ? { objectif: epic.objectif, domaine: epic.domaine } : undefined}
              />
            )}

            {safe.actif && (
              <LiaisonOrg
                espace={espace}
                niveau="epic"
                titre="Rattachement"
                valeurs={{ portfolio: form.portfolio, epic: epic?.id }}
                initial={epic ? { portfolio: epic.portfolio ?? '' } : undefined}
                onChange={(p) => setForm((x) => ({ ...x, ...p }))}
                onNouveau={onNouveauOrg ? () => onNouveauOrg(espace) : undefined}
              />
            )}

            {/* SAFe (lot 4) : value streams de l'epic ; ses OKR viennent de ses value streams, sinon liés directement */}
            {safe.actif && (
              <SectionFiche titre="Stratégie">
                <LigneMulti
                  label="Value streams"
                  values={idsDe(form.value_streams)}
                  onChange={(l) => set('value_streams', joindreIds(l))}
                  groupes={[{ options: h.valueStreams.map((v) => ({ value: v.id, label: `🌊 ${v.nom}` })) }]}
                  resume={(n) => `${n} value stream${n > 1 ? 's' : ''}`}
                />
              </SectionFiche>
            )}
            {safe.actif && (
              <SectionFiche
                titre={`OKR de l'epic · ${okrsVus.length}`}
                onAjouter={!idsDe(form.value_streams).length ? () => setChoixOkr(true) : undefined}
                ajouterLabel="Choisir des OKR"
              >
                {okrsVus.map((o) => (
                  <LigneEnfant key={o.id} texte={`🎯 ${o.titre}`} />
                ))}
                {!okrsVus.length && <Text style={f.videCarte}>{idsDe(form.value_streams).length ? 'Ses value streams n’ont pas encore d’OKR.' : 'Aucun OKR pour l’instant.'}</Text>}
              </SectionFiche>
            )}
            {safe.actif && !!idsDe(form.value_streams).length && (
              <Pressable onPress={() => setOkrVsOuverts((x) => !x)} accessibilityRole="button">
                <Text style={f.hint}>{okrVsOuverts ? '▾' : '▸'} OKR des value streams liés · {okrsVs.length}</Text>
              </Pressable>
            )}
            {safe.actif && okrVsOuverts && !!idsDe(form.value_streams).length && okrsVs.map((o) => <Text key={o.id} style={f.hint}>  🎯 {o.titre}</Text>)}

            {/* Quand : dates ; État du portefeuille (5 choix → ligne de choix), déduit des dates s'il n'est pas choisi */}
            <SectionFiche titre="Quand">
              <ChampFiche label="Début">
                <DateField nu mode="date" value={form.debut} onChange={(v) => set('debut', v)} placeholder="Date de début" />
              </ChampFiche>
              <ChampFiche label="Fin" sous="Vide : epic sans fin. Une tâche hors de ces dates est signalée par une alerte.">
                <DateField nu mode="date" value={form.fin} onChange={(v) => set('fin', v)} placeholder="Sans fin (epic infinie)" />
              </ChampFiche>
              {safe.actif && (
                <LigneChoix
                  fixe label="État"
                  value={form.etat}
                  depart={epic?.etat}
                  groupes={[{ options: ETATS_EPIC.map((e) => ({ value: e.value, label: e.label })) }]}
                  vide={`${ETATS_EPIC.find((e) => e.value === etatEpic(form, toDateString(new Date())))?.label ?? '?'} (d'après les dates)`}
                  sans="D'après les dates"
                  onChange={(v) => set('etat', v as typeof form.etat)}
                />
              )}
            </SectionFiche>

            {/* Budget (09/10) : prévu ; consommé calculé d'après les salaires (fiche Personne), modifiable à la main */}
            {safe.actif && (
              <SectionFiche titre="Budget">
                <ChampFiche label="Prévu" sous="En euros.">
                  <SaisieFiche placeholder="Facultatif (ex. 120000)" value={form.budget ?? ''} onChangeText={(v) => set('budget', v.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" />
                </ChampFiche>
                {(() => {
                  const c = epic ? consommeCalcule(epic.id, org, { items, featureList: h.featureList }) : null;
                  return (
                    <ChampFiche
                      label="Consommé"
                      sous={`Vide : calculé${c ? ` (${euros(c.euros)}, ${c.jours} j terminés${c.sansCout ? `, dont ${c.sansCout} j sans salaire renseigné` : ''})` : ''} : points terminés × jours par point × coût d’une journée du responsable (salaire ÷ 218 jours).`}
                    >
                      <SaisieFiche placeholder={c ? `Calculé : ${euros(c.euros)}` : 'Calculé'} value={form.consomme ?? ''} onChangeText={(v) => set('consomme', v.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" />
                    </ChampFiche>
                  );
                })()}
              </SectionFiche>
            )}

            <SectionPointsReunion id={epic?.id} espace={(epic as { espace?: string } | undefined)?.espace} />
            <SectionFiche titre="Détails">
              <ChampFiche label="Couleur" colonne>
                <View style={styles.swatches}>
                  {EPIC_COULEURS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => set('couleur', c)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: form.couleur === c }}
                      accessibilityLabel={`Couleur ${c}`}
                      style={[styles.swatch, { backgroundColor: c }, form.couleur === c && styles.swatchOn]}
                    />
                  ))}
                </View>
              </ChampFiche>
              <ChampFiche label="Description" colonne>
                <SaisieFiche placeholder="Objectif, périmètre, contacts…" value={form.description} onChangeText={(v) => set('description', v)} multiline />
              </ChampFiche>
            </SectionFiche>

            {safe.actif && (
              <ListeEnfants
                titre={`Features · ${features.length}`}
                enfants={features.map((f) => ({ id: f.id, texte: `🧩 ${f.titre}`, onPress: onOpenFeature ? () => onOpenFeature(f) : undefined }))}
                candidats={h.featureList
                  .filter((f) => !epic || f.epic !== epic.id)
                  .map((f) => ({ id: f.id, titre: `🧩 ${f.titre}`, ailleurs: f.epic ? `🗂️ ${h.epics.get(f.epic)?.titre ?? '?'}` : undefined }))}
                ranger={rangerF}
                setRanger={setRangerF}
                ajouterTout={epic && onDeplacer ? (ids) => void ajouter('feature', ids) : undefined}
                nouveau={onAddFeature ? () => enregistrerPuis(onAddFeature) : undefined}
                mots={{
                  nouveau: 'Nouvelle feature',
                  ranger: 'Choisir des features',
                  feuille: "Ajouter à l'epic",
                  libres: 'Sans epic',
                  autres: 'Dans une autre epic',
                  un: "Ajoutée à l'epic à l'enregistrement.",
                  plusieurs: "Ajoutées à l'epic à l'enregistrement.",
                }}
                vide="Aucune feature pour l'instant."
              />
            )}

            <SectionFiche
              titre={`Tâches · ${stats ? `${stats.done}/${stats.total} terminée${stats.done > 1 ? 's' : ''}` : ranger.length}${stats?.repeated ? ` · ${stats.repeated} répétée${stats.repeated > 1 ? 's' : ''}` : ''}`}
              onAjouter={() => setMenuPlus(true)}
              ajouterLabel="Ajouter une tâche"
            >
              {!!stats && stats.total > 0 && (
                <View style={[styles.progressTrack, { marginHorizontal: 12 }]}>
                  <View style={[styles.progressFill, { width: `${(stats.done / stats.total) * 100}%`, backgroundColor: form.couleur }]} />
                </View>
              )}
              {tasks
                .filter((t) => !t.parent)
                .map((t) => {
                  const k = tasks.filter((c) => c.parent === t.id);
                  return (
                    <LigneEnfant
                      key={t.id}
                      texte={t.titre}
                      coche={{ fait: t.statut === 'termine', enCours: t.statut === 'en_cours', onPress: onCocherTache ? () => onCocherTache(t) : undefined }}
                      meta={metaTache(t, safe.pointsJours, { faites: k.filter((c) => c.statut === 'termine').length, total: k.length })}
                      onPress={() => onOpenTask(t)}
                    />
                  );
                })}
              {ranger.map((id) => {
                const t = items.find((x) => x.id === id);
                const avant = t ? (t.feature ? h.features.get(t.feature) : undefined) : undefined;
                const avantEpic = t && !t.feature && t.epic ? h.epics.get(t.epic) : undefined;
                return (
                  <LigneEnfant
                    key={id}
                    texte={t?.titre ?? '?'}
                    coche={{ fait: false }}
                    ajoute
                    avant={avant ? `🧩 ${avant.titre}` : avantEpic ? `🗂️ ${avantEpic.titre}` : undefined}
                    onAnnuler={() => setRanger((l) => l.filter((x) => x !== id))}
                  />
                );
              })}
              {!tasks.length && !ranger.length && <Text style={[styles.muted, { padding: 12 }]}>Aucune tâche pour l'instant.</Text>}
            </SectionFiche>
            {ranger.length > 0 && <Text style={styles.hint}>Ajoutées à l'epic à l'enregistrement.</Text>}
            <ChoiceSheet
              key={`plus-${menuPlus}`}
              visible={menuPlus}
              title="Ajouter une tâche"
              choices={[
                ...(onAddTask ? [{ label: '＋ Nouvelle tâche', principal: true, onPress: () => enregistrerPuis(onAddTask) }] : []),
                { label: '☑ Choisir des tâches', suite: true, onPress: () => setPicking(true) },
              ]}
              onClose={() => setMenuPlus(false)}
            />
            {choixOkr && (
          <FeuilleMulti
            titre="Choisir des OKR"
            groupes={[{ options: h.objectifList.filter((o) => !okrsDirects.includes(o.id)).map((o) => ({ value: o.id, label: `🎯 ${o.titre}` })) }]}
            selection={[]}
            nouveau={onNouveau ? { label: 'Nouvel OKR', onPress: () => { setChoixOkr(false); onNouveau('objectif'); } } : undefined}
            vide="Aucun autre OKR."
            libelleValider={(n) => (n ? `Ajouter ${n} OKR` : 'Ajouter')}
            onValider={(l) => {
              setChoixOkr(false);
              if (l.length) setForm((x) => ({ ...x, okrs: joindreIds([...idsDe(x.okrs), ...l]) }));
            }}
            onFermer={() => setChoixOkr(false)}
          />
        )}
            {picking && (
              <FeuilleMulti
                titre="Ajouter à l'epic"
                groupes={[{ titre: 'Sans rattachement', options: candidats.filter((c) => !c.dans).map((c) => ({ value: c.id, label: c.titre, meta: c.sub })) }]}
                autres={{ titre: 'Dans une autre feature ou epic', groupes: [{ options: candidats.filter((c) => c.dans).map((c) => ({ value: c.id, label: c.titre, meta: c.sub })) }] }}
                selection={[]}
                vide="Aucune tâche à ajouter."
                libelleValider={(n) => (n ? `Ajouter ${n} tâche${n > 1 ? 's' : ''}` : 'Ajouter')}
                onValider={(l) => {
                  setPicking(false);
                  // Epic existante : ajoutées tout de suite ; nouvelle epic : à l'enregistrement
                  if (epic && onDeplacer) return void ajouter('tache', l);
                  setRanger((x) => [...x, ...l.filter((id) => !x.includes(id))]);
                }}
                onFermer={() => setPicking(false)}
              />
            )}

            {epic && stats && (
              <>
                <DeleteSection
                  label="Supprimer l'epic"
                  name={epic.titre}
                  children={
                    kids && kids.featIds.size + kids.taskIds.size
                      ? describeCounts({ objectifs: 0, epics: 0, features: kids.featIds.size, taches: kids.taskIds.size })
                      : ''
                  }
                  keepText={keepText}
                  disabled={busy}
                  onDelete={doDelete}
                />
              </>
            )}
            </AutoContext.Provider>
          </ScrollView>
        </KeyboardAvoidingView>
        <BandeauAnnuler bandeau={auto.bandeau} fermer={auto.fermerBandeau} />
      </SafeAreaView>
    </Modal>
    </HierarchyContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  headerBtn: { fontSize: 16, color: colors.primary },
  bold: { fontWeight: '600' },
  content: { padding: 16, paddingBottom: 48 },
  error: {
    color: colors.danger,
    backgroundColor: '#FCE8E6',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  preview: { borderRadius: 12, padding: 14, marginBottom: 16 },
  previewTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  previewDates: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 },
  label: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  titleInput: { fontSize: 18, fontWeight: '500' },
  notes: { minHeight: 90 },
  alert: { marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: '#FCE8E6', gap: 8 },
  alertText: { color: '#A50E0E', fontSize: 13.5, lineHeight: 19 },
  alertBtn: { maxWidth: '100%', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.danger },
  alertBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  // Boutons l'un sous l'autre : leur texte (avec les noms) peut passer à la ligne
  alertBtns: { gap: 8, alignItems: 'flex-start' },
  alertBtn2: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.danger },
  alertBtnText2: { color: colors.danger },
  hint: { marginTop: 6, fontSize: 12, lineHeight: 17, color: colors.muted },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  swatchOn: { borderWidth: 3, borderColor: colors.text },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: 8, borderRadius: 4 },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 6,
  },
  taskCheck: { fontSize: 16, color: colors.muted, width: 22, textAlign: 'center' },
  taskTitle: { flex: 1, fontSize: 15, color: colors.text },
  taskDone: { textDecorationLine: 'line-through', color: colors.muted },
  muted: { fontSize: 13, color: colors.muted },
});
