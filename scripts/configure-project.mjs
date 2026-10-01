import fs from 'node:fs';
import {anon,url,management} from './admin-session.mjs';
fs.writeFileSync('.env.local',`VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${anon}\n`);
const existing=await management('config/auth');
await management('config/auth','PATCH',{site_url:'http://localhost:5173',uri_allow_list:[...new Set((existing.uri_allow_list||'').split(',').filter(Boolean).concat(['http://localhost:5173/**']))].join(','),disable_signup:true,password_min_length:10});
console.log('Public environment configured; public registration disabled; password minimum 10 characters.');
