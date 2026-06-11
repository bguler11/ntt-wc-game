import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fix() {
  const serviceAccountPath = path.join(__dirname, '..', 'ntt-wc-game-6c5fcc94ae05.json');
  const serviceAccountData = await fs.readFile(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountData);

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const uid = "T7YXvcxiwDVrDAuQLsOpXC0LFIE3"; // barisguler93@gmail.com
  const docRef = db.collection('users').doc(uid);
  
  const doc = await docRef.get();
  if (!doc.exists) {
    console.log("Ana hesap için profil Firestore'da bulunamadı, yeniden oluşturuluyor...");
    await docRef.set({
      email: "barisguler93@gmail.com",
      username: "barisguler93",
      points: 0,
      exactMatches: 0,
      diffMatches: 0,
      correctWinners: 0,
      livePoints: 0,
      createdAt: new Date()
    });
    console.log("Profil başarıyla oluşturuldu.");
  } else {
    console.log("Profil zaten mevcut.");
  }

  // Kullanıcının tahminlerini baştan hesaplamak için isProcessed bayrağını sıfırlıyoruz
  const preds = await db.collection('predictions').where('userId', '==', uid).get();
  if (!preds.empty) {
    const batch = db.batch();
    preds.forEach(p => {
      batch.update(p.ref, { isProcessed: false, earnedPoints: 0 });
    });
    await batch.commit();
    console.log(`Ana hesabın yaptığı ${preds.size} tahminin puanları yeniden hesaplanmak üzere sıfırlandı.`);
  }

  process.exit(0);
}
fix().catch(console.error);
