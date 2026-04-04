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

  // --- 1. Colors & Branding ---
  const KADEL_BLUE = '#0a2569';
  const TEXT_DARK = '#1e293b';
  const TEXT_LIGHT = '#64748b';
  const BORDER_LIGHT = '#e2e8f0';
  const LOGO_PATH = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\71833a6d-2ea0-4f02-97d9-287ae05320af\\media__1775300843955.png';

  // White Background
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

  const marginX = 40;
  let currentY = 40;

  // --- 2. Header with Logo ---
  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, marginX, currentY, { width: 120 });
    }
  } catch (e) {
    console.error('Logo not found at path:', LOGO_PATH);
  }

  doc.fillColor(KADEL_BLUE).fontSize(20).text('CANDIDATE PERFORMANCE REPORT', marginX, currentY + 10, { align: 'right', width: doc.page.width - 2 * marginX });
  doc.fillColor(TEXT_LIGHT).fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, marginX, currentY + 35, { align: 'right', width: doc.page.width - 2 * marginX });
  
  currentY += 80;

  // Horizontal Divider
  doc.lineWidth(1).strokeColor(BORDER_LIGHT).moveTo(marginX, currentY).lineTo(doc.page.width - marginX, currentY).stroke();
  currentY += 30;

  // --- 3. Overview (Info & Role) ---
  doc.fillColor(KADEL_BLUE).fontSize(10).text('CANDIDATE DETAILS', marginX, currentY);
  currentY += 15;
  doc.fillColor(TEXT_DARK).fontSize(14).text(application.candidateId.name, marginX, currentY);
  doc.fillColor(TEXT_LIGHT).fontSize(10).text(application.candidateId.email, marginX, currentY + 18);
  
  doc.fillColor(KADEL_BLUE).fontSize(10).text('ROLE APPLIED', marginX + 300, currentY - 15);
  doc.fillColor(TEXT_DARK).fontSize(14).text(report.role, marginX + 300, currentY);
  
  currentY += 60;

  // --- 4. Score Grid ---
  const scoreLabels = ['Resume Match', 'Coding', 'MCQ', 'Final Score'];
  const scoreValues = [report.scores.resume_score, report.scores.coding_score, report.scores.mcq_score, report.scores.final_score];
  const boxWidth = (doc.page.width - 2 * marginX - 60) / 4;

  scoreLabels.forEach((label, i) => {
    const x = marginX + i * (boxWidth + 20);
    const scoreValue = scoreValues[i];
    
    // Determine Color
    let color = '#dc2626'; // Red
    if (scoreValue >= 75) color = '#059669'; // Green
    else if (scoreValue >= 50) color = '#d97706'; // Orange
    
    // Score Box Background
    doc.roundedRect(x, currentY, boxWidth, 75, 8).fillAndStroke('#f8fafc', BORDER_LIGHT);
    
    // Label
    doc.fillColor(TEXT_LIGHT).fontSize(8).text(label.toUpperCase(), x, currentY + 12, { width: boxWidth, align: 'center' });
    
    // Colored Score Text
    doc.fillColor(color).fontSize(18).text(`${scoreValue}%`, x, currentY + 28, { width: boxWidth, align: 'center' });

    // Graphical Representation (Progress Bar)
    const barWidth = boxWidth - 30;
    const barX = x + 15;
    const barY = currentY + 54;
    
    // Background bar
    doc.roundedRect(barX, barY, barWidth, 5, 2).fill('#e2e8f0');
    // Foreground bar (filled part)
    if (scoreValue > 0) {
      doc.roundedRect(barX, barY, (barWidth * scoreValue) / 100, 5, 2).fill(color);
    }
  });

  currentY += 100;

  // --- 5. Analysis Block ---
  doc.roundedRect(marginX, currentY, doc.page.width - 2 * marginX, 200, 10).strokeColor(BORDER_LIGHT).stroke();
  
  let sectionY = currentY + 20;
  doc.fillColor(KADEL_BLUE).fontSize(12).text('INTERVIEW ANALYSIS', marginX + 20, sectionY);
  sectionY += 25;

  doc.fillColor(TEXT_LIGHT).fontSize(10).text('Sentiment:', marginX + 20, sectionY);
  doc.fillColor(report.analysis.sentiment.toLowerCase() === 'positive' ? '#059669' : '#dc2626').fontSize(10).text(report.analysis.sentiment.toUpperCase(), marginX + 80, sectionY);

  doc.fillColor(TEXT_LIGHT).fontSize(10).text('Confidence:', marginX + 200, sectionY);
  doc.fillColor('#2563eb').fontSize(10).text(report.analysis.confidence_level.toUpperCase(), marginX + 265, sectionY);

  sectionY += 30;

  // Strengths column
  doc.fillColor(KADEL_BLUE).fontSize(10).text('KEY STRENGTHS', marginX + 20, sectionY);
  let strY = sectionY + 15;
  report.analysis.strengths.forEach(s => {
    doc.fillColor(TEXT_DARK).fontSize(9).text(`• ${s}`, marginX + 20, strY, { width: 220 });
    strY = doc.y + 4;
  });

  // Weaknesses column
  doc.fillColor('#991b1b').fontSize(10).text('AREAS FOR IMPROVEMENT', marginX + (doc.page.width - 2*marginX)/2 + 10, sectionY);
  let weakY = sectionY + 15;
  report.analysis.weaknesses.forEach(w => {
    doc.fillColor(TEXT_DARK).fontSize(9).text(`• ${w}`, marginX + (doc.page.width - 2*marginX)/2 + 10, weakY, { width: 220 });
    weakY = doc.y + 4;
  });

  currentY += 220;

  // --- 6. Executive Summary & Suggestions ---
  doc.fillColor(KADEL_BLUE).fontSize(12).text('EXECUTIVE INSIGHTS', marginX, currentY);
  currentY += 20;
  doc.fillColor(TEXT_DARK).fontSize(10).text(report.insights.candidate_summary, marginX, currentY, { width: doc.page.width - 2 * marginX, lineHeight: 1.4 });
  
  currentY = doc.y + 20;
  doc.fillColor(KADEL_BLUE).fontSize(10).text('SUGGESTIONS FOR CANDIDATE', marginX, currentY);
  currentY += 15;
  report.insights.improvement_suggestions.forEach(s => {
    doc.fillColor(TEXT_DARK).fontSize(9).text(`• ${s}`, marginX, currentY, { width: doc.page.width - 2 * marginX });
    currentY = doc.y + 4;
  });

  // Footer
  doc.fontSize(8).fillColor(TEXT_LIGHT).text('Proprietary and Confidential - Kadel Labs Interview Platform', 0, doc.page.height - 30, { align: 'center', width: doc.page.width });

  doc.end();
  
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(`/uploads/reports/${filename}`));
    stream.on('error', reject);
  });
};


module.exports = { extractText, analyzeTranscript, generatePDF };
