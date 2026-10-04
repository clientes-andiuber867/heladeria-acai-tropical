import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const b=await chromium.launch();try{const p=await b.newPage();await p.goto('http://localhost:5173');await fs.mkdir('public/icons',{recursive:true});
for(const [size,mask] of [[180,false],[192,false],[512,false],[512,true]]){
const png=await p.evaluate(async({size,mask})=>{const img=new Image();img.src='/logo.png';await img.decode();const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');ctx.fillStyle='#faf7f0';ctx.fillRect(0,0,size,size);const ratio=(mask?.7:.9)*size/Math.max(img.width,img.height);const w=img.width*ratio,h=img.height*ratio;ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);return c.toDataURL('image/png').split(',')[1];},{size,mask});await fs.writeFile(`public/icons/acai-${mask?'maskable-':''}${size}.png`,Buffer.from(png,'base64'));}
const cdp=await p.context().newCDPSession(p);await p.reload();console.log(JSON.stringify(await cdp.send('Page.getAppManifest')));console.log(JSON.stringify(await cdp.send('Page.getInstallabilityErrors')));
}finally{await b.close();}
