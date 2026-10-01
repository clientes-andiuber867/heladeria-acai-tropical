import fs from 'node:fs';import {management} from './admin-session.mjs';
const file=process.argv[2];await management('database/migrations','POST',{name:file.replace('.sql',''),query:fs.readFileSync(`supabase/migrations/${file}`,'utf8').replace(/^\uFEFF/,'')});console.log(`Applied ${file}`);
