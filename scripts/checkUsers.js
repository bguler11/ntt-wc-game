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

  const snap = await db.collection('users').get();
  console.log('--- USERS IN FIRESTORE ---');
  snap.forEach(doc => {
    console.log(doc.id, doc.data().email || doc.data().username);
  });
  console.log('--------------------------');
  
  process.exit(0);
}
check().catch(console.error);
