// Скрипт для копіювання даних з листа "РЕБ" в "Різниця РЕБ"

const CONFIG_REB = {
  sourceSpreadsheetId: '1Oce7opn_bktGXoKNC8Xa6DxuyDUwBWyTLPu1RIyQnWA',
  targetSpreadsheetId: '1z75tfCOSpwQ3IE5v15aYCLqR2TlnpjOpgiS5eEwAbn0',
  sourceSheetName: 'РЕБ',
  targetSheetName: 'Різниця РЕБ',
  sourceRange: 'A2:T14',
  timezone: 'Europe/Kiev',
  triggerHour: 17,
  lockTimeout: 30000,
  dateFormat: 'dd.MM.yy HH:mm'
};

function copyREBToRebHistory() {
  const lock = LockService.getScriptLock();
  
  if (!lock.tryLock(CONFIG_REB.lockTimeout)) {
    console.log('ℹ️ Пропуск: уже йде виконання.');
    return;
  }
  
  try {
    const sourceSS = SpreadsheetApp.openById(CONFIG_REB.sourceSpreadsheetId);
    const targetSS = SpreadsheetApp.openById(CONFIG_REB.targetSpreadsheetId);
    
    const sourceSheet = sourceSS.getSheetByName(CONFIG_REB.sourceSheetName);
    const targetSheet = targetSS.getSheetByName(CONFIG_REB.targetSheetName);
    
    if (!sourceSheet) throw new Error(`Лист "${CONFIG_REB.sourceSheetName}" не знайдено.`);
    if (!targetSheet) throw new Error(`Лист "${CONFIG_REB.targetSheetName}" не знайдено.`);
    
    const now = new Date();
    const dateTime = Utilities.formatDate(now, CONFIG_REB.timezone, CONFIG_REB.dateFormat);
    
    copyTableWithDiffAndMergeREB(sourceSheet, targetSheet, dateTime);
    
    console.log('✅ Копіювання завершено');
    
  } catch (e) {
    console.error('❌ Помилка:', e.message);
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function copyMergedCellsREB(sourceSheet, sourceRange, targetSheet, targetStartRow, targetStartCol) {
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

function copyTableWithDiffAndMergeREB(sourceSheet, targetSheet, dateTime) {
  if (!sourceSheet || typeof sourceSheet.getRange !== 'function') {
    throw new Error('sourceSheet не є листом.');
  }
  if (!targetSheet) throw new Error('targetSheet не знайдено.');
  
  const sourceRange = sourceSheet.getRange(CONFIG_REB.sourceRange);
  let values = sourceRange.getValues();
  
  // Видаляємо порожні рядки (де всі комірки порожні або 0)
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
  
  // Копіювання форматування
  dataRange.setFontColors(sourceRange.getFontColors());
  dataRange.setFontSizes(sourceRange.getFontSizes());
  dataRange.setFontWeights(sourceRange.getFontWeights());
  dataRange.setFontStyles(sourceRange.getFontStyles());
  dataRange.setHorizontalAlignments(sourceRange.getHorizontalAlignments());
  dataRange.setVerticalAlignments(sourceRange.getVerticalAlignments());
  dataRange.setWrapStrategies(sourceRange.getWrapStrategies());
  
  // Копіювання об'єднаних ячейок
  copyMergedCellsREB(sourceSheet, sourceRange, targetSheet, nextRow, 2);
  
  // Порівняння з попереднім блоком
  const prevTopRow = findPrevBlockTopREB(targetSheet, nextRow, numRows);
  const hasPrev = prevTopRow > 0;
  
  if (hasPrev) {
    compareAndHighlightREB(targetSheet, dataRange, prevTopRow, values, numRows, numCols);
  } else {
    formatFirstBlockREB(dataRange, values, numRows, numCols);
  }
}

function compareAndHighlightREB(targetSheet, dataRange, prevTopRow, values, numRows, numCols) {
  const prevValues = targetSheet.getRange(prevTopRow, 2, numRows, numCols).getValues();
  
  for (let i = 0; i < numRows; i++) {
    for (let j = 2; j < numCols; j++) {
      const cell = dataRange.getCell(i + 1, j + 1);
      
      // Стовпець C (індекс 0 в діапазоні) - текст, не порівнюємо
      if (j === 2) {
        cell.setValue(values[i][j]).setBackground(null);
        continue;
      }
      
      const newVal = toNumREB(values[i][j]);
      const oldVal = toNumREB(prevValues[i][j]);
      const diff = newVal - oldVal;
      
      if (diff > 0) {
        cell.setValue(formatValREB(newVal) + ' ↑ +' + formatValREB(diff))
            .setBackground('#d4edda');
      } else if (diff < 0) {
        cell.setValue(formatValREB(newVal) + ' ↓ ' + formatValREB(Math.abs(diff)))
            .setBackground('#f8d7da');
      } else {
        cell.setValue(formatValREB(newVal))
            .setBackground(null);
      }
    }
  }
}

function formatFirstBlockREB(dataRange, values, numRows, numCols) {
  for (let i = 0; i < numRows; i++) {
    for (let j = 2; j < numCols; j++) {
      // Стовпець C (індекс 0 в діапазоні) - текст, не форматуємо як число
      if (j === 2) {
        dataRange.getCell(i + 1, j + 1)
          .setValue(values[i][j])
          .setBackground(null);
      } else {
        dataRange.getCell(i + 1, j + 1)
          .setValue(formatValREB(toNumREB(values[i][j])))
          .setBackground(null);
      }
    }
  }
}

// Utility функції
function findPrevBlockTopREB(sheet, nextRow, numRows) {
  let r = nextRow - 1;
  if (r < 2) return 0;
  
  const colA = sheet.getRange(2, 1, r - 1, 1).getValues();
  
  while (r >= 2) {
    const val = colA[r - 2][0];
    if (isDateStampREB(val)) break;
    r--;
  }
  
  if (r < 2) return 0;
  
  const top = r - (numRows - 1);
  return top >= 2 ? top : 0;
}

function isDateStampREB(v) {
  return (typeof v === 'string') && /^\d{2}\.\d{2}\.\d{2} \d{2}:\d{2}$/.test(v);
}

function toNumREB(v) {
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

function formatValREB(x) {
  return String(Math.round(x));
}

// Управління тригером
function createDailyTriggerREB() {
  const triggers = ScriptApp.getProjectTriggers();
  
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'copyREBToRebHistory') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  
  ScriptApp.newTrigger('copyREBToRebHistory')
    .timeBased()
    .atHour(CONFIG_REB.triggerHour)
    .everyDays(1)
    .inTimezone(CONFIG_REB.timezone)
    .create();
  
  SpreadsheetApp.getUi().alert(
    'Тригер створено',
    `Скрипт буде запускатися щодня о ${CONFIG_REB.triggerHour}:00 за київським часом.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
