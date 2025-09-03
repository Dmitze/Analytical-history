// ===== КОНФИГУРАЦИЯ =====
const CONFIG = {
  LOG_SHEET: 'История',
  EXCLUDE_SHEETS: ['История'],
  TRACK_SHEETS: [],
  TRACK_COLUMNS: {}, // например: { 'Лист1': [1, 2], 'Лист2': ['A'] }
  TIMEZONE: 'Europe/Kyiv',
  LOG_FORMULAS: true,
  LIMIT_ROWS: 200000,
  MIRROR_SHEET: '__mirror__',
  ENABLE_RANGE_DIFF: true,
  CENTRAL_LOG_ID: 'abc123xyz...', // ⚠️ Замени на ID твоей внешней таблицы
  EXPORT_FOLDER_ID: 'folder123...' // ⚠️ Замени на ID папки в Google Drive
};

// ===== ОСНОВНОЙ ТРИГГЕР =====
function onEdit(e) {
  try {
    if (!e) return;
    const ss = SpreadsheetApp.getActive();
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();

    if (!shouldTrackSheet_(sheetName)) return;
    if (!shouldTrackColumn_(sheetName, e.range.getColumn())) return;
    if ([CONFIG.LOG_SHEET, CONFIG.MIRROR_SHEET].includes(sheetName)) return;

    const isRange = e.range.getNumRows() > 1 || e.range.getNumColumns() > 1;
    const timestamp = formatDate_(new Date());
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const a1 = e.range.getA1Notation();
    const rowStart = e.range.getRow();
    const colStart = e.range.getColumn();
    const rows = e.range.getNumRows();
    const cols = e.range.getNumColumns();

    let oldVal, newVal, newFormula = '', action, rangeSize = '', sample = '';

    if (isRange && CONFIG.ENABLE_RANGE_DIFF) {
      const mirror = ensureMirrorSheet_(ss);
      const oldValues = getMirrorValues_(mirror, sheetName, rowStart, colStart, rows, cols);
      const newValues = e.range.getValues();

      oldVal = JSON.stringify(oldValues);
      newVal = JSON.stringify(newValues);
      rangeSize = `${rows}x${cols}`;
      sample = createSample_(newValues);
      action = 'RANGE_EDIT';

      setMirrorValues_(mirror, sheetName, rowStart, colStart, newValues);
    } else {
      oldVal = typeof e.oldValue !== 'undefined' ? e.oldValue : '';
      newVal = typeof e.value !== 'undefined' ? e.value : '';
      newFormula = CONFIG.LOG_FORMULAS ? e.range.getFormula() || '' : '';
      action = detectAction_(e, false);
    }

    const logEntry = [
      timestamp,
      user,
      ss.getName(),
      sheetName,
      a1,
      rowStart,
      colStart,
      rangeSize,
      oldVal,
      newVal,
      newFormula,
      action,
      sample
    ];

    writeToCentralLog_(logEntry);

  } catch (err) {
    console.error('onEdit error:', err);
  }
}

// ===== ЗАПИСЬ В ЦЕНТРАЛЬНУЮ ТАБЛИЦУ =====
function writeToCentralLog_(row) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.CENTRAL_LOG_ID);
    let sheet = ss.getSheetByName(CONFIG.LOG_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.LOG_SHEET);
      sheet.appendRow([
        'Timestamp', 'User', 'File', 'Sheet', 'Cell', 'Row', 'Column',
        'RangeSize', 'OldValue', 'NewValue', 'NewFormula', 'Action', 'Sample'
      ]);
      sheet.setFrozenRows(1);
    }
    sheet.appendRow(row);

    const last = sheet.getLastRow();
    if (last > CONFIG.LIMIT_ROWS) {
      const toDelete = last - CONFIG.LIMIT_ROWS;
      sheet.deleteRows(2, Math.min(toDelete, last - 1));
    }
  } catch (err) {
    console.error('Не удалось записать в центральную таблицу:', err);
  }
}

// ===== ФУНКЦИИ ПОДДЕРЖКИ =====
function shouldTrackSheet_(name) {
  if (CONFIG.TRACK_SHEETS.length) return CONFIG.TRACK_SHEETS.includes(name);
  return !CONFIG.EXCLUDE_SHEETS.includes(name);
}

