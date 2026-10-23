import {readdir,readFile,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
async function check(dir){for(const row of await readdir(dir,{withFileTypes:true})){const path=join(dir,row.name);if(row.isSymbolicLink())throw Error('子页面不允许符号链接');if(row.isDirectory())await check(path);else if(row.name.endsWith('.js'))execFileSync(process.execPath,['--check',path],{stdio:'inherit'});}}
await check(resolve(root,'shared'));await check(resolve(root,'pages'));
const rows=JSON.parse(await readFile(resolve(root,'pages/registry.json'),'utf8')),seen=new Set();
if(!Array.isArray(rows))throw Error('页面目录必须是数组');
for(const row of rows){if(!/^[a-z][a-z0-9-]{1,39}$/.test(row.slug)||typeof row.title!=='string'||!row.title.trim()||seen.has(row.slug))throw Error('页面目录条目无效或重复');seen.add(row.slug);await access(resolve(root,'pages',row.slug,'index.html'));}
console.log(`子页面检查通过：${rows.length} 个已登记页面。`);
