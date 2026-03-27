import React, { useEffect, useState } from 'react';
import reportService from '../services/reportService';

const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 8 }}>Candidate Reports</h1>
        <p style={{ color: 'var(--text-muted)' }}>View and download AI-generated interview evaluation reports.</p>
      </header>

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
                    <div style={{ fontWeight: 600 }}>{report.interview?.candidateName || 'Unknown'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{report.interview?.candidateEmail}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>{report.interview?.title}</td>
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
                      onClick={() => handleDownload(report._id, report.interview?.candidateName || 'Candidate')}
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
