import fs from 'node:fs';
import {Buffer} from 'node:buffer';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {ProjectPaletteSchema} from '../src/schemas/project-palette.ts';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {applyProjectPalette, resolveProjectPalette} from '../src/styles/project-palette.ts';
import {contrastRatio, contrastInk} from '../src/styles/colors.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {recipeAppearance, captionTokensAtFrame} from '../src/shots/appearance.ts';
import {SHOT_CATALOG} from '../src/shots/catalog.ts';
import {validateAssets} from '../scripts/validate-assets.mjs';
import {resolveProductionLock} from '../scripts/lib/production-lock.mjs';
import {storyboardApprovalFingerprint, assertStoryboardApproval} from '../scripts/lib/storyboard-approval.mjs';
import {samplePalette} from '../scripts/sample-palette.mjs';
import {initProject} from '../scripts/init-project.mjs';
import {normalizeSelection, createExports} from '../library/selection.mjs';
import {buildLibraryCatalog} from '../scripts/lib/library-catalog.mjs';

const read = id => JSON.parse(fs.readFileSync(`examples/shot-recipes/${id}/storyboard.json`, 'utf8'));
const palette = (accent = '#2563eb') => ({schemaVersion: '1.0', source: 'custom', referenceAssets: [], colors: {accent, accentAlt: accent, lightBackground: '#f4f6f8', darkBackground: '#151a22', surface: '#ffffff'}});
fs.mkdirSync('.tmp/project-palette-tests', {recursive: true});
function project() {
  const dir = fs.mkdtempSync(path.resolve('.tmp/project-palette-tests/case-'));
  const board = read('paper-title'); delete board.videoTemplate;
  board.palette = {...palette(), source: 'assets', referenceAssets: ['product']};
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets/product.ppm'), Buffer.concat([Buffer.from('P6\n16 16\n255\n'), Buffer.from(Array.from({length: 256}, () => [37, 99, 235]).flat())]));
  const manifest = {schemaVersion: '1.0', assets: [{id: 'product', path: 'assets/product.ppm', type: 'image', usage: 'palette-reference', source: 'FrameLoom test pixels', license: 'MIT', intendedUse: 'Color reference only'}]};
  const input = {schemaVersion: '1.0', inputMode: 'document', colorMode: 'source'};
  const save = () => {
    for (const [name, value] of [['storyboard.json', board], ['asset-manifest.json', manifest], ['project-input.json', input]]) fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
  };
  save(); return {dir, board, manifest, input, save};
}

