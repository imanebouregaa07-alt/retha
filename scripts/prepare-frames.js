import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const sourceDir = 'c:/Users/Utilisateur/Downloads/ezgif-3a7c579a88ba59a0-png-split';
const targetDir = path.resolve('public/frames');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function processFrames() {
  console.log('Reading source files...');
  const files = fs.readdirSync(sourceDir)
    .filter(f => f.endsWith('.png'))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      return numA - numB;
    });

  console.log(`Found ${files.length} frames.`);

  const manifest = [];
  const startTime = Date.now();

  // Process in batches of 10 for speed and low memory
  const batchSize = 10;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(batch.map(async (file, idx) => {
      const globalIdx = i + idx;
      const srcPath = path.join(sourceDir, file);
      const outFileName = `frame_${String(globalIdx).padStart(3, '0')}.webp`;
      const outPath = path.join(targetDir, outFileName);

      manifest[globalIdx] = `/frames/${outFileName}`;

      if (!fs.existsSync(outPath)) {
        await sharp(srcPath)
          .webp({ quality: 80, effort: 4 })
          .toFile(outPath);
      }
    }));
    process.stdout.write(`\rProcessed ${Math.min(i + batchSize, files.length)} / ${files.length} frames...`);
  }

  // Also write manifest
  fs.writeFileSync(
    path.join(targetDir, 'manifest.json'),
    JSON.stringify({
      totalFrames: files.length,
      fps: 30,
      frames: manifest
    }, null, 2)
  );

  console.log(`\nDone in ${((Date.now() - startTime) / 1000).toFixed(1)}s!`);
}

processFrames().catch(err => {
  console.error('Error processing frames:', err);
  process.exit(1);
});
