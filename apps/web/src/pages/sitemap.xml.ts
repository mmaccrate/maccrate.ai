import type { APIRoute } from 'astro';
import { PROJECTS } from '../data/projects';

export const GET: APIRoute = () => {
  const fixed = [
    ['/', 'monthly', '1.0'],
    ['/about', 'yearly', '0.7'],
    ['/privacy', 'yearly', '0.3'],
    ['/terms', 'yearly', '0.3'],
  ];
  const projectRows = PROJECTS.map((p) => [`/projects/${p.slug}`, 'monthly', '0.9']);
  const rows = [...fixed, ...projectRows]
    .map(([path, frequency, priority]) => `  <url><loc>https://maccrate.ai${path}</loc><changefreq>${frequency}</changefreq><priority>${priority}</priority></url>`)
    .join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
