/**
 * Parcours des réunions de la démo (15/10) : ouvre chaque réunion de l'onglet Réunions, passe toutes ses étapes
 * (« Suivant », « … suivant › », « … suivante › »), et garde pour chaque étape une capture et le texte affiché ; signale les erreurs de
 * la page et les valeurs suspectes (undefined, NaN, [object…]). Sert à vérifier tous les écrans d'une pièce commune
 * qui a changé (docs/claude/verifier.md).
 *
 * Usage (depuis mobile/, une version web de la démo déjà construite et servie) :
 *   node scripts/parcours-reunions.mjs <adresse> <dossier de sortie> [simple] [filtre]
 *   ex. node scripts/parcours-reunions.mjs http://localhost:8835 /tmp/parcours
 *       node scripts/parcours-reunions.mjs http://localhost:8835 /tmp/parcours simple
 *       node scripts/parcours-reunions.mjs http://localhost:8835 /tmp/parcours safe "Budget"
 * `simple` : mode Simple (rituels perso, réunions d'équipe du mode Simple) ; `filtre` : seulement les réunions dont le
 * nom contient ce texte.
 */
import fs from 'fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const [adresse, sortie, mode = 'safe', filtre = ''] = process.argv.slice(2);
if (!adresse || !sortie) {
  console.log('Usage : node scripts/parcours-reunions.mjs <adresse> <dossier de sortie> [safe|simple] [filtre]');
  process.exit(1);
}
fs.mkdirSync(sortie, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/** Ouvre la démo (entrée : Fermer · Autoriser ×2 · SAFe · 🏢 ACME · Fermer), puis l'onglet Réunions */
async function ouvrir() {
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  const clic = async (t) => {
    const l = p.getByText(t, { exact: true }).first();
    if (await l.count()) {
      try {
        await l.click({ timeout: 3000 });
      } catch {}
      await p.waitForTimeout(600);
    }
  };
  await p.goto(`${adresse}/?demo`);
  await p.waitForTimeout(2500);
  for (const t of ['Fermer', 'Autoriser', 'Autoriser', 'SAFe', '🏢 ACME', 'Fermer']) await clic(t);
  await p.getByRole('tab').filter({ hasText: '📅' }).first().click();
  await p.waitForTimeout(1200);
  if (mode === 'simple') {
    await clic('Simple');
    await p.waitForTimeout(1500);
  }
  return { c, p, erreurs };
}

// Liste des réunions : les lignes « Nom · 👥 Équipe » (ou 🚆, 💼, 🏢, 🔒) de l'onglet Réunions
const { c: c0, p: p0 } = await ouvrir();
const lignes = (await p0.evaluate(() => document.body.innerText)).split('\n').map((x) => x.trim());
await c0.close();
const reunions = [...new Set(lignes.filter((x) => / · (👥|🚆|💼|🏢|🔒)/.test(x) && x.length < 80 && !x.startsWith('🔒 Moi')))].filter((x) => x.includes(filtre));
console.log(`${reunions.length} réunions`);

const bilan = [];
for (const [k, titre] of reunions.entries()) {
  const nom = `${String(k + 1).padStart(2, '0')}-${titre.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40)}`;
  const { c, p, erreurs } = await ouvrir();
  try {
    await p.getByText(titre, { exact: true }).first().click({ timeout: 4000 });
  } catch {
    bilan.push(`${titre} : introuvable`);
    await c.close();
    continue;
  }
  await p.waitForTimeout(2500);
  let etapes = 0;
  const suspects = new Set();
  for (let i = 0; i < 20; i++) {
    const texte = await p.evaluate(() => document.body.innerText);
    for (const m of texte.match(/undefined|NaN|\[object [A-Za-z]+\]|Infinity/g) ?? []) suspects.add(m);
    fs.writeFileSync(`${sortie}/${nom}-${i}.txt`, texte);
    await p.screenshot({ path: `${sortie}/${nom}-${i}.png` });
    etapes++;
    const suivant = p.getByText(/^(Suivant|.+ suivante? ›)$/).last();
    if (!(await suivant.count())) break;
    try {
      await suivant.click({ timeout: 3000 });
    } catch {
      break;
    }
    await p.waitForTimeout(1500);
  }
  bilan.push(`${titre} : ${etapes} étape${etapes > 1 ? 's' : ''}${erreurs.length ? ` · ERREURS : ${erreurs.slice(0, 3).join(' | ').slice(0, 300)}` : ''}${suspects.size ? ` · SUSPECT : ${[...suspects].join(', ')}` : ''}`);
  await c.close();
}
await b.close();
fs.writeFileSync(`${sortie}/bilan.txt`, bilan.join('\n'));
console.log(bilan.join('\n'));
