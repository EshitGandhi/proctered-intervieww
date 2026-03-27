const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Interview = require('../models/Interview');
const Recording = require('../models/Recording');
const Report = require('../models/Report');
const User = require('../models/User');

/**
 * Generate evaluation using HF API and then create a PDF report.
 */
const generateReport = async (interviewId) => {
  try {
    const interview = await Interview.findById(interviewId).populate('interviewer candidate');
    if (!interview) throw new Error('Interview not found');

    // 1. Find the transcript
    const transcriptRecording = await Recording.findOne({ interview: interviewId, type: 'transcript' });
    if (!transcriptRecording) {
      console.warn(`No transcript found for interview ${interviewId}. Cannot generate report.`);
      return;
    }

    // Read transcript content
    let transcriptText = '';
    const fullPath = path.resolve(process.cwd(), transcriptRecording.filePath.replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      transcriptText = data.text || '';
    } else {
      throw new Error('Transcript file not found on disk');
    }

    if (!transcriptText) throw new Error('Transcript is empty');

    // 2. Call Evaluation API
    console.log(`Calling evaluation API for interview ${interviewId}...`);
    let evaluationData;
    try {
      const response = await axios.post('https://mahimadangi-ai-hiring-evaluator.hf.space/generate-report', {
        transcript: transcriptText
      }, { timeout: 30000 });
      evaluationData = response.data;
    } catch (apiErr) {
      console.error('API Error:', apiErr.message);
      // Fallback or mark as failed
      throw new Error(`Evaluation API failed: ${apiErr.message}`);
    }

    // 3. Create/Update Report entry
    let report = await Report.findOne({ interview: interviewId });
    if (!report) {
      report = new Report({
        interview: interviewId,
        candidate: interview.candidate?._id || interview.interviewer?._id, // fallback if candidate obj missing
        status: 'processing'
      });
    }
    report.evaluation = evaluationData;
    await report.save();

    // 4. Generate PDF
    const pdfFileName = `report-${interviewId}-${Date.now()}.pdf`;
    const pdfRelativePath = `uploads/reports/${pdfFileName}`;
    const pdfFullPath = path.resolve(process.cwd(), pdfRelativePath);

    if (!fs.existsSync(path.dirname(pdfFullPath))) {
      fs.mkdirSync(path.dirname(pdfFullPath), { recursive: true });
    }

    await createPDFReport(pdfFullPath, interview || { candidateName, candidateEmail, title: 'Manual Transcription Report' }, evaluationData);

    report.pdfPath = `/${pdfRelativePath}`;
    report.status = 'completed';
    await report.save();

    console.log(`Report generated successfully for manual upload`);
    return report;
  } catch (err) {
    console.error('Report Generation Error:', err.message);
    try {
      await Report.findOneAndUpdate(
        { candidateEmail },
        { status: 'failed', error: err.message },
        { upsert: true }
      );
    } catch (innerErr) {}
  }
};

/**
 * Generate report for manual transcript.
 */
const generateManualReport = async ({ transcript, candidateName, candidateEmail, userId }) => {
  try {
    // 1. Create Report entry initial
    const report = await Report.create({
      candidateName,
      candidateEmail,
      status: 'processing'
    });

    // 2. Call Evaluation API
    console.log(`Calling evaluation API for manual transcript...`);
    let evaluationData;
    try {
      const response = await axios.post('https://mahimadangi-ai-hiring-evaluator.hf.space/generate-report', {
        transcript
      }, { timeout: 45000 });
      evaluationData = response.data;
    } catch (apiErr) {
      console.error('API Error:', apiErr.message);
      report.status = 'failed';
      report.error = `Evaluation API failed: ${apiErr.message}`;
      await report.save();
      throw new Error(`Evaluation API failed: ${apiErr.message}`);
    }

    // 3. Update Report entry
    report.evaluation = evaluationData;
    await report.save();

    // 4. Generate PDF
    const pdfFileName = `report-manual-${Date.now()}.pdf`;
    const pdfRelativePath = `uploads/reports/${pdfFileName}`;
    const pdfFullPath = path.resolve(process.cwd(), pdfRelativePath);

    if (!fs.existsSync(path.dirname(pdfFullPath))) {
      fs.mkdirSync(path.dirname(pdfFullPath), { recursive: true });
    }

    const mockInterview = {
      candidateName,
      candidateEmail,
      title: 'External Transcription Analysis',
      endedAt: new Date()
    };

    await createPDFReport(pdfFullPath, mockInterview, evaluationData);

    report.pdfPath = `/${pdfRelativePath}`;
    report.status = 'completed';
    await report.save();

    console.log(`Manual Report generated successfully for ${candidateName}`);
    return report;
  } catch (err) {
    console.error('Manual Report Gen Error:', err.message);
    throw err;
  }
};

/**
 * Creates a professional PDF report using pdfkit.
 */
