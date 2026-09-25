import { getAccessToken } from './auth';
import { AuthError } from './authError';
import { creerMagasin, type Magasin, ONGLETS, type Persistance, type Table, TABLES } from './magasin';
import type { TypeEspace } from './espaces';

/**
 * Connexion Google directe : l'application lit et écrit elle-même les Google Sheets des espaces (API Google
 * Sheets et Drive), sans script. Accès limité aux fichiers créés (ou ouverts) par l'application.
 */
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';

/** Source du jeton d'accès (remplaçable pour les vérifications automatiques) */
let jeton: (force?: boolean) => Promise<string> = getAccessToken;
export const utiliserJeton = (f: (force?: boolean) => Promise<string>) => {
  jeton = f;
};

async function appel<T>(url: string, init: RequestInit = {}, nouvelEssai = true): Promise<T> {
  const token = await jeton();
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers } });
  } catch {
    throw new Error('Pas de connexion à Google. Vérifiez votre réseau.');
  }
  if (res.status === 401) {
    // Jeton expiré : on le renouvelle une fois
    if (nouvelEssai) {
      await jeton(true);
      return appel<T>(url, init, false);
    }
    throw new AuthError('Session Google terminée : reconnectez-vous.');
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const msg = j?.error?.message ?? `erreur ${res.status}`;
    if (res.status === 403 || res.status === 404) throw new Error(`Fichier inaccessible (${msg}). A-t-il été supprimé, ou créé avec un autre compte ?`);
    throw new Error(`Google Sheets : ${msg}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---------------------------------------------------------------------------
// Fichiers des espaces : repérés par leurs propriétés d'application (type, nom)
// ---------------------------------------------------------------------------
export interface FichierEspace {
  id: string;
  nom: string;
  type: TypeEspace;
  nomEspace: string;
}

/** Noms donnés par Google à un fichier sans titre */
const SANS_TITRE = /^(feuille de calcul sans titre|untitled spreadsheet|sans titre|untitled)$/i;

/**
 * Google Sheets créés par l'application (l'accès limité ne montre que ceux-là), du plus ancien au plus récent :
 * les fichiers d'espace (reconnus par leurs propriétés : type, nom), et les autres (création interrompue).
 */
export async function fichiersEspaces(): Promise<{ espaces: FichierEspace[]; autres: { id: string; nom: string; sansTitre: boolean }[] }> {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const r = await appel<{ files: { id: string; name: string; appProperties?: Record<string, string> }[] }>(
    `${DRIVE}?q=${q}&fields=files(id,name,appProperties,createdTime)&orderBy=createdTime&pageSize=200`,
  );
  const estEspace = (f: { appProperties?: Record<string, string> }) =>
    f.appProperties?.mesTaches === '1' && ['moi', 'equipe', 'entreprise'].includes(f.appProperties?.type ?? '');
  return {
    espaces: r.files
      .filter(estEspace)
      .map((f) => ({ id: f.id, nom: f.name, type: f.appProperties!.type as TypeEspace, nomEspace: f.appProperties?.nom ?? f.name })),
    autres: r.files.filter((f) => !estEspace(f)).map((f) => ({ id: f.id, nom: f.name, sansTitre: SANS_TITRE.test(f.name.trim()) })),
  };
}

/** Google Sheets d'espace dans la corbeille de Google Drive (récupérables 30 jours) */
export async function fichiersCorbeille(): Promise<FichierEspace[]> {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=true");
  const r = await appel<{ files: { id: string; name: string; appProperties?: Record<string, string> }[] }>(
    `${DRIVE}?q=${q}&fields=files(id,name,appProperties)&pageSize=200`,
  );
  return r.files
    .filter((f) => f.appProperties?.mesTaches === '1' && ['equipe', 'entreprise'].includes(f.appProperties?.type ?? ''))
    .map((f) => ({ id: f.id, nom: f.name, type: f.appProperties!.type as TypeEspace, nomEspace: f.appProperties?.nom ?? f.name }));
}

/** Met le Google Sheet d'un espace à la corbeille de Google Drive (true) ou l'en sort (false) */
export async function corbeille(id: string, dedans: boolean): Promise<void> {
  await appel(`${DRIVE}/${id}?fields=id`, { method: 'PATCH', body: JSON.stringify({ trashed: dedans }) });
}

/** Renomme un fichier (règle de nommage des espaces) */
export async function renommerFichier(id: string, nom: string): Promise<void> {
  await appel(`${DRIVE}/${id}?fields=id`, { method: 'PATCH', body: JSON.stringify({ name: nom }) });
}

/** Reprend un fichier de l'application (création interrompue) comme fichier d'un espace : nom et propriétés */
export async function adopterFichier(id: string, titre: string, type: TypeEspace, nomEspace: string): Promise<void> {
  await appel(`${DRIVE}/${id}?fields=id`, {
    method: 'PATCH',
    body: JSON.stringify({ name: titre, appProperties: { mesTaches: '1', type, nom: nomEspace } }),
  });
}

/**
 * Crée le Google Sheet d'un espace : le fichier naît avec son nom et ses propriétés (un seul appel à Drive),
 * puis reçoit ses onglets et leurs colonnes.
 */
export async function creerFichierEspace(titre: string, type: TypeEspace, nomEspace: string): Promise<string> {
  const f = await appel<{ id: string }>(`${DRIVE}?fields=id`, {
    method: 'POST',
    body: JSON.stringify({ name: titre, mimeType: 'application/vnd.google-apps.spreadsheet', appProperties: { mesTaches: '1', type, nom: nomEspace } }),
  });
  const g = await appel<{ sheets: { properties: { sheetId: number; title: string } }[] }>(`${SHEETS}/${f.id}?fields=sheets.properties`);
  const premier = g.sheets[0]?.properties.sheetId ?? 0;
  const ids = TABLES.map((_, i) => (i === 0 ? premier : 1000 + i));
  const requests: object[] = [];
  TABLES.forEach((t, i) => {
    const properties = { sheetId: ids[i], title: ONGLETS[t].nom, gridProperties: { frozenRowCount: 1 } };
    requests.push(
      i === 0
        ? { updateSheetProperties: { properties, fields: 'title,gridProperties.frozenRowCount' } }
        : { addSheet: { properties } },
      {
        repeatCell: {
          range: { sheetId: ids[i], startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: 'userEnteredFormat.textFormat.bold',
        },
      },
    );
  });
  await appel(`${SHEETS}/${f.id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
  await appel(`${SHEETS}/${f.id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data: TABLES.map((t) => ({ range: plage(ONGLETS[t].nom, 'A1'), values: [ONGLETS[t].colonnes] })) }),
  });
  return f.id;
}

// ---------------------------------------------------------------------------
// Lecture / écriture des onglets
// ---------------------------------------------------------------------------
const plage = (onglet: string, suite: string) => `'${onglet.replace(/'/g, "''")}'!${suite}`;

/** Lettre(s) de colonne : 1 → A, 27 → AA */
function colonne(n: number): string {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function persistanceSheets(fichier: string): Persistance {
  /** Colonnes lues de chaque onglet (celles du fichier, plus les nouvelles de l'application ajoutées à la fin) */
  const entetes = new Map<Table, string[]>();
  /** Nombre de lignes de données au dernier passage (pour effacer ce qui dépasse) */
  const lignes = new Map<Table, number>();
  let ongletsVerifies: Promise<void> | null = null;

  /** Onglets manquants (fichier ancien ou modifié à la main) : ajoutés avec leurs colonnes */
  const verifierOnglets = () =>
    (ongletsVerifies ??= (async () => {
      const s = await appel<{ sheets: { properties: { title: string } }[] }>(`${SHEETS}/${fichier}?fields=sheets.properties.title`);
      const existants = new Set(s.sheets.map((x) => x.properties.title));
      const manquants = TABLES.filter((t) => !existants.has(ONGLETS[t].nom));
      if (!manquants.length) return;
      await appel(`${SHEETS}/${fichier}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ requests: manquants.map((t) => ({ addSheet: { properties: { title: ONGLETS[t].nom, gridProperties: { frozenRowCount: 1 } } } })) }),
      });
      await appel(`${SHEETS}/${fichier}/values:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ valueInputOption: 'RAW', data: manquants.map((t) => ({ range: plage(ONGLETS[t].nom, 'A1'), values: [ONGLETS[t].colonnes] })) }),
      });
    })().catch((e) => {
      ongletsVerifies = null;
      throw e;
    }));

  return {
    async lire(t) {
      await verifierOnglets();
      const nom = ONGLETS[t].nom;
      const r = await appel<{ values?: string[][] }>(`${SHEETS}/${fichier}/values/${encodeURIComponent(plage(nom, 'A1:ZZ'))}?majorDimension=ROWS`);
      const [entete = [], ...rows] = r.values ?? [];
      const cols = entete.map((h) => String(h).trim());
      // Colonnes de l'application absentes du fichier : ajoutées à la fin
      const nouvelles = ONGLETS[t].colonnes.filter((c) => !cols.includes(c));
      if (nouvelles.length) {
        await appel(`${SHEETS}/${fichier}/values/${encodeURIComponent(plage(nom, `${colonne(cols.length + 1)}1`))}?valueInputOption=RAW`, {
          method: 'PUT',
          body: JSON.stringify({ values: [nouvelles] }),
        });
        cols.push(...nouvelles);
      }
      entetes.set(t, cols);
      lignes.set(t, rows.length);
      return rows
        .map((row) => Object.fromEntries(cols.map((c, i) => [c, row[i] === undefined || row[i] === null ? '' : String(row[i])])))
        .filter((o) => o.id) as never;
    },
    async ecrire(t, rows) {
      const nom = ONGLETS[t].nom;
      const cols = entetes.get(t) ?? ONGLETS[t].colonnes;
      const values = (rows as unknown as Record<string, unknown>[]).map((r) => cols.map((c) => (r[c] === undefined || r[c] === null ? '' : String(r[c]))));
      if (values.length) {
        await appel(`${SHEETS}/${fichier}/values/${encodeURIComponent(plage(nom, 'A2'))}?valueInputOption=RAW`, {
          method: 'PUT',
          body: JSON.stringify({ values }),
        });
      }
      // Lignes en trop (suppression) : effacées
      const avant = lignes.get(t) ?? 0;
      if (avant > values.length) {
        await appel(`${SHEETS}/${fichier}/values/${encodeURIComponent(plage(nom, `A${values.length + 2}:${colonne(Math.max(cols.length, 1))}${avant + 1}`))}:clear`, {
          method: 'POST',
          body: '{}',
        });
      }
      lignes.set(t, values.length);
    },
  };
}

const magasins = new Map<string, Magasin>();
/** Opérations sur le Google Sheet d'un espace */
export function magasinSheets(fichier: string): Magasin {
  let m = magasins.get(fichier);
  if (!m) magasins.set(fichier, (m = creerMagasin(persistanceSheets(fichier))));
  return m;
}
