import fs from 'node:fs';
let source=fs.readFileSync('src/components/AppShell.tsx','utf8').replace("import {useState} from 'react';","import {useState,lazy,Suspense} from 'react';\nimport {Loading} from './States';");
for(const [name,file] of [['DashboardPage','dashboard/DashboardPage'],['ProductsPage','catalog/ProductsPage'],['SalesPage','sales/SalesPage'],['SalesHistory','sales/SalesHistory'],['AuditPage','audit/AuditPage'],['TeamPage','team/TeamPage'],['QRPage','menu/QRPage']]){
 source=source.replace(`import {${name}} from '../features/${file}';`,`const ${name}=lazy(()=>import('../features/${file}').then(m=>({default:m.${name}})));`);
}
source=source.replace('<main className="content" key={current}>','<main className="content" key={current}><Suspense fallback={<Loading/>}>').replace('</main></div></div>','</Suspense></main></div></div>');fs.writeFileSync('src/components/AppShell.tsx',source);
const p=JSON.parse(fs.readFileSync('package.json'));p.scripts.test='playwright test';p.scripts.format='prettier --write src tests vite.config.ts playwright.config.ts';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
