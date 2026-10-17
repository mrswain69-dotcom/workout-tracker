import { readdir, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';

// Native copies only. Original web paths, artwork and reward identities stay intact.
export async function prepareNativeArtwork(root, output = path.join(root, '.native-public')) {
  const { default: sharp } = await import('sharp');
  const source = path.join(root, 'public');
  if (path.resolve(output) !== path.join(path.resolve(root), '.native-public')) throw new Error('Unexpected native asset output');
  await rm(output, { recursive: true, force: true });
  const files = [];
  async function walk(dir, relative = '') {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const name = path.posix.join(relative, item.name);
      if (item.isDirectory()) await walk(path.join(dir, item.name), name);
      else if (item.isFile()) files.push(name);
    }
  }
  await walk(source);
  const mapping = {};
  let inputBytes = 0, outputBytes = 0;
  // Two workers bound libvips memory use on CI machines.
  const queue = [...files];
  await Promise.all(Array.from({length:2}, async () => {
    for (let file; (file = queue.shift());) {
      const input = path.join(source, file);
      let target = path.join(output, file);
      const bytes = await readFile(input);
      inputBytes += bytes.length;
      await mkdir(path.dirname(target), {recursive:true});
      // Keep PWA-only files out of the native container.
      if (file === 'sw.js' || file === 'manifest.webmanifest') continue;
      if (/^(avatars|badges\/icons)\/.+\.png$/i.test(file)) {
        const image = sharp(bytes);
        const metadata = await image.metadata();
        // Skip animations and unusually wide/deep formats rather than flattening them.
        if ((!metadata.pages || metadata.pages === 1) && metadata.depth === 'uchar' && (!metadata.orientation || metadata.orientation === 1)) {
          const compressed = await image.keepIccProfile().webp({lossless:true,exact:true,effort:4}).toBuffer();
          // Verify visible pixels and alpha, not just dimensions, before omitting PNG.
          const original = await sharp(bytes).ensureAlpha().raw().toBuffer();
          const decoded = await sharp(compressed).ensureAlpha().raw().toBuffer();
          if (!original.equals(decoded)) throw new Error(`Native artwork pixels changed: ${file}`);
          if (compressed.length < bytes.length) {
            const relative = file.replace(/\.png$/i, '.webp');
            target = path.join(output, relative);
            if (files.includes(relative)) throw new Error(`Native artwork collision: ${relative}`);
            await writeFile(target, compressed);
            mapping['/' + file] = '/' + relative;
            outputBytes += compressed.length;
            continue;
          }
        }
      }
      await copyFile(input, target);
      outputBytes += bytes.length;
    }
  }));
  const report = {inputBytes,outputBytes,converted:Object.keys(mapping).length,files:files.length};
  await writeFile(path.join(output, 'native-artwork-report.json'), JSON.stringify(report,null,2));
  return { publicDir: output, mapping, report };
}
