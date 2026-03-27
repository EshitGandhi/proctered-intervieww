import React, { useEffect, useState } from 'react';
import reportService from '../services/reportService';

const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Manual Upload States
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualData, setManualData] = useState({
    candidateName: '',
    candidateEmail: '',
    transcript: ''
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

    const reader = new FileReader();
    reader.onload = (event) => {
      setManualData({ ...manualData, transcript: event.target.result });
      setShowModal(true);
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsProcessing(true);
      const res = await reportService.createManualReport(manualData);
      if (res.success) {
        setShowModal(false);
        setManualData({ candidateName: '', candidateEmail: '', transcript: '' });
        fetchReports(); // Refresh list
      }
    } catch (err) {
      alert('Failed to generate manual report: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async (reportId, candidateName) => {
    try {
      await reportService.downloadReport(reportId, `Report_${candidateName}_${new Date().toLocaleDateString()}.pdf`);
    } catch (err) {
      alert('Failed to download report. It may still be processing.');
    }
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading reports...</div>;
  if (error) return <div style={{ padding: 40, color: 'var(--danger)' }}>{error}</div>;

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      <header style={{ marginBottom: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 8 }}>Candidate Reports</h1>
          <p style={{ color: 'var(--text-muted)' }}>View and download AI-generated interview evaluation reports.</p>
        </div>
        
        <div style={{ position: 'relative' }}>
          <label htmlFor="transcript-upload" style={{
            padding: '10px 20px',
            background: 'var(--primary)',
            color: 'white',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <span>📁</span> Upload Transcript
            <input 
              type="file" 
              id="transcript-upload" 
              accept=".txt" 
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
            background: 'var(--bg-surface)', padding: 32, borderRadius: 16, width: '100%', maxWidth: 500,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
          }}>
            <h2 style={{ marginBottom: 8, fontSize: '1.5rem' }}>Save Manual Report</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>Enter candidate details to save this transcription report to your dashboard.</p>
            
            <form onSubmit={handleManualSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Candidate Name</label>
                <input 
                  required
                  type="text" 
                  placeholder="John Doe"
                  value={manualData.candidateName}
                  onChange={e => setManualData({...manualData, candidateName: e.target.value})}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Candidate Email</label>
                <input 
                  required
                  type="email" 
                  placeholder="john@example.com"
                  value={manualData.candidateEmail}
                  onChange={e => setManualData({...manualData, candidateEmail: e.target.value})}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isProcessing}
                  style={{ 
                    padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', 
                    fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1 
                  }}
                >
                  {isProcessing ? 'Generating...' : 'Generate & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reports.length === 0 ? (
        <div style={{
          padding: 60,
          background: 'var(--bg-surface)',
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
        <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
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
