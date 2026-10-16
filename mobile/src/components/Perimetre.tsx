import { createContext, useContext, useState } from 'react';
import { Text, View } from 'react-native';
import { conseilBaisse, libelleImpact, type PatchPerimetre } from '../perimetre';
import { colors } from '../theme';
import type { Item } from '../types';
import { ChampFiche, SaisieFiche, SectionFiche } from './Choix';
import { FormSheet, useEtatFiche } from './FormSheet';

/**
 * Fenêtre « 🎯 Changement de périmètre » (lot 7 du 16/10, P1) : pièce commune ouverte depuis n'importe quel écran
 * (fiche, Backlog, Sprint, PI…) dès qu'un changement fait varier les points engagés du sprint. Élément, changement,
 * impact, raison (obligatoire) ; la demande part au Chat du PO (valide) puis du Scrum Master (confirme).
 */
export interface DemandePerimetre {
  item: Pick<Item, 'id' | 'titre' | 'equipe' | 'espace'>;
  patch: PatchPerimetre;
  /** « Sprint 2 → Backlog », « Estimation 5 → 8 » */
  changement: string;
  impact: { delta: number; quoi: string };
}
/** Proposer un changement de périmètre (fourni par l'application) */
export const PerimetreContext = createContext<((d: DemandePerimetre, raison: string) => Promise<void>) | null>(null);
export const useProposerPerimetre = () => useContext(PerimetreContext);

export function FeuillePerimetre({ demande, unite = 'pts', onFermer }: { demande: DemandePerimetre | null; unite?: string; onFermer: () => void }) {
  const proposer = useProposerPerimetre();
  const [raison, setRaison] = useState('');
  const etat = useEtatFiche();
  if (!demande) return null;
  const envoyer = () =>
    etat.essayer(async () => {
      if (!raison.trim()) throw new Error('La raison est obligatoire.');
      if (!proposer) throw new Error('Indisponible ici.');
      await proposer(demande, raison.trim());
      setRaison('');
      onFermer();
    }, 'Échec de la demande');
  return (
    <FormSheet superpose visible title="🎯 Changement de périmètre" busy={etat.busy} error={etat.error} onClose={onFermer} onSave={() => void envoyer()} libelleEnregistrer="Proposer">
      <SectionFiche titre="Élément">
        <ChampFiche label="Élément">
          <Text style={{ fontSize: 15, color: colors.text, flex: 1 }}>{demande.item.titre}</Text>
        </ChampFiche>
        <ChampFiche label="Changement">
          <Text style={{ fontSize: 15, color: colors.text, flex: 1 }}>{demande.changement}</Text>
        </ChampFiche>
        <ChampFiche label="Impact" sous={conseilBaisse(demande.impact.delta, unite) || undefined}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: demande.impact.delta > 0 ? colors.warning : colors.primary, flex: 1 }}>{libelleImpact(demande.impact, unite)}</Text>
        </ChampFiche>
      </SectionFiche>
      <SectionFiche titre="Raison" aDefinir={raison.trim() ? 0 : 1}>
        <ChampFiche label="Pourquoi" colonne>
          <SaisieFiche placeholder="Obligatoire : ce qui justifie le changement" value={raison} onChangeText={setRaison} multiline />
        </ChampFiche>
      </SectionFiche>
      <View style={{ paddingHorizontal: 18, paddingTop: 4 }}>
        <Text style={{ fontSize: 12.5, color: colors.muted }}>Le PO valide, puis le Scrum Master confirme (dans le Chat ou en réunion). L’élément ne change qu’après la confirmation.</Text>
      </View>
    </FormSheet>
  );
}
