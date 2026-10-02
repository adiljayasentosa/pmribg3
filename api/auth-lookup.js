/* Resolve username -> Firebase Auth email.
   Password verification is NEVER done here. Firebase Auth handles that. */
function json(res,status,payload){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify(payload));}
function serviceAccount(){const raw=String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'').trim();if(!raw)return null;try{return JSON.parse(raw)}catch{throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tidak valid.')}}
function clean(v,max=80){return String(v??'').trim().toLowerCase().slice(0,max)}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'Method tidak diizinkan.'});
  try{
    const {initializeApp,cert,getApps}=require('firebase-admin/app');
    const {getFirestore}=require('firebase-admin/firestore');
    if(!getApps().length){const sa=serviceAccount();if(!sa)return json(res,500,{error:'Backend Firebase belum dikonfigurasi.'});initializeApp({credential:cert(sa)});}
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const username=clean(body.username);
    if(!/^[a-z0-9._-]{4,40}$/.test(username))return json(res,400,{error:'Username tidak valid.'});
    const db=getFirestore();
    const snap=await db.collection('users').where('username','==',username).limit(2).get();
    if(snap.empty)return json(res,404,{error:'Username tidak ditemukan.'});
    const profiles=snap.docs.map(d=>d.data()).filter(p=>p&&p.email);
    if(profiles.length!==1)return json(res,409,{error:'Username tidak dapat digunakan. Hubungi pengurus.'});
    return json(res,200,{ok:true,email:String(profiles[0].email).trim().toLowerCase()});
  }catch(e){console.error('[api/auth-lookup]',e);return json(res,500,{error:'Gagal mencari akun.'});}
};
