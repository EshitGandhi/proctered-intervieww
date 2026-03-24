const pdfParse = require('pdf-parse');
const fs = require('fs');

const filePath = 'C:/Users/admin/Desktop/Intereview Platform/Resume/QA_Resume_UnnatiSutradhar.pdf';
const buf = fs.readFileSync(filePath);

const skills = ['Manual Testing','Automation Testing','Selenium','Cypress','Postman','REST API Testing','Jira','Bug Tracking','Test Case Writing','JavaScript'];

pdfParse(buf).then(d => {
  const text = d.text.toLowerCase();
  console.log('TEXT LENGTH:', d.text.length);
  const matched = [], missing = [];
  skills.forEach(s => {
    if (text.includes(s.toLowerCase())) matched.push(s);
    else missing.push(s);
  });
  const score = Math.round((matched.length / skills.length) * 100);
  console.log('\nMatched:', matched);
  console.log('Missing:', missing);
  console.log('Score:', score + '%');
}).catch(e => console.error('ERROR:', e.message));
