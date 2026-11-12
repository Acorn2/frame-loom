import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import {z} from 'zod';
import {StoryboardSchema} from '../src/schemas/storyboard';
import {UiLanguageProvider} from '../src/i18n/ui-language';
import {uiText} from '../src/i18n/ui-text';
import {createStyleTokens} from '../src/styles/style-loader';
import {compileStoryboardShots} from '../src/shots/compile-shot';
import {P2Scene} from '../src/shots/p2/P2Scene';
import {DataP1} from '../src/shots/shortlist/DataP1';
import {SemanticScene} from '../src/templates/semantic/SemanticScene';
import {checkTextLayout, estimateTextLines} from '../scripts/lib/text-layout.mjs';

// Local frame/config are fixed here; browser checks exercise the composition root.
vi.mock('remotion', async original => ({
  ...await original(),
  useCurrentFrame: () => 105,
  useVideoConfig: () => ({width: 1920, height: 1080, fps: 30})
}));

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const tokens = createStyleTokens(read('styles/retro-zine/style.json'), read('styles/retro-zine/motion.json'), 1920, 1080);
const fixture = read('examples/shot-recipes/scroll-brake/speed-ramp-freeze.json');
const render = (Component, board, language) => {
  const element = React.createElement(Component, {
    scene: board.scenes[0], tokens, plan: compileStoryboardShots(board)[0],
    showSceneCaptions: true, overlapOutFrames: 0
  });
  return renderToStaticMarkup(language === undefined ? element : React.createElement(UiLanguageProvider, {value: language}, element));
};

describe('rendered UI language', () => {
  it.each(['2.1', '2.2', '2.3', '2.4'])('accepts only explicit zh/en in storyboard %s and keeps omission absent', schemaVersion => {
    const base = schemaVersion === '2.4' ? structuredClone(fixture) : read('examples/article-video/storyboard.json');
    base.schemaVersion = schemaVersion;
    for (const language of ['zh', 'en']) expect(StoryboardSchema.parse({...base, project: {...base.project, language}}).project.language).toBe(language);
    expect(StoryboardSchema.parse(base).project).not.toHaveProperty('language');
    for (const language of ['fr', 'EN', '', null]) expect(StoryboardSchema.safeParse({...base, project: {...base.project, language}}).success).toBe(false);
  });

  it('publishes a valid generated schema matching the runtime language contract', () => {
    const published = read('schemas/storyboard.schema.json');
    expect(published.properties.project).toEqual(z.toJSONSchema(StoryboardSchema).properties.project);
    expect(published.properties.project.required).not.toContain('language');
  });

  it('keeps historical Chinese chrome and all authored content intact', () => {
    const board = structuredClone(fixture);
    board.scenes[0].title = 'Keep 中文 title';
    board.scenes[0].layers[0].label = '作者标签';
    board.scenes[0].visual.source = '中文来源.md';
    const before = structuredClone(board);
    const legacy = render(P2Scene, board);
    expect(render(P2Scene, board, 'zh')).toBe(legacy);
    expect(legacy).toContain('停留复核');
    const english = render(P2Scene, board, 'en');
    expect(english).toContain('Source: ');
    expect(english).not.toContain('停留复核');
    for (const text of ['Keep 中文 title', '作者标签', '中文来源.md']) expect(english).toContain(text);
    expect(board).toEqual(before);
  });

  it('keeps the English freeze annotation inside its narrow margin', () => {
    const markup = render(P2Scene, fixture, 'en');
    const label = markup.match(/<text x="18" y="211"[^>]*>([^<]+)<\/text>/)?.[1];
    expect(label).toBeTruthy();
    // The focus outline begins at x=113; leave 8 units between it and the label.
    expect(estimateTextLines(label, 16, 113 - 18 - 8)).toBe(1);
  });

  it('localizes data notes and semantic badges without rewriting their inputs', () => {
    const timeline = read('examples/shot-recipes/timeline-travel/storyboard.json');
    expect(render(DataP1, timeline, 'en')).toContain(uiText('en').timelineNote('source.md'));
    expect(render(DataP1, timeline)).toBe(render(DataP1, timeline, 'zh'));
    const semantic = read('examples/semantic-visuals/storyboard.json');
    semantic.scenes = [semantic.scenes.find(scene => scene.visual.kind === 'compare')];
    // Semantic 2.3 does not require a compiled 2.4 plan.
    const scene = React.createElement(SemanticScene, {scene: semantic.scenes[0], tokens, showSceneCaptions: false, overlapOutFrames: 0});
    const markup = renderToStaticMarkup(React.createElement(UiLanguageProvider, {value: 'en'}, scene));
    expect(markup).toContain('Compare');
    expect(markup).toContain('Diagram');
    expect(markup).not.toContain('示意图');
    expect(markup).toContain(semantic.scenes[0].title);
  });

  it('checks the actual localized source note rather than its shorter Chinese counterpart', () => {
    const board = read('examples/shot-recipes/timeline-travel/storyboard.json');
    board.scenes[0].visual.source = 'https://example.com/report-report-report-report-report-repor';
    expect(checkTextLayout(board)).toEqual([]);
    board.project.language = 'en';
    expect(checkTextLayout(board)).toContainEqual(expect.objectContaining({target: 'source', severity: 'error'}));
  });
});
