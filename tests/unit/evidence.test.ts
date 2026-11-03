import {describe,it,expect} from 'vitest';
import {analyzeRuns} from '@/lib/analyze';
import {parseJUnit} from '@/lib/parse-junit';
import {analysisToJson,analysisToMarkdown} from '@/lib/report';
function run(status:'pass'|'fail'|'skip',i:number,opts:{commit?:string|null;runId?:string;time?:string|null;retry?:boolean}={}){
 const commit=opts.commit===undefined?['aaaaaaa','bbbbbbb','ccccccc'][i%3]:opts.commit;
 const time=opts.time===undefined?`2026-01-0${i+1}T00:00:00Z`:opts.time;
 const props=[commit?`<property name="commit" value="${commit}"/>`:'',`<property name="run_id" value="${opts.runId??'r'+i}"/>`,time?`<property name="timestamp" value="${time}"/>`:''].join('');
 const fail=status==='fail'?'<failure message="Synthetic failure">Synthetic failure</failure>':status==='skip'?'<skipped/>':'';
 const retry=opts.retry?'<properties><property name="retry" value="0"/></properties>':'';
 const recovered=opts.retry?'<testcase classname="synthetic" name="case"><properties><property name="retry" value="1"/></properties></testcase>':'';
 return parseJUnit(`<testsuite name="synthetic"><properties>${props}</properties><testcase classname="synthetic" name="case">${retry}${fail}</testcase>${recovered}</testsuite>`,`evidence-${i}.xml`,i);
}
const one=(runs:ReturnType<typeof run>[])=>analyzeRuns(runs).tests[0]!;
describe('conservative evidence policy',()=>{
 it('abstains on one failure rather than inventing a flake',()=>{const t=one([run('fail',0)]);expect(t.verdict).toBe('insufficient-evidence');expect(t.evidence.reasonCodes).toContain('single-failure');expect(t.evidence.runCount).toBe(1);expect(t.evidence.action).toMatch(/investigate/i);});
 it('abstains on a single trailing failure',()=>expect(one([run('pass',0),run('pass',1),run('fail',2)]).verdict).toBe('insufficient-evidence'));
 it('does not call an always-failing test a regression without a passing baseline',()=>{const t=one([run('fail',0),run('fail',1)]);expect(t.verdict).toBe('insufficient-evidence');expect(t.introducedCommit).toBeNull();expect(t.evidence.reasonCodes).toContain('no-passing-baseline');});
 it('recognizes explicit retry recovery while retaining missing metadata as a limitation',()=>{const t=one([run('fail',0,{commit:null,retry:true})]);expect(t.verdict).toBe('flaky');expect(t.passedOnRetry).toBe(1);expect(t.evidence.reasonCodes).toContain('retry-recovery');expect(t.evidence.missingCommitRuns).toBe(1);expect(t.history[0]?.retryIndexes).toEqual([0,1]);expect(t.history[0]?.commitSource).toBe('order');});
 it('recognizes differing outcomes at the same provided commit',()=>{const t=one([run('fail',0,{commit:'abcdef0'}),run('pass',1,{commit:'abcdef0'})]);expect(t.verdict).toBe('flaky');expect(t.evidence.reasonCodes).toContain('same-commit-outcomes');});
 it('does not confuse changes across commits with proof of nondeterminism',()=>{const t=one([run('pass',0),run('fail',1),run('pass',2)]);expect(t.verdict).toBe('insufficient-evidence');expect(t.evidence.reasonCodes).toContain('cross-commit-only');});
 it('identifies a persistent post-pass failure pattern with independent ordered runs',()=>{const t=one([run('pass',0),run('fail',1),run('fail',2)]);expect(t.verdict).toBe('regression');expect(t.introducedCommit).toBe('bbbbbbb');expect(t.evidence.reasonCodes).toContain('persistent-failure-after-pass');expect(t.evidence.runCount).toBe(3);expect(t.history.map(h=>h.runId)).toEqual(['r0','r1','r2']);});
 it('does not infer a regression from missing commit metadata or file order',()=>{const t=one([run('pass',0,{commit:null}),run('fail',1,{commit:null}),run('fail',2,{commit:null})]);expect(t.verdict).toBe('insufficient-evidence');expect(t.evidence.missingCommitRuns).toBe(3);expect(one([run('pass',0,{time:null}),run('fail',1,{time:null}),run('fail',2,{time:null})]).verdict).toBe('insufficient-evidence');});
 it('does not count two files with the same run identity as independent failing runs',()=>{const t=one([run('pass',0),run('fail',1,{runId:'same-run',commit:'bbbbbbb'}),run('fail',2,{runId:'same-run',commit:'bbbbbbb'})]);expect(t.verdict).toBe('insufficient-evidence');expect(t.evidence.reasonCodes).toContain('duplicate-run-identity');});
 it('does not call all-skipped tests stable',()=>{const t=one([run('skip',0)]);expect(t.verdict).toBe('insufficient-evidence');expect(t.evidence.reasonCodes).toContain('no-executed-attempts');});
 it('describes passing observations without promising future stability',()=>{const t=one([run('pass',0)]);expect(t.verdict).toBe('stable');expect(t.evidence.reasonCodes).toContain('no-failures-observed');});
 it('does not let old flaky history hide a new persistent failure pattern',()=>{const t=one([run('fail',0,{commit:'aaaaaaa',retry:true}),run('pass',1,{commit:'aaaaaaa'}),run('fail',2,{commit:'bbbbbbb'}),run('fail',3,{commit:'bbbbbbb'})]);expect(t.verdict).toBe('regression');});
 it('does not present an inferred duplicate testcase as an explicit retry',()=>{const parsed=parseJUnit('<testsuite><testcase name="x"><failure/></testcase><testcase name="x"/></testsuite>','missing.xml',0);const t=one([parsed]);expect(t.passedOnRetry).toBe(0);expect(t.verdict).toBe('insufficient-evidence');expect(t.evidence.inferredRetryAttempts).toBeGreaterThan(0);});
 it('exports abstention and evidence without automatically generating a quarantine policy',()=>{const analysis=analyzeRuns([run('fail',0)]);const json=JSON.parse(analysisToJson(analysis,null));expect(json.summary.insufficientEvidence).toBe(1);expect(json.tests[0].evidence).toEqual(analysis.tests[0]?.evidence);expect(json.quarantine).toEqual([]);expect(json.actionsApplied).toEqual([]);const md=analysisToMarkdown(analysis,null);expect(md).toContain('insufficient-evidence');expect(md).toContain('single-failure');expect(md).toContain('r0');expect(md).toContain('aaaaaaa');expect(md).toContain('heuristic');});
});

