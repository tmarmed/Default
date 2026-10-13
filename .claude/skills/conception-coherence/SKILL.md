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
   complet dans le mode simple.
4. **Cycle de vie** : chaque état a une entrée et une sortie ; rien ne reste bloqué ; la trace est gérée.
5. **Cas d'usage** : simples puis composés ; absence, refus, aller-retour, plusieurs destinataires.
6. **Effets de bord** : messages et notifications, confidentialité (ce qui est privé le reste ; reformuler avant de
   rendre public), droits et rôles, données partagées, limites techniques (quotas, écritures groupées).
7. **Automatique ou choisi ?** Par défaut, l'utilisateur choisit (proposition précochée qu'il peut enlever), rien ne
   se crée ni ne monte d'un niveau tout seul.
8. **Percée de compréhension** : quand un concept nouveau ou un meilleur niveau d'abstraction apparaît (ex. « le plan
   est une intention, le statut est un état »), lister les règles déjà écrites qui en dépendent, les relire avec ce
   concept et les mettre à jour (décisions remplacées notées dans le journal). Les règles ne sont pas figées : elles
   émergent et se simplifient à chaque percée (Eric Evans, *refactoring toward deeper insight*).

## Après le code
- Un test par règle de gestion nouvelle.
- Documents du projet à jour (règles, mission, bilan, liste à faire).
- Dire ce que la vérification a trouvé, même « rien ».
