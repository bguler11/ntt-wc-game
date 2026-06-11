import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } from "firebase/firestore";

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
    const matchesSnapshot = await getDocs(collection(db, "matches"));
    const deletePromises = [];
    matchesSnapshot.forEach((document) => {
      deletePromises.push(deleteDoc(doc(db, "matches", document.id)));
    });
    await Promise.all(deletePromises);
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

    console.log(`[3/4] Toplam ${matches.length} maç bulundu. Veritabanına yazılıyor...`);

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
        result: {
          home: m.score?.fullTime?.home ?? null,
          away: m.score?.fullTime?.away ?? null
        }
      };

      await setDoc(doc(collection(db, "matches"), matchDoc.id), matchDoc);
      count++;
    }

    console.log(`[4/4] Başarılı! Toplam ${count} maç Firestore'a kaydedildi.`);
    process.exit(0);

  } catch (error) {
    console.error("HATA:", error);
    process.exit(1);
  }
}

syncMatches();
