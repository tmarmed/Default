/**
 * Vérification automatique de la connexion Google directe, avec un faux Google (Sheets + Drive) en mémoire :
 * création du fichier d'un espace, lecture / écriture des onglets, règles du magasin (terminé le, sous-tâches,
 * suppression en cascade), colonnes inconnues gardées, colonnes manquantes ajoutées.
 * Lancer : npm run verif:sheets
 */
import { adopterFichier, corbeille, reglerQuota, creerFichierEspace, fichiersCorbeille, fichiersEspaces, magasinSheets, renommerFichier, utiliserJeton } from '../src/gsheets';

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

let refus429 = 0;
/** Largeur de la grille de chaque onglet (« fichier|onglet ») : 26 colonnes par défaut, comme Google */
const largeurs = new Map<string, number>();
let lecturesGroupees = 0;
globalThis.fetch = (async (input: string, init: RequestInit = {}) => {
  appels++;
  // Quota Google dépassé (simulé) : l'application doit attendre et réessayer
  if (refus429 > 0) {
    refus429--;
    return new Response(JSON.stringify({ error: { message: 'Quota exceeded' } }), { status: 429 });
  }
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
  // Lecture groupée de plusieurs onglets (values:batchGet)
  const bg = /^\/v4\/spreadsheets\/([^/:]+)\/values:batchGet$/.exec(url.pathname);
  if (bg) {
    lecturesGroupees++;
    const f = fichiers.get(bg[1]);
    if (!f) return rep({ error: { message: 'introuvable' } }, 404);
    return rep({
      valueRanges: url.searchParams.getAll('ranges').map((r) => {
        const feuille = f.feuilles.get(plage(r).nom) ?? [];
        return { range: r, values: feuille.map((row) => { const x = [...row]; while (x.length && (x[x.length - 1] ?? '') === '') x.pop(); return x; }) };
      }),
    });
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
    // Comme Google : écrire à partir d'une colonne hors de la grille est refusé ; depuis l'intérieur, la grille s'agrandit
    const cle = `${m[1]}|${p.nom}`;
    const largeur = largeurs.get(cle) ?? 26;
    if (p.a.col >= largeur) return rep({ error: { message: `Range (${p.nom}!${m[2]}) exceeds grid limits. Max columns: ${largeur}` } }, 400);
    largeurs.set(cle, Math.max(largeur, p.a.col + Math.max(0, ...corps.values.map((r: string[]) => r.length))));
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
// Vérifications : pas d'attente de quota (la file est testée à part, avec un quota minuscule)
reglerQuota({ limite: 1e9, ecart: 0, base: 1 });

let erreurs = 0;
const ok = (cond: unknown, msg: string) => {
  if (!cond) erreurs++;
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
};

(async () => {
  const id = await creerFichierEspace('Mes tâches | Moi', 'moi', 'Moi');
  const trouves = (await fichiersEspaces()).espaces;
  ok(trouves.length === 1 && trouves[0].type === 'moi' && trouves[0].nom === 'Mes tâches | Moi', 'fichier de Moi créé avec son nom, retrouvé par ses propriétés');
  ok([...fichiers.get(id)!.feuilles.keys()].join(',') === 'Taches,Epics,Features,ObjectifsPI,Objectifs,Domaines,Ignorees,ValueStreams,ResultatsCles,Echanges', 'onglets créés (la feuille par défaut devient « Taches »)');
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

  // Écriture groupée (missions) : 22 epics et 90 features en quelques appels, sans dépasser le quota de Google
  const idL = await creerFichierEspace('President | Équipe | Lot', 'equipe', 'Lot');
  const l = magasinSheets(idL);
  await l.listAll();
  const avantLot = appels;
  const eps = (await l.ecrireLot('epic', Array.from({ length: 22 }, (_, i) => ({ titre: `Lot ${i + 1} · Mission`, description: '', debut: '2026-09-30', fin: '', couleur: '', objectif: '', domaine: '', etat: '' as const })), [])).crees;
  await l.ecrireLot('feature', eps.flatMap((ep) => Array.from({ length: 4 }, (_, k) => ({ titre: `Étape ${k + 1}`, description: '', epic: ep.id, pi: '', iteration: '', points: '', couleur: '' }))), []);
  ok(appels - avantLot <= 6, `écriture groupée : 110 éléments en ${appels - avantLot} appels (au plus 6)`);
  const lu = await l.listAll();
  ok(lu.epics.length === 22 && lu.features.length === 88, 'écriture groupée : 22 epics et 88 features relues');
  await l.ecrireLot('epic', [], [{ id: eps[0].id, titre: 'Lot 1 · Mission modifiée' }]);
  ok((await l.listAll()).epics.find((x) => x.id === eps[0].id)?.titre === 'Lot 1 · Mission modifiée', 'écriture groupée : modification');
  refus429 = 1;
  ok((await l.listAll()).epics.length === 22, 'quota dépassé (429) : nouvel essai automatique réussi');
  // Lectures groupées : chargement complet d'un espace (tâches + 9 onglets) en un seul appel de lecture
  const avantLecture = appels;
  const lg = lecturesGroupees;
  await Promise.all([l.list(), l.listAll()]);
  ok(lecturesGroupees - lg === 1 && appels - avantLecture === 1, `lecture d'un espace : ${appels - avantLecture} appel (tous les onglets ensemble)`);
  // File d'attente du quota : 7 appels avec au plus 3 par fenêtre de 300 ms → au moins 2 fenêtres d'attente
  reglerQuota({ limite: 3, fenetre: 300, ecart: 0 });
  const t0 = Date.now();
  for (let i = 0; i < 7; i++) await l.ecrireLot('epic', [], [{ id: eps[1].id, titre: `Lot 2 · Essai ${i}` }]);
  const duree = Date.now() - t0;
  reglerQuota({ limite: 1e9, fenetre: 60_000, ecart: 0 });
  ok(duree >= 550, `quota respecté : 7 écritures étalées sur ${duree} ms (au plus 3 par fenêtre)`);

  // Modifier un échange : pas encore lu → modifié sur place ; lu entre-temps (répondu) → nouvel échange
  const ech = await l.createEntity('echange', { de: 'moi@x.fr', a: 'lea@x.fr', type: 'question', titre: 'Revue ?', texte: '', choix: 'Jeudi;Autre', reponse: '', note: '', statut: 'envoye', element: '', niveau: '', transmis_par: '', prive: '1' } as never);
  const avantModif = appels;
  const m1 = await l.modifierEchange({ ...ech, titre: 'Revue jeudi ?' });
  ok(!m1.nouveau && m1.e.id === ech.id && m1.e.titre === 'Revue jeudi ?' && appels - avantModif === 2, `échange non lu modifié sur place (${appels - avantModif} appels)`);
  await l.updateEntity('echange', { id: ech.id, reponse: 'Jeudi', statut: 'repondu' } as never);
  const m2 = await l.modifierEchange({ ...ech, titre: 'Revue vendredi ?' });
  const echs = (await l.listAll()).echanges ?? [];
  ok(m2.nouveau && echs.length === 2 && echs.find((x) => x.id === ech.id)?.reponse === 'Jeudi' && m2.e.statut === 'envoye' && m2.e.a === 'lea@x.fr', 'échange déjà lu : la modification part en nouvel échange, l\'ancien reste');

  // Pièces jointes : une image de 120 000 caractères (3 morceaux) et un petit fichier, en une lecture et une écriture
  const img = 'A'.repeat(120_000);
  const avantPj = appels;
  const pjs = await l.ajouterPieces([{ nom: 'capture.jpg', type: 'image/jpeg', donnees: img }, { nom: 'note.txt', type: 'text/plain', donnees: 'Qm9uam91cg==' }]);
  ok(pjs.length === 2 && appels - avantPj <= 4, `pièces jointes : 2 pièces (4 morceaux) écrites en ${appels - avantPj} appels (onglet créé au premier usage)`);
  const avantPj2 = appels;
  await l.ajouterPieces([{ nom: 'autre.jpg', type: 'image/jpeg', donnees: 'QUJD' }]);
  ok(appels - avantPj2 <= 2, `pièces jointes : ajout suivant en ${appels - avantPj2} appels (une lecture, une écriture)`);
  const relues = await magasinSheets(idL).lirePieces(pjs);
  ok(relues.length === 2 && relues[0].donnees === img && relues[1].nom === 'note.txt', 'pièces jointes : reconstituées à l\'identique');
  // Morceau abîmé (recopie fausse) : la pièce n'est pas rendue
  const fpjA = fichiers.get(idL)!.feuilles.get('PiecesJointes')!;
  const ligneA = fpjA.findIndex((r) => r[1] === pjs[1]);
  const avantA = fpjA[ligneA][7];
  fpjA[ligneA][7] = avantA.slice(0, -2) + 'x=';
  ok((await magasinSheets(idL).lirePieces(pjs)).length === 1, 'pièces jointes : morceau abîmé repéré par son contrôle, pièce écartée');
  fpjA[ligneA][7] = avantA;
  let tropGros = '';
  await l.ajouterPieces([{ nom: 'gros.pdf', type: 'application/pdf', donnees: 'A'.repeat(1_400_000) }]).catch((e) => (tropGros = e.message));
  ok(tropGros.includes('1 Mo'), 'pièces jointes : plus de 1 Mo refusé');
  await l.createEntity('echange', { de: 'moi@x.fr', a: 'lea@x.fr', type: 'message', titre: '', texte: '', choix: '', reponse: '', note: '', statut: 'envoye', element: '', niveau: '', transmis_par: '', prive: '1', pieces_jointes: pjs[0] } as never);
  const fpj = fichiers.get(idL)!.feuilles.get('PiecesJointes')!;
  for (const r of fpj.slice(1)) r[8] = '2020-01-01T00:00:00.000Z';
  const effacees = await magasinSheets(idL).purgerPieces();
  const restent = await magasinSheets(idL).lirePieces(pjs);
  ok(effacees === 2 && restent.length === 1 && restent[0].id === pjs[0], 'pièces jointes : celle qu\'aucun échange ne cite est effacée, l\'autre reste');

  // Changer sa réponse : possible tant que la réponse n'est pas prise en compte
  const qr = await l.createEntity('echange', { de: 'lea@x.fr', a: 'moi@x.fr', type: 'question', titre: 'Jeudi ?', texte: '', choix: 'Oui;Non', reponse: 'Oui', note: '', statut: 'repondu', element: '', niveau: '', transmis_par: '', prive: '1' } as never);
  const qr2 = await l.changerReponse(qr.id, 'Non', 'finalement');
  ok(qr2.reponse === 'Non' && qr2.note === 'finalement' && qr2.statut === 'repondu', 'changer sa réponse avant la prise en compte');
  await l.updateEntity('echange', { id: qr.id, statut: 'pris_en_compte' } as never);
  let refusQr = '';
  await l.changerReponse(qr.id, 'Oui', '').catch((e) => (refusQr = e.message));
  ok(refusQr.includes('prise en compte'), 'réponse prise en compte : plus modifiable');

  // Espace Équipe : membres et rôles (une lecture, deux écritures au plus par membre)
  const idEq = await creerFichierEspace('President | Équipe | Mobile', 'equipe', 'Mobile');
  const q = magasinSheets(idEq);
  await q.listEquipe();
  const avantEq = appels;
  let eqs = await q.ecrireMembre('Mobile', { personne: { nom: 'Lea Martin', email: 'lea@x.fr', nature: 'humain' }, role: 'po' });
  ok(appels - avantEq <= 3 && eqs.equipes.length === 1 && eqs.equipes[0].po === eqs.personnes[0].id, `espace Équipe : premier membre (PO) et ligne d'équipe en ${appels - avantEq} appels`);
  const lea = eqs.personnes[0].id;
  eqs = await q.ecrireMembre('Mobile', { personne: { nom: 'Hugo Petit', email: 'hugo@x.fr' }, role: 'po' });
  const hugo = eqs.personnes.find((x) => x.nom === 'Hugo Petit')!.id;
  ok(eqs.equipes[0].po === hugo && eqs.equipes[0].membres.split(';').length === 2, 'espace Équipe : un seul PO (le nouveau remplace, l\'ancien reste membre)');
  eqs = await q.ecrireMembre('Mobile', { personne: { id: lea, nom: 'Léa Martin' } });
  ok(eqs.personnes.find((x) => x.id === lea)?.nom === 'Léa Martin' && eqs.equipes[0].po === hugo, 'espace Équipe : membre modifié, rôles gardés');
  eqs = await q.ecrireMembre('Mobile', { retirer: hugo });
  const reluEq = await magasinSheets(idEq).listEquipe();
  ok(eqs.equipes[0].po === '' && reluEq.personnes.length === 1 && reluEq.equipes[0].membres === lea, 'espace Équipe : membre retiré (rôle et liste vidés)');

  // Daily (lot 6) : points de réunion (onglet PointsReunion créé au premier usage), écrits et lus en lots
  const idD = await creerFichierEspace('President | Équipe | Daily', 'equipe', 'Daily');
  const dm = magasinSheets(idD);
  await dm.list();
  const reu = 'daily-equipeagile:eq1-2026-10-02';
  const pts = Array.from({ length: 10 }, (_, i) => ({
    reunion: reu, personne: 'Tom@x.fr', auteur: i < 5 ? 'tom@x.fr' : 'nina@x.fr', type: (['hier', 'aujourdhui', 'blocage', 'decision', 'action'] as const)[i % 5], texte: `Point ${i + 1}`,
    element: '', concretisation: '' as const, tache: '', responsable: '',
  }));
  const avantPts = appels;
  const ecrits = await dm.ecrirePoints(pts, []);
  ok(ecrits.crees.length === 10 && appels - avantPts <= 4 && fichiers.get(idD)!.feuilles.has('PointsReunion'), `daily : 10 points en ${appels - avantPts} appels (onglet créé au premier usage, une écriture)`);
  const avantPts2 = appels;
  await dm.ecrirePoints([{ ...pts[0], reunion: 'daily-equipeagile:eq1-2026-10-05', texte: 'Autre jour' }], []);
  ok(appels - avantPts2 === 2, `daily : ajout suivant en ${appels - avantPts2} appels (une lecture, une écriture)`);
  const avantLu = appels;
  const lusPts = await magasinSheets(idD).lirePoints(reu);
  ok(lusPts.length === 10 && lusPts[0].personne === 'tom@x.fr' && appels - avantLu === 1, `daily : points d'une réunion lus en ${appels - avantLu} appel (e-mails en minuscules)`);
  ok((await dm.lirePoints('daily-equipeagile:eq1-')).length === 11, 'daily : tous les dailies de l’équipe (suivi) en une lecture');
  // « ↻ Actualiser » d'une réunion : points, tâches et échanges de l'espace en une seule lecture groupée (batchGet)
  const avantAct = appels;
  const act = await magasinSheets(idD).lireReunion(reu);
  ok(act.points.length === 10 && Array.isArray(act.items) && Array.isArray(act.echanges) && appels - avantAct === 1, `réunion : actualiser (points, tâches, échanges) en ${appels - avantAct} appel`);
  // Compte rendu : 6 tâches (dont une sous-tâche d'une story) en une écriture, puis les 10 points concrétisés en une écriture
  const storyD = await dm.create({ ...base, titre: 'Écran de connexion', type: 'story', domaine: '', iteration: '2026-T4-IT1' });
  const avantTaches = appels;
  const tachesD = await dm.creerItems([
    { ...base, titre: 'Accès API de test', type: 'tache', domaine: '', parent: storyD.id, equipe: 'eq1', responsable: 'p1' },
    ...Array.from({ length: 5 }, (_, i) => ({ ...base, titre: `Action ${i + 1}`, type: 'tache' as const, domaine: '', iteration: '2026-T4-IT1', equipe: 'eq1' })),
  ]);
  ok(tachesD.length === 6 && tachesD[0].parent === storyD.id && appels - avantTaches <= 2, `daily : 6 tâches (dont une sous-tâche) en ${appels - avantTaches} appels`);
  const avantModifs = appels;
  const modifs = await dm.modifierItems(tachesD.slice(1).map((t, i) => ({ id: t.id, iteration: '2026-T4-IT2', points: String(i + 1) })));
  ok(modifs.length === 5 && modifs[4].points === '5' && modifs[0].iteration === '2026-T4-IT2' && appels - avantModifs === 2, `réunion : 5 stories modifiées (itération, points) en ${appels - avantModifs} appels`);
  const avantConc = appels;
  await dm.ecrirePoints([], lusPts.map((x, i) => ({ id: x.id, concretisation: i % 2 ? 'tache' as const : 'rien' as const, tache: i % 2 ? tachesD[1].id : '', responsable: 'Emma@x.fr' })));
  const nConc = appels - avantConc;
  const conc = await magasinSheets(idD).lirePoints(reu);
  ok(nConc === 2 && conc.filter((x) => x.concretisation === 'tache').length === 5 && conc.every((x) => x.responsable === 'emma@x.fr'), `daily : 10 points concrétisés en ${nConc} appels`);
  // Le participant renvoie sa préparation : ses anciens points sont remplacés (une lecture, une écriture)
  const anciens = conc.filter((x) => x.auteur === 'tom@x.fr').map((x) => x.id);
  await dm.ecrirePoints([{ ...pts[0], texte: 'Préparation renvoyée' }], [], anciens);
  const apresD = await magasinSheets(idD).lirePoints(reu);
  ok(apresD.length === 6 && apresD.some((x) => x.texte === 'Préparation renvoyée'), 'daily : préparation renvoyée, les anciens points du participant sont remplacés');
  let refusPt = '';
  await dm.ecrirePoints([{ ...pts[0], type: 'autre' as never }], []).catch((e) => (refusPt = e.message));
  ok(refusPt.includes('Type'), 'daily : type de point vérifié');
  // Règles du 01/10 : à la Concrétisation, 3 blocages passés en échanges 🔄 Synchro (un lot d'échanges), les points
  // gardent leur échange (un lot de points) ; le PO envoie ses réponses (décisions liées à l'échange) et reprend sa
  // préparation en un seul passage
  const bloc = await dm.ecrirePoints(Array.from({ length: 3 }, (_, i) => ({ ...pts[2], texte: `Blocage ${i + 1}`, element: storyD.id })), []);
  const avantSy = appels;
  const echSy = (
    await dm.ecrireLot(
      'echange',
      bloc.crees.map((x) => ({
        de: 'tom@x.fr', a: 'paul@x.fr', type: 'question' as const, titre: `Blocage · ${x.texte}`, texte: 'Peux-tu le lever ?', choix: 'Je m’en occupe;Autre', reponse: '', note: '',
        statut: 'envoye' as const, element: storyD.id, niveau: 'equipeagile:eq1', transmis_par: 'nina@x.fr', prive: '1', pieces_jointes: '',
      })),
      [],
    )
  ).crees;
  await dm.ecrirePoints([], bloc.crees.map((x, i) => ({ id: x.id, concretisation: 'synchro' as const, tache: echSy[i].id, responsable: 'paul@x.fr' })));
  const nSy = appels - avantSy;
  const sy = (await magasinSheets(idD).lirePoints(reu)).filter((x) => x.concretisation === 'synchro');
  ok(nSy <= 5 && echSy.length === 3 && sy.length === 3 && sy.every((x) => echSy.some((e) => e.id === x.tache)), `daily : 3 blocages passés en 🔄 Synchro (échanges et points) en ${nSy} appels`);
  // Le PO répond aux 3 échanges dans son parcours : à l'envoi de son point, les réponses partent dans les échanges
  // (un lot) et sont dupliquées en décisions de la réunion, liées à l'échange (un lot de points, préparation reprise)
  const prepPO = await dm.ecrirePoints([{ ...pts[0], personne: 'paul@x.fr', auteur: 'paul@x.fr', type: 'hier', texte: 'Story acceptée' }], []);
  const avantPO = appels;
  const repEch = await dm.ecrireLot('echange', [], echSy.map((e) => ({ id: e.id, reponse: 'Je m’en occupe', note: '', statut: 'repondu' as const })));
  const repPO = await dm.ecrirePoints(
    [
      ...echSy.map((e, i) => ({ ...pts[0], personne: 'paul@x.fr', auteur: 'paul@x.fr', type: 'decision' as const, texte: `« Blocage ${i + 1} » : Je m’en occupe`, element: storyD.id, tache: e.id })),
      { ...pts[0], personne: 'paul@x.fr', auteur: 'paul@x.fr', type: 'aujourdhui' as const, texte: 'Préparer « Historique »' },
    ],
    [],
    prepPO.crees.map((x) => x.id),
  );
  const nPO = appels - avantPO;
  const apresPO = await magasinSheets(idD).lirePoints(reu);
  const decPO = apresPO.filter((x) => x.type === 'decision' && x.personne === 'paul@x.fr');
  ok(
    nPO <= 4 && repEch.modifies.every((e) => e.statut === 'repondu') && repPO.crees.length === 4 && decPO.length === 3 &&
      decPO.every((x) => !x.concretisation && echSy.some((e) => e.id === x.tache)) && !apresPO.some((x) => x.texte === 'Story acceptée'),
    `daily : 3 réponses du PO (échanges) dupliquées en décisions de la réunion, préparation reprise, en ${nPO} appels`,
  );

  // Fichier ancien : onglet Taches de 28 colonnes (grille comprise) ; les colonnes ajoutées depuis doivent passer
  const idV = await creerFichierEspace('President | Équipe | Ancien', 'equipe', 'Ancien');
  const fv = fichiers.get(idV)!;
  fv.feuilles.set('Taches', [fv.feuilles.get('Taches')![0].slice(0, 28)]);
  largeurs.set(`${idV}|Taches`, 28);
  let erreurV = '';
  await magasinSheets(idV).list().catch((e) => (erreurV = e.message));
  ok(!erreurV && fv.feuilles.get('Taches')![0].length === 31, `fichier ancien (grille de 28 colonnes) : colonnes ajoutées sans refus${erreurV ? ` — ${erreurV}` : ''}`);

  // Erreur de règle
  let refus = '';
  await m.create({ ...base, titre: '', type: 'tache', domaine: '' }).catch((e) => (refus = e.message));
  ok(refus.includes('titre'), 'titre obligatoire vérifié');

  console.log(`${appels} appels à Google simulés : ${erreurs ? `${erreurs} erreur(s)` : 'OK'}`);
  process.exit(erreurs ? 1 : 0);
})();
