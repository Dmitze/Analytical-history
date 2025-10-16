// Скрипт для копіювання даних з листа "Звіт" в "Різниця Речова"

const CONFIG_RECHOVA = {
  sourceSpreadsheetId: '1UvH-24B3wuBBEVRmi6Dm5Zqds1MTrRGZSyPJVRk3IMk',
  targetSpreadsheetId: '1z75tfCOSpwQ3IE5v15aYCLqR2TlnpjOpgiS5eEwAbn0',
  sourceSheetName: 'Звіт',
  targetSheetName: 'Різниця Речова',
  sourceRange: 'A4:T41',
  timezone: 'Europe/Kiev',
  triggerHour: 17,
  lockTimeout: 30000,
  dateFormat: 'dd.MM.yy HH:mm'
};

function copyZvitToRechovaHistory() {
  const lock = LockService.getScriptLock();
  
  if (!lock.tryLock(CONFIG_RECHOVA.lockTimeout)) {
    console.log('ℹ️ Пропуск: уже йде виконання.');
    return;
  }
  
  try {
    const sourceSS = SpreadsheetApp.openById(CONFIG_RECHOVA.sourceSpreadsheetId);
    const targetSS = SpreadsheetApp.openById(CONFIG_RECHOVA.targetSpreadsheetId);
    
    const sourceSheet = sourceSS.getSheetByName(CONFIG_RECHOVA.sourceSheetName);
    const targetSheet = targetSS.getSheetByName(CONFIG_RECHOVA.targetSheetName);
    
    if (!sourceSheet) throw new Error(`Лист "${CONFIG_RECHOVA.sourceSheetName}" не знайдено.`);
    if (!targetSheet) throw new Error(`Лист "${CONFIG_RECHOVA.targetSheetName}" не знайдено.`);
    
    const now = new Date();
    const dateTime = Utilities.formatDate(now, CONFIG_RECHOVA.timezone, CONFIG_RECHOVA.dateFormat);
    
    copyTableWithDiffAndMergeZvit(sourceSheet, targetSheet, dateTime);
    
    console.log('✅ Копіювання завершено');
    
  } catch (e) {
    console.error('❌ Помилка:', e.message);
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function copyMergedCellsZvit(sourceSheet, sourceRange, targetSheet, targetStartRow, targetStartCol) {
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

function copyTableWithDiffAndMergeZvit(sourceSheet, targetSheet, dateTime) {
  if (!sourceSheet || typeof sourceSheet.getRange !== 'function') {
    throw new Error('sourceSheet не є листом.');
  }
  if (!targetSheet) throw new Error('targetSheet не знайдено.');
  
  const sourceRange = sourceSheet.getRange(CONFIG_RECHOVA.sourceRange);
  const values = sourceRange.getValues();
  const numRows = values.length;
  const numCols = values[0].length;
  
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
  copyMergedCellsZvit(sourceSheet, sourceRange, targetSheet, nextRow, 2);
  
  // Порівняння з попереднім блоком
  const prevTopRow = findPrevBlockTopZvit(targetSheet, nextRow, numRows);
  const hasPrev = prevTopRow > 0;
  
  console.log(`🔍 Пошук попереднього блоку: nextRow=${nextRow}, numRows=${numRows}, prevTopRow=${prevTopRow}`);
  
  if (hasPrev) {
    console.log(`✓ Знайдено попередній блок на рядку ${prevTopRow}, виконуємо порівняння`);
    compareAndHighlightZvit(targetSheet, dataRange, prevTopRow, values, numRows, numCols);
  } else {
    console.log('ℹ️ Попередній блок не знайдено, це перший запис');
    formatFirstBlockZvit(dataRange, values, numRows, numCols);
  }
}

function compareAndHighlightZvit(targetSheet, dataRange, prevTopRow, values, numRows, numCols) {
  const prevValues = targetSheet.getRange(prevTopRow, 2, numRows, numCols).getValues();
  
  for (let i = 0; i < numRows; i++) {
    for (let j = 2; j < numCols; j++) {
      const cell = dataRange.getCell(i + 1, j + 1);
      
      // Стовпець A (індекс 0 в діапазоні) - текст, не порівнюємо
      if (j === 2) {
        cell.setValue(values[i][j]).setBackground(null);
        continue;
      }
      
      const newVal = toNumZvit(values[i][j]);
      const oldVal = toNumZvit(prevValues[i][j]);
      const diff = newVal - oldVal;
      
      if (diff > 0) {
        cell.setValue(formatValZvit(newVal) + ' ↑ +' + formatValZvit(diff))
            .setBackground('#d4edda');
      } else if (diff < 0) {
        cell.setValue(formatValZvit(newVal) + ' ↓ ' + formatValZvit(Math.abs(diff)))
            .setBackground('#f8d7da');
      } else {
        cell.setValue(formatValZvit(newVal))
            .setBackground(null);
      }
    }
  }
}

function formatFirstBlockZvit(dataRange, values, numRows, numCols) {
  for (let i = 0; i < numRows; i++) {
    for (let j = 2; j < numCols; j++) {
      // Стовпець A (індекс 0 в діапазоні) - текст, не форматуємо як число
      if (j === 2) {
        dataRange.getCell(i + 1, j + 1)
          .setValue(values[i][j])
          .setBackground(null);
      } else {
        dataRange.getCell(i + 1, j + 1)
          .setValue(formatValZvit(toNumZvit(values[i][j])))
          .setBackground(null);
      }
    }
  }
}

// Utility функції
function findPrevBlockTopZvit(sheet, nextRow, numRows) {
  let r = nextRow - 1;
  console.log(`  Пошук з рядка ${r}`);
  
  if (r < 2) {
    console.log(`  r < 2, повертаємо 0`);
    return 0;
  }
  
  const colA = sheet.getRange(2, 1, r - 1, 1).getValues();
  console.log(`  Читаємо стовпець A з рядка 2 до ${r - 1}`);
  
  while (r >= 2) {
    const val = colA[r - 2][0];
    console.log(`  Рядок ${r}: значення = "${val}", isDateStamp = ${isDateStampZvit(val)}`);
    if (isDateStampZvit(val)) break;
    r--;
  }
  
  if (r < 2) {
    console.log(`  Не знайдено часову мітку, повертаємо 0`);
    return 0;
  }
  
  const top = r - (numRows - 1);
  console.log(`  Знайдено мітку на рядку ${r}, top = ${r} - ${numRows - 1} = ${top}`);
  return top >= 2 ? top : 0;
}

function isDateStampZvit(v) {
  return (typeof v === 'string') && /^\d{2}\.\d{2}\.\d{2} \d{2}:\d{2}$/.test(v);
}

function toNumZvit(v) {
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

function formatValZvit(x) {
  return String(Math.round(x));
}

// Управління тригером
function createDailyTriggerZvit() {
  const triggers = ScriptApp.getProjectTriggers();
  
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'copyZvitToRechovaHistory') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  
  ScriptApp.newTrigger('copyZvitToRechovaHistory')
    .timeBased()
    .atHour(CONFIG_RECHOVA.triggerHour)
    .everyDays(1)
    .inTimezone(CONFIG_RECHOVA.timezone)
    .create();
  
  SpreadsheetApp.getUi().alert(
    'Тригер створено',
    `Скрипт буде запускатися щодня о ${CONFIG_RECHOVA.triggerHour}:00 за київським часом.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
