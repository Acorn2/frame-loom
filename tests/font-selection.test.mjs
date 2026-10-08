import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {FONT_CATALOG, recommendedFont, resolveFont} from '../src/fonts/catalog.ts';
import {verifyAllFonts, verifyFontAssets, fontAssetFiles} from '../src/fonts/assets.ts';
import {FontRefSchema} from '../src/schemas/font.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {validateStoryboard} from '../src/validation/storyboard-validator.ts';
import {buildLibraryCatalog} from '../scripts/lib/library-catalog.mjs';
import {normalizeSelection, createExports} from '../library/selection.mjs';
import {initProject} from '../scripts/init-project.mjs';
import {resolveProductionLock} from '../scripts/lib/production-lock.mjs';
import {storyboardApprovalFingerprint} from '../scripts/lib/storyboard-approval.mjs';
import {projectRoot} from '../scripts/lib/style-catalog.mjs';

const catalog = buildLibraryCatalog();
const read = file => JSON.parse(fs.readFileSync(path.join(projectRoot, file), 'utf8'));
const ref = font => ({id: font.id, version: font.version});
fs.mkdirSync(path.join(projectRoot, '.tmp'), {recursive: true});
const directory = fs.mkdtempSync(path.join(projectRoot, '.tmp/font-test-'));

describe('project font selection and rendering contract', () => {
  it('ships original font files with matching licenses and pinned byte fingerprints', () => {
    expect(verifyAllFonts()).toHaveLength(5);
    for (const font of FONT_CATALOG) {
      expect(font.license).toBe('SIL-OFL-1.1');
      expect(font.faces.every(face => face.download.startsWith('https://'))).toBe(true);
      expect(fontAssetFiles(ref(font)).length).toBe(font.faces.length + 2);
    }
  });
  it('keeps a manual choice across style and canvas switches, and follows recommendations on reset', () => {
    const initial = normalizeSelection(catalog, {style: 'scatterbrain', selected: ['paper-title']});
    expect(initial).toMatchObject({font: 'lxgw-wenkai', fontMode: 'recommended'});
    const manual = normalizeSelection(catalog, {...initial, font: 'source-han-serif-sc', fontMode: 'manual'});
    const switched = normalizeSelection(catalog, {...manual, style: 'signal', canvas: 'portrait'});
    expect(switched).toMatchObject({font: manual.font, fontMode: 'manual', selected: []});
    expect(normalizeSelection(catalog, {...switched, fontMode: 'recommended'})).toMatchObject({font: 'source-han-sans-sc', fontMode: 'recommended'});
    expect(normalizeSelection(catalog, {...switched, font: 'retired-font'}).font).toBe('source-han-sans-sc');
  });
  it('exports and initializes exactly one chosen family independently of the style and shot pool', () => {
    for (const font of FONT_CATALOG) {
      const state = normalizeSelection(catalog, {style: 'scatterbrain', font: font.id, fontMode: 'manual', selected: ['paper-title']});
      expect(createExports(catalog, state).prompt).toContain(`--font ${font.id}`);
      expect(FontRefSchema.safeParse(ref(font)).success).toBe(true);
      expect(normalizeSelection(catalog, {...state, style: 'signal'}).font).toBe(font.id);
      expect(() => createExports(catalog, {...state, font: ['lxgw-wenkai', 'source-han-sans-sc']})).toThrow('字体');
      const target = initProject([`font-proof-${font.id}`, '--style', state.style, '--font', state.font, '--shots', 'paper-title', '--projects-dir', directory]);
      const storyboard = JSON.parse(fs.readFileSync(path.join(target, 'storyboard.draft.json'), 'utf8'));
      expect(storyboard.font).toEqual(ref(font));
      const production = {...read('examples/shot-recipes/paper-title/storyboard.json'), font: ref(font)};
      expect(resolveProductionLock(production).lock.font).toMatchObject(ref(font));
    }
    expect(() => initProject(['invalid-font', '--font', 'retired', '--projects-dir', directory])).toThrow('未知字体');
    expect(fs.existsSync(path.join(directory, 'invalid-font'))).toBe(false);
  });
  it('uses one family for both display and body in all six styles and retains original fonts without a selection', () => {
    for (const style of catalog.styles) {
      const pack = read(`styles/${style.id}/style.json`), motion = read(`styles/${style.id}/motion.json`);
      const original = createStyleTokens(pack, motion, 1920, 1080);
      expect(original.displayFont).toBe(pack.tokens.displayFont);
      expect(original.bodyFont).toBe(pack.tokens.bodyFont);
      expect(original.font).toBeUndefined();
      for (const font of FONT_CATALOG) {
        const tokens = createStyleTokens(pack, motion, 1920, 1080, ref(font));
        expect(tokens.displayFont).toBe(`"${font.family}"`);
        expect(tokens.bodyFont).toBe(tokens.displayFont);
      }
    }
  });
  it('rejects unknown IDs, multiple families and mismatched versions before rendering', () => {
    expect(FontRefSchema.safeParse({id: 'unknown', version: '1.0'}).success).toBe(false);
    expect(FontRefSchema.safeParse([ref(FONT_CATALOG[0])]).success).toBe(false);
    expect(() => resolveFont({...ref(FONT_CATALOG[0]), version: '999.0'})).toThrow('版本');
    const board = read('examples/font-selection/storyboard.json');
    board.font = {...ref(FONT_CATALOG[0]), version: '999.0'};
    expect(validateStoryboard(board, {executionMode: 'fast'}).some(issue => issue.path === 'font' && issue.severity === 'error')).toBe(true);
    delete board.font;
    expect(validateStoryboard(board, {executionMode: 'fast'}).filter(issue => issue.severity === 'error')).toEqual([]);
  });
  it('refuses missing or modified project font bytes instead of choosing a system fallback', () => {
    const font = FONT_CATALOG[0];
    const root = path.join(directory, 'missing');
    expect(() => verifyFontAssets(ref(font), root)).toThrow('缺少');
    const license = path.join(root, 'public', font.licenseFile);
    fs.mkdirSync(path.dirname(license), {recursive: true});
    fs.copyFileSync(path.join(projectRoot, 'public', font.licenseFile), license);
    const file = path.join(root, 'public', font.faces[0].file);
    fs.writeFileSync(file, 'invalid font');
    expect(() => verifyFontAssets(ref(font), root)).toThrow('校验失败');
  });
  it('binds font changes to the production lock and existing 2.3 review fingerprints', () => {
    const board = read('examples/shot-recipes/paper-title/storyboard.json');
    board.font = recommendedFont('retro-zine');
    const first = resolveProductionLock(board).lock;
    expect(first.font).toMatchObject(board.font);
    expect(first.font.faces[0].sha256).toHaveLength(64);
    board.font = recommendedFont('scatterbrain');
    expect(resolveProductionLock(board).lock.hash).not.toBe(first.hash);
    const legacy = read('examples/font-selection/storyboard.json');
    legacy.font = ref(FONT_CATALOG[0]);
    const project = path.join(directory, 'approval'); fs.mkdirSync(project);
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(legacy));
    const before = storyboardApprovalFingerprint(project);
    legacy.font = ref(FONT_CATALOG[1]); fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(legacy));
    expect(storyboardApprovalFingerprint(project)).not.toBe(before);
  });
});
