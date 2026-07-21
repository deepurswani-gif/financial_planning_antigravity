import React, { useMemo, useState } from 'react';
import {
  QUESTION_REGISTRY,
  getFieldById,
  getRegistryDiagnostics,
  listUiCategories,
  searchQuestionFields,
} from '../../questionRegistry';
import { LEVELS } from '../../questionRegistry/priorities';
import { DOMAIN_IDS } from '../../questionRegistry/domains';
import './registryExplorer.css';

/**
 * DEV-only Canonical Question Registry explorer.
 * Not part of the end-user product — for implementation, debugging, and QA.
 */
export default function RegistryExplorer() {
  const [query, setQuery] = useState('');
  const [uiCategory, setUiCategory] = useState('');
  const [domain, setDomain] = useState('');
  const [importance, setImportance] = useState('');
  const [quickEditPriority, setQuickEditPriority] = useState('');
  const [selectedId, setSelectedId] = useState(QUESTION_REGISTRY[0]?.id ?? '');

  const diagnostics = useMemo(() => getRegistryDiagnostics(), []);

  const filtered = useMemo(() => {
    let fields = searchQuestionFields(query);
    if (uiCategory) fields = fields.filter((f) => f.uiCategory === uiCategory);
    if (domain) fields = fields.filter((f) => f.domain === domain);
    if (importance) fields = fields.filter((f) => f.importance === importance);
    if (quickEditPriority) {
      fields = fields.filter((f) => f.quickEditPriority === quickEditPriority);
    }
    return fields;
  }, [query, uiCategory, domain, importance, quickEditPriority]);

  const selected = getFieldById(selectedId) ?? filtered[0] ?? null;

  return (
    <div className="qr-explorer">
      <header className="qr-explorer-header">
        <div>
          <p className="qr-explorer-eyebrow">Developer tool · not shipped to end users</p>
          <h1>Question Registry Explorer</h1>
          <p className="qr-explorer-sub">
            {QUESTION_REGISTRY.length} canonical entries · Phase 2 Detailed + Summary seed
          </p>
        </div>
        <div className="qr-explorer-stats">
          <span className={diagnostics.ok ? 'qr-ok' : 'qr-err'}>
            {diagnostics.ok ? 'Schema OK' : `${diagnostics.errorCount} errors`}
          </span>
          <span className="qr-warn">{diagnostics.warningCount} warnings</span>
        </div>
      </header>

      <div className="qr-explorer-filters">
        <input
          type="search"
          placeholder="Search id, label, or alias…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search registry"
        />
        <select value={uiCategory} onChange={(e) => setUiCategory(e.target.value)} aria-label="UI category">
          <option value="">All UI categories</option>
          {listUiCategories().map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Domain">
          <option value="">All domains</option>
          {DOMAIN_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <select
          value={importance}
          onChange={(e) => setImportance(e.target.value)}
          aria-label="Importance"
        >
          <option value="">All importance</option>
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              importance: {level}
            </option>
          ))}
        </select>
        <select
          value={quickEditPriority}
          onChange={(e) => setQuickEditPriority(e.target.value)}
          aria-label="Quick Edit priority"
        >
          <option value="">All Quick Edit priority</option>
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              quickEdit: {level}
            </option>
          ))}
        </select>
      </div>

      <div className="qr-explorer-body">
        <aside className="qr-explorer-list" aria-label="Registry entries">
          {filtered.map((field) => (
            <button
              key={field.id}
              type="button"
              className={`qr-explorer-item ${selected?.id === field.id ? 'is-active' : ''}`}
              onClick={() => setSelectedId(field.id)}
            >
              <span className="qr-explorer-item-label">{field.label}</span>
              <span className="qr-explorer-item-id">{field.id}</span>
              <span className="qr-explorer-item-meta">
                {field.importance} · QE {field.quickEditPriority}
              </span>
            </button>
          ))}
          {!filtered.length && <p className="qr-explorer-empty">No matching fields.</p>}
        </aside>

        <main className="qr-explorer-detail" aria-label="Field metadata">
          {selected ? <FieldDetail field={selected} /> : <p>Select a field.</p>}
        </main>

        <aside className="qr-explorer-diagnostics" aria-label="Diagnostics">
          <h2>Diagnostics</h2>
          {!diagnostics.issues.length && <p className="qr-ok">No issues detected.</p>}
          <ul>
            {diagnostics.issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.fieldId}-${index}`} className={`qr-${issue.severity === 'error' ? 'err' : 'warn'}`}>
                <strong>{issue.code}</strong>
                {issue.fieldId ? ` · ${issue.fieldId}` : ''}
                <div>{issue.message}</div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function FieldDetail({ field }) {
  return (
    <div>
      <h2>{field.label}</h2>
      <p className="qr-explorer-item-id">{field.id}</p>

      <MetaGrid
        rows={[
          ['Kind', field.kind],
          ['UI category', field.uiCategory],
          ['Domain', field.domain],
          ['Importance', field.importance],
          ['Quick Edit priority', field.quickEditPriority],
          ['Value type', field.valueType ?? '—'],
          ['Edit experience', field.editExperience?.type ?? '—'],
          ['Save scope', field.savePolicy?.scope ?? '—'],
          ['State path', field.state?.path ?? '—'],
        ]}
      />

      {field.businessMeaning && (
        <section>
          <h3>Business meaning</h3>
          <p>{field.businessMeaning}</p>
        </section>
      )}

      <section>
        <h3>Aliases</h3>
        <p>{(field.aliases ?? []).join(', ') || '—'}</p>
      </section>

      <section>
        <h3>Visibility</h3>
        <pre>{JSON.stringify(field.visibility ?? {}, null, 2)}</pre>
      </section>

      <section>
        <h3>Edit experience</h3>
        <pre>{JSON.stringify(field.editExperience, null, 2)}</pre>
      </section>

      <section>
        <h3>Edit surfaces (question / section mappings)</h3>
        <pre>{JSON.stringify(field.editSurfaces ?? [], null, 2)}</pre>
      </section>

      <section>
        <h3>Capability / preferred surface</h3>
        <pre>{JSON.stringify(field.preferredSurface ?? {}, null, 2)}</pre>
      </section>

      <section>
        <h3>Impacts</h3>
        <ul>
          {(field.impacts ?? []).map((impact) => (
            <li key={impact}>{impact}</li>
          ))}
          {!(field.impacts ?? []).length && <li>—</li>}
        </ul>
      </section>

      <section>
        <h3>Related fields</h3>
        <p>{(field.relatedFieldIds ?? []).join(', ') || '—'}</p>
      </section>

      {field.kind === 'collection' && (
        <section>
          <h3>Collection item fields</h3>
          <p>{(field.itemFieldIds ?? []).join(', ')}</p>
        </section>
      )}

      <section>
        <h3>Full JSON</h3>
        <pre>{JSON.stringify(field, null, 2)}</pre>
      </section>
    </div>
  );
}

function MetaGrid({ rows }) {
  return (
    <dl className="qr-meta-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
