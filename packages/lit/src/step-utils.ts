import type { StepItem } from './types';

/**
 * 現在位置から見た次のステップ位置。`skipped` のステップは飛ばす。
 * 該当なし (= 最終ステップ) の場合は -1。
 */
export function nextStepIndex(steps: StepItem[], from: number): number {
  for (let i = from + 1; i < steps.length; i++) {
    if (steps[i].status !== 'skipped') return i;
  }
  return -1;
}

/**
 * 現在位置から見た前のステップ位置。`skipped` のステップは飛ばす。
 * 該当なし (= 先頭ステップ) の場合は -1。
 */
export function prevStepIndex(steps: StepItem[], from: number): number {
  const start = Math.min(from, steps.length) - 1;
  for (let i = start; i >= 0; i--) {
    if (steps[i].status !== 'skipped') return i;
  }
  return -1;
}
