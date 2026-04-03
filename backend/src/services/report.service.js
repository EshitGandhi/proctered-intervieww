const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const PDFDocument = require('pdfkit');
const axios = require('axios');

// Configuration
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/reports');
const ANALYSIS_API_URL = 'https://mahimadangi-ai-hiring-evaluator.hf.space/generate-report';

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
        'x-api-key': process.env.TEAM_ANALYSIS_API_KEY || process.env.GROQ_API_KEY, 
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
  const doc = new PDFDocument({ margin: 50 });
  const filename = `Report_${application.candidateId.name}_${Date.now()}.pdf`;
  const pdfPath = path.join(UPLOAD_DIR, filename);
  const stream = fs.createWriteStream(pdfPath);
  
  doc.pipe(stream);

  // Helper Header
  const drawHeader = () => {
    // Ideally logo here doc.image('path/to/logo', 50, 45, { width: 50 });
    doc.fillColor('#003366')
       .fontSize(24)
       .text('CANDIDATE REPORT', 50, 50, { align: 'center' });
    doc.moveDown();
    
    // Status Badge
    doc.fillColor('#dcfce7')
       .rect(doc.page.width - 150, 55, 100, 20)
       .fill();
    doc.fillColor('#166534')
       .fontSize(10)
       .text('✓ SUCCESS: True', doc.page.width - 150, 60, { width: 100, align: 'center' });
  };

  drawHeader();
  doc.moveDown(2);

  // Role Section
  const roleY = doc.y;
  doc.fillColor('#e0f2fe').rect(50, roleY, doc.page.width - 100, 30).fill();
  doc.fillColor('#0369a1').fontSize(12).text('ROLE', 60, roleY + 10);
  doc.fillColor('#000000').text(report.role, 120, roleY + 10);
  doc.moveDown(2);

  // Scores Section
  const scoreY = doc.y;
  doc.fillColor('#f0fdf4').rect(50, scoreY, doc.page.width - 100, 60).fill();
  doc.fillColor('#166534').fontSize(14).text('SCORES', 60, scoreY + 22);

  const scoreLabels = ['RESUME', 'CODING', 'MCQ', 'FINAL'];
  const scoreValues = [
    report.scores.resume_score,
    report.scores.coding_score,
    report.scores.mcq_score,
    report.scores.final_score
  ];

  scoreLabels.forEach((label, i) => {
    const x = 160 + (i * 90);
    doc.fillColor('#ffffff').rect(x, scoreY + 10, 80, 40).fill();
    doc.fillColor('#333333').fontSize(8).text(`${label} SCORE`, x, scoreY + 15, { width: 80, align: 'center' });
    doc.fillColor('#000000').fontSize(14).text(scoreValues[i], x, scoreY + 28, { width: 80, align: 'center' });
  });

  doc.moveDown(3);

  // Generic content sections
  const drawSection = (title, data, bgColor, textColor) => {
    doc.moveDown();
    const sectionTitleY = doc.y;
    doc.fillColor(bgColor).rect(50, sectionTitleY, doc.page.width - 100, 25).fill();
    doc.fillColor(textColor).fontSize(12).text(title, 60, sectionTitleY + 7);
    doc.moveDown();
  };

  // Analysis
  drawSection('ANALYSIS', null, '#dbeafe', '#1e40af');
  doc.fillColor('#000000').fontSize(10);
  doc.text(`SENTIMENT: ${report.analysis.sentiment}`, 60);
  doc.text(`CONFIDENCE LEVEL: ${report.analysis.confidence_level}`, 60);
  doc.moveDown(0.5);
  
  const analysisY = doc.y;
  doc.text('STRENGTHS:', 60, analysisY);
  report.analysis.strengths.forEach(s => doc.text(`• ${s}`, 70));
  
  doc.text('WEAKNESSES:', doc.page.width / 2 + 10, analysisY);
  report.analysis.weaknesses.forEach(w => doc.text(`• ${w}`, doc.page.width / 2 + 20));

  // Recommendation
  drawSection('RECOMMENDATION', null, '#f1f5f9', '#334155');
  doc.fillColor('#000000').fontSize(10);
  doc.text(`DECISION: ${report.recommendation.decision}`, 60);
  doc.text(`REASON: ${report.recommendation.reason}`, 60);
  doc.text(`RISK LEVEL: ${report.recommendation.risk_level}`, 60);

  // Insights
  drawSection('INSIGHTS', null, '#f0fdf9', '#0d9488');
  doc.fillColor('#000000').fontSize(10);
  doc.text(`CANDIDATE SUMMARY: ${report.insights.candidate_summary}`, 60);
  doc.moveDown(0.5);
  doc.text('IMPROVEMENT SUGGESTIONS:', 60);
  report.insights.improvement_suggestions.forEach(s => doc.text(`• ${s}`, 70));

  doc.end();
  
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(`/uploads/reports/${filename}`));
    stream.on('error', reject);
  });
};

module.exports = { extractText, analyzeTranscript, generatePDF };