describe('project palette contract and rendering', () => {
  it('keeps accent foreground readable even on middle-gray brand colors', () => {
    for (let value = 0; value <= 255; value++) {
      const color = `#${value.toString(16).padStart(2, '0').repeat(3)}`;
      expect(contrastRatio(contrastInk(color), color)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('rejects invalid colors, nonneutral stages, empty or duplicate asset references and legacy combinations', () => {
    const bad = palette(); bad.colors.accent = 'red'; expect(ProjectPaletteSchema.safeParse(bad).success).toBe(false);
    bad.colors.accent = '#ff0000'; bad.colors.lightBackground = '#ff0000'; expect(ProjectPaletteSchema.safeParse(bad).success).toBe(false);
    expect(ProjectPaletteSchema.safeParse({...palette(), source: 'assets'}).success).toBe(false);
    expect(ProjectPaletteSchema.safeParse({...palette(), source: 'assets', referenceAssets: ['a', 'a']}).success).toBe(false);
    const board = read('paper-title'); board.palette = palette();
    expect(StoryboardSchema.safeParse(board).success).toBe(true);
    board.schemaVersion = '2.3'; expect(StoryboardSchema.safeParse(board).success).toBe(false);
    board.schemaVersion = '2.4'; board.scenes[0].shot.version = '1.1.0'; expect(StoryboardSchema.safeParse(board).success).toBe(false);
    board.scenes[0].shot.version = '1.2.0'; board.project.width = 1080; board.project.height = 1920; expect(StoryboardSchema.safeParse(board).success).toBe(false);
  });

  it('preserves unselected tokens, font, motion and geometry while keeping all current recipe/style combinations readable', () => {
    for (const id of ['retro-zine', 'archive-grid', 'scatterbrain', 'signal', 'signal-noir', 'studio-frame']) {
      const style = JSON.parse(fs.readFileSync(`styles/${id}/style.json`, 'utf8'));
      const motion = JSON.parse(fs.readFileSync(`styles/${id}/motion.json`, 'utf8'));
      const base = createStyleTokens(style, motion, 1920, 1080);
      expect(applyProjectPalette(base)).toBe(base);
      for (const accent of ['#2563eb', '#facc15', '#111111']) {
        const chosen = applyProjectPalette(base, palette(accent));
        expect(chosen.accent).toBe(accent); expect(chosen.displayFont).toBe(base.displayFont);
        expect(chosen.motion).toEqual(base.motion); expect(chosen.safeArea).toEqual(base.safeArea);
        expect(contrastRatio(chosen.onAccent, accent)).toBeGreaterThanOrEqual(4.5);
        for (const shot of SHOT_CATALOG) {
          const scene = read(shot.id).scenes[0];
          const before = JSON.stringify(scene);
          const appearance = recipeAppearance(scene.shot, chosen);
          expect(appearance.tokens.accent).toBe(accent);
          expect(contrastRatio(appearance.stageInk, appearance.background)).toBeGreaterThanOrEqual(7);
          expect(contrastRatio(appearance.stageMuted, appearance.background)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(appearance.tokens.captionInk, appearance.background)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(appearance.tokens.ink, appearance.tokens.paper)).toBeGreaterThanOrEqual(7);
          expect(contrastRatio(appearance.tokens.paperAccent, appearance.tokens.paper)).toBeGreaterThanOrEqual(4.5);
          if (!['semantic-default', 'compare-reveal', 'network-expand'].includes(shot.id)) expect(contrastRatio(appearance.tokens.accentAlt, appearance.tokens.paper)).toBeGreaterThanOrEqual(4.5);
          expect(JSON.stringify(scene)).toBe(before);
        }
      }
    }
  });

  it('changes external subtitle colors on light/dark scene boundaries and backward seeks', () => {
    const board = read('paper-title'); delete board.videoTemplate;
    board.palette = palette(); board.scenes.push(read('card-stack').scenes[0]);
    const style = JSON.parse(fs.readFileSync('styles/retro-zine/style.json', 'utf8'));
    const motion = JSON.parse(fs.readFileSync('styles/retro-zine/motion.json', 'utf8'));
    const tokens = createStyleTokens(style, motion, 1920, 1080, undefined, board.palette);
    const boundary = board.scenes[0].durationFrames;
    expect(captionTokensAtFrame(board, boundary, tokens).captionInk).toBe('#ffffff');
    expect(captionTokensAtFrame(board, 0, tokens).captionInk).toBe('#334155');
    expect(resolveProjectPalette(board.palette, true).captionInk).not.toBe(resolveProjectPalette(board.palette, true).ink);
  });
});

describe('palette source lifecycle', () => {
  it('permits reference-only images in a document without inventing a media scene and enforces source policy', () => {
    const p = project(); const file = path.join(p.dir, 'storyboard.json');
    expect(validateAssets(file)).toEqual([]);
    p.manifest.assets[0].usage = 'scene-media'; p.save(); expect(validateAssets(file).join(' ')).toMatch(/配色参考|不能使用/);
    p.manifest.assets[0].usage = 'palette-reference'; delete p.board.palette; p.save(); expect(validateAssets(file).join(' ')).toMatch(/静默回退/);
    p.input.colorMode = 'auto'; p.save(); expect(validateAssets(file).join(' ')).toMatch(/colorFallbackReason/);
    p.input.colorFallbackReason = '截图为引用证据，无法确认主体品牌。'; p.save(); expect(validateAssets(file)).toEqual([]);
    p.board.palette = palette(); p.input.colorMode = 'style'; p.save(); expect(validateAssets(file).join(' ')).toMatch(/不能同时启用/);
  });

  it('fails missing source files and binds adopted colors, resolved colors and reference bytes to locks and approval', () => {
    const p = project();
    const first = resolveProductionLock(p.board, undefined, p.dir).lock;
    expect(first.palette.resolved.light.accent).toBe('#2563eb');
    expect(first.palette.sources[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    const fingerprint = storyboardApprovalFingerprint(p.dir);
    fs.writeFileSync(path.join(p.dir, 'storyboard-approval.json'), JSON.stringify({reviewer: 'fixture', notes: 'approved fixture', fingerprint}));
    expect(() => assertStoryboardApproval(p.dir)).not.toThrow();
    p.input.colorMode = 'auto'; p.save();
    expect(storyboardApprovalFingerprint(p.dir)).not.toBe(fingerprint);
    p.input.colorMode = 'source'; p.save();
    expect(() => assertStoryboardApproval(p.dir)).not.toThrow();
    fs.appendFileSync(path.join(p.dir, 'assets/product.ppm'), Buffer.from([0]));
    expect(resolveProductionLock(p.board, undefined, p.dir).lock.hash).not.toBe(first.hash);
    expect(() => assertStoryboardApproval(p.dir)).toThrow(/变化/);
    p.board.palette.colors.accent = '#facc15'; p.save();
    expect(resolveProductionLock(p.board, undefined, p.dir).lock.palette.resolved.light.onAccent).toBe('#111827');
    p.board.palette.referenceAssets = ['missing']; p.save();
    expect(validateAssets(path.join(p.dir, 'storyboard.json')).join(' ')).toMatch(/未登记|已登记/);
  });

  it('samples a named image region reproducibly without changing the source or adopting colors', () => {
    const p = project(); const before = fs.readFileSync(path.join(p.dir, 'assets/product.ppm'));
    const sampled = samplePalette(p.dir, 'product', [0, 0, 16, 16]);
    expect(sampled.candidates[0]).toEqual({color: '#2563eb', coverage: 1});
    expect(samplePalette(p.dir, 'product', [0, 0, 16, 16])).toEqual(sampled);
    expect(fs.readFileSync(path.join(p.dir, 'assets/product.ppm'))).toEqual(before);
    expect(() => samplePalette(p.dir, 'product', [15, 0, 16, 16])).toThrow(/边界/);
    expect(() => samplePalette(p.dir, 'product', [0, 0, 0, 16])).toThrow(/region/);
  });

  it('persists CLI intent and exports independent library choices without source paths', () => {
    const dir = initProject(['--slug', 'palette-cli', '--shots', 'paper-title', '--color-mode', 'source', '--projects-dir', path.resolve('.tmp/project-palette-tests')]);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'project-input.json'), 'utf8')).colorMode).toBe('source');
    const catalog = buildLibraryCatalog();
    for (const colorMode of ['auto', 'style', 'source']) {
      const state = normalizeSelection(catalog, {style: 'scatterbrain', canvas: 'landscape', selected: ['paper-title'], font: 'source-han-serif-sc', fontMode: 'manual', production: {colorMode}});
      expect(normalizeSelection(catalog, JSON.parse(JSON.stringify(state)))).toEqual(state);
      expect(createExports(catalog, state).prompt).toContain(`--color-mode ${colorMode}`);
      expect(createExports(catalog, state).prompt).toContain('全片字体：source-han-serif-sc');
    }
    expect(() => createExports(catalog, {style: 'signal', canvas: 'portrait', selected: ['semantic-default'], production: {colorMode: 'source'}})).toThrow(/横屏/);
    expect(() => createExports(catalog, {style: 'signal', selected: ['paper-title'], production: {colorMode: 'stale'}})).toThrow(/失效/);
  });
});
