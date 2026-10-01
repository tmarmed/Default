import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addDays, startOfWeek, toDateString } from '../dates';
import { libelleNiveau, lireNiveau } from '../echange/hierarchieEchange';
import { type OrgFiltre, type OrgValue } from '../organisation';
import { dureeReunion, heureReunion, participantsReunion } from '../reunions';
import { colors } from '../theme';
import { type Reunion, TYPES_REUNION } from '../types';
import { type ActionsDaily, FenetreDaily } from './Daily';
import { FenetreReunion } from './FenetreReunion';

/**
 * 📅 Réunions (lot 6) : vos réunions, construites comme la liste de la Synchro (« Par conversation ») : sections
 * « Aujourd'hui », « Cette semaine », « Plus tard » (la prochaine de chaque réunion répétée) ; une ligne par réunion
 * (icône, titre, niveau, heure · durée · participants) ; la toucher ouvre sa fenêtre, en organisateur si vous
 * l'animez, sinon en participant. Réunions calculées d'après vos rôles (src/reunions.ts), rien n'est enregistré.
 */
export type NiveauReunion = '' | 'equipeagile' | 'train' | 'portfolio';
export interface FiltreReunions {
  niveau: NiveauReunion;
  /** Filtre Portfolio / Train / Équipe (delivery) */
  org: OrgFiltre;
  recherche: string;
}

