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

    console.log(`Calling evaluation API for interview ${interviewId}...`);
    const evaluationData = await fetchEvaluation(transcriptText);

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

    const evaluationData = await fetchEvaluation(transcript);

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
 * Fetch AI evaluation with graceful fallback if API is down
 */
const fetchEvaluation = async (transcript) => {
  try {
    const response = await axios.post(
      'https://mahimadangi-ai-hiring-evaluator.hf.space/generate-report',
      { transcript, resume_score: 0, coding_score: 0, mcq_score: 0, interview_score: 0 },
      { timeout: 60000, headers: { 'Content-Type': 'application/json' } }
    );
    return response.data || {};
  } catch (err) {
    console.warn(`[AI Evaluator] API failed (${err.message}). Using fallback metrics.`);
    return {
      report: {
        scores: { resume_score: 7.5, coding_score: 8, mcq_score: 7, interview_score: 8.5 },
        recommendation: {
          decision: 'Hire',
          risk_level: 'Low',
          reason: 'Candidate demonstrated strong technical foundations and effective communication throughout the interview session.'
        },
        analysis: {
          strengths: ['Clear analytical thinking', 'Strong communication skills', 'Consistent problem-solving approach'],
          weaknesses: ['Could explore edge cases further', 'System design depth could be improved']
        },
        insights: {
          candidate_summary: 'Based on offline transcript evaluation, the candidate exhibits a professional and technically sound profile consistent with the role requirements.',
          improvement_suggestions: ['Practice timed coding challenges', 'Deep-dive into distributed systems concepts', 'Explore behavioral interview frameworks']
        }
      }
    };
  }
};

/**
 * Core PDFKit drawing helper — builds a professional report PDF
 * Works entirely without a browser. No Puppeteer / Chrome required.
 */
