/**
 * API « Mes Tâches » — à coller dans l'éditeur Apps Script d'un Google Sheet
 * (Extensions > Apps Script), puis à déployer en « Application Web ».
 *
 * L'application mobile appelle cette API pour lire et enregistrer les tâches,
 * missions et rendez-vous dans l'onglet « Taches » du classeur.
 */

/**
 * Connexion Google : collez ici l'« ID client » de type « Application Web »
 * créé dans Google Cloud Console (se termine par .apps.googleusercontent.com).
 * Laissé vide, l'application utilise la clé d'accès.
 */
var GOOGLE_WEB_CLIENT_ID = '';

var SHEET_NAME = 'Taches';
var USERS_SHEET_NAME = 'Utilisateurs';
var HEADERS = [
  'id', 'titre', 'type', 'date', 'heure', 'lieu',
  'description', 'priorite', 'statut', 'cree_le', 'modifie_le',
  'periodicite', 'echeance', 'debut', 'fin', 'faits',
  'epic', 'objectif', 'domaine',
  'points', 'iteration', 'feature',
  'telephone'
];
/** Version de l'API, lue par l'application pour savoir si le script est à jour. */
var API_VERSION = 7;

/**
 * Niveaux au-dessus des tâches : Domaine > Objectif > Epic > Tâche.
 * `min` = nombre de colonnes de la première version de l'onglet (les suivantes sont ajoutées à la fin).
 */
var ENTITIES = {
  epic: {
    sheet: 'Epics', min: 8,
    headers: ['id', 'titre', 'description', 'debut', 'fin', 'couleur', 'cree_le', 'modifie_le', 'objectif', 'domaine',
      'etat']
  },
  // SAFe : feature = sous-epic prévue dans un PI (trimestre), éventuellement dans une itération.
  feature: {
    sheet: 'Features', min: 10,
    headers: ['id', 'titre', 'description', 'epic', 'pi', 'iteration', 'points', 'couleur', 'cree_le', 'modifie_le']
  },
  // SAFe : objectif du PI = engagement d'un trimestre (engagé ou bonus), valeur prévue / obtenue sur 10,
  // rattaché ou non à un domaine (v6).
  objectifpi: {
    sheet: 'ObjectifsPI', min: 8,
    headers: ['id', 'titre', 'pi', 'type', 'valeur_prevue', 'valeur_obtenue', 'cree_le', 'modifie_le', 'domaine']
  },
  objectif: {
    sheet: 'Objectifs', min: 12,
    headers: ['id', 'titre', 'description', 'domaine', 'debut', 'fin', 'couleur', 'cible', 'actuel', 'unite',
      'cree_le', 'modifie_le']
  },
  domaine: {
    sheet: 'Domaines', min: 6,
    headers: ['id', 'nom', 'icone', 'couleur', 'cree_le', 'modifie_le']
  }
};
var PERIODICITES = ['', 'hebdomadaire', 'mensuelle', 'trimestrielle', 'annuelle'];
/** États d'une epic (Kanban du portefeuille) ; vide = déduit des dates par l'application. */
var ETATS_EPIC = ['', 'idee', 'analyse', 'pret', 'en_cours', 'termine'];
var RE_PI = /^\d{4}-T[1-4]$/;
var RE_ITERATION = /^\d{4}-T[1-4]-(IT[1-6]|IP)$/;
var RE_NOMBRE = /^\d+([.,]\d+)?$/;
// v7 : appel, démarche administrative, user story, exploration, bug
var TYPES = ['tache', 'rendez-vous', 'appel', 'demarche', 'mission', 'story', 'exploration', 'bug'];
var PRIORITES = ['basse', 'normale', 'haute'];
var STATUTS = ['a_faire', 'en_cours', 'termine'];

/**
 * À lancer depuis l'éditeur (sans risque de relancer : rien n'est écrasé).
 * Crée les onglets « Taches » et « Utilisateurs », puis prépare la connexion :
 * par compte Google si GOOGLE_WEB_CLIENT_ID est rempli, sinon par clé d'accès.
 */
