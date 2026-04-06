const fs = require('fs');
let data = fs.readFileSync('backend/src/services/report.service.js', 'utf8');
data = data.split('\\`').join('`');
data = data.split('\\$').join('$');
fs.writeFileSync('backend/src/services/report.service.js', data);
