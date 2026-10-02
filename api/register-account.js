/* Create the Firebase Auth/profile for a self-registering member.
   Called immediately after the client creates the Firebase Auth user. */
function json(res,status,payload){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify(payload));}
function serviceAccount(){const raw=String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'').trim();if(!raw)return null;try{return JSON.parse(raw)}catch{throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tidak valid.')}}
function clean(v,max=200){return String(v??'').trim().slice(0,max)}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'Method tidak diizinkan.'});
  try{
    const {initializeApp,cert,getApps}=require('firebase-admin/app');
    const {getAuth}=require('firebase-admin/auth');
    const {getFirestore,FieldValue}=require('firebase-admin/firestore');
    if(!getApps().length){const sa=serviceAccount();if(!sa)return json(res,500,{error:'Backend Firebase belum dikonfigurasi.'});initializeApp({credential:cert(sa)});}
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const idToken=clean(body.idToken,5000), username=clean(body.username,40).toLowerCase(), nama=clean(body.nama,120), email=clean(body.email,160).toLowerCase();
    if(!idToken||!username||!nama||!email)return json(res,400,{error:'Data akun belum lengkap.'});
    if(!/^[a-z0-9._-]{4,40}$/.test(username))return json(res,400,{error:'Username harus 4–40 karakter dan hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau tanda hubung.'});
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json(res,400,{error:'Email tidak valid.'});
    const auth=getAuth();
    const decoded=await auth.verifyIdToken(idToken,true);
    const user=await auth.getUser(decoded.uid);
    if(String(user.email||'').toLowerCase()!==email)return json(res,400,{error:'Email akun tidak cocok.'});
    const db=getFirestore();
    const existing=await db.collection('users').where('username','==',username).limit(2).get();
    if(!existing.empty && !existing.docs.some(d=>d.id===decoded.uid))return json(res,409,{error:'Username sudah digunakan. Pilih username lain.'});
    const existingEmail=await db.collection('users').where('email','==',email).limit(2).get();
    if(!existingEmail.empty && !existingEmail.docs.some(d=>d.id===decoded.uid))return json(res,409,{error:'Email sudah terdaftar pada akun lain.'});
    await db.collection('users').doc(decoded.uid).set({
      username,nama,email,role:'anggota',status:'pending',anggotaId:null,registrationStatus:'pending',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()
    },{merge:true});
    return json(res,200,{ok:true,uid:decoded.uid,username});
  }catch(e){
    console.error('[api/register-account]',e);
    const known={'auth/id-token-expired':'Sesi pembuatan akun kedaluwarsa. Silakan ulangi pendaftaran.','auth/id-token-revoked':'Sesi pembuatan akun sudah dicabut.','auth/invalid-id-token':'Token pembuatan akun tidak valid.'};
    return json(res,500,{error:known[e?.code]||e?.message||'Gagal membuat profil akun.'});
  }
};
