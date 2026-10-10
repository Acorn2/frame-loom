import React from 'react';

// Generated titles may wrap between words; source text itself is unchanged.
// Keep Chinese words and Latin identifiers together instead of splitting a
// product name halfway through a word. Actual bounds still determine validity.
export function ReadableText({text}: {text: string}) {
  return <span data-layout-text-group>{Array.from(new Intl.Segmenter('zh', {granularity: 'word'}).segment(text), ({segment}, index) =>
    /^\s+$/.test(segment) ? <React.Fragment key={index}>{segment}</React.Fragment>
      : <span key={index} style={{whiteSpace: 'nowrap'}}>{segment}</span>)}</span>;
}
