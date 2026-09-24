import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fmtDate } from '../alerts';
import { useHierarchy } from '../hierarchyContext';
import { iterationsOf, piLabel, piOf, shiftPi } from '../pi';
import { useSafe } from '../safe';
import { colors } from '../theme';
import { ETATS_EPIC } from '../types';
import {
  defaultsFor,
  descendants,
  draftAlerts,
  isChanged,
  isGone,
  keyOf,
  Level,
  LEVEL_ICON,
  LEVEL_LABEL,
  LEVEL_PLURAL,
  LEVELS,
  levelOfKey,
  loadDraft,
  mapOf,
  nodeOf,
  PARENT_LEVELS,
  resolveParent,
  summarize,
  treeOrder,
  WNode,
} from '../wizard';
import { Chips } from './Chips';
import { DateField } from './DateField';

export type WizardStart = { level: Exclude<Level, 'tache'>; id: string } | null;

interface Props {
  visible: boolean;
  /** Élément à compléter / modifier ; null = l'assistant demande quoi faire */
  start: WizardStart;
  onClose: () => void;
  /** Enregistre le brouillon (créations, modifications, déplacements, suppressions) */
  onApply: (draft: WNode[], onProgress: (done: number, total: number) => void) => Promise<void>;
}

type Phase = 'start' | 'pick' | 'steps' | 'recap';

