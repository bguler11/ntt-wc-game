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

  const q = await db.collection('matches').where('homeTeam', '==', 'Mexico').get();
  q.forEach(d => {
    const data = d.data();
    console.log(`${data.homeTeam} vs ${data.awayTeam} -> Status: ${data.status}`);
  });
}
check();
