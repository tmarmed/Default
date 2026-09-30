#!/usr/bin/env python3
"""
Pièce jointe envoyée par Claude (connecteur Google Sheets) : prépare l'image et ses morceaux vérifiables.

  python3 scripts/piece-claude.py capture.png <piece-id> [largeur=280] [qualite=40] [morceau=1000]

Écrit <piece-id>.json : les lignes à écrire dans l'onglet PiecesJointes (id, piece, nom, type, taille, partie,
total, donnees, cree_le, controle) et, pour chaque morceau, la formule de contrôle à poser dans une colonne libre
(Sheet en français : séparateur « ; »). Procédé : écrire les lignes, poser les formules, relire, comparer avec
`controle`, réécrire les morceaux faux, effacer les formules, puis écrire l'échange avec pieces_jointes.
Petits morceaux (1000 caractères) : une erreur de recopie ne coûte qu'un morceau à réécrire.
"""
import base64, datetime, io, json, sys
from PIL import Image

src, pid = sys.argv[1], sys.argv[2]
largeur = int(sys.argv[3]) if len(sys.argv) > 3 else 280
qualite = int(sys.argv[4]) if len(sys.argv) > 4 else 40
taille_morceau = int(sys.argv[5]) if len(sys.argv) > 5 else 1000

im = Image.open(src).convert('RGB')
im = im.resize((largeur, round(im.height * largeur / im.width)))
buf = io.BytesIO()
im.save(buf, 'JPEG', quality=qualite, optimize=True)
octets = buf.getvalue()
b64 = base64.b64encode(octets).decode()
morceaux = [b64[i:i + taille_morceau] for i in range(0, len(b64), taille_morceau)]
controle = lambda t: f'{len(t)}x{sum(ord(c) * (i + 1) for i, c in enumerate(t))}'
maintenant = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
nom = src.rsplit('/', 1)[-1].rsplit('.', 1)[0] + '.jpg'
lignes = [[f'{pid}-{k}', pid, nom, 'image/jpeg', str(len(octets)), str(k), str(len(morceaux)), m, maintenant, controle(m)] for k, m in enumerate(morceaux)]
formule = lambda r: f'=LEN(H{r})&"x"&SUMPRODUCT(CODE(MID(H{r};SEQUENCE(LEN(H{r}));1))*SEQUENCE(LEN(H{r})))'
json.dump({'lignes': lignes, 'formule_ligne': formule(2)}, open(f'{pid}.json', 'w'), ensure_ascii=False)
print(f'{nom} : {len(octets)} octets, {len(b64)} caractères, {len(morceaux)} morceaux de {taille_morceau} → {pid}.json')
for k, m in enumerate(morceaux):
    print(f'--- morceau {k} ({controle(m)})')
    print(m)
