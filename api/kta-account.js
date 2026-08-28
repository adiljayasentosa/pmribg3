const crypto = require('crypto');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
if (!getApps().length && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try { initializeApp({credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))}); }
  catch(e){ console.error('[api/kta-account] init:', e.message); }
}
function randomPassword(){return crypto.randomBytes(9).toString('base64url')+'A1!';}
function emailFor(ni){return `${String(ni).trim().toLowerCase()}@pmr-smkibg3.app`;}
module.exports=async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method tidak diizinkan.'});
  if(!getApps().length) return res.status(500).json({error:'Backend Firebase belum dikonfigurasi.'});
  try{
    const {idToken,anggotaId}=req.body||{}; if(!idToken||!anggotaId) return res.status(400).json({error:'idToken dan anggotaId wajib diisi.'});
    const decoded=await getAuth().verifyIdToken(idToken,true);
    const fdb=getFirestore(); const adminDoc=await fdb.collection('users').doc(decoded.uid).get();
    if(!adminDoc.exists||!['admin','ketua','wakil','sekretaris'].includes(adminDoc.data().role)) return res.status(403).json({error:'Tidak berwenang membuat akun anggota.'});
    const ref=fdb.collection('anggota').doc(anggotaId); const snap=await ref.get(); if(!snap.exists) return res.status(404).json({error:'Anggota tidak ditemukan.'});
    const a=snap.data(); const ni=String(a.nomorInduk||'').trim(); if(!ni) return res.status(400).json({error:'Nomor Induk anggota belum diisi.'});
    const email=emailFor(ni); let user; let created=false; let password=null;
    try { user=await getAuth().getUserByEmail(email); }
    catch(e){ if(e.code!=='auth/user-not-found') throw e; password=randomPassword(); user=await getAuth().createUser({email,password,displayName:String(a.nama||ni)}); created=true; }
    await fdb.collection('users').doc(user.uid).set({username:ni,nama:a.nama||ni,role:'anggota',email,anggotaId,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    const ktaToken=a.ktaToken||crypto.randomBytes(18).toString('hex');
    await ref.update({authUid:user.uid,statusAkun:'active',updatedAt:FieldValue.serverTimestamp()});
    await fdb.collection('kta').doc(anggotaId).set({anggotaId,authUid:user.uid,ktaToken,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    return res.status(200).json({ok:true,uid:user.uid,ktaToken,created,temporaryPassword:password});
  }catch(e){console.error('[api/kta-account]',e);return res.status(500).json({error:e.message||'Gagal membuat akun KTA.'});}
};