function shouldTrackColumn_(sheetName, colNum) {
  if (!CONFIG.TRACK_COLUMNS[sheetName]) return true;
  const tracked = CONFIG.TRACK_COLUMNS[sheetName];
  return tracked.some(col => {
    if (typeof col === 'number') return col === colNum;
    if (typeof col === 'string') return colNum === SpreadsheetApp.getActiveSheet().getRange(col + '1').getColumn();
  });
}

function detectAction_(e, isRange) {
  if (isRange) return 'RANGE_EDIT';
  const hasNew = typeof e.value !== 'undefined';
  const hasOld = typeof e.oldValue !== 'undefined';
  if (!hasNew && hasOld) return 'CLEAR';
  if (hasNew && !hasOld) return 'NEW';
  return 'EDIT';
}

function ensureMirrorSheet_(ss) {
  let sh = ss.getSheetByName(CONFIG.MIRROR_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.MIRROR_SHEET);
    sh.hideSheet();
  }
  return sh;
}

function getMirrorValues_(mirror, sheetName, r, c, h, w) {
  const data = getOrCreateMirrorData_(mirror, sheetName);
  const res = [];
  for (let i = 0; i < h; i++) {
    const row = [];
    for (let j = 0; j < w; j++) {
      row.push(data[r + i - 1]?.[c + j - 1] || '');
    }
    res.push(row);
  }
  return res;
}

function setMirrorValues_(mirror, sheetName, r, c, values) {
  let data = getOrCreateMirrorData_(mirror, sheetName);
  while (data.length < r + values.length) data.push([]);

  values.forEach((row, i) => {
    const ri = r + i - 1;
    while (data[ri].length < c + row.length) data[ri].push('');
    row.forEach((val, j) => data[ri][c + j - 1] = val);
  });

  const all = JSON.parse(mirror.getRange('A1').getValue() || '{}');
  all[sheetName] = data;
  mirror.getRange('A1').setValue(JSON.stringify(all));
}

function getOrCreateMirrorData_(mirror, sheetName) {
  const val = mirror.getRange('A1').getValue();
  const all = val ? JSON.parse(val) : {};
  return all[sheetName] || [];
}

function createSample_(values) {
  const r = Math.min(3, values.length);
  const c = Math.min(5, values[0]?.length || 0);
  return JSON.stringify(values.slice(0, r).map(row => row.slice(0, c)));
}

function formatDate_(d) {
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

// ===== ФОРМУЛЫ ПОИСКА =====

function SEARCH_LOG(query) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.LOG_SHEET);
  if (!sheet) return [['Нет листа "История"']];

  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const filtered = data.slice(1).filter(row =>
    row.some(cell => String(cell).toLowerCase().includes(query.toLowerCase()))
  );

  return filtered.length ? [header, ...filtered] : [['Ничего не найдено']];
}

function FILTER_LOG(date, action = '') {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.LOG_SHEET);
  if (!sheet) return [['Нет листа "История"']];

  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const filtered = data.slice(1).filter(row => {
    const rowDate = row[0].split(' ')[0];
    const matchesDate = rowDate === date;
    const matchesAction = !action || row[11] === action;
    return matchesDate && matchesAction;
  });

  return filtered.length ? [header, ...filtered] : [['Ничего не найдено']];
}

// ===== ЭКСПОРТ В PDF И EXCEL =====

function exportLogToPDF() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!sheet) return;

  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?';
  const exportUrl = url + 'format=pdf&gid=' + sheet.getSheetId() +
    '&size=A4&fzr=true&portrait=false&fitw=true&top_margin=0.25&bottom_margin=0.25&left_margin=0.25&right_margin=0.25';

  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(exportUrl, { headers: { Authorization: 'Bearer ' + token } });
  const blob = response.getBlob().setName(`${ss.getName()}_История_${new Date().toISOString().slice(0,10)}.pdf`);

  const folder = DriveApp.getFolderById(CONFIG.EXPORT_FOLDER_ID);
  folder.createFile(blob);

  SpreadsheetApp.getUi().alert('PDF сохранён в папку Drive.');
}

