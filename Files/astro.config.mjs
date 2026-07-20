import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { createPublicMarkdownConfig } from './src/plugins/markdown-pipeline.mjs';
import { site, hasSiteUrl } from './site.config.mjs';

const isProductionBuild = import.meta.env.PROD || process.env.NODE_ENV === 'production';
const SITEMAP_ROUTE_ROOTS = new Set(['about', 'admin', 'archive', 'bits', 'checks', 'essay', 'memo']);
const rawDeploymentBase = process.env.ASTRO_WHONO_BASE_PATH ?? '/';

const normalizeDeploymentBase = (value) => {
  const segment = String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
  return segment ? `/${segment}` : '/';
};

const deploymentBase = normalizeDeploymentBase(rawDeploymentBase);

const normalizeSitemapPathname = (page) => {
  let pathname = '/';

  try {
    pathname = new URL(page).pathname;
  } catch {
    [pathname = '/'] = page.split(/[?#]/, 1);
  }

  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
  const segments = normalizedPathname.split('/').filter(Boolean);
  const routeRootIndex = segments.findIndex((segment) => SITEMAP_ROUTE_ROOTS.has(segment));

  if (routeRootIndex > 0) {
    return `/${segments.slice(routeRootIndex).join('/')}`;
  }

  return normalizedPathname;
};

const isExcludedSitemapPathname = (pathname) =>
  pathname === '/admin'
  || pathname.startsWith('/admin/')
  || pathname === '/checks'
  || pathname.startsWith('/checks/')
  || pathname === '/bits/draft-dialog'
  || /^\/essay\/[^/]+$/.test(pathname);

const isExcludedSitemapEntry = (page) => isExcludedSitemapPathname(normalizeSitemapPathname(page));

const integrations = [
  svelte(),
  ...(hasSiteUrl ? [sitemap({ filter: (page) => !isExcludedSitemapEntry(page) })] : [])
];

export default defineConfig({
  site: site.url,
  base: deploymentBase,
  output: isProductionBuild ? 'static' : 'server',
  integrations,
  trailingSlash: 'always',
  build: {
    inlineStylesheets: 'auto'
  },

  markdown: {
    ...createPublicMarkdownConfig({ base: deploymentBase }),
    components: {
      'cloudinary-picture': fileURLToPath(new URL('./src/components/Picture.astro', import.meta.url))
    }
  },

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      // Prevents Vite from parsing internal relative paths in the package during SSR/Build
      noExternal: ['astro-cloudinary', '@radix-ui/*']
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    optimizeDeps: {
      // Prevents Vite from pre-bundling the package during static entrypoint building
      include: [
        'emoji-picker-element',
        '@lucide/svelte/icons/*',
        '@codemirror/commands',
        '@codemirror/lang-markdown',
        '@codemirror/language',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/highlight'
      ],
      exclude: ['astro-cloudinary']
    },
    build: {
      cssMinify: true,
      minify: 'esbuild'
    }
  }
});