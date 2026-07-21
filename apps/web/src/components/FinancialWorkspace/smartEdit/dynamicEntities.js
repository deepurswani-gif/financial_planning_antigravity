/**
 * Dynamic Entity Resolver (Phase 5).
 *
 * The Experience Registry answers "what *kind* of thing does the user want to
 * edit?". This resolver answers "*which specific* thing?" by extracting the
 * user's live financial objects — their policies, loans, FDs, RDs, goals,
 * children, and custom assets/liabilities — straight from the Financial Plan.
 *
 * Design rules (see the phase brief):
 *   - Purely derived from the plan; nothing is persisted.
 *   - No registry metadata is duplicated. Every entity *references* an existing
 *     Experience (`experienceId`) and reuses its launch/landing/activation.
 *   - Completely stateless: `resolveEntities(plan)` is a pure function that can
 *     be rebuilt whenever the plan changes (memoize on the slices, not the
 *     keystroke — see `useDynamicEntities`).
 *
 * An entity that already knows *which* instance to open carries an `activation`
 * override so Smart Edit can bypass the generic instance picker and open that
 * exact object (e.g. "HDFC FD" → Configure that FD).
 */

import { getExperienceById, EXPERIENCE_REGISTRY } from '../../../experienceRegistry';
import { EMI_LOAN_KEYS } from '../../DetailedFlow/expenseDetailSync';

/**
 * @typedef {object} DynamicEntity
 * @property {string} entityId            stable id, unique within a plan
 * @property {string} entityType          e.g. 'lifePolicy' | 'loan' | 'goal'
 * @property {string} displayName         user-facing name (what they remember)
 * @property {string[]} aliases           extra searchable strings
 * @property {string} experienceId        Experience Registry id this maps to
 * @property {string|number|null} instanceId  identity within the collection
 * @property {number|null} instanceIndex  array index (for indexed collections)
 * @property {object|null} activation     exact-instance activation override
 * @property {number} searchBoost         additive ranking nudge (0–100)
 * @property {string} subtitle            type label shown under the name
 * @property {string|null} icon           lucide icon name
 */

/** Find the experience that owns a canonical field (curated preferred). */
const experienceByFieldCache = new Map();
function findExperienceIdForField(fieldId) {
  if (experienceByFieldCache.has(fieldId)) return experienceByFieldCache.get(fieldId);
  let match = null;
  for (const experience of EXPERIENCE_REGISTRY) {
    if ((experience.registryTargets ?? []).includes(fieldId)) {
      if (!experience.derived) {
        match = experience.id;
        break;
      }
      if (!match) match = experience.id;
    }
  }
  experienceByFieldCache.set(fieldId, match);
  return match;
}

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const isConfigured = (item) =>
  item !== null && typeof item === 'object' && parseFloat(item.amount) > 0;
const clean = (list) => list.filter((s) => s != null && String(s).trim() !== '');

/**
 * Entity extractors — one per entity type. Each `collect(plan)` returns the raw
 * instance descriptors; `resolveEntities` decorates them with the shared shape.
 * `experienceId` may be a string or a `(instance) => string` for per-instance
 * routing (loans route Home Loan vs the generic Loans experience).
 */
