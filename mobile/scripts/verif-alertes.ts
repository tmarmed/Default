/**
 * Vérification automatique : la « situation » d'une alerte (ce que compare « Ignorer ») ne doit dépendre que des
 * données, jamais de l'affichage (espaces affichés et préfixe d'espace, unité jours / points, mode Simple / SAFe).
 * Lancer : npm run verif:alertes (échoue si une alerte change de situation selon l'affichage).
 */
import { checksDates, checksIteration, checksParEcran, checksPI, signaturesExistantes, situationDe, type Check } from '../src/checks';
import { toDateString } from '../src/dates';
import { donneesDemo, ESPACES_DEMO } from '../src/demo';
import { makeHierarchyValue } from '../src/hierarchyContext';
import { definirNomsEspaces } from '../src/nomsEspaces';
import { iterationOf, shiftIteration, shiftPi } from '../src/pi';
import type { Domaine, Epic, Feature, Item, Objectif, ObjectifPI } from '../src/types';

const espaces = ['moi', ...ESPACES_DEMO.map((e) => e.id)];
const noms = { moi: '🔒 Moi', 'demo-equipe': '👥 Mobile', 'demo-entreprise': '🏢 ACME' };

// Données de la démo, chaque élément marqué de son espace
const items: Item[] = [];
const epics: Epic[] = [];
const objectifs: Objectif[] = [];
const domaines: Domaine[] = [];
const features: Feature[] = [];
const objectifsPI: ObjectifPI[] = [];
const ancien = '2000-01-01T00:00:00';
for (const espace of espaces) {
  const d = donneesDemo(espace);
  items.push(...d.items.map((x) => ({ ...x, espace })));
  epics.push(...d.entities.epic.map((x) => ({ ...x, espace })));
  objectifs.push(...d.entities.objectif.map((x) => ({ ...x, espace })));
  // Domaines anciens : l'alerte « domaine délaissé » peut se déclencher
  domaines.push(...d.entities.domaine.map((x) => ({ ...x, espace, cree_le: ancien })));
  features.push(...d.entities.feature.map((x) => ({ ...x, espace })));
  objectifsPI.push(...d.entities.objectifpi.map((x) => ({ ...x, espace })));
}

// Cas fabriqués, dans deux espaces : un domaine sans rien (« délaissé ») et une itération à venir surchargée
const prochaine = shiftIteration(iterationOf(new Date()).key, 1);
for (const espace of ['moi', 'demo-entreprise']) {
  domaines.push({ id: `vide-${espace}`, nom: 'Archives', icone: '📦', couleur: '#888888', parent: '', espace, cree_le: ancien, modifie_le: ancien });
  items.push({ ...items[0], id: `lourde-${espace}`, titre: 'Tâche lourde', date: '', periodicite: '', parent: '', feature: '', epic: '', objectif: '', domaine: '', statut: 'a_faire', points: '20', iteration: prochaine, espace });
}

const h = makeHierarchyValue(epics, objectifs, domaines, items, features, objectifsPI);
const today = toDateString(new Date());
const capacite = (e: string) => (e === 'moi' ? 1 : 2); // basse : pour provoquer des surcharges

/** Situations de toutes les alertes, pour un affichage donné */
function situations(visibles: string[], jours: boolean, safe: boolean): Map<string, string> {
  definirNomsEspaces(noms, visibles);
  const out = new Map<string, string>();
  const add = (cs: Check[]) => cs.forEach((c) => out.set(c.key, situationDe(c)));
  for (const dom of ['tous', '', ...h.domaineList.map((d) => d.id)]) {
    Object.values(checksParEcran(h, today, capacite, safe, dom, { jours, maintenant: 600 })).forEach(add);
    add(checksDates(h));
  }
  add(checksIteration(h, prochaine, today, capacite, h, jours));
  add(checksPI(h, shiftPi(iterationOf(new Date()).pi, 1), today, capacite, h, jours));
  return out;
}

const affichages: [string[], boolean, boolean][] = [
  [['moi'], true, true],
  [espaces, true, true],
  [espaces, false, true],
  [['moi'], false, false],
  [espaces, false, false],
];
const reference = situations(...affichages[0]);
let erreurs = 0;
for (const a of affichages.slice(1)) {
  for (const [k, v] of situations(...a)) {
    const ref = reference.get(k);
    if (ref !== undefined && ref !== v) {
      erreurs++;
      console.error(`✗ ${k} : situation différente selon l'affichage (${JSON.stringify(a)})\n    ${ref}\n    ${v}`);
    }
  }
}

// Le nettoyage des alertes ignorées doit donner le même résultat quel que soit l'affichage
definirNomsEspaces(noms, ['moi']);
const s1 = [...signaturesExistantes(h, today, capacite, true)].sort().join('\n');
definirNomsEspaces(noms, espaces);
const s2 = [...signaturesExistantes(h, today, capacite, false)].sort().join('\n');
if (s1 !== s2) {
  erreurs++;
  console.error("✗ Nettoyage des alertes ignorées : résultat différent selon l'affichage");
}

const familles = [...new Set([...reference.keys()].map((k) => k.split(':')[0]))].sort().join(', ');
console.log(`Familles couvertes : ${familles}`);
console.log(`${reference.size} alertes vérifiées sous ${affichages.length} affichages : ${erreurs ? `${erreurs} erreur(s)` : 'OK'}`);
process.exit(erreurs ? 1 : 0);
