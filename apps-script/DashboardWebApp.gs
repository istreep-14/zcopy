var SPREADSHEET_ID = 'PUT_YOUR_SHEET_ID_HERE';
var SESSIONS_SHEET = 'Sheet1';
var PROBLEMS_SHEET = 'Problems';
var DAILY_SHEET    = 'DailyStats';

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Smart Zetamac Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// opts = { standardize: true/false, duration: number|null, gameKey: string|null }
function getDashboardData(opts) {
  opts = opts || {};
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var sessions = readRows_(ss, SESSIONS_SHEET);
  var problems = readRows_(ss, PROBLEMS_SHEET);
  var daily    = readRows_(ss, DAILY_SHEET);

  var headerS = sessions[0] || [];
  var rowsS   = sessions.length > 1 ? sessions.slice(1) : [];
  var headerP = problems[0] || [];
  var rowsP   = problems.length > 1 ? problems.slice(1) : [];
  var headerD = (daily && daily.length) ? daily[0] : [];
  var rowsD   = (daily && daily.length > 1) ? daily.slice(1) : [];

  var idxS = indexMap_(headerS);
  var idxP = indexMap_(headerP);

  rowsS = rowsS.filter(function(r) {
    if (opts.gameKey && r[idxS['Game Key']] !== opts.gameKey) return false;
    if (!opts.standardize && opts.duration && Number(r[idxS['Duration Seconds']]||0) !== Number(opts.duration)) return false;
    return true;
  });
  rowsP = rowsP.filter(function(r) {
    if (opts.gameKey && r[idxP['Game Key']] !== opts.gameKey) return false;
    if (!opts.standardize && opts.duration && Number(r[idxP['Duration Seconds']]||0) !== Number(opts.duration)) return false;
    return true;
  });

  var totSessions = rowsS.length;
  var totDur = sumN_(rowsS.map(function(r){ return num(r[idxS['Duration Seconds']]); }));
  var totProblems = rowsP.length;

  var stdScores = rowsS.map(function(r){
    var score = num(r[idxS['Score']]);
    var dur   = num(r[idxS['Duration Seconds']]);
    var std   = num(r[idxS['Standardized Score']]);
    if (opts.standardize) return std || (dur>0 ? (score/dur*120) : 0);
    return score;
  });
  var avgStd = avgN_(stdScores);
  var bestStd = maxN_(stdScores);
  var bestScore = maxN_(rowsS.map(function(r){ return num(r[idxS['Score']]); }));
  var ppsOverall = totDur>0 ? (totProblems/totDur) : 0;

  var dailyTable = [['Date','Sessions','Total Duration Seconds','Std*Dur Sum','Weighted Avg Std Score']];
  if (opts.gameKey || (!opts.standardize && opts.duration)) {
    var map = {};
    rowsS.forEach(function(r){
      var d = String(r[idxS['Local Date']]||'');
      if (!d) return;
      if (!map[d]) map[d] = {sess:0, dur:0, stdDurSum:0};
      var dur = num(r[idxS['Duration Seconds']]);
      var score = num(r[idxS['Score']]);
      var std = opts.standardize ? (dur>0 ? (score/dur*120) : 0) : score;
      map[d].sess += 1;
      map[d].dur += dur;
      map[d].stdDurSum += std*dur;
    });
    Object.keys(map).sort().forEach(function(d){
      var v = map[d];
      var w = v.dur>0 ? v.stdDurSum/v.dur : 0;
      dailyTable.push([d, v.sess, v.dur, v.stdDurSum, w]);
    });
  } else {
    dailyTable = daily && daily.length ? daily : dailyTable;
  }

  var uniqueKeys = {};
  rowsS.forEach(function(r){ var k = r[idxS['Game Key']]; if (k) uniqueKeys[k]=true; });
  var gameKeys = Object.keys(uniqueKeys).sort();

  var byOp = buildByOperator_(rowsP, idxP);
  var trend = buildTrendFromDaily_(dailyTable);
  var table2D = buildMulDivGrid_(rowsP, idxP);
  var pacingThirds = buildPacingThirds_(rowsP, idxP);

  return {
    filters: {
      gameKeys: gameKeys,
      durations: guessDurations_(rowsS, idxS),
      standardize: !!opts.standardize,
      selectedDuration: opts.duration || null,
      selectedGameKey: opts.gameKey || null
    },
    kpis: {
      totalSessions: totSessions,
      totalDuration: totDur,
      totalProblems: totProblems,
      perfMetricLabel: opts.standardize ? 'Avg Standardized Score (to 120s)' : 'Avg Raw Score',
      avgPerf: avgStd,
      bestPerf: bestStd,
      bestScore: bestScore,
      overallProblemsPerSec: ppsOverall
    },
    daily: dailyTable,
    byOperator: byOp,
    trend: trend,
    grid2D: table2D,
    pacingThirds: pacingThirds
  };
}

/* ---------- Builders ---------- */

