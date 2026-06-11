import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function check() {
  const serviceAccountPath = path.join(__dirname, '..', 'ntt-wc-game-6c5fcc94ae05.json');
  const serviceAccountData = await fs.readFile(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountData);

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const snap = await db.collection('matches').where('status', 'in', ['IN_PLAY', 'PAUSED']).get();
  console.log(`Bulunan canli mac sayisi: ${snap.size}`);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, data.homeTeam, "vs", data.awayTeam, "Status:", data.status, "Result:", data.result);
  });
  
  process.exit(0);
}
check().catch(console.error);
