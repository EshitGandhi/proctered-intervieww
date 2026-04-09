/** Allowed experience values — keep in sync with backend `src/constants/experienceLevels.js` */
export const EXPERIENCE_LEVELS = [
  'Fresher',
  'Less than 1 year',
  '1 year',
  '2 years',
  '3 years',
  '4 years',
  '5 years',
  '6-8 years',
  '9-12 years',
  '12+ years',
];

/** Display labels for the registration select (value must match EXPERIENCE_LEVELS) */
export const EXPERIENCE_OPTIONS = [
  { value: 'Fresher', label: 'Fresher (0 years)' },
  { value: 'Less than 1 year', label: 'Less than 1 year' },
  { value: '1 year', label: '1 year' },
  { value: '2 years', label: '2 years' },
  { value: '3 years', label: '3 years' },
  { value: '4 years', label: '4 years' },
  { value: '5 years', label: '5 years' },
  { value: '6-8 years', label: '6–8 years' },
  { value: '9-12 years', label: '9–12 years' },
  { value: '12+ years', label: '12+ years' },
];

/** Domains with no coding round — keep in sync with backend `src/constants/jobDomains.js` */
export const DOMAIN_SKIPS_CODING = 'Business Analyst';

export function jobSkipsCodingRound(domain) {
  return domain === DOMAIN_SKIPS_CODING;
}

export const DOMAINS = [
  'AI/ML Engineer',
  'PHP Developer',
  'Data Engineer',
  'Data Scientist',
  'DevOps',
  'MERN Developer',
  'Python Developer',
  'Java Developer',
  'DBA',
  'Cloud Engineer',
  'Network Engineer',
  'Go Lang Developer',
  'Technical Support',
  'Business Analyst',
  '.NET Developer',
  'Data Analytics',
  'QA (Quality Assurance)',
];
