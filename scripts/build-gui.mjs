/**
 * Bundles gui/main.js → src/sketch.js for Bela IDE (p5.js instance mode).
 */
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const entry = path.join(root, 'gui', 'main.js');
const outfile = path.join(root, 'src', 'sketch.js');

const banner = `/* AUTO-GENERATED — edit gui/, run: npm run build:gui */
/**
 * Dub Preamp — Bela GUI (sketch.js)
 *
 * Runs at http://bela.local/gui/  (Bela GUI library, p5.js instance mode).
 *
 * Buffer index convention (Bela → JS, via gGui.sendBuffer):
 *   [0] Float32[58]      — pot values, kAllNamedPots order
 *   [1] Float32[9]       — switch states (0/1)
 *   [2] Float32[3]       — siren: [presetIdx, gate, mod]
 *   [3] Float32[13]      — audio peak levels
 *   [4] Float32[58×4]    — pot mapping [mux,pot,rev,cen]×58
 *   [5] Float32[9×3]     — switch mapping [pin,portB,rev]×9
 *   [6] Float32[N]       — config metadata (mux, routing, ignoredPots)
 *   [7] Float32[64]      — raw MUX grid [mux×16+pot], normalised 0–1 (unmapped discovery)
 */
`;

const footer = `
var sketch = __belaPreampSketch.default || __belaPreampSketch;
new p5(sketch);
`;

async function build(watch) {
    const ctx = await esbuild.context({
        entryPoints: [entry],
        bundle: true,
        format: 'iife',
        globalName: '__belaPreampSketch',
        outfile,
        banner: { js: banner },
        footer: { js: footer },
        target: ['es2017'],
        logLevel: 'info'
    });

    if(watch) {
        await ctx.watch();
        console.log('Watching gui/ …');
    } else {
        await ctx.rebuild();
        await ctx.dispose();
        console.log('Wrote', path.relative(root, outfile));
    }
}

const watch = process.argv.includes('--watch');
build(watch).catch(err => {
    console.error(err);
    process.exit(1);
});