function buildByOperator_(rowsP, idxP) {
  var groups = {'+':[], '-':[], '*':[], '/':[]};
  rowsP.forEach(function(r){
    var op = String(r[idxP['Operator']]||'');
    var lat = num(r[idxP['Latency Ms']]);
    if (!groups[op]) groups[op]=[];
    groups[op].push(lat);
  });
  var total = rowsP.length || 1;
  var header = ['Operator','Count','Share','Avg Latency Ms','Median Ms','p90 Ms','p95 Ms','Problems/sec','Std Score Contribution'];
  var rows = [header];

  var durByOp = {'+':0,'-':0,'*':0,'/':0};
  var sessSeen = {'+':{},'-':{},'*':{},'/':{}};
  rowsP.forEach(function(r){
    var op = String(r[idxP['Operator']]||'');
    var ts = String(r[idxP['Timestamp']]||'');
    var dur = num(r[idxP['Duration Seconds']]);
    if (!ts) return;
    if (!sessSeen[op]) sessSeen[op] = {};
    if (!sessSeen[op][ts]) { durByOp[op] = (durByOp[op]||0) + dur; sessSeen[op][ts]=true; }
  });

  ['+','-','*','/'].forEach(function(op){
    var arr = groups[op] || [];
    var count = arr.length;
    var share = count/total;
    var avg = avgN_(arr);
    var med = percentile_(arr,0.5);
    var p90 = percentile_(arr,0.9);
    var p95 = percentile_(arr,0.95);
    var pps = (durByOp[op]||0)>0 ? (count/durByOp[op]) : 0;
    var stdContrib = pps*120;
    rows.push([op, count, share, avg, med, p90, p95, pps, stdContrib]);
  });
  return rows;
}

function buildTrendFromDaily_(dailyTable) {
  if (!dailyTable || dailyTable.length<=1) return [['Date','Avg Std Score','Rolling 7-day Avg']];
  var rows = dailyTable.slice(1).map(function(r){ return [String(r[0]), num(r[4])]; });
  var out = [['Date','Avg Std Score','Rolling 7-day Avg']];
  var window = [];
  rows.forEach(function(r){
    var v = num(r[1]);
    window.push(v);
    if (window.length>7) window.shift();
    var roll = avgN_(window);
    out.push([r[0], v, roll]);
  });
  return out;
}

function buildMulDivGrid_(rowsP, idxP) {
  var map = {}; var maxA=0, maxB=0;
  rowsP.forEach(function(r){
    var op = String(r[idxP['Operator']]||'');
    var A = num(r[idxP['A']]);
    var B = num(r[idxP['B']]);
    var lat = num(r[idxP['Latency Ms']]);
    if (!lat) return;
    var pair = normalizePair_(op, A, B); if (!pair) return;
    var a = pair.a, b = pair.b;
    maxA = Math.max(maxA, a||0); maxB = Math.max(maxB, b||0);
    var key = (a||0)+'|'+(b||0);
    if (!map[key]) map[key]=[];
    map[key].push(lat);
  });
  var limitA = Math.min(maxA || 12, 30);
  var limitB = Math.min(maxB || 100, 120);
  var header = ['A\\B']; for (var b=2;b<=limitB;b++) header.push(b);
  var rows = [header];
  for (var a=2;a<=limitA;a++){
    var row=[a];
    for (var b2=2;b2<=limitB;b2++){
      var key=a+'|'+b2; var arr=map[key]||[]; row.push(arr.length? avgN_(arr): null);
    }
    rows.push(row);
  }
  return rows;
}

function normalizePair_(op, A, B) {
  if (!op) return null;
  if (op==='*') return { a:A, b:B };
  if (op==='/') { if (!B) return null; var c=Math.floor(A/B); if (c<=0) return null; return { a:B, b:c }; }
  if (op==='+') return { a:A, b:B };
  if (op==='-') { var c2=A-B; var x=Math.min(B,c2), y=Math.max(B,c2); if (x<=0||y<=0) return null; return { a:x, b:y }; }
  return null;
}

function buildPacingThirds_(rowsP, idxP) {
  var groups={};
  rowsP.forEach(function(r){ var t=num(r[idxP['Third']]); var lat=num(r[idxP['Latency Ms']]); if(!t) return; if(!groups[t]) groups[t]=[]; groups[t].push(lat); });
  var out=[['Third','Avg Ms','Median Ms','p90 Ms','p95 Ms']];
  [1,2,3].forEach(function(t){ var arr=groups[t]||[]; out.push([t, avgN_(arr), percentile_(arr,0.5), percentile_(arr,0.9), percentile_(arr,0.95)]); });
  return out;
}

function guessDurations_(rowsS, idxS){ var set={}; rowsS.forEach(function(r){ var d=Number(r[idxS['Duration Seconds']]||0); if(d) set[d]=true; }); return Object.keys(set).map(function(k){return Number(k);} ).sort(function(a,b){return a-b;}); }

/* ---------- Low-level utils ---------- */

function readRows_(ss, name){ var sh=ss.getSheetByName(name); if(!sh) return []; var last=sh.getLastRow(), w=sh.getLastColumn(); if(last<1||w<1) return []; return sh.getRange(1,1,last,w).getDisplayValues(); }
function indexMap_(header){ var m={}; for (var i=0;i<header.length;i++) m[header[i]]=i; return m; }
function num(v){ v=(v===null||v==='')?0:v; return Number(v); }
function avgN_(arr){ if(!arr.length) return 0; var s=0; for (var i=0;i<arr.length;i++) s+=Number(arr[i]||0); return s/arr.length; }
function maxN_(arr){ if(!arr.length) return 0; var m=Number(arr[0]||0); for (var i=1;i<arr.length;i++){ var v=Number(arr[i]||0); if(v>m)m=v; } return m; }
function percentile_(arr,p){ if(!arr.length) return 0; var a=arr.map(Number).filter(function(x){return !isNaN(x);}).sort(function(x,y){return x-y;}); var n=a.length; var r=1+(n-1)*p; if(r<=1) return a[0]; if(r>=n) return a[n-1]; var lo=Math.floor(r)-1, hi=Math.ceil(r)-1, f=r-Math.floor(r); return a[lo]+f*(a[hi]-a[lo]); }