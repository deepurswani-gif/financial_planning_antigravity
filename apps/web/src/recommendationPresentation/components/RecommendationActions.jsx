import React from 'react';
import CommercialCtaButton from '../../components/CommercialCta/CommercialCtaButton';
import {
  PRIMARY_ACTION_UPDATE_INFORMATION,
  SECONDARY_ACTION_COMMERCIAL_CTA,
} from '../toPresentationModel';

/**
 * Renders action groups for a recommendation card.
 *
 * Accepts `primaryActions[]` and `secondaryActions[]` so future commercial
 * actions can append without redesigning RecommendationCard. Components remain
 * registry-agnostic — they only render prepared action descriptors.
 *
 * Primary actions express data-quality intent via `onPrimaryAction(source)`.
 * Secondary commercial actions render via CommercialCtaButton when `cta` is set.
 */
const RecommendationActions = ({
  primaryActions = [],
  secondaryActions = [],
  source,
  onPrimaryAction,
  ctaContext = {},
  accentColor = '#00A9F2',
  className = '',
}) => {
  if (!primaryActions.length && !secondaryActions.length) return null;

  return (
    <div className={`rec-actions ${className}`.trim()}>
      <div className="rec-actions-primary">
        {primaryActions.map((action) => {
          if (action.kind === PRIMARY_ACTION_UPDATE_INFORMATION) {
            return (
              <button
                key={action.id}
                type="button"
                className="rec-action-primary"
                onClick={() => onPrimaryAction?.(source, action)}
              >
                {action.label}
              </button>
            );
          }
          return (
            <button
              key={action.id}
              type="button"
              className="rec-action-primary"
              onClick={() => onPrimaryAction?.(source, action)}
            >
              {action.label}
            </button>
          );
        })}
      </div>
      <div className="rec-actions-secondary">
        {secondaryActions.map((action) => {
          if (action.kind === SECONDARY_ACTION_COMMERCIAL_CTA && action.cta) {
            return (
              <CommercialCtaButton
                key={action.id}
                cta={action.cta}
                context={ctaContext}
                accentColor={accentColor}
                className="rec-action-secondary"
              />
            );
          }
          return (
            <button
              key={action.id}
              type="button"
              className="rec-action-secondary"
              disabled
            >
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RecommendationActions;
