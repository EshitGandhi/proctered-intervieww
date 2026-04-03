const Report = require('../models/Report');
const Application = require('../models/Application');
const { extractText, analyzeTranscript, generatePDF } = require('../services/report.service');
const path = require('path');
const fs = require('fs');

/**
 * Generate Candidate Evaluation Report
 */
const generateReport = async (req, res) => {
  try {
    const { appId } = req.params;
    const application = await Application.findById(appId).populate('candidateId jobId');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // 1. Extract text from uploaded transcript
    const transcript = await extractText(req.file);

    // 2. Prepare scores
    const scores = {
      resume_score: application.scores?.resume?.score || 0,
      coding_score: application.scores?.coding?.score || 0,
      mcq_score: application.scores?.mcq?.score || 0,
      final_score: application.scores?.finalScore || 0,
    };

    // 3. AI Analysis
    const analysisData = await analyzeTranscript(transcript, scores, application.jobId.title);

    // 4. Create/Update Report in DB
    const reportData = {
      applicationId: appId,
      candidateId: application.candidateId._id,
      role: application.jobId.title,
      scores,
      ...analysisData,
      transcript,
    };

    let report = await Report.findOne({ applicationId: appId });
    if (report) {
      Object.assign(report, reportData);
      await report.save();
    } else {
      report = await Report.create(reportData);
    }

    // 5. Generate PDF
    const pdfPath = await generatePDF(report, application);
    report.pdfPath = pdfPath;
    await report.save();

    // 6. Cleanup temp file
    if (req.file) fs.unlinkSync(req.file.path);

    res.status(200).json({ success: true, data: report });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('[Generate Report Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get Report by Application ID
 */
const getReportByApplication = async (req, res) => {
  try {
    const report = await Report.findOne({ applicationId: req.params.appId });
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found for this application' });
    }
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Download PDF Report
 */
const downloadReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report || !report.pdfPath) {
      return res.status(404).json({ success: false, message: 'Report or PDF not found' });
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

module.exports = { generateReport, getReportByApplication, downloadReport };
