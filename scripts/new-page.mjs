import {cp,mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
const [slug,title=slug]=process.argv.slice(2),root=resolve(import.meta.dirname,'..');
if(!/^[a-z][a-z0-9-]{1,39}$/.test(slug||'')||!title?.trim()||title.length>30||/[<>"'&\\\x00-\x1f]/.test(title)){console.error('用法：npm run new:page -- our-story "新篇"（目录名为 2–40 位小写英文、数字和短横线；标题不含 HTML 字符、引号或反斜杠）');process.exit(1);}
const target=resolve(root,'pages',slug);
try{await access(target);console.error('这个页面目录已存在，请换一个名字。');process.exit(1);}catch(e){if(e.code!=='ENOENT')throw e;}
const registry=JSON.parse(await readFile(resolve(root,'pages/registry.json'),'utf8'));
await mkdir(target,{recursive:false});await cp(resolve(root,'pages/_starter'),target,{recursive:true});
for(const file of ['index.html','page.js']){const path=resolve(target,file);const text=await readFile(path,'utf8');await writeFile(path,text.replaceAll('__PAGE_TITLE__',()=>title).replaceAll('__PAGE_SLUG__',()=>slug));}
registry.push({slug,title});await writeFile(resolve(root,'pages/registry.json'),JSON.stringify(registry,null,2)+'\n');
console.log(`已生成 pages/${slug}/。运行 npm start，然后访问 http://127.0.0.1:4173/pages/${slug}/?mode=local`);
