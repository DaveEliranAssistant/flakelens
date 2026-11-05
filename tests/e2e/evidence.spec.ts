import AxeBuilder from '@axe-core/playwright';
import {test,expect} from '@playwright/test';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';
const fixture=resolve('tests/fixtures/evidence');
const names=['run-1.xml','run-2.xml','run-3.xml','missing-metadata.xml'];
test('synthetic browser and CLI agree on every verdict, evidence and observed history without upload',async({page},testInfo)=>{
 const dir=mkdtempSync(join(tmpdir(),'flakelens-evidence-'));
 try{
 const cli=spawnSync(process.execPath,['--import','tsx','scripts/cli.ts','--json',join(dir,'r.json'),'--markdown',join(dir,'r.md'),...names.map(n=>join(fixture,n))],{encoding:'utf8'});expect(cli.status,cli.stderr).toBe(0);
 const native=JSON.parse(readFileSync(join(dir,'r.json'),'utf8'));
 const expected=JSON.parse(readFileSync(join(fixture,'expected.json'),'utf8')).expectedVerdicts;
 expect(Object.fromEntries(native.tests.map((t:{testId:string;verdict:string})=>[t.testId,t.verdict]))).toEqual(expected);
 const posts:string[]=[];page.on('request',r=>posts.push(r.url()+' '+(r.postData()??'')));
 await page.goto('/');await page.locator('input[type=file]').setInputFiles(names.map(n=>join(fixture,n)));
 await expect(page.getByTestId('test-row')).toHaveCount(Object.keys(expected).length);
 for(const [id,v] of Object.entries(expected))await expect(page.locator(`[data-test-id=${JSON.stringify(id)}]`)).toHaveAttribute('data-verdict',String(v));
 await expect(page.getByText('Insufficient evidence',{exact:true}).first()).toBeVisible();
 const detail=page.getByTestId('test-row').filter({has:page.getByText('triage > single',{exact:true})}).locator('details');await detail.locator('summary').focus();await page.keyboard.press('Enter');await expect(detail).toContainText('single-failure');await expect(detail).toContainText('synthetic-3');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download JSON',exact:true}).click();const file=await (await download).path();expect(file).toBeTruthy();const browser=JSON.parse(readFileSync(file!,'utf8'));
 expect(browser.tests).toEqual(native.tests);expect(browser.summary).toEqual(native.summary);expect(browser.runs).toEqual(native.runs);expect(browser.quarantine).toEqual([]);expect(browser.actionsApplied).toEqual([]);
 expect(posts.join(' ')).not.toContain('SYNTHETIC_ONLY');
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:testInfo.outputPath('synthetic-triage-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('heading',{name:'Every test',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:testInfo.outputPath('synthetic-triage-mobile.png'),fullPage:true});
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('an invalid selected report cannot silently leave a clean partial browser result',async({page})=>{
 await page.goto('/');await page.locator('input[type=file]').setInputFiles([
 {name:'clean.xml',mimeType:'application/xml',buffer:Buffer.from('<testsuite><testcase name="clean"/></testsuite>')},
 {name:'bad.xml',mimeType:'application/xml',buffer:Buffer.from('<testsuite><testcase name="bad"/></wrong>')}]);
 await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByTestId('test-row')).toHaveCount(0);
});
