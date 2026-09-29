import { ReactNode } from 'react';
import { domaineOf, epicOf, objectifOf } from '../hierarchy';
import { useHierarchy } from '../hierarchyContext';
import { listeDomaines, listeEpics, listeFeatures, listeObjectifs } from '../choixTravail';
import { LigneChoix, SectionFiche } from './Choix';

type Niveau = 'feature' | 'epic' | 'objectif' | 'domaine';
type Links = { feature?: string; epic?: string; objectif?: string; domaine?: string };

interface Props {
  /** Niveaux proposés, du plus précis au plus large */
  levels: Niveau[];
  value: Links;
  onChange: (patch: Links) => void;
  /** « ＋ Nouvelle feature / epic / objectif / nouveau domaine » : la fiche s'ouvre par-dessus, l'élément créé est choisi */
  onNouveau?: (niveau: Niveau, defauts: Links) => void;
  /** Rattachement de l'élément enregistré : en choisir un autre est annoncé (« déplacée ») */
  initial?: Links;
  /** Rattachement attendu (orange tant qu'il est vide) : un niveau précis, ou « un » = au moins un niveau */
  attendu?: Niveau | 'un';
  /** Titre de la section (par défaut « Rattachement ») */
  titre?: string;
  /** Lignes en plus dans la même section (tâche parente…) */
  children?: ReactNode;
}

const LIBELLE: Record<Niveau, string> = { feature: 'Feature', epic: 'Epic', objectif: 'Objectif', domaine: 'Domaine' };
const NOUVEAU: Record<Niveau, string> = { feature: 'Nouvelle feature', epic: 'Nouvelle epic', objectif: 'Nouvel objectif', domaine: 'Nouveau domaine' };
const SANS: Record<Niveau, string> = { feature: 'Sans feature', epic: 'Sans epic', objectif: 'Sans objectif', domaine: 'Sans domaine' };

/** Lien le plus précis (« feature », « epic »…) */
const precis = (v: Links, levels: Niveau[]): Niveau | undefined => levels.find((l) => !!v[l]);

/**
 * Rattachement à un niveau supérieur, en lignes de choix : on choisit le plus précis (feature, sinon epic, sinon
 * objectif, sinon domaine) ; les lignes plus larges disparaissent une fois un niveau choisi (le chemin s'affiche
 * en petit sous la ligne). Changer le rattachement d'un élément enregistré le « déplace » (pastille).
 */
export function LinkPicker({ levels, value, onChange, onNouveau, initial, attendu, titre = 'Rattachement', children }: Props) {
  const h = useHierarchy();
  // Feature non proposée (mode Simple) : la tâche d'une feature est montrée dans l'epic de cette feature,
  // et rechoisir cette epic garde son lien avec la feature (le lien tâche → epic n'est jamais perdu)
  const featureCachee = !levels.includes('feature') && value.feature ? h.features.get(value.feature) : undefined;
  const cur: Links = { ...value, epic: value.epic || (featureCachee?.epic ?? '') };
  const ini: Links = initial
    ? { ...initial, epic: initial.epic || (!levels.includes('feature') && initial.feature ? (h.features.get(initial.feature)?.epic ?? '') : '') }
    : {};
  const choisi = precis(cur, levels);
  const depart = precis(ini, levels);
  // Lignes visibles : jusqu'au niveau choisi (les plus larges s'en déduisent)
  const visibles = choisi ? levels.slice(0, levels.indexOf(choisi) + 1) : levels;
  const vide = !choisi;
  const cle = (v: Links, n?: Niveau) => (n ? `${n}:${v[n]}` : '');
  const deplace = !!depart && cle(cur, choisi) !== cle(ini, depart);
  const nomIni = depart
    ? depart === 'feature'
      ? `🧩 ${h.features.get(ini.feature!)?.titre ?? '?'}`
      : depart === 'epic'
        ? `🗂️ ${h.epics.get(ini.epic!)?.titre ?? '?'}`
        : depart === 'objectif'
          ? `🎯 ${h.objectifs.get(ini.objectif!)?.titre ?? '?'}`
          : `${h.domaines.get(ini.domaine!)?.icone ?? ''} ${h.domaines.get(ini.domaine!)?.nom ?? '?'}`.trim()
    : '';
  const estAttendu = (l: Niveau) => (attendu === 'un' ? vide : attendu === l && !cur[l]);
  const aDefinir = attendu === 'un' ? (vide ? 1 : 0) : attendu && !cur[attendu] && visibles.includes(attendu) ? 1 : 0;

  // Nouveau parent : sous le même grand-parent que le parent actuel (ex. une feature dans la même epic)
  const defauts = (l: Niveau): Links => {
    const ref = { [l]: cur[l] || ini[l] } as Links;
    if (l === 'feature') return { epic: epicOf(ref, h)?.id };
    if (l === 'epic') {
      const o = objectifOf(ref, h);
      return o ? { objectif: o.id } : { domaine: domaineOf(ref, h)?.id };
    }
    if (l === 'objectif') return { domaine: domaineOf(ref, h)?.id };
    return {};
  };
  const liste = (l: Niveau) =>
    l === 'feature'
      ? listeFeatures(h, cur.feature || ini.feature)
      : l === 'epic'
        ? listeEpics(h, cur.epic || ini.epic)
        : l === 'objectif'
          ? listeObjectifs(h, cur.objectif || ini.objectif)
          : listeDomaines(h);
  const choisir = (l: Niveau, v: string) => {
    if (l === 'epic' && featureCachee && v === featureCachee.epic) return onChange({ feature: featureCachee.id, epic: '', objectif: '', domaine: '' });
    onChange({ feature: '', epic: '', objectif: '', domaine: '', [l]: v });
  };

  return (
    <SectionFiche titre={titre} aDefinir={aDefinir}>
      {visibles.map((l) => {
        const { groupes, autres } = liste(l);
        return (
          <LigneChoix
            key={l}
            label={LIBELLE[l]}
            value={cur[l] ?? ''}
            // Pastille « déplacée » sur la ligne du rattachement actuel (ou la première, s'il n'y en a plus)
            changement={deplace && l === (choisi ?? visibles[0]) ? { avant: nomIni, annuler: () => onChange({ feature: '', epic: '', objectif: '', domaine: '', ...initial }) } : undefined}
            parent
            attendu={estAttendu(l)}
            groupes={groupes}
            autres={autres}
            nouveau={onNouveau ? { label: NOUVEAU[l], onPress: () => onNouveau(l, defauts(l)) } : undefined}
            sans={SANS[l]}
            onChange={(v) => choisir(l, v)}
          />
        );
      })}
      {children}
    </SectionFiche>
  );
}
