import type {ShotPlan} from './compile-shot';

export function actionWindowProgress(plan: ShotPlan, target: string, actions: string[], frame: number, from: number, to: number): number {
  const beat = plan.actions.find((item) => item.target === target && actions.includes(item.action));
  if (!beat) return 0;
  const t = Math.max(0, Math.min(1, (frame - beat.start - beat.duration * from) / (beat.duration * (to - from))));
  return 1 - (1 - t) ** 3;
}

export function actionProgress(plan: ShotPlan, target: string, actions: string[], frame: number, curve: 'cubic' | 'smooth' | 'back' = 'cubic'): number {
  const beat = plan.actions.find((item) => item.target === target && actions.includes(item.action));
  if (!beat) return 0;
  const t = Math.max(0, Math.min(1, (frame - beat.start) / beat.duration));
  if (curve === 'smooth') return t * t * (3 - 2 * t);
  if (curve === 'back') return 1 + 1.5 * (t - 1) ** 3 + 0.5 * (t - 1) ** 2;
  return 1 - (1 - t) ** 3;
}
