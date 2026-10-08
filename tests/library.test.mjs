/* global fetch */
import fs from 'node:fs';
import path from 'node:path';
import {URL} from 'node:url';
import {afterAll, describe, expect, it} from 'vitest';
import {buildLibraryCatalog, libraryFixtures, previewFingerprint} from '../scripts/lib/library-catalog.mjs';
import {createLibraryServer} from '../scripts/serve-library.mjs';
import {buildLibrary, assertLibraryPreviews} from '../scripts/build-library.mjs';
import {compatible, normalizeSelection, createExports} from '../library/selection.mjs';
import {recipeDisplayText, previewStatusText} from '../library/presentation.mjs';
import {styleCardInfo} from '../library/style-cards.mjs';
import {portableRecipe} from '../library/recipe-copy.mjs';
import {recipeOverview, recipeSections} from '../library/detail.mjs';
import {initProject} from '../scripts/init-project.mjs';
import {projectRoot} from '../scripts/lib/style-catalog.mjs';
import {publicTtsPresets} from '../scripts/lib/library-tts-catalog.mjs';

const catalog = {...buildLibraryCatalog(), ttsPresets: publicTtsPresets()};
const defaultProduction = {goal: 'narrated', audio: 'tts', ttsPreset: 'configured', review: false};
fs.mkdirSync(path.join(projectRoot, '.tmp'), {recursive: true});
const directory = fs.mkdtempSync(path.join(projectRoot, '.tmp/library-test-'));
const output = buildLibrary(path.join(directory, 'site'));
const server = createLibraryServer(output);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
afterAll(async () => {await new Promise(resolve => server.close(resolve));});

