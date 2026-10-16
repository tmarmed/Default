---
name: conception-coherence
description: Liste de contrôle de cohérence (famille « conception », générale, tous projets) à passer avant de proposer ou de coder une conception, et quand l'utilisateur demande « est-ce qu'il y a une incohérence ? » ou « est-ce qu'on a loupé quelque chose ? ».
---

# Vérifier la cohérence

## Avant de proposer
1. **Mots** : chaque terme est défini et garde le même sens partout ? Sinon le définir d'abord.
2. **Une seule règle** : la nouveauté réutilise-t-elle un mécanisme existant au lieu d'en ajouter un deuxième qui
   fait presque la même chose ?
3. **Modes et niveaux** : si le produit a plusieurs modes (simple / complet) ou niveaux (équipe, programme,
   entreprise) : mêmes données et mêmes composants, seuls les mots et les options changent ; aucun jargon du mode
   complet dans le mode simple — ni mot, ni rôle, ni concept (13/10 : « Coach agile » proposé à tort en mode Simple).
4. **Cycle de vie** : chaque état a une entrée et une sortie ; rien ne reste bloqué ; la trace est gérée.
5. **Cas d'usage** : simples puis composés ; absence, refus, aller-retour, plusieurs destinataires.
6. **Effets de bord** : messages et notifications, confidentialité (ce qui est privé le reste ; reformuler avant de
   rendre public), droits et rôles, données partagées, limites techniques (quotas, écritures groupées).
7. **Automatique ou choisi ?** Par défaut, l'utilisateur choisit (proposition précochée qu'il peut enlever), rien ne
   se crée ni ne monte d'un niveau tout seul. Ce qu'on **reçoit** d'ailleurs arrive dans une seule salle d'attente
   (la messagerie) et ne crée jamais rien tout seul chez celui qui le reçoit ; lui choisit (placer, temporiser,
   répondre). Seul l'envoyeur peut avoir sa trace d'office (16/10). Lister ce qui se crée automatiquement aujourd'hui
   avant de trancher (en lisant le code).
8. **Percée de compréhension** : quand un concept nouveau ou un meilleur niveau d'abstraction apparaît (ex. « le plan
   est une intention, le statut est un état »), lister les règles déjà écrites qui en dépendent, les relire avec ce
   concept et les mettre à jour (décisions remplacées notées dans le journal). Les règles ne sont pas figées : elles
   émergent et se simplifient à chaque percée (Eric Evans, *refactoring toward deeper insight*).
9. **Cloisonnement** : les données d'exemple ou de démo restent hors du code de l'application (le code est générique,
   la démo vit dans son propre fichier et son propre stockage) ; chaque donnée nouvelle est rangée dans l'espace de
   son niveau (équipe, train, perso…) et n'est lue que par ceux qui y ont accès.

10. **Pièces communes** (15/10) : avant de coder un écran ou un bloc, chercher la pièce commune qui existe déjà
    (carte du code du projet) et la réutiliser ; si le même morceau existe déjà ailleurs ou va exister deux fois,
    **créer la pièce commune** et y brancher les deux endroits (pas une copie de plus) ; une variante passe par une
    option de la pièce commune, pas par une copie modifiée.

11. **Liens entre niveaux** (16/10) : une seule relation parent → enfants pour tout ce qui circule entre niveaux
    (messages transmis, escalades, demandes, suivis) : le **parent est au niveau du dessus** (décide, valide,
    communique), l'**enfant au dessous** (demande, fait, confirme la prise en compte). Vérifier les **cas limites** de
    la chaîne (le plus haut n'escalade pas, le plus bas ne communique pas), la **visibilité** (le dessus voit le
    dessous, jamais l'inverse) et la **fin de vie** (ce qui touche un élément lié passe par une demande au parent).

12. **Généraliser sans casser** (16/10) : quand une règle devient générale (une seule mécanique pour plusieurs
    cas), lister ce qui change dans l'existant (régressions fonctionnelles possibles) et faire valider par
    l'utilisateur tout nouveau cas d'usage que la généralisation fait apparaître.

## Après le code
- Le code nouveau n'a recréé à la main aucune pièce commune (chercher les anciens motifs : style ancien, copie d'une
  fonction, bloc refait) ; sinon le brancher sur la pièce commune, ou dire pourquoi pas.
- Une pièce commune a changé : vérifier **tous** les écrans qui l'utilisent (lister ses appels, parcours avec
  captures), pas seulement celui qu'on regardait.
- Carte du code à jour : pièce commune nouvelle ajoutée, pièce supprimée retirée.
- Un test par règle de gestion nouvelle.
- Documents du projet à jour (règles, mission, bilan, liste à faire).
- Dire ce que la vérification a trouvé, même « rien ».
