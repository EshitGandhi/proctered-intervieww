async function testWandbox() {
  try {
    const res = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         compiler: "cpython-3.10.0",
         code: "print('hello wandbox')"
      })
    });
    console.log(await res.json());
  } catch(e) { console.error(e.message) }
}
testWandbox();
