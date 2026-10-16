import { createContext, useContext, useState } from 'react';
import { Text, View } from 'react-native';
import { CAUSES_BRUIT, CAUSES_REIMPUTATION, CAUSES_RETOUCHE } from '../bruitRetouche';
import { colors } from '../theme';
import type { Item } from '../types';
import { ChampFiche, LigneChoix, SaisieFiche, SectionFiche } from './Choix';
import { FormSheet, useEtatFiche } from './FormSheet';
import { Pastilles } from './reunion/ui';

/**
 * Fenêtre commune « cause » (lot 8 du 16/10) : 🧹 Bruit (B1 : jours passés, cause), 🔧 Retouche (B2 : estimation,
 * cause, quand) et 💶 Réimputation (M1 : qui paie, raison). Une variante = une option de la même fenêtre.
 * Cause obligatoire : un choix rapide, plus un commentaire.
 */
export type QuandRetouche = 'en_cours' | 'suivant' | 'plus_tard';
export interface ActionsLot8 {
  /** B1 : supprimer un élément commencé en gardant ses jours en bruit */
  bruit: (t: Item, jours: number, cause: string, commentaire: string) => Promise<void>;
  /** B2 : créer la retouche d'une story terminée (elle reste terminée) */
  retouche: (story: Item, estimation: string, cause: string, commentaire: string, quand: QuandRetouche) => Promise<void>;
  /** M1 : réimputer (valeur vide = revenir à la règle automatique) */
  reimputer: (t: Item, valeur: string, cause: string, commentaire: string) => Promise<void>;
  /** M1 : qui peut réimputer (gestionnaires du budget du niveau) et les choix (epics, TMA des trains) */
  payeurs: (t: Item) => { peut: boolean; options: { value: string; label: string }[]; auto: string };
}
export const Lot8Context = createContext<ActionsLot8 | null>(null);
export const useLot8 = () => useContext(Lot8Context);

export type VarianteCause = { kind: 'bruit'; t: Item; jours: number } | { kind: 'retouche'; t: Item } | { kind: 'reimputation'; t: Item; valeur: string };

export function FeuilleCause({ v, onFermer, onFait }: { v: VarianteCause | null; onFermer: () => void; onFait?: () => void }) {
  const a = useLot8();
  const etat = useEtatFiche();
  const [cause, setCause] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [jours, setJours] = useState('');
  const [estimation, setEstimation] = useState('');
  const [quand, setQuand] = useState<QuandRetouche>('suivant');
  const [payeur, setPayeur] = useState('');
  if (!v || !a) return null;
  const causes = v.kind === 'bruit' ? CAUSES_BRUIT : v.kind === 'retouche' ? CAUSES_RETOUCHE : CAUSES_REIMPUTATION;
  const titre = v.kind === 'bruit' ? '🧹 Travail commencé' : v.kind === 'retouche' ? '🔧 Retouche' : '💶 Payé par';
  const fermer = () => {
    setCause('');
    setCommentaire('');
    setJours('');
    setEstimation('');
    onFermer();
  };
  const valider = () =>
    etat.essayer(async () => {
      if (!cause) throw new Error('Choisissez une cause.');
      if (cause === 'Autre' && !commentaire.trim()) throw new Error('« Autre » : écrivez la cause en commentaire.');
      if (v.kind === 'bruit') await a.bruit(v.t, Number((jours || String(v.jours)).replace(',', '.')) || 0, cause, commentaire);
      else if (v.kind === 'retouche') await a.retouche(v.t, estimation.replace(',', '.'), cause, commentaire, quand);
      else await a.reimputer(v.t, payeur || v.valeur, cause, commentaire);
      fermer();
      onFait?.();
    }, 'Échec');
  const p = v.kind === 'reimputation' ? a.payeurs(v.t) : null;
  return (
    <FormSheet superpose visible title={titre} busy={etat.busy} error={etat.error} onClose={fermer} onSave={() => void valider()} libelleEnregistrer={v.kind === 'bruit' ? 'Supprimer' : v.kind === 'retouche' ? 'Créer la retouche' : 'Réimputer'}>
      <View style={{ paddingHorizontal: 18, paddingBottom: 6 }}>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          {v.kind === 'bruit'
            ? `« ${v.t.titre} » est commencé : ses jours restent en 🧹 Bruit (une sous-tâche sous le parent le plus proche), avec la cause.`
            : v.kind === 'retouche'
              ? `« ${v.t.titre} » reste terminée dans son sprint (vélocité gardée) ; seule la retouche se planifie.`
              : `Tout l’élément change de budget (jours et dépenses), avec une trace datée.`}
        </Text>
      </View>
      {v.kind === 'bruit' && (
        <SectionFiche titre="Jours passés">
          <ChampFiche label="Jours">
            <SaisieFiche value={jours} placeholder={String(v.jours)} onChangeText={(x) => setJours(x.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" />
          </ChampFiche>
        </SectionFiche>
      )}
      {v.kind === 'retouche' && (
        <SectionFiche titre="Retouche">
          <ChampFiche label="Estimation">
            <SaisieFiche value={estimation} placeholder="0 (pas de changement de périmètre)" onChangeText={(x) => setEstimation(x.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" />
          </ChampFiche>
          <View style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
            <Pastilles
              petit
              options={[
                { value: 'en_cours', label: 'Sprint en cours' },
                { value: 'suivant', label: 'Sprint suivant' },
                { value: 'plus_tard', label: 'Plus tard' },
              ]}
              value={quand}
              onChange={(x) => setQuand(x as QuandRetouche)}
            />
            {quand === 'en_cours' && Number(estimation) > 0 && <Text style={{ fontSize: 12, color: colors.warning, marginTop: 6 }}>Estimée et dans le sprint en cours : un changement de périmètre (le PO valide, le SM confirme).</Text>}
          </View>
        </SectionFiche>
      )}
      {v.kind === 'reimputation' && p && (
        <SectionFiche titre="Payé par">
          <LigneChoix label="Payé par" value={payeur || v.valeur} onChange={(x) => setPayeur(x ?? '')} groupes={[{ options: [{ value: '', label: `↺ Revenir à la règle automatique (${p.auto})` }, ...p.options] }]} fixe />
        </SectionFiche>
      )}
      <SectionFiche titre="Cause" aDefinir={cause ? 0 : 1}>
        <View style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
          <Pastilles petit options={causes.map((c) => ({ value: c, label: c }))} value={cause} onChange={setCause} />
        </View>
        <ChampFiche label="Commentaire" colonne>
          <SaisieFiche value={commentaire} placeholder={cause === 'Autre' ? 'Obligatoire pour « Autre »' : 'Facultatif'} onChangeText={setCommentaire} multiline />
        </ChampFiche>
      </SectionFiche>
    </FormSheet>
  );
}
