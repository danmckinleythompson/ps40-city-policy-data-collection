/*
 * PS40 city-policy data collection backend.
 *
 * Paste this into the Apps Script editor (Extensions > Apps Script) of the
 * Google Sheet that holds cities_seed.csv, then Deploy > New deployment >
 * Web app (Execute as: me, Access: Anyone). Copy the resulting URL into
 * webapp/app.js.
 *
 * Sheet assumptions:
 *   - Tab named "Sheet1" (first tab is used regardless of name).
 *   - Row 1 is the header, matching cities_seed.csv exactly.
 *   - Columns: fips, city, state, dvs_2024, mrp_bodycam_support,
 *              assigned_at, submitted_at,
 *              bodycam_answer, bodycam_notes,
 *              nondisc_answer, nondisc_notes,
 *              zeroemiss_answer, zeroemiss_notes,
 *              student_name, student_id
 */

function doGet(e) {
  const rows = readAll_();
  return jsonOut_({ok: true, rows: rows});
}

function doPost(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;
    if (action === 'claim') {
      return jsonOut_(claim_());
    } else if (action === 'submit') {
      return jsonOut_(submit_(params));
    } else {
      return jsonOut_({ok: false, error: 'unknown action: ' + action});
    }
  } catch (err) {
    return jsonOut_({ok: false, error: String(err)});
  }
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function readAll_() {
  const sh = sheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const header = values[0];
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[i][j];
    }
    out.push(row);
  }
  return out;
}

function headerIndex_(sh) {
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = {};
  header.forEach((h, i) => { idx[h] = i + 1; });  // 1-indexed for setValue
  return idx;
}

function claim_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10 * 1000);
  try {
    const sh = sheet_();
    const idx = headerIndex_(sh);
    const last = sh.getLastRow();
    if (last < 2) return {ok: false, error: 'sheet is empty'};

    const assignedColVals = sh.getRange(2, idx['assigned_at'], last - 1, 1).getValues();
    const unassignedRows = [];
    for (let i = 0; i < assignedColVals.length; i++) {
      if (!assignedColVals[i][0]) unassignedRows.push(i + 2);  // sheet row number
    }
    if (unassignedRows.length === 0) {
      return {ok: false, error: 'all cities have been assigned'};
    }
    const pick = unassignedRows[Math.floor(Math.random() * unassignedRows.length)];
    const now = new Date().toISOString();
    sh.getRange(pick, idx['assigned_at']).setValue(now);

    // Return the full row as an object.
    const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const rowVals = sh.getRange(pick, 1, 1, sh.getLastColumn()).getValues()[0];
    const row = {};
    for (let j = 0; j < header.length; j++) row[header[j]] = rowVals[j];
    return {ok: true, row: row};
  } finally {
    lock.releaseLock();
  }
}

function submit_(p) {
  const required = [
    'fips', 'bodycam_answer', 'nondisc_answer', 'zeroemiss_answer',
    'student_name', 'student_id'
  ];
  for (const k of required) {
    if (!p[k]) return {ok: false, error: 'missing field: ' + k};
  }
  const allowedAnswers = {yes: 1, no: 1, unsure: 1};
  for (const k of ['bodycam_answer', 'nondisc_answer', 'zeroemiss_answer']) {
    if (!allowedAnswers[p[k]]) return {ok: false, error: 'invalid ' + k + ': ' + p[k]};
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10 * 1000);
  try {
    const sh = sheet_();
    const idx = headerIndex_(sh);
    const last = sh.getLastRow();
    const fipsCol = sh.getRange(2, idx['fips'], last - 1, 1).getValues();
    let rowNum = -1;
    for (let i = 0; i < fipsCol.length; i++) {
      if (String(fipsCol[i][0]) === String(p.fips)) { rowNum = i + 2; break; }
    }
    if (rowNum < 0) return {ok: false, error: 'unknown fips: ' + p.fips};

    const existingSubmit = sh.getRange(rowNum, idx['submitted_at']).getValue();
    if (existingSubmit) return {ok: false, error: 'city already submitted'};

    const now = new Date().toISOString();
    const writes = [
      ['bodycam_answer',   p.bodycam_answer],
      ['bodycam_notes',    p.bodycam_notes || ''],
      ['nondisc_answer',   p.nondisc_answer],
      ['nondisc_notes',    p.nondisc_notes || ''],
      ['zeroemiss_answer', p.zeroemiss_answer],
      ['zeroemiss_notes',  p.zeroemiss_notes || ''],
      ['student_name',     p.student_name],
      ['student_id',       p.student_id],
      ['submitted_at',     now],
    ];
    for (const [col, val] of writes) {
      sh.getRange(rowNum, idx[col]).setValue(val);
    }
    return {ok: true};
  } finally {
    lock.releaseLock();
  }
}