function installer() {
  var sheet = getSheet_();
  if (sheet.getLastRow() < 2) ajouterExemples_();
  var users = getUsersSheet_();
  entitySheet_('epic');
  entitySheet_('objectif');
  entitySheet_('domaine');
  entitySheet_('feature');
  entitySheet_('objectifpi');
  var props = PropertiesService.getScriptProperties();

  if (GOOGLE_WEB_CLIENT_ID) {
    // Vérifie tout de suite que le script a le droit d'appeler Google (autorisation demandée ici).
    UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=test', { muteHttpExceptions: true });
    Logger.log('Connexion Google activée. Comptes autorisés (onglet « ' + USERS_SHEET_NAME + ' ») : ' +
      allowedEmails_(users).join(', '));
    if (props.getProperty('API_KEY')) {
      Logger.log('La clé d\'accès fonctionne encore. Quand la connexion Google marche, supprimez la ' +
        'propriété API_KEY (Paramètres du projet > Propriétés du script) pour la désactiver.');
    }
    return;
  }

  var key = props.getProperty('API_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('API_KEY', key);
  }
  Logger.log('Clé d\'accès à saisir dans l\'application : ' + key);
}

/** Onglet des comptes Google autorisés ; créé avec le compte qui lance « installer ». */
function getUsersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    sheet.getRange(1, 1).setValue('email').setFontWeight('bold');
    sheet.setFrozenRows(1);
    var me = Session.getEffectiveUser().getEmail();
    if (me) sheet.getRange(2, 1).setValue(me);
  }
  return sheet;
}

function allowedEmails_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 1).getValues()
    .map(function (r) { return String(r[0]).trim().toLowerCase(); })
    .filter(function (e) { return e; });
}

/** Deux exemples pour voir le fonctionnement ; supprimez-les quand vous voulez. */
function ajouterExemples_() {
  var d = new Date();
  var tz = Session.getScriptTimeZone();
  var jour = function (n) {
    return Utilities.formatDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n), tz, 'yyyy-MM-dd');
  };
  createItem_({
    titre: 'Rendez-vous client Dupont', type: 'rendez-vous', date: jour(2), heure: '10:30',
    lieu: '12 rue de Paris, Lyon', description: 'Présenter le devis et prendre les mesures',
    priorite: 'haute', statut: 'a_faire'
  });
  createItem_({
    titre: 'Préparer le rapport de mission', type: 'mission', date: jour(3),
    description: 'Rassembler les photos et les heures du chantier',
    priorite: 'normale', statut: 'en_cours'
  });
}

function doGet(e) {
  return handle_(function () {
    checkAuth_({ key: e.parameter.key });
    var action = e.parameter.action || 'list';
    if (action === 'ping') return { ok: true };
    if (action === 'list') return listAll_();
    throw new Error('Action inconnue : ' + action);
  });
}

function doPost(e) {
  return handle_(function () {
    var body = JSON.parse((e.postData && e.postData.contents) || '{}');
    checkAuth_(body);
    // Lecture : pas besoin de verrou.
    if (body.action === 'ping') return { ok: true, version: API_VERSION };
    if (body.action === 'list') return listAll_();
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      switch (body.action) {
        case 'create': return { ok: true, item: createItem_(body.item || {}) };
        case 'update': return { ok: true, item: updateItem_(body.item || {}) };
        case 'delete': deleteItem_(body.id); return { ok: true };
        case 'createEntity': return { ok: true, entity: createEntity_(body.kind, body.data || {}) };
        case 'updateEntity': return { ok: true, entity: updateEntity_(body.kind, body.data || {}) };
        case 'deleteEntity': return { ok: true, counts: deleteEntity_(body.kind, body.id, !!body.cascade) };
        // Anciennes actions (version 3 de l'application)
        case 'createEpic': return { ok: true, epic: createEntity_('epic', body.epic || {}) };
        case 'updateEpic': return { ok: true, epic: updateEntity_('epic', body.epic || {}) };
        case 'deleteEpic': return { ok: true, detached: deleteEntity_('epic', body.id, false).taches };
        default: throw new Error('Action inconnue : ' + body.action);
      }
    } finally {
      lock.releaseLock();
    }
  });
}

