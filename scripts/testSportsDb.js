import fetch from 'node-fetch';

async function test() {
  const d = new Date().toISOString().split('T')[0];
  const url = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${d}&s=Soccer`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(`Events count: ${data.events ? data.events.length : 0}`);
    if (data.events) {
      data.events.slice(0, 5).forEach(e => {
        console.log(`${e.strEvent} | Status: ${e.strStatus} | Score: ${e.intHomeScore}-${e.intAwayScore}`);
      });
    }
  } catch(e) {
    console.error(e);
  }
}
test();
