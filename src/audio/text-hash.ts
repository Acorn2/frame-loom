import {createHash} from 'node:crypto';

export function hashNarration(text: string): string {
  return createHash('sha256').update(text.trim(), 'utf8').digest('hex');
}
