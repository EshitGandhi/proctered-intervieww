const path = require('path');
const fs = require('fs');
const Report = require('../models/Report');
const Application = require('../models/Application');
const { extractText, generateReportPDF } = require('../services/report.service');
const { skipsCodingRound } = require('../utils/applicationScores');

/**
 * Builds the payload for the HF Space report API from stored application + report data.
 * @param {object} application - Populated Mongoose Application document
 * @param {object} options - { transcript, interview_date, experience }
 * @returns {object}
 */
const buildReportPayload = (application, { transcript, interview_date, experience }) => {
  const codingScore = skipsCodingRound(application.jobId?.domain)
    ? 0
    : Math.round(application.scores?.coding?.score || 0);
  return {
    candidate_name: application.candidateId?.name || 'Candidate',
    role: application.jobId?.title || 'Not specified',
    experience: experience || application.candidateId?.experience || 'Not specified',
    company: 'Kadel Labs',
    interview_date: interview_date || new Date().toISOString().split('T')[0],
    job_description: application.jobId?.description || 'Not provided',
    transcript: transcript || '',
    resume_score: Math.round(application.scores?.resume?.score || 0),
    coding_score: codingScore,
    mcq_score: Math.round(application.scores?.mcq?.score || 0),
  };
};

/**
 * POST /api/reports/generate/:appId
 * Admin uploads interview transcript + optional interview_date.
 * Calls HF Space API to generate PDF and stores report metadata.
 */
const generateReport = async (req, res) => {
  try {
    const { appId } = req.params;
    const { interview_date } = req.body;

    const application = await Application.findById(appId)
      .populate('candidateId', 'name email experience')
      .populate('jobId', 'title description domain');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Transcript file is required' });
    }

    // 1. Extract transcript text
    const transcript = await extractText(req.file);

    // 2. Build API payload
    const payload = buildReportPayload(application, {
      transcript,
      interview_date,
      experience: application.candidateId?.experience,
    });

    // 3. Call HF Space API → get PDF
    const pdfPath = await generateReportPDF(payload, application.candidateId?.name);

    // 4. Persist report metadata (upsert)
    const scores = {
      resume_score: payload.resume_score,
      coding_score: payload.coding_score,
      mcq_score: payload.mcq_score,
      final_score: Math.round(application.scores?.finalScore || 0),
    };

    const reportData = {
      applicationId: appId,
      candidateId: application.candidateId._id,
      role: payload.role,
      experience: payload.experience,
      interview_date: payload.interview_date,
      scores,
      transcript,
      job_description: payload.job_description,
      pdfPath,
    };

    let report = await Report.findOne({ applicationId: appId });
    if (report) {
      Object.assign(report, reportData);
      await report.save();
    } else {
      report = await Report.create(reportData);
    }

    // 5. Cleanup temp transcript file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(200).json({ success: true, data: report });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('[Generate Report Error]:', err.message);
    const upstream = err.statusCode;
    const status =
      upstream === 400 || upstream === 422 || upstream === 429 ? 502 : upstream >= 500 ? 502 : 500;
    res.status(status).json({
      success: false,
      message: err.message || 'Report generation failed',
    });
  }
};

/**
 * GET /api/reports/application/:appId
 * Returns the stored report for an application.
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
 * GET /api/reports/download/:id
 * Serves the PDF file. If the file is missing (Render ephemeral storage wipe),
 * regenerates it by re-calling the HF Space API using stored report data.
 */
const downloadReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report || !report.pdfPath) {
      return res.status(404).json({ success: false, message: 'Report or PDF path not found' });
    }

    let fullPath = path.resolve(process.cwd(), report.pdfPath.replace(/^\//, ''));

    if (!fs.existsSync(fullPath)) {
      // PDF wiped by Render ephemeral storage — regenerate using stored data
      const application = await Application.findById(report.applicationId)
        .populate('candidateId', 'name email experience')
        .populate('jobId', 'title description domain');

      if (!application) {
        return res.status(404).json({ success: false, message: 'Cannot regenerate PDF: application data missing' });
      }

      const payload = buildReportPayload(application, {
        transcript: report.transcript || '',
        interview_date: report.interview_date,
        experience: report.experience,
      });

      const newPdfPath = await generateReportPDF(payload, application.candidateId?.name);
      report.pdfPath = newPdfPath;
      await report.save();
      fullPath = path.resolve(process.cwd(), newPdfPath.replace(/^\//, ''));
    }

    res.download(fullPath);
  } catch (err) {
    console.error('[Download Report Error]:', err.message);
    const upstream = err.statusCode;
    const status =
      upstream === 400 || upstream === 422 || upstream === 429 ? 502 : upstream >= 500 ? 502 : 500;
    res.status(status).json({ success: false, message: err.message || 'Download failed' });
  }
};

module.exports = { generateReport, getReportByApplication, downloadReport };
