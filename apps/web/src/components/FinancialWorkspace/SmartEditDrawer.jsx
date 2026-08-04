import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, ChevronDown, ChevronRight, Pencil, Layers, Lock } from 'lucide-react';
import {
  buildFrequentlyUpdated,
  buildCategoryTree,
  searchSmartEdit,
  resolveTargetAvailability,
} from './smartEdit/smartEditModel';
import { useDynamicEntities } from './smartEdit/useDynamicEntities';
import { useDrawerFocusRestore } from './useDrawerFocusRestore';
import { AnalyticsEventName, trackAnalyticsEvent } from '../../lib/analytics';

/**
 * Smart Edit body — reusable inside the standalone drawer or the mobile hub Edit tab.
 */
export function SmartEditPanel({
  capability = 'full',
  onLaunchExperience,
  onLockedExperience,
  onClose,
  showHeaderClose = true,
  resetKey = true,
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    if (resetKey) {
      setQuery('');
      setExpanded(new Set());
    }
  }, [resetKey]);

  const entities = useDynamicEntities();

  const frequentlyUpdated = useMemo(
    () => buildFrequentlyUpdated({ limit: 6, capability }),
    [capability],
  );
  const categories = useMemo(() => buildCategoryTree({ capability }), [capability]);
  const results = useMemo(
    () => searchSmartEdit(query, { limit: 20, capability, entities }),
    [query, capability, entities],
  );

  const toggleCategory = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const select = (target) => {
    const availability = resolveTargetAvailability(target, { capability });

    if (availability.locked || availability.action === 'upgrade') {
      onLockedExperience?.(target, availability);
      return;
    }

    if (!availability.available || availability.action !== 'launch') {
      return;
    }

    const launched = onLaunchExperience?.(target);
    if (launched !== false) onClose?.();
  };

  const searching = query.trim().length > 0;

  return (
    <>
      <div className="se-header" data-tour="workspace-smart-edit">
        <div className="se-header-titles">
          <span className="se-eyebrow">Smart Edit</span>
          <span className="se-subtitle">Update your financial information</span>
        </div>
        {showHeaderClose ? (
          <button type="button" className="fw-icon-btn" onClick={onClose} aria-label="Close Smart Edit">
            <X size={20} />
          </button>
        ) : null}
      </div>

      <div className="se-search">
        <Search size={16} className="se-search-icon" aria-hidden="true" />
        <input
          type="text"
          className="se-search-input"
          placeholder="Search your financial information…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search your financial information"
          autoComplete="off"
        />
        {searching ? (
          <button
            type="button"
            className="se-search-clear"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      <div className="se-body">
        {searching ? (
          <SearchResults results={results} onSelect={select} />
        ) : (
          <>
            <Section title="Frequently Updated">
              <ul className="se-list">
                {frequentlyUpdated.map((item) => (
                  <ExperienceRow key={item.key} item={item} onSelect={select} />
                ))}
              </ul>
            </Section>

            <Section title="Browse Categories">
              <ul className="se-category-list">
                {categories.map((category) => {
                  const isOpen = expanded.has(category.id);
                  return (
                    <li key={category.id} className="se-category">
                      <button
                        type="button"
                        className="se-category-toggle"
                        onClick={() => toggleCategory(category.id)}
                        aria-expanded={isOpen}
                      >
                        <span>{category.label}</span>
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      {isOpen ? (
                        <ul className="se-list se-list--nested">
                          {category.items.map((item) => (
                            <ExperienceRow
                              key={item.key}
                              item={item}
                              onSelect={select}
                              compact
                            />
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Section>
          </>
        )}
      </div>

      <div className="se-footer">
        <button type="button" className="se-utility" onClick={() => select('planning.incomeTax')}>
          Income Tax Planner
        </button>
        <button type="button" className="se-utility" onClick={() => select('__settings__')}>
          Settings
        </button>
        <button
          type="button"
          className="se-utility se-utility--danger"
          onClick={() => select('__logout__')}
        >
          Logout
        </button>
      </div>
    </>
  );
}

/**
 * Smart Edit Drawer — the primary place to update financial information.
 *
 * A command-palette style Editing Hub, driven by the Experience Registry and
 * gated by the Experience Availability Resolver. It searches and displays
 * *experiences* (what the user intends to edit), not raw fields. Selecting an
 * available experience delegates to `onLaunchExperience`. Selecting a locked
 * experience invokes `onLockedExperience` and never launches editing.
 *
 * Report navigation is intentionally NOT shown.
 */
export default function SmartEditDrawer({
  open,
  onClose,
  capability = 'full',
  onLaunchExperience,
  onLockedExperience,
}) {
  const closeDrawer = useDrawerFocusRestore(open, onClose);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeDrawer]);

  useEffect(() => {
    if (!open) return;
    trackAnalyticsEvent({
      eventName: AnalyticsEventName.SMART_EDIT_OPEN,
      eventCategory: 'ai',
      component: 'SmartEditDrawer',
      feature: 'smart_edit',
      properties: { capability },
    });
  }, [open, capability]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div
        className={`fw-drawer-backdrop ${open ? 'open' : ''}`}
        onClick={closeDrawer}
        aria-hidden={!open}
      />
      <aside
        className={`fw-drawer se-drawer ${open ? 'open' : ''}`}
        aria-hidden={!open}
        aria-label="Smart Edit"
      >
        <SmartEditPanel
          capability={capability}
          onLaunchExperience={onLaunchExperience}
          onLockedExperience={onLockedExperience}
          onClose={closeDrawer}
          resetKey={open}
        />
      </aside>
    </>
  );
}

function Section({ title, children }) {
  return (
    <section className="se-section">
      <p className="se-section-title">{title}</p>
      {children}
    </section>
  );
}

function ExperienceRow({ item, onSelect, compact = false }) {
  if (!item) return null;
  const locked = Boolean(item.availability?.locked);
  return (
    <li>
      <button
        type="button"
        className={`se-row ${compact ? 'se-row--compact' : ''} ${locked ? 'se-row--locked' : ''}`}
        onClick={() => onSelect(item)}
        aria-label={locked ? `${item.name} (locked)` : undefined}
      >
        <span className={`se-row-icon ${locked ? 'se-row-icon--locked' : ''}`} aria-hidden="true">
          {locked ? <Lock size={14} /> : item.isCollection ? <Layers size={15} /> : <Pencil size={14} />}
        </span>
        <span className="se-row-main">
          <span className="se-row-name">
            {item.name}
            {locked ? <Lock size={12} className="se-row-lock-inline" aria-hidden="true" /> : null}
          </span>
          {!compact && item.description ? (
            <span className="se-row-desc">{item.description}</span>
          ) : null}
          {compact && locked && item.availability?.subtitle ? (
            <span className="se-row-desc">{item.availability.subtitle}</span>
          ) : null}
        </span>
        {!compact ? <span className="se-row-category">{item.category}</span> : null}
      </button>
    </li>
  );
}

function SearchResults({ results, onSelect }) {
  if (!results.length) {
    return (
      <div className="se-empty">
        <p>No matches found.</p>
        <p className="se-empty-hint">Try a different word, like “salary”, “SIP”, or “goals”.</p>
      </div>
    );
  }
  return (
    <ul className="se-list se-results">
      {results.map((item) => {
        const locked = Boolean(item.availability?.locked);
        return (
          <li key={item.key}>
            <button
              type="button"
              className={`se-row se-row--result ${locked ? 'se-row--locked' : ''}`}
              onClick={() => onSelect(item)}
              aria-label={locked ? `${item.name} (locked)` : undefined}
            >
              <span
                className={`se-row-icon ${locked ? 'se-row-icon--locked' : ''}`}
                aria-hidden="true"
              >
                {locked ? (
                  <Lock size={14} />
                ) : item.isCollection ? (
                  <Layers size={15} />
                ) : (
                  <Pencil size={14} />
                )}
              </span>
              <span className="se-row-main">
                <span className="se-row-name">
                  {item.name}
                  {locked ? (
                    <Lock size={12} className="se-row-lock-inline" aria-hidden="true" />
                  ) : null}
                </span>
                {item.description ? <span className="se-row-desc">{item.description}</span> : null}
              </span>
              <span className="se-row-meta">
                <span className="se-row-category">{item.category}</span>
                {item.location ? <span className="se-row-location">{item.location}</span> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
