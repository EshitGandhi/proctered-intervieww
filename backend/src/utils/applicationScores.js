const { DOMAIN_SKIPS_CODING } = require('../constants/jobDomains');

/**
 * @param {string | null | undefined} domain
 * @returns {boolean}
 */
const skipsCodingRound = (domain) => domain === DOMAIN_SKIPS_CODING;

/**
 * Weighted final score (same formula as coding submission route).
 * @param {object} job - Job document (weights + thresholds)
 * @param {number} resumeScore
 * @param {number} mcqScore
 * @param {number} codingScore
 * @returns {number}
 */
const computeWeightedFinalScore = (job, resumeScore, mcqScore, codingScore) => {
  const totalWeight = (job.resumeWeight || 1) + (job.mcqWeight || 1) + (job.codingWeight || 1);
  const resW = (job.resumeWeight || 1) / totalWeight;
  const mcqW = (job.mcqWeight || 1) / totalWeight;
  const codeW = (job.codingWeight || 1) / totalWeight;
  return Math.round(resumeScore * resW + mcqScore * mcqW + codingScore * codeW);
};

/**
 * @param {object} application - Application with populated jobId
 * @param {number} codingScore
 * @returns {number}
 */
const finalScoreFromApplication = (application, codingScore) =>
  computeWeightedFinalScore(
    application.jobId,
    application.scores?.resume?.score || 0,
    application.scores?.mcq?.score || 0,
    codingScore
  );

module.exports = {
  DOMAIN_SKIPS_CODING,
  skipsCodingRound,
  computeWeightedFinalScore,
  finalScoreFromApplication,
};
