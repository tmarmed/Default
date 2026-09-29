import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LigneChoix, LigneFiche, ListeEnfants, SectionFiche } from './Choix';
import { childrenOf, describeCounts } from '../hierarchy';
import { HierarchyContext } from '../hierarchyContext';
import { EspaceChoix, useEspaceFiche } from './EspaceChoix';
import { colors } from '../theme';
import { DOMAINE_ICONES, Domaine, DomaineInput, EPIC_COULEURS, Objectif } from '../types';
import { DeleteSection } from './DeleteSection';
import { ColorPicker, Field, FormSheet, formStyles as f, Label, type PileProps } from './FormSheet';

interface Props {
  visible: boolean;
  domaine: Domaine | null;
  onClose: () => void;
  /** `rester` : domaine enregistré avant d'ouvrir un enfant (la fiche reste ouverte) ; renvoie le domaine */
  onSave: (input: DomaineInput, rester?: boolean, ranger?: string[]) => Promise<Domaine | void | undefined>;
  pile?: PileProps;
  onDelete: (d: Domaine, cascade: boolean) => Promise<void>;
  onOpenObjectif: (o: Objectif) => void;
  /** + Objectif dans ce domaine */
  onAddObjectif?: (d: Domaine) => void;
  onOpenWizard?: (d: Domaine) => void;
  /** Espace proposé pour un nouveau domaine */
  defaultEspace?: string;
}

/** Fiche d'un domaine (Pro, Perso…) : nom, icône, couleur, objectifs. */
export function DomaineForm({ visible, domaine, onClose, onSave, onDelete, onOpenObjectif, onAddObjectif, defaultEspace, pile }: Props) {
  // Espace de la fiche ; les rattachements proposés ne viennent que de cet espace
  const { espace, setEspace, h } = useEspaceFiche(visible, domaine, defaultEspace ? { espace: defaultEspace } : undefined);
  const [form, setForm] = useState<DomaineInput>({ nom: '', icone: DOMAINE_ICONES[0], couleur: EPIC_COULEURS[0], parent: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Objectifs existants rangés dans le domaine : faits à l'enregistrement */
  const [ranger, setRanger] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setForm(domaine ? { nom: domaine.nom, icone: domaine.icone, couleur: domaine.couleur, parent: domaine.parent ?? '' } : { nom: '', icone: DOMAINE_ICONES[0], couleur: EPIC_COULEURS[0], parent: '' });
      setError(null);
      setRanger([]);
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

  const save = async (rester = false): Promise<Domaine | undefined> => {
    if (!form.nom.trim()) return void setError('Donnez un nom au domaine.');
    setError(null);
    setBusy(true);
    try {
      const saved = (await onSave({ ...form, espace, nom: form.nom.trim() }, rester, ranger)) || undefined;
      if (rester) setRanger([]);
      return saved;
    } catch (e) {
      setError(`Échec de l'enregistrement : ${(e as Error).message}`);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  /** Nouveau domaine : enregistré d'abord, puis l'objectif s'ouvre par-dessus */
  const enregistrerPuis = async (suite: (d: Domaine) => void) => {
    const d = domaine ?? (await save(true));
    if (d) suite(d);
  };

  return (
    <HierarchyContext.Provider value={h}>
    <FormSheet
      visible={visible}
      title={domaine ? 'Domaine' : 'Nouveau domaine'}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={() => save()}
      retour={pile?.retour}
      chemin={pile?.chemin}
      onFermerTout={pile?.onFermerTout}
    >
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
      <SectionFiche titre="Rattachement">
        {sousDomaines.length ? (
          <LigneFiche label="Sous-domaine de" valeur="Domaine principal" sous={`Sous-domaines : ${sousDomaines.map((d) => `${d.icone} ${d.nom}`).join(', ')}`} gris />
        ) : (
          <LigneChoix
            label="Sous-domaine de"
            value={form.parent && principaux.some((d) => d.id === form.parent) ? form.parent : ''}
            depart={domaine?.parent || undefined}
            parent
            groupes={[{ options: principaux.map((d) => ({ value: d.id, label: `${d.icone} ${d.nom}` })) }]}
            vide="Aucun (domaine principal)"
            sans="Domaine principal"
            onChange={(v) => setForm((x) => ({ ...x, parent: v }))}
          />
        )}
      </SectionFiche>
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

      <ListeEnfants
        titre={`Objectifs · ${objectifs.length}`}
        enfants={objectifs.map((o) => ({ id: o.id, texte: `🎯 ${o.titre}`, onPress: () => onOpenObjectif(o) }))}
        candidats={h.objectifList
          .filter((o) => !domaine || o.domaine !== domaine.id)
          .map((o) => {
            const d = o.domaine ? h.domaines.get(o.domaine) : undefined;
            return { id: o.id, titre: `🎯 ${o.titre}`, ailleurs: d ? `${d.icone} ${d.nom}` : undefined };
          })}
        ranger={ranger}
        setRanger={setRanger}
        nouveau={onAddObjectif ? () => enregistrerPuis(onAddObjectif) : undefined}
        mots={{
          nouveau: 'Nouvel objectif',
          ranger: 'Ranger un objectif existant',
          feuille: 'Ranger dans le domaine',
          libres: 'Sans domaine',
          autres: 'Dans un autre domaine',
          un: "Rangé dans le domaine à l'enregistrement.",
          plusieurs: "Rangés dans le domaine à l'enregistrement.",
        }}
        vide="Aucun objectif dans ce domaine."
      />
      {domaine && (
        <>
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
