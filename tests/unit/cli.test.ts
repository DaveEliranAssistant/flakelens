import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const xml=(failure=false)=>`<testsuite name="suite"><properties><property name="commit" value="abcdef1234567"/></properties><testcase classname="demo" name="race">${failure?'<failure message="Timeout">Timeout at app.ts:42</failure>':''}</testcase><testcase classname="demo" name="stable"/></testsuite>`;
function runTest(fn:(dir:string,run:(...args:string[])=>ReturnType<typeof spawnSync>)=>void){const dir=mkdtempSync(join(tmpdir(),'flakelens-cli-'));try{fn(dir,(...args)=>spawnSync(process.execPath,['--import','tsx','scripts/cli.ts',...args],{cwd:root,encoding:'utf8',timeout:20000}));}finally{rmSync(dir,{recursive:true,force:true});}}
describe('FlakeLens CLI shared product semantics',()=>{
 it('analyzes actual files with the existing parser/scorer and writes JSON + Markdown',()=>runTest((dir,run)=>{const files=[true,false,true].map((fail,i)=>{const p=join(dir,`run-${i+1}.xml`);writeFileSync(p,xml(fail));return p;});const json=join(dir,'report.json'),md=join(dir,'report.md');const r=run('--json',json,'--markdown',md,...files);expect(r.status).toBe(0);const report=JSON.parse(readFileSync(json,'utf8'));expect(report.summary).toMatchObject({runs:3,tests:2,flaky:1,stable:1,regressions:0});expect(report.tests.find((t:{name:string})=>t.name==='race').history.map((h:{finalStatus:string})=>h.finalStatus)).toEqual(['fail','pass','fail']);expect(report.note).toMatch(/CLI/);expect(readFileSync(md,'utf8')).toContain('# FlakeLens report');}));
 it('rejects malformed XML without printing input',()=>runTest((dir,run)=>{const p=join(dir,'bad.xml');writeFileSync(p,'<testsuite><testcase name="PRIVATE"/></wrong>');const r=run('--json',join(dir,'r.json'),'--markdown',join(dir,'r.md'),p);expect(r.status).toBe(2);expect(String(r.stderr)).not.toContain('PRIVATE');expect(existsSync(join(dir,'r.json'))).toBe(false);}));
 it('refuses DTD/entity declarations',()=>runTest((dir,run)=>{const p=join(dir,'entity.xml');writeFileSync(p,'<!DOCTYPE x [<!ENTITY x "private">]>'+xml());expect(run('--json',join(dir,'r.json'),'--markdown',join(dir,'r.md'),p).status).toBe(2);}));
 it('refuses oversized inputs',()=>runTest((dir,run)=>{const p=join(dir,'large.xml');writeFileSync(p,'x'.repeat(2097153));expect(run('--json',join(dir,'r.json'),'--markdown',join(dir,'r.md'),p).status).toBe(2);}));
 it('never overwrites existing output files',()=>runTest((dir,run)=>{const p=join(dir,'a.xml'),out=join(dir,'keep.json');writeFileSync(p,xml());writeFileSync(out,'keep');expect(run('--json',out,'--markdown',join(dir,'r.md'),p).status).toBe(2);expect(readFileSync(out,'utf8')).toBe('keep');}));
 it('requires distinct outputs and at least one input',()=>runTest((dir,run)=>{expect(run('--json',join(dir,'r.json'),'--markdown',join(dir,'r.md')).status).toBe(2);const p=join(dir,'a.xml');writeFileSync(p,xml());expect(run('--json',join(dir,'same'),'--markdown',join(dir,'same'),p).status).toBe(2);}));
});
