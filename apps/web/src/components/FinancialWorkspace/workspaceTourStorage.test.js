import { describe, expect, it } from 'vitest';
import {
  createDefaultTourState,
  hydrateTourState,
  markTourCompleted,
  resolveAutoTourTrigger,
} from './workspaceTourStorage';
import { getWorkspaceTourSteps } from './workspaceTourConfig';

describe('workspaceTourStorage', () => {
  it('defaults to incomplete milestones', () => {
    expect(createDefaultTourState()).toEqual({
      completedIntro: false,
      completedDetailedUnlock: false,
    });
  });

  it('hydrates boolean flags only', () => {
    expect(hydrateTourState({ completedIntro: 1, completedDetailedUnlock: 'yes', extra: true })).toEqual({
      completedIntro: true,
      completedDetailedUnlock: true,
    });
  });

  it('auto-starts intro for summary users who have not seen it', () => {
    expect(resolveAutoTourTrigger({}, 'summary')).toBe('intro');
    expect(resolveAutoTourTrigger({ completedIntro: true }, 'summary')).toBe(null);
  });

  it('auto-starts detailed tour when full capability is unlocked', () => {
    expect(
      resolveAutoTourTrigger({ completedIntro: true, completedDetailedUnlock: false }, 'full'),
    ).toBe('detailed');
    expect(
      resolveAutoTourTrigger({ completedIntro: true, completedDetailedUnlock: true }, 'full'),
    ).toBe(null);
  });

  it('prefers detailed trigger for first-time full users', () => {
    expect(resolveAutoTourTrigger({}, 'full')).toBe('detailed');
  });

  it('marks intro complete without touching detailed milestone', () => {
    expect(markTourCompleted({}, 'intro')).toEqual({
      completedIntro: true,
      completedDetailedUnlock: false,
    });
  });

  it('marks both milestones when detailed tour finishes', () => {
    expect(markTourCompleted({}, 'detailed')).toEqual({
      completedIntro: true,
      completedDetailedUnlock: true,
    });
  });

  it('manual tour on summary only clears the intro milestone', () => {
    expect(markTourCompleted({}, 'manual', 'summary')).toEqual({
      completedIntro: true,
      completedDetailedUnlock: false,
    });
  });

  it('manual tour on full clears both milestones', () => {
    expect(markTourCompleted({ completedIntro: true }, 'manual', 'full')).toEqual({
      completedIntro: true,
      completedDetailedUnlock: true,
    });
  });
});

describe('workspaceTourConfig', () => {
  it('returns six coach-mark steps including Smart Edit', () => {
    expect(getWorkspaceTourSteps('intro')).toHaveLength(6);
    expect(getWorkspaceTourSteps('detailed').map((s) => s.target)).toEqual([
      'workspace-hub',
      'workspace-smart-edit',
      'workspace-tools',
      'workspace-mode',
      'workspace-workflow',
      'workspace-report',
    ]);
    const smartEdit = getWorkspaceTourSteps('intro').find((s) => s.id === 'smartEdit');
    expect(smartEdit.openHub).toBe('edit');
    expect(smartEdit.body).toMatch(/without going back/i);
  });

  it('uses unlock-aware copy for the mode step', () => {
    const introMode = getWorkspaceTourSteps('intro').find((s) => s.id === 'mode');
    const detailedMode = getWorkspaceTourSteps('detailed').find((s) => s.id === 'mode');
    expect(introMode.body).toMatch(/unlocks after planning/i);
    expect(detailedMode.body).toMatch(/unlocked/i);
  });
});
