import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanup() {
  const serviceAccountPath = path.join(__dirname, '..', 'ntt-wc-game-6c5fcc94ae05.json');
  const serviceAccountData = await fs.readFile(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountData);

  initializeApp({
    credential: cert(serviceAccount)
  });

  const db = getFirestore();
  const auth = getAuth();

  const uidsToDelete = [
    "8DjGm8gHX9aSOHP638XVLyAPznq1",
    "7kIlTVcCZGMQ8Ht0tDtdcOtkPUi1",
    "F98MSEjHLsX1gmGlTI5Dkf0GoC13"
  ];

  console.log('Temizlik işlemi başlıyor...');

  for (const uid of uidsToDelete) {
    console.log(`\nİşlem yapılan UID: ${uid}`);
    
    // 1. Delete from Auth
    try {
      await auth.deleteUser(uid);
      console.log(`- Firebase Auth üzerinden kullanıcı silindi.`);
    } catch (e) {
      console.log(`- Auth silme hatası (zaten silinmiş olabilir): ${e.message}`);
    }

    // 2. Delete from users collection
    try {
      await db.collection('users').doc(uid).delete();
      console.log(`- 'users' koleksiyonundan silindi.`);
    } catch (e) {
      console.log(`- 'users' koleksiyonu silme hatası: ${e.message}`);
    }

    // 3. Delete from predictions collection
    try {
      const preds = await db.collection('predictions').where('userId', '==', uid).get();
      if (!preds.empty) {
        const batch = db.batch();
        preds.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`- Bu kullanıcıya ait ${preds.size} adet tahmin (prediction) silindi.`);
      } else {
        console.log(`- Bu kullanıcıya ait silinecek tahmin bulunamadı.`);
      }
    } catch (e) {
      console.log(`- Tahminleri silme hatası: ${e.message}`);
    }
  }

  console.log('\nTemizlik tamamlandı!');
  process.exit(0);
}

cleanup().catch(err => {
    console.error('Hata:', err);
    process.exit(1);
});
