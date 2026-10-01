import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createClient} from '@supabase/supabase-js';import {url,anon,secret} from './admin-session.mjs';
const fixture=JSON.parse(fs.readFileSync(path.join(process.env.TEMP,'acai-live-tests.json'),'utf8'));const options={auth:{persistSession:false,autoRefreshToken:false}};const service=createClient(url,secret,options);const guest=createClient(url,anon,options);const clients={};let checks=0;function ok(value,label){assert.ok(value,label);checks++;console.log(`PASS ${label}`)}
for(const role of ['admin','cashier','other']){const c=createClient(url,anon,options);const {error}=await c.auth.signInWithPassword(fixture.users[role]);assert.equal(error,null);clients[role]=c;}
const {admin,cashier,other}=clients;
const productInput={name:fixture.tag+' Bowl',description:'Producto temporal de validación',price:25,category:'Açaí bowls',available:true};
const {data:product,error:productError}=await admin.from('products').insert(productInput).select().single();if(productError)console.log({code:productError.code,message:productError.message});ok(!productError&&product,'administrator creates products');fixture.productId=product.id;
const anonymousProduct=await guest.from('products').select().eq('id',product.id);ok(anonymousProduct.data?.length===1,'public catalog visible anonymously');
const badProduct=await cashier.from('products').insert({...productInput,name:fixture.tag+' forbidden'});ok(!!badProduct.error,'cashier cannot create products');
const badEdit=await cashier.from('products').update({price:1}).eq('id',product.id).select();ok(!!badEdit.error||badEdit.data?.length===0,'cashier cannot edit products');
const escalation=await cashier.from('profiles').update({role:'admin'}).eq('id',fixture.users.cashier.id).select();ok(!!escalation.error||escalation.data?.length===0,'cashier cannot elevate role');
const args={p_request_id:crypto.randomUUID(),p_items:[{id:product.id,qty:2,expected_price:25}],p_method:'Efectivo',p_cash:100,p_note:fixture.tag};
const underpaid=await cashier.rpc('complete_sale',{...args,p_cash:20});ok(!!underpaid.error,'underpaid cash rejected');
const stale=await cashier.rpc('complete_sale',{...args,p_items:[{id:product.id,qty:2,expected_price:1}]});ok(!!stale.error,'tampered or stale price rejected');
const fractional=await cashier.rpc('complete_sale',{...args,p_items:[{id:product.id,qty:1.5,expected_price:25}]});ok(!!fractional.error,'fractional quantity rejected');
const [first,retry]=await Promise.all([cashier.rpc('complete_sale',args),cashier.rpc('complete_sale',args)]);ok(!first.error&&!retry.error&&first.data===retry.data,'concurrent retries create one sale');fixture.saleId=first.data;
const sale=await cashier.from('sales').select('*,sale_items(*)').eq('id',first.data).single();ok(sale.data?.total===50&&sale.data?.sale_items.length===1,'server totals and line items saved atomically');
const outsider=await other.from('sales').select().eq('id',first.data);ok(outsider.data?.length===0,'cashier cannot see another cashier sale');
const guestSale=await guest.from('sales').select();ok(!!guestSale.error||guestSale.data?.length===0,'sales not exposed publicly');
const dashboard=await cashier.rpc('dashboard_summary',{p_from:'2020-01-01',p_to:'2100-01-01'});ok(!!dashboard.error,'cashier cannot read dashboard');
const audit=await cashier.from('audit_events').select();ok(!!audit.error||audit.data?.length===0,'cashier cannot read audit');
const deleteAudit=await admin.from('audit_events').delete().eq('entity_id',product.id);ok(!!deleteAudit.error,'administrator cannot erase audit through app API');
const badVoid=await cashier.rpc('void_sale',{p_id:first.data,p_reason:'Prueba de permisos'});ok(!!badVoid.error,'cashier cannot void sale');
const goodVoid=await admin.rpc('void_sale',{p_id:first.data,p_reason:fixture.tag+' prueba controlada'});ok(!goodVoid.error,'administrator voids with reason');
const stats=await admin.rpc('dashboard_summary',{p_from:'2020-01-01',p_to:'2100-01-01'});ok(!stats.error&&stats.data.voided>=1,'dashboard reflects voided sale');
await admin.from('products').update({available:false}).eq('id',product.id);const unavailable=await cashier.rpc('complete_sale',{...args,p_request_id:crypto.randomUUID()});ok(!!unavailable.error,'sold-out product rejected by server');await admin.from('products').update({available:true}).eq('id',product.id);
const blocked=await admin.rpc('update_team_member',{p_id:fixture.users.other.id,p_name:fixture.tag+' other',p_role:'cashier',p_active:false});ok(!blocked.error,'admin can deactivate cashier');const disabledSale=await other.rpc('complete_sale',{...args,p_request_id:crypto.randomUUID()});ok(!!disabledSale.error,'deactivated session cannot sell');
const objectPath=`products/${fixture.tag}-logo.png`;const uploaded=await admin.storage.from('product-images').upload(objectPath,fs.readFileSync('public/logo.png'),{contentType:'image/png'});ok(!uploaded.error,'administrator uploads product image');fixture.objectPath=objectPath;await admin.from('products').update({image:admin.storage.from('product-images').getPublicUrl(objectPath).data.publicUrl}).eq('id',product.id);
const cashierUpload=await cashier.storage.from('product-images').upload(`products/${fixture.tag}-blocked.png`,fs.readFileSync('public/logo.png'),{contentType:'image/png'});ok(!!cashierUpload.error,'cashier cannot upload catalog photos');
const edgeBlocked=await cashier.functions.invoke('team-admin',{body:{name:'Blocked',email:'blocked@example.com',password:'BlockedPassword1!',role:'admin'}});ok(!!edgeBlocked.error,'cashier cannot create users through Edge Function');
fs.writeFileSync(path.join(process.env.TEMP,'acai-live-tests.json'),JSON.stringify(fixture));console.log(`${checks} live access and transaction checks passed.`);