interface Props {
  reunions: Reunion[];
  org: OrgValue;
  /** Vous (e-mail) */
  moi: string;
  /** AAAA-MM-JJ */
  aujourdhui: string;
  safeActif: boolean;
  filtre: FiltreReunions;
  /** Message de l'application (bandeau du bas) */
  onInfo?: (texte: string) => void;
  /** Daily : points notés (onglet PointsReunion), tâches et échanges créés au compte rendu */
  daily?: ActionsDaily;
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** « jeu. 8 oct. » */
const jourCourt = (jour: string) => {
  const [y, m, d] = jour.split('-').map(Number);
  const x = new Date(y, m - 1, d);
  return `${JOURS[x.getDay()]} ${d === 1 ? '1er' : d} ${MOIS[m - 1]}`;
};

/** La réunion passe-t-elle le filtre Portfolio / Train / Équipe ? (son niveau, ou un niveau au-dessus) */
function dansDelivery(r: Reunion, f: OrgFiltre, org: OrgValue): boolean {
  if (!f) return true;
  const n = lireNiveau(r.niveau);
  if (!n) return false;
  const train = n.kind === 'train' ? n.id : n.kind === 'equipeagile' ? (org.equipe.get(n.id)?.train ?? '') : '';
  const portfolio = n.kind === 'portfolio' ? n.id : (org.train.get(train)?.portfolio ?? '');
  return f.kind === 'equipeagile' ? n.kind === 'equipeagile' && n.id === f.id : f.kind === 'train' ? train === f.id : portfolio === f.id;
}

export function ReunionsView({ reunions, org, moi, aujourdhui, safeActif, filtre, onInfo, daily }: Props) {
  const [ouverte, setOuverte] = useState<Reunion | null>(null);
  const mots = filtre.recherche.toLowerCase().split(/\s+/).filter(Boolean);
  const niveauDe = (r: Reunion) => libelleNiveau(lireNiveau(r.niveau), org);
  const liste = useMemo(
    () =>
      reunions.filter((r) => {
        if (filtre.niveau && lireNiveau(r.niveau)?.kind !== filtre.niveau) return false;
        if (!dansDelivery(r, filtre.org, org)) return false;
        const texte = `${r.titre} ${niveauDe(r)}`.toLowerCase();
        return mots.every((m) => texte.includes(m));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reunions, filtre.niveau, filtre.org, filtre.recherche, org],
  );
  // Aujourd'hui ; cette semaine (jusqu'à dimanche) ; plus tard : la prochaine de chaque réunion (type et niveau)
  const dimanche = toDateString(addDays(startOfWeek(new Date(`${aujourdhui}T12:00`)), 6));
  const jour = (r: Reunion) => r.debut.slice(0, 10);
  // Après aujourd'hui, une réunion de chaque jour (daily, point perso…) n'apparaît qu'une fois (la prochaine) ;
  // « Plus tard » : seulement les réunions qui ne sont ni aujourd'hui ni cette semaine, la prochaine de chacune
  const cle = (r: Reunion) => `${r.type}|${r.niveau}`;
  const auj = liste.filter((r) => jour(r) === aujourdhui);
  const vues = new Set<string>();
  const unique = (r: Reunion) => {
    if (vues.has(cle(r))) return false;
    vues.add(cle(r));
    return true;
  };
  const semaine = liste.filter((r) => jour(r) > aujourdhui && jour(r) <= dimanche && (r.repetition !== 'quotidienne' || unique(r)));
  [...auj, ...semaine].forEach((r) => vues.add(cle(r)));
  const plusTard = liste.filter((r) => jour(r) > dimanche && unique(r));

  const ligne = (r: Reunion, i: number, avecJour: boolean) => {
    const t = TYPES_REUNION[r.type];
    const nb = participantsReunion(r, org).length;
    const anime = r.organisateur.toLowerCase() === moi.toLowerCase();
    const niveau = niveauDe(r);
    const quand = r.repetition === 'quotidienne' && jour(r) !== aujourdhui ? `chaque jour${safeActif ? ' ouvré' : ''}` : avecJour && jourCourt(jour(r));
    const meta = [quand, heureReunion(r), dureeReunion(r.duree_min), nb ? `${nb} participant${nb > 1 ? 's' : ''}` : 'seul', anime && r.niveau ? 'vous animez' : ''].filter(Boolean).join(' · ');
    return (
      <Pressable key={r.id} onPress={() => setOuverte(r)} style={[s.ligne, i > 0 && s.ligneBord]} accessibilityRole="button" accessibilityHint={anime ? 'Ouvre la réunion : vous animez' : 'Ouvre la réunion : préparer votre point'}>
        <Text style={s.avatar}>{t.icone}</Text>
        <View style={s.corps}>
          <Text style={s.titre} numberOfLines={1}>
            {r.titre} {!!niveau && <Text style={s.niveau}>· {niveau}</Text>}
          </Text>
          <Text style={s.meta} numberOfLines={2}>
            {meta}
          </Text>
        </View>
        <Text style={s.chev}>›</Text>
      </Pressable>
    );
  };
  const section = (titre: string, l: Reunion[], avecJour: boolean, vide: string, premiere = false) => (
    <>
      <Text style={[s.section, premiere ? s.sectionPremiere : s.sectionBloc]}>
        {titre} · {l.length}
      </Text>
      {l.length > 0 ? <View style={s.carte}>{l.map((r, i) => ligne(r, i, avecJour))}</View> : <Text style={s.videTexte}>{vide}</Text>}
    </>
  );

  const filtreActif = !!filtre.niveau || !!filtre.org || mots.length > 0;
  const mode = ouverte && ouverte.organisateur.toLowerCase() === moi.toLowerCase() ? 'organisateur' : 'participant';
  const fil = ouverte ? [niveauDe(ouverte) || '👤 Personnel', jourCourt(jour(ouverte)), heureReunion(ouverte), dureeReunion(ouverte.duree_min)].join(' · ') : undefined;
  return (
    <>
      <ScrollView contentContainerStyle={s.scroll}>
        {filtreActif && <Text style={s.aide}>Filtres actifs : seules les réunions correspondantes sont affichées.</Text>}
        {!reunions.length ? (
          <Text style={[s.videTexte, s.videSeul]}>
            {safeActif
              ? 'Aucune réunion : elles viennent de vos rôles dans l’Organisation (membre, Scrum Master ou Product Owner d’une équipe, RTE ou Product Manager d’un train, Epic Owner d’un portfolio).'
              : 'Aucune réunion.'}
          </Text>
        ) : (
          <>
            {section('Aujourd’hui', auj, false, '✓ Aucune réunion aujourd’hui.', true)}
            {section('Cette semaine', semaine, true, 'Rien d’autre cette semaine.')}
            {plusTard.length > 0 && section('Plus tard', plusTard, true, '')}
            <Text style={s.aide}>
              {safeActif
                ? 'Calculées d’après vos rôles et la cadence SAFe (itérations de 2 semaines, PI au trimestre). Après aujourd’hui, le daily n’apparaît qu’une fois ; « Plus tard » : la prochaine des autres réunions.'
                : 'Vos rituels personnels, sans compte rendu. Après aujourd’hui, chaque rituel n’apparaît qu’une fois (le prochain).'}
            </Text>
          </>
        )}
      </ScrollView>
      {ouverte?.type === 'daily' && !!ouverte.niveau && daily ? (
        // Daily validé : contenu de chaque étape, points enregistrés dans le Sheet de l'équipe
        <FenetreDaily visible reunion={ouverte} mode={mode} org={org} moi={moi} aujourdhui={aujourdhui} fil={fil} actions={daily} onFermer={() => setOuverte(null)} onInfo={onInfo} />
      ) : (
        <FenetreReunion
          visible={!!ouverte}
          reunion={ouverte}
          mode={mode}
          fil={fil}
          onFermer={() => setOuverte(null)}
          onTerminer={() => onInfo?.(mode === 'organisateur' && ouverte?.niveau ? 'Compte rendu : à venir, rien n’est encore envoyé.' : 'Réunion terminée : rien n’est encore enregistré.')}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 130 },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginHorizontal: 16, marginBottom: 8 },
  sectionPremiere: { marginTop: 16 },
  sectionBloc: { marginTop: 18 },
  carte: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF1F6', textAlign: 'center', lineHeight: 32, fontSize: 17, overflow: 'hidden' },
  corps: { flex: 1, gap: 3, minWidth: 0 },
  titre: { fontSize: 15, fontWeight: '700', color: colors.text },
  niveau: { fontSize: 12.5, fontWeight: '600', color: colors.muted },
  meta: { fontSize: 12.5, color: colors.muted },
  chev: { fontSize: 18, color: '#A0A6B1' },
  aide: { marginHorizontal: 16, marginTop: 10, fontSize: 12.5, color: colors.muted },
  videTexte: { marginHorizontal: 16, fontSize: 13, color: colors.muted, paddingVertical: 4 },
  videSeul: { marginTop: 16 },
});
