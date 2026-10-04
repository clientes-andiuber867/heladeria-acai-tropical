import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return response({error:'Método no permitido'},405);
 try {
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
  if(!token)return response({error:'Sesión requerida'},401);
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user)return response({error:'Sesión inválida'},401);
  const {data:caller}=await admin.from('profiles').select('role,active,display_name').eq('id',user.id).single();
  if(!caller?.active||caller.role!=='admin')return response({error:'Solo administradores'},403);
  const body=await req.json();
  if(body.action==='delete'||body.action==='credentials'){
   if(typeof body.id!=='string')return response({error:'Usuario inválido'},400);
   const {data:target}=await admin.from('profiles').select('id,email,display_name,active,deleted_at').eq('id',body.id).single();
   if(!target||target.deleted_at)return response({error:'El acceso ya no existe'},404);
   if(body.action==='delete'){
    if(target.id===user.id)return response({error:'No puedes eliminar tu propia cuenta de administrador.'},400);
    const {error:blockError}=await admin.from('profiles').update({active:false,deleted_at:new Date().toISOString()}).eq('id',target.id);
    if(blockError)return response({error:'No se pudo bloquear el acceso'},500);
    const {error:deleteError}=await admin.auth.admin.deleteUser(target.id,true);
    if(deleteError){await admin.from('profiles').update({active:target.active,deleted_at:null}).eq('id',target.id);return response({error:'No se pudo eliminar el acceso'},500);}
    await admin.from('audit_events').insert({actor_id:user.id,actor_name:caller.display_name,action:'Acceso eliminado',entity_id:target.id,detail:{name:target.display_name,email:target.email}});
    return response({id:target.id});
   }
   const email=typeof body.email==='string'?body.email.trim().toLowerCase():target.email;
   const password=typeof body.password==='string'?body.password:'';
   if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254||(password&&(password.length<10||password.length>128)))return response({error:'Revisa el correo y la contraseña (mínimo 10 caracteres).'},400);
   const {error:updateError}=await admin.auth.admin.updateUserById(target.id,{email,email_confirm:true,...(password?{password}:{})});
   if(updateError)return response({error:'No se pudieron actualizar las credenciales. Revisa si el correo ya está en uso.'},400);
   const {error:profileError}=await admin.from('profiles').update({email,...(password?{must_change_password:false}:{})}).eq('id',target.id);
   if(profileError)return response({error:'Credenciales actualizadas; falta sincronizar el perfil.'},500);
   await admin.from('audit_events').insert({actor_id:user.id,actor_name:caller.display_name,action:'Credenciales actualizadas',entity_id:target.id,detail:{name:target.display_name,email,password_changed:!!password}});
   return response({id:target.id});
  }
  const name=typeof body.name==='string'?body.name.trim():'';
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const password=typeof body.password==='string'?body.password:'';
  if(name.length<2||name.length>80||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||password.length<10||password.length>128||!['admin','cashier'].includes(body.role))return response({error:'Revisa nombre, correo, rol y contraseña (mínimo 10 caracteres).'},400);
  const {data:created,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:name},app_metadata:{role:body.role}});
  if(error)return response({error:error.message.includes('already')?'Ya existe una cuenta con ese correo.':'No se pudo crear el usuario. Revisa el correo y la contraseña.'},400);
  const {error:profileError}=await admin.from('profiles').update({display_name:name,email,role:body.role,active:true,must_change_password:false}).eq('id',created.user.id).select('id').single();
  if(profileError)return response({error:'La cuenta quedó inactiva porque no se pudo completar su perfil. Contacta al administrador.'},500);
  const {error:auditError}=await admin.from('audit_events').insert({actor_id:user.id,actor_name:caller.display_name,action:'Usuario creado',entity_id:created.user.id,detail:{name,email,role:body.role}});
  if(auditError)return response({error:'La cuenta fue creada, pero no se pudo registrar la auditoría. Revisa el equipo antes de reintentar.'},500);
  return response({id:created.user.id});
 }catch{return response({error:'No se pudo completar la solicitud.'},500)}
});
