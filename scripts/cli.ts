import {constants,openSync,fstatSync,readFileSync,closeSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,basename,dirname,join} from 'node:path';
import {buildResult} from '../qe-result.mjs';
import {XMLValidator} from 'fast-xml-parser';
import {parseJUnit} from '../src/lib/parse-junit';
import {analyzeRuns} from '../src/lib/analyze';
import {analysisToJson,analysisToMarkdown} from '../src/lib/report';

function main(args:string[]){
 if(args.length===1&&args[0]==='--help'){console.log('FlakeLens CLI: --json NEW.json --markdown NEW.md junit-1.xml [junit-2.xml ...]\nExit 0: analysis produced (findings are informational); 2: invalid input/tool failure. No uploads.');return;}
 const files:string[]=[],options:Record<string,string>={};
 for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--json'||arg==='--markdown'||arg==='--qe-result'){if(options[arg]||!args[i+1]||args[i+1].startsWith('--'))throw Error();options[arg]=resolve(args[++i]);}else if(arg.startsWith('-'))throw Error();else files.push(resolve(arg));}
 if(!options['--json']||!options['--markdown']||options['--json']===options['--markdown']||files.length<1||files.length>100||new Set(files).size!==files.length||Object.values(options).some(p=>existsSync(p)||files.includes(p)))throw Error();
 options['--qe-result'] ||= join(dirname(options['--json']),'qe-result-flakelens.json');
 if(new Set(Object.values(options)).size!==3||existsSync(options['--qe-result'])||files.includes(options['--qe-result']))throw Error();
 let total=0;
 const runs=files.map((file,index)=>{
  const fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW);
  let bytes:Buffer;try{const st=fstatSync(fd);if(!st.isFile()||st.size>2097152)throw Error();bytes=readFileSync(fd);}finally{closeSync(fd);}
  total+=bytes.length;if(bytes.length>2097152||total>10485760)throw Error();
  const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(/<!DOCTYPE|<!ENTITY|\u0000/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error();
  const run=parseJUnit(xml,basename(file),index);if(run.attempts.length>50000)throw Error();return run;
 });
 const analysis=analyzeRuns(runs);
 const json=JSON.parse(analysisToJson(analysis,null));
 json.note='Analyzed locally by the FlakeLens CLI with the shared browser parser/scorer. Source files were not uploaded.';
 writeFileSync(options['--json'],JSON.stringify(json,null,2)+'\n',{flag:'wx',mode:0o600});
 writeFileSync(options['--markdown'],analysisToMarkdown(analysis,null),{flag:'wx',mode:0o600});
 writeFileSync(options['--qe-result'],JSON.stringify(buildResult(json,analysisToMarkdown(analysis,null),0),null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(`FlakeLens: ${analysis.runs.length} runs, ${analysis.tests.length} tests, ${analysis.flakyCount} flaky, ${analysis.regressionCount} regressions, ${analysis.stableCount} stable.`);
}
try{main(process.argv.slice(2));}catch{console.error('FlakeLens: invalid arguments, unsafe/oversized XML, existing output or local I/O failure. Input contents are not echoed. Use --help.');process.exitCode=2;}
