/**
 * Sous-bloc Filtres des onglets (14/10, refactoring lot 4, sorti d'App.tsx) : tête (🔍 recherche, ↺ réinitialiser
 * avec le nombre de filtres actifs) et rangées propres à chaque écran (Chat, Backlog, Réunions, delivery SAFe). L'état
 * des filtres reste dans App (il sert aussi aux listes) ; ici, seulement l'affichage.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { filElement } from '../choixTravail';
import { type Espace, ICONE_ESPACE } from '../espaces';
import type { HierarchyValue as Hierarchy } from '../hierarchyContext';
import type { OrgFiltre, OrgValue } from '../organisation';
import { colors } from '../theme';
import { TYPE_ICONS } from '../types';
import { FeuilleChoix } from './Choix';
import { Pastille } from './RangeePastilles';
import type { Niveau as NiveauBacklog } from './BacklogView';
import type { NiveauReunion } from './ReunionsView';

export function BarreFiltres({
  recherche,
  setRecherche,
  placeholder,
  nb,
  onReinitialiser,
  children,
}: {
  /** null : recherche fermée (🔍 seul) */
  recherche: string | null;
  setRecherche: (v: string | null) => void;
  placeholder: string;
  /** Nombre de filtres actifs (rond rouge du ↺) */
  nb: number;
  onReinitialiser: () => void;
  children: ReactNode;
}) {
  return (
    <View style={s.bloc}>
      <View style={s.tete}>
        {recherche === null ? (
          <Pressable onPress={() => setRecherche('')} style={s.rond} hitSlop={6} accessibilityRole="button" accessibilityLabel="Rechercher">
            <Text style={s.rondIcone}>🔍</Text>
          </Pressable>
        ) : (
          <View style={s.champRecherche}>
            <Text style={s.rondIcone}>🔍</Text>
            <TextInput autoFocus value={recherche} onChangeText={setRecherche} placeholder={placeholder} placeholderTextColor={colors.muted} style={s.champRechercheTexte} returnKeyType="search" />
            <Pressable onPress={() => setRecherche(null)} hitSlop={8} style={s.fermerRecherche} accessibilityRole="button" accessibilityLabel="Fermer la recherche">
              <Text style={s.fermerRechercheTexte}>✕</Text>
            </Pressable>
          </View>
        )}
        <Pressable
          onPress={onReinitialiser}
          disabled={!nb}
          style={[s.rond, !!nb && s.rondActif]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Réinitialiser les filtres (${nb} actif${nb > 1 ? 's' : ''})`}
        >
          <Text style={[s.reinitIcone, !!nb && s.reinitIconeActif]}>↺</Text>
          {!!nb && (
            <View style={s.reinitPastille}>
              <Text style={s.reinitPastilleTexte}>{nb}</Text>
            </View>
          )}
        </Pressable>
      </View>
      <View style={s.corps}>{children}</View>
    </View>
  );
}

/** Une rangée de pastilles qui défile */
export function LigneFiltres({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.ligne}>
      {children}
    </ScrollView>
  );
}

export type FiltreSynchro = { espace: string; element: string; type: '' | 'question' | 'message'; pj: boolean };

/** Chat (lot 25) : espace, élément concerné, type, avec pièces jointes */
export function FiltresSynchro({ filtre, setFiltre, espaces, elements, hv }: { filtre: FiltreSynchro; setFiltre: (f: (x: FiltreSynchro) => FiltreSynchro) => void; espaces: Espace[]; elements: string[]; hv: Hierarchy }) {
  const [choixElement, setChoixElement] = useState(false);
  return (
    <>
      <LigneFiltres>
        {[
          { cle: 'tous', label: 'Tous les espaces', on: !filtre.espace, press: () => setFiltre((f) => ({ ...f, espace: '' })) },
          ...espaces.map((e) => ({ cle: e.id, label: `${ICONE_ESPACE[e.type]} ${e.nom}`, on: filtre.espace === e.id, press: () => setFiltre((f) => ({ ...f, espace: f.espace === e.id ? '' : e.id })) })),
        ].map((c) => (
          <Pastille key={c.cle} label={c.label} on={c.on} onPress={c.press} />
        ))}
      </LigneFiltres>
      <LigneFiltres>
        <Pastille label={`📍 ${filtre.element ? filElement(filtre.element, hv, TYPE_ICONS).split(' › ').pop() : 'Élément'} ▾`} on={!!filtre.element} onPress={() => setChoixElement(true)} />
        {(
          [
            ['question', '❓ Questions'],
            ['message', '✉️ Messages'],
          ] as const
        ).map(([v, label]) => (
          <Pastille key={v} label={label} on={filtre.type === v} onPress={() => setFiltre((f) => ({ ...f, type: f.type === v ? '' : v }))} />
        ))}
        <Pastille label="📎 Avec pièces jointes" on={filtre.pj} onPress={() => setFiltre((f) => ({ ...f, pj: !f.pj }))} bascule />
      </LigneFiltres>
      {choixElement && (
        <FeuilleChoix
          titre="Élément concerné"
          value={filtre.element}
          fixe
          groupes={[{ options: elements.map((id) => ({ value: id, label: filElement(id, hv, TYPE_ICONS) || id })) }]}
          sans={filtre.element ? 'Tous les éléments' : undefined}
          onChoisir={(v) => {
            setChoixElement(false);
            setFiltre((f) => ({ ...f, element: v }));
          }}
          onFermer={() => setChoixElement(false)}
        />
      )}
    </>
  );
}

/** Backlog : niveau (Epics, Features, Stories) et value stream */
export function FiltresBacklog({ niveau, setNiveau, vs, setVs, hv }: { niveau: NiveauBacklog; setNiveau: (v: NiveauBacklog) => void; vs: string; setVs: (v: string) => void; hv: Hierarchy }) {
  return (
    <>
      <LigneFiltres>
        {(
          [
            ['epic', '🗂️ Epics'],
            ['feature', '🧩 Features'],
            ['tache', '📖 Stories'],
          ] as const
        ).map(([v, label]) => (
          <Pastille key={v} label={label} on={niveau === v} onPress={() => setNiveau(v)} />
        ))}
      </LigneFiltres>
      {hv.valueStreams.length > 0 && (
        <LigneFiltres>
          {[{ id: '', nom: '' }, ...hv.valueStreams].map((v) => {
            const on = vs === v.id;
            return <Pastille key={v.id || 'tous'} label={v.id ? `🌊 ${v.nom}` : 'Tous les value streams'} on={on} onPress={() => setVs(on ? '' : v.id)} />;
          })}
        </LigneFiltres>
      )}
    </>
  );
}

/** Filtre de niveau des réunions (en SAFe) */
export const NIVEAUX_REUNION: { value: NiveauReunion; label: string }[] = [
  { value: 'equipeagile', label: '👥 Équipe' },
  { value: 'train', label: '🚆 Train' },
  { value: 'portfolio', label: '💼 Portfolio' },
];
export function FiltresReunions({ niveau, setNiveau }: { niveau: NiveauReunion; setNiveau: (v: NiveauReunion) => void }) {
  return (
    <LigneFiltres>
      {NIVEAUX_REUNION.map((n) => {
        const on = niveau === n.value;
        return <Pastille key={n.value || 'tous'} label={n.label} on={on} onPress={() => setNiveau(on ? '' : n.value)} />;
      })}
    </LigneFiltres>
  );
}

/** Portfolio / Train / Équipe (delivery SAFe d'une entreprise) : liaison entre l'organisation et le travail */
export function FiltresDelivery({ org, filtre, setFiltre }: { org: OrgValue; filtre: OrgFiltre; setFiltre: (f: OrgFiltre) => void }) {
  return (
    <LigneFiltres>
      {[
        { kind: null, id: '', label: 'Tout le delivery' },
        ...org.portfolios.map((x) => ({ kind: 'portfolio' as const, id: x.id, label: `💼 ${x.nom}` })),
        ...org.trains.map((x) => ({ kind: 'train' as const, id: x.id, label: `🚆 ${x.nom}` })),
        ...org.equipes.map((x) => ({ kind: 'equipeagile' as const, id: x.id, label: `👥 ${x.nom}` })),
      ].map((c) => {
        const on = c.kind ? filtre?.kind === c.kind && filtre.id === c.id : !filtre;
        return <Pastille key={`${c.kind}-${c.id}`} label={c.label} on={on} onPress={() => setFiltre(c.kind ? (on ? null : { kind: c.kind, id: c.id }) : null)} />;
      })}
    </LigneFiltres>
  );
}

const s = StyleSheet.create({
  bloc: { marginHorizontal: 10, marginBottom: 10, backgroundColor: colors.bg, borderRadius: 14, borderWidth: 1, borderColor: '#EEF1F5', padding: 9 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 30 },
  rond: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  rondActif: { borderColor: '#B9D2F8' },
  rondIcone: { fontSize: 13 },
  reinitIcone: { fontSize: 15, color: '#A5AEBB', fontWeight: '700' },
  reinitIconeActif: { color: colors.primary },
  reinitPastille: { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  reinitPastilleTexte: { color: '#fff', fontSize: 10, fontWeight: '800' },
  champRecherche: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.card, paddingLeft: 8, paddingRight: 4 },
  champRechercheTexte: { flex: 1, minWidth: 0, fontSize: 14, color: colors.text, paddingVertical: 0, outlineStyle: 'none' } as never,
  fermerRecherche: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E6EAF0', alignItems: 'center', justifyContent: 'center' },
  fermerRechercheTexte: { fontSize: 10, color: colors.muted, fontWeight: '800' },
  corps: { marginTop: 8, gap: 8 },
  ligne: { gap: 6, alignItems: 'center' },
});
