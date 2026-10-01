import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {url,secret} from './admin-session.mjs';
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const nonce=randomBytes(32).toString('hex');let busy=false,complete=false;
const setupPath=path.join(process.env.TEMP,'acai-bootstrap-url.txt');
const logo=fs.readFileSync('public/logo.png');
const escape=(v)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html=(error='')=>`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Activar administrador · Tropical</title><link rel="icon" href="/logo.png"><style>*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top,#713788,#331440);color:#35223d;font-family:system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.card{background:#fffdf8;width:100%;max-width:480px;border-radius:24px;padding:32px;box-shadow:0 25px 70px #16082250}img{width:100px;height:100px;display:block;margin:0 auto 22px}h1{font-size:27px;text-align:center;margin:0 0 12px}p{font-size:14px;line-height:1.6;color:#806d89}label{display:block;font-weight:600;font-size:13px;margin:18px 0 7px}input{display:block;width:100%;padding:12px;border:1px solid #ddd2e3;border-radius:9px;font:inherit;margin-top:8px}input:focus{outline:2px solid #b694ca}button{margin-top:24px;width:100%;border:0;border-radius:10px;background:#612879;color:white;padding:15px;font-size:15px;font-weight:650;cursor:pointer}.error{background:#ffe6e3;color:#a43c40;padding:12px;border-radius:8px}.note{text-align:center;font-size:11px;margin-top:20px}</style><div class="card"><img src="/logo.png" alt="Tropical Açaí"><h1>Tu negocio empieza aquí.</h1><p>Crea la cuenta principal de Açaí Tropical. Tendrás acceso a ventas, productos, equipo y auditoría.</p>${error?`<p class="error">${escape(error)}</p>`:''}<form method="post" action="/setup"><input type="hidden" name="token" value="${nonce}"><label>Tu nombre<input name="name" required minlength="2" maxlength="80" autocomplete="name"></label><label>Correo del administrador<input name="email" type="email" required maxlength="254" autocomplete="username"></label><label>Contraseña personal<input name="password" type="password" required minlength="10" maxlength="128" autocomplete="new-password"></label><label>Repite tu contraseña<input name="confirm" type="password" required minlength="10" maxlength="128" autocomplete="new-password"></label><button>Crear mi cuenta de administrador</button></form><p class="note">Configuración inicial privada en esta computadora.<br>Tu contraseña se envía a Supabase y no se guarda en archivos.</p></div></html>`;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; frame-ancestors 'none'");
 const origin='http://127.0.0.1:5174';if(req.headers.host!=='127.0.0.1:5174'||req.socket.remoteAddress!=='127.0.0.1'){res.writeHead(403);res.end('Acceso local requerido');return}
 if(req.url==='/logo.png'){res.setHeader('Content-Type','image/png');res.end(logo);return}
 const parsed=new URL(req.url,origin);
 if(req.method==='GET'&&parsed.pathname==='/'&&parsed.searchParams.get('token')===nonce&&!complete){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html());return}
 if(req.method!=='POST'||parsed.pathname!=='/setup'||req.headers.origin!==origin||complete){res.writeHead(403);res.end('Enlace no válido');return}
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192){res.writeHead(413);res.end();return}}
 const form=new URLSearchParams(raw);const submitted=form.get('token')||'';if(submitted.length!==nonce.length||!timingSafeEqual(Buffer.from(submitted),Buffer.from(nonce))){res.writeHead(403);res.end();return}
 const fail=(message)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html(message))};
 if(busy){fail('Ya se está creando la cuenta. Espera un momento.');return}
 const name=(form.get('name')||'').trim(),email=(form.get('email')||'').trim().toLowerCase(),password=form.get('password')||'';
 if(name.length<2||name.length>80||!/^\S+@\S+\.\S+$/.test(email)||password.length<10||password.length>128||password!==form.get('confirm')){fail('Revisa tus datos. Las contraseñas deben coincidir y tener al menos 10 caracteres.');return}
 busy=true;
 try{
  const {count,error:lookup}=await admin.from('profiles').select('id',{count:'exact',head:true}).eq('role','admin').eq('active',true);
  if(lookup)throw lookup;if(count){fail('Ya existe un administrador. Usa el inicio de sesión del sistema.');busy=false;return}
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:name}});if(error){fail(error.message.includes('already')?'Este correo ya tiene una cuenta.':'No se pudo crear la cuenta. Revisa el correo y la contraseña.');busy=false;return}
  const {error:profileError}=await admin.from('profiles').update({display_name:name,email,role:'admin',active:true,must_change_password:false}).eq('id',data.user.id).select().single();
  if(profileError){fail('La cuenta se creó, pero falta activar el perfil. Informa que la activación quedó pendiente.');busy=false;return}
  const {error:auditError}=await admin.from('audit_events').insert({actor_id:data.user.id,actor_name:name,action:'Administrador inicial creado',entity_id:data.user.id,detail:{name,role:'admin'}});if(auditError)console.log('Administrator created; audit insertion needs review.');
  complete=true;res.writeHead(303,{Location:'http://localhost:5173/'});res.end();console.log('Initial administrator successfully activated.');if(fs.existsSync(setupPath))fs.unlinkSync(setupPath);server.close();
 }catch{busy=false;fail('No se pudo conectar con Supabase. Inténtalo nuevamente.');}
});
server.listen(5174,'127.0.0.1',()=>{fs.writeFileSync(setupPath,`http://127.0.0.1:5174/?token=${nonce}`);console.log('Private administrator setup available on loopback; URL saved to temporary file.');});
