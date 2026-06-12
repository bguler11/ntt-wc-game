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

  console.log(`[2/3] ESPN API'den canli maclar cekiliyor...`);
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.events) {
      console.log("Bugun icin ESPN API'de mac bulunamadi.");
      process.exit(0);
    }

    // state: "in" (live), "post" (finished)
    const liveEvents = data.events.filter(e => e.status.type.state === 'in' || e.status.type.state === 'post');
    
    console.log(`ESPN API'de ${liveEvents.length} adet CANLI veya BITMIS mac bulundu.`);

    const livePointsMap = {}; // userId -> points
    
    for (const e of liveEvents) {
      const comp = e.competitions[0];
      const homeTeamObj = comp.competitors.find(c => c.homeAway === 'home');
      const awayTeamObj = comp.competitors.find(c => c.homeAway === 'away');
      
      if (!homeTeamObj || !awayTeamObj) continue;

      // Takım isimlerini düzelt (API'den dönen isimleri Firebase formatına göre eşleştirmek için eklenebilir)
      let homeTeam = homeTeamObj.team.displayName;
      let awayTeam = awayTeamObj.team.displayName;
      
      // Bosna Hersek API'den Bosnia-Herzegovina olarak dönüyor.
      if(homeTeam === 'Bosnia-Herzegovina') homeTeam = 'Bosnia-Herzegovina'; 
      if(awayTeam === 'Bosnia-Herzegovina') awayTeam = 'Bosnia-Herzegovina';

      const homeScore = parseInt(homeTeamObj.score) || 0;
      const awayScore = parseInt(awayTeamObj.score) || 0;

      // Firestore'da eslesen maci bul (İsimlere gore eslestirme)
      const matchQuery = await db.collection('matches')
        .where('homeTeam', '==', homeTeam)
        .where('awayTeam', '==', awayTeam)
        .get();

      if (!matchQuery.empty) {
        const matchDocSnap = matchQuery.docs[0];
        const isFinished = e.status.type.state === 'post';
        // Eğer maç ESPN'de bittiyse (post), ancak Firebase'de "PAUSED" veya "IN_PLAY" ise bitmiş yapalım.
        const newStatus = isFinished ? 'FINISHED' : 'IN_PLAY';

        console.log(`Eslesme bulundu: ${homeTeam} vs ${awayTeam} -> Skor: ${homeScore}-${awayScore} (${newStatus})`);
        
        // Mac durumunu ve skorunu anlik guncelle
        await matchDocSnap.ref.update({
          status: newStatus,
          'result.home': homeScore,
          'result.away': awayScore
        });

        // Canli Puan Hesaplama
        const qAll = await db.collection('predictions').where('matchId', '==', matchDocSnap.id).get();
        qAll.docs.forEach(pDoc => {
          const predData = pDoc.data();
          if (predData.isProcessed) return; // Zaten kalici puana donusmusse canli puan ekleme

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