/** 🚀 Assistant projet : créer un projet, ou compléter / modifier un projet existant à partir du niveau voulu. */
export function ProjectWizard({ visible, start, onClose, onApply }: Props) {
  const h = useHierarchy();
  const safe = useSafe();
  const [phase, setPhase] = useState<Phase>('start');
  const [draft, setDraft] = useState<WNode[]>([]);
  const [steps, setSteps] = useState<Level[]>([]);
  const [step, setStep] = useState(0);
  const [isNew, setIsNew] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counter = useRef(0);
  const scroll = useRef<ScrollView>(null);

  const levels = useMemo(() => LEVELS.filter((l) => safe.actif || l !== 'feature'), [safe.actif]);

  const beginNew = () => {
    setIsNew(true);
    setDraft([]);
    setSteps(levels);
    setStep(0);
    setPhase('steps');
  };
  const beginEdit = (level: Exclude<Level, 'tache'>, id: string) => {
    setIsNew(false);
    setDraft(loadDraft(level, id, h.data));
    setSteps(levels.slice(levels.indexOf(level)));
    setStep(0);
    setPhase('steps');
  };

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setBusy(null);
    setSearch('');
    if (start) beginEdit(start.level, start.id);
    else setPhase('start');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, start]);

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [phase, step]);

  const map = useMemo(() => mapOf(draft), [draft]);
  const patch = (key: string, p: Partial<WNode>) => setDraft((d) => d.map((n) => (n.key === key ? { ...n, ...p } : n)));

  const add = (level: Level, parentKey: string | null, titre: string) => {
    const n = counter.current++;
    const parent = parentKey ? map.get(parentKey) : undefined;
    const node: WNode = {
      key: `new:${n}`,
      level,
      titre,
      f: defaultsFor(level, parent, safe.actif, draft.filter((x) => x.level === level).length),
      parentKey,
    };
    setDraft((d) => [...d, node]);
  };

  /** Libellé d'un parent, qu'il soit dans le brouillon ou non. */
  const labelOf = (key: string | null): string => {
    if (!key) return 'Sans rattachement';
    const n = map.get(key);
    if (n) return `${LEVEL_ICON[n.level]} ${n.titre || '(sans titre)'}`;
    const level = levelOfKey(key, map);
    const id = key.slice(key.indexOf(':') + 1);
    const x =
      level === 'domaine'
        ? h.domaines.get(id)?.nom
        : level === 'objectif'
          ? h.objectifs.get(id)?.titre
          : level === 'epic'
            ? h.epics.get(id)?.titre
            : level === 'feature'
              ? h.features.get(id)?.titre
              : undefined;
    return level ? `${LEVEL_ICON[level]} ${x ?? '?'}` : '?';
  };

  /** Parents possibles d'un nœud : éléments du brouillon, puis éléments existants hors brouillon. */
  const parentOptions = (n: WNode): { value: string; label: string }[] => {
    const allowed = PARENT_LEVELS[n.level];
    const banned = new Set([n.key, ...descendants(n.key, draft).map((x) => x.key)]);
    const inDraft = draft
      .filter((x) => allowed.includes(x.level) && !banned.has(x.key) && !isGone(x, map))
      .map((x) => ({ value: x.key, label: labelOf(x.key) }));
    const outside: { value: string; label: string }[] = [];
    const push = (level: Level, id: string, label: string) => {
      const key = keyOf(level, id);
      if (!map.has(key)) outside.push({ value: key, label: `${LEVEL_ICON[level]} ${label}` });
    };
    if (allowed.includes('feature') && safe.actif) h.featureList.forEach((x) => push('feature', x.id, x.titre));
    if (allowed.includes('epic')) h.epicList.forEach((x) => push('epic', x.id, x.titre));
    if (allowed.includes('objectif')) h.objectifList.forEach((x) => push('objectif', x.id, x.titre));
    if (allowed.includes('domaine')) h.domaineList.forEach((x) => push('domaine', x.id, x.nom));
    return [{ value: '', label: 'Aucun' }, ...inDraft, ...outside];
  };

  // ---------- Étapes ----------
  const level = steps[step];

  /** Sections de l'étape : un parent et ses éléments du niveau courant. */
  const sections = useMemo(() => {
    if (phase !== 'steps' || !level) return [];
    const nodes = draft.filter((n) => n.level === level);
    const allowed = PARENT_LEVELS[level];
    const order = treeOrder(draft).map((x) => x.node);
    const parentSet = new Set<string>();
    if (allowed.length) {
      // Parents principaux : premier niveau présent (pour une tâche : features et epics)
      const primary =
        level === 'tache'
          ? ['feature', 'epic'].some((l) => draft.some((n) => n.level === l))
            ? ['feature', 'epic']
            : allowed.filter((l) => draft.some((n) => n.level === l)).slice(0, 1)
          : allowed.filter((l) => draft.some((n) => n.level === l)).slice(0, 1);
      for (const n of draft) if (primary.includes(n.level)) parentSet.add(n.key);
    }
    for (const n of nodes) if (n.parentKey) parentSet.add(n.parentKey);
    const inDraft = order.filter((n) => parentSet.has(n.key));
    const outside = [...parentSet].filter((k) => !map.has(k));
    const out: { key: string | null; nodes: WNode[] }[] = [
      ...outside.map((k) => ({ key: k as string | null, nodes: nodes.filter((n) => n.parentKey === k) })),
      ...inDraft.map((p) => ({ key: p.key as string | null, nodes: nodes.filter((n) => n.parentKey === p.key) })),
    ];
    const orphans = nodes.filter((n) => !n.parentKey);
    if (orphans.length || !out.length) out.push({ key: null, nodes: orphans });
    return out;
  }, [phase, level, draft, map]);

  /** Éléments existants proposés comme point d'attache (nouveau projet). */
  const existing = useMemo(() => {
    if (!isNew || !level || !['domaine', 'objectif', 'epic'].includes(level)) return [];
    const inDraft = (l: Level, id: string) => map.has(keyOf(l, id));
    const ds = draft.filter((n) => n.level === 'domaine').map((n) => n.id);
    const os = draft.filter((n) => n.level === 'objectif').map((n) => n.id);
    if (level === 'domaine') return h.domaineList.filter((d) => !inDraft('domaine', d.id)).map((d) => ({ id: d.id, label: `${d.icone} ${d.nom}` }));
    if (level === 'objectif')
      return h.objectifList
        .filter((o) => !inDraft('objectif', o.id) && (!ds.length || ds.includes(o.domaine)))
        .map((o) => ({ id: o.id, label: o.titre }));
    return h.epicList
      .filter((e) => !inDraft('epic', e.id) && ((!ds.length && !os.length) || os.includes(e.objectif) || ds.includes(e.domaine)))
      .map((e) => ({ id: e.id, label: e.titre }));
  }, [isNew, level, draft, map, h]);

  const attachExisting = (id: string) => {
    const x =
      level === 'domaine' ? h.domaines.get(id) : level === 'objectif' ? h.objectifs.get(id) : h.epics.get(id);
    if (x) setDraft((d) => [...d, nodeOf(level, x as never, true)]);
  };

  // ---------- Récapitulatif ----------
  const summary = useMemo(() => summarize(draft), [draft]);
  const alerts = useMemo(() => draftAlerts(draft), [draft]);
  const nChanges = summary.creations.length + summary.updates.length + summary.deletions.length;

  const save = async () => {
    setError(null);
    setBusy('Enregistrement…');
    try {
      await onApply(draft, (done, total) => setBusy(`Enregistrement… ${done}/${total}`));
      setBusy(null);
      onClose();
    } catch (e) {
      setBusy(null);
      setError(`Enregistrement interrompu : ${(e as Error).message}. Ce qui a déjà été enregistré est conservé.`);
    }
  };

  const close = () => {
    if (busy) return;
    onClose();
  };

  const title =
    phase === 'start' ? 'Assistant projet' : phase === 'pick' ? 'Choisir le point de départ' : phase === 'recap' ? 'Récapitulatif' : `${LEVEL_PLURAL[level]}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={close} hitSlop={10}>
            <Text style={s.headerBtn}>Fermer</Text>
          </Pressable>
          <Text style={s.headerTitle}>🚀 {title}</Text>
          <View style={{ width: 50 }} />
        </View>
        {phase === 'steps' && (
          <View style={s.stepper}>
            {steps.map((l, i) => (
              <Pressable key={l} onPress={() => setStep(i)} style={[s.stepDot, i === step && s.stepDotOn]} accessibilityLabel={`Étape ${LEVEL_PLURAL[l]}`}>
                <Text style={[s.stepText, i === step && s.stepTextOn]}>
                  {LEVEL_ICON[l]} {i === step ? LEVEL_PLURAL[l] : ''}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setPhase('recap')} style={s.stepDot}>
              <Text style={s.stepText}>📋</Text>
            </Pressable>
          </View>
        )}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            {error && <Text style={s.error}>{error}</Text>}

            {phase === 'start' && (
              <>
                <Text style={s.intro}>
                  L'assistant vous guide niveau par niveau : {levels.map((l) => LEVEL_PLURAL[l].toLowerCase()).join(' → ')}. Rien
                  n'est enregistré avant le récapitulatif.
                </Text>
                <BigButton icon="✨" title="Nouveau projet" sub="Partir de zéro, ou d'un domaine / objectif existant" onPress={beginNew} />
                <BigButton
                  icon="✏️"
                  title="Compléter ou modifier un projet"
                  sub="Entrer au niveau voulu : domaine, objectif, epic ou feature"
                  onPress={() => setPhase('pick')}
                />
              </>
            )}

            {phase === 'pick' && (
              <>
                <TextInput
                  style={s.input}
                  placeholder="Rechercher…"
                  placeholderTextColor={colors.muted}
                  value={search}
                  onChangeText={setSearch}
                  autoFocus
                />
                {(
                  [
                    ['domaine', h.domaineList.map((d) => ({ id: d.id, label: `${d.icone} ${d.nom}` }))],
                    ['objectif', h.objectifList.map((o) => ({ id: o.id, label: o.titre }))],
                    ['epic', h.epicList.map((e) => ({ id: e.id, label: e.titre }))],
                    ...(safe.actif ? ([['feature', h.featureList.map((f) => ({ id: f.id, label: f.titre }))]] as const) : []),
                  ] as const
                ).map(([l, list]) => {
                  const q = search.trim().toLowerCase();
                  const shown = list.filter((x) => !q || x.label.toLowerCase().includes(q));
                  if (!shown.length) return null;
                  return (
                    <View key={l}>
                      <Text style={s.section}>
                        {LEVEL_ICON[l]} {LEVEL_PLURAL[l]}
                      </Text>
                      {shown.map((x) => (
                        <Pressable key={x.id} style={s.pickRow} onPress={() => beginEdit(l, x.id)}>
                          <Text style={s.pickText} numberOfLines={1}>
                            {x.label}
                          </Text>
                          <Text style={s.chev}>›</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })}
                <Pressable onPress={() => setPhase('start')} style={s.back}>
                  <Text style={s.link}>‹ Retour</Text>
                </Pressable>
              </>
            )}

            {phase === 'steps' && level && (
              <>
                <Text style={s.stepTitle}>
                  Étape {step + 1}/{steps.length} · {LEVEL_PLURAL[level]}
                </Text>
                <Text style={s.hint}>{HINTS[level]}</Text>

                {existing.length > 0 && (
                  <View style={s.card}>
                    <Text style={s.cardTitle}>Partir d'un {LEVEL_LABEL[level].toLowerCase()} existant</Text>
                    <View style={s.wrap}>
                      {existing.slice(0, 30).map((x) => (
                        <Pressable key={x.id} style={s.chip} onPress={() => attachExisting(x.id)}>
                          <Text style={s.chipText}>+ {x.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {level === 'feature' && !draft.some((n) => n.level === 'epic' && !isGone(n, map)) && (
                  <Text style={s.hint}>Aucune epic dans ce projet : ajoutez-en une à l'étape précédente, ou passez cette étape.</Text>
                )}

                {sections.map((sec) => {
                  const parent = sec.key ? map.get(sec.key) : undefined;
                  const parentGone = parent ? isGone(parent, map) : false;
                  const canAdd = !parentGone && !(level === 'feature' && !sec.key);
                  return (
                    <View key={sec.key ?? 'none'} style={s.card}>
                      {PARENT_LEVELS[level].length > 0 && (
                        <Text style={[s.cardTitle, parentGone && s.gone]}>
                          {sec.key ? `Dans ${labelOf(sec.key)}` : 'Sans rattachement'}
                          {parent?.ctx || (sec.key && !parent) ? ' (existant)' : ''}
                          {parentGone ? ' — à supprimer' : ''}
                        </Text>
                      )}
                      {sec.nodes.map((n) => (
                        <NodeRow
                          key={n.key}
                          node={n}
                          map={map}
                          draft={draft}
                          safeOn={safe.actif}
                          parentOptions={parentOptions(n)}
                          onPatch={(p) => patch(n.key, p)}
                          onRemoveNew={() => setDraft((d) => d.filter((x) => x.key !== n.key).map((x) => (x.parentKey === n.key ? { ...x, parentKey: n.parentKey } : x)))}
                        />
                      ))}
                      {canAdd && <AddInput level={level} onAdd={(t) => add(level, sec.key, t)} />}
                    </View>
                  );
                })}

                <View style={s.nav}>
                  <Pressable
                    style={s.navBtn}
                    onPress={() => (step > 0 ? setStep(step - 1) : start ? close() : setPhase('start'))}
                  >
                    <Text style={s.link}>‹ Retour</Text>
                  </Pressable>
                  <Pressable
                    style={[s.navBtn, s.navPrimary]}
                    onPress={() => (step < steps.length - 1 ? setStep(step + 1) : setPhase('recap'))}
                  >
                    <Text style={s.navPrimaryText}>
                      {draft.some((n) => n.level === level)
                        ? 'Suivant ›'
                        : level === 'feature'
                          ? 'Pas de feature, passer ›'
                          : 'Passer ›'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {phase === 'recap' && (
              <>
                <Text style={s.hint}>
                  {nChanges === 0
                    ? 'Aucun changement pour l’instant.'
                    : [
                        summary.creations.length && `${summary.creations.length} à créer`,
                        summary.updates.length && `${summary.updates.length} à modifier`,
                        summary.deletions.length && `${summary.deletions.length} à supprimer`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </Text>
                {alerts.map((a) => (
                  <Text key={a} style={s.alert}>
                    ⚠ {a}
                  </Text>
                ))}
                <View style={s.card}>
                  {treeOrder(draft).map(({ node: n, depth }) => {
                    const gone = isGone(n, map);
                    const c = isChanged(n, map);
                    const tags = n.ctx
                      ? ['existant']
                      : gone
                        ? [n.del?.cascade ? '🗑 avec tout ce qui est rattaché' : '🗑 à supprimer']
                        : [
                            !n.id && '+ nouveau',
                            (c.titre || c.champs) && '✎ modifié',
                            c.parent && `↪ vers ${labelOf(resolveParent(n, map))}`,
                          ].filter((x): x is string => !!x);
                    return (
                      <View key={n.key} style={[s.recapRow, { paddingLeft: 4 + depth * 16 }]}>
                        <Text style={[s.recapText, gone && s.gone]} numberOfLines={2}>
                          {LEVEL_ICON[n.level]} {n.titre || '(sans titre)'}
                          <Text style={s.recapMeta}>{metaOf(n)}</Text>
                        </Text>
                        {tags.map((t) => (
                          <Text key={t} style={[s.tag, t.startsWith('🗑') && s.tagDel, t.startsWith('+') && s.tagNew]}>
                            {t}
                          </Text>
                        ))}
                      </View>
                    );
                  })}
                  {!draft.length && <Text style={s.hint}>Le projet est vide.</Text>}
                </View>
                {draft.some((n) => !n.titre.trim() && !isGone(n, map)) && (
                  <Text style={s.hint}>Les éléments sans titre ne seront pas enregistrés.</Text>
                )}
                <View style={s.nav}>
                  <Pressable style={s.navBtn} onPress={() => setPhase('steps')} disabled={!!busy}>
                    <Text style={s.link}>‹ Modifier</Text>
                  </Pressable>
                  <Pressable style={[s.navBtn, s.navPrimary, (!nChanges || !!busy) && s.disabled]} onPress={save} disabled={!nChanges || !!busy}>
                    {busy ? (
                      <View style={s.busy}>
                        <ActivityIndicator color="#fff" />
                        <Text style={s.navPrimaryText}>{busy}</Text>
                      </View>
                    ) : (
                      <Text style={s.navPrimaryText}>Enregistrer les changements</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const HINTS: Record<Level, string> = {
  domaine: 'La grande catégorie (Pro, Perso…). Choisissez-en un existant, créez-en un, ou passez.',
  objectif: 'Le résultat à atteindre, avec une échéance ou permanent. Facultatif.',
  epic: 'Les projets datés qui font avancer l’objectif.',
  feature: 'Facultatif : découpez une epic en parties livrées dans un PI. Vous pouvez aussi mettre des tâches directement sur l’epic.',
  tache: 'Les actions concrètes, dans une feature ou directement dans une epic.',
};

function metaOf(n: WNode): string {
  const f = n.f;
  const parts: string[] = [];
  if (n.level === 'objectif') parts.push(f.fin ? `→ ${fmtDate(f.fin)}` : 'permanent');
  if (n.level === 'epic') parts.push(f.debut ? `${fmtDate(f.debut)} → ${f.fin ? fmtDate(f.fin) : '∞'}` : '');
  if (n.level === 'feature' && f.pi) parts.push(`PI ${piLabel(f.pi)}${f.iteration ? ` · ${f.iteration.split('-').pop()}` : ''}`);
  if (n.level === 'tache') parts.push(f.date ? fmtDate(f.date) : f.iteration ? f.iteration.split('-').pop()! : '');
  if (f.points) parts.push(`${f.points} pt`);
  const t = parts.filter(Boolean).join(' · ');
  return t ? `  ${t}` : '';
}

function BigButton({ icon, title, sub, onPress }: { icon: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable style={s.big} onPress={onPress} accessibilityRole="button">
      <Text style={s.bigIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.bigTitle}>{title}</Text>
        <Text style={s.bigSub}>{sub}</Text>
      </View>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
}

function AddInput({ level, onAdd }: { level: Level; onAdd: (titre: string) => void }) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
  };
  return (
    <View style={s.addRow}>
      <TextInput
        style={[s.input, s.addInput]}
        placeholder={`+ ${LEVEL_LABEL[level]} (Entrée pour ajouter)`}
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        blurOnSubmit={false}
        returnKeyType="done"
      />
      {!!text.trim() && (
        <Pressable onPress={submit} style={s.addBtn} accessibilityLabel={`Ajouter ${LEVEL_LABEL[level]}`}>
          <Text style={s.addBtnText}>Ajouter</Text>
        </Pressable>
      )}
    </View>
  );
}

interface RowProps {
  node: WNode;
  map: Map<string, WNode>;
  draft: WNode[];
  safeOn: boolean;
  parentOptions: { value: string; label: string }[];
  onPatch: (p: Partial<WNode>) => void;
  onRemoveNew: () => void;
}

function NodeRow({ node: n, map, draft, safeOn, parentOptions, onPatch, onRemoveNew }: RowProps) {
  const [open, setOpen] = useState<'edit' | 'move' | null>(null);
  const gone = isGone(n, map);
  const hasKids = descendants(n.key, draft).length > 0 || (!!n.id && n.level !== 'tache');
  const setF = (k: string, v: string) => onPatch({ f: { ...n.f, [k]: v } });
  const current = piOf(new Date());
  const pis = [-1, 0, 1, 2, 3].map((i) => shiftPi(current, i));
  if (n.f.pi && !pis.includes(n.f.pi)) pis.push(n.f.pi);
  const parent = n.parentKey ? map.get(n.parentKey) : undefined;
  const taskPi = n.f.iteration ? n.f.iteration.slice(0, 7) : parent?.level === 'feature' && parent.f.pi ? parent.f.pi : current;
  const c = isChanged(n, map);

  if (n.ctx) {
    return (
      <View style={s.row}>
        <Text style={[s.rowTitle, s.ctx]}>
          {n.titre} <Text style={s.recapMeta}>existant</Text>
        </Text>
      </View>
    );
  }

  return (
    <View style={s.rowWrap}>
      <View style={s.row}>
        <TextInput
          style={[s.rowTitle, s.rowInput, gone && s.gone]}
          value={n.titre}
          onChangeText={(t) => onPatch({ titre: t })}
          editable={!gone}
          placeholder="Titre"
          placeholderTextColor={colors.muted}
        />
        {!gone && n.level !== 'domaine' && (
          <IconBtn label="✎" on={open === 'edit'} a11y="Détails" onPress={() => setOpen(open === 'edit' ? null : 'edit')} />
        )}
        {!gone && <IconBtn label="↪" on={open === 'move'} a11y="Déplacer" onPress={() => setOpen(open === 'move' ? null : 'move')} />}
        {!n.del && (
          <IconBtn label="🗑" a11y="Supprimer" onPress={() => (n.id ? onPatch({ del: { cascade: false } }) : onRemoveNew())} />
        )}
      </View>
      {!n.id && !gone && <Text style={s.small}>nouveau{metaOf(n)}</Text>}
      {!!n.id && !gone && (c.titre || c.champs || c.parent) && <Text style={s.small}>modifié{metaOf(n)}</Text>}

      {n.del && (
        <View style={s.delBox}>
          <Text style={s.delText}>À supprimer à l'enregistrement.</Text>
          {hasKids && (
            <Pressable style={s.check} onPress={() => onPatch({ del: { cascade: !n.del!.cascade } })} accessibilityRole="checkbox" accessibilityState={{ checked: n.del.cascade }}>
              <Text style={s.checkBox}>{n.del.cascade ? '☑' : '☐'}</Text>
              <Text style={s.delText}>Supprimer aussi tout ce qui est rattaché (sinon, remonte d'un niveau)</Text>
            </Pressable>
          )}
          <Pressable onPress={() => onPatch({ del: undefined })}>
            <Text style={s.link}>Annuler la suppression</Text>
          </Pressable>
        </View>
      )}

      {open === 'move' && !gone && (
        <View style={s.panel}>
          <Text style={s.panelLabel}>Rattacher à (ce qui est dessous suit)</Text>
          <Chips
            options={parentOptions}
            value={n.parentKey ?? ''}
            onChange={(v) => {
              onPatch({ parentKey: v || null });
              setOpen(null);
            }}
            compact
            wrap
          />
        </View>
      )}

      {open === 'edit' && !gone && (
        <View style={s.panel}>
          {(n.level === 'objectif' || n.level === 'epic') && (
            <>
              <Text style={s.panelLabel}>Début</Text>
              <DateField mode="date" value={n.f.debut} onChange={(v) => setF('debut', v)} placeholder="Début" />
              <Text style={s.panelLabel}>{n.level === 'objectif' ? 'Échéance' : 'Fin'}</Text>
              <DateField mode="date" value={n.f.fin} onChange={(v) => setF('fin', v)} placeholder="Fin" />
              {!!n.f.fin && (
                <Pressable onPress={() => setF('fin', '')}>
                  <Text style={s.link}>{n.level === 'objectif' ? 'Rendre permanent' : 'Rendre sans fin'}</Text>
                </Pressable>
              )}
            </>
          )}
          {n.level === 'epic' && safeOn && (
            <>
              <Text style={s.panelLabel}>État</Text>
              <Chips
                options={[{ value: '', label: 'Auto' }, ...ETATS_EPIC.map((e) => ({ value: e.value, label: e.label, color: e.color }))]}
                value={n.f.etat ?? ''}
                onChange={(v) => setF('etat', v)}
                compact
                wrap
              />
            </>
          )}
          {n.level === 'feature' && (
            <>
              <Text style={s.panelLabel}>PI</Text>
              <Chips
                options={[{ value: '', label: 'Aucun' }, ...pis.map((p) => ({ value: p, label: piLabel(p) }))]}
                value={n.f.pi}
                onChange={(v) => onPatch({ f: { ...n.f, pi: v, iteration: '' } })}
                compact
                wrap
              />
              {!!n.f.pi && (
                <>
                  <Text style={s.panelLabel}>Itération prévue</Text>
                  <Chips
                    options={[{ value: '', label: 'Non planifiée' }, ...iterationsOf(n.f.pi).map((it) => ({ value: it.key, label: it.code }))]}
                    value={n.f.iteration}
                    onChange={(v) => setF('iteration', v)}
                    compact
                    wrap
                  />
                </>
              )}
            </>
          )}
          {n.level === 'tache' && (
            <>
              <Text style={s.panelLabel}>Date</Text>
              <DateField mode="date" value={n.f.date} onChange={(v) => setF('date', v)} placeholder="Date" />
              {!!n.f.date && (
                <Pressable onPress={() => setF('date', '')}>
                  <Text style={s.link}>Sans date</Text>
                </Pressable>
              )}
              {safeOn && !n.f.date && (
                <>
                  <Text style={s.panelLabel}>Itération (PI {piLabel(taskPi)})</Text>
                  <Chips
                    options={[{ value: '', label: 'Aucune' }, ...iterationsOf(taskPi).map((it) => ({ value: it.key, label: it.code }))]}
                    value={n.f.iteration}
                    onChange={(v) => setF('iteration', v)}
                    compact
                    wrap
                  />
                </>
              )}
            </>
          )}
          {safeOn && (n.level === 'feature' || n.level === 'tache') && (
            <>
              <Text style={s.panelLabel}>Points</Text>
              <TextInput
                style={[s.input, { width: 100 }]}
                value={n.f.points}
                onChangeText={(v) => setF('points', v.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.muted}
              />
            </>
          )}
        </View>
      )}
    </View>
  );
}

function IconBtn({ label, onPress, on, a11y }: { label: string; onPress: () => void; on?: boolean; a11y: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={[s.iconBtn, on && s.iconBtnOn]} accessibilityRole="button" accessibilityLabel={a11y}>
      <Text style={s.iconText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
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
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text, flexShrink: 1 },
  headerBtn: { fontSize: 16, color: colors.primary },
  stepper: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, flexWrap: 'wrap' },
  stepDot: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.bg },
  stepDotOn: { backgroundColor: colors.primary },
  stepText: { fontSize: 13, fontWeight: '700', color: colors.text },
  stepTextOn: { color: '#fff' },
  content: { padding: 16, paddingBottom: 60, gap: 10 },
  error: { color: colors.danger, backgroundColor: '#FCE8E6', padding: 10, borderRadius: 8, fontSize: 14 },
  intro: { fontSize: 15, lineHeight: 21, color: colors.text, marginBottom: 6 },
  big: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 16 },
  bigIcon: { fontSize: 28 },
  bigTitle: { fontSize: 16.5, fontWeight: '700', color: colors.text },
  bigSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  chev: { fontSize: 22, color: colors.muted },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
  pickRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 5 },
  pickText: { flex: 1, fontSize: 15, color: colors.text },
  back: { marginTop: 12 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  hint: { fontSize: 13.5, lineHeight: 19, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 6 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.muted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.primary },
  chipText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  rowWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowTitle: { flex: 1, minWidth: 0, fontSize: 15, color: colors.text },
  rowInput: { paddingVertical: 8, paddingHorizontal: 4 },
  ctx: { paddingVertical: 8, paddingHorizontal: 4, fontWeight: '600' },
  gone: { textDecorationLine: 'line-through', color: colors.muted },
  small: { fontSize: 11.5, color: colors.muted, paddingHorizontal: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  iconBtnOn: { backgroundColor: '#E8F0FE' },
  iconText: { fontSize: 16 },
  panel: { backgroundColor: colors.bg, borderRadius: 10, padding: 10, gap: 6, marginTop: 4 },
  panelLabel: { fontSize: 12.5, fontWeight: '700', color: colors.muted, marginTop: 4 },
  delBox: { backgroundColor: '#FCE8E6', borderRadius: 10, padding: 10, gap: 8, marginTop: 4 },
  delText: { flex: 1, fontSize: 13, color: '#A50E0E' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkBox: { fontSize: 18, color: '#A50E0E' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  addInput: { flex: 1, minWidth: 0 },
  addBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary },
  addBtnText: { color: '#fff', fontWeight: '700' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10 },
  navBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  navPrimary: { backgroundColor: colors.primary, flexShrink: 1 },
  navPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alert: { color: '#A50E0E', backgroundColor: '#FCE8E6', padding: 10, borderRadius: 10, fontSize: 13.5, lineHeight: 19 },
  recapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingVertical: 5 },
  recapText: { fontSize: 14.5, color: colors.text, flexShrink: 1 },
  recapMeta: { fontSize: 12, color: colors.muted, fontWeight: '400' },
  tag: { fontSize: 11.5, fontWeight: '700', color: colors.primary, backgroundColor: '#E8F0FE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  tagNew: { color: colors.success, backgroundColor: '#E6F4EA' },
  tagDel: { color: colors.danger, backgroundColor: '#FCE8E6' },
});
