const axios = require('axios');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const Interview = require('../models/Interview');
const Recording = require('../models/Recording');
const Report = require('../models/Report');

/**
 * Generate report for an interview session
 */
const generateReport = async (interviewId) => {
  try {
    const interview = await Interview.findById(interviewId).populate('interviewer candidate');
    if (!interview) throw new Error('Interview not found');

    const transcriptRecording = await Recording.findOne({ interview: interviewId, type: 'transcript' });
    if (!transcriptRecording) {
      console.warn(`No transcript found for interview ${interviewId}. Cannot generate report.`);
      return;
    }

    let transcriptText = '';
    const fullPath = path.resolve(process.cwd(), transcriptRecording.filePath.replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      transcriptText = data.text || '';
    }

    if (!transcriptText) throw new Error('Transcript is empty');

    // Call Evaluation API
    console.log(`Calling evaluation API for interview ${interviewId}...`);
    let evaluationData;
    try {
      const response = await axios.post('https://mahimadangi-ai-hiring-evaluator.hf.space/generate-report', {
        transcript: transcriptText,
        resume_score: 8,
        coding_score: 7, 
        mcq_score: 6,
        interview_score: 8
      }, { timeout: 45000 });
      evaluationData = response.data;
    } catch (apiErr) {
      console.error('API Error:', apiErr.message);
      throw new Error(`Evaluation API failed: ${apiErr.message}`);
    }

    let report = await Report.findOne({ interview: interviewId });
    if (!report) {
      report = new Report({
        interview: interviewId,
        candidate: interview.candidate?._id,
        status: 'processing'
      });
    }
    report.evaluation = evaluationData;
    await report.save();

    const pdfFileName = `report-${interviewId}-${Date.now()}.pdf`;
    const pdfRelativePath = `uploads/reports/${pdfFileName}`;
    const pdfFullPath = path.resolve(process.cwd(), pdfRelativePath);

    if (!fs.existsSync(path.dirname(pdfFullPath))) {
      fs.mkdirSync(path.dirname(pdfFullPath), { recursive: true });
    }

    await createPDFReport(pdfFullPath, interview, evaluationData);

    report.pdfPath = `/${pdfRelativePath}`;
    report.status = 'completed';
    await report.save();

    return report;
  } catch (err) {
    console.error('Report Generation Error:', err.message);
  }
};

/**
 * Generate report for manual transcript upload
 */
const generateManualReport = async ({ transcript, candidateName, candidateEmail, userId }) => {
  try {
    const report = await Report.create({
      candidateName,
      candidateEmail,
      status: 'processing'
    });

    console.log(`Calling evaluation API for manual transcript...`);
    const response = await axios.post('https://mahimadangi-ai-hiring-evaluator.hf.space/generate-report', {
      transcript,
      resume_score: 0,
      coding_score: 0,
      mcq_score: 0,
      interview_score: 0
    }, { timeout: 45000 });
    const evaluationData = response.data;

    report.evaluation = evaluationData;
    const pdfFileName = `report-manual-${Date.now()}.pdf`;
    const pdfRelativePath = `uploads/reports/${pdfFileName}`;
    const pdfFullPath = path.resolve(process.cwd(), pdfRelativePath);

    if (!fs.existsSync(path.dirname(pdfFullPath))) {
      fs.mkdirSync(path.dirname(pdfFullPath), { recursive: true });
    }

    await createPDFReport(pdfFullPath, { candidateName, candidateEmail, title: 'External Transcription Analysis', endedAt: new Date() }, evaluationData);

    report.pdfPath = `/${pdfRelativePath}`;
    report.status = 'completed';
    await report.save();

    return report;
  } catch (err) {
    console.error('Manual Report Gen Error:', err.message);
    throw err;
  }
};

/**
 * Helper to build the professional HTML template for the PDF
 */
