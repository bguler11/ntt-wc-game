import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testLive() {
  const serviceAccountPath = path.join(__dirname, '..', 'ntt-wc-game-6c5fcc94ae05.json');
  const serviceAccountData = await fs.readFile(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountData);

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const livePointsMap = {};

  const matchesSnap = await db.collection('matches').where('status', 'in', ['IN_PLAY', 'PAUSED']).get();
  
  for (const matchDoc of matchesSnap.docs) {
    const matchData = matchDoc.data();
    
    const qAll = await db.collection('predictions').where('matchId', '==', matchDoc.id).get();
    
    qAll.forEach(pDoc => {
      const predData = pDoc.data();
      const predHome = Number(predData.homeScore);
      const predAway = Number(predData.awayScore);
      const actualHome = Number(matchData.result.home);
      const actualAway = Number(matchData.result.away);

      const actualDiff = actualHome - actualAway;
      const predDiff = predHome - predAway;

      const isExact = (actualHome === predHome && actualAway === predAway);
      const isDiff = (actualDiff === predDiff);
      const isWinner = (Math.sign(actualDiff) === Math.sign(predDiff));

      let points = 0;
      if (isExact) points = 3;
      else if (isDiff) points = 2;
      else if (isWinner) points = 1;

      if (predData.userId) {
        livePointsMap[predData.userId] = (livePointsMap[predData.userId] || 0) + points;
      }
    });
  }

  const usersSnap = await db.collection('users').get();
  const batch = db.batch();
  usersSnap.forEach(uDoc => {
    const newLivePoints = livePointsMap[uDoc.id] || 0;
    batch.update(uDoc.ref, { livePoints: newLivePoints });
  });
  await batch.commit();

  console.log("Canli puanlar guncellendi:", livePointsMap);
  process.exit(0);
}
testLive().catch(console.error);
