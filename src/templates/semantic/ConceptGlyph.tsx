import React from 'react';
import type {StoryboardLayer} from '../../schemas/storyboard';

type Glyph = NonNullable<StoryboardLayer['glyph']>;

export function ConceptGlyph({glyph, color, size}: {glyph?: Glyph; color: string; size: number}) {
  if (!glyph) return null;
  const common = {fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  const drawings: Record<Glyph, React.ReactNode> = {
    document: <><path d="M6 3h9l5 5v13H6z M15 3v5h5 M9 12h8 M9 16h8" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>,
    map: <><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" /></>,
    list: <><path d="M9 6h12 M9 12h12 M9 18h12 M3 6h2 M3 12h2 M3 18h2" /></>,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.5 3-7 8-7s8 2.5 8 7" /></>,
    timeline: <><path d="M3 12h18 M6 9v6 M12 7v10 M18 9v6" /><circle cx="12" cy="12" r="2" /></>,
    video: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3z" /></>,
    quote: <><path d="M10 7H5v5h4c0 3-1 4-4 5 M20 7h-5v5h4c0 3-1 4-4 5" /></>,
    spark: <><path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
    chart: <><path d="M4 20V4 M4 20h17 M8 17v-5 M13 17V8 M18 17V5" /></>,
    link: <><path d="M10 7H7a5 5 0 0 0 0 10h3 M14 7h3a5 5 0 0 1 0 10h-3 M8 12h8" /></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{flexShrink: 0}} {...common}>{drawings[glyph]}</svg>;
}
