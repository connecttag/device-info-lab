import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
let count = 0;
function visit(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (path.endsWith('.js')) {
            execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
            const source = readFileSync(path, 'utf8');
            for (const match of source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
                if (!existsSync(resolve(dirname(path), match[1]))) throw new Error(`Missing import: ${path}: ${match[1]}`);
            }
            count++;
        }
    }
}
for (const folder of ['src', 'public', 'tests', 'scripts']) visit(join(root, folder));
JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'));
for (const sheet of ['styles.css', 'visit.css', 'fonts.css']) {
    for (const match of readFileSync(join(root, 'public', sheet), 'utf8').matchAll(/url\(["']?(\/[^"')]+)["']?\)/g)) {
        if (!existsSync(join(root, 'public', match[1].slice(1)))) throw new Error(`Missing stylesheet asset: ${match[1]}`);
    }
}
console.log(`Source syntax, local imports and JSON checked: ${count} JavaScript files.`);
