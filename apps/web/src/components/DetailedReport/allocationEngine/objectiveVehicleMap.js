/**
 * Goal classification + horizon-based vehicle mapping (config-driven).
 */

import { getProductsForHorizon } from './config/goalHorizonMatrix';
import { GOAL_ELIGIBLE_TYPES } from './config/statutoryLimits';

export const OBJECTIVE_TYPES = {
    EMERGENCY: 'emergency_fund',
    PROTECTION: 'protection',
    HEALTH: 'health',
    RETIREMENT: 'retirement',
    CHILD_EDUCATION: 'child_education',
    CHILD_MARRIAGE: 'child_marriage',
    HOME: 'home',
    BUSINESS: 'business',
    OTHER: 'other',
};

export const WATERFALL_OBJECTIVE_IDS = [
    OBJECTIVE_TYPES.EMERGENCY,
    OBJECTIVE_TYPES.PROTECTION,
    OBJECTIVE_TYPES.HEALTH,
];

export function classifyGoalObjective(goal = {}) {
    const name = String(goal.name || goal.placeholder || '').toLowerCase();
    const id = String(goal.id || '').toLowerCase();

    if (id === 'retirement' || name.includes('retirement')) return OBJECTIVE_TYPES.RETIREMENT;
    if (id.startsWith('edu_') || name.includes('education') || name.includes('college')) {
        return OBJECTIVE_TYPES.CHILD_EDUCATION;
    }
    if (id.startsWith('marriage_') || name.includes('marriage') || name.includes('wedding')) {
        return OBJECTIVE_TYPES.CHILD_MARRIAGE;
    }
    if (
        id === 'construction' || id === 'flat' || id === 'renovation'
        || name.includes('house') || name.includes('flat') || name.includes('home')
        || name.includes('renovation') || name.includes('construction')
    ) {
        return OBJECTIVE_TYPES.HOME;
    }
    if (name.includes('business') || id.includes('business')) return OBJECTIVE_TYPES.BUSINESS;
    return OBJECTIVE_TYPES.OTHER;
}

export function isGoalEligible(objective = {}) {
    const type = objective.type || classifyGoalObjective(objective);
    return GOAL_ELIGIBLE_TYPES.includes(type) && !objective.isHygiene;
}

/** @deprecated Use isGoalEligible */
export const isFpiEligibleGoal = isGoalEligible;

export function mapVehiclesForObjective(objectiveType, yearsLeft = 10) {
    if (
        objectiveType === OBJECTIVE_TYPES.EMERGENCY
        || objectiveType === OBJECTIVE_TYPES.PROTECTION
        || objectiveType === OBJECTIVE_TYPES.HEALTH
    ) {
        return [];
    }
    return getProductsForHorizon(yearsLeft).vehicles;
}

export function attachVehiclesToObjectives(objectives = []) {
    return objectives.map((obj) => {
        const horizon = getProductsForHorizon(obj.yearsLeft);
        return {
            ...obj,
            vehicles: horizon.vehicles,
            horizonProducts: horizon.products,
            horizonLabel: horizon.horizonLabel,
            horizonBand: horizon.band,
        };
    });
}
