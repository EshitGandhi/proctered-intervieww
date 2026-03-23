const { executeCode } = require('./backend/src/services/judge0.service.js');

async function testNode() {
  try {
    const res = await executeCode({
        language: 'javascript',
        sourceCode: 'console.log("javascript output success!");'
    });
    console.log("JS Test:", res);
  } catch(e) {
      console.error(e.message);
  }
}

async function testJava() {
  try {
    const res = await executeCode({
        language: 'java',
        sourceCode: 'class Main { public static void main(String[] args) {} }'
    });
    console.log("Java Test:", res);
  } catch(e) {
      console.error(e.message);
  }
}

testNode();
testJava();
