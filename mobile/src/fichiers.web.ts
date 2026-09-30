import type { PieceEntree, PieceJointe } from './api';

/**
 * Pièces jointes sur le web : choisir des fichiers, coller une capture (Ctrl + V), ouvrir une pièce reçue.
 * Les images sont réduites (1000 px au plus, JPEG) ; les autres fichiers passent tels quels (1 Mo au plus).
 */
export const FICHIERS_DISPONIBLES = true;
const TAILLE_MAX = 1_000_000;
const COTE_MAX = 1000;

const base64 = (buf: ArrayBuffer) => {
  const octets = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(s);
};

async function reduireImage(f: File): Promise<PieceEntree> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error(`« ${f.name} » : image illisible.`));
      i.src = url;
    });
    const k = Math.min(1, COTE_MAX / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    // Qualité baissée jusqu'à passer sous 1 Mo
    for (const q of [0.8, 0.65, 0.5, 0.35]) {
      const donnees = c.toDataURL('image/jpeg', q).split(',')[1];
      if ((donnees.length * 3) / 4 <= TAILLE_MAX) return { nom: f.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', donnees };
    }
    throw new Error(`« ${f.name} » : image trop lourde.`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Prépare un fichier : image réduite, ou fichier tel quel s'il fait 1 Mo au plus */
export async function preparer(f: File): Promise<PieceEntree> {
  if (f.type.startsWith('image/') && f.type !== 'image/svg+xml') return reduireImage(f);
  if (f.size > TAILLE_MAX) throw new Error(`« ${f.name} » dépasse 1 Mo.`);
  return { nom: f.name, type: f.type || 'application/octet-stream', donnees: base64(await f.arrayBuffer()) };
}

/** Ouvre le sélecteur de fichiers (plusieurs à la fois) */
export function choisirFichiers(): Promise<File[]> {
  return new Promise((ok) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = () => ok(Array.from(input.files ?? []));
    input.click();
  });
}

/** Colle une capture ou un fichier (Ctrl + V) tant que la fiche est ouverte ; renvoie de quoi arrêter d'écouter */
export function ecouterCollage(recu: (f: File[]) => void): () => void {
  const h = (ev: ClipboardEvent) => {
    const f = Array.from(ev.clipboardData?.files ?? []);
    if (f.length) {
      ev.preventDefault();
      recu(f);
    }
  };
  document.addEventListener('paste', h);
  return () => document.removeEventListener('paste', h);
}

/** Adresse affichable d'une pièce (image) */
export const adressePiece = (p: { type: string; donnees: string }) => `data:${p.type};base64,${p.donnees}`;

/** Ouvre (ou télécharge) une pièce reçue */
export function ouvrirPiece(p: PieceJointe) {
  const octets = Uint8Array.from(atob(p.donnees), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([octets], { type: p.type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = p.nom;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
