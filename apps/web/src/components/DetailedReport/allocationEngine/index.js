export { determineLifeStage, buildLifeStageContext, LIFE_STAGE_IDS, LIFE_STAGE_LABELS } from './lifeStageEngine';
export { buildLifeObjectiveGaps, getExistingMonthlyByInstrument } from './gapEngine';
export { buildGoalFundingPlan, attributeExistingMonthly } from './goalFundingEngine';
export { runProtectionEngine } from './protectionEngine';
export { selectGoalsToFund, sortGoalsByPriority, isRetirementAdequatelyFunded } from './goalPriorityEngine';
export {
    OBJECTIVE_TYPES,
    WATERFALL_OBJECTIVE_IDS,
    classifyGoalObjective,
    mapVehiclesForObjective,
    attachVehiclesToObjectives,
    isGoalEligible,
    isFpiEligibleGoal,
} from './objectiveVehicleMap';
export { applyHardWaterfall, applyHygieneWaterfall } from './hardWaterfall';
export { allocateGoalsByRules, allocateByObjectiveThenVehicle } from './allocationOptimizer';
export {
    runLifeJourneyAllocationEngine,
    buildLifeJourneyRecommendedBundles,
} from './runLifeJourneyAllocationEngine';
export * from './config';