describe('ingestion accuracy',()=>{
 it('orders timezone-offset timestamps by actual time, not string order',()=>{
  const runs=[run('pass',0,{time:'2026-01-01T12:00:00+02:00'}),run('fail',1,{time:'2026-01-01T11:00:00Z'}),run('fail',2,{time:'2026-01-01T12:00:00Z'})];
  expect(one(runs).verdict).toBe('regression');
 });
 it('rejects malformed XML and declarations in the same parser used by the browser',()=>{
  expect(()=>parseJUnit('<testsuite><testcase name="x"/></wrong>','bad.xml',0)).toThrow();
  expect(()=>parseJUnit('<!DOCTYPE x [<!ENTITY x "secret">]><testsuite><testcase name="x"/></testsuite>','bad.xml',0)).toThrow();
 });
 it('does not silently omit unnamed failing testcases',()=>{
  expect(()=>parseJUnit('<testsuite><testcase><failure/></testcase><testcase name="clean"/></testsuite>','bad.xml',0)).toThrow();
 });
});

describe('qualified newer regression windows',()=>{
 for(const defect of ['missing-commit','missing-run-id'] as const)it(`does not let older ${defect} retry history hide a newer qualified regression`,()=>{
  const old=run('fail',0,{retry:true,commit:defect==='missing-commit'?null:'ddddddd'});
  if(defect==='missing-run-id')old.runIdSource='order';
  const t=one([old,run('pass',1,{commit:'aaaaaaa'}),run('fail',2,{commit:'bbbbbbb'}),run('fail',3,{commit:'bbbbbbb'})]);
  expect(t.verdict).toBe('regression');expect(t.introducedCommit).toBe('bbbbbbb');expect(t.evidence.warnings.length).toBeGreaterThan(1);
 });
 it('does not let known-older duplicate run IDs or tied timestamps mask a newer boundary',()=>{
  const t=one([run('fail',0,{retry:true,commit:'ddddddd',runId:'old',time:'2026-01-01T00:00:00Z'}),run('pass',0,{commit:'ddddddd',runId:'old',time:'2026-01-01T00:00:00Z'}),run('pass',1,{commit:'aaaaaaa'}),run('fail',2,{commit:'bbbbbbb'}),run('fail',3,{commit:'bbbbbbb'})]);
  expect(t.verdict).toBe('regression');expect(t.evidence.reasonCodes).toContain('duplicate-run-identity');
 });
 it('still refuses a boundary with undated possibly newer observations or defects inside its own window',()=>{
  expect(one([run('fail',0,{retry:true,time:null}),run('pass',1,{commit:'aaaaaaa'}),run('fail',2,{commit:'bbbbbbb'}),run('fail',3,{commit:'bbbbbbb'})]).verdict).not.toBe('regression');
  expect(one([run('pass',0,{commit:'aaaaaaa'}),run('fail',1,{commit:null}),run('fail',2,{commit:'bbbbbbb'})]).verdict).toBe('insufficient-evidence');
 });
});