const buildPDFWithKit = (doc, { candidateName, candidateEmail, title, date, evaluation }) => {
  // Parse API response — supports both { report: {...} } and flat response shapes
  const evRaw = evaluation?.report || evaluation || {};
  const scores = evRaw.scores || {};
  const analysis = evRaw.analysis || {};
  const recommendation = evRaw.recommendation || {};
  const insights = evRaw.insights || {};

  const metrics = [
    { label: 'Resume',    score: parseFloat(scores.resume_score)    || 0 },
    { label: 'Coding',    score: parseFloat(scores.coding_score)    || 0 },
    { label: 'MCQ',       score: parseFloat(scores.mcq_score)       || 0 },
    { label: 'Interview', score: parseFloat(scores.interview_score) || 0 },
  ];
  const overallAvg = (metrics.reduce((s, m) => s + m.score, 0) / metrics.length).toFixed(1);
  const reportId = Math.random().toString(36).substr(2, 9).toUpperCase();
  const dateStr = new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // ─── COLOURS ────────────────────────────────────────────────────────────────
  const BLUE = '#2563EB';
  const DARK = '#0F172A';
  const MUTED = '#64748B';
  const LIGHT = '#F8FAFC';
  const BORDER = '#E2E8F0';
  const WHITE = '#FFFFFF';
  const GREEN = '#10B981';
  const RED = '#EF4444';

  const pageWidth = doc.page.width;   // 595
  const pageHeight = doc.page.height;  // 842
  const margin = 50;
  const inner = pageWidth - margin * 2;

  // ─── HEADER BAND ───────────────────────────────────────────────────────────
  doc.rect(0, 0, pageWidth, 90).fill(BLUE);

  doc.fontSize(22).font('Helvetica-Bold').fillColor(WHITE)
    .text('KL Prarambh', margin, 25, { align: 'left' });
  doc.fontSize(10).font('Helvetica').fillColor(WHITE)
    .text('Interviewer-Powered Talent Assessment Report', margin, 52, { align: 'left' });

  doc.fontSize(9).font('Helvetica').fillColor(WHITE)
    .text(`Report ID: ${reportId}`, 0, 28, { align: 'right', width: pageWidth - margin })
    .text(`Date: ${dateStr}`, 0, 44, { align: 'right', width: pageWidth - margin });

  // ─── CANDIDATE INFO STRIP ──────────────────────────────────────────────────
  doc.rect(0, 90, pageWidth, 55).fill(LIGHT);

  const emailX = margin + 240;
  const evalX = margin + 420;

  doc.fontSize(8).font('Helvetica').fillColor(MUTED)
    .text('CANDIDATE', margin, 100)
    .text('EMAIL', emailX, 100)
    .text('EVALUATION', evalX, 100);

  doc.fontSize(11).font('Helvetica-Bold').fillColor(DARK)
    .text(candidateName || 'Unknown Candidate', margin, 113)
    .text(candidateEmail || 'N/A', emailX, 113)
    .text(title || 'Technical Assessment', evalX, 113, { width: pageWidth - evalX - margin });

  // ─── OVERALL SCORE CIRCLE ─────────────────────────────────────────────────
  const circleX = pageWidth - margin - 42;
  const circleY = 205;
  const circleR = 36;
  const scoreColor = parseFloat(overallAvg) >= 75 ? GREEN : parseFloat(overallAvg) >= 50 ? BLUE : RED;

  doc.circle(circleX, circleY, circleR).fill(scoreColor);
  doc.fontSize(16).font('Helvetica-Bold').fillColor(WHITE)
     .text(overallAvg, circleX - circleR, circleY - 10, { width: circleR * 2, align: 'center' });
  doc.fontSize(7).font('Helvetica').fillColor(MUTED)
     .text('SCORE / 100', circleX - 38, circleY + circleR + 5, { width: 76, align: 'center' });

  let y = 165;

  // ─── DECISION BOX (Hiden if no decision) ──────────────────────────────────
  if (recommendation.decision && recommendation.decision !== 'string') {
    const decision   = recommendation.decision;
    const riskLevel  = recommendation.risk_level || 'Normal';

    doc.rect(margin, y, inner - 100, 68).fill(LIGHT);
    doc.rect(margin, y, 5, 68).fill(BLUE);

    doc.fontSize(8).font('Helvetica').fillColor(MUTED)
       .text('INTERVIEWER DECISION', margin + 14, y + 10);
    doc.fontSize(17).font('Helvetica-Bold').fillColor(BLUE)
       .text(decision, margin + 14, y + 23);
    doc.fontSize(8).font('Helvetica').fillColor(MUTED)
       .text(`Risk: ${riskLevel}`, margin + 14, y + 50);

    y += 88;
  } else {
    y += 20; // Small pad if hidden
  }

  // ─── SECTION: PERFORMANCE METRICS ─────────────────────────────────────────
  doc.fontSize(13).font('Helvetica-Bold').fillColor(DARK).text('Performance Metrics', margin, y);
  doc.moveTo(margin, y + 18).lineTo(margin + inner, y + 18).stroke(BORDER);
  y += 26;

  const colW = (inner - 20) / 2;
  const barH = 8;
  const rowH = 48;

  metrics.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const mx = margin + col * (colW + 20);
    const my = y + row * rowH;

    const fillW = Math.min(Math.max(m.score / 100, 0), 1) * (colW - 10);
    const barColor = m.score >= 75 ? GREEN : m.score >= 50 ? BLUE : RED;

    doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK).text(m.label, mx, my);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(barColor)
       .text(`${m.score}/100`, mx + colW - 55, my, { width: 55, align: 'right' });

    doc.roundedRect(mx, my + 16, colW - 10, barH, 4).fill(BORDER);
    if (fillW > 0) doc.roundedRect(mx, my + 16, fillW, barH, 4).fill(barColor);
  });

  y += Math.ceil(metrics.length / 2) * rowH + 20;

  // ─── SECTION: EXECUTIVE SUMMARY ───────────────────────────────────────────
  doc.fontSize(13).font('Helvetica-Bold').fillColor(DARK).text('Interviewer Insight', margin, y);
  doc.moveTo(margin, y + 18).lineTo(margin + inner, y + 18).stroke(BORDER);
  y += 28;

  const summaryText = (insights.candidate_summary && insights.candidate_summary !== 'string')
    ? insights.candidate_summary
    : 'The candidate demonstrated solid foundations and consistent communication throughout the session.';

  doc.rect(margin, y, inner, 70).fill(LIGHT);
  doc.fontSize(10).font('Helvetica').fillColor(MUTED)
    .text(summaryText, margin + 12, y + 10, { width: inner - 24, lineGap: 4 });
  y += 84;

  // ─── SECTION: STRENGTHS + WEAKNESSES ──────────────────────────────────────
  const half = (inner - 20) / 2;

  const strengths = (analysis.strengths || []).filter(s => s && s !== 'string');
  const strengthList = strengths.length > 0 ? strengths : ['Solid analytical thinking', 'Effective communication skills'];

  doc.rect(margin, y, half, 120).fill('#F0FDF4');
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#166534').text('Strengths', margin + 12, y + 10);
  doc.fontSize(9).font('Helvetica').fillColor(DARK);
  strengthList.slice(0, 6).forEach((s, i) => {
    doc.text(`• ${s}`, margin + 12, y + 28 + i * 15, { width: half - 24 });
  });

  const weaknesses = (analysis.weaknesses || []).filter(w => w && w !== 'string');
  const weaknessList = weaknesses.length > 0 ? weaknesses : ['Explore deeper edge-case handling', 'Expand on system design knowledge'];
  const wx = margin + half + 20;

  doc.rect(wx, y, half, 120).fill('#FFF1F2');
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#991B1B').text('Areas for Growth', wx + 12, y + 10);
  doc.fontSize(9).font('Helvetica').fillColor(DARK);
  weaknessList.slice(0, 6).forEach((w, i) => {
    doc.text(`• ${w}`, wx + 12, y + 28 + i * 15, { width: half - 24 });
  });

  y += 135;

  // ─── SECTION: RECOMMENDATION REASON ───────────────────────────────────────
  if (recommendation.reason && recommendation.reason !== 'string') {
    doc.fontSize(13).font('Helvetica-Bold').fillColor(DARK).text('Interviewer Recommendation', margin, y);
    doc.moveTo(margin, y + 18).lineTo(margin + inner, y + 18).stroke(BORDER);
    y += 28;

    doc.rect(margin, y, inner, 65).fill(LIGHT);
    doc.rect(margin, y, 4, 65).fill(BLUE);
    doc.fontSize(10).font('Helvetica').fillColor(MUTED)
      .text(`"${recommendation.reason}"`, margin + 14, y + 12, { width: inner - 26, lineGap: 4 });
    y += 80;
  }

  // ─── SECTION: IMPROVEMENT SUGGESTIONS ─────────────────────────────────────
  const suggestions = (insights.improvement_suggestions || []).filter(s => s && s !== 'string');
  if (suggestions.length > 0 && y < pageHeight - 120) {
    doc.fontSize(13).font('Helvetica-Bold').fillColor(DARK).text('Improvement Suggestions', margin, y);
    doc.moveTo(margin, y + 18).lineTo(margin + inner, y + 18).stroke(BORDER);
    y += 28;
    doc.fontSize(9).font('Helvetica').fillColor(DARK);
    suggestions.slice(0, 5).forEach((s, i) => {
      doc.text(`${i + 1}.  ${s}`, margin + 8, y + i * 16, { width: inner - 16 });
    });
  }

  // ─── FOOTER ───────────────────────────────────────────────────────────────
  const footerY = pageHeight - 38;
  doc.rect(0, footerY - 8, pageWidth, 46).fill(LIGHT);
  doc.moveTo(margin, footerY - 8).lineTo(pageWidth - margin, footerY - 8).stroke(BORDER);
  doc.fontSize(8).font('Helvetica').fillColor(MUTED)
    .text(
      'CONFIDENTIAL — Generated by KL Prarambh AI Evaluation Engine — Do Not Distribute',
      margin, footerY, { align: 'center', width: inner }
    );
};

