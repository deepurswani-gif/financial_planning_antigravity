import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Send, Clock, FileText, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { listActiveCohorts } from '../../../services/adminCohortService';
import {
  createPushCampaign,
  deletePushTemplate,
  listCampaignDeliveries,
  listPushCampaigns,
  listPushTemplates,
  processDuePushCampaigns,
  savePushTemplate,
  sendPushCampaignNow,
} from '../../../services/adminPushCampaignService';
import PhonePreview from './PhonePreview';

const SECTIONS = [
  { id: 'design', label: 'Design', icon: Bell },
  { id: 'send', label: 'Send / Schedule', icon: Send },
  { id: 'reports', label: 'Reports', icon: FileText },
];

export default function PushCampaignsTab() {
  const [section, setSection] = useState('design');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [deepLinkUrl, setDeepLinkUrl] = useState('https://wealthmap.app/');
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [audienceType, setAudienceType] = useState('all_push');
  const [cohortId, setCohortId] = useState('');
  const [scheduleMode, setScheduleMode] = useState('now');
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reportId, setReportId] = useState(null);
  const [deliveries, setDeliveries] = useState([]);

  const load = useCallback(async () => {
    const [t, c, camps] = await Promise.all([
      listPushTemplates(),
      listActiveCohorts(),
      listPushCampaigns(),
    ]);
    if (!t.error) setTemplates(t.data);
    if (!c.error) setCohorts(c.data);
    if (!camps.error) setCampaigns(camps.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedCohort = useMemo(
    () => cohorts.find((c) => c.id === cohortId),
    [cohorts, cohortId],
  );

  const applyTemplate = (id) => {
    setSelectedTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTitle(t.title || '');
    setBody(t.body || '');
    setImageUrl(t.image_url || '');
    setDeepLinkUrl(t.deep_link_url || 'https://wealthmap.app/');
    setTemplateName(t.name || '');
  };

  const onSaveTemplate = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    if (!templateName.trim() || !title.trim() || !body.trim()) {
      setError('Template name, title, and body are required.');
      setBusy(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: err } = await savePushTemplate({
      id: selectedTemplateId || undefined,
      name: templateName,
      title,
      body,
      imageUrl,
      deepLinkUrl,
      createdBy: user?.id,
    });
    if (err) setError(err.message);
    else {
      setMessage('Template saved.');
      await load();
    }
    setBusy(false);
  };

  const onDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    setBusy(true);
    const { error: err } = await deletePushTemplate(id);
    if (err) setError(err.message);
    else {
      if (selectedTemplateId === id) setSelectedTemplateId('');
      await load();
    }
    setBusy(false);
  };

  const onSendOrSchedule = async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (!title.trim() || !body.trim()) {
        setError('Title and body are required. Fill them here or load a saved template.');
        return;
      }
      if (audienceType === 'cohort' && !cohortId) {
        setError('Select a cohort, or switch audience to “Everyone with push enabled”.');
        return;
      }

      let scheduledAt = null;
      if (scheduleMode === 'schedule') {
        if (!scheduledLocal) {
          setError('Pick a schedule date/time.');
          return;
        }
        scheduledAt = new Date(scheduledLocal).toISOString();
        if (Number.isNaN(Date.parse(scheduledAt))) {
          setError('Invalid schedule time.');
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: campaign, error: createErr } = await createPushCampaign({
        templateId: selectedTemplateId || null,
        title,
        body,
        imageUrl,
        deepLinkUrl,
        audienceType,
        cohortId,
        scheduledAt,
        createdBy: user?.id,
      });

      if (createErr || !campaign) {
        setError(createErr?.message || 'Could not create campaign.');
        return;
      }

      if (scheduleMode === 'schedule') {
        setMessage(`Scheduled for ${new Date(scheduledAt).toLocaleString()}.`);
        await load();
        return;
      }

      const { data: sendData, error: sendErr } = await sendPushCampaignNow(campaign.id);
      if (sendErr) {
        setError(sendErr.message);
      } else {
        setMessage(
          `Sent. Targeted ${sendData?.targeted ?? 0}, delivered ${sendData?.sent ?? 0}, failed ${sendData?.failed ?? 0}.`,
        );
      }
      await load();
    } catch (err) {
      setError(err?.message || 'Send failed unexpectedly.');
    } finally {
      setBusy(false);
    }
  };

  const onFlushDue = async () => {
    setBusy(true);
    setError('');
    const { data, error: err } = await processDuePushCampaigns();
    if (err) setError(err.message);
    else setMessage(`Processed ${data?.count ?? 0} due campaign(s).`);
    await load();
    setBusy(false);
  };

  const onOpenReport = async (campaignId) => {
    setReportId(campaignId);
    const { data, error: err } = await listCampaignDeliveries(campaignId);
    if (err) setError(err.message);
    else setDeliveries(data);
  };

  return (
    <div className="admin-push-campaigns">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Bell size={22} /> Push Campaigns
      </h2>
      <p style={{ color: 'var(--text-muted)', maxWidth: 720, marginBottom: '1.25rem' }}>
        Design notifications, save templates, send now or schedule, and target everyone with push
        enabled or a shared cohort.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            style={{
              ...chipBtn,
              background: section === id ? 'var(--primary)' : 'var(--bg-card)',
              color: section === id ? '#fff' : 'var(--text)',
              borderColor: section === id ? 'var(--primary)' : 'var(--border)',
            }}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {message ? <p style={{ color: 'var(--text-muted)' }}>{message}</p> : null}
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      {section === 'design' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(260px, 1.2fr) minmax(240px, 0.9fr)',
            gap: '1.5rem',
          }}
        >
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Notification designer</h3>
            <label style={labelStyle}>
              Template name (for save)
              <input
                style={inputStyle}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. SIP reminder"
              />
            </label>
            <label style={labelStyle}>
              Title
              <input
                style={inputStyle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="Keep it short"
              />
            </label>
            <label style={labelStyle}>
              Body
              <textarea
                style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={240}
              />
            </label>
            <label style={labelStyle}>
              Image URL (optional)
              <input
                style={inputStyle}
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label style={labelStyle}>
              Deep link URL
              <input
                style={inputStyle}
                value={deepLinkUrl}
                onChange={(e) => setDeepLinkUrl(e.target.value)}
              />
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" style={primaryBtn} disabled={busy} onClick={onSaveTemplate}>
                Save template
              </button>
              <button
                type="button"
                style={secondaryBtn}
                onClick={() => {
                  setTitle('');
                  setBody('');
                  setImageUrl('');
                  setTemplateName('');
                  setSelectedTemplateId('');
                }}
              >
                Clear
              </button>
            </div>

            <h4 style={{ marginTop: '1.5rem' }}>Saved templates</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {templates.map((t) => (
                <li
                  key={t.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    padding: '0.55rem 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => applyTemplate(t.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--text)',
                      padding: 0,
                    }}
                  >
                    <strong>{t.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.title}</div>
                  </button>
                  <button type="button" style={iconBtn} onClick={() => onDeleteTemplate(t.id)}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
              {!templates.length ? (
                <li style={{ color: 'var(--text-muted)' }}>No saved templates yet.</li>
              ) : null}
            </ul>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Preview</h3>
            <PhonePreview title={title} body={body} imageUrl={imageUrl} />
          </div>
        </div>
      ) : null}

      {section === 'send' ? (
        <form
          onSubmit={onSendOrSchedule}
          style={{ ...card, maxWidth: 720 }}
        >
          <h3 style={{ marginTop: 0 }}>Send or schedule</h3>
          {message ? (
            <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>{message}</p>
          ) : null}
          {error ? <p style={{ color: '#b91c1c', marginTop: 0 }}>{error}</p> : null}
          <label style={labelStyle}>
            Load saved template (optional)
            <select
              style={inputStyle}
              value={selectedTemplateId}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="">— Compose new / current design —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Title
            <input
              style={inputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Body
            <textarea
              style={{ ...inputStyle, minHeight: 90 }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>

          <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 1rem' }}>
            <legend style={{ padding: '0 0.35rem' }}>Audience</legend>
            <label style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="radio"
                name="audience"
                checked={audienceType === 'all_push'}
                onChange={() => setAudienceType('all_push')}
              />
              Everyone with push enabled
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="radio"
                name="audience"
                checked={audienceType === 'cohort'}
                onChange={() => setAudienceType('cohort')}
              />
              Saved cohort
            </label>
            {audienceType === 'cohort' ? (
              <>
                <select
                  style={inputStyle}
                  value={cohortId}
                  onChange={(e) => setCohortId(e.target.value)}
                >
                  <option value="">Select cohort…</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.member_count} members)
                    </option>
                  ))}
                </select>
                {selectedCohort ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Reach snapshot: {selectedCohort.member_count} members
                    {selectedCohort.last_refreshed_at
                      ? ` · refreshed ${new Date(selectedCohort.last_refreshed_at).toLocaleString()}`
                      : ''}
                    . Refresh the cohort under the Cohorts tab if plans changed.
                  </p>
                ) : null}
              </>
            ) : null}
          </fieldset>

          <fieldset
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.75rem 1rem',
              marginTop: '1rem',
            }}
          >
            <legend style={{ padding: '0 0.35rem' }}>When</legend>
            <label style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="radio"
                name="when"
                checked={scheduleMode === 'now'}
                onChange={() => setScheduleMode('now')}
              />
              Immediately
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="radio"
                name="when"
                checked={scheduleMode === 'schedule'}
                onChange={() => setScheduleMode('schedule')}
              />
              Schedule for later
            </label>
            {scheduleMode === 'schedule' ? (
              <input
                type="datetime-local"
                style={inputStyle}
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
              />
            ) : null}
          </fieldset>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={primaryBtn}
              disabled={busy}
              onClick={onSendOrSchedule}
            >
              {busy ? (
                'Working…'
              ) : scheduleMode === 'schedule' ? (
                <>
                  <Clock size={16} style={{ verticalAlign: 'middle' }} /> Schedule campaign
                </>
              ) : (
                <>
                  <Send size={16} style={{ verticalAlign: 'middle' }} /> Send now
                </>
              )}
            </button>
            <button type="button" style={secondaryBtn} disabled={busy} onClick={onFlushDue}>
              Process due schedules
            </button>
          </div>
        </form>
      ) : null}

      {section === 'reports' ? (
        <div>
          <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>Title</th>
                  <th style={th}>Audience</th>
                  <th style={th}>Status</th>
                  <th style={th}>Stats</th>
                  <th style={th}>When</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td style={td}>
                      <strong>{c.title}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {c.body?.slice(0, 80)}
                        {c.body?.length > 80 ? '…' : ''}
                      </div>
                    </td>
                    <td style={td}>
                      {c.audience_type === 'cohort'
                        ? `Cohort: ${c.cohorts?.name || c.cohort_id?.slice(0, 8) || '—'}`
                        : 'All with push'}
                    </td>
                    <td style={td}>{c.status}</td>
                    <td style={td}>
                      {c.stats
                        ? `${c.stats.sent ?? 0} sent / ${c.stats.failed ?? 0} failed / ${c.stats.targeted ?? 0} targeted`
                        : '—'}
                    </td>
                    <td style={td}>
                      {c.scheduled_at
                        ? `Sched ${new Date(c.scheduled_at).toLocaleString()}`
                        : new Date(c.created_at).toLocaleString()}
                    </td>
                    <td style={td}>
                      <button type="button" style={secondaryBtn} onClick={() => onOpenReport(c.id)}>
                        Deliveries
                      </button>
                    </td>
                  </tr>
                ))}
                {!campaigns.length ? (
                  <tr>
                    <td style={td} colSpan={6}>
                      No campaigns yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {reportId ? (
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Deliveries</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={th}>User</th>
                      <th style={th}>Email</th>
                      <th style={th}>Status</th>
                      <th style={th}>Token</th>
                      <th style={th}>Error</th>
                      <th style={th}>Sent at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr key={d.id}>
                        <td style={td}>{d.full_name || d.user_id?.slice(0, 8)}</td>
                        <td style={td}>{d.email || '—'}</td>
                        <td style={td}>{d.status}</td>
                        <td style={td}>{d.token_suffix ? `…${d.token_suffix}` : '—'}</td>
                        <td style={td}>{d.error || '—'}</td>
                        <td style={td}>
                          {d.sent_at ? new Date(d.sent_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                    {!deliveries.length ? (
                      <tr>
                        <td style={td} colSpan={6}>
                          No delivery rows for this campaign.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const card = {
  padding: '1.25rem',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg-main)',
};
const labelStyle = { display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem' };
const inputStyle = {
  display: 'block',
  width: '100%',
  marginTop: '0.35rem',
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
const chipBtn = {
  ...secondaryBtn,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};
const iconBtn = { ...secondaryBtn, padding: '0.35rem 0.5rem' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' };
const th = { textAlign: 'left', padding: '0.65rem', borderBottom: '2px solid var(--border)' };
const td = { padding: '0.65rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };
