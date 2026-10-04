/* One-time migration helper for existing users. Run locally with a Firebase service account.
 * It creates usernameIndex/{username} for every users/{uid} profile that has a username.
 * Safe to rerun: existing matching index entries are skipped.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}' node scripts/seed-username-index.js
 */
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

function loadServiceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY belum diisi.');
  return JSON.parse(raw);
}

if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) });
const db = getFirestore();

(async () => {
  const snap = await db.collection('users').get();
  let created = 0, skipped = 0, invalid = 0;
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const username = String(data.username || '').trim().toLowerCase();
    if (!username || !/^[a-z0-9._-]{4,40}$/.test(username)) { invalid++; continue; }
    const ref = db.collection('usernameIndex').doc(username);
    const current = await ref.get();
    if (current.exists) {
      const uid = String((current.data() || {}).uid || '');
      if (uid !== doc.id) throw new Error(`Konflik username "${username}": ${uid} vs ${doc.id}`);
      skipped++;
      continue;
    }
    await ref.create({ uid: doc.id, username, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    created++;
  }
  console.log(JSON.stringify({ ok: true, scanned: snap.size, created, skipped, invalid }, null, 2));
})().catch(err => { console.error('[seed-username-index]', err); process.exitCode = 1; });
