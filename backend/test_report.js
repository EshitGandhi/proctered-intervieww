/**
 * Local manual test hook for report flow. Run: node test_report.js
 * Adjust appId and ensure MONGO_URI + transcript paths as needed.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Application = require('./src/models/Application');

const appId = process.env.TEST_REPORT_APP_ID;

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    if (!appId) {
      console.log('Set TEST_REPORT_APP_ID in .env to an Application _id to inspect.');
      process.exit(0);
    }
    const app = await Application.findById(appId).populate('candidateId jobId');
    console.log(app ? { status: app.status, job: app.jobId?.title } : 'Not found');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
