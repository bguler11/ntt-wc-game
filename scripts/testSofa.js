import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('https://api.sofascore.com/api/v1/sport/football/events/live', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://www.sofascore.com',
        'Referer': 'https://www.sofascore.com/'
      }
    });
    
    if (!res.ok) {
      console.log('Error:', res.status, res.statusText);
      return;
    }
    
    const data = await res.json();
    console.log(`Live events found: ${data.events ? data.events.length : 0}`);
    if (data.events) {
      data.events.slice(0, 5).forEach(e => {
        console.log(`${e.tournament.name} | ${e.homeTeam.name} ${e.homeScore.current} - ${e.awayScore.current} ${e.awayTeam.name}`);
      });
    }
  } catch(e) {
    console.error(e);
  }
}
test();
