const Report = require('../models/Report');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const { generateManualReport, generateDirectPDFStream } = require('../services/report.service');

/**
 * Helper to extract text from uploaded File (.txt, .docx)
 */
const extractTextFromFile = async (file) => {
  if (!file) throw new Error('No file uploaded');
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (ext === '.txt') {
    return fs.readFileSync(file.path, 'utf8');
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: file.path });
    return result.value;
  } else {
    throw new Error('Unsupported file format. Please upload .txt or .docx');
  }
};

/**
 * Get all reports
 */
const getReports = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { candidate: req.user._id };
    const reports = await Report.find(filter)
      .populate('interview', 'title candidateName candidateEmail scheduledAt status')
      .populate('candidate', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Generate report from manual transcript upload
 */
const createManualReport = async (req, res) => {
  try {
    const { candidateName, candidateEmail } = req.body;
    if (!candidateName || !candidateEmail) {
      return res.status(400).json({ success: false, message: 'Missing candidate details' });
    }

    // Extract text from file
    const transcript = await extractTextFromFile(req.file);

    const report = await generateManualReport({
      transcript,
      candidateName,
      candidateEmail,
      userId: req.user._id
    });

    // Cleanup temp file
    if (req.file) fs.unlinkSync(req.file.path);

    res.status(201).json({ success: true, data: report });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Download a PDF report
 */
const downloadReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report || !report.pdfPath) {
      return res.status(404).json({ success: false, message: 'Report not found or not generated' });
    }

    const fullPath = path.resolve(process.cwd(), report.pdfPath.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'PDF file not found on disk' });
    }

    res.download(fullPath);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Generate and stream report without saving to DB
 */
const downloadReportDirect = async (req, res) => {
  try {
    const { candidateName, candidateEmail } = req.body;
    
    // Extract text from file
    const transcript = await extractTextFromFile(req.file);

    console.log(`Starting direct PDF generation for ${candidateName}...`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Report_${candidateName}.pdf`);

    await generateDirectPDFStream(res, { transcript, candidateName, candidateEmail });
    
    // Cleanup
    if (req.file) fs.unlinkSync(req.file.path);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('Direct PDF error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = { getReports, downloadReport, createManualReport, downloadReportDirect };
