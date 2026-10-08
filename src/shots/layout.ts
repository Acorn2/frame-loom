import type {Shot} from '../schemas/shot-recipe';

// Shared by the current renderer and preflight; legacy layouts keep their bounds.
export function shotContentLayout(shot?: Shot) {
  if (shot?.version === '1.2.0') return {titleFont: 72, bodyTop: .14, bodyHeight: .86};
  if (shot?.version === '1.1.0') return {titleFont: 54, bodyTop: .18, bodyHeight: .82};
  return {titleFont: 66, bodyTop: .34, bodyHeight: .66};
}