const getHTMLTemplate = ({ candidateName, candidateEmail, title, date, evaluation }) => {
  const evRaw = evaluation?.report || evaluation || {};
  const scores = evRaw.scores || {};
  const analysis = evRaw.analysis || {};
  const recommendation = evRaw.recommendation || {};
  const insights = evRaw.insights || {};

  // Calculate Average for Gauge
  const metrics = [
    { label: 'Resume', score: scores.resume_score || 0 },
    { label: 'Coding', score: scores.coding_score || 0 },
    { label: 'MCQ', score: scores.mcq_score || 0 },
    { label: 'Interview', score: scores.interview_score || 0 }
  ];
  const overallAvg = (metrics.reduce((acc, curr) => acc + curr.score, 0) / metrics.length).toFixed(1);
  const gaugePercent = (overallAvg / 10) * 100;
  const gaugeColor = overallAvg >= 7.5 ? '#10b981' : (overallAvg >= 5 ? '#f59e0b' : '#ef4444');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      :root {
        --primary: #1e40af;
        --secondary: #64748b;
        --success: #10b981;
        --error: #ef4444;
        --warning: #f59e0b;
        --bg: #f8fafc;
        --card: #ffffff;
        --text: #1e293b;
        --border: #e2e8f0;
      }
      body {
        font-family: 'Helvetica', 'Arial', sans-serif;
        background: var(--bg);
        color: var(--text);
        margin: 0;
        padding: 40px;
        line-height: 1.5;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid var(--primary);
        padding-bottom: 20px;
        margin-bottom: 30px;
      }
      .header-left h1 {
        margin: 0;
        color: var(--primary);
        font-size: 28px;
        font-weight: 800;
      }
      .header-left p {
        margin: 5px 0 0 0;
        color: var(--secondary);
        font-size: 12px;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      .header-right {
        text-align: right;
        color: var(--secondary);
        font-size: 13px;
      }

      .top-grid {
        display: grid;
        grid-template-columns: 1fr 1.5fr;
        gap: 20px;
        margin-bottom: 30px;
      }

      .card {
        background: var(--card);
        border-radius: 12px;
        border: 1px solid var(--border);
        padding: 24px;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      }

      .gauge-container {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .gauge {
        width: 140px;
        height: 140px;
        position: relative;
        margin-bottom: 15px;
      }
      .gauge-circle {
        fill: none;
        stroke: #eee;
        stroke-width: 12;
      }
      .gauge-fill {
        fill: none;
        stroke: ${gaugeColor};
        stroke-width: 12;
        stroke-linecap: round;
        stroke-dasharray: 440;
        stroke-dashoffset: ${440 - (440 * gaugePercent / 100)};
        transform: rotate(-90deg);
        transform-origin: 50% 50%;
        transition: stroke-dashoffset 1s ease-out;
      }
      .gauge-value {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 32px;
        font-weight: 800;
        color: var(--text);
      }

      .score-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
      }
      .score-item {
        margin-bottom: 12px;
      }
      .score-label {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--secondary);
        margin-bottom: 4px;
        font-weight: 600;
      }
      .bar-bg {
        background: #f1f5f9;
        height: 8px;
        border-radius: 4px;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        background: var(--primary);
        border-radius: 4px;
      }

      .recommendation-banner {
        padding: 15px 20px;
        border-radius: 10px;
        margin-bottom: 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .rec-hire { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
      .rec-reject { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
      .rec-review { background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }

      .section-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--primary);
        margin-bottom: 15px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .analysis-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-top: 20px;
      }
      .bullet-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .bullet-list li {
        margin-bottom: 8px;
        font-size: 13px;
        display: flex;
        gap: 8px;
      }
      .bullet-list li::before {
        content: "•";
        color: var(--primary);
        font-weight: bold;
      }

      .summary-text {
        font-size: 14px;
        color: #475569;
        text-align: justify;
        line-height: 1.6;
      }

      .footer {
        margin-top: 40px;
        text-align: center;
        font-size: 10px;
        color: var(--secondary);
        border-top: 1px solid var(--border);
        padding-top: 15px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="header-left">
        <h1>KL Prarambh</h1>
        <p>AI-Powered Talent Assessment Report</p>
      </div>
      <div class="header-right">
        <div><strong>REPORT ID:</strong> ${Math.random().toString(36).substr(2, 9).toUpperCase()}</div>
        <div><strong>DATE:</strong> ${new Date(date).toLocaleDateString()}</div>
      </div>
    </div>

    <div class="top-grid">
      <div class="card gauge-container">
        <div class="score-label">Overall Match Score</div>
        <div class="gauge">
          <svg viewBox="0 0 160 160">
            <circle class="gauge-circle" cx="80" cy="80" r="70" />
            <circle class="gauge-fill" cx="80" cy="80" r="70" />
          </svg>
          <div class="gauge-value">${overallAvg}</div>
        </div>
        <div style="font-size: 12px; font-weight: 600; color: ${gaugeColor}">${overallAvg >= 7.5 ? 'EXCELLENT' : (overallAvg >= 5 ? 'COMPETENT' : 'REQUIRES REVIEW')}</div>
      </div>

      <div class="card">
        <div class="score-label" style="margin-bottom: 15px;">Candidate Information</div>
        <div style="margin-bottom: 10px;"><strong>Name:</strong> ${candidateName || 'N/A'}</div>
        <div style="margin-bottom: 10px;"><strong>Email:</strong> ${candidateEmail || 'N/A'}</div>
        <div><strong>Evaluation:</strong> ${title || 'Technical Assessment'}</div>
      </div>
    </div>

    <div class="recommendation-banner ${recommendation.decision === 'Hire' ? 'rec-hire' : (recommendation.decision?.includes('Reject') ? 'rec-reject' : 'rec-review')}">
      <div>
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">Final Decision</div>
        <div style="font-size: 20px; font-weight: 800;">${recommendation.decision || 'Under Review'}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">Risk Level</div>
        <div style="font-size: 16px; font-weight: 700;">${recommendation.risk_level || 'Normal'}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 30px;">
      <div class="section-title">Performance Breakdown</div>
      <div class="score-grid">
        ${metrics.map(m => `
          <div class="score-item">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span class="score-label">${m.label}</span>
              <span style="font-size: 11px; font-weight: 700;">${m.score}/10</span>
            </div>
            <div class="bar-bg">
              <div class="bar-fill" style="width: ${m.score * 10}%; background: ${m.score >= 7.5 ? '#10b981' : (m.score >= 5 ? '#3b82f6' : '#ef4444')}"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card" style="margin-bottom: 30px;">
      <div class="section-title">Executive Analysis Summary</div>
      <p class="summary-text">${insights.candidate_summary || 'No detailed analysis summary available.'}</p>
    </div>

    <div class="analysis-grid">
      <div class="card">
        <div class="section-title" style="color: #166534; border-color: #bbf7d0;">Core Strengths</div>
        <ul class="bullet-list">
          ${(analysis.strengths || []).length > 0 ? analysis.strengths.map(s => `<li>${s}</li>`).join('') : '<li>Profile show steady performance</li>'}
        </ul>
      </div>
      <div class="card">
        <div class="section-title" style="color: #991b1b; border-color: #fecaca;">Growth Areas</div>
        <ul class="bullet-list">
          ${(analysis.weaknesses || []).length > 0 ? analysis.weaknesses.map(w => `<li>${w}</li>`).join('') : '<li>No critical weaknesses identified</li>'}
        </ul>
      </div>
    </div>

    <div class="card" style="margin-top: 30px;">
      <div class="section-title">AI Recommendation Reason</div>
      <p class="summary-text" style="font-style: italic;">"${recommendation.reason || 'Professional review recommended.'}"</p>
    </div>

    <div class="footer">
      CONFIDENTIAL PROPERTY OF KL PRARAMBH • GENERATED BY AI EVALUATION ENGINE • ${new Date().toLocaleString()}
    </div>
  </body>
  </html>
  `;
};

/**
 * PDF generation using Puppeteer
 */
const createPDFReport = async (filePath, interview, evaluationResponse) => {
  let browser;
  try {
    const html = getHTMLTemplate({
      candidateName: interview.candidateName || interview.candidate?.name,
      candidateEmail: interview.candidateEmail || interview.candidate?.email,
      title: interview.title,
      date: interview.endedAt || new Date(),
      evaluation: evaluationResponse
    });

    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    console.log(`Professional PDF generated at: ${filePath}`);
  } catch (err) {
    console.error('Puppeteer creation error:', err.message);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
};

/**
 * PDF generation for direct stream (instant)
 */
const generateDirectPDFStream = async (res, { transcript, candidateName, candidateEmail }) => {
  let browser;
  try {
    console.log(`[AI Evaluator] Sending request for ${candidateName}...`);
    
    if (!transcript || transcript.trim().length < 50) {
      throw new Error('Transcript is too short or empty for analysis.');
    }

    const response = await axios.post('https://mahimadangi-ai-hiring-evaluator.hf.space/generate-report', {
      transcript,
      resume_score: 0,
      coding_score: 0,
      mcq_score: 0,
      interview_score: 0
    }, { 
      timeout: 40000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    const evaluationData = response.data || {};
    
    const html = getHTMLTemplate({
      candidateName,
      candidateEmail,
      title: 'Direct Transcription Evaluation',
      date: new Date(),
      evaluation: evaluationData
    });

    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    res.end(pdfBuffer);
    console.log('[PDF] Direct professional stream completed successfully.');
  } catch (err) {
    console.error('[Service Error] generateDirectPDFStream:', err.message);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = { generateReport, generateManualReport, generateDirectPDFStream };
