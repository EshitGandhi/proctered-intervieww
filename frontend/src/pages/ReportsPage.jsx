import React, { useEffect, useState } from 'react';
import reportService from '../services/reportService';

const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Manual Upload States
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formError, setFormError] = useState(null);
  const [manualData, setManualData] = useState({
    candidateName: '',
    candidateEmail: '',
    file: null // Store File object
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await reportService.getReports();
      if (res.success) {
        setReports(res.data);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setManualData({ ...manualData, file: file });
    setFormError(null);
    setShowModal(true);
    e.target.value = '';
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('candidateName', manualData.candidateName);
      formData.append('candidateEmail', manualData.candidateEmail);
      formData.append('file', manualData.file);

      const res = await reportService.createManualReport(formData);
      if (res.success) {
        setShowModal(false);
        setManualData({ candidateName: '', candidateEmail: '', file: null });
        fetchReports();
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setFormError(err.response.data.message);
      } else {
        setFormError('Failed to generate report. The transcription service might be temporarily unavailable.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async (reportId, candidateName) => {
    setFormError(null);
    try {
      await reportService.downloadReport(reportId, `Report_${candidateName}_${new Date().toLocaleDateString()}.pdf`);
    } catch (err) {
      setFormError('Failed to download report. It may still be processing.');
      setShowModal(true);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <h2 style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '1.2rem', margin: 0 }}>Loading reports...</h2>
      </div>
    );
  }
  if (error) return <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>{error}</div>;

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      <header style={{ marginBottom: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Candidate Reports</h1>
          <p style={{ color: 'var(--text-secondary)' }}>View and download AI-generated interview evaluation reports.</p>
        </div>

        <div style={{ position: 'relative' }}>
          <label htmlFor="transcript-upload" style={{
            padding: '10px 20px',
            background: 'var(--bg-secondary)',
            color: 'var(--primary)',
            borderRadius: 8,
            cursor: 'pointer',
            border: '1px solid var(--border)',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'opacity 0.2s',
            boxShadow: 'var(--shadow)'
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <span style={{ fontSize: 18 }}>📄</span> Upload Transcript
            <input
              type="file"
              id="transcript-upload"
              accept=".txt,.docx,.doc"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </header>

      {/* Manual Report Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--bg-card)', padding: 32, borderRadius: 16, width: '100%', maxWidth: 500,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            border: '1px solid var(--border)'
          }}>
            <h2 style={{ marginBottom: 8, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Generate Evaluation Report</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.9rem' }}>
              We will evaluate <strong>{manualData.file?.name}</strong>. Provide candidate details to bind to the report.
            </p>

            {formError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: '0.85rem' }}>
                <strong>Error: </strong>{formError}
              </div>
            )}
            
            <form onSubmit={handleManualSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>Candidate Name</label>
                <input
                  required
                  type="text"
                  placeholder="John Doe"
                  value={manualData.candidateName}
                  onChange={e => setManualData({ ...manualData, candidateName: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none'
                  }}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>Candidate Email</label>
                <input
                  required
                  type="email"
                  placeholder="john@example.com"
                  value={manualData.candidateEmail}
                  onChange={e => setManualData({ ...manualData, candidateEmail: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)',
                    fontSize: '0.85rem', fontWeight: 500
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={async () => {
                    setFormError(null);
                    try {
                      setIsProcessing(true);
                      const formData = new FormData();
                      formData.append('candidateName', manualData.candidateName);
                      formData.append('candidateEmail', manualData.candidateEmail);
                      formData.append('file', manualData.file);
                      await reportService.downloadReportDirect(formData);
                      setShowModal(false);
                    } catch (err) {
                      setFormError(err.response?.data?.message || 'The AI parsing service timed out. Please try again.');
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: '1px solid var(--primary)',
                    background: 'var(--bg-secondary)', color: 'var(--primary)', fontWeight: 600,
                    cursor: isProcessing ? 'not-allowed' : 'pointer', fontSize: '0.85rem'
                  }}
                >
                  {isProcessing ? 'Generating...' : 'Generate & Download'}
                </button>

                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white',
                    fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1,
                    fontSize: '0.85rem'
                  }}
                >
                  {isProcessing ? 'Working...' : 'Generate & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reports.length === 0 ? (
        <div style={{
          padding: 60,
          background: 'var(--bg-secondary)',
          borderRadius: 16,
          textAlign: 'center',
          border: '1px dashed var(--border)',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ fontSize: 40, marginBottom: 15 }}>📄</div>
          <h3>No reports available yet</h3>
          <p>Complete an interview to generate an automated report.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidate</th>
                <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interview</th>
                <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report._id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 600 }}>
                      {report.interview?.candidateName || report.candidateName || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {report.interview?.candidateEmail || report.candidateEmail}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {report.interview?.title || 'Manual Transcription'}
                  </td>
                  <td style={{ padding: '16px 24px' }}>{new Date(report.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: report.status === 'completed' ? '#dcfce7' : report.status === 'processing' ? '#fef9c3' : '#fee2e2',
                      color: report.status === 'completed' ? '#166534' : report.status === 'processing' ? '#854d0e' : '#991b1b'
                    }}>
                      {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <button
                      disabled={report.status !== 'completed'}
                      onClick={() => handleDownload(report._id, report.interview?.candidateName || report.candidateName || 'Candidate')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: report.status === 'completed' ? 'var(--primary)' : 'var(--border)',
                        color: 'white',
                        border: 'none',
                        cursor: report.status === 'completed' ? 'pointer' : 'not-allowed',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      Download PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
