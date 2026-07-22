import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import RecommendationMetric from './RecommendationMetric';
import RecommendationActions from './RecommendationActions';

/**
 * First-class recommendation card. Registry-agnostic — expects a prepared
 * presentation model (from toPresentationModel).
 *
 * Hierarchy (action before explanation):
 *   severity → title → one-line summary → primary/secondary actions → expand
 * Expanded: business meaning → supporting metrics → description
 */
const RecommendationCard = ({
  model,
  onPrimaryAction,
  ctaContext = {},
  className = '',
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  if (!model) return null;

  const {
    title,
    summary,
    description,
    businessMeaning,
    severityStyle,
    confidence,
    primaryMetric,
    supportingMetrics,
    primaryActions,
    secondaryActions,
    source,
  } = model;

  const canExpand = Boolean(
    description || businessMeaning || primaryMetric || supportingMetrics?.length,
  );

  return (
    <article
      className={`rec-card ${severityStyle.className} ${className}`.trim()}
      style={{ '--rec-accent': severityStyle.accent }}
      data-severity={severityStyle.id}
      data-recommendation-id={model.id}
    >
      <div className="rec-card-header">
        <span className="rec-severity-badge">{severityStyle.label}</span>
        {confidence ? (
          <span className="rec-confidence" title={confidence.message}>
            {confidence.label}
          </span>
        ) : null}
      </div>

      <h4 className="rec-card-title">{title}</h4>
      <p className="rec-card-summary">{summary}</p>

      <RecommendationActions
        primaryActions={primaryActions}
        secondaryActions={secondaryActions}
        source={source}
        onPrimaryAction={onPrimaryAction}
        ctaContext={ctaContext}
        accentColor={severityStyle.accent}
      />

      {canExpand ? (
        <button
          type="button"
          className="rec-card-expand"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Hide details <ChevronUp size={14} />
            </>
          ) : (
            <>
              View details <ChevronDown size={14} />
            </>
          )}
        </button>
      ) : null}

      {expanded ? (
        <div className="rec-card-details">
          {businessMeaning ? (
            <p className="rec-card-reasoning">
              <span className="rec-card-reasoning-label">Why this matters</span>
              {businessMeaning}
            </p>
          ) : null}
          {supportingMetrics?.length ? (
            <div className="rec-card-metrics">
              {supportingMetrics.map((m) => (
                <RecommendationMetric key={m.key} label={m.label} value={m.value} />
              ))}
            </div>
          ) : primaryMetric ? (
            <RecommendationMetric label={primaryMetric.label} value={primaryMetric.value} />
          ) : null}
          {description ? <p className="rec-card-description">{description}</p> : null}
        </div>
      ) : null}
    </article>
  );
};

export default RecommendationCard;
