const Report = require('../models/Report');
const path = require('path');
const fs = require('fs');

/**
 * Get all reports (Admin/Interviewer only for now, or filtered by candidate)
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

module.exports = { getReports, downloadReport };
