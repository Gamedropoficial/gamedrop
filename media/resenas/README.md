# Review images

Add customer-review screenshots to this directory. Supported formats are AVIF, GIF, JPEG, JPG, PNG, SVG, and WebP; subdirectories are supported.

On a push containing an image change, GitHub Actions regenerates `manifest.json`. The storefront reads that same-origin manifest, so no `index.html` edit or GitHub browser API is required.

To regenerate it locally, run:

```sh
node scripts/generate-reviews-manifest.mjs
```
