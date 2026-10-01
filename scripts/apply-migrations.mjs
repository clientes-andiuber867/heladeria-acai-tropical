import fs from 'node:fs';
import {management} from './admin-session.mjs';
for (const file of ['202610010001_initial.sql','202610010002_live_system.sql']) {
 const query=fs.readFileSync(`supabase/migrations/${file}`,'utf8').replace(/^\uFEFF/,'');
 await management('database/migrations','POST',{name:file.replace('.sql',''),query});
 console.log(`Applied ${file}`);
}
