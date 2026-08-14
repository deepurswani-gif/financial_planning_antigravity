import { getPredefinedGoals } from '../GoalModule/GoalLogic';
import { calculateAge } from '../ProfileModule/ProfileLogic';
import { reconcileAmounts } from './detailReconcile';

export function isConfiguredGoal(goal) {
    return Boolean(goal?.yearsToGoal && goal?.presentValue);
}

export function getActiveGoals(goals = []) {
    return goals.filter(isConfiguredGoal);
}

// Dummy exports for legacy components that have not been deleted yet
export function getSummaryFlowGoals(goals = []) { return []; }
export function isSummaryStyleGoal(goal) { return false; }
export function isSummaryOriginGoal(goal) { return false; }

export function getChildMembers(familyMembers = []) {
    return familyMembers.filter((m) => m.relation === 'Child');
}

export function getChildIndexForGoal(goal) {
    if (goal.childMemberIndex !== undefined && goal.childMemberIndex !== null) {
        return goal.childMemberIndex;
    }
    if (goal.id?.startsWith('edu_')) return parseInt(goal.id.split('_')[1], 10);
    if (goal.id?.startsWith('marriage_')) return parseInt(goal.id.split('_')[1], 10);
    return -1;
}

export function getDetailedFlowGoals(goals = [], plannedGoalIds = []) {
    const planned = new Set(plannedGoalIds);
    return goals.filter((g) => {
        if (planned.has(g.id)) return true;
        return isConfiguredGoal(g);
    });
}

function applyValuesToTarget(target, source) {
    if (!isConfiguredGoal(source)) return target;
    return {
        ...target,
        yearsToGoal: target.yearsToGoal || source.yearsToGoal,
        presentValue: target.presentValue || source.presentValue,
        inflationRate: target.inflationRate || source.inflationRate,
        summaryPresentValue: target.summaryPresentValue || source.presentValue,
        summaryYearsToGoal: target.summaryYearsToGoal || source.yearsToGoal,
    };
}

export function enrichEducationGoalFromFamily(goal, familyMembers) {
    if (!goal.id?.startsWith('edu_')) return goal;

    const childIdx = getChildIndexForGoal(goal);
    const child = getChildMembers(familyMembers)[childIdx];
    if (!child) return goal;

    const updates = {};
    if (child.costOfCompleteCourse && !goal.presentValue) {
        updates.presentValue = String(child.costOfCompleteCourse);
    }
    if (child.remainingTime && !goal.yearsToGoal) {
        updates.yearsToGoal = String(child.remainingTime);
    }
    if (child.courseDuration && !goal.courseDuration) {
        updates.courseDuration = String(child.courseDuration);
    }
    if (child.courseName && !goal.profession) {
        updates.profession = child.courseName;
    }
    if (child.costOfCompleteCourse && !goal.totalCourseCost) {
        updates.totalCourseCost = String(child.costOfCompleteCourse);
    }

    return Object.keys(updates).length ? { ...goal, ...updates } : goal;
}

export function getEducationFamilyDetails(goal, familyMembers) {
    const childIdx = getChildIndexForGoal(goal);
    const child = getChildMembers(familyMembers)[childIdx];
    if (!child) return null;

    const hasDetails = child.courseName || child.courseDuration || child.costOfCompleteCourse || child.remainingTime;
    if (!hasDetails) return null;

    return {
        courseName: child.courseName || '',
        courseDuration: child.courseDuration || '',
        costOfCompleteCourse: child.costOfCompleteCourse || '',
        remainingTime: child.remainingTime || '',
    };
}

export function hasEducationFamilyDetails(goal, familyMembers) {
    const details = getEducationFamilyDetails(goal, familyMembers);
    return Boolean(details?.costOfCompleteCourse);
}

function attachPredefinedMetadata(goal) {
    const childMemberIndex = goal.id.startsWith('edu_')
        ? parseInt(goal.id.split('_')[1], 10)
        : goal.id.startsWith('marriage_')
            ? parseInt(goal.id.split('_')[1], 10)
            : undefined;

    let templateId = goal.id;
    if (goal.id.startsWith('edu_')) templateId = 'education';
    else if (goal.id.startsWith('marriage_')) templateId = 'marriage';

    return {
        ...goal,
        templateId,
        childMemberIndex,
        inflationRate: goal.inflationRate ?? (goal.id.startsWith('edu_') ? 8 : 6),
    };
}

