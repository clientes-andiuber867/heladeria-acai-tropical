import {url,secret} from './admin-session.mjs';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const svc=createClient(url,secret,{auth:{persistSession:false}});
const email='qa-receipt-'+crypto.randomUUID()+'@example.com',password='Qa!'+crypto.randomUUID();
const {data,error}=await svc.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;
const id=data.user.id;const browser=await chromium.launch();const p=await browser.newPage();
try {
 await svc.from('profiles').update({role:'admin',active:true,must_change_password:false}).eq('id',id);
 await p.goto('http://localhost:5173');
 const result=await p.evaluate(async()=>{
  const {optimizeProductImage}=await import('/src/lib/images.ts');
  const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1800;
  const c=canvas.getContext('2d');const d=c.createImageData(2400,1800);for(let i=0;i<d.data.length;i+=4){d.data[i]=Math.random()*256;d.data[i+1]=Math.random()*256;d.data[i+2]=Math.random()*256;d.data[i+3]=255;}c.putImageData(d,0,0);
  const original=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.95));
  const output=await optimizeProductImage(new File([original],'photo.jpg',{type:'image/jpeg'}));
  const bitmap=await createImageBitmap(output);let rejected=false;
  try{await optimizeProductImage(new File([new Uint8Array(10*1024*1024+1)],'large.jpg',{type:'image/jpeg'}));}catch{rejected=true;}
  return {input:original.size,output:output.size,width:bitmap.width,height:bitmap.height,rejected};
 });assert(result.output<=307200);assert(result.width<=1280);assert(result.rejected);console.log('Image compression:',result);
 await p.getByLabel('Correo electrónico').fill(email);await p.getByLabel('Contraseña',{exact:true}).fill(password);await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 await p.getByRole('button',{name:'Historial de ventas',exact:true}).click();
 const period=p.locator('select').first();await period.selectOption('month').catch(()=>{});
 await p.getByRole('button',{name:/Ver detalle/}).first().click();
 await expect(p.locator('.document-number')).toContainText(/AT-\d{6}/);
 await expect(p.locator('.document-meta')).toContainText('Hora de emisión');
 await p.getByRole('button',{name:'Imprimir',exact:true}).click();
 const frame=p.frames().find(f=>f!==p.mainFrame());assert(frame,'isolated print iframe');
 const html=await frame.content();assert(!html.includes('Punto de venta'));assert(html.includes('Fecha de emisión'));
 const printPage=await browser.newPage();await printPage.setContent(html);await printPage.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
 const pdf=await printPage.pdf({preferCSSPageSize:true});const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;assert.equal(pages,1);console.log('PASS receipt order/date/time, isolated print document and one PDF page.');
} finally {await browser.close();await svc.from('audit_events').delete().eq('actor_id',id);await svc.from('profiles').delete().eq('id',id);await svc.auth.admin.deleteUser(id);}
