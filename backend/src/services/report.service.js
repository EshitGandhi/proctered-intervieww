const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const axios = require('axios');

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/reports');
const HF_REPORT_API = 'https://bheruudr69-ai-ai.hf.space/generate-report-pdf';

/**
 * Extracts plain text from DOCX, PDF, or TXT file.
 * @param {object} file - Multer file object
 * @returns {Promise<string>}
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
 * Calls the HF Space report generation API with the provided payload,
 * saves the returned PDF to disk, and returns the relative URL path.
 *
 * @param {object} payload - JSON payload matching the HF Space API schema
 * @param {string} candidateName - Used for the output filename
 * @returns {Promise<string>} Relative URL path to the saved PDF
 */
const generateReportPDF = async (payload, candidateName) => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const safeName = (candidateName || 'Candidate').replace(/\s+/g, '_');
  const filename = `Report_${safeName}_${Date.now()}.pdf`;
  const pdfPath = path.join(UPLOAD_DIR, filename);

  const response = await axios.post(HF_REPORT_API, payload, {
    responseType: 'arraybuffer',
    timeout: 180000, // 3 min — HF Spaces may have cold-start delay
    headers: { 'Content-Type': 'application/json' },
  });

  fs.writeFileSync(pdfPath, response.data);
  return `/uploads/reports/${filename}`;
};

module.exports = { extractText, generateReportPDF };
