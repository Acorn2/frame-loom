import React from 'react';

// C01 is hosted by a settled, explicitly selected phrase; it never touches captions.
export function MarkerUnderline({progress, color}: {progress: number; color: string}) {
  return <svg aria-hidden viewBox="0 0 100 12" preserveAspectRatio="none" style={{position: 'absolute', left: 0, bottom: '-0.14em', width: '100%', height: '0.12em', overflow: 'visible', clipPath: `inset(0 ${100 * (1 - progress)}% 0 0)`}}>
    <path d="M0 5 Q22 2 48 5 T100 4 L100 8 Q76 11 50 9 T0 10 Z" fill={color} />
  </svg>;
}
