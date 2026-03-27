const axios = require('axios');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
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
 * Helper to build the professional PDF
 */
const createPDFReport = (filePath, interview, evaluationResponse) => {
  return new Promise((resolve, reject) => {
    const evRaw = evaluationResponse?.report || {};
    const scores = evRaw.scores || {};
    const analysis = evRaw.analysis || {};
    const recommendation = evRaw.recommendation || {};
    const insights = evRaw.insights || {};

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fillColor('#1e40af').fontSize(24).text('Hiring Evaluation Report', { align: 'center' });
    doc.moveDown(0.2);
    doc.fillColor('#64748b').fontSize(10).text('KL Prarambh Interview Engine • Powered by AI', { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1.5);

    // Profile
    doc.fillColor('#1e293b').fontSize(16).text('Candidate Profile', { underline: false });
    doc.moveDown(0.5);
    const startY = doc.y;
    doc.fontSize(10).fillColor('#64748b').text('CANDIDATE NAME', 50, startY);
    doc.fillColor('#1e293b').fontSize(11).text(interview.candidateName || interview.candidate?.name || 'N/A', 50, startY + 15);
    doc.fillColor('#64748b').fontSize(10).text('EMAIL ADDRESS', 300, startY);
    doc.fillColor('#1e293b').fontSize(11).text(interview.candidateEmail || interview.candidate?.email || 'N/A', 300, startY + 15);
    doc.moveDown(3);
    
    // Recommendation
    const decisionColor = recommendation.decision === 'Hire' ? '#166534' : (recommendation.decision?.includes('Reject') ? '#991b1b' : '#854d0e');
    doc.rect(50, doc.y, 500, 60).fill('#f8fafc');
    const boxY = doc.y;
    doc.fillColor('#64748b').fontSize(10).text('FINAL DECISION', 70, boxY + 15);
    doc.fillColor(decisionColor).fontSize(18).text(recommendation.decision || 'Under Review', 70, boxY + 30);
    doc.fillColor('#64748b').fontSize(10).text('RISK LEVEL', 400, boxY + 15);
    doc.fillColor('#1e293b').fontSize(12).text(recommendation.risk_level || 'Normal', 400, boxY + 30);
    doc.moveDown(4.5);

    // Metrics Chart
    doc.fillColor('#1e293b').fontSize(14).text('Performance Metrics', { underline: false });
    doc.moveDown(1);
    const chartX = 180;
    let chartY = doc.y;
    const barMaxWidth = 250;
    const displayedMetrics = [
      { label: 'Resume Score', score: scores.resume_score || 0 },
      { label: 'Coding Proficiency', score: scores.coding_score || 0 },
      { label: 'MCQ Assessment', score: scores.mcq_score || 0 },
      { label: 'Interview Performance', score: scores.interview_score || 0 }
    ];
    displayedMetrics.forEach(m => {
      doc.fillColor('#475569').fontSize(10).text(m.label, 50, chartY + 5);
      doc.rect(chartX, chartY, barMaxWidth, 16).fill('#f1f5f9');
      const progress = (m.score / 10) * barMaxWidth;
      if (progress > 0) doc.rect(chartX, chartY, Math.min(progress, barMaxWidth), 16).fill('#3b82f6');
      doc.fillColor('#1e293b').text(`${m.score}/10`, chartX + barMaxWidth + 10, chartY + 5);
      chartY += 25;
    });
    doc.y = chartY + 20;

    // Analysis
    doc.fillColor('#1e293b').fontSize(14).text('Executive Analysis', { underline: false });
    doc.moveDown(0.5);
    doc.fillColor('#334155').fontSize(10).text(insights.candidate_summary || 'No summary provided.', { align: 'justify', lineGap: 2 });
    doc.moveDown(1.5);

    const currentY = doc.y;
    doc.fillColor('#166534').fontSize(12).text('Strengths', 50, currentY);
    let sy = currentY + 15;
    (analysis.strengths || []).forEach(s => {
      doc.fontSize(9).fillColor('#334155').text(`• ${s}`, 50, sy);
      sy += 12;
    });

    doc.fillColor('#991b1b').fontSize(12).text('Weaknesses', 300, currentY);
    let wy = currentY + 15;
    (analysis.weaknesses || []).forEach(w => {
      doc.fontSize(9).fillColor('#334155').text(`• ${w}`, 300, wy);
      wy += 12;
    });

    doc.y = Math.max(sy, wy) + 20;
    doc.fillColor('#1e293b').fontSize(13).text('Recommendation Detail', { underline: false });
    doc.moveDown(0.5);
    doc.fillColor('#475569').fontSize(10).text(recommendation.reason || 'No detailed reason provided.', { align: 'justify' });

    const bottom = doc.page.height - 50;
    doc.fillColor('#94a3b8').fontSize(8).text('CONFIDENTIAL REPORT • GENERATED ON ' + new Date().toLocaleString(), 50, bottom, { align: 'center' });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
};

/**
 * PDF generation for direct stream (instant)
 */
const generateDirectPDFStream = async (res, { transcript, candidateName, candidateEmail }) => {
  try {
    const response = await axios.post('https://mahimadangi-ai-hiring-evaluator.hf.space/generate-report', {
      transcript,
      resume_score: 0,
      coding_score: 0,
      mcq_score: 0,
      interview_score: 0
    }, { timeout: 45000 });
    const evaluationData = response.data;
    const evRaw = evaluationData.report || {};

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);
    
    doc.fillColor('#1e40af').fontSize(24).text('Immediate Hiring Evaluation', { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1.5);
    
    doc.fontSize(14).fillColor('#1e293b').text(`Candidate: ${candidateName}`);
    doc.fontSize(10).fillColor('#64748b').text(`Status: ${evRaw.recommendation?.decision || 'Processed'}`);
    doc.moveDown(1);
    
    doc.fillColor('#334155').fontSize(11).text('Executive Summary:', { underline: true });
    doc.fontSize(10).text(evRaw.insights?.candidate_summary || 'Analysis completed.', { align: 'justify' });
    doc.moveDown(2);
    
    if (evRaw.scores) {
        doc.fillColor('#1e293b').fontSize(12).text('Assessment Scores:');
        doc.moveDown(0.5);
        Object.entries(evRaw.scores).forEach(([k, v]) => {
          doc.fontSize(9).fillColor('#475569').text(`${k.replace('_', ' ').toUpperCase()}: ${v}/10`);
        });
    }

    doc.end();
  } catch (err) {
    throw err;
  }
};

module.exports = { generateReport, generateManualReport, generateDirectPDFStream };
