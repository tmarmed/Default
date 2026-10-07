import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, toDateString } from '../dates';
import { libelleNiveau, lireNiveau } from '../echange/hierarchieEchange';
import type { OrgValue } from '../organisation';
import { animateurSerie, dureeReunion, peutModifierSerie, type SerieVue, serieVide } from '../reunions';
import {
  type AncreSerie,
  couperSerie,
  exceptionsOrphelines,
  JOURS_SEMAINE,
  LIBELLE_UNITE,
  libelleRegle,
  lireExceptions,
  modifierOccurrence,
  modifierSerie,
  occurrences,
  type SerieReunion,
  UNITES_AGILES,
  UNITES_STANDARD,
  type UniteSerie,
} from '../series';
import { colors } from '../theme';
import { TYPES_REUNION, type TypeReunion } from '../types';
import { Pas, Puces } from './CalendrierAgile';
import { ChampFiche, LigneChoix, LigneMulti, SaisieFiche, SectionFiche } from './Choix';
import { FormSheet } from './FormSheet';

/** Portée d'une modification (07/10) : cette réunion, celle-ci et les suivantes, toute la série */
export type PorteeSerie = 'une' | 'suivantes' | 'toutes';
export const LIBELLE_PORTEE: Record<PorteeSerie, string> = { une: 'Cette réunion', suivantes: 'Celle-ci et les suivantes', toutes: 'Toute la série' };

