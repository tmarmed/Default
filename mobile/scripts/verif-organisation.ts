/**
 * Vérification automatique de la liaison organisation ↔ travail (src/organisation.ts), sur l'exemple ACME de la
 * démo : équipe, train et portfolio d'une story, d'une feature et d'une epic ; filtre Portfolio / Train / Équipe.
 * Lancer : npm run verif:organisation
 */
import { donneesDemo, orgDemo } from '../src/demo';
import { buildHierarchy } from '../src/hierarchy';
import { dansOrgFiltre, epicDansOrgFiltre, makeOrgValue, porteurs } from '../src/organisation';

let erreurs = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    erreurs++;
    console.error(`✗ ${msg}`);
  } else console.log(`✓ ${msg}`);
};

const d = donneesDemo('demo-entreprise');
const o = makeOrgValue(orgDemo('demo-entreprise'));
const h = buildHierarchy(d.entities.epic, d.entities.objectif, d.entities.domaine, d.entities.feature);

ok(o.delivery && o.portfolios.length === 1 && o.trains.length === 1 && o.equipes.length === 2, 'ACME : 1 portfolio, 1 train, 2 équipes');

const story = d.items.find((t) => t.titre === 'Écran de connexion')!;
const p = porteurs(story, h, o);
ok(p.equipe === 'acmeqmob' && p.train === 'acmtr1' && p.portfolio === 'acmpf1', 'story : équipe Mobile, train Clients, portfolio Digital');

// Story sans équipe directe : celle de sa feature
const sansEquipe = { ...story, equipe: '' };
ok(porteurs(sansEquipe, h, o).equipe === 'acmeqmob', "story sans équipe : celle de sa feature");

// Tâche rattachée seulement à une epic : portfolio de l'epic, pas d'équipe
const tacheEpic = d.items.find((t) => t.titre === 'Former les commerciaux')!;
const pe = porteurs(tacheEpic, h, o);
ok(pe.portfolio === 'acmpf1' && !pe.equipe && !pe.train, 'tâche rattachée à une epic : portfolio de l’epic seulement');

// Filtres
const web = { kind: 'equipeagile' as const, id: 'acmeqweb' };
const mobile = { kind: 'equipeagile' as const, id: 'acmeqmob' };
const train = { kind: 'train' as const, id: 'acmtr1' };
const portfolio = { kind: 'portfolio' as const, id: 'acmpf1' };
ok(dansOrgFiltre(story, mobile, h, o) && !dansOrgFiltre(story, web, h, o), 'filtre équipe : la story de Mobile passe, pas pour Web');
ok(dansOrgFiltre(story, train, h, o) && dansOrgFiltre(story, portfolio, h, o), 'filtre train et portfolio : la story passe');
ok(dansOrgFiltre(tacheEpic, null, h, o) && !dansOrgFiltre(tacheEpic, train, h, o), 'sans filtre tout passe ; tâche sans train exclue du filtre train');

const crm = d.entities.epic.find((e) => e.id === 'acme1')!;
const appli = d.entities.epic.find((e) => e.id === 'acme2')!;
ok(epicDansOrgFiltre(crm, portfolio, d.entities.feature, o), 'epic : dans le filtre de son portfolio');
ok(epicDansOrgFiltre(appli, web, d.entities.feature, o) && !epicDansOrgFiltre(crm, web, d.entities.feature, o), 'epic : dans le filtre d’une équipe si une de ses features y est');

console.log(erreurs ? `${erreurs} erreur(s)` : 'Organisation : OK');
process.exit(erreurs ? 1 : 0);
