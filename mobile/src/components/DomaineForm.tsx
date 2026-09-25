import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { childrenOf, describeCounts } from '../hierarchy';
import { HierarchyContext } from '../hierarchyContext';
import { EspaceChoix, useEspaceFiche } from './EspaceChoix';
import { colors } from '../theme';
import { DOMAINE_ICONES, Domaine, DomaineInput, EPIC_COULEURS, Objectif } from '../types';
import { DeleteSection } from './DeleteSection';
import { Chips } from './Chips';
import { ChildActions, ColorPicker, Field, FormSheet, formStyles as f, Label } from './FormSheet';

interface Props {
  visible: boolean;
  domaine: Domaine | null;
  onClose: () => void;
  onSave: (input: DomaineInput) => Promise<void>;
  onDelete: (d: Domaine, cascade: boolean) => Promise<void>;
  onOpenObjectif: (o: Objectif) => void;
  /** + Objectif dans ce domaine */
  onAddObjectif?: (d: Domaine) => void;
  onOpenWizard?: (d: Domaine) => void;
  /** Espace proposé pour un nouveau domaine */
  defaultEspace?: string;
}

/** Fiche d'un domaine (Pro, Perso…) : nom, icône, couleur, objectifs. */
export function DomaineForm({ visible, domaine, onClose, onSave, onDelete, onOpenObjectif, onAddObjectif, onOpenWizard, defaultEspace }: Props) {
  // Espace de la fiche ; les rattachements proposés ne viennent que de cet espace
  const { espace, setEspace, h } = useEspaceFiche(visible, domaine, defaultEspace ? { espace: defaultEspace } : undefined);
  const [form, setForm] = useState<DomaineInput>({ nom: '', icone: DOMAINE_ICONES[0], couleur: EPIC_COULEURS[0], parent: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setForm(domaine ? { nom: domaine.nom, icone: domaine.icone, couleur: domaine.couleur, parent: domaine.parent ?? '' } : { nom: '', icone: DOMAINE_ICONES[0], couleur: EPIC_COULEURS[0], parent: '' });
      setError(null);
    }
  }, [visible, domaine]);

  // Sous-domaine : un seul niveau, sous un domaine principal du même espace
  const sousDomaines = domaine ? h.domaineList.filter((d) => d.parent === domaine.id) : [];
  const principaux = h.domaineList.filter((d) => !d.parent && d.id !== domaine?.id);
  const objectifs = domaine ? h.objectifList.filter((o) => o.domaine === domaine.id) : [];
  const c = domaine ? childrenOf('domaine', domaine.id, h.data) : null;
  // Sous-domaines : supprimés avec lui (et leur contenu) en cascade, sinon ils deviennent des domaines principaux
  const nomsSous = sousDomaines.map((d) => `${d.icone} ${d.nom}`).join(', ');
  const contenu = c && c.objIds.size + c.epicIds.size + c.taskIds.size ? describeCounts({ objectifs: c.objIds.size, epics: c.epicIds.size, taches: c.taskIds.size }) : '';
  const children = [sousDomaines.length ? `${sousDomaines.length > 1 ? 'les sous-domaines' : 'le sous-domaine'} ${nomsSous}` : '', contenu].filter(Boolean).join(', ');
  const keepText = sousDomaines.length
    ? `sans domaine pour ce qui est rangé directement dans ${domaine?.nom} ; ${nomsSous} ${sousDomaines.length > 1 ? 'deviennent des domaines principaux' : 'devient un domaine principal'}, avec son contenu`
    : 'sans domaine';

  const save = async () => {
    if (!form.nom.trim()) return setError('Donnez un nom au domaine.');
    setError(null);
    setBusy(true);
    try {
      await onSave({ ...form, espace, nom: form.nom.trim() });
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HierarchyContext.Provider value={h}>
    <FormSheet visible={visible} title={domaine ? 'Domaine' : 'Nouveau domaine'} busy={busy} error={error} onClose={onClose} onSave={save}>
      <View style={[f.preview, { backgroundColor: form.couleur }]}>
        <Text style={f.previewTitle}>
          {form.icone} {form.nom || 'Nom du domaine'}
        </Text>
      </View>
      <Field style={f.titleInput} placeholder="Nom (ex. Pro, Perso, Administratif)" value={form.nom} onChangeText={(v) => setForm((x) => ({ ...x, nom: v }))} autoFocus={!domaine} />
      <EspaceChoix
        espace={espace}
        fige={!!domaine}
        onChange={(v) => {
          setEspace(v);
          setForm((x) => ({ ...x, parent: '' }));
        }}
      />
      <Label>Sous-domaine de (facultatif)</Label>
      {sousDomaines.length ? (
        <Text style={f.muted}>Domaine principal · sous-domaines : {sousDomaines.map((d) => `${d.icone} ${d.nom}`).join(', ')}</Text>
      ) : (
        <Chips
          options={[{ value: '', label: 'Aucun (domaine principal)' }, ...principaux.map((d) => ({ value: d.id, label: `${d.icone} ${d.nom}`, color: d.couleur }))]}
          value={form.parent && principaux.some((d) => d.id === form.parent) ? form.parent : ''}
          onChange={(v) => setForm((x) => ({ ...x, parent: v }))}
          compact
          wrap
        />
      )}
      <Label>Icône</Label>
      <View style={styles.icons}>
        {DOMAINE_ICONES.map((i) => (
          <Pressable
            key={i}
            onPress={() => setForm((x) => ({ ...x, icone: i }))}
            style={[styles.icon, form.icone === i && styles.iconOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: form.icone === i }}
          >
            <Text style={styles.iconText}>{i}</Text>
          </Pressable>
        ))}
      </View>
      <Label>Couleur</Label>
      <ColorPicker value={form.couleur} onChange={(col) => setForm((x) => ({ ...x, couleur: col }))} />

      {domaine && (
        <>
          <Label>Objectifs · {objectifs.length}</Label>
          {objectifs.length === 0 ? (
            <Text style={f.muted}>Aucun objectif dans ce domaine.</Text>
          ) : (
            objectifs.map((o) => (
              <Pressable key={o.id} style={f.link} onPress={() => onOpenObjectif(o)}>
                <View style={[f.dot, { backgroundColor: o.couleur }]} />
                <Text style={f.linkTitle} numberOfLines={1}>
                  🎯 {o.titre}
                </Text>
              </Pressable>
            ))
          )}
          <ChildActions
            actions={[
              ...(onAddObjectif ? [{ label: '+ Objectif', onPress: () => onAddObjectif(domaine) }] : []),
              ...(onOpenWizard ? [{ label: "🚀 Ouvrir dans l'assistant", onPress: () => onOpenWizard(domaine), primary: true }] : []),
            ]}
          />
          <DeleteSection
            label="Supprimer le domaine"
            name={domaine.nom}
            children={children}
            keepText={keepText}
            disabled={busy}
            onDelete={async (cascade) => {
              setBusy(true);
              try {
                await onDelete(domaine, cascade);
              } catch (e) {
                setError(`Échec de la suppression : ${(e as Error).message}`);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </FormSheet>
    </HierarchyContext.Provider>
  );
}

const styles = StyleSheet.create({
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconOn: { borderColor: colors.primary, borderWidth: 2, backgroundColor: '#E8F0FE' },
  iconText: { fontSize: 22 },
});
