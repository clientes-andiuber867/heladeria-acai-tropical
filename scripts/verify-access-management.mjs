import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {createClient} from '@supabase/supabase-js';import {chromium} from '@playwright/test';import {url,anon,secret} from './admin-session.mjs';
const owner=JSON.parse(fs.readFileSync(path.join(process.env.TEMP,'acai-owner-access.json'),'utf8'));const opts={auth:{persistSession:false,autoRefreshToken:false}};const client=createClient(url,anon,opts);const service=createClient(url,secret,opts);const login=await client.auth.signInWithPassword({email:owner.email,password:owner.password});assert.equal(login.error,null);
const tag='qa-access-'+randomUUID().slice(0,8),password='Test!'+randomUUID();let id;
try{
const created=await client.functions.invoke('team-admin',{body:{name:tag,email:tag+'@example.com',password,role:'cashier'}});assert.equal(created.error,null);id=created.data.id;
const edited=await client.functions.invoke('team-admin',{body:{action:'credentials',id,email:tag+'-edited@example.com',password:password+'X'}});assert.equal(edited.error,null);
const staff=createClient(url,anon,opts);assert.equal((await staff.auth.signInWithPassword({email:tag+'-edited@example.com',password:password+'X'})).error,null);
const deleted=await client.functions.invoke('team-admin',{body:{action:'delete',id}});if(deleted.error)console.log(await deleted.error.context.text());assert.equal(deleted.error,null);
const blocked=await createClient(url,anon,opts).auth.signInWithPassword({email:tag+'-edited@example.com',password:password+'X'});assert.ok(blocked.error);
const self=await client.functions.invoke('team-admin',{body:{action:'delete',id:owner.id}});assert.ok(self.error);
console.log('PASS create, edit credentials, delete access, reject deleted login and protect own administrator.');
}finally{if(id){await service.from('audit_events').delete().eq('entity_id',id);await service.from('audit_events').delete().eq('actor_id',id);await service.from('profiles').delete().eq('id',id);await service.auth.admin.deleteUser(id)}}
const b=await chromium.launch();const p=await b.newPage();await p.goto('http://localhost:5173');await p.getByLabel('Correo electrónico').fill(owner.email);await p.getByLabel('Contraseña',{exact:true}).fill(owner.password);await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await p.getByRole('button',{name:'Usuarios y roles',exact:true}).click();await p.getByRole('heading',{name:'Usuarios y roles',exact:true}).waitFor();console.log('PASS administrator browser login and Usuarios y roles.');await b.close();