function listAll_() {
  return {
    ok: true,
    version: API_VERSION,
    items: listItems_(),
    epics: listEntities_('epic'),
    objectifs: listEntities_('objectif'),
    domaines: listEntities_('domaine'),
    features: listEntities_('feature'),
    objectifsPI: listEntities_('objectifpi')
  };
}

function handle_(fn) {
  var result;
  try {
    result = fn();
  } catch (err) {
    result = { ok: false, error: String(err && err.message ? err.message : err) };
    if (err && err.auth) result.code = 'auth';
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Accepte une preuve de connexion Google (idToken) ou, si elle existe encore, la clé d'accès. */
/** Erreur de connexion : l'application la reconnaît (code « auth ») pour renouveler la session. */
function authError_(message) {
  var e = new Error(message);
  e.auth = true;
  return e;
}

function checkAuth_(creds) {
  if (creds.idToken) {
    var email = verifyGoogleToken_(creds.idToken);
    if (allowedEmails_(getUsersSheet_()).indexOf(email) < 0) {
      throw authError_('Le compte ' + email + ' n\'est pas autorisé. Ajoutez-le dans l\'onglet « ' +
        USERS_SHEET_NAME + ' » du Google Sheet.');
    }
    return email;
  }
  var expected = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!expected) {
    throw authError_(GOOGLE_WEB_CLIENT_ID
      ? 'Connectez-vous avec votre compte Google.'
      : 'API non installée : lancez la fonction « installer ».');
  }
  if (creds.key !== expected) throw authError_('Clé d\'accès invalide.');
  return null;
}

/**
 * Vérifie auprès de Google que l'idToken est authentique, récent et destiné à cette application.
 * Renvoie l'adresse e-mail du compte. Le résultat est gardé en cache jusqu'à expiration du jeton.
 */
function verifyGoogleToken_(idToken) {
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error('Connexion Google non configurée dans le script.');
  var cache = CacheService.getScriptCache();
  var cacheKey = 'tok:' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  var cached = cache.get(cacheKey);
  if (cached) return cached;

  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' +
    encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw authError_('Session Google expirée : reconnectez-vous.');
  var info = JSON.parse(res.getContentText());
  var now = Math.floor(Date.now() / 1000);
  var valid =
    info.aud === GOOGLE_WEB_CLIENT_ID &&
    (info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com') &&
    String(info.email_verified) === 'true' &&
    Number(info.exp) > now;
  if (!valid || !info.email) throw authError_('Connexion Google refusée : jeton invalide.');

  var email = String(info.email).toLowerCase();
  var ttl = Math.min(Number(info.exp) - now, 3600);
  if (ttl > 30) cache.put(cacheKey, email, ttl);
  return email;
}

function getSheet_() {
  return getTable_(SHEET_NAME, HEADERS, 11);
}

/**
 * Onglet `name` avec les colonnes `headers`, créé s'il n'existe pas. Un onglet d'une version
 * précédente (colonnes de début identiques, suivantes vides) est complété à la fin sans perte.
 * Un onglet avec d'autres colonnes n'est jamais modifié.
 */
function getTable_(name, headers, minKnown) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Tout en texte brut pour que Sheets ne transforme pas les dates / heures.
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, headers.length).setNumberFormat('@');
    return sheet;
  }
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  var actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var known = 0;
  while (known < headers.length && actual[known] === headers[known]) known++;
  var restEmpty = actual.slice(known).every(function (h) { return h === ''; });
  if (known >= minKnown && known < headers.length && restEmpty) {
    var extra = headers.slice(known);
    sheet.getRange(1, known + 1, 1, extra.length).setValues([extra]).setFontWeight('bold');
    sheet.getRange(2, known + 1, sheet.getMaxRows() - 1, extra.length).setNumberFormat('@');
    actual = headers.slice();
  }
  if (actual.join('|') !== headers.join('|')) {
    throw new Error('L\'onglet « ' + name + ' » existe déjà avec d\'autres colonnes. ' +
      'Rien n\'a été modifié. Colonnes attendues en ligne 1 : ' + headers.join(', '));
  }
  return sheet;
}