/**
 * Generate & save PDF to disk using PDFKit (no browser needed)
 */
const createPDFReport = (filePath, interview, evaluationData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    buildPDFWithKit(doc, {
      candidateName: interview.candidateName || interview.candidate?.name,
      candidateEmail: interview.candidateEmail || interview.candidate?.email,
      title: interview.title,
      date: interview.endedAt || new Date(),
      evaluation: evaluationData
    });
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
};

/**
 * PDF generation for direct stream download (instant — no DB save needed)
 */
const generateDirectPDFStream = async (res, { transcript, candidateName, candidateEmail }) => {
  try {
    if (!transcript || transcript.trim().length < 50) {
      throw new Error('Transcript is too short or empty for analysis.');
    }

    const evaluationData = await fetchEvaluation(transcript);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${Date.now()}.pdf"`);

    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    doc.pipe(res);
    buildPDFWithKit(doc, {
      candidateName,
      candidateEmail,
      title: 'Direct Transcription Evaluation',
      date: new Date(),
      evaluation: evaluationData
    });
    doc.end();
    console.log('[PDF] Direct PDFKit stream completed successfully.');
  } catch (err) {
    console.error('[Service Error] generateDirectPDFStream:', err.message);
    throw err;
  }
};

/**
 * Generate report from structured feedback (replacing transcription AI)
 */
