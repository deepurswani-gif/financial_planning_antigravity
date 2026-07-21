import { describe, expect, it } from 'vitest';
import { DRAWER_ITEM_ACTIONS, DRAWER_GROUPS } from './workspaceNavConfig';
import { SECTION_IDS, resolveSectionId } from './sectionIds';
import { getSectionById, isKnownSectionId } from './sectionRegistry';

describe('drawer → section navigation pipeline', () => {
  it('maps every Your Information / Advanced Information drawer item to open_section', () => {
    const sectionItems = DRAWER_GROUPS.filter((group) =>
      ['your_information', 'advanced_information'].includes(group.id)
    ).flatMap((group) => group.items);

    for (const item of sectionItems) {
      const action = DRAWER_ITEM_ACTIONS[item.id];
      expect(action, `missing action for ${item.id}`).toEqual({
        type: 'open_section',
        sectionId: item.id,
      });
      expect(Object.values(SECTION_IDS)).toContain(item.id);
      expect(isKnownSectionId(item.id)).toBe(true);
      expect(getSectionById(item.id)?.component).toBeTypeOf('function');
    }
  });

  it('does not collapse drawer action keys to undefined via circular imports', () => {
    expect(DRAWER_ITEM_ACTIONS.profile?.sectionId).toBe('profile');
    expect(DRAWER_ITEM_ACTIONS.cashFlow?.sectionId).toBe('cashFlow');
    expect(DRAWER_ITEM_ACTIONS[undefined]).toBeUndefined();
  });

  it('resolves legacy aliases to stable section ids', () => {
    expect(resolveSectionId('cash_flow')).toBe(SECTION_IDS.CASH_FLOW);
    expect(resolveSectionId('familyinfo')).toBe(SECTION_IDS.FAMILY_INFORMATION);
  });
});
