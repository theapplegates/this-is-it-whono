import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Shared Cloudinary <picture> rendering logic for the rehype plugin that
 * renders <cloudinary-picture> in .md posts. Builds Cloudinary URLs by hand
 * rather than via astro-cloudinary's getCldImageUrl: that helper transitively
 * runs `import astroPkg from "astro/package.json"` without a JSON import
 * attribute, which Node 22's native ESM loader rejects -- and Astro loads
 * markdown rehype plugins through that native loader (at config-eval time),
 * so importing astro-cloudinary here breaks the build. Picture.astro (the
 * .mdx/.astro path, loaded through Vite, which handles the JSON import) still
 * uses getCldImageUrl per the guide.
 */

export const CLOUDINARY_FORMAT_ORDER = Object.freeze(['jxl', 'avif', 'webp']);

export const CLOUDINARY_MIME_TYPES = Object.freeze({
  jxl: 'image/jxl',
  avif: 'image/avif',
  webp: 'image/webp'
});

const toBreakpointWidth = (breakpoint) =>
  typeof breakpoint === 'number' ? breakpoint : Number(breakpoint?.width ?? breakpoint);

let dotEnvCache;
function readDotEnv() {
  if (dotEnvCache !== undefined) return dotEnvCache;
  const map = {};
  try {
    const content = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in map)) map[key] = value;
    }
  } catch {
    /* .env may be absent; fall back to process.env only */
  }
  dotEnvCache = map;
  return map;
}

function getCloudName() {
  const env = readDotEnv();
  return (
    process.env.PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    env.PUBLIC_CLOUDINARY_CLOUD_NAME ||
    env.CLOUDINARY_CLOUD_NAME ||
    ''
  );
}

/**
 * Accept an array of widths (numbers or { width } objects), a
 * { breakpoints: [...] } wrapper, a JSON array string ("[200, 382]"), or a
 * comma-separated string of widths ("200, 382, 527"). Always returns numbers.
 */
export function parseBreakpointList(input) {
  if (input === undefined || input === null || input === '') return [];
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(toBreakpointWidth);
      } catch {
        /* fall through to comma split */
      }
    }
    return trimmed
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
  }
  if (Array.isArray(input)) return input.map(toBreakpointWidth);
  if (input && Array.isArray(input.breakpoints)) return input.breakpoints.map(toBreakpointWidth);
  return [];
}

/** De-dupe, include the intrinsic width, drop non-positive, sort ascending. */
export function normalizeBreakpoints(breakpointList, intrinsicWidth) {
  const widths = [...breakpointList];
  if (Number.isFinite(intrinsicWidth) && intrinsicWidth > 0) widths.push(intrinsicWidth);
  return [...new Set(widths.filter((width) => Number.isFinite(width) && width > 0))].sort(
    (a, b) => a - b
  );
}

/**
 * Build a Cloudinary transformation chain. Covers the common responsive-image
 * options (crop, quality, height, width, format); advanced needs can pass
 * rawTransformations (e.g. ['g_auto', 'e_grayscale']) which are appended as-is.
 */
function buildTransformString({ width, format, transformations = {} }) {
  const parts = [`c_${transformations.crop ?? 'limit'}`];
  const quality = transformations.quality ?? 'auto';
  if (quality) parts.push(`q_${quality}`);
  if (transformations.height) parts.push(`h_${transformations.height}`);
  parts.push(`w_${width}`);
  parts.push(`f_${format}`);
  const raw = transformations.rawTransformations;
  if (raw) parts.push(...(Array.isArray(raw) ? raw : [raw]));
  return parts.join(',');
}

export function buildCloudinaryUrl({ src, width, format, transformations = {} }) {
  const cloudName = getCloudName();
  if (!cloudName) {
    throw new Error(
      'Cloudinary cloud name is missing. Set PUBLIC_CLOUDINARY_CLOUD_NAME (or CLOUDINARY_CLOUD_NAME) in .env.'
    );
  }
  return `https://res.cloudinary.com/${cloudName}/image/upload/${buildTransformString({
    width,
    format,
    transformations
  })}/${src}`;
}

export function buildSrcSet({ src, format, breakpoints, transformations = {} }) {
  return breakpoints
    .map((width) => `${buildCloudinaryUrl({ src, width, format, transformations })} ${width}w`)
    .join(', ');
}