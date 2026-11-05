import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),work=mkdtempSync(join(tmpdir(),'flakelens-pack-'));
try {
 const [pack]=JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',work],{cwd:join(root,'packages/cli'),encoding:'utf8'}));
 assert.deepEqual(pack.files.map(f=>f.path).sort(),['LICENSE','NOTICE.md','README.md','dist/cli.mjs','package.json']);
 const install=join(work,'consumer');mkdirSync(install);
 execFileSync('npm',['install','--prefix',install,'--cache',join(work,'fresh-cache'),'--ignore-scripts','--no-audit','--no-fund',join(work,pack.filename)],{encoding:'utf8',stdio:'pipe'});
 const cli=join(install,'node_modules/@qe-atlas/flakelens/dist/cli.mjs');
 const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:work,env:{...process.env,NODE_PATH:'',NODE_OPTIONS:''},encoding:'utf8',timeout:20000});
 assert.equal(run('--help').status,0);
 const files=[true,false,true].map((fail,i)=>{
  const file=join(work,`run-${i+1}.xml`);
  writeFileSync(file,`<testsuite name="pack"><properties><property name="commit" value="abcdef1234567"/></properties><testcase classname="demo" name="race">${fail?'<failure message="Timeout">Timeout at app.ts:42</failure>':''}</testcase><testcase classname="demo" name="stable"/></testsuite>`);return file;
 });
 const json=join(work,'report.json'),md=join(work,'report.md');
 const good=run('--json',json,'--markdown',md,...files);assert.equal(good.status,0,good.stderr);
 const report=JSON.parse(readFileSync(json,'utf8'));
 assert.equal(report.summary.flaky,1);assert.equal(report.summary.stable,1);assert.equal(report.summary.runs,3);assert.equal(report.summary.regressions,0);
 assert.deepEqual(report.tests.find(t=>t.name==='race').history.map(h=>h.finalStatus),['fail','pass','fail']);
 assert.match(readFileSync(md,'utf8'),/# FlakeLens report/);
 assert.equal(JSON.parse(readFileSync(join(work,'qe-result-flakelens.json'),'utf8')).verdict,'warn');
 const original=readFileSync(json,'utf8');assert.equal(run('--json',json,'--markdown',join(work,'other.md'),...files).status,2);assert.equal(readFileSync(json,'utf8'),original);
 const bad=join(work,'bad.xml');writeFileSync(bad,'<!DOCTYPE x [<!ENTITY x "PRIVATE">]><testsuite/>');
 const refused=run('--json',join(work,'bad.json'),'--markdown',join(work,'bad.md'),bad);assert.equal(refused.status,2);assert(!refused.stderr.includes('PRIVATE'));
 console.log(JSON.stringify({passed:true,package:pack.name,version:pack.version,files:pack.files.map(f=>f.path),isolatedInstall:true,meaningfulHistory:true,existingOutputRefused:true,entityRefused:true}));
} finally {rmSync(work,{recursive:true,force:true});}
