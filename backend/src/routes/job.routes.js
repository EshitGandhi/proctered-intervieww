const express = require('express');
const { createJob, getJobs, getJob, updateJob, deleteJob } = require('../controllers/job.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes (or candidate routes)
router.route('/')
  .get(protect, getJobs)
  .post(protect, requireRole('admin'), createJob);

router.route('/:id')
  .get(getJob)
  .put(protect, requireRole('admin'), updateJob)
  .delete(protect, requireRole('admin'), deleteJob);

module.exports = router;
