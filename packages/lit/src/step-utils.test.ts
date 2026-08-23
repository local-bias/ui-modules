import { describe, expect, it } from 'vitest';
import { nextStepIndex, prevStepIndex } from './step-utils';
import type { StepItem, StepItemStatus } from './types';

/** `'pending done skipped'` のような並びから StepItem[] を組み立てる。 */
function steps(statuses: string): StepItem[] {
  return statuses.split(' ').map((status, i) => ({
    key: `s${i}`,
    label: `Step ${i}`,
    status: status as StepItemStatus,
  }));
}

describe('nextStepIndex', () => {
  it('returns the immediately following index when nothing is skipped', () => {
    expect(nextStepIndex(steps('done active pending'), 1)).toBe(2);
  });

  it('starts from the head when the current position is -1', () => {
    expect(nextStepIndex(steps('pending pending'), -1)).toBe(0);
  });

  it('jumps over skipped steps', () => {
    expect(nextStepIndex(steps('active skipped skipped pending'), 0)).toBe(3);
  });

  it('returns -1 when every following step is skipped', () => {
    expect(nextStepIndex(steps('active skipped skipped'), 0)).toBe(-1);
  });

  it('returns -1 on the last step', () => {
    expect(nextStepIndex(steps('done done active'), 2)).toBe(-1);
  });

  it('returns -1 for an empty step list', () => {
    expect(nextStepIndex([], -1)).toBe(-1);
  });

  it('does not treat done or error as skippable', () => {
    expect(nextStepIndex(steps('active done error pending'), 0)).toBe(1);
  });
});

describe('prevStepIndex', () => {
  it('returns the immediately preceding index when nothing is skipped', () => {
    expect(prevStepIndex(steps('done active pending'), 1)).toBe(0);
  });

  it('jumps over skipped steps', () => {
    expect(prevStepIndex(steps('done skipped skipped active'), 3)).toBe(0);
  });

  it('returns -1 on the first step', () => {
    expect(prevStepIndex(steps('active pending'), 0)).toBe(-1);
  });

  it('returns -1 when every preceding step is skipped', () => {
    expect(prevStepIndex(steps('skipped skipped active'), 2)).toBe(-1);
  });

  it('returns -1 for an empty step list', () => {
    expect(prevStepIndex([], 0)).toBe(-1);
  });

  it('clamps a position past the end to the last element', () => {
    expect(prevStepIndex(steps('pending pending'), 99)).toBe(1);
  });
});
