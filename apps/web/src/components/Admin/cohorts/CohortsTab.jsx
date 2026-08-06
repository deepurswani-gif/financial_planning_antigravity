import { useCallback, useEffect, useState } from 'react';
import { Layers, RefreshCw, Archive, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import {
  COHORT_FILTER_TYPES,
  archiveCohort,
  buildRules,
  createCohort,
  listCohortMembers,
  listCohorts,
  previewCohortRules,
  refreshCohort,
} from '../../../services/adminCohortService';

const emptyFilter = () => ({ type: 'has_sip', amount: '' });

export default function CohortsTab() {
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filters, setFilters] = useState([emptyFilter()]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [members, setMembers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await listCohorts();
    if (err) setError(err.message);
    else setCohorts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rules = buildRules(
    filters.map((f) => {
      if (f.type === 'income_gte') {
        const amount = Number(f.amount);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return { type: 'income_gte', amount };
      }
      return { type: f.type };
    }),
  );

  const onPreview = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    if (!rules.filters.length) {
      setError('Add at least one rule.');
      setBusy(false);
      return;
    }
    const { data, error: err } = await previewCohortRules(rules);
    if (err) setError(err.message);
    else {
      setPreview(data);
      setMessage(`Preview: ${data?.count ?? 0} matching users`);
    }
    setBusy(false);
  };

  const onCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    if (!name.trim()) {
      setError('Name is required.');
      setBusy(false);
      return;
    }
    if (!rules.filters.length) {
      setError('Add at least one rule.');
      setBusy(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: created, error: createErr } = await createCohort({
      name,
      description,
      rules,
      createdBy: user?.id,
    });
    if (createErr) {
      setError(createErr.message);
      setBusy(false);
      return;
    }
    const { data: refreshed, error: refreshErr } = await refreshCohort(created.id);
    if (refreshErr) {
      setError(`Created but refresh failed: ${refreshErr.message}`);
    } else {
      setMessage(`Cohort saved with ${refreshed?.member_count ?? 0} members.`);
      setName('');
      setDescription('');
      setFilters([emptyFilter()]);
      setPreview(null);
    }
    await load();
    setBusy(false);
  };

  const onRefresh = async (cohortId) => {
    setBusy(true);
    setError('');
    const { data, error: err } = await refreshCohort(cohortId);
    if (err) setError(err.message);
    else setMessage(`Refreshed: ${data?.member_count ?? 0} members`);
    await load();
    if (selectedId === cohortId) {
      const { data: m } = await listCohortMembers(cohortId);
      setMembers(m);
    }
    setBusy(false);
  };

  const onArchive = async (cohortId) => {
    if (!window.confirm('Archive this cohort? It will no longer appear in send targeting.')) return;
    setBusy(true);
    const { error: err } = await archiveCohort(cohortId);
    if (err) setError(err.message);
    else setMessage('Cohort archived.');
    if (selectedId === cohortId) {
      setSelectedId(null);
      setMembers([]);
    }
    await load();
    setBusy(false);
  };

  const onViewMembers = async (cohortId) => {
    setSelectedId(cohortId);
    const { data, error: err } = await listCohortMembers(cohortId);
    if (err) setError(err.message);
    else setMembers(data);
  };

  return (
    <div className="admin-cohorts">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Layers size={22} /> Cohorts
      </h2>
      <p style={{ color: 'var(--text-muted)', maxWidth: 720, marginBottom: '1.5rem' }}>
        Shared audiences for push campaigns and future analytics. Membership is snapshotted on
        refresh; FCM delivery always uses live device tokens.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <form
          onSubmit={onCreate}
          style={{
            padding: '1.25rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-main)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Create cohort</h3>
          <label style={labelStyle}>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={inputStyle}
              placeholder="e.g. High income + SIP"
            />
          </label>
          <label style={labelStyle}>
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={inputStyle}
              placeholder="Optional"
            />
          </label>

          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Rules (AND)</div>
            {filters.map((f, idx) => {
              const meta = COHORT_FILTER_TYPES.find((t) => t.type === f.type);
              return (
                <div
                  key={idx}
                  style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}
                >
                  <select
                    value={f.type}
                    onChange={(e) => {
                      const next = [...filters];
                      next[idx] = { ...next[idx], type: e.target.value };
                      setFilters(next);
                    }}
                    style={{ ...inputStyle, marginBottom: 0, flex: 1, minWidth: 160 }}
                  >
                    {COHORT_FILTER_TYPES.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {meta?.needsAmount ? (
                    <input
                      type="number"
                      min="1"
                      step="1000"
                      placeholder="₹ amount"
                      value={f.amount}
                      onChange={(e) => {
                        const next = [...filters];
                        next[idx] = { ...next[idx], amount: e.target.value };
                        setFilters(next);
                      }}
                      style={{ ...inputStyle, marginBottom: 0, width: 140 }}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setFilters(filters.filter((_, i) => i !== idx))}
                    disabled={filters.length === 1}
                    style={secondaryBtn}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setFilters([...filters, emptyFilter()])}
              style={{ ...secondaryBtn, marginTop: '0.25rem' }}
            >
              Add rule
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <button type="button" disabled={busy} onClick={onPreview} style={secondaryBtn}>
              Preview
            </button>
            <button type="submit" disabled={busy} style={primaryBtn}>
              {busy ? 'Saving…' : 'Save & refresh'}
            </button>
          </div>
          {message ? (
            <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem' }}>{message}</p>
          ) : null}
          {error ? <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</p> : null}
        </form>

        <div
          style={{
            padding: '1.25rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-main)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Preview sample</h3>
          {preview ? (
            <>
              <p style={{ fontWeight: 600 }}>{preview.count} users match</p>
              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={th}>Name</th>
                      <th style={th}>Email</th>
                      <th style={th}>Push</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.sample || []).map((row) => (
                      <tr key={row.user_id}>
                        <td style={td}>{row.display_name || '—'}</td>
                        <td style={td}>{row.email || '—'}</td>
                        <td style={td}>{row.has_push_enabled ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Run Preview to estimate reach.</p>
          )}
        </div>
      </div>

      <h3>Saved cohorts</h3>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Status</th>
                <th style={th}>Members</th>
                <th style={th}>Last refreshed</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.id}>
                  <td style={td}>
                    <strong>{c.name}</strong>
                    {c.description ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {c.description}
                      </div>
                    ) : null}
                  </td>
                  <td style={td}>{c.status}</td>
                  <td style={td}>{c.member_count}</td>
                  <td style={td}>
                    {c.last_refreshed_at
                      ? new Date(c.last_refreshed_at).toLocaleString()
                      : 'Never'}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        style={iconBtn}
                        disabled={busy || c.status === 'archived'}
                        onClick={() => onRefresh(c.id)}
                        title="Refresh"
                      >
                        <RefreshCw size={14} /> Refresh
                      </button>
                      <button
                        type="button"
                        style={iconBtn}
                        onClick={() => onViewMembers(c.id)}
                        title="Members"
                      >
                        <Users size={14} /> Members
                      </button>
                      {c.status === 'active' ? (
                        <button
                          type="button"
                          style={iconBtn}
                          disabled={busy}
                          onClick={() => onArchive(c.id)}
                        >
                          <Archive size={14} /> Archive
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!cohorts.length ? (
                <tr>
                  <td style={td} colSpan={5}>
                    No cohorts yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {selectedId ? (
        <div>
          <h3>Members</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Push</th>
                  <th style={th}>Token (suffix)</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td style={td}>{m.display_name || '—'}</td>
                    <td style={td}>{m.email || '—'}</td>
                    <td style={td}>{m.has_push_enabled ? 'Yes' : 'No'}</td>
                    <td style={td}>
                      {m.fcm_token ? `…${String(m.fcm_token).slice(-12)}` : '—'}
                    </td>
                  </tr>
                ))}
                {!members.length ? (
                  <tr>
                    <td style={td} colSpan={4}>
                      No members. Refresh the cohort.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem' };
const inputStyle = {
  display: 'block',
  width: '100%',
  marginTop: '0.35rem',
  marginBottom: '0.25rem',
  padding: '0.65rem 0.75rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text)',
  boxSizing: 'border-box',
};
const primaryBtn = {
  padding: '0.65rem 1.25rem',
  borderRadius: 8,
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};
const secondaryBtn = {
  padding: '0.55rem 0.9rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text)',
  cursor: 'pointer',
};
const iconBtn = { ...secondaryBtn, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' };
const th = { textAlign: 'left', padding: '0.65rem', borderBottom: '2px solid var(--border)' };
const td = { padding: '0.65rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };
