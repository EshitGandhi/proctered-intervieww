const { getReports, downloadReport, createManualReport } = require('../controllers/report.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/reports
router.get('/', protect, getReports);

// POST /api/reports/manual
router.post('/manual', protect, requireRole('admin', 'interviewer'), createManualReport);

// GET /api/reports/:id/download
router.get('/:id/download', protect, downloadReport);

module.exports = router;
