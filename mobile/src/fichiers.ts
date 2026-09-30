import type { PieceEntree, PieceJointe } from './api';

/**
 * Pièces jointes sur téléphone (application native, lot 18) : pas encore disponibles — le choix de fichiers
 * demandera un module natif. La version web est dans fichiers.web.ts.
 */
export const FICHIERS_DISPONIBLES = false;
export async function preparer(_f: unknown): Promise<PieceEntree> {
  throw new Error('Pièces jointes : bientôt sur téléphone.');
}
export async function choisirFichiers(): Promise<unknown[]> {
  return [];
}
export function ecouterCollage(_recu: (f: unknown[]) => void): () => void {
  return () => {};
}
export const adressePiece = (p: { type: string; donnees: string }) => `data:${p.type};base64,${p.donnees}`;
export function ouvrirPiece(_p: PieceJointe) {}
