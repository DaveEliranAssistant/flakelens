import test from 'node:test';import assert from 'node:assert/strict';import {buildResult} from './qe-result.mjs';
const report=(flaky,regressions)=>({summary:{runs:5,tests:5,stable:3,flaky,regressions},tests:[]});
test('flaky without regressions is WARN, regressions are FAIL, only clean is PASS',()=>{assert.equal(buildResult(report(1,0)).verdict,'warn');assert.equal(buildResult(report(1,1)).verdict,'fail');assert.equal(buildResult(report(0,1)).verdict,'fail');assert.equal(buildResult(report(0,0)).verdict,'pass');});
