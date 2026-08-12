import type { APIRoute } from 'astro';
import { PROJECTS } from '../data/projects';

export const GET: APIRoute = () => {
  const fixed = ['/', '/about', '/privacy', '/terms'];
  const projectRows = PROJECTS.map((p) => `/projects/${p.slug}`);
  const rows = [...fixed, ...projectRows]
    .map((path) => `  <url><loc>https://maccrate.ai${path}</loc></url>`)
    .join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