function exportLogToExcel() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!sheet) return;

  const url = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=xlsx&gid=${sheet.getSheetId()}`;
  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const blob = response.getBlob().setName(`${ss.getName()}_История_${new Date().toISOString().slice(0,10)}.xlsx`);

  const folder = DriveApp.getFolderById(CONFIG.EXPORT_FOLDER_ID);
  folder.createFile(blob);

  SpreadsheetApp.getUi().alert('Excel сохранён в папку Drive.');
}

// ===== АВТОЭКСПОРТ (запускается по таймеру) =====
function autoExportDailyPDF() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!sheet) return;

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `${ss.getName()}_История_${dateStr}.pdf`;
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf&gid=' + sheet.getSheetId() +
    '&size=A4&fitw=true&top_margin=0.25&bottom_margin=0.25&left_margin=0.25&right_margin=0.25';

  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const blob = response.getBlob().setName(fileName);

  const folder = DriveApp.getFolderById(CONFIG.EXPORT_FOLDER_ID);
  folder.createFile(blob);
}

// ===== АНАЛИТИКА И СРАВНЕНИЕ =====

function openAnalyticsPanel() {
  const html = HtmlService.createHtmlOutputFromFile('Analytics')
    .setTitle('📊 Аналитика изменений')
    .setWidth(650)
    .setHeight(800);
  SpreadsheetApp.getUi().showSidebar(html);
}

function fetchLogData_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.LOG_SHEET);
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues().slice(1);
  const total = data.length;
  const users = {}, dates = {}, actions = {};

  data.forEach(row) {
    const user = row[1] || 'unknown';
    const date = row[0].split(' ')[0];
    const action = row[11] || 'UNKNOWN';
    users[user] = (users[user] || 0) + 1;
    dates[date] = (dates[date] || 0) + 1;
    actions[action] = (actions[action] || 0) + 1;
  });

  return {
    total,
    uniqueUsers: Object.keys(users).length,
    byDate: sortObj(dates),
    byUser: sortObj(users),
    byAction: sortObj(actions)
  };
}

function sortObj(obj) {
  return Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]));
}

function showDiff(rowNumber) {
  const html = HtmlService.createHtmlOutputFromFile('DiffDialog')
    .setTitle('Сравнение изменений')
    .setWidth(600)
    .setHeight(500);
  ScriptApp.run = rowNumber;
  SpreadsheetApp.getUi().showModalDialog(html, 'Сравнение');
}

function getLogEntry_() {
  const row = ScriptApp.run;
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.LOG_SHEET);
  const data = sheet.getDataRange().getValues();
  const rowData = data[row - 1];

  return {
    timestamp: rowData[0],
    user: rowData[1],
    file: rowData[2],
    sheet: rowData[3],
    cell: rowData[4],
    oldValue: rowData[8],
    newValue: rowData[9],
    action: rowData[11],
    isRange: !!rowData[7]
  };
}

// ===== МЕНЮ =====
function onOpen() {
  SpreadsheetApp.getUi().createMenu('📒 История')
    .addItem('Настроить триггер', 'setupTrigger')
    .addItem('Аналитика', 'openAnalyticsPanel')
    .addItem('Экспорт в PDF', 'exportLogToPDF')
    .addItem('Экспорт в Excel', 'exportLogToExcel')
    .addItem('Просмотреть выделенное', 'viewSelectedLogEntry')
    .addToUi();
}

function setupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  if (!triggers.find(t => t.getHandlerFunction() === 'onEdit')) {
    ScriptApp.newTrigger('onEdit').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
    SpreadsheetApp.getUi().alert('✅ Триггер onEdit установлен.');
  }
}

function viewSelectedLogEntry() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== CONFIG.LOG_SHEET) {
    SpreadsheetApp.getUi().alert('Перейдите на лист "' + CONFIG.LOG_SHEET + '" и выделите строку.');
    return;
  }
  const row = sheet.getSelection().getActiveRange().getRow();
  if (row < 2) {
    SpreadsheetApp.getUi().alert('Выберите строку с данными.');
    return;
  }
  showDiff(row);
}
