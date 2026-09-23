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
  'description', 'priorite', 'statut', 'cree_le', 'modifie_le'
];
var TYPES = ['tache', 'mission', 'rendez-vous'];
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
    if (action === 'list') return { ok: true, items: listItems_() };
    throw new Error('Action inconnue : ' + action);
  });
}

function doPost(e) {
  return handle_(function () {
    var body = JSON.parse((e.postData && e.postData.contents) || '{}');
    checkAuth_(body);
    // Lecture : pas besoin de verrou.
    if (body.action === 'ping') return { ok: true };
    if (body.action === 'list') return { ok: true, items: listItems_() };
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      switch (body.action) {
        case 'create': return { ok: true, item: createItem_(body.item || {}) };
        case 'update': return { ok: true, item: updateItem_(body.item || {}) };
        case 'delete': deleteItem_(body.id); return { ok: true };
        default: throw new Error('Action inconnue : ' + body.action);
      }
    } finally {
      lock.releaseLock();
    }
  });
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Tout en texte brut pour que Sheets ne transforme pas les dates / heures.
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, HEADERS.length).setNumberFormat('@');
  } else if (sheet.getLastRow() === 0) {
    // Onglet existant mais vide : on ajoute seulement la ligne d'en-têtes.
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    // Onglet existant avec des données : on ne touche à rien si les colonnes
    // ne sont pas celles attendues, pour ne jamais écrire dans la mauvaise colonne.
    var actual = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0]
      .map(function (h) { return String(h).trim(); });
    if (actual.join('|') !== HEADERS.join('|')) {
      throw new Error('L\'onglet « ' + SHEET_NAME + ' » existe déjà avec d\'autres colonnes. ' +
        'Rien n\'a été modifié. Colonnes attendues en ligne 1 : ' + HEADERS.join(', '));
    }
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
          v = Utilities.formatDate(v, tz, h === 'heure' ? 'HH:mm' : (h === 'date' ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ss"));
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
  if (PRIORITES.indexOf(out.priorite) < 0) out.priorite = 'normale';
  if (STATUTS.indexOf(out.statut) < 0) out.statut = 'a_faire';
  if (out.date && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) throw new Error('Date invalide (AAAA-MM-JJ).');
  if (out.heure && !/^\d{2}:\d{2}$/.test(out.heure)) throw new Error('Heure invalide (HH:MM).');
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
