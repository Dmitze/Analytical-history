// Серверний код для веб-додатку

// ID вашої таблиці
const SPREADSHEET_ID = '1z75tfCOSpwQ3IE5v15aYCLqR2TlnpjOpgiS5eEwAbn0';

/**
 * Відкриває веб-додаток
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('WebApp')
    .setTitle('Аналітична Панель')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Отримує дані з листа
 * @param {string} sheetName - Назва листа
 * @returns {Array} - Масив даних
 */
function getSheetData(sheetName) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Лист "${sheetName}" не знайдено`);
    }
    
    // Визначаємо діапазон в залежності від листа
    let range;
    
    switch(sheetName) {
      case 'РЕБ':
        range = 'A1:T16';
        break;
      case 'Речова':
        range = 'A1:T9';
        break;
      case 'ЕТС':
        range = 'A1:L32';
        break;
      case 'Інж':
        range = 'A1:V19';
        break;
      case 'СІІЗ':
        range = 'A1:T24';
        break;
      case 'Прод':
        range = 'A1:T55';
        break;
      case 'Різниця Інж':
        range = 'A1:V978';
        break;
      case 'Різниця Прод':
        range = 'A1:T1000';
        break;
      case 'Різниця ЕТС':
        range = 'A1:L10968';
        break;
      case 'Різниця СІІЗ':
        range = 'A3:T' + sheet.getLastRow();
        break;
      case 'Різниця РЕБ':
        range = 'A1:T10888';
        break;
      case 'Різниця Речова':
        range = 'A1:T3099';
        break;
      case 'ArchiveBackup':
        range = 'A1:Z1000';
        break;
      default:
        // Якщо діапазон не визначений, беремо весь використаний діапазон
        range = sheet.getDataRange().getA1Notation();
    }
    
    const data = sheet.getRange(range).getValues();
    
    // Фільтруємо порожні рядки
    const filteredData = data.filter(row => 
      row.some(cell => cell !== null && cell !== '' && cell !== undefined)
    );
    
    return filteredData;
    
  } catch (error) {
    Logger.log('Помилка в getSheetData: ' + error.message);
    throw error;
  }
}

/**
 * Отримує список всіх листів
 * @returns {Array} - Масив назв листів
 */
function getAllSheets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = ss.getSheets();
    return sheets.map(sheet => sheet.getName());
  } catch (error) {
    Logger.log('Помилка в getAllSheets: ' + error.message);
    throw error;
  }
}

/**
 * Експорт листа в PDF (з підтримкою мобільних пристроїв)
 * @param {string} sheetName - Назва листа
 * @returns {string} - URL для завантаження PDF
 */
function exportSheetToPDF(sheetName) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Лист "${sheetName}" не знайдено`);
    }
    
    const sheetId = sheet.getSheetId();
    
    // Параметри для PDF експорту (оптимізовано для мобільних)
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
    Logger.log('Помилка в exportSheetToPDF: ' + error.message);
    throw error;
  }
}
