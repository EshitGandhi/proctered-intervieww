async function testJobe() {
  try {
    const res = await fetch('https://jobe.cs.canterbury.ac.nz/jobe/index.php/restapi/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         run_spec: {
            language_id: 'python3',
            sourcecode: 'print("hello jobe")'
         }
      })
    });
    console.log(await res.json());
  } catch(e) { console.error(e.message) }
}
testJobe();
