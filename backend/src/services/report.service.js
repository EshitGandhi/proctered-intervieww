const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const PDFDocument = require('pdfkit');
const axios = require('axios');

// Configuration
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/reports');
const ANALYSIS_API_URL = process.env.TEAM_ANALYSIS_API_URL || 'https://mahimadangi-ai-hiring-evaluator.hf.space/generate-report';
const ANALYSIS_API_KEY = process.env.TEAM_ANALYSIS_API_KEY || process.env.GROQ_API_KEY;

/**
 * Extracts text from DOCX, PDF, or TXT file
 */
const extractText = async (file) => {
  if (!file) throw new Error('No file provided');
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (ext === '.txt') {
    return fs.readFileSync(file.path, 'utf8');
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: file.path });
    return result.value;
  } else if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(file.path);
    const data = await pdf(dataBuffer);
    return data.text;
  } else {
    throw new Error('Unsupported format. Please use .txt, .docx, or .pdf');
  }
};

/**
 * AI analysis using custom team API
 */
const analyzeTranscript = async (transcript, scores, role) => {
  try {
    const payload = {
      transcript,
      resume_score: scores.resume_score,
      coding_score: scores.coding_score,
      mcq_score: scores.mcq_score
    };

    const response = await axios.post(ANALYSIS_API_URL, payload, {
      headers: {
        'x-api-key': ANALYSIS_API_KEY, 
        'Content-Type': 'application/json'
      }
    });

    // Check if the response matches the expected structure
    const data = response.data;
    
    // Fallback/Validation if needed
    if (data.report) return data.report;
    return data;
  } catch (err) {
    console.error('[Team Analysis API Error]:', err.response?.data || err.message);
    throw new Error('Analysis service failed: ' + (err.response?.data?.message || err.message));
  }
};

/**
 * PDF Generation using pdfkit
 */
