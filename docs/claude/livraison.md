# Livrer

- Lien unique : https://tmarmed.github.io/Default/safe/ (démo : `?demo`, sortie : `?demo=0`).
- Publication à la main (plus de publication à chaque push) :
  `gh api -X POST repos/tmarmed/Default/actions/workflows/publier-web.yml/dispatches -f ref=claude/mobile-task-management-app-q8jysq`
  (Pages n'accepte que la branche d'origine ; le workflow compile `claude/version-safe`).
- Suivi : `gh api repos/tmarmed/Default/actions/workflows/publier-web.yml/runs?per_page=1`.
- Avant : typecheck + vérifications (voir `verifier.md`), commit, push.
- Dépôt : public, Claude ne peut pas changer sa visibilité. Règle de l'utilisateur : ne rendre public que si
  nécessaire, et remettre privé après. Lien : https://github.com/tmarmed/Default/settings (un dépôt privé gratuit
  perd GitHub Pages).
