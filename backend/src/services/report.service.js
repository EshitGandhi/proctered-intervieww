const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const puppeteer = require('puppeteer');
const Groq = require('groq-sdk');

// Configuration
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/reports');
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

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
 * AI analysis using GROQ wrapper
 */
const analyzeTranscript = async (transcript, scores, application) => {
  if (!groq) {
    throw new Error('GROQ_API_KEY is missing in env');
  }

  const resume_min = 50;
  const mcq_min = 60;
  const coding_min = 50;
  
  // Basic violation metrics since they might not be fully tracked yet
  const mcq_violations = 0; 
  const tab_switch = 0; 
  const face_issues = 0; 

  const prompt = `You are an expert technical interviewer and hiring analyst.

Generate a professional interview evaluation report based on the given candidate data.

STRICT RULES:
- Return ONLY valid JSON
- No explanations, no markdown
- Keep it concise but insightful
- Be realistic and slightly critical

CANDIDATE DATA:

Name: ${application.candidateId?.name || 'Candidate'}
Email: ${application.candidateId?.email || 'N/A'}
Role Applied: ${application.jobId?.title || 'Unknown Role'}

Resume Score: ${scores.resume_score}%
MCQ Score: ${scores.mcq_score}%
Coding Score: ${scores.coding_score}%

Resume Minimum Required: ${resume_min}%
MCQ Minimum Required: ${mcq_min}%
Coding Minimum Required: ${coding_min}%

MCQ Violations: ${mcq_violations} (e.g., tab switch, screenshots)
Coding Violations:
- Tab Switch: ${tab_switch}
- Face Detection Issues: ${face_issues}

Interview Transcript:
${transcript}

INSTRUCTIONS:

1. Generate a professional summary (3–4 lines)

2. Evaluate each section:
- Resume: profile strength, relevance
- MCQ: knowledge level
- Coding: problem solving and logic

3. Strengths:
- Technical skills
- Performance areas where candidate did well

4. Weaknesses:
- Low scoring areas
- Behavioral concerns (violations)

5. Violation Analysis:
- If tab switching or face issues detected → mention integrity concern
- If no violations → mention good discipline

6. Performance Analysis:
- Compare all 3 scores
- Identify strongest and weakest area

7. Final Decision (STRICT LOGIC):
- If coding < required OR violations high → "No Hire"
- If all scores high and low violations → "Strong Hire"
- Otherwise → "Hire"

8. Confidence Score (0–100)

9. Final Score Calculation:
final_score = (coding * 0.5) + (mcq * 0.3) + (resume * 0.2)

OUTPUT FORMAT (STRICT JSON):

{
  "candidate": {
    "name": "",
    "email": "",
    "role": ""
  },
  "scores": {
    "resume": 0,
    "mcq": 0,
    "coding": 0,
    "final_score": 0
  },
  "evaluation": {
    "summary": "",
    "resume_analysis": "",
    "mcq_analysis": "",
    "coding_analysis": ""
  },
  "strengths": [],
  "weaknesses": [],
  "violations_analysis": "",
  "performance_analysis": "",
  "recommendation": "",
  "confidence": 0
}`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'mixtral-8x7b-32768',
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(chatCompletion.choices[0]?.message?.content || '{}');
    return result;
  } catch (err) {
    console.error('[Groq Analysis Error]:', err);
    throw new Error('Analysis service failed: ' + err.message);
  }
};

