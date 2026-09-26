/**
 * Vérification automatique de la connexion Google directe, avec un faux Google (Sheets + Drive) en mémoire :
 * création du fichier d'un espace, lecture / écriture des onglets, règles du magasin (terminé le, sous-tâches,
 * suppression en cascade), colonnes inconnues gardées, colonnes manquantes ajoutées.
 * Lancer : npm run verif:sheets
 */
import { adopterFichier, corbeille, creerFichierEspace, fichiersCorbeille, fichiersEspaces, magasinSheets, renommerFichier, utiliserJeton } from '../src/gsheets';

type Feuille = string[][];
const fichiers = new Map<string, { titre: string; props: Record<string, string>; feuilles: Map<string, Feuille>; jete?: boolean }>();
let appels = 0;

const lettre = (s: string) => [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
function cellule(ref: string) {
  const m = /^([A-Z]+)(\d+)?$/.exec(ref)!;
  return { col: lettre(m[1]) - 1, row: m[2] ? +m[2] - 1 : undefined };
}
function plage(p: string) {
  const [nom, suite] = decodeURIComponent(p).split('!');
  const [a, b] = suite.split(':');
  return { nom: nom.replace(/^'|'$/g, '').replace(/''/g, "'"), a: cellule(a), b: b ? cellule(b) : undefined };
}

globalThis.fetch = (async (input: string, init: RequestInit = {}) => {
  appels++;
  const url = new URL(input);
  const corps = init.body ? JSON.parse(init.body as string) : undefined;
  const rep = (x: unknown, status = 200) => new Response(x === undefined ? '' : JSON.stringify(x), { status });
  if (url.host === 'www.googleapis.com' && url.pathname === '/drive/v3/files') {
    if (init.method === 'POST') {
      // Création d'un Google Sheet par Drive : nom et propriétés d'un coup, une feuille « Feuille 1 »
      const id = `f${fichiers.size + 1}`;
      fichiers.set(id, { titre: corps.name, props: corps.appProperties ?? {}, feuilles: new Map([['Feuille 1', []]]) });
      return rep({ id });
    }
    const jetes = decodeURIComponent(url.search).includes('trashed=true');
    return rep({ files: [...fichiers].filter(([, f]) => !!f.jete === jetes).map(([id, f]) => ({ id, name: f.titre, appProperties: f.props })) });
  }
  const drive = /^\/drive\/v3\/files\/(.+)$/.exec(url.pathname);
  if (drive) {
    const f = fichiers.get(drive[1])!;
    if (corps.appProperties) f.props = corps.appProperties;
    if (corps.name) f.titre = corps.name;
    if (corps.trashed !== undefined) f.jete = corps.trashed;
    return rep({ id: drive[1] });
  }
  if (url.pathname === '/v4/spreadsheets' && init.method === 'POST') {
    const id = `f${fichiers.size + 1}`;
    const feuilles = new Map<string, Feuille>();
    for (const sh of corps.sheets) feuilles.set(sh.properties.title, [sh.data[0].rowData[0].values.map((v: { userEnteredValue: { stringValue: string } }) => v.userEnteredValue.stringValue)]);
    fichiers.set(id, { titre: corps.properties.title, props: {}, feuilles });
    return rep({ spreadsheetId: id });
  }
  const m = /^\/v4\/spreadsheets\/([^/:]+)(?::batchUpdate)?(?:\/values(?::batchUpdate|\/([^:]+)(?::clear)?)?)?$/.exec(url.pathname)!;
  const f = fichiers.get(m[1]);
  if (!f) return rep({ error: { message: 'introuvable' } }, 404);
  if (url.pathname.endsWith(':batchUpdate') && !url.pathname.includes('/values')) {
    for (const r of corps.requests) {
      if (r.addSheet) f.feuilles.set(r.addSheet.properties.title, []);
      if (r.updateSheetProperties) {
        // Renomme la première feuille
        const [premiere, contenu] = [...f.feuilles][0];
        f.feuilles.delete(premiere);
        f.feuilles = new Map([[r.updateSheetProperties.properties.title, contenu], ...f.feuilles]);
      }
    }
    return rep({});
  }
  if (url.pathname.endsWith('/values:batchUpdate')) {
    for (const d of corps.data) {
      const p = plage(d.range);
      f.feuilles.set(p.nom, d.values);
    }
    return rep({});
  }
  if (!m[2]) return rep({ sheets: [...f.feuilles.keys()].map((title, sheetId) => ({ properties: { title, sheetId } })) });
  const p = plage(m[2]);
  const feuille = f.feuilles.get(p.nom)!;
  if (url.pathname.endsWith(':clear')) {
    for (let r = p.a.row!; r <= p.b!.row!; r++) if (feuille[r]) feuille[r] = feuille[r].map(() => '');
    while (feuille.length && feuille[feuille.length - 1].every((c) => c === '')) feuille.pop();
    return rep({});
  }
  if (init.method === 'PUT') {
    corps.values.forEach((row: string[], i: number) => {
      const r = (p.a.row ?? 0) + i;
      feuille[r] = feuille[r] ?? [];
      row.forEach((v, j) => (feuille[r][p.a.col + j] = v));
    });
    return rep({});
  }
  // Lecture : cellules vides en fin de ligne omises, comme Google
  return rep({ values: feuille.map((row) => { const r = [...row]; while (r.length && (r[r.length - 1] ?? '') === '') r.pop(); return r; }) });
}) as typeof fetch;
utiliserJeton(async () => 'jeton');

let erreurs = 0;
const ok = (cond: unknown, msg: string) => {
  if (!cond) erreurs++;
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
};

(async () => {
  const id = await creerFichierEspace('Mes tâches | Moi', 'moi', 'Moi');
  const trouves = (await fichiersEspaces()).espaces;
  ok(trouves.length === 1 && trouves[0].type === 'moi' && trouves[0].nom === 'Mes tâches | Moi', 'fichier de Moi créé avec son nom, retrouvé par ses propriétés');
  ok([...fichiers.get(id)!.feuilles.keys()].join(',') === 'Taches,Epics,Features,ObjectifsPI,Objectifs,Domaines,Ignorees', 'onglets créés (la feuille par défaut devient « Taches »)');
  const m = magasinSheets(id);

  const perso = await m.createEntity('domaine', { nom: 'Perso', icone: '🏠', couleur: '#188038', parent: '' });
  const sante = await m.createEntity('domaine', { nom: 'Santé', icone: '🩺', couleur: '#D93025', parent: perso.id });
  const base = { lieu: '', description: '', priorite: 'normale', statut: 'a_faire', periodicite: '', echeance: '', debut: '', fin: '', faits: '', epic: '', objectif: '', feature: '', points: '', iteration: '', telephone: '', parent: '', heure: '', heure_fin: '', date_fin: '', date: '' } as const;
  const dem = await m.create({ ...base, titre: 'Passeport', type: 'demarche', domaine: perso.id });
  const sous = await m.create({ ...base, titre: 'Photos', type: 'tache', parent: dem.id, domaine: '' });
  ok(sous.domaine === perso.id, 'sous-tâche : rangement de son parent');
  const fait = await m.update({ id: sous.id, statut: 'termine' });
  ok(!!fait.termine_le, '« terminé le » posé');
  await m.update({ id: dem.id, domaine: sante.id });
  const relu = (await m.list()).find((t) => t.id === sous.id)!;
  ok(relu.domaine === sante.id && relu.statut === 'termine' && relu.termine_le === fait.termine_le, 'relu depuis le Sheet : sous-tâche suit son parent, statut gardé');

  // Colonne ajoutée à la main dans le Sheet : gardée
  const taches = fichiers.get(id)!.feuilles.get('Taches')!;
  taches[0].push('note_perso');
  taches[1][taches[0].length - 1] = 'garde-moi';
  await m.update({ id: sous.id, titre: 'Photos d’identité' });
  ok(fichiers.get(id)!.feuilles.get('Taches')!.some((r) => r.includes('garde-moi')), 'colonne ajoutée à la main : gardée');

  // Suppression en cascade : Perso et son sous-domaine, avec leur contenu
  await m.deleteEntity('domaine', perso.id, true);
  const all = await m.listAll();
  ok(all.domaines.length === 0 && (await m.list()).length === 0, 'suppression en cascade : domaine, sous-domaine et tâches supprimés');
  ok(fichiers.get(id)!.feuilles.get('Taches')!.length === 1, 'lignes en trop effacées dans le Sheet');

  // Fichier sans onglet Ignorees (ancien, ou modifié à la main) : onglet ajouté au premier accès
  const id2 = await creerFichierEspace('Mes tâches | Équipe | Test', 'equipe', 'Test');
  fichiers.get(id2)!.feuilles.delete('Ignorees');
  await magasinSheets(id2).createEntity('ignoree', { cle: 'x', signature: 'y' });
  ok(fichiers.get(id2)!.feuilles.get('Ignorees')?.[0]?.[0] === 'id', 'onglet manquant ajouté avec ses colonnes');

  // Fichier de l'application resté sans titre (création interrompue) : repris comme fichier de Moi, puis renommé
  fichiers.set('orph', { titre: 'Feuille de calcul sans titre', props: {}, feuilles: new Map([['Feuille 1', []]]) });
  const avant = await fichiersEspaces();
  ok(avant.autres.some((f) => f.id === 'orph' && f.sansTitre), 'fichier sans titre repéré');
  await adopterFichier('orph', 'President | Moi', 'moi', 'Moi');
  const apres = (await fichiersEspaces()).espaces.find((f) => f.id === 'orph');
  ok(apres?.type === 'moi' && apres.nom === 'President | Moi', 'fichier sans titre repris : nom et propriétés de Moi');
  await renommerFichier(id2, 'President | Équipe | Test');
  ok(fichiers.get(id2)!.titre === 'President | Équipe | Test', 'renommage selon la règle');

  // Supprimer un espace : son Google Sheet va à la corbeille, puis il est restauré
  await corbeille(id2, true);
  ok((await fichiersCorbeille()).some((f) => f.id === id2) && !(await fichiersEspaces()).espaces.some((f) => f.id === id2), 'espace supprimé : Google Sheet dans la corbeille');
  await corbeille(id2, false);
  ok((await fichiersEspaces()).espaces.some((f) => f.id === id2) && !(await fichiersCorbeille()).length, 'espace restauré depuis la corbeille');

  // Organisation d'une entreprise : onglets créés au premier usage, seulement dans le fichier de l'entreprise
  const idE = await creerFichierEspace('President | Entreprise | ACME', 'entreprise', 'ACME');
  const e = magasinSheets(idE);
  ok(!fichiers.get(idE)!.feuilles.has('Personnes'), "Organisation : pas d'onglet tant qu'elle ne sert pas");
  const vide = await e.listOrg();
  ok(!vide.personnes.length && ['Personnes', 'Unites', 'Portfolios', 'Trains', 'EquipesAgiles'].every((n) => fichiers.get(idE)!.feuilles.get(n)?.[0]?.[0] === 'id'), 'Organisation : 5 onglets créés au premier usage, avec leurs colonnes');
  ok(!fichiers.get(id)!.feuilles.has('Personnes'), "Organisation : rien dans le fichier de Moi");
  const dt = await e.saveOrg('unite', { nom: 'Direction technique', type: 'direction', parent: '', responsable: '' });
  const dev = await e.saveOrg('unite', { nom: 'Développement', type: 'service', parent: dt.id, responsable: '' });
  let boucle = '';
  await e.saveOrg('unite', { id: dt.id, parent: dev.id }).catch((x) => (boucle = x.message));
  ok(boucle.includes('elle-même'), 'unité : pas de boucle dans la hiérarchie');
  const karim = await e.saveOrg('personne', { nom: 'Karim Haddad', email: 'Karim@Example.com', unite: dt.id, manager: '', capacite: '' });
  ok(karim.email === 'karim@example.com', 'personne : e-mail en minuscules');
  const tom = await e.saveOrg('personne', { nom: 'Tom Faure', email: 'tom@example.com', unite: dev.id, manager: karim.id, capacite: '8' });
  let doublon = '';
  await e.saveOrg('personne', { nom: 'Autre', email: 'TOM@example.com', unite: '', manager: '', capacite: '' }).catch((x) => (doublon = x.message));
  ok(doublon.includes('e-mail'), 'personne : e-mail unique');
  let mauvais = '';
  await e.saveOrg('personne', { nom: 'X', email: 'pas-un-email', unite: '', manager: '', capacite: '' }).catch((x) => (mauvais = x.message));
  ok(mauvais.includes('invalide'), 'personne : e-mail vérifié');
  const pf = await e.saveOrg('portfolio', { nom: 'Digital', epic_owner: karim.id });
  const tr = await e.saveOrg('train', { nom: 'Clients', portfolio: pf.id, rte: karim.id, pm: '' });
  const eq = await e.saveOrg('equipeagile', { nom: 'Mobile', train: tr.id, po: karim.id, sm: tom.id, membres: `${tom.id};${tom.id};${karim.id}` });
  ok(eq.membres === `${tom.id};${karim.id}`, 'équipe : membres sans doublon');
  let nomPris = '';
  await e.saveOrg('equipeagile', { nom: 'mobile', train: '', po: '', sm: '', membres: '' }).catch((x) => (nomPris = x.message));
  ok(nomPris.includes('existe déjà'), 'équipe : nom unique');
  const epic = await e.createEntity('epic', { titre: 'Nouveau CRM', description: '', debut: '2026-10-01', fin: '', couleur: '#1A73E8', objectif: '', domaine: '', etat: '', portfolio: pf.id });
  const feat = await e.createEntity('feature', { titre: 'Paiement', description: '', epic: epic.id, pi: '', iteration: '', points: '', couleur: '', train: tr.id, equipe: eq.id });
  const story = await e.create({ ...base, titre: 'Écran de paiement', type: 'story', domaine: '', feature: feat.id, equipe: eq.id, responsable: tom.id });
  ok(story.equipe === eq.id && story.responsable === tom.id, 'story : équipe et responsable enregistrés');
  ok((await e.listAll()).epics[0].portfolio === pf.id && (await e.listAll()).features[0].train === tr.id, 'epic → portfolio, feature → train et équipe enregistrés');
  await e.deleteOrg('personne', tom.id);
  const apresTom = await e.listOrg();
  ok(apresTom.personnes.length === 1 && apresTom.equipes[0].sm === '' && apresTom.equipes[0].membres === karim.id, 'personne supprimée : rôles et membres vidés');
  ok((await e.list())[0].responsable === '', 'personne supprimée : tâche sans responsable, gardée');
  await e.deleteOrg('equipeagile', eq.id);
  ok((await e.list())[0].equipe === '' && (await e.listAll()).features[0].equipe === '', 'équipe supprimée : features et tâches gardées, sans équipe');
  await e.deleteOrg('portfolio', pf.id);
  ok((await e.listOrg()).trains[0].portfolio === '' && (await e.listAll()).epics[0].portfolio === '', 'portfolio supprimé : trains et epics gardés, sans portfolio');
  await e.deleteOrg('unite', dt.id);
  ok((await e.listOrg()).unites[0].parent === '' && (await e.listOrg()).personnes[0].unite === '', 'unité supprimée : sous-unité remontée, personnes sans service');

  // Erreur de règle
  let refus = '';
  await m.create({ ...base, titre: '', type: 'tache', domaine: '' }).catch((e) => (refus = e.message));
  ok(refus.includes('titre'), 'titre obligatoire vérifié');

  console.log(`${appels} appels à Google simulés : ${erreurs ? `${erreurs} erreur(s)` : 'OK'}`);
  process.exit(erreurs ? 1 : 0);
})();
