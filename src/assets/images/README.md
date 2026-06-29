# Cloudinary source images

Drop image files in this folder, then generate responsive breakpoints **and**
a ready-to-paste snippet in one step:

```bash
npm run cloudinary:breakpoints -- src/assets/images/<filename>.jpg
```

The script uploads the image to Cloudinary, writes the generated widths to
`src/data/cloudinary-breakpoints.json`, and prints a `<cloudinary-picture>`
snippet to stdout. Copy that snippet into a `.md` post, replace the alt text,
done.

## One-time setup

Add these to `.env` at the project root (already gitignored — never commit it):

```
PUBLIC_CLOUDINARY_CLOUD_NAME=paulapplegate-com
CLOUDINARY_CLOUD_NAME=paulapplegate-com
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
```

The build only needs the **cloud name** to render images. The API key/secret are
used solely by the upload script above.

## Paste the printed snippet into a `.md` post

```md
<cloudinary-picture
  src="assets/images/<filename>"
  alt="TODO: describe this image"
  width="2000"
  height="1500"
  sizes="(min-width: 768px) 720px, 100vw"
  breakpoints="200, 382, 527, 730, 1024, 2000"
  picture-class="responsive-picture"
/>
```

No imports needed — a rehype plugin renders `<cloudinary-picture>` at build time
into a `<picture>` with JXL → AVIF → WebP `<source>`s plus a WebP `<img>`
fallback. (The script fills in the real `width`, `height`, and `breakpoints`
from the upload response — only the `alt` is yours to write.)

## Attributes

| Attribute        | Required | Notes |
| --------------- | -------- | ----- |
| `src`           | yes      | Cloudinary public ID: `assets/images/<filename>` (no `src/`, no extension). |
| `alt`           | yes      | Must be non-empty — the build fails otherwise. |
| `width`         | yes      | Intrinsic image width in px. |
| `height`        | yes      | Intrinsic image height in px. |
| `breakpoints`   | yes      | Comma-separated widths, or a JSON array like `[200, 382]`. |
| `sizes`         | rec.     | CSS `sizes` so the browser picks a source. |
| `picture-class` | opt.     | Class on the wrapper `<picture>` (a styling hook). |
| `loading`       | opt.     | `lazy` (default) or `eager`. |
| `decoding`      | opt.     | `async` (default) or `sync`. |
| `transformations` | opt.   | JSON object of extra Cloudinary transforms, e.g. `{"crop":"fill","height":500}` or `{"rawTransformations":["g_auto"]}`. |

## `.mdx` / `.astro` posts (optional)

A `<Picture>` component is still available for `.mdx`/`.astro` if you want typed
props and imports. The breakpoints JSON file is just a cached record of what the
script generated — `.md` posts paste the widths directly and don't import it, so
there's no need to index a JSON object by `publicId`.

```mdx
import Picture from "@/components/Picture.astro";

<Picture
  src="assets/images/<filename>"
  alt="..."
  width={2000}
  height={1500}
  sizes="(min-width: 768px) 720px, 100vw"
  breakpoints={[200, 382, 527, 730, 1024, 2000]}
  pictureClass="responsive-picture"
/>
```