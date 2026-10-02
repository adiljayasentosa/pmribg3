const crypto = require('crypto');
function json(res,status,payload){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify(payload));}
function serviceAccount(){const raw=String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'').trim();if(!raw)return null;try{return JSON.parse(raw)}catch{throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tidak valid.')}}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'Method tidak diizinkan.'});
  try{
    const {initializeApp,cert,getApps}=require('firebase-admin/app');
    const {getAuth}=require('firebase-admin/auth');
    const {getFirestore,FieldValue}=require('firebase-admin/firestore');
    if(!getApps().length){const sa=serviceAccount();if(!sa)return json(res,500,{error:'Backend Firebase belum dikonfigurasi.'});initializeApp({credential:cert(sa)});}
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const {idToken,anggotaId,action='activate'}=body;
    if(!idToken||!anggotaId)return json(res,400,{error:'idToken dan anggotaId wajib diisi.'});
    const auth=getAuth(),db=getFirestore();
    const decoded=await auth.verifyIdToken(idToken,true);
    const adminDoc=await db.collection('users').doc(decoded.uid).get();
    const adminRole=adminDoc.exists?String(adminDoc.data().role||''):'';
    if(!['admin','pembina','pengurus'].includes(adminRole))return json(res,403,{error:'Tidak berwenang mengaktifkan verifikasi KTA.'});
    if(action!=='activate')return json(res,400,{error:'Pengelolaan akun anggota melalui KTA sudah dinonaktifkan. Akun dibuat oleh anggota saat pendaftaran.'});
    const ref=db.collection('anggota').doc(String(anggotaId));
    const snap=await ref.get();
    if(!snap.exists)return json(res,404,{error:'Anggota tidak ditemukan.'});
    const a=snap.data()||{};
    const authUid=String(a.authUid||'').trim();
    if(!authUid)return json(res,409,{error:'Anggota ini belum memiliki akun pribadi. KTA tidak lagi digunakan untuk membuat akun.'});
    const token=String(a.ktaToken||'').trim()||crypto.randomBytes(18).toString('base64url');
    await ref.set({ktaToken:token,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    await db.collection('kta').doc(String(anggotaId)).set({anggotaId:String(anggotaId),authUid,ktaToken:token,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    return json(res,200,{ok:true,anggotaId:String(anggotaId),authUid,ktaToken:token,alreadyActive:Boolean(a.ktaToken)});
  }catch(e){
    console.error('[api/kta-account]',e);
    const known={'auth/id-token-expired':'Sesi admin sudah kedaluwarsa. Silakan login ulang.','auth/id-token-revoked':'Sesi admin sudah dicabut. Silakan login ulang.','auth/invalid-id-token':'Token login admin tidak valid. Silakan login ulang.'};
    return json(res,500,{error:known[e?.code]||e?.message||'Gagal mengaktifkan verifikasi KTA.'});
  }
};