const generatePDF = async (report, application) => {
  const doc = new PDFDocument({ margin: 0, size: 'A4' });
  const filename = `Report_${application.candidateId.name}_${Date.now()}.pdf`;
  const pdfPath = path.join(UPLOAD_DIR, filename);
  const stream = fs.createWriteStream(pdfPath);
  
  doc.pipe(stream);

  // --- 1. Background Gradient ---
  const bgGrad = doc.linearGradient(0, 0, doc.page.width, doc.page.height);
  bgGrad.stop(0, '#36155c');    // Deep purple top
  bgGrad.stop(0.5, '#2e1065');  // Indigo mid
  bgGrad.stop(1, '#0f172a');    // Dark slate bottom
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(bgGrad);

  // Helper for drawing glass cards
  const drawGlassCard = (x, y, w, h) => {
    // Semi-transparent background
    doc.roundedRect(x, y, w, h, 14).fillOpacity(0.12).fill('#ffffff');
    // Subtle border overlay
    doc.roundedRect(x, y, w, h, 14).lineWidth(1).strokeOpacity(0.25).stroke('#ffffff');
  };

  const marginX = 40;
  let currentY = 40;

  // --- 2. Title Header Card ---
  drawGlassCard(marginX, currentY, doc.page.width - 2 * marginX, 60);
  const titleGrad = doc.linearGradient(marginX, currentY, doc.page.width - marginX, currentY + 60);
  titleGrad.stop(0, '#fdf4ff').stop(1, '#e9d5ff'); // subtle pink/purple text gradient mock
  doc.fillOpacity(1).fillColor('#ffffff').fontSize(26).text('Candidate Performance Report', marginX, currentY + 16, { align: 'center', width: doc.page.width - 2 * marginX });
  
  currentY += 80;

  // --- 3. Overview Block (Candidate Info & Role) ---
  drawGlassCard(marginX, currentY, doc.page.width - 2 * marginX, 90);
  doc.fillOpacity(1).fillColor('#c4b5fd').fontSize(11).text('CANDIDATE INFO', marginX + 20, currentY + 18);
  doc.fillColor('#ffffff').fontSize(16).text(`${application.candidateId.name}`, marginX + 20, currentY + 36);
  doc.fillColor('#e2e8f0').fontSize(10).text(`${application.candidateId.email}`, marginX + 20, currentY + 58);
  
  doc.fillColor('#c4b5fd').fontSize(11).text('ROLE APPLIED', marginX + (doc.page.width - 2*marginX)/2 + 20, currentY + 18);
  doc.fillColor('#ffffff').fontSize(16).text(`${report.role}`, marginX + (doc.page.width - 2*marginX)/2 + 20, currentY + 36);
  
  currentY += 110;

  // --- 4. Score Cards ---
  const scoreWidth = (doc.page.width - 2 * marginX - 45) / 4;
  const scoreLabels = ['RESUME MATCH', 'CODING SCORE', 'MCQ SCORE', 'FINAL OVERALL'];
  const scoreValues = [report.scores.resume_score, report.scores.coding_score, report.scores.mcq_score, report.scores.final_score];
  
  scoreLabels.forEach((label, i) => {
    const startX = marginX + i * (scoreWidth + 15);
    drawGlassCard(startX, currentY, scoreWidth, 80);
    doc.fillOpacity(1).fillColor('#d8b4fe').fontSize(10).text(label, startX + 5, currentY + 15, { width: scoreWidth - 10, align: 'center' });
    doc.fillColor('#ffffff').fontSize(24).text(`${scoreValues[i]}%`, startX, currentY + 40, { width: scoreWidth, align: 'center' });
  });

  currentY += 100;

  // --- 5. Analysis / Stats Block ---
  // Sentiment and Confidence wide card
  drawGlassCard(marginX, currentY, doc.page.width - 2 * marginX, 60);
  doc.fillOpacity(1).fillColor('#c4b5fd').fontSize(11).text('OVERALL SENTIMENT:', marginX + 30, currentY + 24);
  doc.fillColor('#4ade80').fontSize(13).text(report.analysis.sentiment.toUpperCase(), marginX + 170, currentY + 23);

  doc.fillColor('#c4b5fd').fontSize(11).text('CONFIDENCE LEVEL:', marginX + 320, currentY + 24);
  doc.fillColor('#60a5fa').fontSize(13).text(report.analysis.confidence_level.toUpperCase(), marginX + 460, currentY + 23);

  currentY += 80;

  // Strengths and Weaknesses side-by-side vertical cards
  const colWidth = (doc.page.width - 2 * marginX - 20) / 2;
  const strengthsX = marginX;
  const weaknessesX = marginX + colWidth + 20;
  const cardHeight = 220;
  
  drawGlassCard(strengthsX, currentY, colWidth, cardHeight);
  drawGlassCard(weaknessesX, currentY, colWidth, cardHeight);

  doc.fillOpacity(1).fillColor('#a78bfa').fontSize(13).text('KEY STRENGTHS:', strengthsX + 20, currentY + 20);
  doc.fillColor('#e2e8f0').fontSize(10);
  let strY = currentY + 45;
  report.analysis.strengths.slice(0, 6).forEach(s => {
    doc.text(`• ${s}`, strengthsX + 20, strY, { width: colWidth - 40 });
    strY = doc.y + 6;
  });

  doc.fillOpacity(1).fillColor('#f472b6').fontSize(13).text('IDENTIFIED WEAKNESSES:', weaknessesX + 20, currentY + 20);
  doc.fillColor('#e2e8f0').fontSize(10);
  let weakY = currentY + 45;
  report.analysis.weaknesses.slice(0, 6).forEach(w => {
    doc.text(`• ${w}`, weaknessesX + 20, weakY, { width: colWidth - 40 });
    weakY = doc.y + 6;
  });

  currentY += cardHeight + 20;

  // --- 6. Insights & Conclusion ---
  drawGlassCard(marginX, currentY, doc.page.width - 2 * marginX, 150);
  doc.fillOpacity(0.1).fill('#e0e7ff'); // Inner panel overlay
  doc.fillOpacity(1).fillColor('#a78bfa').fontSize(14).text('EXECUTIVE INSIGHTS', marginX + 20, currentY + 20);
  
  doc.fillColor('#f8fafc').fontSize(10).text(report.insights.candidate_summary, marginX + 20, currentY + 45, { width: doc.page.width - 2 * marginX - 40 });
  
  doc.fillColor('#cbd5e1').fontSize(11).text('Improvement Suggestions:', marginX + 20, doc.y + 12);
  let sugY = doc.y + 6;
  report.insights.improvement_suggestions.slice(0, 3).forEach(s => {
      doc.fillColor('#e2e8f0').fontSize(10).text(`• ${s}`, marginX + 20, sugY, { width: doc.page.width - 2 * marginX - 40 });
      sugY = doc.y + 4;
  });

  doc.end();
  
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(`/uploads/reports/${filename}`));
    stream.on('error', reject);
  });
};

module.exports = { extractText, analyzeTranscript, generatePDF };
