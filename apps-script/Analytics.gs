/**
 * Analytics.gs
 * Run-on-demand analytics WITHOUT spreadsheet formulas.
 * Menu: Analytics > Recompute All Analytics
 */

var SPREADSHEET_ID        = 'PUT_YOUR_SHEET_ID_HERE';
var SESSIONS_SHEET_NAME   = 'Sheet1';
var PROBLEMS_SHEET_NAME   = 'Problems';
var DAILYSTATS_SHEET_NAME = 'DailyStats';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Analytics')
    .addItem('Recompute All Analytics', 'recomputeAllAnalytics')
    .addToUi();
}

function recomputeAllAnalytics() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sessions = readSessions_(ss);
  var problems = readProblems_(ss);
  var daily = readDaily_(ss);

  recomputeByOperator_(ss, sessions, problems);
  recomputeOperandBuckets_(ss, problems);
  recomputeHeatmaps_(ss, problems);
  recomputeHardestFacts_(ss, problems, 20);
  recomputePacing_(ss, problems);
  recomputeTrendStdScore_(ss, sessions);
  recomputeConsistency_(ss, problems);
  recomputeThroughput_(ss, sessions, problems);
  recomputeSessionAggregates_(ss, sessions, problems);
  recomputeByGameKey_(ss, sessions);
  recomputeWeeklyStats_(ss, daily);
}

/* Readers */
function readSessions_(ss) {
  var sh = ss.getSheetByName(SESSIONS_SHEET_NAME);
  if (!sh) return [];
  var last = sh.getLastRow(); if (last < 2) return [];
  var width = sh.getLastColumn();
  var v = sh.getRange(2,1,last-1,width).getValues();
  var a = [];
  for (var i=0;i<v.length;i++) {
    var r=v[i]; if(!r[0]) continue;
    a.push({
      timestamp:String(r[0]), localDate:String(r[1]||''), localHour:Number(r[2]||0), timeOfDay:String(r[3]||''),
      userId:String(r[4]||''), sitdownId:String(r[5]||''), attempt:Number(r[6]||0), score:Number(r[7]||0),
      pageUrl:String(r[8]||''), gameKey:String(r[9]||''), duration:Number(r[10]||0), scorePerSec:Number(r[11]||0),
      stdScore:Number(r[12]||0), problemCount:Number(r[14]||0)
    });
  }
  return a;
}
function readProblems_(ss) {
  var sh = ss.getSheetByName(PROBLEMS_SHEET_NAME);
  if (!sh) return [];
  var last = sh.getLastRow(); if (last < 2) return [];
  var width = sh.getLastColumn();
  var v = sh.getRange(2,1,last-1,width).getValues();
  var a = [];
  for (var i=0;i<v.length;i++) {
    var r=v[i]; if(!r[0]) continue;
    a.push({
      timestamp:String(r[0]), userId:String(r[1]||''), gameKey:String(r[2]||''), duration:Number(r[3]||0),
      index:Number(r[4]||0), op:String(r[5]||''), A:Number(r[6]||0), B:Number(r[7]||0), latency:Number(r[8]||0),
      cumMs:Number(r[9]||0), third:Number(r[10]||0), decile:Number(r[11]||0), correct:r[12], final:r[13],
      wrongFull:(r.length>14 && r[14]!==''? Number(r[14]) : null)
    });
  }
  return a;
}
function readDaily_(ss) {
  var sh = ss.getSheetByName(DAILYSTATS_SHEET_NAME);
  if (!sh) return [];
  var last = sh.getLastRow(); if (last < 2) return [];
  var v = sh.getRange(2,1,last-1,5).getValues();
  var a = [];
  for (var i=0;i<v.length;i++) { var r=v[i]; if(!r[0]) continue; a.push({date:String(r[0]), sessions:Number(r[1]||0), totalDur:Number(r[2]||0), stdDurSum:Number(r[3]||0), weightedAvg:Number(r[4]||0)}); }
  return a;
}

/* Writers */
function writeTable_(ss, name, headers, rows) {
  var sh = ss.getSheetByName(name); if(!sh) sh = ss.insertSheet(name);
  sh.clear();
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  if (rows && rows.length) sh.getRange(2,1,rows.length,headers.length).setValues(rows);
}

/* Stats helpers */
function avg_(arr){ if(!arr.length) return 0; var s=0; for(var i=0;i<arr.length;i++) s+=arr[i]; return s/arr.length; }
function stddev_(arr){ if(arr.length<2) return 0; var m=avg_(arr), s=0; for(var i=0;i<arr.length;i++){var d=arr[i]-m; s+=d*d;} return Math.sqrt(s/(arr.length-1)); }
function median_(arr){ return percentileInc_(arr,0.5); }
function percentileInc_(arr,p){ if(!arr.length) return 0; var a=arr.slice().sort(function(x,y){return x-y;}); var n=a.length; var r=1+(n-1)*p; if(r<=1) return a[0]; if(r>=n) return a[n-1]; var lo=Math.floor(r)-1, hi=Math.ceil(r)-1, f=r-Math.floor(r); return a[lo]+f*(a[hi]-a[lo]); }
function mad_(arr){ if(!arr.length) return 0; var m=median_(arr), d=[]; for(var i=0;i<arr.length;i++) d.push(Math.abs(arr[i]-m)); return median_(d); }

/* Builders (same as previously provided, including safe recomputeThroughput_) */
// ... For brevity, paste the previously provided recompute* functions here, including
// recomputeByOperator_, recomputeOperandBuckets_, recomputeHeatmaps_, recomputeHardestFacts_,
// recomputePacing_, recomputeTrendStdScore_, recomputeConsistency_, recomputeThroughput_,
// recomputeSessionAggregates_, recomputeByGameKey_, recomputeWeeklyStats_, toIsoWeekKey_.