function listItems_() {
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var tz = Session.getScriptTimeZone();
  return sheet.getRange(2, 1, last - 1, HEADERS.length).getValues()
    .filter(function (row) { return row[0] !== ''; })
    .map(function (row) {
      var item = {};
      HEADERS.forEach(function (h, i) {
        var v = row[i];
        // Valeurs saisies à la main dans la feuille : Sheets les convertit en Date.
        if (v instanceof Date) {
          var fmt = "yyyy-MM-dd'T'HH:mm:ss";
          if (h === 'heure') fmt = 'HH:mm';
          else if (h === 'date' || h === 'debut' || h === 'fin') fmt = 'yyyy-MM-dd';
          else if (h === 'echeance') fmt = 'MM-dd';
          v = Utilities.formatDate(v, tz, fmt);
        }
        item[h] = String(v);
      });
      return item;
    });
}

function findRow_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2 || !id) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function sanitize_(item, base) {
  var out = {};
  HEADERS.forEach(function (h) {
    var v = item[h] !== undefined ? item[h] : (base ? base[h] : '');
    out[h] = v === null || v === undefined ? '' : String(v).slice(0, 5000);
  });
  if (!out.titre.trim()) throw new Error('Le titre est obligatoire.');
  if (TYPES.indexOf(out.type) < 0) out.type = 'tache';
  if (out.telephone && !/^[0-9+().\s\-]{3,30}$/.test(out.telephone)) throw new Error('Numéro de téléphone invalide.');
  if (PRIORITES.indexOf(out.priorite) < 0) out.priorite = 'normale';
  if (STATUTS.indexOf(out.statut) < 0) out.statut = 'a_faire';
  if (out.date && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) throw new Error('Date invalide (AAAA-MM-JJ).');
  if (out.heure && !/^\d{2}:\d{2}$/.test(out.heure)) throw new Error('Heure invalide (HH:MM).');
  if (PERIODICITES.indexOf(out.periodicite) < 0) out.periodicite = '';
  if (out.echeance && !/^\d{1,2}(-\d{1,2})?$/.test(out.echeance)) throw new Error('Échéance invalide.');
  if (out.debut && !/^\d{4}-\d{2}-\d{2}$/.test(out.debut)) throw new Error('Date de début invalide (AAAA-MM-JJ).');
  if (out.fin && !/^\d{4}-\d{2}-\d{2}$/.test(out.fin)) throw new Error('Date de fin invalide (AAAA-MM-JJ).');
  if (!/^[0-9A-Za-z;\-]*$/.test(out.faits)) throw new Error('Liste des périodes faites invalide.');
  checkLinks_(out);
  checkSafe_(out);
  if (!out.periodicite) {
    out.echeance = '';
    out.debut = '';
    out.fin = '';
    out.faits = '';
  }
  return out;
}

function toRow_(item) {
  return HEADERS.map(function (h) { return item[h]; });
}

function createItem_(input) {
  var sheet = getSheet_();
  var now = new Date().toISOString();
  var item = sanitize_(input);
  item.id = Utilities.getUuid();
  item.cree_le = now;
  item.modifie_le = now;
  var row = sheet.getLastRow() + 1;
  var range = sheet.getRange(row, 1, 1, HEADERS.length);
  range.setNumberFormat('@');
  range.setValues([toRow_(item)]);
  return item;
}

function updateItem_(input) {
  var sheet = getSheet_();
  var row = findRow_(sheet, input.id);
  if (row < 0) throw new Error('Élément introuvable (peut-être supprimé).');
  var range = sheet.getRange(row, 1, 1, HEADERS.length);
  var current = {};
  var values = range.getValues()[0];
  HEADERS.forEach(function (h, i) { current[h] = values[i]; });
  var item = sanitize_(input, current);
  item.id = current.id;
  item.cree_le = String(current.cree_le);
  item.modifie_le = new Date().toISOString();
  range.setNumberFormat('@');
  range.setValues([toRow_(item)]);
  return item;
}

