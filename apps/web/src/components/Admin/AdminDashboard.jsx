import { BarChart3, CheckCircle, Copy, Download, FileText, LayoutDashboard, Link2, LogOut, Shield, Users, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../services/authService';
import ClientFinancialDossier from './ClientFinancialDossier';
import BusinessAnalyticsShell from './analytics/BusinessAnalyticsShell';
import { openAdminFinancialPlanPrint } from '../../utils/adminFinancialPlanPrint';

const AdminDashboard = () => {
  const [clients, setClients] = useState([]);
  const [reports, setReports] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [stats, setStats] = useState({ totalClients: 0, totalReports: 0, usedCoupons: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics');
  const [analyticsDossier, setAnalyticsDossier] = useState(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Get all clients (user_profiles)
      const { data: clientsData } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // Get all reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('financial_plans')
        .select('id, plan_name, current_step, family_members, created_at, updated_at')
        .order('created_at', { ascending: false });
        
      if (reportsError) {
        console.error("Reports Fetch Error:", reportsError);
      }

      // Get all coupons (Will fail until DB is updated, handled via try-catch or safe fetching later if needed, 
      // but for now we mock or fetch if table exists. We'll wrap in its own try/catch)
      let couponsData = [];
      try {
          const { data: cData } = await supabase.from('coupon_codes').select('*');
          if (cData) couponsData = cData;
      } catch (e) { console.warn("Coupon table might not exist yet."); }

      setClients(clientsData || []);
      setReports(reportsData || []);
      setCoupons(couponsData || []);

      // Calculate stats
      setStats({
        totalClients: clientsData?.length || 0,
        totalReports: reportsData?.length || 0,
        usedCoupons: couponsData?.filter((c) => c.is_used === true).length || 0,
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
    setLoading(false);
  };

  const handleApproveAgent = async (agentId) => {
    try {
      await supabase
        .from('user_profiles')
        .update({ is_approved: true })
        .eq('id', agentId);
      loadAdminData();
    } catch (error) {
      console.error('Error approving agent:', error);
    }
  };

  const handleRejectAgent = async (agentId) => {
    try {
      await supabase
        .from('user_profiles')
        .update({ is_approved: false })
        .eq('id', agentId);
      loadAdminData();
    } catch (error) {
      console.error('Error rejecting agent:', error);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const openAnalyticsClient = async (row) => {
    try {
      let planId = row?.plan_id;
      if (!planId && row?.user_id) {
        const { data: plans } = await supabase
          .from('financial_plans')
          .select('id')
          .eq('user_id', row.user_id)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1);
        planId = plans?.[0]?.id;
      }
      if (!planId) {
        window.alert('No financial plan found for this user.');
        return;
      }
      const { data, error } = await supabase
        .from('financial_plans')
        .select('*')
        .eq('id', planId)
        .single();
      if (error || !data) {
        window.alert('Could not open client dossier for this user.');
        console.error(error);
        return;
      }
      setAnalyticsDossier(data);
    } catch (err) {
      console.error(err);
    }
  };

  if (analyticsDossier) {
    return (
      <div className="admin-dashboard">
        <ClientFinancialDossier
          report={analyticsDossier}
          onBack={() => setAnalyticsDossier(null)}
        />
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Shield size={28} color="var(--primary)" />
          <h1>Admin Portal</h1>
        </div>
        <button 
          className="btn"
          onClick={handleLogout}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            background: 'transparent',
            border: '1px solid var(--border)'
          }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </header>

      {/* Stats Overview — hide on analytics to keep CEO view clean */}
      {activeTab !== 'analytics' && (
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--primary)10', borderRadius: '8px' }}>
              <Users size={24} color="var(--primary)" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Total Clients</p>
              <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '700' }}>{stats.totalClients}</h2>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--accent)10', borderRadius: '8px' }}>
              <FileText size={24} color="var(--accent)" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Total Reports</p>
              <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '700' }}>{stats.totalReports}</h2>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#dcfce7', borderRadius: '8px' }}>
              <Tag size={24} color="#15803d" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Used Coupons</p>
              <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '700' }}>{stats.usedCoupons}</h2>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Tabs */}
      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <LayoutDashboard size={18} /> Business Analytics
        </button>
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 size={18} /> Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'clients' ? 'active' : ''}`}
          onClick={() => setActiveTab('clients')}
        >
          <Users size={18} /> Clients ({stats.totalClients})
        </button>
        <button 
          className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <FileText size={18} /> Reports ({stats.totalReports})
        </button>
        <button 
          className={`tab-button ${activeTab === 'coupons' ? 'active' : ''}`}
          onClick={() => setActiveTab('coupons')}
        >
          <Tag size={18} /> Coupon Manager
        </button>
      </div>

      {/* Tab Content */}
      <div className="admin-content">
        {activeTab === 'analytics' ? (
          <BusinessAnalyticsShell onOpenClient={openAnalyticsClient} />
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>
        ) : activeTab === 'overview' ? (
          <OverviewTab stats={stats} reports={reports} clients={clients} coupons={coupons} />
        ) : activeTab === 'clients' ? (
          <ClientsTab clients={clients} />
        ) : activeTab === 'reports' ? (
          <ReportsTab reports={reports} clients={clients} />
        ) : (
          <CouponsTab coupons={coupons} loadAdminData={loadAdminData} />
        )}
      </div>

      <style jsx>{`
        .admin-dashboard {
          min-height: 100vh;
          background: var(--bg-main);
          padding: 2rem;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--border);
        }

        .admin-header h1 {
          margin: 0;
          font-size: 1.875rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }

        .stat-card:hover {
          border-color: var(--primary);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .admin-tabs {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          border-bottom: 1px solid var(--border);
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 0.9375rem;
          font-weight: 500;
        }

        .tab-button:hover {
          color: var(--text);
        }

        .tab-button.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }

        .admin-content {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 2rem;
          min-height: 400px;
        }
      `}</style>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ stats, reports }) => {
  return (
    <div>
      <h2>Dashboard Overview</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
        <div style={{ padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Registered Clients</p>
          <h3 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--primary)' }}>{stats.totalClients}</h3>
        </div>
        <div style={{ padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Generated Reports</p>
          <h3 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--accent)' }}>{stats.totalReports}</h3>
        </div>
        <div style={{ padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Used VIP Coupons</p>
          <h3 style={{ margin: 0, fontSize: '1.75rem', color: '#15803d' }}>{stats.usedCoupons}</h3>
        </div>
      </div>

      <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Recently Updated Plans</h3>
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {reports.slice(0, 10).map(report => {
          // Extract primary member name from JSON if available
          const primaryMember = Array.isArray(report.family_members) && report.family_members.length > 0 
            ? report.family_members[0].name 
            : report.user_profiles?.full_name;
            
          return (
          <div key={report.id} style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '8px', marginBottom: '0.75rem', borderLeft: '4px solid var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '600' }}>{report.plan_name}</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Client: {primaryMember || 'Unnamed'} (Step {report.current_step || 1}/12)
                </p>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {new Date(report.updated_at || report.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
};

// Clients Tab Component
const ClientsTab = ({ clients }) => {
  return (
    <div>
      <h2>Client Roster</h2>
      <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '1rem', fontWeight: '600' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '1rem', fontWeight: '600' }}>Email</th>
              <th style={{ textAlign: 'left', padding: '1rem', fontWeight: '600' }}>Registered On</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(client => (
              <tr key={client.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem' }}>{client.full_name || 'Anonymous'}</td>
                <td style={{ padding: '1rem' }}>{client.email || 'No email provided'}</td>
                <td style={{ padding: '1rem' }}>{new Date(client.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Reports Tab Component
const ReportsTab = ({ reports, clients }) => {
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [pdfLoadingId, setPdfLoadingId] = useState(null);

  const exportClientPdf = async (reportId) => {
    setPdfLoadingId(reportId);
    try {
      const { data, error } = await supabase
        .from('financial_plans')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error || !data) {
        window.alert('Could not load this plan for export. Check console for details.');
        console.error(error);
        return;
      }
      const clientMeta = (clients || []).find((c) => c.id === data.user_id) || null;
      openAdminFinancialPlanPrint(data, clientMeta);
    } catch (e) {
      console.error(e);
      window.alert('Export failed.');
    } finally {
      setPdfLoadingId(null);
    }
  };

  const viewDossier = async (id) => {
    setLoadingDossier(true);
    try {
      const { data, error } = await supabase
        .from('financial_plans')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        console.error("Error fetching full report:", error);
        alert("Failed to fetch full report payload.");
      } else {
        setSelectedDossier(data);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingDossier(false);
  };

  if (selectedDossier) {
    return <ClientFinancialDossier report={selectedDossier} onBack={() => setSelectedDossier(null)} />;
  }

  return (
    <div>
      <h2>All Diagnostic Reports</h2>
      {loadingDossier && <p style={{ color: 'var(--primary)', fontWeight: 600 }}>Loading raw dossier data...</p>}
      <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
        {reports.map(report => {
          const primaryMember = Array.isArray(report.family_members) && report.family_members.length > 0 
            ? report.family_members[0].name 
            : report.user_profiles?.full_name;

          return (
          <div key={report.id} style={{
            padding: '1.5rem',
            background: 'var(--bg-main)',
            borderRadius: '8px',
            borderLeft: '4px solid var(--accent)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>{report.plan_name}</h3>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  <strong>Client Primary:</strong> {primaryMember || 'Unnamed'}
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  <strong>Module Progress:</strong> Step {report.current_step || 1} / 12
                </p>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <div>
                  <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Created: {new Date(report.created_at).toLocaleDateString()}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Updated: {new Date(report.updated_at || report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={pdfLoadingId === report.id || loadingDossier}
                    onClick={() => exportClientPdf(report.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      cursor: pdfLoadingId === report.id ? 'wait' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <Download size={16} aria-hidden />
                    {pdfLoadingId === report.id ? 'Preparing…' : 'Export PDF'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => viewDossier(report.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600
                    }}
                  >
                    View Client Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
};

const APP_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL?.replace(/\/+$/, '')) ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

const randomCouponSuffix = () => {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 10).toUpperCase();
};

const buildInviteUrl = (code, targetEmail) =>
  `${APP_BASE}/?invite=1&code=${encodeURIComponent(code)}&email=${encodeURIComponent(targetEmail)}`;

// Coupons Tab Component
const CouponsTab = ({ coupons, loadAdminData }) => {
  const [email, setEmail] = useState('');
  const [generating, setGenerating] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

  const generateCoupon = async (e) => {
    e.preventDefault();
    if (!email) return;
    setGenerating(true);
    setEmailStatus(null);

    const emailsArray = email
      .split(/[\n,]+/)
      .map((str) => str.trim())
      .filter((str) => str.length > 0);

    const payloads = emailsArray.map((target) => ({
      code: `FIN-${randomCouponSuffix()}`,
      target_email: target,
      is_used: false,
    }));

    try {
      const { data: inserted, error } = await supabase.from('coupon_codes').insert(payloads).select('code');
      if (error) {
        alert(`Failed to generate coupons. ${error.message}`);
        console.error(error);
        return;
      }
      setEmail('');
      await loadAdminData();
      if (inserted?.length) {
        setEmailStatus(`Generated ${inserted.length} coupon${inserted.length === 1 ? '' : 's'}. Copy the invite link from the table below to share with each client.`);
      }
    } catch (err) {
      console.error(err);
    }
    setGenerating(false);
  };

  const copyText = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setEmailStatus(`Copied ${label}.`);
      window.setTimeout(() => setEmailStatus(null), 2500);
    } catch {
      setEmailStatus('Clipboard not available.');
    }
  };

  return (
    <div>
      <h2>Coupon & access manager</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', maxWidth: '720px' }}>
        Each coupon works <strong>once</strong> and only for the <strong>exact email</strong> you enter. Apply the DB migration so{' '}
        <code style={{ fontSize: '0.85rem' }}>coupon_codes</code> exists. After generating, use the &ldquo;Invite link&rdquo; button in the table below to copy a personalized signup URL and share it with the client.
      </p>

      <div
        style={{
          padding: '1.5rem',
          background: 'var(--bg-main)',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid var(--border)',
        }}
      >
        <h4 style={{ margin: '0 0 1rem 0' }}>Create coupons</h4>
        <form onSubmit={generateCoupon}>
          <textarea
            placeholder="Client emails (comma or newline separated)…"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text)',
              minHeight: '100px',
              fontFamily: 'inherit',
              resize: 'vertical',
              marginBottom: '1rem',
            }}
            required
          />
          <button
            type="submit"
            disabled={generating}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary)',
              color: 'white',
              fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? 'Saving…' : 'Generate coupons'}
          </button>
        </form>
        {emailStatus && (
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{emailStatus}</p>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Code</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Target email</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Used at</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Created</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No coupons yet. Create some above.
                </td>
              </tr>
            ) : (
              coupons.map((c) => {
                const invite = buildInviteUrl(c.code, c.target_email);
                return (
                  <tr key={c.id || c.code} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--accent)' }}>
                      {c.code}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{c.target_email}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.65rem',
                          borderRadius: '999px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          background: c.is_used ? '#fef08a' : '#dcfce7',
                          color: c.is_used ? '#854d0e' : '#15803d',
                        }}
                      >
                        {c.is_used ? 'Redeemed' : 'Available'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {c.used_at ? new Date(c.used_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => copyText('code', c.code)}
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Copy size={12} /> Code
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => copyText('link', invite)}
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Link2 size={12} /> Invite link
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
