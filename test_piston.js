async function testPiston() {
  try {
    const res = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            language: 'python',
            version: '*',
            files: [{ content: 'print("hello piston")' }]
        })
    });
    console.log(await res.json());
  } catch(e) { console.error(e.message); }
}
testPiston();
