const Report = require('../models/Report');
const path = require('path');
const fs = require('fs');
const { generateManualReport, generateDirectPDFStream } = require('../services/report.service');

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
    const { transcript, candidateName, candidateEmail } = req.body;
    if (!transcript || !candidateName || !candidateEmail) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const report = await generateManualReport({
      transcript,
      candidateName,
      candidateEmail,
      userId: req.user._id
    });

    res.status(201).json({ success: true, data: report });
  } catch (err) {
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
    const { transcript, candidateName, candidateEmail } = req.body;
    if (!transcript) return res.status(400).json({ success: false, message: 'Transcript required' });

    console.log(`Starting direct PDF generation for ${candidateName}...`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Report_${candidateName}.pdf`);

    await generateDirectPDFStream(res, { transcript, candidateName, candidateEmail });
  } catch (err) {
    console.error('Direct PDF error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = { getReports, downloadReport, createManualReport, downloadReportDirect };
