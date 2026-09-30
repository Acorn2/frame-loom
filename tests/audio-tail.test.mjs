import {describe, expect, it} from 'vitest';
import {parseTrailingSilence} from '../scripts/lib/audio-tail.mjs';

describe('rendered audio tail', () => {
  it('reports only silence that reaches the end of the inspected interval', () => {
    const internal = 'silence_end: 3.0 | silence_duration: 0.6';
    const trailing = `${internal}\nsilence_end: 8.01 | silence_duration: 4.36`;
    expect(parseTrailingSilence(internal, 8)).toBe(0);
    expect(parseTrailingSilence(trailing, 8)).toBeCloseTo(4.36);
  });
});
