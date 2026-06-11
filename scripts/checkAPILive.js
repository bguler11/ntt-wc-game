const API_KEY = "376f75d17a1d47dd8965df7579a80cec";
const TOURNAMENT_CODE = "WC";

async function check() {
  const response = await fetch(`https://api.football-data.org/v4/competitions/${TOURNAMENT_CODE}/matches`, {
    headers: { "X-Auth-Token": API_KEY }
  });
  const data = await response.json();
  const liveMatches = data.matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  console.log(`API'de bulunan CANLI maç sayısı: ${liveMatches.length}`);
  liveMatches.forEach(m => {
    console.log(`${m.homeTeam?.name} vs ${m.awayTeam?.name} | Status: ${m.status} | Score: ${m.score?.fullTime?.home}-${m.score?.fullTime?.away}`);
  });
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayMatches = data.matches.filter(m => m.utcDate.startsWith(todayStr));
  console.log(`\nAPI'de BUGÜN oynanan maç sayısı: ${todayMatches.length}`);
  todayMatches.forEach(m => {
    console.log(`${m.homeTeam?.name} vs ${m.awayTeam?.name} | Date: ${m.utcDate} | Status: ${m.status} | Score: ${m.score?.fullTime?.home}-${m.score?.fullTime?.away}`);
  });
}
check().catch(console.error);
