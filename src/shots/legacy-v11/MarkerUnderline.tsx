import React from 'react';

// C01 is hosted by a settled, explicitly selected phrase; it never touches captions.
export function MarkerUnderline({progress, color}: {progress: number; color: string}) {
  return <svg aria-hidden viewBox="0 0 100 12" preserveAspectRatio="none" style={{position: 'absolute', left: 0, bottom: '-0.14em', width: '100%', height: '0.12em', overflow: 'visible', clipPath: `inset(0 ${100 * (1 - progress)}% 0 0)`}}>
    <path d="M0 8 L8 6 L16 7 L28 5 L40 6 L54 4 L68 3 L80 4 L94 1 L100 2 L98 6 L86 7 L72 8 L60 8 L46 10 L32 10 L18 11 L5 10 Z" fill={color} />
  </svg>;
}