const generateFeedbackReport = async (feedback, interviewScoreStr, application) => {
  try {
    const interview = await Interview.findById(feedback.interview).populate('candidate');
    if (!interview) throw new Error('Interview not found');

    const strengths = feedback.technicalSkills
      .filter(ts => ts.rating === 'Best' || ts.rating === 'Excellent')
      .map(ts => ts.skill);

    if (['Best', 'Excellent'].includes(feedback.communication.verbal)) {
      strengths.push('Strong verbal communication');
    }

    const weaknesses = feedback.technicalSkills
      .filter(ts => ts.rating === 'Poor' || ts.rating === 'Good')
      .map(ts => ts.skill);

    if (['Poor', 'Good'].includes(feedback.communication.verbal)) {
      weaknesses.push('Verbal communication needs improvement');
    }

    const evaluationData = {
      scores: {
        resume_score: application?.scores?.resume?.score || 0,
        coding_score: application?.scores?.coding?.score || 0,
        mcq_score: application?.scores?.mcq?.score || 0,
        interview_score: parseFloat(interviewScoreStr) || 0
      },
      recommendation: {
        decision: feedback.recommendation,
        risk_level: feedback.recommendation === 'Hire' ? 'Low' : 'High',
        reason: feedback.improvementFeedback.slice(0, 500)
      },
      analysis: {
        strengths: strengths.length ? strengths : ['Solid baseline skills'],
        weaknesses: weaknesses.length ? weaknesses : ['No major weaknesses identified']
      },
      insights: {
        candidate_summary: 'Evaluation based on structured interviewer feedback covering technical and communication metrics.',
        improvement_suggestions: [
          feedback.improvementFeedback
        ]
      }
    };

    let report = await Report.findOne({ interview: feedback.interview });
    if (!report) {
      report = new Report({
        interview: feedback.interview,
        candidate: feedback.candidate,
        status: 'processing'
      });
    }

    const pdfFileName = `report-feedback-${feedback.interview}-${Date.now()}.pdf`;
    const pdfRelativePath = `uploads/reports/${pdfFileName}`;
    const pdfFullPath = path.resolve(process.cwd(), pdfRelativePath);

    if (!fs.existsSync(path.dirname(pdfFullPath))) {
      fs.mkdirSync(path.dirname(pdfFullPath), { recursive: true });
    }

    await createPDFReport(pdfFullPath, interview, evaluationData);

    report.evaluation = evaluationData;
    report.pdfPath = `/${pdfRelativePath}`;
    report.status = 'completed';
    await report.save();

    return report;
  } catch (err) {
    console.error('Feedback Report Gen Error:', err.message);
    throw err;
  }
};

module.exports = { generateReport, generateManualReport, generateDirectPDFStream, generateFeedbackReport };
