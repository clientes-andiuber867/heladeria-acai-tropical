import {url,secret,anon} from './admin-session.mjs';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const svc=createClient(url,secret,{auth:{persistSession:false}}),email='qa-navigation-'+crypto.randomUUID()+'@example.com',password='Qa!'+crypto.randomUUID();
const {data,error}=await svc.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;
const id=data.user.id,browser=await chromium.launch();
try{
 await svc.from('profiles').update({role:'admin',active:true,must_change_password:false}).eq('id',id);
 const client=createClient(url,anon,{auth:{persistSession:false}});await client.auth.signInWithPassword({email,password});
 const {data:events,error:e}=await client.rpc('search_audit',{p_from:'2026-01-01',p_to:'2026-12-31',p_scope:'cash'});assert.ifError(e);assert(events.length>0);assert(events.every(e=>['Caja abierta','Caja cerrada'].includes(e.action)));
 const p=await browser.newPage();await p.goto('http://localhost:5173');await p.getByLabel('Correo electrónico').fill(email);await p.getByLabel('Contraseña',{exact:true}).fill(password);await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 await expect(p.locator('main.content>div')).toHaveCount(8);await expect(p.locator('main .loading-state')).toHaveCount(0,{timeout:20000});
 for(const name of ['Auditoría','Historial de ventas','Mis productos','Resumen','Auditoría']){await p.getByRole('button',{name,exact:true}).click();assert.equal(await p.locator('.loading-state:visible').count(),0);}
 await p.getByRole('button',{name:'Aperturas y cierres de caja',exact:true}).click();await expect(p.locator('.activity-event h3').first()).toContainText(/Caja (abierta|cerrada)/);await expect(p.getByRole('heading',{name:'Aperturas y cierres de caja',exact:true})).toBeVisible();
 console.log('PASS server cash-only scope, eight screens warmed, repeated navigation without loading indicator, cash audit tab.');
}finally{await browser.close();await svc.from('audit_events').delete().eq('actor_id',id);await svc.from('profiles').delete().eq('id',id);await svc.auth.admin.deleteUser(id);}
