# Pièces jointes des échanges (Synchronisation)

Une image ne peut pas être « collée » dans une cellule (Google ne la rend pas lisible par l'API) ni stockée entière
(50 000 caractères au plus par cellule). Elle est rangée en texte base64 dans l'onglet `PiecesJointes` du Sheet de
l'espace, découpée en morceaux de 45 000 caractères au plus :
`id` (`<piece>-<k>`), `piece`, `nom`, `type` (ex. image/jpeg), `taille` (octets), `partie` (0, 1…), `total`,
`donnees`, `cree_le`. L'échange cite ses pièces dans sa colonne `pieces_jointes` (ids séparés par « ; »).
Limites : 5 pièces par échange, 1 Mo par fichier ; images réduites à 1000 px (JPEG). Pas d'historique : quand
l'échange disparaît, l'application efface les pièces qu'aucun échange ne cite plus (après 10 minutes).
Claude (connecteur Google Sheets) suit le même cas d'usage standard qu'une personne : ses échanges et leurs pièces
jointes vont dans le Sheet de **l'espace concerné** (celui de l'élément, ex. President pour une mission), jamais dans
Moi par défaut. Colonne `controle` de chaque morceau : « longueurxsomme » (somme des codes des caractères × leur
rang, « x » pour que Google ne le prenne pas pour une durée) ; l'application écarte une pièce dont un morceau ne
correspond pas (« pièce illisible »), au lieu d'afficher une image cassée.

Procédé de Claude (une image recopiée caractère par caractère peut être fausse) :
1. `python3 scripts/piece-claude.py capture.png <piece-id> [largeur] [qualité] [1000]` : image réduite, morceaux de
   1000 caractères avec leur `controle` ;
2. écrire les lignes dans `PiecesJointes` (un appel) ;
3. poser dans une colonne libre la formule de contrôle (Sheet en français : « ; »)
   `=IF(LEN(Hn)&"x"&SUMPRODUCT(CODE(MID(Hn;SEQUENCE(LEN(Hn));1))*SEQUENCE(LEN(Hn)))=Jn;"ok";"faux")`, relire ;
4. réécrire chaque morceau « faux » (seulement lui), revérifier ; effacer la colonne de formules ;
   Un morceau qui reste faux (passage répétitif, ex. « AAAA… » ou motifs qui se répètent) : l'écrire en 10 lignes
   de 100 caractères dans une colonne libre, vérifier `=LEN()` de chaque ligne, recoller avec `=JOIN("";…)` puis
   copier la **valeur** dans `donnees` (copyPaste PASTE_VALUES) ;
5. écrire l'échange avec `pieces_jointes`.
