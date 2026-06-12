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

  console.log(`[*] Veritabanindaki mac saatleri kontrol ediliyor...`);
  const now = new Date();
  const matchQuery = await db.collection('matches').get();
  
  let hasActiveMatch = false;
  matchQuery.docs.forEach(doc => {
    const data = doc.data();
    if (data.date) {
      const matchDate = new Date(data.date);
      // Maç şu anki zamandan önceki 160 dakika içinde mi başladı? Veya 5 dakika sonra mı başlayacak?
      const diffMinutes = (now - matchDate) / 1000 / 60;
      if (diffMinutes >= -5 && diffMinutes <= 160) {
        hasActiveMatch = true;
      }
    }
  });

  if (!hasActiveMatch) {
    console.log(`Şu an (veya son 160 dakika içinde) başlamış bir maç bulunmuyor.`);
    
    // Uyku moduna geçildiğinde veritabanında askıda kalan canlı puanları (livePoints) temizle
    try {
      const usersSnap = await db.collection('users').where('livePoints', '>', 0).get();
      if (!usersSnap.empty) {
        const batch = db.batch();
        usersSnap.docs.forEach(u => batch.update(u.ref, { livePoints: 0 }));
        await batch.commit();
        console.log(`${usersSnap.size} kullanicinin askida kalan canli puani sifirlandi.`);
      }
    } catch(err) {
      console.error("Uyku modunda canli puanlar sifirlanirken hata:", err);
    }

    console.log(`ESPN API'sine istek atilmayacak (Sifir Maliyet Uyku Modu).`);
    process.exit(0);
  }

  console.log(`[2/3] Aktif mac bulundu! ESPN API'den canli maclar cekiliyor...`);
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

      let homeTeam = homeTeamObj.team.displayName;
      let awayTeam = awayTeamObj.team.displayName;
      
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
        const isFinished = e.status.type.state === 'post' || e.status.type.detail === 'FT' || e.status.type.completed === true;
        const newStatus = isFinished ? 'FINISHED' : 'IN_PLAY';

        console.log(`Eslesme bulundu: ${homeTeam} vs ${awayTeam} -> Skor: ${homeScore}-${awayScore} (${newStatus})`);
        
        await matchDocSnap.ref.update({
          status: newStatus,
          'result.home': homeScore,
          'result.away': awayScore
        });

        // Canli Puan Hesaplama
        const qAll = await db.collection('predictions').where('matchId', '==', matchDocSnap.id).get();
        qAll.docs.forEach(pDoc => {
          const predData = pDoc.data();
          if (predData.isProcessed) return;

          const predHome = Number(predData.homeScore);
          const predAway = Number(predData.awayScore);

          const actualDiff = homeScore - awayScore;
          const predDiff = predHome - predAway;

          const isExact = (homeScore === predHome && awayScore === predAway);
          const isWinner = (Math.sign(actualDiff) === Math.sign(predDiff));
          // Beraberlik durumlarında (actualDiff === 0) fark (isDiff) kuralı uygulanmaz, sadece taraf (isWinner) puanı (1p) verilir.
          const isDiff = (actualDiff !== 0 && actualDiff === predDiff);

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
