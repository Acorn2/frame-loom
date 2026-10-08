import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {StoryboardSchema} from '../src/schemas/storyboard';
import {createStyleTokens} from '../src/styles/style-loader';
import {StyleStatement} from '../src/templates/semantic/StyleStatement';
import {StyleSequence} from '../src/templates/semantic/StyleSequence';
import {checkTextLayout} from '../scripts/lib/text-layout.mjs';
import {migrateStoryboard} from '../scripts/migrate-storyboard.mjs';
import source from '../examples/template-families/storyboard.semantic.json' with {type: 'json'};

const ids = ['retro-zine', 'archive-grid', 'scatterbrain', 'signal', 'signal-noir', 'studio-frame'];
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
describe('six style languages on shared semantic inputs', () => {
  it.each(ids)('%s preserves content and explicit connections when rendering and seeking', id => {
    const board = StoryboardSchema.parse(source);
    const before = JSON.stringify(board);
    const tokens = createStyleTokens(json(`styles/${id}/style.json`), json(`styles/${id}/motion.json`), 1920, 1080);
    const statement = board.scenes[0];
    const sequence = board.scenes.find(scene => scene.visual?.kind === 'sequence');
    const base = {tokens, scale: 1, width: 1700, height: 800, portrait: false};
    const title = renderToStaticMarkup(React.createElement(StyleStatement, {...base, scene: statement, frame: 200, titleProgress: 1}));
    expect(title).toContain(statement.title);
    for (const layer of statement.layers) expect(title).toContain(layer.label ?? layer.text ?? '');
    const at = frame => renderToStaticMarkup(React.createElement(StyleSequence, {...base, scene: sequence, frame}));
    const complete = at(200);
    for (const layer of sequence.layers) {
      expect(complete).toContain(layer.label);
      expect(complete).toContain(layer.text);
    }
    expect((complete.match(/<path /g) ?? []).length).toBe(sequence.connections.length);
    const initial = at(0);
    expect(initial).not.toBe(complete);
    expect(at(200)).toBe(complete);
    expect(at(0)).toBe(initial);
    const disconnected = {...sequence, connections: []};
    expect(renderToStaticMarkup(React.createElement(StyleSequence, {...base, scene: disconnected, frame: 200}))).not.toContain('<path ');
    expect(JSON.stringify(board)).toBe(before);
  });

  it.each(ids)('%s accepts the same horizontal and vertical 2.4 inputs but rejects unreadable titles', id => {
    const {storyboard} = migrateStoryboard(source);
    storyboard.style.id = id;
    for (const [width, height] of [[1920, 1080], [1080, 1920]]) {
      storyboard.project.width = width;
      storyboard.project.height = height;
      expect(checkTextLayout(storyboard).filter(issue => issue.severity === 'error')).toEqual([]);
      const invalid = structuredClone(storyboard);
      invalid.scenes[0].title = '需要拆分的长标题'.repeat(50);
      expect(checkTextLayout(invalid).some(issue => issue.severity === 'error' && issue.target === 'title')).toBe(true);
      const longNode = structuredClone(storyboard);
      const sequence = longNode.scenes.find(scene => scene.visual?.kind === 'sequence');
      sequence.layers[0].text = '节点内容需要拆分'.repeat(40);
      expect(checkTextLayout(longNode).some(issue => issue.severity === 'error' && issue.target === sequence.layers[0].id)).toBe(true);
    }
  });
});
