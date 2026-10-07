import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { type Calendrier, estDefaut, iterationsOf, lireCalendrier, piLabel, piOf, shiftPi } from '../pi';
import { ChampFiche, SaisieFiche, SectionFiche } from './Choix';

/**
 * 🗓️ Calendrier agile d'une équipe ou d'un train (07/10) : durée d'un sprint, nombre de sprints par PI, semaine IP,
 * début du PI ; et, occasionnellement, un PI qui commence un autre jour. Équipe : vide = le calendrier de son train.
 * Toute l'équipe suit ce calendrier (ses sprints partout, ses réunions).
 */
export function SectionCalendrier({ value, onChange, herite, nomHerite }: { value: string; onChange: (v: string) => void; herite?: string; nomHerite?: string }) {
  const propre = !!value.trim();
  const cal = lireCalendrier(propre ? value : (herite ?? ''));
  const [jour, setJour] = useState('');
  const poser = (c: Partial<Calendrier>) => {
    const n = lireCalendrier({ ...cal, ...c });
    onChange(estDefaut(n) && !herite ? '' : JSON.stringify(n));
  };
  const piSuivant = shiftPi(piOf(new Date(), cal), 1);
  const apercu = iterationsOf(piOf(new Date(), cal), cal);
  const exceptions = cal.exceptions ?? [];
  const lecture = nomHerite !== undefined && !propre;
  return (
    <SectionFiche titre="🗓️ Calendrier agile">
      {nomHerite !== undefined && (
        <ChampFiche label="Calendrier">
          <Puces
            options={[
              { v: 'h', l: `Celui du train${nomHerite ? ` (${nomHerite})` : ''}` },
              { v: 'p', l: 'Propre à l’équipe' },
            ]}
            value={propre ? 'p' : 'h'}
            onChange={(v) => onChange(v === 'p' ? JSON.stringify(cal) : '')}
          />
        </ChampFiche>
      )}
      <View pointerEvents={lecture ? 'none' : 'auto'} style={lecture && s.gris}>
        <ChampFiche label="Sprint">
          <Puces options={[1, 2, 3, 4].map((n) => ({ v: String(n), l: `${n} sem.` }))} value={String(cal.semaines)} onChange={(v) => poser({ semaines: Number(v) })} />
        </ChampFiche>
        <ChampFiche label="Sprints par PI">
          <Pas valeur={cal.sprints} min={1} max={12} onChange={(n) => poser({ sprints: n })} />
        </ChampFiche>
        <ChampFiche label="Semaine IP">
          <Puces options={[{ v: 'o', l: 'Oui' }, { v: 'n', l: 'Non' }]} value={cal.ip ? 'o' : 'n'} onChange={(v) => poser({ ip: v === 'o' })} />
        </ChampFiche>
        <ChampFiche label="Début du PI" sous="Jours après le 1er jour du trimestre">
          <Pas valeur={cal.decalage} min={0} max={60} onChange={(n) => poser({ decalage: n })} suffixe=" j" />
        </ChampFiche>
        {exceptions.map((e) => (
          <ChampFiche key={e.pi} label={piLabel(e.pi)}>
            <View style={s.rang}>
              <Text style={s.texte}>commence le {e.debut.split('-').reverse().join('/')}</Text>
              <Pressable onPress={() => poser({ exceptions: exceptions.filter((x) => x.pi !== e.pi) })} accessibilityLabel="Retirer l'exception" hitSlop={8}>
                <Text style={s.retirer}>✕</Text>
              </Pressable>
            </View>
          </ChampFiche>
        ))}
        <ChampFiche label="Exception" sous={`Une fois : ${piLabel(piSuivant)} commence un autre jour (AAAA-MM-JJ)`}>
          <View style={s.rang}>
            <SaisieFiche value={jour} onChangeText={(v) => setJour(v.replace(/[^0-9-]/g, '').slice(0, 10))} placeholder="ex. 2027-01-11" accessibilityLabel="Début exceptionnel du PI suivant" />
            {/^\d{4}-\d{2}-\d{2}$/.test(jour) && (
              <Pressable
                onPress={() => {
                  poser({ exceptions: [...exceptions.filter((x) => x.pi !== piSuivant), { pi: piSuivant, debut: jour }] });
                  setJour('');
                }}
                style={s.ajouter}
              >
                <Text style={s.ajouterTexte}>Ajouter</Text>
              </Pressable>
            )}
          </View>
        </ChampFiche>
      </View>
      <Text style={s.apercu}>
        {piLabel(apercu[0]?.pi ?? '')} : {apercu.map((it) => it.label).join(' · ')}
      </Text>
    </SectionFiche>
  );
}

export function Puces({ options, value, onChange }: { options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.puces}>
      {options.map((o) => (
        <Pressable key={o.v} onPress={() => onChange(o.v)} style={[s.puce, o.v === value && s.puceOn]} accessibilityRole="button" accessibilityState={{ selected: o.v === value }}>
          <Text style={[s.puceTexte, o.v === value && s.puceTexteOn]}>{o.l}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Pas({ valeur, min, max, onChange, suffixe = '', format }: { valeur: number; min: number; max: number; onChange: (n: number) => void; suffixe?: string; format?: (n: number) => string }) {
  return (
    <View style={s.rang}>
      <Pressable onPress={() => onChange(Math.max(min, valeur - 1))} style={s.pas} accessibilityLabel="Moins">
        <Text style={s.pasTexte}>−</Text>
      </Pressable>
      <Text style={s.valeur}>
        {format ? format(valeur) : `${valeur}${suffixe}`}
      </Text>
      <Pressable onPress={() => onChange(Math.min(max, valeur + 1))} style={s.pas} accessibilityLabel="Plus">
        <Text style={s.pasTexte}>＋</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  gris: { opacity: 0.45 },
  rang: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  texte: { fontSize: 15, color: colors.text },
  retirer: { fontSize: 15, color: colors.muted },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  puce: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#F1F3F6' },
  puceOn: { backgroundColor: colors.primary },
  puceTexte: { fontSize: 13, color: colors.text },
  puceTexteOn: { color: '#fff', fontWeight: '600' },
  pas: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F1F3F6', alignItems: 'center', justifyContent: 'center' },
  pasTexte: { fontSize: 16, color: colors.text },
  valeur: { fontSize: 15, minWidth: 34, textAlign: 'center', fontVariant: ['tabular-nums'], color: colors.text },
  ajouter: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.primary },
  ajouterTexte: { color: '#fff', fontSize: 13, fontWeight: '600' },
  apercu: { fontSize: 11.5, color: colors.muted, paddingHorizontal: 12, paddingVertical: 10 },
});
