import { useHierarchy } from '../hierarchyContext';
import { grouper } from '../choixTravail';
import { makeOrgValue, membresDe, nomPersonne, porteurs, useOrg } from '../organisation';
import { useSafe } from '../safe';
import { LigneChoix, SectionFiche } from './Choix';

type Valeurs = { portfolio?: string; train?: string; equipe?: string; responsable?: string; epic?: string; feature?: string };
type KindNouveau = 'portfolio' | 'train' | 'equipeagile' | 'personne';
type Champ = 'portfolio' | 'train' | 'equipe' | 'responsable';

/**
 * Section « Delivery » d'un élément de travail (mode SAFe, entreprise avec un delivery), en lignes de choix :
 * epic → portfolio ; feature → train et équipe ; story ou tâche → équipe et responsable. Le chemin
 * (portfolio › train) s'affiche en petit sous la première ligne.
 */
export function LiaisonOrg({
  espace,
  niveau,
  valeurs,
  onChange,
  onNouveau,
  initial,
  attendu,
}: {
  espace: string;
  niveau: 'epic' | 'feature' | 'item';
  valeurs: Valeurs;
  onChange: (patch: Valeurs) => void;
  /** « ＋ Nouveau portfolio / train / équipe / personne » : fiche de l'Organisation par-dessus, l'élément créé est choisi */
  onNouveau?: (kind: KindNouveau, champ: Champ) => void;
  /** Valeurs de l'élément enregistré (pastille « changée ») */
  initial?: Valeurs;
  /** Affectations attendues (SAFe) : orange tant qu'elles sont vides */
  attendu?: boolean;
}) {
  const safe = useSafe();
  const tout = useOrg();
  const h = useHierarchy();
  const dans = <T extends { espace?: string }>(l: T[]) => l.filter((x) => (x.espace || 'moi') === espace);
  const o = makeOrgValue({ personnes: dans(tout.personnes), unites: dans(tout.unites), portfolios: dans(tout.portfolios), trains: dans(tout.trains), equipes: dans(tout.equipes) });
  if (!safe.actif || !o.delivery) return null;

  const p = porteurs(valeurs, h, o);
  const feature = valeurs.feature ? h.features.get(valeurs.feature) : undefined;
  const nouveau = (kind: KindNouveau, champ: Champ, label: string) => (onNouveau ? { label, onPress: () => onNouveau(kind, champ) } : undefined);
  const cheminOrg = [p.portfolio ? `💼 ${o.portfolio.get(p.portfolio)?.nom ?? '?'}` : '', p.train ? `🚆 ${o.train.get(p.train)?.nom ?? '?'}` : ''].filter(Boolean).join(' › ');

  const nbMembres = (id: string) => {
    const e = o.equipe.get(id);
    return e ? `${membresDe(e).length} membre${membresDe(e).length > 1 ? 's' : ''}` : '';
  };
  const listeEquipes = (trainPrefere?: string) =>
    grouper(
      [...o.equipes].sort((a, b) => a.nom.localeCompare(b.nom)),
      (e) => e.train || '',
      (k) => (k ? `🚆 ${o.train.get(k)?.nom ?? '?'}` : 'Sans train'),
      (e) => ({ value: e.id, label: `👥 ${e.nom}`, meta: nbMembres(e.id) }),
      trainPrefere,
      'Autres trains',
    );

  if (niveau === 'epic') {
    return (
      <SectionFiche titre="Delivery" aDefinir={attendu && !valeurs.portfolio ? 1 : 0}>
        <LigneChoix
          label="Portfolio"
          value={valeurs.portfolio ?? ''}
          depart={initial?.portfolio}
          attendu={attendu}
          groupes={[{ options: o.portfolios.map((x) => ({ value: x.id, label: `💼 ${x.nom}` })) }]}
          nouveau={nouveau('portfolio', 'portfolio', 'Nouveau portfolio')}
          sans="Sans portfolio"
          onChange={(v) => onChange({ portfolio: v })}
        />
      </SectionFiche>
    );
  }

  if (niveau === 'feature') {
    const equipe = valeurs.equipe ? o.equipe.get(valeurs.equipe) : undefined;
    const manque = (attendu && !valeurs.train ? 1 : 0) + (attendu && !valeurs.equipe ? 1 : 0);
    return (
      <SectionFiche titre="Delivery" aDefinir={manque}>
        <LigneChoix
          label="Train"
          value={valeurs.train ?? ''}
          depart={initial?.train}
          attendu={attendu}
          sous={p.portfolio ? `💼 ${o.portfolio.get(p.portfolio)?.nom ?? '?'}` : undefined}
          groupes={[{ options: o.trains.map((x) => ({ value: x.id, label: `🚆 ${x.nom}` })) }]}
          nouveau={nouveau('train', 'train', 'Nouveau train')}
          sans="Sans train"
          // Un autre train : l'équipe d'un autre train n'est plus proposée d'office
          onChange={(v) => onChange({ train: v, equipe: v && equipe && equipe.train !== v ? '' : (valeurs.equipe ?? '') })}
        />
        <LigneChoix
          label="Équipe"
          value={valeurs.equipe ?? ''}
          depart={initial?.equipe}
          attendu={attendu}
          {...listeEquipes(valeurs.train || initial?.train || undefined)}
          nouveau={nouveau('equipeagile', 'equipe', 'Nouvelle équipe')}
          sans="Sans équipe"
          onChange={(v) => onChange({ equipe: v, train: v ? (o.equipe.get(v)?.train || valeurs.train || '') : (valeurs.train ?? '') })}
        />
      </SectionFiche>
    );
  }

  // Story ou tâche : équipe (sinon celle de la feature) et responsable (membres de l'équipe d'abord)
  const equipeId = valeurs.equipe || feature?.equipe || '';
  const equipe = equipeId ? o.equipe.get(equipeId) : undefined;
  const gens = equipe ? new Set([...membresDe(equipe), equipe.po, equipe.sm].filter(Boolean)) : null;
  const personnes = [...o.personnes].sort((a, b) => a.nom.localeCompare(b.nom));
  const trainFeature = feature?.train || (feature?.equipe ? o.equipe.get(feature.equipe)?.train : '') || '';
  const equipeAttendue = !!attendu && !valeurs.equipe && !feature?.equipe;
  const manque = (equipeAttendue ? 1 : 0) + (attendu && !valeurs.responsable ? 1 : 0);
  return (
    <SectionFiche titre="Delivery" aDefinir={manque}>
      <LigneChoix
        label="Équipe"
        value={valeurs.equipe ?? ''}
        depart={initial?.equipe}
        attendu={equipeAttendue}
        vide={feature?.equipe ? `Celle de la feature : 👥 ${o.equipe.get(feature.equipe)?.nom ?? '?'}` : undefined}
        sous={cheminOrg || undefined}
        {...listeEquipes(trainFeature || (valeurs.equipe ? o.equipe.get(valeurs.equipe)?.train : undefined) || undefined)}
        nouveau={nouveau('equipeagile', 'equipe', 'Nouvelle équipe')}
        sans={feature?.equipe ? 'Celle de la feature' : 'Sans équipe'}
        onChange={(v) => {
          const eq = v ? o.equipe.get(v) : undefined;
          const garde = !eq || !valeurs.responsable || [...membresDe(eq), eq.po, eq.sm].includes(valeurs.responsable);
          onChange({ equipe: v, responsable: garde ? (valeurs.responsable ?? '') : '' });
        }}
      />
      <LigneChoix
        label="Responsable"
        value={valeurs.responsable ?? ''}
        depart={initial?.responsable}
        attendu={attendu}
        libelle={(v) => nomPersonne(o, v) || '?'}
        {...(gens
          ? {
              groupes: [{ titre: `👥 ${equipe!.nom}`, options: personnes.filter((x) => gens.has(x.id)).map((x) => ({ value: x.id, label: x.nom })) }],
              autres: { titre: 'Autres personnes', groupes: [{ options: personnes.filter((x) => !gens.has(x.id)).map((x) => ({ value: x.id, label: x.nom })) }] },
            }
          : { groupes: [{ options: personnes.map((x) => ({ value: x.id, label: x.nom })) }] })}
        nouveau={nouveau('personne', 'responsable', 'Nouvelle personne')}
        sans="Sans responsable"
        onChange={(v) => onChange({ responsable: v })}
      />
    </SectionFiche>
  );
}
