// Скрипт для копіювання даних з листа "Звіт по підрозділам" в "Різниця Ручова"

const CONFIG_PIDROZDIL = {
  sourceSpreadsheetId: '10ykx-PuUkxcye9JXqeriCJu4ieXbUn4vi4_8Py-yg80',
  targetSpreadsheetId: '1z75tfCOSpwQ3IE5v15aYCLqR2TlnpjOpgiS5eEwAbn0',
  sourceSheetName: 'Звіт по підрозділам',
  targetSheetName: 'Різниця Речова',
  sourceRange: 'A2:L55', 
  timezone: 'Europe/Kiev',
  triggerHour: 17,
  lockTimeout: 30000,
  dateFormat: 'dd.MM.yy HH:mm'
};

function copyZvitPidrozdilToRuchovaHistory() {
  const lock = LockService.getScriptLock();
  
  if (!lock.tryLock(CONFIG_PIDROZDIL.lockTimeout)) {
    console.log('ℹ️ Пропуск: уже йде виконання.');
    return;
  }
  
  try {
    const sourceSS = SpreadsheetApp.openById(CONFIG_PIDROZDIL.sourceSpreadsheetId);
    const targetSS = SpreadsheetApp.openById(CONFIG_PIDROZDIL.targetSpreadsheetId);
    
    const sourceSheet = sourceSS.getSheetByName(CONFIG_PIDROZDIL.sourceSheetName);
    const targetSheet = targetSS.getSheetByName(CONFIG_PIDROZDIL.targetSheetName);
    
    if (!sourceSheet) throw new Error(`Лист "${CONFIG_PIDROZDIL.sourceSheetName}" не знайдено.`);
    if (!targetSheet) throw new Error(`Лист "${CONFIG_PIDROZDIL.targetSheetName}" не знайдено.`);
    
    const now = new Date();
    const dateTime = Utilities.formatDate(now, CONFIG_PIDROZDIL.timezone, CONFIG_PIDROZDIL.dateFormat);
    
    copyTableWithDiffAndMergePIDROZDIL(sourceSheet, targetSheet, dateTime);
    
    console.log('✅ Копіювання завершено');
    
  } catch (e) {
    console.error('❌ Помилка:', e.message);
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function copyMergedCellsPIDROZDIL(sourceSheet, sourceRange, targetSheet, targetStartRow, targetStartCol) {
  try {
    const mergedRanges = sourceRange.getMergedRanges();
    
    if (!mergedRanges || mergedRanges.length === 0) return;
    
    const sourceStartRow = sourceRange.getRow();
    const sourceStartCol = sourceRange.getColumn();
    
    for (let i = 0; i < mergedRanges.length; i++) {
      const mergedRange = mergedRanges[i];
      
      const mergeRow = mergedRange.getRow();
      const mergeCol = mergedRange.getColumn();
      const mergeNumRows = mergedRange.getNumRows();
      const mergeNumCols = mergedRange.getNumColumns();
      
      const relativeRow = mergeRow - sourceStartRow;
      const relativeCol = mergeCol - sourceStartCol;
      
      if (relativeRow < 0 || relativeCol < 0) continue;
      
      const targetRow = targetStartRow + relativeRow;
      const targetCol = targetStartCol + relativeCol;
      
      const targetRange = targetSheet.getRange(targetRow, targetCol, mergeNumRows, mergeNumCols);
      targetRange.merge();
    }
    
  } catch (e) {
    console.warn('⚠️ Помилка копіювання об\'єднань:', e.message);
  }
}

function copyTableWithDiffAndMergePIDROZDIL(sourceSheet, targetSheet, dateTime) {
  if (!sourceSheet || typeof sourceSheet.getRange !== 'function') {
    throw new Error('sourceSheet не є листом.');
  }
  if (!targetSheet) throw new Error('targetSheet не знайдено.');
  
  const sourceRange = sourceSheet.getRange(CONFIG_PIDROZDIL.sourceRange);
  let values = sourceRange.getValues();
  
  // Видаляємо порожні рядки
  values = values.filter(row => {
    return row.some(cell => {
      if (cell === null || cell === '' || cell === undefined) return false;
      if (typeof cell === 'number' && cell === 0) return false;
      if (typeof cell === 'string' && cell.trim() === '') return false;
      return true;
    });
  });
  
  const numRows = values.length;
  const numCols = values[0] ? values[0].length : 0;
  
  if (numRows === 0) {
    console.log('⚠️ Немає даних для копіювання');
    return;
  }
  
  const lastRow = targetSheet.getLastRow();
  const nextRow = lastRow === 0 ? 4 : lastRow + 2;
  
  // Вставка часових міток
  for (let i = 0; i < numRows; i++) {
    targetSheet.getRange(nextRow + i, 1)
      .setValue(dateTime)
      .setNumberFormat('@')
      .setFontStyle('italic')
      .setFontColor('gray')
      .setHorizontalAlignment('center');
  }
  
  // Вставка даних
  const dataRange = targetSheet.getRange(nextRow, 2, numRows, numCols);
  dataRange.setValues(values);
  
  // Копіювання форматування (тільки для відфільтрованих рядків)
  // Не копіюємо форматування з sourceRange, бо розміри не співпадають після фільтрації
  
  // Порівняння з попереднім блоком
  const prevTopRow = findPrevBlockTopPIDROZDIL(targetSheet, nextRow, numRows);
  const hasPrev = prevTopRow > 0;
  
  if (hasPrev) {
    compareAndHighlightPIDROZDIL(targetSheet, dataRange, prevTopRow, values, numRows, numCols);
  } else {
    formatFirstBlockPIDROZDIL(dataRange, values, numRows, numCols);
  }
}

function compareAndHighlightPIDROZDIL(targetSheet, dataRange, prevTopRow, values, numRows, numCols) {
  const prevValues = targetSheet.getRange(prevTopRow, 2, numRows, numCols).getValues();
  
  for (let i = 0; i < numRows; i++) {
    for (let j = 2; j < numCols; j++) {
      const cell = dataRange.getCell(i + 1, j + 1);
      
      // Стовпець A (індекс 0 в діапазоні) - текст, не порівнюємо
      if (j === 2) {
        cell.setValue(values[i][j]).setBackground(null);
        continue;
      }
      
      const newVal = toNumPIDROZDIL(values[i][j]);
      const oldVal = toNumPIDROZDIL(prevValues[i][j]);
      const diff = newVal - oldVal;
      
      if (diff > 0) {
        cell.setValue(formatValPIDROZDIL(newVal) + ' ↑ +' + formatValPIDROZDIL(diff))
            .setBackground('#d4edda');
      } else if (diff < 0) {
        cell.setValue(formatValPIDROZDIL(newVal) + ' ↓ ' + formatValPIDROZDIL(Math.abs(diff)))
            .setBackground('#f8d7da');
      } else {
        cell.setValue(formatValPIDROZDIL(newVal))
            .setBackground(null);
      }
    }
  }
}

function formatFirstBlockPIDROZDIL(dataRange, values, numRows, numCols) {
  for (let i = 0; i < numRows; i++) {
    for (let j = 2; j < numCols; j++) {
      // Стовпець A (індекс 0 в діапазоні) - текст, не форматуємо як число
      if (j === 2) {
        dataRange.getCell(i + 1, j + 1)
          .setValue(values[i][j])
          .setBackground(null);
      } else {
        dataRange.getCell(i + 1, j + 1)
          .setValue(formatValPIDROZDIL(toNumPIDROZDIL(values[i][j])))
          .setBackground(null);
      }
    }
  }
}

// Utility функції
function findPrevBlockTopPIDROZDIL(sheet, nextRow, numRows) {
  let r = nextRow - 1;
  if (r < 2) return 0;
  
  const colA = sheet.getRange(2, 1, r - 1, 1).getValues();
  
  while (r >= 2) {
    const val = colA[r - 2][0];
    if (isDateStampPIDROZDIL(val)) break;
    r--;
  }
  
  if (r < 2) return 0;
  
  const top = r - (numRows - 1);
  return top >= 2 ? top : 0;
}

function isDateStampPIDROZDIL(v) {
  return (typeof v === 'string') && /^\d{2}\.\d{2}\.\d{2} \d{2}:\d{2}$/.test(v);
}

function toNumPIDROZDIL(v) {
  if (v === null || v === '' || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  
  let s = String(v)
    .replace(/↑.*$/, '')
    .replace(/↓.*$/, '')
    .replace(/%/g, '')
    .replace(/[^\d,\-\.]/g, '')
    .replace(/,/g, '.')
    .trim();
  
  let num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

function formatValPIDROZDIL(x) {
  return String(Math.round(x));
}

// Управління тригером
function createDailyTriggerPIDROZDIL() {
  const triggers = ScriptApp.getProjectTriggers();
  
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'copyZvitPidrozdilToRuchovaHistory') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  
  ScriptApp.newTrigger('copyZvitPidrozdilToRuchovaHistory')
    .timeBased()
    .atHour(CONFIG_PIDROZDIL.triggerHour)
    .everyDays(1)
    .inTimezone(CONFIG_PIDROZDIL.timezone)
    .create();
  
  SpreadsheetApp.getUi().alert(
    'Тригер створено',
    `Скрипт буде запускатися щодня о ${CONFIG_PIDROZDIL.triggerHour}:00 за київським часом.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
