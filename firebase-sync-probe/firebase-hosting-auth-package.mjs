// Pure local packaging. No Firebase login, deploy, network, service keys,
// billing, CRM main update, Firestore reads, or production writes.
// Builds a stand-alone Google Auth ONLY page for a future authorized
// Firebase Hosting Spark deploy. The resulting public/ contains TWO files.
import {readFileSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=dirname(fileURLToPath(import.meta.url));
const ALLOW_FILES=['index.html','firebase-web-config.mjs'];
export function buildAuthPackage({sourceRoot=ROOT,targetRoot}={}){
 const where=resolve(targetRoot||join(sourceRoot,'auth-only-staging'));
 const html=readFileSync(join(sourceRoot,'firebase-auth-smoke.html'),'utf8');
 const config=readFileSync(join(sourceRoot,'firebase-web-config.mjs'),'utf8');
 if(!config.includes('firestoreReadyForRealData = false')||
   !config.includes('honbin-crm-notes-spark'))throw Error('FIREBASE_DENY_ALL_PRECONDITION');
 if(!html.includes('./firebase-web-config.mjs')||
   /firebase-firestore|Firestore SDK|import\s*\{\s*(?:getFirestore|collection|setDoc)/i.test(html)||
   /localStorage|indexedDB|hongbin_crm_quick_notes_r73|\.\/firebase-note-service/i.test(html))
   throw Error('AUTH_PACKAGE_CONTAINS_DATA_ACCESS');
 if(/firebase\.deploy|firebase login|FIREBASE_TOKEN|PRIVATE_KEY|SERVICE_ACCOUNT/.test(html+config))
   throw Error('AUTH_PACKAGE_SECRET_OR_DEPLOYMENT');
 const publicDir=join(where,'public');
 mkdirSync(publicDir,{recursive:true});
 // Dedicated deterministic location for this generated package only;
 // do not recursively remove arbitrary user-provided directories.
 for(const name of ALLOW_FILES)writeFileSync(join(publicDir,name),
   name==='index.html'?html:config,'utf8');
 writeFileSync(join(where,'firebase.json'),JSON.stringify({
   hosting:{
     public:'public',
     ignore:['firebase.json','**/.*','**/node_modules/**'],
     headers:[
       {source:'**',headers:[
         {key:'Cache-Control',value:'no-store'},
         {key:'Referrer-Policy',value:'no-referrer'},
         {key:'X-Content-Type-Options',value:'nosniff'},
         {key:'X-Frame-Options',value:'DENY'}
       ]}
     ]
   }
 },null,2)+'\n','utf8');
 return {where,publicFiles:[...ALLOW_FILES],hostingConfig:'firebase.json',
   projectTarget:'NOT_SET_REQUIRES_EXPLICIT_OWNER_AUTHORIZATION'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  // Not run by the main CRM; only by explicit isolated packaging/test.
  const result=buildAuthPackage();
  console.log('HONBIN_AUTH_ONLY_PACKAGE_READY',result.publicFiles.join(','),
    'NO_DEPLOY_NO_FIRESTORE_NO_BILLING');
}
