import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const source=resolve(import.meta.dirname,'..');
test('生成器创建完整独立页面并登记，拒绝覆盖、越界路径与可执行标题',async()=>{
 const root=await mkdtemp(join(tmpdir(),'youqi-subsite-'));
 try{
  await mkdir(join(root,'scripts'));await mkdir(join(root,'pages'));
  await cp(join(source,'scripts/new-page.mjs'),join(root,'scripts/new-page.mjs'));
  await cp(join(source,'pages/_starter'),join(root,'pages/_starter'),{recursive:true});
  await writeFile(join(root,'pages/registry.json'),'[]');
  const run=(...args)=>spawnSync(process.execPath,[join(root,'scripts/new-page.mjs'),...args],{encoding:'utf8'});
  assert.equal(run('our-story','同行').status,0);
  const html=await readFile(join(root,'pages/our-story/index.html'),'utf8');
  assert.match(html,/<h1>同行<\/h1>/);assert.match(html,/\.\.\/\.\.\/shared\/subsite.css/);
  const js=await readFile(join(root,'pages/our-story/page.js'),'utf8');assert.match(js,/youqi.page.our-story.draft/);
  assert.deepEqual(JSON.parse(await readFile(join(root,'pages/registry.json'),'utf8')),[{slug:'our-story',title:'同行'}]);
  assert.notEqual(run('our-story','改名').status,0);assert.equal(await readFile(join(root,'pages/our-story/index.html'),'utf8'),html);
  for(const args of [['../escape','新篇'],['Uppercase','新篇'],['safe','<script>'],['safe',"a'b"],['safe','a\\b']])assert.notEqual(run(...args).status,0);
  assert.equal(JSON.parse(await readFile(join(root,'pages/registry.json'),'utf8')).length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
