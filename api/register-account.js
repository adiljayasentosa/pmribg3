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
    const userRef=db.collection('users').doc(decoded.uid);
    const usernameRef=db.collection('usernameIndex').doc(username);

    // Username uniqueness is enforced through a single deterministic index document.
    // This avoids scanning/querying the whole users collection and is race-safe because
    // the check + reservation happen inside one Firestore transaction. Firebase Auth
    // already enforces email uniqueness, so a second Firestore email query is unnecessary.
    await db.runTransaction(async tx=>{
      const [usernameSnap,userSnap]=await tx.getAll(usernameRef,userRef);
      const existingProfile=userSnap.exists ? (userSnap.data()||{}) : null;
      const indexedUid=usernameSnap.exists ? String((usernameSnap.data()||{}).uid||'') : '';

      if(indexedUid && indexedUid!==decoded.uid){
        throw Object.assign(new Error('Username sudah digunakan. Pilih username lain.'),{code:'USERNAME_TAKEN'});
      }

      if(existingProfile){
        const oldUsername=String(existingProfile.username||'').trim().toLowerCase();
        const oldEmail=String(existingProfile.email||'').trim().toLowerCase();
        if(oldUsername && oldUsername!==username){
          throw Object.assign(new Error('Akun ini sudah memiliki username berbeda.'),{code:'USERNAME_MISMATCH'});
        }
        if(oldEmail && oldEmail!==email){
          throw Object.assign(new Error('Email akun tidak cocok dengan profil.'),{code:'EMAIL_MISMATCH'});
        }
      }

      const now=FieldValue.serverTimestamp();
      if(!usernameSnap.exists){
        tx.create(usernameRef,{uid:decoded.uid,username,createdAt:now,updatedAt:now});
      }
      if(!userSnap.exists){
        tx.create(userRef,{username,nama,email,role:'anggota',status:'pending',anggotaId:null,registrationStatus:'pending',createdAt:now,updatedAt:now});
      }else if(String(existingProfile.status||'').toLowerCase()==='pending' && String(existingProfile.registrationStatus||'').toLowerCase()==='pending'){
        // Idempotent retry: keep the existing pending account instead of creating
        // another profile or forcing the user to repeat Step 1.
        tx.update(userRef,{username,nama,email,updatedAt:now});
      }
    });

    return json(res,200,{ok:true,uid:decoded.uid,username});
  }catch(e){
    console.error('[api/register-account]',e);
    const known={'auth/id-token-expired':'Sesi pembuatan akun kedaluwarsa. Silakan ulangi pendaftaran.','auth/id-token-revoked':'Sesi pembuatan akun sudah dicabut.','auth/invalid-id-token':'Token pembuatan akun tidak valid.','USERNAME_TAKEN':'Username sudah digunakan. Pilih username lain.','USERNAME_MISMATCH':'Akun ini sudah memiliki username berbeda.','EMAIL_MISMATCH':'Email akun tidak cocok dengan profil.','RESOURCE_EXHAUSTED':'Pendaftaran sedang mengalami gangguan sementara. Silakan coba kembali nanti.','8':'Pendaftaran sedang mengalami gangguan sementara. Silakan coba kembali nanti.'};
    const safeError=known[e?.code] || (/RESOURCE_EXHAUSTED|Quota exceeded/i.test(String(e?.message||'')) ? known.RESOURCE_EXHAUSTED : 'Gagal membuat profil akun.');
    return json(res,e?.code==='USERNAME_TAKEN'?409:500,{error:safeError});
  }
};
