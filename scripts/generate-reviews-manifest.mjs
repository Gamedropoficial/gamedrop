import { readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const reviewsDirectory = 'media/resenas';
const manifestPath = join(reviewsDirectory, 'manifest.json');
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

async function collectImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectImages(path);
    return imageExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase()) ? [path] : [];
  }));
  return files.flat();
}

const images = (await collectImages(reviewsDirectory))
  .sort((a, b) => a.localeCompare(b))
  .map(path => {
    const filename = relative(reviewsDirectory, path).split(sep).join('/');
    return {
      src: `media/resenas/${filename}`,
      alt: `Customer review screenshot: ${filename.replace(/\.[^.]+$/, '').replaceAll(/[-_]/g, ' ')}`,
    };
  });

await writeFile(manifestPath, `${JSON.stringify({ version: 1, images }, null, 2)}\n`);
