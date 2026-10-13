import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { demiDe, enHeure, enMinutes, type EvenementJour, finDe, finMax, type Journee, momentsLibres, type PlaceJour } from '../../daily';
import { colors } from '../../theme';
import type { Item } from '../../types';
import { SectionFiche } from '../Choix';
import { ChoiceSheet } from '../ChoiceSheet';
import { Frise, Glissable, PX } from './Frise';
import { Ligne, Pastille, st, Vide } from './ui';

const RE_HEURE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DUREES = [30, 60, 90, 120, 180];
const libDuree = (n: number) => (n < 60 ? `${n} min` : `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60}` : ''}`);
const titreDe = (t: Item) => `${t.type === 'story' ? '📖 ' : ''}${t.titre}`;

/**
 * Étape « Plan du jour » (13/10, R5) : l'emploi du temps de la journée, vu par moi seul (rangé dans 🔒 Moi). Deux vues,
 * un seul plan : « Matin / Après-midi » (ranger chaque élément dans une demi-journée) et « Emploi du temps » (toucher
 * un moment libre et y mettre un élément : il prend tout le moment, sa durée s'affiche pour l'ajuster). Les éléments
 * cochés dans Aujourd'hui sans heure sont « À placer » ; ceux qui ont déjà une heure ce jour-là sont fixes.
 */
export function PlanDuJour({
  elements,
  places,
  fixes,
  perso,
  journee,
  onPlacer,
  onAjouterEvt,
  onRetirerEvt,
  onJournee,
}: {
  /** Éléments cochés dans Aujourd'hui (sans heure propre ce jour-là) */
  elements: Item[];
  places: Record<string, PlaceJour>;
  /** Réunions du jour et éléments qui ont déjà une heure ce jour-là */
  fixes: EvenementJour[];
  /** Événements perso de la journée */
  perso: EvenementJour[];
  journee: Journee;
  onPlacer: (element: string, p: PlaceJour | null) => void;
  onAjouterEvt: (e: EvenementJour) => void;
  onRetirerEvt: (e: EvenementJour) => void;
  onJournee: (j: Journee) => void;
}) {
  const [vue, setVue] = useState<'demi' | 'edt'>('demi');
  /** Moment libre touché : choisir l'élément à y mettre */
  const [moment, setMoment] = useState<{ de: string; a: string; demi: 'Matin' | 'Après-midi' } | null>(null);
  /** Élément placé dont on règle la durée (affiché aussitôt après l'avoir placé) */
  const [regle, setRegle] = useState('');
  /** Élément placé à déplacer : toucher ensuite un moment libre, un autre élément (échange) ou « À placer » */
  const [deplace, setDeplace] = useState('');
  const placeDe = (id: string): PlaceJour => places[id] ?? { demi: '' };
  const aHeure = (id: string) => !!placeDe(id).debut;
  const avecHeure = elements.filter((t) => aHeure(t.id));
  const occupes = (sauf = ''): EvenementJour[] => [
    ...fixes,
    ...perso,
    ...avecHeure.filter((t) => t.id !== sauf).map((t) => ({ heure: placeDe(t.id).debut!, fin: placeDe(t.id).fin, titre: t.titre })),
  ];
  const aPlacer = elements.filter((t) => !aHeure(t.id));
  const parId = new Map(elements.map((t) => [t.id, t]));

  const placerDans = (id: string, m: { de: string; a: string; demi: 'Matin' | 'Après-midi' }) => {
    onPlacer(id, { demi: m.demi, debut: m.de, fin: m.a });
    setRegle(id);
    setDeplace('');
  };
  const echanger = (a: string, b: string) => {
    const pa = placeDe(a);
    const pb = placeDe(b);
    const da = enMinutes(pa.fin ?? '') - enMinutes(pa.debut ?? '');
    const db = enMinutes(pb.fin ?? '') - enMinutes(pb.debut ?? '');
    // Chacun prend l'heure de début de l'autre et garde sa durée
    onPlacer(a, { demi: pb.demi, debut: pb.debut, fin: enHeure(enMinutes(pb.debut!) + da) });
    onPlacer(b, { demi: pa.demi, debut: pa.debut, fin: enHeure(enMinutes(pa.debut!) + db) });
    setDeplace('');
  };

  // ---- Glisser (R5c) : un lâcher sur la frise place, déplace, échange ou remet « À placer » ----
  const haut = useRef(0);
  const snap = (n: number) => Math.round(n / 15) * 15;
  const deposer = (id: string, pageY: number) => {
    const m = enMinutes(journee.debut) + (pageY - haut.current) / PX;
    const p = placeDe(id);
    if (m < enMinutes(journee.debut) - 10) return p.debut ? (onPlacer(id, { demi: p.demi }), setRegle('')) : undefined;
    const sur = avecHeure.find((t) => t.id !== id && enMinutes(placeDe(t.id).debut!) <= m && m < enMinutes(placeDe(t.id).fin!));
    if (sur && p.debut) return echanger(id, sur.id);
    const libre = momentsLibres(journee, occupes(id), 15).find((x) => enMinutes(x.de) <= m && m < enMinutes(x.a));
    if (!libre) return;
    let debut = Math.max(enMinutes(libre.de), snap(m));
    if (enMinutes(libre.a) - debut < 15) debut = enMinutes(libre.de);
    const duree = p.debut && p.fin ? enMinutes(p.fin) - enMinutes(p.debut) : enMinutes(libre.a) - debut;
    const finE = Math.min(enMinutes(libre.a), debut + duree);
    onPlacer(id, { demi: libre.demi, debut: enHeure(debut), fin: enHeure(finE) });
    setRegle(id);
    setDeplace('');
  };

  // ---- Journée et événements perso ----
  const [reglage, setReglage] = useState<Journee | null>(null);
  const [saisie, setSaisie] = useState(false);
  const [heure, setHeure] = useState('');
  const [fin, setFin] = useState('');
  const [titre, setTitre] = useState('');
  const pret = RE_HEURE.test(heure.trim()) && RE_HEURE.test(fin.trim()) && enMinutes(fin) > enMinutes(heure) && !!titre.trim();
  const reglageOk = !!reglage && Object.values(reglage).every((x) => RE_HEURE.test(x.trim()));
  const champ = (v: string, set: (x: string) => void, label: string, place: string) => (
    <TextInput value={v} onChangeText={set} placeholder={place} style={[st.saisie, { flex: 0, width: 58 }]} accessibilityLabel={label} />
  );

  const ligneElement = (t: Item, i: number) => {
    const p = placeDe(t.id);
    return (
      <View key={t.id} style={[st.saisieBloc, i > 0 && st.bord]}>
        <View style={st.ligneHaut}>
          <Text style={[st.texte, { flex: 1 }]}>{titreDe(t)}</Text>
          {!!p.debut && <Text style={st.sous}>{`${p.debut} → ${p.fin}`}</Text>}
        </View>
        <View style={st.choix}>
          {(['Matin', 'Après-midi'] as const).map((d) => (
            <Pressable
              key={d}
              onPress={() => onPlacer(t.id, p.demi === d ? null : { demi: d })}
              style={[st.choixPastille, st.choixPetit, p.demi === d && st.choixOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: p.demi === d }}
              accessibilityLabel={`${d} : ${t.titre}`}
            >
              <Text style={[st.choixTexte, st.choixTextePetit, p.demi === d && st.choixTexteOn]}>{d}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  // ---- Emploi du temps : temps occupé, éléments placés, déjeuner et moments libres, dans l'ordre ----
  type Bloc = { de: string; a: string; quoi: 'fixe' | 'perso' | 'element' | 'libre' | 'dejeuner'; titre: string; id?: string; ev?: EvenementJour; demi?: 'Matin' | 'Après-midi' };
  const blocs: Bloc[] = [
    ...fixes.map((e) => ({ de: e.heure, a: finDe(e), quoi: 'fixe' as const, titre: e.titre })),
    ...perso.map((e) => ({ de: e.heure, a: finDe(e), quoi: 'perso' as const, titre: e.titre, ev: e })),
    ...avecHeure.map((t) => ({ de: placeDe(t.id).debut!, a: placeDe(t.id).fin ?? finDe({ heure: placeDe(t.id).debut! }), quoi: 'element' as const, titre: titreDe(t), id: t.id })),
    { de: journee.dejDebut, a: journee.dejFin, quoi: 'dejeuner' as const, titre: 'Pause déjeuner' },
    ...momentsLibres(journee, occupes()).map((m) => ({ ...m, quoi: 'libre' as const, titre: 'Libre' })),
  ].sort((x, y) => enMinutes(x.de) - enMinutes(y.de) || (x.quoi === 'libre' ? 1 : -1));

  const blocEdt = (b: Bloc, i: number) => {
    const bord = i > 0 && st.bord;
    if (b.quoi === 'libre') {
      const cible = !!deplace;
      return (
        <Pressable
          key={`l-${b.de}`}
          onPress={() => (deplace ? placerDans(deplace, { de: b.de, a: b.a, demi: b.demi! }) : setMoment({ de: b.de, a: b.a, demi: b.demi! }))}
          style={[st.saisieBloc, bord, { backgroundColor: cible ? '#E8F0FE' : '#F6F7F9' }]}
          accessibilityRole="button"
          accessibilityLabel={`Moment libre ${b.de} → ${b.a}`}
        >
          <Text style={[st.sous, { color: colors.primary }]}>{`${b.de} → ${b.a} · libre · ${cible ? 'toucher pour y déplacer' : 'toucher pour placer'}`}</Text>
        </Pressable>
      );
    }
    if (b.quoi === 'element') {
      const id = b.id!;
      const p = placeDe(id);
      const max = enMinutes(finMax(journee, p.debut!, occupes(id))) - enMinutes(p.debut!);
      const duree = enMinutes(p.fin!) - enMinutes(p.debut!);
      const choisi = deplace === id;
      return (
        <View key={`e-${id}`} style={[st.saisieBloc, bord, choisi && { backgroundColor: '#E8F0FE' }]}>
          <Pressable
            onPress={() => (deplace && deplace !== id ? echanger(deplace, id) : setRegle(regle === id ? '' : id))}
            style={st.ligneHaut}
            accessibilityRole="button"
            accessibilityLabel={deplace && deplace !== id ? `Échanger avec ${b.titre}` : `Régler ${b.titre}`}
          >
            <Text style={[st.sous, { width: 92 }]}>{`${b.de} → ${b.a}`}</Text>
            <Text style={[st.texte, { flex: 1 }]}>{b.titre}</Text>
            {deplace && deplace !== id && <Pastille texte="⇄ Échanger" ton="bleu" />}
          </Pressable>
          {regle === id && !deplace && (
            <>
              <View style={st.choix}>
                {[...DUREES.filter((n) => n < max), max].filter((n, k, l) => n >= 15 && l.indexOf(n) === k).map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => onPlacer(id, { ...p, fin: enHeure(enMinutes(p.debut!) + n) })}
                    style={[st.choixPastille, st.choixPetit, duree === n && st.choixOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: duree === n }}
                  >
                    <Text style={[st.choixTexte, st.choixTextePetit, duree === n && st.choixTexteOn]}>{n === max && !DUREES.includes(n) ? `${libDuree(n)} (tout)` : libDuree(n)}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={st.choix}>
                <Pressable onPress={() => (onPlacer(id, { demi: p.demi }), setRegle(''))} style={[st.choixPastille, st.choixPetit]} accessibilityRole="button">
                  <Text style={[st.choixTexte, st.choixTextePetit]}>↩ À placer</Text>
                </Pressable>
              </View>
            </>
          )}
          {choisi && <Text style={st.sous}>Touchez un moment libre, un autre élément (échange) ou « À placer ».</Text>}
        </View>
      );
    }
    return (
      <View key={`${b.quoi}-${b.de}-${b.titre}`} style={[st.saisieBloc, bord, st.ligneHaut]}>
        <Text style={[st.sous, { width: 92 }]}>{`${b.de} → ${b.a}`}</Text>
        <Text style={[st.texte, { flex: 1, color: b.quoi === 'dejeuner' ? colors.muted : colors.text }]}>{b.titre}</Text>
        {b.quoi === 'perso' && <Pastille texte="perso" ton="gris" />}
        {b.quoi === 'perso' && (
          <Pressable onPress={() => onRetirerEvt(b.ev!)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Retirer « ${b.titre} »`}>
            <Text style={st.retirer}>✕</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <>
      <View style={[st.choix, { marginHorizontal: 16, marginBottom: 4 }]}>
        {(
          [
            ['demi', 'Matin / Après-midi'],
            ['edt', 'Emploi du temps'],
          ] as const
        ).map(([v, l]) => (
          <Pressable key={v} onPress={() => (setVue(v), setDeplace(''), setRegle(''))} style={[st.choixPastille, vue === v && st.choixOn]} accessibilityRole="tab" accessibilityState={{ selected: vue === v }}>
            <Text style={[st.choixTexte, vue === v && st.choixTexteOn]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <SectionFiche titre={`À placer · ${aPlacer.length}`}>
        {aPlacer.length ? (
          aPlacer.map((t, i) =>
            vue === 'demi' ? (
              ligneElement(t, i)
            ) : (
              <Glissable key={t.id} onLacher={(py) => deposer(t.id, py)}>
                <Ligne premiere={i === 0} texte={`⠿ ${titreDe(t)}`} sous={`${placeDe(t.id).demi ? `${placeDe(t.id).demi === 'Matin' ? 'matin' : 'après-midi'} · ` : ''}glissez-le dans la journée`} />
              </Glissable>
            ),
          )
        ) : (
          <Vide texte="Tout est placé." />
        )}
        {!!deplace && (
          <Pressable onPress={() => (onPlacer(deplace, { demi: placeDe(deplace).demi }), setDeplace(''))} style={[st.saisieBloc, st.bord, { backgroundColor: '#E8F0FE' }]} accessibilityRole="button">
            <Text style={[st.sous, { color: colors.primary }]}>↩ Remettre « {parId.get(deplace)?.titre} » à placer</Text>
          </Pressable>
        )}
      </SectionFiche>

      {vue === 'demi' ? (
        <SectionFiche titre={`Placés · ${elements.length - aPlacer.length}`}>
          {avecHeure.length ? avecHeure.map((t, i) => ligneElement(t, i)) : <Vide texte="Aucun élément dans l’emploi du temps." />}
        </SectionFiche>
      ) : (
        <>
          <Text style={[st.sous, { marginHorizontal: 20, marginBottom: 6 }]}>Glissez un élément dans la journée, sur un autre pour échanger, ou tout en haut pour le remettre à placer. Touchez un moment libre pour y placer un élément.</Text>
          <Frise
            debut={journee.debut}
            fin={journee.fin}
            blocs={blocs.map(({ de, a, quoi, titre, id }) => ({ de, a, quoi, titre, id }))}
            choisi={regle}
            onMesure={(y) => (haut.current = y)}
            onLibre={(b) => setMoment({ de: b.de, a: b.a, demi: demiDe(journee, b.de) })}
            onElement={(id) => setRegle(regle === id ? '' : id)}
            onLacher={deposer}
          />
          {!!regle && parId.get(regle) && aHeure(regle) && <SectionFiche titre={titreDe(parId.get(regle)!)}>{blocEdt(blocs.find((b) => b.id === regle)!, 0)}</SectionFiche>}
        </>
      )}

      <SectionFiche titre="Ma journée">
        {reglage ? (
          <View style={st.saisieBloc}>
            <View style={st.saisieLigne}>
              <Text style={st.sous}>Journée</Text>
              {champ(reglage.debut, (x) => setReglage({ ...reglage, debut: x }), 'Début de journée', '9:00')}
              <Text style={st.sous}>→</Text>
              {champ(reglage.fin, (x) => setReglage({ ...reglage, fin: x }), 'Fin de journée', '18:00')}
            </View>
            <View style={st.saisieLigne}>
              <Text style={st.sous}>Déjeuner</Text>
              {champ(reglage.dejDebut, (x) => setReglage({ ...reglage, dejDebut: x }), 'Début du déjeuner', '12:00')}
              <Text style={st.sous}>→</Text>
              {champ(reglage.dejFin, (x) => setReglage({ ...reglage, dejFin: x }), 'Fin du déjeuner', '14:00')}
              <Pressable disabled={!reglageOk} onPress={() => (onJournee(reglage), setReglage(null))} style={[st.ajouter, !reglageOk && { opacity: 0.4 }]} accessibilityRole="button">
                <Text style={st.ajouterTexte}>OK</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Ligne premiere texte={`Journée ${journee.debut} → ${journee.fin} · Déjeuner ${journee.dejDebut} → ${journee.dejFin}`} sous="touchez pour régler" onOuvrir={() => setReglage(journee)} />
        )}
        {saisie ? (
          <View style={[st.saisieBloc, st.bord]}>
            <View style={st.saisieLigne}>
              {champ(heure, (x) => (setHeure(x), !fin && RE_HEURE.test(x.trim()) && setFin(finDe({ heure: x.trim() }))), 'Début de l’événement', '11:00')}
              <Text style={st.sous}>→</Text>
              {champ(fin, setFin, 'Fin de l’événement', '11:30')}
            </View>
            <View style={st.saisieLigne}>
              <TextInput value={titre} onChangeText={setTitre} placeholder="Rendez-vous médecin" style={st.saisie} accessibilityLabel="Titre de l’événement" />
              <Pressable
                disabled={!pret}
                onPress={() => {
                  onAjouterEvt({ heure: heure.trim(), fin: fin.trim(), titre: titre.trim(), perso: true });
                  setHeure('');
                  setFin('');
                  setTitre('');
                  setSaisie(false);
                }}
                style={[st.ajouter, !pret && { opacity: 0.4 }]}
                accessibilityRole="button"
              >
                <Text style={st.ajouterTexte}>Ajouter</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setSaisie(true)} style={[st.saisieBloc, st.bord]} accessibilityRole="button">
            <Text style={st.ajouterLien}>＋ Événement perso</Text>
          </Pressable>
        )}
      </SectionFiche>

      {moment && (
        <ChoiceSheet
          visible
          title={`${moment.de} → ${moment.a} · placer`}
          message={aPlacer.length ? undefined : 'Rien à placer : cochez des éléments dans Aujourd’hui.'}
          choices={[...aPlacer.filter((t) => placeDe(t.id).demi === moment.demi), ...aPlacer.filter((t) => placeDe(t.id).demi !== moment.demi)].map((t) => ({
            label: `${titreDe(t)}${placeDe(t.id).demi ? ` · ${placeDe(t.id).demi === 'Matin' ? 'matin' : 'après-midi'}` : ''}`,
            onPress: () => {
              const m = moment;
              setMoment(null);
              placerDans(t.id, m);
            },
          }))}
          onClose={() => setMoment(null)}
        />
      )}

    </>
  );
}

