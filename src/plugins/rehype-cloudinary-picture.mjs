import { visit } from 'unist-util-visit';
import {
  CLOUDINARY_FORMAT_ORDER,
  CLOUDINARY_MIME_TYPES,
  parseBreakpointList,
  normalizeBreakpoints,
  buildCloudinaryUrl,
  buildSrcSet
} from './cloudinary-picture.mjs';

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

// hast keeps unknown attributes under their lowercased HTML name, so accept
// both the kebab ("picture-class") and camel ("pictureClass") forms.
const pick = (properties, ...names) => {
  for (const name of names) {
    const value = properties?.[name];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const parseTransformations = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? value : {};
};

/**
 * Replaces <cloudinary-picture .../> raw-HTML elements (kept alive by
 * rehype-sanitize) with a real <picture> subtree pointing at Cloudinary URLs,
 * emitting JXL -> AVIF -> WebP <source>s plus a WebP <img> fallback.
 *
 * Must run AFTER rehype-raw (so the custom element is a real HAST node, not a
 * raw HTML string) and AFTER rehype-sanitize (so the element survives). Astro's
 * markdown.components substitution does not reach raw-HTML custom elements in
 * .md, so this plugin is the .md rendering path; Picture.astro covers the
 * .mdx / .astro contexts and shares the URL logic via cloudinary-picture.mjs.
 */
export default function rehypeCloudinaryPicture() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'cloudinary-picture') return;
      if (!parent || typeof index !== 'number') return;

      const properties = node.properties || {};
      const src = pick(properties, 'src');
      const alt = pick(properties, 'alt') ?? '';
      const intrinsicWidth = toNumber(pick(properties, 'width'));
      const intrinsicHeight = toNumber(pick(properties, 'height'));
      const sizes = pick(properties, 'sizes') ?? '';
      const pictureClass = pick(properties, 'pictureClass', 'picture-class');
      const loading = pick(properties, 'loading') ?? 'lazy';
      const decoding = pick(properties, 'decoding') ?? 'async';
      const transformations = parseTransformations(pick(properties, 'transformations'));

      if (!src) {
        throw new Error('Cloudinary <cloudinary-picture> requires a src.');
      }
      if (!alt) {
        throw new Error(`Cloudinary <cloudinary-picture> requires an alt for src: "${src}".`);
      }
      if (!Number.isFinite(intrinsicWidth) || !Number.isFinite(intrinsicHeight)) {
        throw new Error(
          `Cloudinary <cloudinary-picture> requires numeric width and height for src: "${src}".`
        );
      }

      const breakpoints = normalizeBreakpoints(
        parseBreakpointList(pick(properties, 'breakpoints')),
        intrinsicWidth
      );
      if (breakpoints.length === 0) {
        throw new Error(
          `Cloudinary breakpoints are missing for src: "${src}". Run "npm run cloudinary:breakpoints -- src/assets/images/<file>" and pass the generated widths.`
        );
      }

      const sources = CLOUDINARY_FORMAT_ORDER.map((format) => ({
        type: 'element',
        tagName: 'source',
        properties: {
          type: CLOUDINARY_MIME_TYPES[format],
          sizes,
          srcSet: buildSrcSet({ src, format, breakpoints, transformations })
        },
        children: []
      }));

      const picture = {
        type: 'element',
        tagName: 'picture',
        properties: pictureClass ? { className: [pictureClass] } : {},
        children: [
          ...sources,
          {
            type: 'element',
            tagName: 'img',
            properties: {
              src: buildCloudinaryUrl({ src, width: intrinsicWidth, format: 'webp', transformations }),
              alt,
              width: intrinsicWidth,
              height: intrinsicHeight,
              sizes,
              loading,
              decoding
            },
            children: []
          }
        ]
      };

      parent.children[index] = picture;
    });
  };
}