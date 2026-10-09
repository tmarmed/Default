/**
 * Vocabulaire selon le mode (validé le 09/10) : en mode Simple, aucun mot du SAFe à l'écran. Les éléments sont les
 * mêmes (une epic du SAFe est un projet du Simple, un OKR est un objectif) ; seuls les mots changent.
 * `reglerVocabulaire` est appelé par l'application quand le mode change (comme `reglerConversion`, src/pi.ts).
 */
let simple = false;
export const reglerVocabulaire = (s: boolean) => {
  simple = s;
};
export const vocabulaireSimple = () => simple;

// Du plus précis au plus général (articles et accords d'abord : « une epic » → « un projet »)
const REMPLACEMENTS: [RegExp, string][] = [
  [/\b(\d+|ces|des|les|vos|ses|aux) epics (repliées|ajoutées|liées|terminées|commencées)\b/g, '$1 projets $2'],
  [/\bepics? (repliée|ajoutée|liée|terminée|commencée)(s?)\b/g, 'projet$2 $1$2'],
  [/\bepic infinie\b/g, 'projet sans fin'],
  [/\b[Nn]ouvelle epic\b/g, 'Nouveau projet'],
  [/\b[Uu]ne autre epic\b/g, 'un autre projet'],
  [/\bUne epic\b/g, 'Un projet'],
  [/\bune epic\b/g, 'un projet'],
  [/\bcette epic\b/g, 'ce projet'],
  [/\bCette epic\b/g, 'Ce projet'],
  [/\bL['’]epic\b/g, 'Le projet'],
  [/\bl['’]epic\b/g, 'le projet'],
  [/\bd['’]epic\b/g, 'de projet'],
  [/\bd['’]epics\b/g, 'de projets'],
  [/\bEpics\b/g, 'Projets'],
  [/\bepics\b/g, 'projets'],
  [/\bEpic\b/g, 'Projet'],
  [/\bepic\b/g, 'projet'],
];
// Accords après « projet » : « projet … repliée » → « replié »
const ACCORDS: [RegExp, string][] = [
  [/\b(projets?) (repli|ajout|li|termin|commenc)ée(s?)\b/g, '$1 $2é$3'],
  [/\b(projets?) ([^.,;:]{0,30}?)(repli|ajout|li)ées\b/g, '$1 $2$3és'],
];

/** Texte affiché : en mode Simple, les mots du SAFe deviennent ceux du Simple (epic → projet, OKR → objectif) */
export function vocab(texte: string): string;
export function vocab(texte: string | undefined): string | undefined;
export function vocab(texte: string | undefined): string | undefined {
  if (!simple || !texte) return texte;
  let t = texte;
  for (const [re, par] of REMPLACEMENTS) t = t.replace(re, par);
  for (const [re, par] of ACCORDS) t = t.replace(re, par);
  return t;
}