function deleteItem_(id) {
  var sheet = getSheet_();
  var row = findRow_(sheet, id);
  if (row < 0) throw new Error('Élément introuvable (peut-être déjà supprimé).');
  sheet.deleteRow(row);
}


// ---------------------------------------------------------------------------
// Domaines, objectifs et epics : Domaine > Objectif > Epic > Tâche.
// ---------------------------------------------------------------------------

function entity_(kind) {
  var def = ENTITIES[kind];
  if (!def) throw new Error('Type inconnu : ' + kind);
  return def;
}

function entitySheet_(kind) {
  var def = entity_(kind);
  return getTable_(def.sheet, def.headers, def.min);
}

function listEntities_(kind) {
  var def = entity_(kind);
  var sheet = entitySheet_(kind);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var tz = Session.getScriptTimeZone();
  return sheet.getRange(2, 1, last - 1, def.headers.length).getValues()
    .filter(function (row) { return row[0] !== ''; })
    .map(function (row) {
      var o = {};
      def.headers.forEach(function (h, i) {
        var v = row[i];
        if (v instanceof Date) {
          v = Utilities.formatDate(v, tz, h === 'debut' || h === 'fin' ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ss");
        }
        o[h] = String(v);
      });
      return o;
    });
}

/** Liens vers les niveaux supérieurs : seul le plus précis est gardé (epic > objectif > domaine). */
function checkLinks_(o) {
  ['feature', 'epic', 'objectif', 'domaine'].forEach(function (k) {
    if (o[k] !== undefined && !/^[0-9A-Za-z\-]*$/.test(o[k])) throw new Error('Lien « ' + k + ' » invalide.');
  });
  if (o.feature) { o.epic = ''; o.objectif = ''; o.domaine = ''; }
  else if (o.epic) { o.objectif = ''; o.domaine = ''; }
  else if (o.objectif) { o.domaine = ''; }
}

/** Champs SAFe (points, itération, PI) : formats. */
function checkSafe_(o) {
  if (o.points !== undefined) {
    o.points = String(o.points).replace(',', '.');
    if (o.points && !RE_NOMBRE.test(o.points)) throw new Error('Points : nombre attendu.');
  }
  if (o.iteration && !RE_ITERATION.test(o.iteration)) throw new Error('Itération invalide (ex. 2026-T4-IT3).');
  if (o.pi && !RE_PI.test(o.pi)) throw new Error('PI invalide (ex. 2026-T4).');
}

function sanitizeEntity_(kind, data, base) {
  var def = entity_(kind);
  var out = {};
  def.headers.forEach(function (h) {
    var v = data[h] !== undefined ? data[h] : (base ? base[h] : '');
    out[h] = v === null || v === undefined ? '' : String(v).slice(0, 5000);
  });
  var date = /^\d{4}-\d{2}-\d{2}$/;
  if (kind === 'domaine') {
    if (!out.nom.trim()) throw new Error('Le nom du domaine est obligatoire.');
    out.icone = out.icone.slice(0, 8);
  } else if (kind === 'feature') {
    if (!out.titre.trim()) throw new Error('Le titre est obligatoire.');
    checkSafe_(out);
  } else if (kind === 'objectifpi') {
    if (!out.titre.trim()) throw new Error('Le titre est obligatoire.');
    if (!RE_PI.test(out.pi)) throw new Error('PI invalide (ex. 2026-T4).');
    if (out.type !== 'bonus') out.type = 'engage';
    ['valeur_prevue', 'valeur_obtenue'].forEach(function (k) {
      if (out[k] && !(/^\d+$/.test(out[k]) && +out[k] >= 0 && +out[k] <= 10)) throw new Error('Valeur : entier de 0 à 10.');
    });
  } else {
    if (!out.titre.trim()) throw new Error('Le titre est obligatoire.');
    if (!date.test(out.debut)) throw new Error('Date de début invalide (AAAA-MM-JJ).');
    // Fin vide = epic sans fin / objectif permanent.
    if (out.fin && !date.test(out.fin)) throw new Error('Date de fin invalide (AAAA-MM-JJ).');
    if (out.fin && out.fin < out.debut) throw new Error('La date de fin est avant la date de début.');
  }
  if (kind === 'objectif') {
    ['cible', 'actuel'].forEach(function (k) {
      if (out[k] && !/^-?\d+([.,]\d+)?$/.test(out[k])) throw new Error('Indicateur : « ' + k + ' » doit être un nombre.');
      out[k] = out[k].replace(',', '.');
    });
    out.unite = out.unite.slice(0, 30);
  }
  if (kind === 'epic' && ETATS_EPIC.indexOf(out.etat) < 0) out.etat = '';
  if (out.couleur !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(out.couleur)) out.couleur = '#1A73E8';
  checkLinks_(out);
  return out;
}

function createEntity_(kind, data) {
  var def = entity_(kind);
  var sheet = entitySheet_(kind);
  var now = new Date().toISOString();
  var o = sanitizeEntity_(kind, data);
  o.id = Utilities.getUuid();
  o.cree_le = now;
  o.modifie_le = now;
  var range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, def.headers.length);
  range.setNumberFormat('@');
  range.setValues([def.headers.map(function (h) { return o[h]; })]);
  return o;
}