const jourCourt = (j: string) => {
  const d = new Date(`${j}T12:00`);
  return `${['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
};
const nouvelIdSerie = () => `r-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * 📅 Fiche d'une série de réunions : d'abord la périodicité (standard : jour, semaine, mois, trimestre, année ; agile :
 * sprint, PI), puis le moment (début, milieu, fin, début + x jours, fin − x jours, semaine IP, ou des jours de la
 * semaine) ; heure, durée, qui anime, qui peut modifier, participants (réunion libre), exceptions.
 * Ouverte depuis une réunion : `portee` = cette réunion (son exception) / celle-ci et les suivantes / toute la série.
 * Modifier ou annuler : celui qui anime et les personnes ajoutées (« Peuvent modifier ») ; les autres lisent.
 */
export function SerieForm({
  visible,
  vue,
  origine,
  portee,
  org,
  moi,
  safeActif,
  niveaux,
  onClose,
  onEnregistrer,
}: {
  visible: boolean;
  /** Série à modifier ; null = nouvelle 📅 réunion */
  vue: SerieVue | null;
  /** Date d'origine de la réunion d'où l'on vient (portée « une » ou « suivantes ») */
  origine?: string;
  portee: PorteeSerie;
  org: OrgValue;
  moi: string;
  safeActif: boolean;
  /** Nouvelle réunion : niveaux proposés (vos équipes, trains, portfolios) et leur espace */
  niveaux: { value: string; label: string; espace: string }[];
  onClose: () => void;
  /** Enregistre le lot dans l'espace (une écriture) */
  onEnregistrer: (espace: string, lot: SerieReunion[]) => Promise<void>;
}) {
  const nouvelle = !vue;
  const [f, setF] = useState<SerieReunion>(() => serieVide({ id: nouvelIdSerie() }));
  const [occ, setOcc] = useState({ date: '', heure: '', duree: '', annulee: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aujourdhui = toDateString(new Date());
  const occOrigine = useMemo(() => (vue && origine ? occurrences(vue.serie, origine, origine, vue.cal)[0] : undefined), [vue, origine]);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    if (vue) setF(vue.serie);
    else setF(serieVide({ id: nouvelIdSerie(), titre: '', unite: 'semaine', jours: '1', heure: '10:00', duree: '30', animateur: moi.toLowerCase(), niveau: '' }));
    const o = occOrigine;
    setOcc({ date: o?.debut.slice(0, 10) ?? origine ?? '', heure: o?.debut.slice(11) ?? vue?.serie.heure ?? '', duree: String(o?.duree ?? vue?.serie.duree ?? ''), annulee: !!o?.annulee });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, vue?.serie.id, origine, portee]);

  const modifiable = nouvelle || (!!vue && peutModifierSerie(vue, moi));
  const type = (vue?.type ?? 'reunion') as TypeReunion;
  const t = TYPES_REUNION[type];
  const niveauTexte = libelleNiveau(lireNiveau(f.niveau), org);
  const titre = nouvelle ? 'Nouvelle réunion' : `${t.icone} ${f.titre.trim() || t.libelle}`;
  const set = (x: Partial<SerieReunion>) => setF((p) => ({ ...p, ...x }));
  const personnes = org.personnes.filter((p) => !!p.email);
  const groupesPersonnes = [{ options: [...new Map(personnes.map((p) => [p.email.toLowerCase(), { value: p.email.toLowerCase(), label: p.nom }])).values()] }];
  const nomDe = (email: string) => personnes.find((p) => p.email.toLowerCase() === email)?.nom ?? email;
  const listeMails = (x: string) => x.split(';').filter(Boolean);

  // Aperçu : les 5 prochaines réunions selon la règle en cours de saisie
  const apercu = useMemo(() => {
    try {
      return occurrences(f, aujourdhui, toDateString(addDays(new Date(), 400)), vue?.cal)
        .filter((o) => !o.annulee)
        .slice(0, 5);
    } catch {
      return [];
    }
  }, [f, aujourdhui, vue?.cal]);
  const orphelines = useMemo(() => (vue ? exceptionsOrphelines(f, vue.cal) : []), [f, vue]);

  const enregistrer = async () => {
    if (!modifiable) return onClose();
    setBusy(true);
    setError(null);
    try {
      const maintenant = new Date().toISOString();
      const espace = f.espace || vue?.serie.espace || niveaux.find((n) => n.value === f.niveau)?.espace || 'moi';
      let lot: SerieReunion[];
      if (vue && portee === 'une' && origine) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(occ.date) || !/^\d{1,2}:\d{2}$/.test(occ.heure)) throw new Error('Date (AAAA-MM-JJ) et heure (ex. 9:30) attendues.');
        lot = [modifierOccurrence(vue.serie, origine, occ.annulee ? { annulee: true } : { a: `${occ.date}T${occ.heure.padStart(5, '0')}`, duree: Number(occ.duree) || undefined })];
      } else if (vue && portee === 'suivantes' && origine) {
        lot = couperSerie(vue.serie, origine, changements(vue.serie, f), maintenant);
      } else if (vue) lot = [modifierSerie(vue.serie, changements(vue.serie, f), maintenant)];
      else lot = [{ ...f, type_reunion: '', cree_le: maintenant, modifie_le: maintenant }];
      await onEnregistrer(espace, lot);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const unite = f.unite;
  const moments: { v: AncreSerie; l: string }[] = [
    { v: 'debut', l: 'Début' },
    { v: 'milieu', l: 'Milieu' },
    { v: 'fin', l: 'Fin' },
    ...(unite === 'pi' ? [{ v: 'ip' as const, l: 'Semaine IP' }] : []),
  ];
  const jours = listeMails(f.jours.replace('ouvres', ''));
  const basculerJour = (n: string) => set({ jours: (jours.includes(n) ? jours.filter((x) => x !== n) : [...jours, n]).sort().join(';') });
  const ecart = Number(f.ecart) || 0;

  return (
    <FormSheet
      visible={visible}
      title={portee === 'toutes' || nouvelle ? titre : `${titre} · ${LIBELLE_PORTEE[portee].toLowerCase()}`}
      fil={niveauTexte || undefined}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={modifiable ? enregistrer : undefined}
      contexte={`Série ${f.id}`}
    >
      {!modifiable && (
        <Text style={s.info}>
          Seul {nomDe(vue ? animateurSerie(vue) : '')} (qui anime) et les personnes ajoutées peuvent modifier ou annuler cette réunion.
        </Text>
      )}

      {vue && portee === 'une' && origine ? (
        <SectionFiche titre={`Réunion du ${jourCourt(origine)}`}>
          <ChampFiche label="Date">
            <SaisieFiche value={occ.date} editable={modifiable && !occ.annulee} onChangeText={(v) => setOcc((o) => ({ ...o, date: v.replace(/[^0-9-]/g, '').slice(0, 10) }))} placeholder="AAAA-MM-JJ" />
          </ChampFiche>
          <ChampFiche label="Heure">
            <SaisieFiche value={occ.heure} editable={modifiable && !occ.annulee} onChangeText={(v) => setOcc((o) => ({ ...o, heure: v.replace(/[^0-9:]/g, '').slice(0, 5) }))} placeholder="9:30" />
          </ChampFiche>
          <ChampFiche label="Durée">
            <SaisieFiche value={occ.duree} editable={modifiable && !occ.annulee} keyboardType="number-pad" onChangeText={(v) => setOcc((o) => ({ ...o, duree: v.replace(/\D/g, '').slice(0, 3) }))} placeholder="minutes" />
          </ChampFiche>
          <ChampFiche label="Annulée">
            <Puces options={[{ v: 'n', l: 'Non' }, { v: 'o', l: 'Oui, annulée' }]} value={occ.annulee ? 'o' : 'n'} onChange={(v) => modifiable && setOcc((o) => ({ ...o, annulee: v === 'o' }))} />
          </ChampFiche>
          <Text style={s.aide}>Les autres réunions de la série ne changent pas. Revenue à l'identique, l'exception disparaît.</Text>
        </SectionFiche>
      ) : (
        <>
          {(nouvelle || type === 'reunion') && (
            <SectionFiche titre="Réunion">
              <ChampFiche label="Titre">
                <SaisieFiche value={f.titre} editable={modifiable} onChangeText={(v) => set({ titre: v })} placeholder="ex. Point client" />
              </ChampFiche>
              {nouvelle && (
                <LigneChoix
                  label="Niveau"
                  value={f.niveau}
                  onChange={(v) => set({ niveau: v })}
                  groupes={[{ options: niveaux.map((n) => ({ value: n.value, label: n.label })) }]}
                  sans="Personnelle"
                  vide="Personnelle"
                  fixe
                />
              )}
            </SectionFiche>
          )}
          <View pointerEvents={modifiable ? 'auto' : 'none'}>
            <SectionFiche titre="Périodicité">
              <ChampFiche label="Standard" colonne>
                <Puces
                  options={UNITES_STANDARD.map((u) => ({ v: u, l: LIBELLE_UNITE[u] }))}
                  value={unite}
                  onChange={(v) => set({ unite: v as UniteSerie, ancre: v === 'jour' || v === 'semaine' ? '' : f.ancre || 'debut', jours: v === 'semaine' ? '1' : v === 'jour' ? 'ouvres' : '', ecart: '' })}
                />
              </ChampFiche>
              {safeActif && (
                <ChampFiche label="Agile" colonne>
                  <Puces options={UNITES_AGILES.map((u) => ({ v: u, l: LIBELLE_UNITE[u] }))} value={unite} onChange={(v) => set({ unite: v as UniteSerie, ancre: f.ancre || 'debut', jours: '', ecart: '' })} />
                </ChampFiche>
              )}
              {unite === 'jour' && (
                <ChampFiche label="Jours">
                  <Puces options={[{ v: 'ouvres', l: 'Jours ouvrés' }, { v: '', l: 'Tous les jours' }]} value={f.jours === 'ouvres' ? 'ouvres' : ''} onChange={(v) => set({ jours: v })} />
                </ChampFiche>
              )}
              {unite === 'semaine' && (
                <ChampFiche label="Jour(s)" colonne>
                  <View style={s.puces}>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <Pressable key={n} onPress={() => basculerJour(String(n))} style={[s.puce, jours.includes(String(n)) && s.puceOn]} accessibilityRole="checkbox" accessibilityState={{ checked: jours.includes(String(n)) }}>
                        <Text style={[s.puceTexte, jours.includes(String(n)) && s.puceTexteOn]}>{JOURS_SEMAINE[n].slice(0, 3)}.</Text>
                      </Pressable>
                    ))}
                  </View>
                </ChampFiche>
              )}
              {unite !== 'jour' && unite !== 'semaine' && (
                <>
                  <ChampFiche label="Moment" colonne>
                    <Puces options={moments} value={f.ancre || 'debut'} onChange={(v) => set({ ancre: v as AncreSerie, ecart: '' })} />
                  </ChampFiche>
                  {(f.ancre || 'debut') !== 'milieu' && (f.ancre || 'debut') !== 'ip' && !jours.length && (
                    <ChampFiche label={f.ancre === 'fin' ? 'Fin −' : 'Début +'} sous="Jours ouvrés">
                      <Pas valeur={Math.abs(ecart)} min={0} max={30} onChange={(n) => set({ ecart: n ? String(f.ancre === 'fin' ? -n : n) : '' })} suffixe=" j" />
                    </ChampFiche>
                  )}
                  {unite !== 'sprint' && unite !== 'pi' && (
                    <ChampFiche label="Jour" colonne sous={jours.length ? `${f.ancre === 'fin' ? 'Le dernier' : 'Le premier'} de la période` : 'Facultatif (ex. 1er mardi du mois)'}>
                      <View style={s.puces}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Pressable key={n} onPress={() => set({ jours: jours.includes(String(n)) ? '' : String(n), ecart: '' })} style={[s.puce, jours.includes(String(n)) && s.puceOn]} accessibilityRole="radio" accessibilityState={{ selected: jours.includes(String(n)) }}>
                            <Text style={[s.puceTexte, jours.includes(String(n)) && s.puceTexteOn]}>{JOURS_SEMAINE[n].slice(0, 3)}.</Text>
                          </Pressable>
                        ))}
                      </View>
                    </ChampFiche>
                  )}
                </>
              )}
              <ChampFiche label="Tous les">
                <Pas valeur={Math.max(1, Number(f.tous) || 1)} min={1} max={12} onChange={(n) => set({ tous: n > 1 ? String(n) : '' })} suffixe={` ${unite === 'annee' ? 'an(s)' : LIBELLE_UNITE[unite].toLowerCase()}`} />
              </ChampFiche>
              <Text style={s.regle}>{libelleRegle(f)}</Text>
            </SectionFiche>

            <SectionFiche titre="Horaire">
              <ChampFiche label="Heure">
                <SaisieFiche value={f.heure} onChangeText={(v) => set({ heure: v.replace(/[^0-9:]/g, '').slice(0, 5) })} placeholder="9:30" />
              </ChampFiche>
              <ChampFiche label="Durée" sous={Number(f.duree) ? dureeReunion(Number(f.duree)) : undefined}>
                <SaisieFiche value={f.duree} keyboardType="number-pad" onChangeText={(v) => set({ duree: v.replace(/\D/g, '').slice(0, 3) })} placeholder="minutes" />
              </ChampFiche>
              <ChampFiche label="Début">
                <SaisieFiche value={f.debut} onChangeText={(v) => set({ debut: v.replace(/[^0-9-]/g, '').slice(0, 10) })} placeholder="Dès maintenant" />
              </ChampFiche>
              <ChampFiche label="Fin">
                <SaisieFiche value={f.fin} onChangeText={(v) => set({ fin: v.replace(/[^0-9-]/g, '').slice(0, 10) })} placeholder="Sans fin" />
              </ChampFiche>
            </SectionFiche>

            <SectionFiche titre="Personnes">
              <LigneChoix
                label="Anime"
                value={f.animateur}
                onChange={(v) => set({ animateur: v })}
                groupes={groupesPersonnes}
                sans={vue?.type !== 'reunion' && vue ? 'D’après le rôle' : undefined}
                vide={vue ? `D’après le rôle (${nomDe(vue.orgaDefaut)})` : 'Vous'}
                libelle={(v) => nomDe(v)}
              />
              <LigneMulti label="Peuvent modifier" values={listeMails(f.editeurs)} onChange={(l) => set({ editeurs: l.join(';') })} groupes={groupesPersonnes} resume={(n) => `${n} personne${n > 1 ? 's' : ''}`} />
              {type === 'reunion' && (
                <LigneMulti label="Participants" values={listeMails(f.participants)} onChange={(l) => set({ participants: l.join(';') })} groupes={groupesPersonnes} resume={(n) => `${n} participant${n > 1 ? 's' : ''}`} />
              )}
            </SectionFiche>
          </View>

          {vue && lireExceptions(f).length > 0 && (
            <SectionFiche titre={`Exceptions · ${lireExceptions(f).length}`}>
              {lireExceptions(f).map((e) => {
                const orpheline = orphelines.some((x) => x.d === e.d);
                return (
                  <ChampFiche key={e.d} label={jourCourt(e.d)} sous={orpheline ? '⚠ à revoir : cette date ne correspond plus au calendrier' : undefined}>
                    <View style={s.rang}>
                      <Text style={[s.texte, orpheline && s.orange]}>{e.annulee ? 'Annulée' : `Déplacée → ${e.a ? `${jourCourt(e.a.slice(0, 10))} ${e.a.slice(11)}` : ''}${e.duree ? ` · ${dureeReunion(e.duree)}` : ''}`}</Text>
                      {modifiable && (
                        <Pressable onPress={() => set({ exceptions: JSON.stringify(lireExceptions(f).filter((x) => x.d !== e.d)) })} hitSlop={8} accessibilityLabel="Retirer l'exception">
                          <Text style={s.retirer}>✕</Text>
                        </Pressable>
                      )}
                    </View>
                  </ChampFiche>
                );
              })}
            </SectionFiche>
          )}

          <SectionFiche titre="Prochaines réunions">
            {apercu.length ? (
              apercu.map((o) => (
                <ChampFiche key={o.origine} label={jourCourt(o.debut.slice(0, 10))}>
                  <Text style={s.texte}>
                    {o.debut.slice(11).replace(/^0/, '')} · {dureeReunion(o.duree)}
                    {o.deplacee ? ' · déplacée' : ''}
                  </Text>
                </ChampFiche>
              ))
            ) : (
              <Text style={s.aide}>Aucune réunion avec ces réglages.</Text>
            )}
          </SectionFiche>

          {vue && modifiable && portee === 'toutes' && f.actif !== 'non' && (
            <Pressable
              onPress={() => {
                set({ actif: 'non', fin: aujourdhui });
              }}
              style={s.arreter}
              accessibilityRole="button"
            >
              <Text style={s.arreterTexte}>Arrêter la série</Text>
            </Pressable>
          )}
          {f.actif === 'non' && <Text style={s.aide}>Série arrêtée à l'enregistrement (gardée pour l'historique et les comptes rendus).</Text>}
        </>
      )}
    </FormSheet>
  );
}

