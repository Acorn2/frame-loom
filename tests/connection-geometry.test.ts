import {describe, expect, it} from 'vitest';
import type {StoryboardLayer} from '../src/schemas/storyboard.js';
import {getConnectionGeometry} from '../src/renderer/connection-geometry.js';

function card(id: string, x: number, y: number, width: number, height: number): StoryboardLayer {
  return {id, type: 'node', x, y, width, height};
}

describe('connection geometry', () => {
  it('routes stacked cards through the gap instead of their text areas', () => {
    const story = card('story', 0, 330, 440, 145);
    const question = card('question', 0, 510, 440, 145);
    const connection = getConnectionGeometry(story, question);

    expect(connection.direction).toBe('down');
    expect(connection.from.y).toBeGreaterThan(475);
    expect(connection.to.y).toBeLessThan(510);
    expect(connection.from.x).toBe(220);
    expect(connection.to.x).toBe(220);
    expect(connection.path).toContain(' C ');
  });

  it('routes offset cards through the horizontal gap', () => {
    const question = card('question', 0, 510, 440, 145);
    const discussion = card('discussion', 790, 365, 680, 245);
    const connection = getConnectionGeometry(question, discussion);

    expect(connection.direction).toBe('right');
    expect(connection.from.x).toBeGreaterThan(440);
    expect(connection.to.x).toBeLessThan(790);
    expect(connection.label.x).toBeGreaterThan(440);
    expect(connection.label.x).toBeLessThan(790);
  });

  it('places reverse connections outside both cards', () => {
    const left = card('left', 100, 100, 200, 120);
    const right = card('right', 500, 100, 200, 120);
    const connection = getConnectionGeometry(right, left);

    expect(connection.direction).toBe('left');
    expect(connection.from.x).toBeLessThan(500);
    expect(connection.to.x).toBeGreaterThan(300);
  });
});
