/**
 * API « Mes Tâches » — à coller dans l'éditeur Apps Script d'un Google Sheet
 * (Extensions > Apps Script), puis à déployer en « Application Web ».
 *
 * L'application mobile appelle cette API pour lire et enregistrer les tâches,
 * missions et rendez-vous dans l'onglet « Taches » du classeur.
 */

var SHEET_NAME = 'Taches';
var HEADERS = [
  'id', 'titre', 'type', 'date', 'heure', 'lieu',
  'description', 'priorite', 'statut', 'cree_le', 'modifie_le'
];
var TYPES = ['tache', 'mission', 'rendez-vous'];
var PRIORITES = ['basse', 'normale', 'haute'];
var STATUTS = ['a_faire', 'en_cours', 'termine'];

/** À lancer une fois depuis l'éditeur : crée l'onglet et génère la clé d'accès. */
function installer() {
  var sheet = getSheet_();
  if (sheet.getLastRow() < 2) ajouterExemples_();
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('API_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('API_KEY', key);
  }
  Logger.log('Clé d\'accès à saisir dans l\'application : ' + key);
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
    checkKey_(e.parameter.key);
    var action = e.parameter.action || 'list';
    if (action === 'ping') return { ok: true };
    if (action === 'list') return { ok: true, items: listItems_() };
    throw new Error('Action inconnue : ' + action);
  });
}

function doPost(e) {
  return handle_(function () {
    var body = JSON.parse((e.postData && e.postData.contents) || '{}');
    checkKey_(body.key);
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
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkKey_(key) {
  var expected = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!expected) throw new Error('API non installée : lancez la fonction « installer ».');
  if (key !== expected) throw new Error('Clé d\'accès invalide.');
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
