const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const axios = require('axios');

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/reports');
const DEFAULT_HF_URL = 'https://bheruudr69-ai-ai.hf.space/generate-report-pdf';
const HF_REPORT_API = process.env.REPORT_PDF_API_URL || DEFAULT_HF_URL;

/** Limits reduce HF Space JSON-schema failures on long inputs (model output truncation, invalid JSON). */
const MAX_TRANSCRIPT_CHARS = 12000;
const MAX_TRANSCRIPT_RETRY_CHARS = 6000;
const MAX_JOB_DESC_CHARS = 8000;
const MAX_SHORT_FIELD = { candidate: 200, role: 300, experience: 500, company: 120 };

const logger = {
  warn: (msg, meta) => console.warn(`[report.service] ${msg}`, meta || ''),
};

/**
 * Strips control characters and caps length so the remote JSON generator receives stable UTF-8 text.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
const sanitizeText = (str, maxLen) => {
  if (!str || typeof str !== 'string') return '';
  let s = str.replace(/\0/g, '');
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
  s = s.replace(/\r\n/g, '\n').trim();
  const total = s.length;
  if (s.length > maxLen) {
    s = `${s.slice(0, maxLen)}\n\n[… truncated (${total} characters total) for report generation]`;
  }
  return s;
};

/**
 * @param {object} payload
 * @param {number} transcriptMax
 * @returns {object}
 */
const normalizeReportPayload = (payload, transcriptMax) => ({
  candidate_name: sanitizeText(payload.candidate_name || 'Candidate', MAX_SHORT_FIELD.candidate),
  role: sanitizeText(payload.role || 'Not specified', MAX_SHORT_FIELD.role),
  experience: sanitizeText(String(payload.experience || 'Not specified'), MAX_SHORT_FIELD.experience),
  company: sanitizeText(String(payload.company || 'Kadel Labs'), MAX_SHORT_FIELD.company),
  interview_date: String(payload.interview_date || new Date().toISOString().split('T')[0]).slice(0, 32),
  job_description: sanitizeText(payload.job_description || 'Not provided', MAX_JOB_DESC_CHARS),
  transcript: sanitizeText(payload.transcript || '', transcriptMax),
  resume_score: Math.min(100, Math.max(0, Math.round(Number(payload.resume_score) || 0))),
  coding_score: Math.min(100, Math.max(0, Math.round(Number(payload.coding_score) || 0))),
  mcq_score: Math.min(100, Math.max(0, Math.round(Number(payload.mcq_score) || 0))),
});

/**
 * @param {Buffer} buf
 * @returns {boolean}
 */
const isPdfBuffer = (buf) =>
  buf.length >= 5 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;

/**
 * @param {number} status
 * @param {Buffer} data
 * @returns {string}
 */
const parseErrorBody = (status, data) => {
  const raw = Buffer.isBuffer(data) ? data.toString('utf8') : String(data || '');
  try {
    const j = JSON.parse(raw);
    const inner = j.error?.message || j.message || j.detail;
    if (inner) return `HTTP ${status}: ${typeof inner === 'string' ? inner : JSON.stringify(inner)}`;
    return `HTTP ${status}: ${JSON.stringify(j)}`;
  } catch {
    return `HTTP ${status}: ${raw.slice(0, 1500)}`;
  }
};

/**
 * @param {object} payload
 * @returns {Promise<Buffer>}
 */
const fetchReportPdfBuffer = async (payload) => {
  const response = await axios.post(HF_REPORT_API, payload, {
    responseType: 'arraybuffer',
    timeout: 180000,
    headers: { 'Content-Type': 'application/json' },
    validateStatus: () => true,
  });

  const buf = Buffer.from(response.data);

  if (response.status < 200 || response.status >= 300) {
    const msg = parseErrorBody(response.status, buf);
    const err = new Error(msg);
    err.statusCode = response.status;
    throw err;
  }

  if (!isPdfBuffer(buf)) {
    const preview = parseErrorBody(response.status, buf);
    throw new Error(
      `Report service returned a non-PDF response. ${preview}`
    );
  }

  return buf;
};

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

  const isJsonSchemaFailure = (err) =>
    /json_validate|invalid_request|Failed to generate JSON|failed_generation/i.test(err.message || '');

  let normalized = normalizeReportPayload(payload, MAX_TRANSCRIPT_CHARS);
  let pdfBuffer;

  try {
    pdfBuffer = await fetchReportPdfBuffer(normalized);
  } catch (firstErr) {
    if (isJsonSchemaFailure(firstErr) && (payload.transcript || '').length > MAX_TRANSCRIPT_RETRY_CHARS) {
      logger.warn('Retrying report generation with shorter transcript after JSON validation failure');
      normalized = normalizeReportPayload(payload, MAX_TRANSCRIPT_RETRY_CHARS);
      pdfBuffer = await fetchReportPdfBuffer(normalized);
    } else {
      throw firstErr;
    }
  }

  fs.writeFileSync(pdfPath, pdfBuffer);
  return `/uploads/reports/${filename}`;
};

module.exports = { extractText, generateReportPDF };
