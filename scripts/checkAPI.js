const API_KEY = "376f75d17a1d47dd8965df7579a80cec";
const TOURNAMENT_CODE = "WC";

async function check() {
  const response = await fetch(`https://api.football-data.org/v4/competitions/${TOURNAMENT_CODE}/matches`, {
    headers: { "X-Auth-Token": API_KEY }
  });
  const data = await response.json();
  console.log(`Found ${data.matches.length} matches.`);
  if (data.matches.length > 0) {
    console.log("First match:", data.matches[0].utcDate, data.matches[0].homeTeam.name, "vs", data.matches[0].awayTeam.name);
    console.log("Last match:", data.matches[data.matches.length - 1].utcDate, data.matches[data.matches.length - 1].homeTeam.name, "vs", data.matches[data.matches.length - 1].awayTeam.name);
  }
}
check();