const escapeHtml = (unsafe) => {
  return (unsafe || '')
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * PDF Generation using Puppeteer
 */
const generatePDF = async (report, application) => {
  if (!fs.existsSync(UPLOAD_DIR)){
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const filename = \`Report_\${(application.candidateId?.name || 'Candidate').replace(/\\s+/g, '_')}_\${Date.now()}.pdf\`;
  const pdfPath = path.join(UPLOAD_DIR, filename);

  // Coding HTML Section
  let codingHTML = '';
  if (application.scores?.coding?.answers && application.scores.coding.answers.length > 0) {
    codingHTML = application.scores.coding.answers.map((ans, idx) => {
      const q = ans.questionId;
      return \`
        <div class="coding-submission">
          <h3>Question \${idx + 1}: \${escapeHtml(q?.title || 'Unknown Question')}</h3>
          <p><strong>Selected Language:</strong> <span class="badge">\${ans.language || 'N/A'}</span></p>
          <pre><code>\${escapeHtml(ans.code || '')}</code></pre>
        </div>
      \`;
    }).join('');
  }

  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; }
        .page { background: #fff; padding: 40px; }
        
        .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 20px; border-bottom: 2px solid #0a2569; }
        .header .title { font-size: 24px; font-weight: 800; color: #0a2569; text-transform: uppercase; letter-spacing: 1px; }
        .header .brand { color: #64748b; font-size: 14px; }

        .candidate-card { background: #0a2569; border-radius: 12px; color: white; padding: 30px; display: flex; justify-content: space-between; align-items: center; margin: 30px 0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .candidate-info h2 { margin: 0 0 10px 0; font-size: 24px; font-weight: 700; }
        .candidate-info p { margin: 5px 0; opacity: 0.9; font-size: 14px; }
        .rec-badge { display: inline-block; background: white; color: #0a2569; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 12px; margin-top: 10px; }
        
        .donut-container { position: relative; width: 110px; height: 110px; border-radius: 50%; background: conic-gradient(#38bdf8 \${report.scores?.final_score || 0}%, #1e293b 0); display: flex; align-items: center; justify-content: center; box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.1); }
        .donut-inner { width: 86px; height: 86px; border-radius: 50%; background: #0a2569; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; }
        .donut-inner span { font-size: 10px; font-weight: normal; opacity: 0.8; }

        .section { margin-bottom: 30px; }
        .section-title { font-size: 18px; font-weight: 700; color: #0a2569; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; }
        
        .summary-box { background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; line-height: 1.6; font-size: 14px; }

        .scores-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        .score-card { text-align: center; background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1); }
        .score-card .small-donut { width: 80px; height: 80px; margin: 0 auto 15px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .score-card .small-donut-inner { width: 62px; height: 62px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: #0a2569; }
        .score-card strong { color: #334155; font-size: 14px; }
        
        /* Strengths & Weaknesses */
        .sw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .sw-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; }
        .sw-card.strengths { border-top: 4px solid #10b981; }
        .sw-card.weaknesses { border-top: 4px solid #ef4444; }
        .sw-card h4 { margin: 0 0 15px 0; color: #0f172a; font-size: 16px; }
        .sw-card ul { padding-left: 20px; margin: 0; font-size: 14px; color: #475569; line-height: 1.5; }
        .sw-card li { margin-bottom: 8px; }

        .coding-submission { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 25px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
        .coding-submission h3 { margin-top: 0; color: #0f172a; font-size: 16px; margin-bottom: 12px; }
        .coding-submission .badge { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
        pre { background: #1e293b; padding: 15px; border-radius: 6px; overflow-x: auto; color: #f8fafc; font-size: 13px; line-height: 1.5; box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.1); margin-top: 15px; page-break-inside: avoid; }
        code { font-family: 'Consola', 'Monaco', 'Courier New', monospace; }
        
        .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .metric { background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px; }
        .metric-label { font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 11px; margin-bottom: 4px; display: block; }
        .metric-value { color: #0f172a; font-weight: 500; }

        .page-break { page-break-before: always; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="title">Interview Evaluation</div>
          <div class="brand">KADEL LABS</div>
        </div>

        <div class="candidate-card">
          <div class="candidate-info">
            <h2>\${escapeHtml(application.candidateId?.name || 'Candidate')}</h2>
            <p>\${escapeHtml(application.candidateId?.email || 'N/A')}</p>
            <p>Role: <strong>\${escapeHtml(report.role || 'N/A')}</strong></p>
            <div class="rec-badge">\${escapeHtml(report.recommendation || 'PENDING')}</div>
          </div>
          <div class="donut-container">
            <div class="donut-inner">\${report.scores?.final_score || 0}% <span>overall</span></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Executive Summary</div>
          <div class="summary-box">\${escapeHtml(report.evaluation?.summary || 'No summary available.')}</div>
        </div>

        <div class="scores-grid">
          <div class="score-card">
            <div class="small-donut" style="background: conic-gradient(#10b981 \${report.scores?.resume_score || 0}%, #f1f5f9 0);">
              <div class="small-donut-inner">\${report.scores?.resume_score || 0}%</div>
            </div>
            <strong>Resume Match</strong>
          </div>
          <div class="score-card">
            <div class="small-donut" style="background: conic-gradient(#3b82f6 \${report.scores?.mcq_score || 0}%, #f1f5f9 0);">
              <div class="small-donut-inner">\${report.scores?.mcq_score || 0}%</div>
            </div>
            <strong>Online Test (MCQ)</strong>
          </div>
          <div class="score-card">
            <div class="small-donut" style="background: conic-gradient(#8b5cf6 \${report.scores?.coding_score || 0}%, #f1f5f9 0);">
              <div class="small-donut-inner">\${report.scores?.coding_score || 0}%</div>
            </div>
            <strong>Coding Assessment</strong>
          </div>
        </div>

        <div class="sw-grid section">
          <div class="sw-card strengths">
            <h4>Key Strengths</h4>
            <ul>\${(report.strengths && report.strengths.length > 0) ? report.strengths.map(s => \`<li>\${escapeHtml(s)}</li>\`).join('') : '<li>None highlighted.</li>'}</ul>
          </div>
          <div class="sw-card weaknesses">
            <h4>Areas for Improvement</h4>
            <ul>\${(report.weaknesses && report.weaknesses.length > 0) ? report.weaknesses.map(s => \`<li>\${escapeHtml(s)}</li>\`).join('') : '<li>None highlighted.</li>'}</ul>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Evaluation Details</div>
          <div class="metrics-grid">
            <div class="metric">
              <span class="metric-label">Violations Analysis</span>
              <span class="metric-value">\${escapeHtml(report.violations_analysis || 'No violations noted.')}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Performance Analysis</span>
              <span class="metric-value">\${escapeHtml(report.performance_analysis || 'Not evaluated.')}</span>
            </div>
            <div class="metric">
              <span class="metric-label">AI Confidence Level</span>
              <span class="metric-value" style="font-size: 18px; font-weight: 700; color: #0a2569;">\${report.confidence || 0}%</span>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Sectional Analysis</div>
          <div style="margin-bottom: 10px;"><strong>Resume:</strong> \${escapeHtml(report.evaluation?.resume_analysis || 'N/A')}</div>
          <div style="margin-bottom: 10px;"><strong>MCQ:</strong> \${escapeHtml(report.evaluation?.mcq_analysis || 'N/A')}</div>
          <div><strong>Coding:</strong> \${escapeHtml(report.evaluation?.coding_analysis || 'N/A')}</div>
        </div>

      </div>

      \${codingHTML ? \`
      <div class="page page-break">
        <div class="section-title" style="margin-top: 20px;">Candidate Coding Submissions</div>
        \${codingHTML}
      </div>\` : ''}

    </body>
    </html>
  \`;

  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true 
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await browser.close();

  return \`/uploads/reports/\${filename}\`;
};

module.exports = { extractText, analyzeTranscript, generatePDF };
