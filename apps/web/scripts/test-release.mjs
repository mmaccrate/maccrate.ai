import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const env = { ...process.env, PUBLIC_MIRA_URL: '/mira/', PUBLIC_RELEASE_ID: 'release-test' };
execFileSync('npm', ['run', 'build'], { cwd: root, env, stdio: 'inherit' });

const check = (value, message) => { if (!value) throw new Error(message); };
const file = path => readFileSync(resolve(root, 'dist', path), 'utf8');
const expected = ['index.html','about/index.html','privacy/index.html','terms/index.html','projects/mira-machine/index.html','projects/hello-world-ai-fine-tuning/index.html','404.html','sitemap.xml','og.png'];
for (const path of expected) check(existsSync(resolve(root, 'dist', path)), `missing production artifact: ${path}`);

const htmlFiles = expected.filter(path => path.endsWith('.html'));
const combined = htmlFiles.map(file).join('\n');
check(!/(?:localhost|127\.0\.0\.1|tailscale|ts\.net|hermes-agent)/i.test(combined), 'local-only URL leaked into production HTML');
check(combined.includes('/mira/'), 'production Mira path is missing');
check(!combined.includes('astro-dev-toolbar'), 'Astro development toolbar leaked into production HTML');

const home = file('index.html');
const details = file('projects/mira-machine/index.html');
const fineTuning = file('projects/hello-world-ai-fine-tuning/index.html');
const about = file('about/index.html');
const privacy = file('privacy/index.html');
const terms = file('terms/index.html');
const sitemap = file('sitemap.xml');
check(/<h1[^>]*>[\s\S]*Hello,[\s\S]*Fine-Tuning/i.test(home), 'homepage does not lead with the newest project');
check(home.indexOf('Hello, Fine-Tuning') < home.indexOf('Mira Machine'), 'homepage projects are not newest-first');
check(home.includes('Play Mira Machine'), 'homepage play action is missing');
check(home.includes('Engineer · learning by building'), 'site identity does not reflect Max');
check(!/Engineering Manager|focused research/i.test(home + about), 'private or inaccurate work language remains in public pages');
check(/I am an engineer, saxophonist, and coffee drinker/i.test(about), 'About page is missing Max’s first-person introduction');
check(/wind ensemble/i.test(about) && /practice jazz/i.test(about), 'About page is missing Max’s musical life');
check(about.includes('https://github.com/mmaccrate'), 'About page is missing Max’s verified GitHub link');
check(about.includes('https://www.linkedin.com/in/mmaccrate/'), 'About page is missing Max’s verified LinkedIn link');
check(!/mailto:/i.test(combined), 'an unconfigured email action remains in production HTML');
check(details.includes('Concept, design, engineering, story system'), 'project ownership is unclear');
check(details.includes('The mystery is a deterministic evidence graph.'), 'case-study evidence architecture is missing');
check(details.includes('Cross-player discoveries pass through a signed trust boundary.'), 'case-study registry architecture is missing');
check(fineTuning.includes('THE ACTUAL HELLO WORLD') && fineTuning.includes('57 of 64'), 'fine-tuning field report is missing its experiment and result');
for (const retired of ['adapter-arcade','fine-tuning-gemma-home-pc','proving-local-lora']) check(!existsSync(resolve(root, 'dist/projects', retired)), `retired project route was published: ${retired}`);
check(/Website requests/i.test(privacy) && /Mira Machine/i.test(privacy), 'privacy notice does not describe actual portfolio data flows');
check(privacy.includes('/mira/privacy'), 'portfolio privacy page does not link to Mira’s separate notice');
check(!/rotating pseudonymous|generated discovery proposal/i.test(privacy), 'Mira-specific data details remain on the portfolio privacy page');
check(/No warranties/i.test(terms) && /Limitation of liability/i.test(terms), 'terms are missing standard prototype protections');
check(!existsSync(resolve(root, 'dist/accessibility/index.html')), 'removed accessibility statement is still published');
check(!/accessibility/i.test(sitemap), 'sitemap still publishes the removed accessibility statement');
for (const route of ['https://maccrate.ai/','https://maccrate.ai/about','https://maccrate.ai/projects/mira-machine','https://maccrate.ai/privacy']) check(sitemap.includes(route), `sitemap missing ${route}`);

for (const path of htmlFiles) {
  const html = file(path);
  check(/<meta name="viewport"/i.test(html), `${path} lacks viewport metadata`);
  check(/<link rel="canonical"/i.test(html), `${path} lacks canonical URL`);
  check(/<meta property="og:/i.test(html), `${path} lacks Open Graph metadata`);
  check(/Skip to content/i.test(html), `${path} lacks skip link`);
}

console.log('PORTFOLIO RELEASE PASS: production URLs, routes, sitemap, metadata, project ownership, privacy disclosure, and local-URL exclusion.');