export function mergeGoalsWithPredefined(familyMembers, existingGoals = []) {
    const freshPredefined = getPredefinedGoals(familyMembers).map(attachPredefinedMetadata);

    const customGoals = existingGoals.filter((g) => {
        if (g.isPredefined) return false;
        // Legacy migration: hide legacy summary goals as they will be absorbed
        if (g.templateId && ['retirement', 'car', 'bike', 'home', 'vacation', 'education', 'marriage'].includes(g.templateId)) {
            return false;
        }
        return true;
    });

    const mergedPredefined = freshPredefined.map((newGoal) => {
        let existing = existingGoals.find((p) => p.id === newGoal.id);
        
        // Legacy migration: find if there is an old summary goal that should map to this predefined slot
        if (!existing) {
            existing = existingGoals.find(g => {
                if (g.isPredefined) return false;
                if (!g.templateId) return false;
                
                if (newGoal.id === 'retirement' && g.templateId === 'retirement') return true;
                if (newGoal.id === 'car' && g.templateId === 'car') return true;
                if (newGoal.id === 'bike' && g.templateId === 'bike') return true;
                if (newGoal.id === 'flat' && g.templateId === 'home') return true;
                if (newGoal.id === 'domestic_tour' && g.templateId === 'vacation') return true;
                if (newGoal.id.startsWith('edu_') && g.templateId === 'education') return true;
                if (newGoal.id.startsWith('marriage_') && g.templateId === 'marriage') return true;
                
                return false;
            });
        }

        if (!existing) {
            const enriched = enrichEducationGoalFromFamily(newGoal, familyMembers);
            if (enriched.id === 'retirement' && !enriched.yearsToGoal) {
                const self = familyMembers.find((m) => m.relation === 'Self');
                if (self?.dob && self?.retirementAge) {
                    const age = calculateAge(self.dob);
                    const years = parseInt(self.retirementAge, 10) - age;
                    if (years > 0) return { ...enriched, yearsToGoal: String(years) };
                }
            }
            return enriched;
        }

        const next = {
            ...newGoal,
            yearsToGoal: existing.yearsToGoal ?? newGoal.yearsToGoal,
            presentValue: existing.presentValue ?? newGoal.presentValue,
            inflationRate: existing.inflationRate ?? newGoal.inflationRate,
            profession: existing.profession ?? newGoal.profession,
            courseDuration: existing.courseDuration ?? newGoal.courseDuration,
            totalCourseCost: existing.totalCourseCost ?? newGoal.totalCourseCost,
            name: newGoal.name,
        };

        let enriched = enrichEducationGoalFromFamily(next, familyMembers);
        if (enriched.id === 'retirement' && !enriched.yearsToGoal) {
            const self = familyMembers.find((m) => m.relation === 'Self');
            if (self?.dob && self?.retirementAge) {
                const age = calculateAge(self.dob);
                const years = parseInt(self.retirementAge, 10) - age;
                if (years > 0) enriched = { ...enriched, yearsToGoal: String(years) };
            }
        }
        return enriched;
    });

    return [...mergedPredefined, ...customGoals];
}

export function initializeGoalsFromFamily(familyMembers, existingGoals = []) {
    return mergeGoalsWithPredefined(familyMembers, existingGoals);
}

export const GOAL_CATALOG_GROUPS = [
    {
        key: 'family',
        label: 'For your children',
        match: (g) => g.id.startsWith('edu_') || g.id.startsWith('marriage_'),
    },
    {
        key: 'home',
        label: 'Home',
        match: (g) => ['construction', 'flat', 'renovation'].includes(g.id),
    },
    {
        key: 'lifestyle',
        label: 'Vehicles & travel',
        match: (g) => ['car', 'bike', 'domestic_tour', 'foreign_tour'].includes(g.id),
    },
    {
        key: 'retirement',
        label: 'Retirement',
        match: (g) => g.id === 'retirement',
    },
];

export function groupPredefinedGoals(predefinedGoals) {
    const grouped = GOAL_CATALOG_GROUPS.map((group) => ({
        ...group,
        goals: predefinedGoals.filter((g) => g.isPredefined && group.match(g)),
    }));
    return grouped.filter((g) => g.goals.length > 0);
}

export function getAvailableCatalogGroups(predefinedGoals = [], allGoals = []) {
    const available = predefinedGoals.filter((g) => g.isPredefined);
    return groupPredefinedGoals(available);
}

/** Compare summary-flow goal amounts with detailed catalog values. */
export function reconcileGoalAmounts(goal = {}) {
    const result = {};
    if (goal.summaryPresentValue) {
        result.presentValue = reconcileAmounts(goal.summaryPresentValue, goal.presentValue);
    }
    if (goal.summaryYearsToGoal) {
        result.yearsToGoal = reconcileAmounts(goal.summaryYearsToGoal, goal.yearsToGoal);
    }
    return result;
}

export function goalHasAmountMismatch(goal = {}) {
    return Object.values(reconcileGoalAmounts(goal)).some(
        (r) => r.status !== 'match' && r.status !== 'empty',
    );
}
