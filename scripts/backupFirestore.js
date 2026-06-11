import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function backup() {
  const serviceAccountPath = path.join(__dirname, '..', 'ntt-wc-game-6c5fcc94ae05.json');
  const serviceAccountData = await fs.readFile(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountData);

  initializeApp({
    credential: cert(serviceAccount)
  });

  const db = getFirestore();

  console.log('Veritabanı yedeği alınıyor...');
  const collections = await db.listCollections();
  const backupData = {};

  for (const collection of collections) {
    console.log(`Koleksiyon okunuyor: ${collection.id}`);
    backupData[collection.id] = {};
    const snapshot = await collection.get();
    snapshot.forEach((doc) => {
      backupData[collection.id][doc.id] = doc.data();
    });
  }

  const outPath = path.join(__dirname, '..', 'veritabani_yedek.json');
  await fs.writeFile(outPath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`Yedekleme tamamlandı: ${outPath}`);
  
  process.exit(0);
}

backup().catch(err => {
    console.error('Yedekleme sırasında hata oluştu:', err);
    process.exit(1);
});
