const { executeCode } = require('./backend/src/services/judge0.service.js');

async function testPaiza() {
  try {
    const res = await executeCode({
        language: 'python',
        sourceCode: 'print(eval(input()))',
        stdin: '1+2+3'
    });
    console.log(res);
  } catch(e) {
      console.error(e.message);
  }
}
testPaiza();
