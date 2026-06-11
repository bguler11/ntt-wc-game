import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setLive() {
  const serviceAccountPath = path.join(__dirname, '..', 'ntt-wc-game-6c5fcc94ae05.json');
  const serviceAccountData = await fs.readFile(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountData);

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  // Find a finished match and set it to IN_PLAY temporarily for testing
  const snap = await db.collection('matches').limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    await doc.ref.update({
      status: 'IN_PLAY',
      'result.home': 2,
      'result.away': 1
    });
    console.log(`Test icin ${doc.data().homeTeam} vs ${doc.data().awayTeam} maci IN_PLAY yapildi.`);
  }
  process.exit(0);
}
setLive().catch(console.error);