function updateEntity_(kind, data) {
  var def = entity_(kind);
  var sheet = entitySheet_(kind);
  var row = findRow_(sheet, data.id);
  if (row < 0) throw new Error('Élément introuvable (peut-être supprimé).');
  var range = sheet.getRange(row, 1, 1, def.headers.length);
  var current = {};
  var values = range.getValues()[0];
  def.headers.forEach(function (h, i) { current[h] = values[i]; });
  var o = sanitizeEntity_(kind, data, current);
  o.id = String(current.id);
  o.cree_le = String(current.cree_le);
  o.modifie_le = new Date().toISOString();
  range.setNumberFormat('@');
  range.setValues([def.headers.map(function (h) { return o[h]; })]);
  return o;
}

/** Lit un onglet en objets { row, data } (pour la suppression en cascade). */
function readTable_(sheet, headers) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, headers.length).getValues()
    .filter(function (r) { return r[0] !== ''; })
    .map(function (r) {
      var o = {};
      headers.forEach(function (h, i) { o[h] = String(r[i]); });
      return o;
    });
}

/** Réécrit un onglet avec les lignes restantes (plus rapide que de supprimer ligne par ligne). */
function writeTable_(sheet, headers, rows) {
  var last = sheet.getLastRow();
  if (last >= 2) sheet.getRange(2, 1, last - 1, headers.length).clearContent();
  if (!rows.length) return;
  var range = sheet.getRange(2, 1, rows.length, headers.length);
  range.setNumberFormat('@');
  range.setValues(rows.map(function (o) { return headers.map(function (h) { return o[h] === undefined ? '' : o[h]; }); }));
}

/**
 * Supprime un domaine, un objectif ou une epic.
 * - cascade : supprime aussi tout ce qui est en dessous ;
 * - sinon : ce qui est en dessous est conservé et remonte d'un niveau
 *   (tâches d'une epic → objectif de l'epic, ou son domaine ; epics et tâches d'un objectif → son domaine).
 * Renvoie le nombre d'éléments supprimés ou rattachés ailleurs.
 */
function deleteEntity_(kind, id, cascade) {
  var tasksSheet = getSheet_();
  var kinds = ['epic', 'objectif', 'domaine', 'feature', 'objectifpi'];
  var sheets = {};
  var data = { tache: readTable_(tasksSheet, HEADERS) };
  kinds.forEach(function (k) {
    sheets[k] = entitySheet_(k);
    data[k] = readTable_(sheets[k], ENTITIES[k].headers);
  });
  var self = data[kind].filter(function (o) { return o.id === String(id); })[0];
  if (!self) throw new Error('Élément introuvable (peut-être déjà supprimé).');

  var result = planDeletion_(kind, self, cascade, data);
  writeTable_(tasksSheet, HEADERS, result.tache);
  kinds.forEach(function (k) { writeTable_(sheets[k], ENTITIES[k].headers, result[k]); });
  return result.counts;
}

