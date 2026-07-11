import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = "376f75d17a1d47dd8965df7579a80cec";
const TOURNAMENT_CODE = "WC"; // World Cup

async function syncMatches() {
  console.log(`[1/4] Eski maçlar veritabanından temizleniyor...`);
  try {
    const serviceAccountPath = path.join(__dirname, '..', 'ntt-wc-game-6c5fcc94ae05.json');
    const serviceAccountData = await fs.readFile(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountData);

    initializeApp({ credential: cert(serviceAccount) });
    const db = getFirestore();

    console.log(`[2/4] Eski maçlar silindi. API'den ${TOURNAMENT_CODE} maçları çekiliyor...`);
    
    const response = await fetch(`https://api.football-data.org/v4/competitions/${TOURNAMENT_CODE}/matches`, {
      headers: {
        "X-Auth-Token": API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API Hatası: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const matches = data.matches;

    console.log(`[3/4] Toplam ${matches.length} maç bulundu. Veritabanına yazılıyor ve puanlar hesaplanıyor...`);

    let count = 0;

    for (const m of matches) {
      const homeTeam = m.homeTeam?.name || 'Belirsiz';
      const awayTeam = m.awayTeam?.name || 'Belirsiz';
      
      const matchDoc = {
        id: m.id.toString(),
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        homeFlag: m.homeTeam?.crest || '🌐',
        awayFlag: m.awayTeam?.crest || '🌐',
        date: m.utcDate,
        status: m.status,
        group: m.group || null,
        result: {
          home: m.score?.fullTime?.home ?? null,
          away: m.score?.fullTime?.away ?? null
        }
      };

      const existingDocRef = db.collection("matches").doc(matchDoc.id);
      const existingDocSnap = await existingDocRef.get();

      if (existingDocSnap.exists) {
        const existingData = existingDocSnap.data();
        if (m.status === 'TIMED' && ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(existingData.status)) {
           matchDoc.status = existingData.status;
           matchDoc.result = existingData.result;
        }

        if (matchDoc.result.home === null && existingData.result && existingData.result.home !== null) {
           matchDoc.result = existingData.result;
           if (m.status === 'IN_PLAY' && existingData.status === 'FINISHED') {
             matchDoc.status = existingData.status;
           }
        }
      }

      await existingDocRef.set(matchDoc, { merge: true });
      count++;
      console.log(`[İlerleme] Maç eklendi: ${count}/${matches.length} - ${homeTeam} vs ${awayTeam}`);

      if (matchDoc.status === 'FINISHED' && matchDoc.result.home !== null && matchDoc.result.away !== null) {
        const qAll = await db.collection('predictions').where('matchId', '==', matchDoc.id).get();
        
        for (const pDoc of qAll.docs) {
          const predData = pDoc.data();
          if (predData.isProcessed) continue;

          const predHome = Number(predData.homeScore);
          const predAway = Number(predData.awayScore);
          const actualHome = Number(matchDoc.result.home);
          const actualAway = Number(matchDoc.result.away);

          const actualDiff = actualHome - actualAway;
          const predDiff = predHome - predAway;

          const isExact = (actualHome === predHome && actualAway === predAway);
          const isWinner = (Math.sign(actualDiff) === Math.sign(predDiff));
          const isDiff = (actualDiff !== 0 && actualDiff === predDiff);

          let points = 0;
          let exactCount = 0;
          let diffCount = 0;
          let winnerCount = 0;

          if (isExact) {
            points = 3;
            exactCount = 1;
          } else if (isDiff) {
            points = 2;
            diffCount = 1;
          } else if (isWinner) {
            points = 1;
            winnerCount = 1;
          }

          await db.collection('predictions').doc(pDoc.id).update({
            isProcessed: true,
            earnedPoints: points
          });

          if (predData.userId) {
            const userRef = db.collection('users').doc(predData.userId);
            const userSnap = await userRef.get();
            if (userSnap.exists) {
              const uData = userSnap.data();
              await userRef.update({
                points: (uData.points || 0) + points,
                exactMatches: (uData.exactMatches || 0) + exactCount,
                diffMatches: (uData.diffMatches || 0) + diffCount,
                correctWinners: (uData.correctWinners || 0) + winnerCount
              });
            }
          }
        }
      }
    }

    console.log(`[4/4] Başarılı! Toplam ${count} maç Firestore'a kaydedildi ve puanlar güncellendi.`);
    process.exit(0);

  } catch (error) {
    console.error("HATA:", error);
    process.exit(1);
  }
}

syncMatches();