/** Champs changés par la fiche (ceux de la règle et des personnes ; pas l'id, ni les exceptions de la portée « une ») */
function changements(avant: SerieReunion, apres: SerieReunion): Partial<SerieReunion> {
  const out: Partial<SerieReunion> = {};
  for (const k of ['titre', 'unite', 'ancre', 'ecart', 'jours', 'tous', 'heure', 'duree', 'animateur', 'editeurs', 'participants', 'debut', 'fin', 'exceptions', 'actif'] as const)
    if (avant[k] !== apres[k]) (out as Record<string, string>)[k] = apres[k];
  return out;
}

/** Carte « 📅 Réunions » de l'écran Tâches : vos séries, la prochaine réunion de chacune ; toucher → la fiche */
export function CarteSeries({ vues, org, onOuvrir, onNouvelle }: { vues: SerieVue[]; org: OrgValue; onOuvrir: (v: SerieVue) => void; onNouvelle: () => void }) {
  const [ouverte, setOuverte] = useState(false);
  const aujourdhui = toDateString(new Date());
  const fin = toDateString(addDays(new Date(), 120));
  const lignes = vues
    .filter((v) => v.serie.actif !== 'non')
    .map((v) => ({ v, prochaine: occurrences(v.serie, aujourdhui, fin, v.cal).find((o) => !o.annulee) }))
    .sort((a, b) => (a.prochaine?.debut ?? '9').localeCompare(b.prochaine?.debut ?? '9'));
  if (!lignes.length) return null;
  return (
    <View style={s.carte}>
      <Pressable onPress={() => setOuverte((o) => !o)} style={s.entete} accessibilityRole="button" accessibilityState={{ expanded: ouverte }}>
        <Text style={s.enteteTexte}>📅 Réunions · {lignes.length} série{lignes.length > 1 ? 's' : ''}</Text>
        <Text style={s.chev}>{ouverte ? '▾' : '▸'}</Text>
      </Pressable>
      {ouverte && (
        <>
          {lignes.map(({ v, prochaine }) => {
            const t = TYPES_REUNION[v.type];
            const niveau = libelleNiveau(lireNiveau(v.serie.niveau), org);
            return (
              <Pressable key={`${v.serie.espace}|${v.serie.id}`} onPress={() => onOuvrir(v)} style={s.ligne} accessibilityRole="button">
                <Text style={s.icone}>{t.icone}</Text>
                <View style={s.corps}>
                  <Text style={s.titre} numberOfLines={1}>
                    {v.serie.titre.trim() || t.libelle}
                    {niveau ? <Text style={s.gris}> · {niveau}</Text> : null}
                  </Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {libelleRegle(v.serie)} · {v.serie.heure}
                    {prochaine ? ` · prochaine ${jourCourt(prochaine.debut.slice(0, 10))}` : ''}
                  </Text>
                </View>
                <Text style={s.chev}>›</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={onNouvelle} style={s.ligne} accessibilityRole="button">
            <Text style={s.nouvelle}>＋ Nouvelle réunion</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  info: { fontSize: 13, color: colors.muted, marginBottom: 10 },
  aide: { fontSize: 12, color: colors.muted, paddingHorizontal: 12, paddingVertical: 8 },
  regle: { fontSize: 12.5, color: colors.primary, paddingHorizontal: 12, paddingVertical: 9, fontWeight: '600' },
  rang: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  texte: { fontSize: 15, color: colors.text },
  orange: { color: '#C2410C' },
  retirer: { fontSize: 15, color: colors.muted },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  puce: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#F1F3F6' },
  puceOn: { backgroundColor: colors.primary },
  puceTexte: { fontSize: 13, color: colors.text },
  puceTexteOn: { color: '#fff', fontWeight: '600' },
  arreter: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 18, marginTop: 6 },
  arreterTexte: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  carte: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, marginTop: 8, marginBottom: 4, overflow: 'hidden' },
  entete: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  enteteTexte: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4E7EC' },
  icone: { fontSize: 18, width: 26, textAlign: 'center' },
  corps: { flex: 1, minWidth: 0 },
  titre: { fontSize: 15, color: colors.text },
  gris: { color: colors.muted },
  meta: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  chev: { fontSize: 16, color: colors.muted },
  nouvelle: { fontSize: 15, color: colors.primary, fontWeight: '600' },
});
