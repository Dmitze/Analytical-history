// Enhanced Server Code для веб-додатку
// Version 2.0 - з оптимізаціями та новими функціями

const SPREADSHEET_ID = '1z75tfCOSpwQ3IE5v15aYCLqR2TlnpjOpgiS5eEwAbn0';
const CACHE_TTL = 300; // 5 хвилин

/**
 * Відкриває веб-додаток
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('WebAppEnhanced')
    .setTitle('Аналітична Панель')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Отримує дані з листа з кешуванням
 */
function getSheetData(sheetName) {
  try {
    // Спробувати отримати з кешу
    const cached = getFromCache(sheetName);
    if (cached) {
      Logger.log('Serving from cache: ' + sheetName);
      return cached;
    }
    
    // Завантажити дані
    const data = loadSheetData(sheetName);
    
    // Зберегти в кеш
    saveToCache(sheetName, data);
    
    return data;
    
  } catch (error) {
    Logger.log('Error in getSheetData: ' + error.message);
    throw error;
  }
}

/**
 * Завантажує дані з листа
 */
function loadSheetData(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Лист "${sheetName}" не знайдено`);
  }
  
  const range = getSheetRange(sheetName, sheet);
  const data = sheet.getRange(range).getValues();
  
  // Фільтрувати порожні рядки
  const filteredData = data.filter(row => 
    row.some(cell => cell !== null && cell !== '' && cell !== undefined)
  );
  
  return filteredData;
}

/**
 * Визначає діапазон для листа
 */
function getSheetRange(sheetName, sheet) {
  const ranges = {
    'РЕБ': 'A1:T16',
    'Речова': 'A1:T9',
    'ЕТС': 'A1:L32',
    'Інж': 'A1:V19',
    'СІІЗ': 'A1:T24',
    'Прод': 'A1:T55',
    'Різниця Інж': 'A1:V978',
    'Різниця Прод': 'A1:T1000',
    'Різниця ЕТС': 'A1:L10968',
    'Різниця СІІЗ': 'A3:T' + sheet.getLastRow(),
    'Різниця РЕБ': 'A1:T10888',
    'Різниця Речова': 'A1:T3099',
    'ArchiveBackup': 'A1:Z1000'
  };
  
  return ranges[sheetName] || sheet.getDataRange().getA1Notation();
}

/**
 * Отримує дані з кольоровим форматуванням (з кешуванням)
 */
function getSheetDataWithColors(sheetName) {
  try {
    // Спробувати отримати з кешу
    const cacheKey = `colors_${sheetName}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      Logger.log('Serving colors from cache: ' + sheetName);
      return cached;
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Лист "${sheetName}" не знайдено`);
    }
    
    const range = getSheetRange(sheetName, sheet);
    const rangeObj = sheet.getRange(range);
    
    const values = rangeObj.getValues();
    const backgrounds = rangeObj.getBackgrounds();
    const fontColors = rangeObj.getFontColors();
    const fontWeights = rangeObj.getFontWeights();
    
    // Об'єднати дані з форматуванням (оптимізовано)
    const dataWithFormat = {
      values: values,
      backgrounds: backgrounds,
      fontColors: fontColors,
      fontWeights: fontWeights,
      lastUpdated: new Date().toISOString(),
      rowCount: values.length,
      colCount: values[0] ? values[0].length : 0
    };
    
    // Зберегти в кеш
    saveToCache(cacheKey, dataWithFormat);
    
    return dataWithFormat;
    
  } catch (error) {
    Logger.log('Error in getSheetDataWithColors: ' + error.message);
    throw error;
  }
}

/**
 * Batch processing для великих датасетів
 */
function getSheetDataBatch(sheetName, startRow, batchSize) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Лист "${sheetName}" не знайдено`);
    }
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    const endRow = Math.min(startRow + batchSize - 1, lastRow);
    const range = sheet.getRange(startRow, 1, endRow - startRow + 1, lastCol);
    
    return {
      data: range.getValues(),
      hasMore: endRow < lastRow,
      nextStart: endRow + 1,
      total: lastRow,
      current: endRow
    };
    
  } catch (error) {
    Logger.log('Error in getSheetDataBatch: ' + error.message);
    throw error;
  }
}

/**
 * Кешування на серверній стороні
 */
function getFromCache(key) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(key);
  
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      Logger.log('Cache parse error: ' + e.message);
      return null;
    }
  }
  
  return null;
}

function saveToCache(key, data) {
  const cache = CacheService.getScriptCache();
  
  try {
    cache.put(key, JSON.stringify(data), CACHE_TTL);
    Logger.log('Cached: ' + key);
  } catch (e) {
    Logger.log('Cache save error: ' + e.message);
  }
}

function clearCache() {
  const cache = CacheService.getScriptCache();
  cache.removeAll(cache.getKeys());
  Logger.log('Cache cleared');
}

/**
 * Отримує список всіх листів
 */
function getAllSheets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = ss.getSheets();
    return sheets.map(sheet => ({
      name: sheet.getName(),
      rowCount: sheet.getLastRow(),
      colCount: sheet.getLastColumn()
    }));
  } catch (error) {
    Logger.log('Error in getAllSheets: ' + error.message);
    throw error;
  }
}

/**
 * Експорт листа в PDF
 */
function exportSheetToPDF(sheetName) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Лист "${sheetName}" не знайдено`);
    }
    
    const sheetId = sheet.getSheetId();
    
    const params = [
      'format=pdf',
      `gid=${sheetId}`,
      'portrait=false',
      'fitw=true',
      'size=A4',
      'gridlines=false',
      'printtitle=false',
      'sheetnames=false',
      'pagenum=UNDEFINED',
      'attachment=true',
      'top_margin=0.5',
      'bottom_margin=0.5',
      'left_margin=0.5',
      'right_margin=0.5'
    ].join('&');
    
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?${params}`;
    
    return url;
    
  } catch (error) {
    Logger.log('Error in exportSheetToPDF: ' + error.message);
    throw error;
  }
}

