// Online documentation is maintained separately from the immutable bundled guide.
import fs from 'node:fs';
export const manualChapters = JSON.parse(fs.readFileSync(new URL('./chapters.json', import.meta.url), 'utf8'));