const createPDFReport = (filePath, interview, evaluation) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // --- Header ---
    doc.fillColor('#444444').fontSize(20).text('Interview Evaluation Report', { align: 'center' });
    doc.moveDown();
    doc.strokeColor('#cccccc').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // --- Candidate & Interview Info ---
    doc.fillColor('#333333').fontSize(14).text('Candidate Details', { underline: true });
    doc.fontSize(10).moveDown(0.5);
    doc.text(`Name: ${interview.candidateName || interview.candidate?.name || 'N/A'}`);
    doc.text(`Email: ${interview.candidateEmail || interview.candidate?.email || 'N/A'}`);
    doc.text(`Title: ${interview.title || 'Interview Analysis'}`);
    doc.text(`Date: ${new Date(interview.endedAt || Date.now()).toLocaleDateString()}`);
    doc.moveDown();

    // --- Overall Analysis ---
    if (evaluation && evaluation.analysis) {
      doc.fontSize(14).text('Executive Summary', { underline: true });
      doc.fontSize(10).moveDown(0.5);
      doc.fillColor('#444444').text(evaluation.analysis, { align: 'justify' });
      doc.moveDown();
    }

    // --- Scores & Visualization ---
    if (evaluation && evaluation.scores) {
      doc.fontSize(14).fillColor('#333333').text('Evaluation Metrics', { underline: true });
      doc.moveDown(1);

      // Manual Bar Chart
      const chartX = 100;
      let chartY = doc.y;
      const barMaxWidth = 300;
      const barHeight = 20;

      Object.entries(evaluation.scores).forEach(([metric, score]) => {
        // Label
        doc.fontSize(10).fillColor('#333333').text(metric, 50, chartY + 5);
        
        // Bar background
        doc.rect(chartX, chartY, barMaxWidth, barHeight).fill('#eeeeee');
        
        // Bar progress
        const progressWidth = (score / 10) * barMaxWidth; // Assuming score out of 10
        doc.rect(chartX, chartY, progressWidth, barHeight).fill('#4f46e5');
        
        // Score value
        doc.fillColor('#ffffff').text(`${score}/10`, chartX + 5, chartY + 5);
        
        chartY += 30;
      });
      
      doc.y = chartY + 20;
    }

    // --- Footer ---
    const bottom = doc.page.height - 50;
    doc.fontSize(8).fillColor('#999999').text('Generated by KL Prarambh Interview Platform', 50, bottom, { align: 'center' });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
};

/**
 * Generate PDF and stream it directly back to response (without saving to disk/DB)
 */
const generateDirectPDFStream = async (res, { transcript, candidateName, candidateEmail }) => {
  // 1. Call Evaluation API
  console.log(`Calling evaluation API for direct download...`);
  const response = await axios.post('https://mahimadangi-ai-hiring-evaluator.hf.space/generate-report', {
    transcript
  }, { timeout: 45000 });
  const evaluationData = response.data;

  // 2. Create PDF Stream
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  // Use the existing logic (simplified copy or shared helper but let's just write here for simplicity)
  doc.fillColor('#444444').fontSize(22).text('Interview Evaluation Report (Direct)', { align: 'center' });
  doc.moveDown();
  doc.strokeColor('#cccccc').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  doc.fillColor('#333333').fontSize(14).text('Candidate Details', { underline: true });
  doc.fontSize(10).moveDown(0.5);
  doc.text(`Name: ${candidateName || 'N/A'}`);
  doc.text(`Email: ${candidateEmail || 'N/A'}`);
  doc.text(`Generated At: ${new Date().toLocaleString()}`);
  doc.moveDown();

  if (evaluationData.analysis) {
    doc.fontSize(14).text('Executive Summary', { underline: true });
    doc.fontSize(10).moveDown(0.5);
    doc.fillColor('#444444').text(evaluationData.analysis, { align: 'justify' });
    doc.moveDown();
  }

  if (evaluationData.scores) {
    doc.fontSize(14).fillColor('#333333').text('Evaluation Metrics', { underline: true });
    doc.moveDown(1);
    const chartX = 100;
    let chartY = doc.y;
    const barMaxWidth = 300;
    const barHeight = 20;

    Object.entries(evaluationData.scores).forEach(([metric, score]) => {
      doc.fontSize(10).fillColor('#333333').text(metric, 50, chartY + 5);
      doc.rect(chartX, chartY, barMaxWidth, barHeight).fill('#eeeeee');
      const progressWidth = (score / 10) * barMaxWidth;
      doc.rect(chartX, chartY, progressWidth, barHeight).fill('#4f46e5');
      doc.fillColor('#ffffff').text(`${score}/10`, chartX + 5, chartY + 5);
      chartY += 30;
    });
  }

  const bottom = doc.page.height - 50;
  doc.fontSize(8).fillColor('#999999').text('Generated by KL Prarambh Interview Platform', 50, bottom, { align: 'center' });

  doc.end();
};

module.exports = { generateReport, generateManualReport, generateDirectPDFStream };