const EXTRACTORS = [
  {
    entityType: 'lifePolicy',
    experienceId: 'protection.lifeInsurance',
    subtitle: 'Life Insurance Policy',
    icon: 'shield',
    searchBoost: 40,
    collect: (plan) =>
      asArray(plan.policies).map((p, index) => {
        const displayName = clean([p.company, p.planName]).join(' ').trim();
        if (!displayName) return null;
        return {
          instanceId: p.id ?? index,
          instanceIndex: index,
          displayName,
          aliases: clean([p.company, p.planName, p.planType]),
          // The existing LifePolicyDetailsModal lists every policy; opening it is
          // the closest reuse (no per-policy deep link exists to hijack).
          activation: { channel: 'lifePolicyModal' },
        };
      }),
  },
  {
    entityType: 'loan',
    subtitle: 'Loan',
    icon: 'landmark',
    searchBoost: 35,
    experienceId: (inst) =>
      inst.loanKey === 'homeLoan' ? 'liabilities.homeLoan' : 'debt.loans',
    collect: (plan) => {
      const emi = plan.expenseCategories?.emi || {};
      return EMI_LOAN_KEYS.map(({ key, label }) => {
        const detail = emi[key];
        if (!detail || typeof detail !== 'object' || !(parseFloat(detail.principal) > 0)) {
          return null;
        }
        const displayName = clean([detail.name]).join(' ') || label;
        return {
          loanKey: key,
          instanceId: key,
          instanceIndex: null,
          displayName,
          aliases: clean([label, detail.name, 'loan', 'emi']),
          activation: { channel: 'loanModal', key },
        };
      });
    },
  },
  {
    entityType: 'fixedDeposit',
    experienceId: 'assets.fixedDeposits',
    subtitle: 'Fixed Deposit',
    icon: 'banknote',
    searchBoost: 20,
    collect: (plan) =>
      asArray(plan.assetCategories?.investments?.fixedDeposit).map((fd, index) => {
        if (!isConfigured(fd)) return null;
        const displayName = clean([fd.name, fd.bankName]).join(' ').trim() || `Fixed Deposit ${index + 1}`;
        return {
          instanceId: index,
          instanceIndex: index,
          displayName,
          aliases: clean([fd.name, fd.bankName]),
          activation: { channel: 'fdCollection', index },
        };
      }),
  },
  {
    entityType: 'recurringDeposit',
    experienceId: 'savings.recurringDeposits',
    subtitle: 'Recurring Deposit',
    icon: 'piggy-bank',
    searchBoost: 20,
    collect: (plan) =>
      asArray(plan.expenseCategories?.savings?.rd).map((rd, index) => {
        if (!isConfigured(rd)) return null;
        const displayName = clean([rd.name, rd.bankName]).join(' ').trim() || `Recurring Deposit ${index + 1}`;
        return {
          instanceId: index,
          instanceIndex: index,
          displayName,
          aliases: clean([rd.name, rd.bankName]),
          activation: { channel: 'rdCollection', index },
        };
      }),
  },
  {
    entityType: 'goal',
    experienceId: 'goals.collection',
    subtitle: 'Goal',
    icon: 'target',
    searchBoost: 45,
    collect: (plan) =>
      asArray(plan.goals).map((goal, index) => {
        if (!goal?.name) return null;
        return {
          instanceId: goal.id ?? index,
          instanceIndex: index,
          displayName: goal.name,
          aliases: clean([goal.name]),
          activation: null,
        };
      }),
  },
  {
    entityType: 'child',
    experienceId: 'family.children',
    subtitle: 'Child',
    icon: 'users',
    searchBoost: 45,
    collect: (plan) =>
      asArray(plan.familyMembers)
        .filter((m) => String(m?.relation).toLowerCase() === 'child')
        .map((member, index) => {
          if (!member?.name) return null;
          return {
            instanceId: member.id ?? member.name ?? index,
            instanceIndex: index,
            displayName: member.name,
            aliases: clean([member.name]),
            activation: null,
          };
        }),
  },
  {
    entityType: 'customAsset',
    experienceId: () => findExperienceIdForField('assets.custom'),
    subtitle: 'Asset',
    icon: 'gem',
    searchBoost: 25,
    collect: (plan) =>
      asArray(plan.assetCategories?.custom).map((item, index) => {
        if (!item?.label) return null;
        return {
          instanceId: item.id ?? index,
          instanceIndex: index,
          displayName: item.label,
          aliases: clean([item.label]),
          activation: null,
        };
      }),
  },
  {
    entityType: 'customLiability',
    experienceId: () => findExperienceIdForField('liabilities.custom'),
    subtitle: 'Liability',
    icon: 'landmark',
    searchBoost: 25,
    collect: (plan) =>
      asArray(plan.liabilityCategories?.custom).map((item, index) => {
        if (!item?.label) return null;
        return {
          instanceId: item.id ?? index,
          instanceIndex: index,
          displayName: item.label,
          aliases: clean([item.label]),
          activation: null,
        };
      }),
  },
];

/**
 * Extract every editable entity from the Financial Plan. Pure + stateless.
 * @param {object} plan slices: { policies, expenseCategories, assetCategories,
 *   liabilityCategories, goals, familyMembers }
 * @returns {DynamicEntity[]}
 */
export function resolveEntities(plan = {}) {
  const entities = [];
  for (const extractor of EXTRACTORS) {
    let raw;
    try {
      raw = extractor.collect(plan) ?? [];
    } catch {
      raw = [];
    }
    for (const instance of raw) {
      if (!instance) continue;
      const experienceId =
        typeof extractor.experienceId === 'function'
          ? extractor.experienceId(instance)
          : extractor.experienceId;
      // Reference the frozen Experience Registry; skip if it can't be resolved
      // (never invent a launch path).
      if (!experienceId || !getExperienceById(experienceId)) continue;
      entities.push({
        entityId: `${extractor.entityType}:${instance.instanceId}`,
        entityType: extractor.entityType,
        displayName: instance.displayName,
        aliases: instance.aliases ?? [],
        experienceId,
        instanceId: instance.instanceId ?? null,
        instanceIndex: instance.instanceIndex ?? null,
        activation: instance.activation ?? null,
        searchBoost: extractor.searchBoost ?? 0,
        subtitle: extractor.subtitle,
        icon: extractor.icon ?? null,
      });
    }
  }
  return entities;
}

/**
 * Match score for a query against a name + aliases. Higher is better; 0 means
 * no match (result is dropped). Shared by entity and experience ranking so the
 * two streams interleave deterministically.
 */
export function matchScore(query, name, aliases = []) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return 0;
  const primary = String(name ?? '').toLowerCase();
  const others = aliases.map((a) => String(a ?? '').toLowerCase());

  if (primary === q) return 100;
  if (others.includes(q)) return 90;
  if (primary.startsWith(q)) return 70;
  if (others.some((a) => a.startsWith(q))) return 60;
  if (primary.includes(q)) return 40;
  if (others.some((a) => a.includes(q))) return 30;
  return 0;
}

/**
 * Search resolved entities. Returns matches with a numeric `score` (match
 * quality + per-type boost), ranked best-first. Stable for equal scores.
 * @param {DynamicEntity[]} entities
 * @param {string} query
 * @returns {Array<{ entity: DynamicEntity, score: number }>}
 */
export function searchEntities(entities, query) {
  const q = String(query ?? '').trim();
  if (!q) return [];
  const scored = [];
  entities.forEach((entity, index) => {
    const base = matchScore(q, entity.displayName, entity.aliases);
    if (base <= 0) return;
    scored.push({ entity, score: base + (entity.searchBoost ?? 0), order: index });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.map(({ entity, score }) => ({ entity, score }));
}
