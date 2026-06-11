import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, updateDoc, getDoc, query, where } from "firebase/firestore";

// Aynı config bilgilerini burada da kullanıyoruz
const firebaseConfig = {
  apiKey: "AIzaSyDRx4F-qpMWwHtI3tSxkY5reeuN1lAkVgI",
  authDomain: "ntt-wc-game.firebaseapp.com",
  projectId: "ntt-wc-game",
  storageBucket: "ntt-wc-game.firebasestorage.app",
  messagingSenderId: "882337808922",
  appId: "1:882337808922:web:0798967c3dcbb0c08207a3",
  measurementId: "G-KGH9M111PD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const API_KEY = "376f75d17a1d47dd8965df7579a80cec";
const TOURNAMENT_CODE = "WC"; // World Cup

async function syncMatches() {
  console.log(`[1/4] Eski maçlar veritabanından temizleniyor...`);
  try {
    // Artık maçları silmiyoruz, üstüne yazacağız (merge: true)
    // Böylece ikinci (canlı) API'nin yazdığı canlı skorlar kaybolmayacak.
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
    const livePointsMap = {}; // userId -> toplam canlı puan

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
        result: {
          home: m.score?.fullTime?.home ?? null,
          away: m.score?.fullTime?.away ?? null
        }
      };

      const existingDocRef = doc(collection(db, "matches"), matchDoc.id);
      const existingDocSnap = await getDoc(existingDocRef);

      if (existingDocSnap.exists()) {
        const existingData = existingDocSnap.data();
        // 1. Durum Koruması: Eğer ana API maç "TIMED" diyor ama veritabanımızda "IN_PLAY", "PAUSED" veya "FINISHED" ise
        if (m.status === 'TIMED' && ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(existingData.status)) {
           matchDoc.status = existingData.status;
           matchDoc.result = existingData.result;
        }

        // 2. Skor Koruması: Ana API "FINISHED" veya "IN_PLAY" diyor ama skoru 'null' gönderiyorsa, canlı API'den gelen skoru koru.
        if (matchDoc.result.home === null && existingData.result && existingData.result.home !== null) {
           matchDoc.result = existingData.result;
           // Ayrıca eğer API 'IN_PLAY' diyor ama bizde 'FINISHED' ise ve skoru null yolluyorsa durumu da koru
           if (m.status === 'IN_PLAY' && existingData.status === 'FINISHED') {
             matchDoc.status = existingData.status;
           }
        }
      }

      await setDoc(existingDocRef, matchDoc, { merge: true });
      count++;

      // --- CANLI PUANLAMA MANTIĞI (Geçici Puanlar) ---
      if ((matchDoc.status === 'IN_PLAY' || matchDoc.status === 'PAUSED') && matchDoc.result.home !== null && matchDoc.result.away !== null) {
        const qAll = query(collection(db, 'predictions'), where('matchId', '==', matchDoc.id));
        const predSnap = await getDocs(qAll);
        
        for (const pDoc of predSnap.docs) {
          const predData = pDoc.data();
          const predHome = Number(predData.homeScore);
          const predAway = Number(predData.awayScore);
          const actualHome = Number(matchDoc.result.home);
          const actualAway = Number(matchDoc.result.away);

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
        }
      }

      // --- KALICI PUANLAMA MANTIĞI ---
      if (matchDoc.status === 'FINISHED' && matchDoc.result.home !== null && matchDoc.result.away !== null) {
        const qAll = query(collection(db, 'predictions'), where('matchId', '==', matchDoc.id));
        const predSnap = await getDocs(qAll);
        
        for (const pDoc of predSnap.docs) {
          const predData = pDoc.data();
          if (predData.isProcessed) continue; // Daha önce hesaplanmışsa atla

          const predHome = Number(predData.homeScore);
          const predAway = Number(predData.awayScore);
          const actualHome = Number(matchDoc.result.home);
          const actualAway = Number(matchDoc.result.away);

          const actualDiff = actualHome - actualAway;
          const predDiff = predHome - predAway;

          const isExact = (actualHome === predHome && actualAway === predAway);
          const isDiff = (actualDiff === predDiff);
          const isWinner = (Math.sign(actualDiff) === Math.sign(predDiff));

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

          // Tahmini işlendi olarak işaretle ve kazandığı puanı kaydet
          await updateDoc(doc(db, 'predictions', pDoc.id), {
            isProcessed: true,
            earnedPoints: points
          });

          // Kullanıcının toplam puanını ve istatistiklerini güncelle
          if (predData.userId) {
            const userRef = doc(db, 'users', predData.userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const uData = userSnap.data();
              await updateDoc(userRef, {
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

    // --- KULLANICILARIN CANLI PUANLARINI GÜNCELLE ---
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const uDoc of usersSnap.docs) {
      const uData = uDoc.data();
      const currentLivePoints = uData.livePoints || 0;
      const newLivePoints = livePointsMap[uDoc.id] || 0;
      if (currentLivePoints !== newLivePoints) {
        await updateDoc(doc(db, 'users', uDoc.id), { livePoints: newLivePoints });
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
