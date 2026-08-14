import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, Shield, Trash2, UserPlus, X } from 'lucide-react';

const PERMISSIONS = [
  { id: 'analytics', label: 'Business Analytics' },
  { id: 'overview', label: 'Overview' },
  { id: 'clients', label: 'Clients' },
  { id: 'reports', label: 'Reports' },
  { id: 'coupons', label: 'Coupons' },
  { id: 'cohorts', label: 'Cohorts' },
  { id: 'push-campaigns', label: 'Push Campaigns' },
];

const TeamTab = ({ teamMembers, currentUserProfile, loadAdminData }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    permissions: [], // empty array means no access, we'll let them check boxes
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isMasterAdmin = currentUserProfile?.admin_permissions === null;

  if (!isMasterAdmin) {
    return <div>Access Denied</div>;
  }

  const togglePermission = (permId) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId],
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-subadmin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'create',
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            permissions: formData.permissions,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create sub-admin');
      }
      setIsCreating(false);
      setFormData({ email: '', password: '', full_name: '', permissions: [] });
      await loadAdminData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this sub-admin account? This cannot be undone.')) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-subadmin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'delete',
            userId,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete sub-admin');
      }
      await loadAdminData();
    } catch (err) {
      setError(err.message);
      alert('Error deleting sub-admin: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Team & Access Control</h2>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            <UserPlus size={18} /> Add Sub-Admin
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {isCreating && (
        <div style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0 }}>Create New Sub-Admin</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem', maxWidth: '500px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Full Name</label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Email Address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Temporary Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: '500' }}>Access Permissions</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {PERMISSIONS.map((perm) => (
                  <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(perm.id)}
                      onChange={() => togglePermission(perm.id)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  flex: 1,
                }}
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card)' }}>
              <th style={{ textAlign: 'left', padding: '1rem', fontWeight: '600' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '1rem', fontWeight: '600' }}>Email</th>
              <th style={{ textAlign: 'left', padding: '1rem', fontWeight: '600' }}>Role</th>
              <th style={{ textAlign: 'left', padding: '1rem', fontWeight: '600' }}>Permissions</th>
              <th style={{ textAlign: 'right', padding: '1rem', fontWeight: '600' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((member) => (
              <tr key={member.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem' }}>{member.full_name || '—'}</td>
                <td style={{ padding: '1rem' }}>{member.email}</td>
                <td style={{ padding: '1rem' }}>
                  {member.admin_permissions === null ? (
                    <span style={{ padding: '0.25rem 0.75rem', background: 'var(--primary)15', color: 'var(--primary)', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Shield size={14} /> Master Admin
                    </span>
                  ) : (
                    <span style={{ padding: '0.25rem 0.75rem', background: 'var(--accent)15', color: 'var(--accent)', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                      Sub-Admin
                    </span>
                  )}
                </td>
                <td style={{ padding: '1rem' }}>
                  {member.admin_permissions === null ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>All Access</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {Array.isArray(member.admin_permissions) && member.admin_permissions.length > 0 ? (
                        member.admin_permissions.map(perm => {
                          const label = PERMISSIONS.find(p => p.id === perm)?.label || perm;
                          return (
                            <span key={perm} style={{ padding: '0.2rem 0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.75rem' }}>
                              {label}
                            </span>
                          );
                        })
                      ) : (
                        <span style={{ color: '#991b1b', fontSize: '0.875rem' }}>No Access</span>
                      )}
                    </div>
                  )}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  {member.id !== currentUserProfile.id && member.admin_permissions !== null && (
                    <button
                      onClick={() => handleDelete(member.id)}
                      disabled={loading}
                      style={{
                        padding: '0.5rem',
                        background: 'transparent',
                        color: '#ef4444',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      title="Delete Sub-Admin"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamTab;
