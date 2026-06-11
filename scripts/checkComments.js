import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function check() {
  const serviceAccountData = await fs.readFile(path.join(__dirname, '..', 'ntt-wc-game-6c5fcc94ae05.json'), 'utf8');
  initializeApp({ credential: cert(JSON.parse(serviceAccountData)) });
  const db = getFirestore();

  const q = await db.collection('comments').get();
  console.log(`Toplam yorum sayisi: ${q.size}`);
  q.forEach(d => {
    const data = d.data();
    console.log(`Match: ${data.matchId}, User: ${data.userId}, Text: ${data.text}, Date: ${data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt}`);
  });
}
check();
