import { getPredefinedGoals } from '../GoalModule/GoalLogic';
import { calculateAge } from '../ProfileModule/ProfileLogic';
import { reconcileAmounts } from './detailReconcile';

export function isConfiguredGoal(goal) {
    return Boolean(goal?.yearsToGoal && goal?.presentValue);
}

export function getActiveGoals(goals = []) {
    return goals.filter(isConfiguredGoal);
}

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

export function detectSummaryBundledGoal(goal) {
    if (goal.templateId) return goal.templateId;
    const name = (goal.name || '').toLowerCase();
    if (name.includes('child educat') || name === 'child education') return 'education';
    if (name.includes('higher educat')) return 'education';
    if (name.includes('marriage') || name.includes('wedd')) return 'marriage';
    if (name.includes('vacat') || name.includes('tour') || name.includes('trip')) return 'vacation';
    if (name.includes('bike')) return 'bike';
    if (name.includes('car') || name.includes('vehic')) return 'car';
    if (name.includes('construct')) return 'construction';
    if (name.includes('flat')) return 'flat';
    if (name.includes('renovat')) return 'renovation';
    if (name.includes('home') || name.includes('house')) return 'home';
    if (name.includes('retire')) return 'retirement';
    return null;
}

export function isSummaryStyleGoal(goal) {
    if (goal.isPredefined) return false;
    if (goal.templateId) return true;
    if (goal.id?.startsWith('goal_')) return true;
    return Boolean(detectSummaryBundledGoal(goal));
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

export function migrateSummaryGoalIntoCatalog(bundledGoal, predefinedGoals, familyMembers) {
    const template = detectSummaryBundledGoal(bundledGoal);
    if (!template || !isConfiguredGoal(bundledGoal)) return predefinedGoals;

    let result = [...predefinedGoals];

    switch (template) {
        case 'education': {
            const eduGoals = result.filter((g) => g.id.startsWith('edu_'));
            if (eduGoals.length === 0) break;
            const target = eduGoals.find((g) => !isConfiguredGoal(g)) || eduGoals[0];
            result = result.map((g) => (g.id === target.id ? applyValuesToTarget(g, bundledGoal) : g));
            break;
        }
        case 'marriage': {
            const marriageGoals = result.filter((g) => g.id.startsWith('marriage_'));
            if (marriageGoals.length === 0) break;
            const target = marriageGoals.find((g) => !isConfiguredGoal(g)) || marriageGoals[0];
            result = result.map((g) => (g.id === target.id ? applyValuesToTarget(g, bundledGoal) : g));
            break;
        }
        case 'vacation':
            result = result.map((g) => (
                g.id === 'domestic_tour' && !isConfiguredGoal(g)
                    ? applyValuesToTarget(g, bundledGoal)
                    : g
            ));
            break;
        case 'car':
            result = result.map((g) => (
                g.id === 'car' && !isConfiguredGoal(g)
                    ? applyValuesToTarget(g, bundledGoal)
                    : g
            ));
            break;
        case 'bike':
            result = result.map((g) => (
                g.id === 'bike' && !isConfiguredGoal(g)
                    ? applyValuesToTarget(g, bundledGoal)
                    : g
            ));
            break;
        case 'construction':
        case 'flat':
        case 'renovation':
            result = result.map((g) => (
                g.id === template && !isConfiguredGoal(g)
                    ? applyValuesToTarget(g, bundledGoal)
                    : g
            ));
            break;
        case 'home':
            result = result.map((g) => (
                g.id === 'flat' && !isConfiguredGoal(g)
                    ? applyValuesToTarget(g, bundledGoal)
                    : g
            ));
            break;
        case 'retirement':
            result = result.map((g) => (
                g.id === 'retirement' ? applyValuesToTarget(g, bundledGoal) : g
            ));
            break;
        default:
            break;
    }

    return result.map((g) => enrichEducationGoalFromFamily(g, familyMembers));
}

export function mergeGoalsWithPredefined(familyMembers, existingGoals = []) {
    const freshPredefined = getPredefinedGoals(familyMembers).map(attachPredefinedMetadata);

    const customGoals = existingGoals.filter(
        (g) => !g.isPredefined && !isSummaryStyleGoal(g),
    );
    const summaryBundled = existingGoals.filter(isSummaryStyleGoal);

    let mergedPredefined = freshPredefined.map((newGoal) => {
        const existing = existingGoals.find((p) => p.id === newGoal.id);
        if (!existing) return newGoal;

        return {
            ...newGoal,
            yearsToGoal: existing.yearsToGoal ?? newGoal.yearsToGoal,
            presentValue: existing.presentValue ?? newGoal.presentValue,
            inflationRate: existing.inflationRate ?? newGoal.inflationRate,
            profession: existing.profession ?? newGoal.profession,
            courseDuration: existing.courseDuration ?? newGoal.courseDuration,
            totalCourseCost: existing.totalCourseCost ?? newGoal.totalCourseCost,
            summaryPresentValue: existing.summaryPresentValue ?? newGoal.summaryPresentValue,
            summaryYearsToGoal: existing.summaryYearsToGoal ?? newGoal.summaryYearsToGoal,
            name: newGoal.name,
        };
    });

    for (const bundled of summaryBundled) {
        mergedPredefined = migrateSummaryGoalIntoCatalog(bundled, mergedPredefined, familyMembers);
    }

    mergedPredefined = mergedPredefined.map((g) => {
        let next = enrichEducationGoalFromFamily(g, familyMembers);
        if (g.id === 'retirement' && !next.yearsToGoal) {
            const self = familyMembers.find((m) => m.relation === 'Self');
            if (self?.dob && self?.retirementAge) {
                const age = calculateAge(self.dob);
                const years = parseInt(self.retirementAge, 10) - age;
                if (years > 0) next = { ...next, yearsToGoal: String(years) };
            }
        }
        return next;
    });

    const unmappedSummaryCustom = summaryBundled
        .filter((g) => !detectSummaryBundledGoal(g))
        .map((g) => ({ ...g, isPredefined: false }));

    const withSnapshots = [...mergedPredefined, ...customGoals, ...unmappedSummaryCustom].map((g) => {
        if (!g.presentValue || g.summaryPresentValue) return g;
        if (!isSummaryStyleGoal(g) && !g.templateId) return g;
        return {
            ...g,
            summaryPresentValue: g.presentValue,
            summaryYearsToGoal: g.yearsToGoal || g.summaryYearsToGoal,
        };
    });

    return withSnapshots;
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