/**
 * Логування помилок з клієнта
 */
function logClientError(errorData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let errorSheet = ss.getSheetByName('ErrorLog');
    
    // Створити лист якщо не існує
    if (!errorSheet) {
      errorSheet = ss.insertSheet('ErrorLog');
      errorSheet.appendRow(['Timestamp', 'Message', 'Type', 'User Agent', 'URL', 'Details']);
    }
    
    // Додати помилку
    errorSheet.appendRow([
      new Date(),
      errorData.message,
      errorData.type,
      errorData.userAgent,
      errorData.url,
      JSON.stringify(errorData.details)
    ]);
    
    Logger.log('Error logged: ' + errorData.message);
    
  } catch (error) {
    Logger.log('Error in logClientError: ' + error.message);
  }
}

/**
 * Отримати статистику використання
 */
function getUsageStats() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = ss.getSheets();
    
    return {
      totalSheets: sheets.length,
      sheetNames: sheets.map(s => s.getName()),
      totalRows: sheets.reduce((sum, s) => sum + s.getLastRow(), 0),
      lastModified: ss.getLastUpdated(),
      cacheSize: CacheService.getScriptCache().getKeys().length
    };
    
  } catch (error) {
    Logger.log('Error in getUsageStats: ' + error.message);
    throw error;
  }
}

/**
 * Стиснення даних перед відправкою (Base64)
 */
function compressData(data) {
  try {
    const jsonString = JSON.stringify(data);
    const blob = Utilities.newBlob(jsonString, 'text/plain', 'data.json');
    const compressed = Utilities.gzip(blob);
    const base64 = Utilities.base64Encode(compressed.getBytes());
    
    Logger.log(`Compression: ${jsonString.length} -> ${base64.length} bytes`);
    
    return {
      compressed: base64,
      originalSize: jsonString.length,
      compressedSize: base64.length,
      ratio: (base64.length / jsonString.length * 100).toFixed(2) + '%'
    };
    
  } catch (error) {
    Logger.log('Compression error: ' + error.message);
    // Повернути оригінальні дані якщо стиснення не вдалося
    return {
      compressed: null,
      data: data,
      error: error.message
    };
  }
}

/**
 * Розпакування даних
 */
function decompressData(compressedBase64) {
  try {
    const bytes = Utilities.base64Decode(compressedBase64);
    const blob = Utilities.newBlob(bytes, 'application/x-gzip');
    const decompressed = Utilities.ungzip(blob);
    const jsonString = decompressed.getDataAsString();
    
    return JSON.parse(jsonString);
    
  } catch (error) {
    Logger.log('Decompression error: ' + error.message);
    throw error;
  }
}

/**
 * Отримати дані з автоматичним стисненням для великих датасетів
 */
function getSheetDataCompressed(sheetName) {
  try {
    const data = getSheetData(sheetName);
    const dataSize = JSON.stringify(data).length;
    
    // Стискати тільки якщо дані більше 50KB
    if (dataSize > 50000) {
      Logger.log(`Large dataset detected (${dataSize} bytes), compressing...`);
      return compressData(data);
    }
    
    return {
      compressed: null,
      data: data,
      originalSize: dataSize
    };
    
  } catch (error) {
    Logger.log('Error in getSheetDataCompressed: ' + error.message);
    throw error;
  }
}

/**
 * Batch операції - обробка декількох запитів одночасно
 */
function processBatchRequests(requests) {
  const results = [];
  
  try {
    for (const request of requests) {
      try {
        let result;
        
        switch (request.type) {
          case 'GET_SHEET':
            result = getSheetData(request.sheetName);
            break;
            
          case 'GET_SHEET_COLORS':
            result = getSheetDataWithColors(request.sheetName);
            break;
            
          case 'GET_SHEET_BATCH':
            result = getSheetDataBatch(request.sheetName, request.startRow, request.batchSize);
            break;
            
          case 'GET_ALL_SHEETS':
            result = getAllSheets();
            break;
            
          case 'CLEAR_CACHE':
            clearCache();
            result = { success: true };
            break;
            
          default:
            throw new Error('Unknown request type: ' + request.type);
        }
        
        results.push({
          id: request.id,
          success: true,
          data: result
        });
        
      } catch (error) {
        results.push({
          id: request.id,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
    
  } catch (error) {
    Logger.log('Error in processBatchRequests: ' + error.message);
    throw error;
  }
}

/**
 * Оптимізована пагінація з метаданими
 */
function getSheetDataPaginated(sheetName, page = 1, pageSize = 100) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Лист "${sheetName}" не знайдено`);
    }
    
    const totalRows = sheet.getLastRow();
    const totalCols = sheet.getLastColumn();
    const totalPages = Math.ceil(totalRows / pageSize);
    
    const startRow = (page - 1) * pageSize + 1;
    const endRow = Math.min(startRow + pageSize - 1, totalRows);
    
    if (startRow > totalRows) {
      return {
        data: [],
        page: page,
        pageSize: pageSize,
        totalRows: totalRows,
        totalPages: totalPages,
        hasNext: false,
        hasPrev: false
      };
    }
    
    const range = sheet.getRange(startRow, 1, endRow - startRow + 1, totalCols);
    const data = range.getValues();
    
    return {
      data: data,
      page: page,
      pageSize: pageSize,
      totalRows: totalRows,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      startRow: startRow,
      endRow: endRow
    };
    
  } catch (error) {
    Logger.log('Error in getSheetDataPaginated: ' + error.message);
    throw error;
  }
}
