const axios = require('axios');
async function test() {
  const c = await axios.post('http://api.paiza.io/runners/create', { source_code: 'print("hello")', language: 'python3', api_key: 'guest' });
  console.log('Created:', c.data);
  const id = c.data.id;
  const g = await axios.get(`http://api.paiza.io/runners/get_details?id=${id}&api_key=guest`);
  console.log('Get 1:', g.data);
  await new Promise(r => setTimeout(r, 2000));
  const g2 = await axios.get(`http://api.paiza.io/runners/get_details?id=${id}&api_key=guest`);
  console.log('Get 2:', g2.data);
}
test();
