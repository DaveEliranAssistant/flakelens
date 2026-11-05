const runUrl=()=>`https://github.com/${process.env.GITHUB_REPOSITORY||'DaveEliranAssistant/flakelens'}/actions/runs/${process.env.GITHUB_RUN_ID||'0'}`;
export function buildResult(r,detailsMarkdown='',code=0){
 const base={schemaVersion:1,product:'FlakeLens',version:'0.1.0',verdict:'error',headline:'Product execution failed; inspect native outputs',metrics:[],findings:[],detailsMarkdown:detailsMarkdown.slice(0,100000),runUrl:runUrl()};
 if(!r||code===2)return base;
 base.verdict=r.summary.regressions>0?'fail':r.summary.flaky>0?'warn':'pass';base.headline=`${r.summary.flaky} flaky across ${r.summary.runs} runs; ${r.summary.regressions} regressions. Flaky findings are warnings; regressions are failures.`;
 base.metrics=['runs','tests','flaky','regressions','stable'].map(label=>({label,value:r.summary[label]}));
 base.findings=(r.tests||[]).filter(t=>t.verdict!=='stable').slice(0,100).map(t=>({change:t.verdict==='regression'?'new':'still-open',severity:t.verdict==='regression'?'high':'warning',title:`${t.verdict}; flakiness score ${t.flakinessScore}`,location:t.testId||t.name}));
 return base;
}
