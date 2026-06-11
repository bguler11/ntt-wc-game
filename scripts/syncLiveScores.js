import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function syncLiveScores() {
  console.log(`[1/3] Firebase baslatiliyor...`);
  const serviceAccountPath = path.join(__dirname, '..', 'ntt-wc-game-6c5fcc94ae05.json');
  const serviceAccountData = await fs.readFile(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountData);

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  console.log(`[2/3] TheSportsDB'den gunluk canli maclar cekiliyor...`);
  const d = new Date().toISOString().split('T')[0];
  const url = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${d}&s=Soccer`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.events) {
      console.log("Bugun icin TheSportsDB'de mac bulunamadi.");
      process.exit(0);
    }

    const liveStatuses = ['1H', '2H', 'HT', 'LIVE', 'IN_PLAY']; 
    const liveEvents = data.events.filter(e => liveStatuses.includes(e.strStatus));
    
    console.log(`TheSportsDB'de ${liveEvents.length} adet CANLI mac bulundu.`);

    const livePointsMap = {}; // userId -> points
    
    for (const e of liveEvents) {
      const homeTeam = e.strHomeTeam;
      const awayTeam = e.strAwayTeam;
      const homeScore = parseInt(e.intHomeScore) || 0;
      const awayScore = parseInt(e.intAwayScore) || 0;

      // Firestore'da eslesen maci bul (Eski API'nin id'sine gore degil, isimlere gore eslestirme)
      const matchQuery = await db.collection('matches')
        .where('homeTeam', '==', homeTeam)
        .where('awayTeam', '==', awayTeam)
        .get();

      if (!matchQuery.empty) {
        const matchDocSnap = matchQuery.docs[0];
        console.log(`Eslesme bulundu: ${homeTeam} vs ${awayTeam} -> Skor: ${homeScore}-${awayScore}`);
        
        // Mac durumunu ve skorunu anlik guncelle
        await matchDocSnap.ref.update({
          status: 'IN_PLAY',
          'result.home': homeScore,
          'result.away': awayScore
        });

        // Canli Puan Hesaplama
        const qAll = await db.collection('predictions').where('matchId', '==', matchDocSnap.id).get();
        qAll.docs.forEach(pDoc => {
          const predData = pDoc.data();
          const predHome = Number(predData.homeScore);
          const predAway = Number(predData.awayScore);

          const actualDiff = homeScore - awayScore;
          const predDiff = predHome - predAway;

          const isExact = (homeScore === predHome && awayScore === predAway);
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
      } else {
        console.log(`Eslesme BULUNAMADI: ${homeTeam} vs ${awayTeam}`);
      }
    }

    console.log(`[3/3] Kullanici canli puanlari guncelleniyor...`);
    const usersSnap = await db.collection('users').get();
    const batch = db.batch();
    let updatedCount = 0;
    
    usersSnap.docs.forEach(uDoc => {
      const uData = uDoc.data();
      const currentLivePoints = uData.livePoints || 0;
      const newLivePoints = livePointsMap[uDoc.id] || 0;
      if (currentLivePoints !== newLivePoints) {
        batch.update(uDoc.ref, { livePoints: newLivePoints });
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`${updatedCount} kullanicinin canli puani guncellendi.`);
    } else {
      console.log(`Degisen canli puan yok.`);
    }

    console.log(`Canli skor guncellemesi tamamlandi.`);
    process.exit(0);
  } catch(e) {
    console.error("HATA:", e);
    process.exit(1);
  }
}
syncLiveScores();