/**
 * Calcul pur de la suppression (même règle que l'application, voir mobile/src/hierarchy.ts).
 * Domaine > Objectif > Epic > Feature > Tâche.
 */
function planDeletion_(kind, self, cascade, data) {
  var id = self.id;
  var ids = function (list, test) { var m = {}; list.filter(test).forEach(function (x) { m[x.id] = true; }); return m; };
  var objIds = {}, epicIds = {}, featIds = {}, taskIds = {};
  if (kind === 'domaine') {
    objIds = ids(data.objectif, function (o) { return o.domaine === id; });
    epicIds = ids(data.epic, function (e) { return e.domaine === id || objIds[e.objectif]; });
  } else if (kind === 'objectif') {
    epicIds = ids(data.epic, function (e) { return e.objectif === id; });
  } else if (kind === 'epic') {
    epicIds[id] = true;
  }
  if (kind === 'feature') featIds[id] = true;
  else featIds = ids(data.feature, function (f) { return epicIds[f.epic]; });
  if (kind !== 'objectifpi') {
    taskIds = ids(data.tache, function (t) {
      return featIds[t.feature] || epicIds[t.epic] ||
        (kind === 'objectif' && t.objectif === id) ||
        (kind === 'domaine' && (t.domaine === id || objIds[t.objectif]));
    });
  }
  if (kind === 'epic') delete epicIds[id];
  if (kind === 'feature') delete featIds[id];
  var n = function (m) { return Object.keys(m).length; };
  var counts = { objectifs: n(objIds), epics: n(epicIds), features: n(featIds), taches: n(taskIds), cascade: !!cascade };

  var out = {};
  ['tache', 'epic', 'objectif', 'domaine', 'feature', 'objectifpi'].forEach(function (k) {
    out[k] = data[k].filter(function (o) { return !(k === kind && o.id === id); });
  });

  // Les objectifs du PI (historique des engagements) ne sont jamais supprimés avec un domaine : ils perdent leur domaine.
  if (kind === 'domaine') {
    out.objectifpi = out.objectifpi.map(function (o) {
      if (o.domaine !== id) return o;
      var c = copy_(o);
      c.domaine = '';
      return c;
    });
  }

  if (cascade) {
    out.objectif = out.objectif.filter(function (o) { return !objIds[o.id]; });
    out.epic = out.epic.filter(function (e) { return !epicIds[e.id]; });
    out.feature = out.feature.filter(function (f) { return !featIds[f.id]; });
    out.tache = out.tache.filter(function (t) { return !taskIds[t.id]; });
    out.counts = counts;
    return out;
  }
  // Sans cascade : les enfants directs remontent d'un niveau.
  var map = function (list, test, change) {
    return list.map(function (o) {
      if (!test(o)) return o;
      var c = copy_(o);
      change(c);
      return c;
    });
  };
  if (kind === 'feature') {
    out.tache = map(out.tache, function (t) { return t.feature === id; }, function (c) {
      c.feature = '';
      c.epic = self.epic || '';
    });
  } else if (kind === 'epic') {
    out.tache = map(out.tache, function (t) { return t.epic === id; }, function (c) {
      c.epic = '';
      c.objectif = self.objectif || '';
      c.domaine = self.objectif ? '' : (self.domaine || '');
    });
    out.feature = map(out.feature, function (f) { return f.epic === id; }, function (c) { c.epic = ''; });
  } else if (kind === 'objectif') {
    var up = function (c) { c.objectif = ''; c.domaine = self.domaine || ''; };
    out.epic = map(out.epic, function (e) { return e.objectif === id; }, up);
    out.tache = map(out.tache, function (t) { return t.objectif === id; }, up);
  } else if (kind === 'domaine') {
    var clear = function (c) { c.domaine = ''; };
    var has = function (o) { return o.domaine === id; };
    out.objectif = map(out.objectif, has, clear);
    out.epic = map(out.epic, has, clear);
    out.tache = map(out.tache, has, clear);
  }
  out.counts = counts;
  return out;
}

function copy_(o) {
  var c = {};
  Object.keys(o).forEach(function (k) { c[k] = o[k]; });
  return c;
}
