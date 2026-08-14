import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import { Upload, File, FileText, Image as ImageIcon, Trash2, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { uploadDocument, deleteDocument, getDocumentUrl, listDocuments } from '../../services/DocumentService';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const SharedDocumentVault = () => {
    const { user } = useAuth();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (user && isSupabaseEnabled) {
            fetchFiles();
        } else {
            setLoading(false);
            if (!isSupabaseEnabled) {
                setError("Supabase is not enabled. Cannot load documents.");
            }
        }
    }, [user]);

    const fetchFiles = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const validFiles = await listDocuments(user.id);
            setFiles(validFiles);
        } catch (err) {
            console.error('Error fetching files:', err);
            setError('Failed to load documents. Ensure bucket permissions are set.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input immediately so same file can be uploaded again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (!ALLOWED_TYPES.includes(file.type)) {
            setError('Invalid file type. Only PDF, JPG, and PNG are allowed.');
            return;
        }

        await uploadFile(file);
    };

    const uploadFile = async (file) => {
        if (!user) return setError('You must be logged in to upload files.');
        
        try {
            setUploading(true);
            setError(null);
            
            await uploadDocument(file, user.id);
            // Refresh list
            await fetchFiles();
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || 'Failed to upload document.');
        } finally {
            setUploading(false);
        }
    };

    const deleteFile = async (fileName) => {
        if (!window.confirm(`Are you sure you want to delete ${fileName}?`)) return;

        try {
            setError(null);
            await deleteDocument(fileName, user.id);
            // Update local state instead of doing another API call to keep UI snappy
            setFiles(files.filter(f => f.name !== fileName));
        } catch (err) {
            console.error('Delete error:', err);
            setError('Failed to delete document.');
        }
    };

    const openFile = async (fileName) => {
        try {
            setError(null);
            const signedUrl = await getDocumentUrl(fileName, user.id);
            if (signedUrl) {
                window.open(signedUrl, '_blank');
            }
        } catch (err) {
            console.error('Error generating signed URL:', err);
            setError('Failed to open document.');
        }
    };

    const getFileIcon = (mimeType = '') => {
        if (mimeType.includes('pdf')) return <FileText size={24} color="#ef4444" />;
        if (mimeType.includes('image')) return <ImageIcon size={24} color="#3b82f6" />;
        return <File size={24} color="gray" />;
    };

    return (
        <div style={{ marginTop: '3rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Shared Document Vault
                    </h3>
                    <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.875rem' }}>
                        Securely store and access all your insurance policy copies here.
                    </p>
                </div>
            </div>

            {error && (
                <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Upload Area */}
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                    />
                    <div 
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        style={{
                            border: '2px dashed var(--border)',
                            borderRadius: '12px',
                            padding: '2.5rem 1rem',
                            textAlign: 'center',
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            background: uploading ? 'var(--bg-main)' : 'transparent',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '12px'
                        }}
                        onMouseEnter={(e) => {
                            if (!uploading) {
                                e.currentTarget.style.borderColor = 'var(--primary)';
                                e.currentTarget.style.background = 'rgba(37, 99, 235, 0.05)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!uploading) {
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.background = 'transparent';
                            }
                        }}
                    >
                        {uploading ? (
                            <>
                                <Loader2 size={32} className="text-primary" style={{ animation: 'spin 1s linear infinite' }} />
                                <div style={{ fontWeight: 600 }}>Uploading...</div>
                            </>
                        ) : (
                            <>
                                <div style={{ width: '48px', height: '48px', background: 'var(--bg-main)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Upload size={24} className="text-primary" />
                                </div>
                                <div>
                                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Click to upload</span>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>PDF, JPG, PNG (Max 8 MB)</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* File List */}
                <div style={{ background: 'var(--bg-main)', borderRadius: '12px', padding: '1rem', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Your Uploaded Documents ({files.length})</span>
                    </div>

                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {loading && files.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading documents...</div>
                        ) : files.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No documents uploaded yet.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {files.map((file) => (
                                    <div key={file.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0.75rem',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        gap: '12px'
                                    }}>
                                        {getFileIcon(file.metadata?.mimetype)}
                                        
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 500, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {file.name.includes('_') ? file.name.substring(file.name.indexOf('_') + 1) : file.name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {(file.metadata?.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.created_at).toLocaleDateString()}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                onClick={() => openFile(file.name)}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '6px' }}
                                                title="View Document"
                                            >
                                                <ExternalLink size={18} />
                                            </button>
                                            <button 
                                                onClick={() => deleteFile(file.name)}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px' }}
                                                title="Delete Document"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SharedDocumentVault;