describe('local library capabilities and selection', () => {
  it('joins actual catalog entries and public fixtures without counting hosted actions as scenes', () => {
    expect(catalog.styles).toHaveLength(6);
    expect(catalog.recipes.filter(item => item.kind === 'scene')).toHaveLength(37);
    expect(catalog.recipes.filter(item => item.kind === 'hosted-action')).toHaveLength(9);
    expect(catalog.recipes.filter(item => item.kind === 'cross-scene-transition')).toHaveLength(5);
    for (const fixture of libraryFixtures()) expect(fs.existsSync(path.join(projectRoot, fixture.source))).toBe(true);
    for (const recipe of catalog.recipes) {
      expect(recipe.name).toBeTruthy(); expect(recipe.recipe).toBeTruthy();
      if (recipe.posterSource) expect(recipe.posterSource).toBe(`library/previews/${recipe.id}.png`);
      else expect(['stale', 'missing']).toContain(recipe.previewStatus);
    }
  });
  it('filters all style and orientation combinations using manifest compatibility', () => {
    for (const style of catalog.styles) for (const canvas of ['landscape', 'portrait']) {
      const recipes = catalog.recipes.filter(item => compatible(item, style.id, canvas));
      expect(recipes).toHaveLength(canvas === 'landscape' ? 37 : 1);
      expect(recipes.some(item => item.id === 'semantic-default')).toBe(true);
    }
  });
  it('restores only unique, current and compatible selected scene recipes', () => {
    expect(normalizeSelection(catalog, {style: 'signal', canvas: 'portrait', selected: ['semantic-default', 'paper-title', 'missing', 'marker-underline', 'semantic-default']}))
      .toEqual({style: 'signal', font: 'source-han-sans-sc', fontMode: 'recommended', canvas: 'portrait', selected: ['semantic-default'], production: defaultProduction});
  });
  it('exports a chosen pool without adding a fallback or forcing every recipe into the video', () => {
    const value = createExports(catalog, {style: 'retro-zine', canvas: 'landscape', selected: ['paper-title', 'concept-matrix']});
    expect(value.prompt).toContain('在对话中提供的文档'); expect(value.prompt).toContain('可重复、调整顺序或只用其中一部分');
    expect(value.prompt).toContain('视频风格：retro-zine\n');
    expect(value.prompt).toContain('可用镜头配方：paper-title、concept-matrix\n');
    expect(value.prompt).not.toMatch(/@\d+\.\d+\.\d+|Storyboard \d+\.\d+/u); expect(value.prompt).not.toContain('semantic-default');
    expect(value).not.toHaveProperty('command');
  });
  it('presents all recipe docs without release numbers and retains technical limits', () => {
    for (const recipe of catalog.recipes) {
      const text = recipeDisplayText(recipe.recipe);
      expect(text).not.toMatch(/\d+\.\d+\.\d+/u);
      expect(text).not.toContain('版本与验证边界');
      expect(recipeDisplayText(JSON.stringify(recipe.provenance))).not.toMatch(/\d+\.\d+\.\d+/u);
      if (recipe.recipe.includes('真实TTS与竖屏须另行验收')) expect(text).toContain('真实TTS与竖屏须另行验收');
    }
    expect(recipeDisplayText('版本 1.2.0，仅 retro-zine@1.0.0；scale=1.28→1；0.2–0.8 秒')).toBe('仅 retro-zine；scale=1.28→1；0.2–0.8 秒');
  });
  it('uses the CLI contract to create the exact selected 2.4 pool', () => {
    const chosen = ['paper-title', 'concept-matrix'];
    const target = initProject(['--slug', 'library-proof', '--style', 'retro-zine', '--shots', chosen.join(','), '--canvas', 'landscape', '--input-mode', 'document', '--projects-dir', path.join(directory, 'projects')]);
    const draft = JSON.parse(fs.readFileSync(path.join(target, 'storyboard.draft.json'), 'utf8'));
    expect(draft.schemaVersion).toBe('2.4'); expect(draft.shotRecipes.map(item => item.id)).toEqual(chosen); expect(draft.scenes).toEqual([]);
  });
  it('produces review and real-TTS instructions without claiming approval or configured credentials', () => {
    const value = createExports(catalog, {style: 'retro-zine', canvas: 'landscape', selected: ['paper-title'], production: {...defaultProduction, review: true}});
    expect(value.prompt).toContain('等我审核后再渲染'); expect(value.prompt).toContain('无可用配置时说明缺口'); expect(value.prompt).not.toContain('approve:delivery');
    expect(value).toMatchObject({purpose: 'in-project-video', audioMode: 'tts', mode: 'review'});
  });
  it.each([[], ['missing'], ['marker-underline'], ['blinds-wipe'], ['paper-title', 'paper-title']])('refuses empty, unregistered, hosted or duplicate pools: %j', selected => {
    expect(() => createExports(catalog, {style: 'retro-zine', canvas: 'landscape', selected})).toThrow();
  });
  it.each([{goal:'unknown'}, {audio:'auto'}, {ttsPreset:'missing'}, {review:'true'}, {ttsPreset:'$(touch foo)'}])('rejects invalid production choices: %j', production => {
    expect(() => createExports(catalog, {style: 'retro-zine', canvas: 'landscape', selected: ['paper-title'], production})).toThrow();
  });
  it.each(['doubao', 'openai', 'elevenlabs', 'aliyun'])('exports the selected public TTS preset %s precisely without claiming it is enabled', id => {
    const preset = catalog.ttsPresets.find(item=>item.id === id);
    const value = createExports(catalog, {style:'retro-zine', canvas:'landscape', selected:['paper-title'], production:{...defaultProduction,ttsPreset:id}});
    expect(value.prompt).toContain(`provider=${preset.provider}`);
    if(preset.model)expect(value.prompt).toContain(`model=${preset.model}`);
    if(preset.voice)expect(value.prompt).toContain(`voiceType=${preset.voice}`);
    else expect(value.prompt).toContain('音色使用本地配置解析的音色');
    expect(value.prompt).toContain('若未启用或参数不匹配');expect(value.prompt).toContain('--tts-config');
    expect(value.prompt).toContain('不自动换服务、模型或音色');
  });
  it('uses an external narration route without retaining an inactive TTS preset in the instructions', () => {
    const value = createExports(catalog, {style:'retro-zine',canvas:'landscape',selected:['paper-title'],production:{...defaultProduction,audio:'external',ttsPreset:'openai'}});
    expect(value).toMatchObject({purpose:'in-project-video',audioMode:'external'});
    expect(value.prompt).toContain('尚未提供时请我提供音频');expect(value.prompt).not.toContain('provider=openai');
  });
  it('exports a clean silent master and handoff script even when a voice option was previously chosen', () => {
    const value = createExports(catalog, {style:'retro-zine',canvas:'landscape',selected:['paper-title'],production:{...defaultProduction,goal:'master',ttsPreset:'aliyun'}});
    expect(value).toMatchObject({purpose:'visual-master',audioMode:'silent'});
    expect(value.prompt).toContain('无旁白字幕和审片标记');expect(value.prompt).toContain('逐镜时间表');expect(value.prompt).not.toContain('provider=aliyun');
  });
  it('restores public workflow preferences and safely resets stale options from local storage', () => {
    const selection={style:'retro-zine',canvas:'landscape',selected:['paper-title'],production:{goal:'master',audio:'external',ttsPreset:'elevenlabs',review:true}};
    expect(normalizeSelection(catalog,selection).production).toEqual(selection.production);
    expect(normalizeSelection(catalog,{...selection,production:{goal:'unknown',audio:'invalid',ttsPreset:'stale',review:'true'}}).production).toEqual(defaultProduction);
  });
  it('publishes only allowlisted TTS example metadata, never credentials, local profiles or availability', async () => {
    const data=await (await fetch(`${base}/catalog.json`)).json();
    expect(data.ttsPresets).toEqual(catalog.ttsPresets);expect(data.ttsPresets).toHaveLength(4);
    for(const preset of data.ttsPresets)expect(Object.keys(preset).sort()).toEqual(['id','model','name','provider','voice','voiceFromLocalConfig'].sort());
  });
});
describe('read-only library serving', () => {
  it('serves separate style, shot and export pages with relative navigation', async () => {
    const pages = [
      ['index.html', 'styles', 'id="styles"', ['id="cards"', 'id="prompt"']],
      ['shots.html', 'shots', 'id="cards"', ['id="styles"', 'id="prompt"']],
      ['selection.html', 'selection', 'id="prompt"', ['id="cards"', 'id="styles"']]
    ];
    for (const [file, page, required, absent] of pages) {
      const response = await fetch(`${base}/${file}`);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain(`data-page="${page}"`); expect(html).toContain(required);
      for (const id of absent) expect(html).not.toContain(id);
      for (const link of ['index.html', 'shots.html', 'selection.html']) expect(html).toContain(`href="${link}"`);
    }
  });
  it('loads the page, modules, catalog and media under a GitHub Pages project subpath', async () => {
    buildLibrary(path.join(output, 'frame-loom'));
    const pageUrl = `${base}/frame-loom/`;
    const html = await (await fetch(pageUrl)).text();
    expect(html).toContain('src="app.mjs"'); expect(html).toContain('href="library.css"');
    for (const file of ['shots.html', 'selection.html', 'app.mjs', 'selection.mjs', 'dropdown.mjs', 'presentation.mjs', 'detail.mjs', 'recipe-copy.mjs', 'style-cards.mjs', 'library.css']) expect((await fetch(new URL(file, pageUrl))).status).toBe(200);
    const data = await (await fetch(new URL('catalog.json', pageUrl))).json();
    expect(data.fonts).toHaveLength(5);
    for (const font of data.fonts) {
      for (const face of font.faces) {
        const response = await fetch(new URL(face.file, pageUrl), {method: 'HEAD'});
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe(face.format === 'woff2' ? 'font/woff2' : 'font/ttf');
        expect(Number(response.headers.get('Content-Length'))).toBe(face.bytes);
      }
      const license = await fetch(new URL(font.licenseFile, pageUrl));
      expect(license.status).toBe(200);
      expect(await license.text()).toContain('SIL OPEN FONT LICENSE');
    }
    for (const item of [...data.styles, ...data.recipes, ...data.recipes.flatMap(recipe => [...(recipe.stylePreviews ?? []), ...(recipe.previewVariants ?? []).flatMap(variant => [variant, ...(variant.stylePreviews ?? [])])])]) {
      if (item.poster) {
        expect(item.poster).toMatch(/^media\//u);
        expect((await fetch(new URL(item.poster, pageUrl), {method: 'HEAD'})).status).toBe(200);
      } else expect(['stale', 'missing']).toContain(item.previewStatus);
      if (item.video) expect((await fetch(new URL(item.video, pageUrl), {headers: {Range: 'bytes=0-31'}})).status).toBe(206);
    }
    expect(fs.existsSync(path.join(output, 'frame-loom/.nojekyll'))).toBe(true);
  });
  it('serves a complete generated page with valid local media and no private project files', async () => {
    expect((await fetch(base)).status).toBe(200);
    const data = await (await fetch(`${base}/catalog.json`)).json();
    for (const item of [...data.styles, ...data.recipes, ...data.recipes.flatMap(recipe => [...(recipe.stylePreviews ?? []), ...(recipe.previewVariants ?? []).flatMap(variant => [variant, ...(variant.stylePreviews ?? [])])])]) {
      if (item.poster) expect(fs.existsSync(path.join(output, item.poster))).toBe(true);
      else expect(['stale', 'missing']).toContain(item.previewStatus);
      if (item.video) expect(fs.existsSync(path.join(output, item.video))).toBe(true);
    }
    expect((await fetch(`${base}/projects/private/source.md`)).status).toBe(404);
    expect((await fetch(`${base}/.env`)).status).toBe(403);
    expect((await fetch(`${base}/index.html`, {method: 'POST'})).status).toBe(405);
    expect((await fetch(`${base}/%2e%2e%2fpackage.json`)).status).toBe(403);
  });
  it('supports video seeking, suffix ranges and HEAD; rejects invalid ranges', async () => {
    const data = JSON.parse(fs.readFileSync(path.join(output, 'catalog.json'), 'utf8'));
    const video = data.styles[0].video;
    const response = await fetch(`${base}/${video}`, {headers: {Range: 'bytes=0-99'}});
    expect(response.status).toBe(206); expect((await response.arrayBuffer()).byteLength).toBe(100);
    expect((await fetch(`${base}/${video}`, {headers: {Range: 'bytes=-10'}})).status).toBe(206);
    expect((await fetch(`${base}/${video}`, {headers: {Range: 'bytes=100-0'}})).status).toBe(416);
    const head = await fetch(`${base}/${video}`, {method: 'HEAD'});
    expect(head.status).toBe(200); expect((await head.arrayBuffer()).byteLength).toBe(0);
  });
});

describe('detail guide presentation', () => {
  it('extracts P2 motion without moving input constraints into the animation description', () => {
    const recipe = catalog.recipes.find(item => item.id === 'scroll-brake').recipe;
    const overview = recipeOverview(recipe);
    expect(overview.motion.join(' ')).toContain('刹停时清零');
    expect(overview.motion.join(' ')).not.toContain('不把假条目');
    expect(overview.input.join(' ')).toContain('不把假条目');
    const guide = recipeSections(recipe).flatMap(section => section.lines).join(' ');
    expect(guide).toContain('focusId 必须属于集合');
    expect(guide).toContain('完成态至少 1.2 秒');
  });
  it('surfaces the dedicated motion plan for older recipes and preserves input lists and sound guidance', () => {
    const recipe = catalog.recipes.find(item => item.id === 'card-stack').recipe;
    expect(recipeOverview(recipe).motion.join(' ')).toContain('共享一次 focus');
    expect(recipeOverview(recipe).input.join(' ')).toContain('2–4');
    expect(recipeSections(recipe).find(section => section.title === '声音建议').lines.join(' ')).toContain('运行时默认静音');
    expect(JSON.stringify(recipeSections(recipe))).not.toMatch(/\b\d+\.\d+\.\d+\b/u);
  });
});

describe('Pages publication gate', () => {
  it('rejects missing media for a selected style even when the default sample exists', () => {
    const source = {posterSource: 'library/previews/research-stack.png', videoSource: 'library/previews/research-stack.mp4'};
    const incomplete = {styles: [], recipes: [{id: 'research-stack', ...source, stylePreviews: [{id: 'research-stack--signal', ...source, videoSource: null}]}]};
    expect(() => assertLibraryPreviews(incomplete)).toThrow(/research-stack--signal\/video/u);
  });
  it('refuses missing or stale recipe animations instead of publishing static fallbacks', () => {
    const incomplete = structuredClone(catalog);
    incomplete.recipes.find(item => item.id === 'paper-title').videoSource = null;
    expect(() => assertLibraryPreviews(incomplete)).toThrow(/paper-title\/video/u);
  });
  it('requires public style videos as well as recipe previews', () => {
    const incomplete = structuredClone(catalog);
    incomplete.styles[0].videoSource = null;
    expect(() => assertLibraryPreviews(incomplete)).toThrow(/retro-zine\/video/u);
  });
  it('checks that referenced posters exist and are not just catalog entries', () => {
    const incomplete = structuredClone(catalog);
    incomplete.styles[0].posterSource = 'library/previews/nonexistent.png';
    expect(() => assertLibraryPreviews(incomplete)).toThrow(/retro-zine\/poster/u);
  });
});


describe('portable recipe copying', () => {
  it('exports every registered entry with useful sections and without production schema or versions', () => {
    for (const item of catalog.recipes) {
      const text = portableRecipe(item);
      for (const heading of ['适用内容', '所需输入', '运动顺序', '时长与节拍', '关键参数', '声音建议', '容易做错的地方', '来源与使用边界']) expect(text).toContain(`## ${heading}`);
      expect(text).toContain(`镜头 ID：${item.id}`);
      expect(text).not.toMatch(/slots|visual\.|\b(?:schema|manifest|beats?|focusId|flagged|shotRecipes|renderer|QA|layers)\b|\d+\.\d+\.\d+|\/Users\/|\.\.\//u);
      const source = item.provenance;
      if (source?.repository?.startsWith('https://') && source.recipe) expect(text).toContain(`${source.repository}/blob/${source.commit ?? 'HEAD'}/${source.recipe}`);
      if (source?.repository?.startsWith('https://') && source.implementation) expect(text).toContain(`${source.repository}/blob/${source.commit ?? 'HEAD'}/${source.implementation}`);
    }
  });
  it('preserves real member identities, motion order and timing without a random percentage', () => {
    const text = portableRecipe(catalog.recipes.find(item => item.id === 'member-grid'));
    for (const requirement of ['4–12', '按中心距离分环显影与缩放', '集合完全建立后', '分母只计算实际可见成员', '绝不随机按百分比染色', '至少1.2秒', 'Apache-2.0']) expect(text).toContain(requirement);
  });
  it('keeps chapter and auxiliary methods distinct instead of copying their shared guide boilerplate', () => {
    const get = id => portableRecipe(catalog.recipes.find(item => item.id === id));
    expect(get('page-turn-transitions')).toContain('向两侧打开');
    expect(get('page-turn-transitions')).not.toContain('线条必须');
    expect(get('line-carry-transition')).toContain('已有同名、同语义的标题线');
    expect(get('scan-bracket-sweep')).toContain('扫描线与括角');
    expect(get('scan-bracket-sweep')).not.toContain('冻结窗');
    expect(get('speed-ramp-freeze')).toContain('冻结结束后继续同一条运动轨迹');
    expect(get('mosaic-reframe')).toContain('4–7');
  });
  it('preserves numeric motion parameters, optional sounds and the default scope of a preview variant', () => {
    const item = catalog.recipes.find(item => item.id === 'blur-slide');
    expect(portableRecipe(item)).toContain('y=40→0');
    expect(portableRecipe(item)).toContain('blur=10→0');
    expect(portableRecipe(item)).toContain('低音量软 whoosh');
    expect(portableRecipe({...item, variantId: 'test'})).toContain('配方范围：默认效果');
  });
});


describe('style card capability and preview evidence', () => {
  it('counts compatible scenes for the current canvas, excluding auxiliary actions and chapter transitions', () => {
    const retro = catalog.styles.find(style => style.id === 'retro-zine');
    expect(styleCardInfo(retro, catalog.recipes, 'landscape').count).toBe(37);
    expect(styleCardInfo(retro, catalog.recipes, 'portrait').count).toBe(1);
    expect(styleCardInfo(retro, catalog.recipes, 'portrait').basicOnly).toBe(true);
    for (const style of catalog.styles.filter(style => style.id !== 'retro-zine')) expect(styleCardInfo(style, catalog.recipes, 'landscape').capability).toBe('37 个可用镜头');
  });
  it('publishes readable covers from the same video and color roles from the actual style tokens', async () => {
    const published = await (await fetch(`${base}/catalog.json`)).json();
    for (const style of published.styles) {
      const tokens = JSON.parse(fs.readFileSync(path.join(projectRoot, 'styles', style.id, 'style.json'), 'utf8')).tokens;
      expect(style.displayColors.map(color => color.color)).toEqual([tokens.background, tokens.ink, tokens.accent]);
      expect(style.displayColors.map(color => color.role)).toEqual(['背景','文字','强调']);
      const cover = await fetch(`${base}/${style.poster}`);
      expect(cover.headers.get('Content-Type')).toContain('image/png');
      expect(cover.status).toBe(200);
      expect(style.video).toBe(`media/style-${style.id}.mp4`);
    }
  });
});


describe('recipe preview invalidation', () => {
  it('does not replace stale samples with historical beige fixture images', () => {
    const stale = buildLibraryCatalog({previewManifest: {fingerprint: 'outdated', samples: [{id: 'blur-slide'}]}});
    for (const recipe of stale.recipes) {
      expect(recipe.posterSource).toBeNull(); expect(recipe.videoSource).toBeNull();
      expect(recipe.previewStatus).toBe('stale');
      for (const variant of recipe.previewVariants) {expect(variant.posterSource).toBeNull(); expect(variant.videoSource).toBeNull();}
    }
    expect(() => assertLibraryPreviews(stale)).toThrow(/blur-slide\/poster/u);
  });
  it('does not borrow another recipe image when the manifest is absent', () => {
    const missing = buildLibraryCatalog({previewManifest: null});
    for (const recipe of missing.recipes) {
      expect(recipe.posterSource).toBeNull(); expect(recipe.videoSource).toBeNull(); expect(recipe.previewStatus).toBe('missing');
    }
  });
  it('publishes only completed pairs while an updated render is still in progress', () => {
    const partial = buildLibraryCatalog({previewManifest: {fingerprint: previewFingerprint(), samples: [{id: 'blur-slide'}]}});
    const complete = partial.recipes.find(item => item.id === 'blur-slide');
    expect(complete).toMatchObject({posterSource: 'library/previews/blur-slide.png', videoSource: 'library/previews/blur-slide.mp4', previewStatus: 'ready'});
    expect(partial.recipes.find(item => item.id === 'paper-title')).toMatchObject({posterSource: null, videoSource: null, previewStatus: 'missing'});
    expect(() => assertLibraryPreviews(partial)).toThrow(/paper-title\/poster/u);
    expect(previewStatusText({previewStatus: 'stale'})).toBe('样片待更新');
    expect(previewStatusText({previewStatus: 'missing'})).toBe('样片待生成');
  });
});
