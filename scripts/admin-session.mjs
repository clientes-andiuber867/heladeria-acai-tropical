import fs from 'node:fs';
import path from 'node:path';
export const sessionPath=path.join(process.env.TEMP,'acai-setup-session.json');
export const config=JSON.parse(fs.readFileSync(sessionPath,'utf8').replace(/^\uFEFF/,''));
export const url=`https://${config.ref}.supabase.co`;
export const anon=config.keys.find(k=>k.type==='publishable')?.api_key || config.keys.find(k=>k.name==='anon')?.api_key;
export const secret=config.keys.find(k=>k.name==='service_role')?.api_key;
export async function management(endpoint,method='GET',body){
 const r=await fetch(`https://api.supabase.com/v1/projects/${config.ref}/${endpoint}`,{method,headers:{Authorization:`Bearer ${config.pat}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 if(!r.ok)throw new Error(`Management ${endpoint}: ${r.status} ${await r.text()}`);return r.status===204?null:r.json();
}
export async function sql(query,read_only=false){return management('database/query','POST',{query,read_only})}
export async function authAdmin(endpoint,method='GET',body){const r=await fetch(`${url}/auth/v1/admin/${endpoint}`,{method,headers:{apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`Auth admin: ${r.status} ${await r.text()}`);return r.json()}
