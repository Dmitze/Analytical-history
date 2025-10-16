# Design Document

## Overview

Цей документ описує технічний дизайн Google Apps Script для автоматичного копіювання даних з листа "ЕТС" в лист "Різниця РЕБ" з підтримкою об'єднаних ячейок, порівнянням значень та візуалізацією змін. Скрипт буде використовувати існуючу архітектуру та функції з поточного проекту, додаючи нову функціональність для роботи з об'єднаними ячейками.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Time-Based Trigger                        │
│              (Daily at 17:00 Kyiv Time)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  LockService Guard                           │
│           (Prevents concurrent execution)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Main Copy Function                              │
│         copyETSDataToRebHistory()                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Data Processing Pipeline                           │
│  1. Read source data + merged cells                          │
│  2. Find previous block                                      │
│  3. Compare values                                           │
│  4. Apply formatting + merge cells                           │
│  5. Write to target                                          │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction

1. **Trigger Manager** - створює та управляє щоденним тригером
2. **Lock Manager** - запобігає паралельному виконанню
3. **Data Copier** - основна логіка копіювання
4. **Merge Cell Handler** - обробка об'єднаних ячейок
5. **Value Comparator** - порівняння значень з попереднім блоком
6. **Formatter** - форматування чисел та процентів

## Components and Interfaces

### 1. Main Entry Point

```javascript
function copyETSDataToRebHistory()
```

**Responsibilities:**
- Отримання блокування через LockService
- Відкриття вихідної та цільової таблиць
- Виклик функції копіювання з порівнянням
- Обробка помилок та звільнення блокування

**Error Handling:**
- Timeout на блокування: 30 секунд
- Логування помилок у console
- Гарантоване звільнення блокування через `finally`

### 2. Trigger Management

```javascript
function createDailyTrigger()
```

**Responsibilities:**
- Видалення існуючих тригерів для функції `copyETSDataToRebHistory`
- Створення нового щоденного тригера на 17:00 за київським часом

**Implementation Details:**
- Використання `ScriptApp.newTrigger()`
- Метод `.timeBased().atHour(17).everyDays(1)`
- Часова зона: `inTimezone('Europe/Kiev')`

### 3. Data Copy with Comparison

```javascript
function copyTableWithDiffAndMerge(sourceSheet, targetSheet, sourceRangeA1, dateTime)
```

**Parameters:**
- `sourceSheet` - лист "ЕТС" з вихідної таблиці
- `targetSheet` - лист "Різниця РЕБ" з цільової таблиці
- `sourceRangeA1` - діапазон для копіювання (буде визначено динамічно)
- `dateTime` - часова мітка у форматі `dd.MM.yy HH:mm`

**Responsibilities:**
- Читання даних з вихідного діапазону
- Визначення об'єднаних ячейок
- Вставка часової мітки в стовпець A
- Копіювання даних в стовпці B і далі
- Копіювання форматування
- Створення об'єднань в цільовому діапазоні
- Порівняння з попереднім блоком
- Застосування візуальних індикаторів змін

**Flow:**
1. Отримати використаний діапазон з вихідного листа
2. Прочитати значення та форматування
3. Отримати список об'єднаних ячейок
4. Визначити позицію для вставки (lastRow + 2)
5. Вставити часові мітки в стовпець A
6. Вставити дані та форматування
7. Створити об'єднання ячейок
8. Знайти попередній блок
9. Якщо попередній блок існує - порівняти та підсвітити зміни

### 4. Merged Cells Handler

```javascript
function copyMergedCells(sourceSheet, sourceRange, targetSheet, targetStartRow, targetStartCol)
```

**Parameters:**
- `sourceSheet` - вихідний лист
- `sourceRange` - вихідний діапазон (Range object)
- `targetSheet` - цільовий лист
- `targetStartRow` - початковий рядок в цільовому листі
- `targetStartCol` - початковий стовпець в цільовому листі

**Responsibilities:**
- Отримання всіх об'єднаних ячейок у вихідному діапазоні
- Обчислення відносних позицій об'єднань
- Створення відповідних об'єднань в цільовому діапазоні

**Algorithm:**
```
1. Отримати sourceRange.getMergedRanges()
2. Для кожного об'єднання:
   a. Визначити початкову позицію відносно sourceRange
   b. Визначити розміри (numRows, numCols)
   c. Обчислити абсолютну позицію в target
   d. Викликати targetSheet.getRange().merge()
```

**Edge Cases:**
- Якщо немає об'єднаних ячейок - функція нічого не робить
- Якщо об'єднання виходить за межі діапазону - пропустити

### 5. Value Comparison Logic

**Existing Functions (reused):**
- `toNum(value, isPercent)` - конвертація значення в число
- `formatVal(number, isPercent)` - форматування числа
- `findPrevBlockTop(sheet, nextRow, numRows)` - пошук попереднього блоку
- `isDateStamp(value)` - перевірка часової мітки

**Comparison Rules:**
- Починати порівняння з індексу `j = 2` (третій стовпець даних)
- Останній стовпець вважається процентним
- Різниця > 0: зелений фон `#d4edda`, формат `[число] ↑ +[різниця]`
- Різниця < 0: червоний фон `#f8d7da`, формат `[число] ↓ [різниця]`
- Різниця = 0: без фону, тільки число

## Data Models

### Source Data Structure

```
Лист "ЕТС" (таблиця 1_qqXBn9ke1IQGtC_sA025GPOTgqs96ANJjdnhy9jSWw)
├── Використаний діапазон (визначається динамічно)
├── Об'єднані ячейки (можуть бути присутні)
└── Форматування (шрифти, кольори, вирівнювання)
```

### Target Data Structure

```
Лист "Різниця РЕБ" (таблиця 1z75tfCOSpwQ3IE5v15aYCLqR2TlnpjOpgiS5eEwAbn0)

Стовпець A: Часові мітки
│
├── [dd.MM.yy HH:mm] ← Блок N (поточний)
├── [dd.MM.yy HH:mm]
├── ...
├── [порожній рядок]
├── [dd.MM.yy HH:mm] ← Блок N-1 (попередній)
├── [dd.MM.yy HH:mm]
└── ...

Стовпці B+: Дані з порівнянням
│
├── [значення] або [значення ↑ +різниця] або [значення ↓ різниця]
└── Фон: зелений (#d4edda) / червоний (#f8d7da) / без фону
```

### Block Structure

```javascript
{
  timestamp: "15.10.25 17:00",  // Стовпець A
  numRows: N,                    // Висота блоку
  dataStartCol: 2,               // Дані починаються зі стовпця B (індекс 2)
  compareStartIndex: 2,          // Порівняння з індексу 2 в масиві
  lastColIsPercent: true         // Останній стовпець - проценти
}
```

## Error Handling

### Lock Acquisition Failure

```javascript
if (!lock.tryLock(30000)) {
  console.log('ℹ️ Пропуск: уже йде виконання.');
  return;
}
```

**Scenario:** Інший екземпляр скрипта вже виконується
**Action:** Логування та вихід без помилки

### Sheet Not Found

```javascript
if (!sourceSheet) {
  throw new Error('Лист "ЕТС" не знайдено.');
}
if (!targetSheet) {
  throw new Error('Лист "Різниця РЕБ" не знайдено.');
}
```

**Scenario:** Лист не існує в таблиці
**Action:** Викинути помилку з описовим повідомленням

### Invalid Spreadsheet ID

```javascript
try {
  const sourceSS = SpreadsheetApp.openById(sourceSpreadsheetId);
} catch (e) {
  console.error('❌ Помилка відкриття таблиці:', e.message);
  throw e;
}
```

**Scenario:** Неправильний ID таблиці або немає доступу
**Action:** Логування та повторне викидання помилки

### Merged Cells API Error

```javascript
try {
  const mergedRanges = sourceRange.getMergedRanges();
} catch (e) {
  console.warn('⚠️ Помилка отримання об\'єднаних ячейок:', e.message);
  // Продовжити без копіювання об'єднань
}
```

**Scenario:** Помилка при роботі з API об'єднаних ячейок
**Action:** Логування попередження, продовження без об'єднань

### Data Conversion Errors

```javascript
function toNum(v, isPercent) {
  // ... parsing logic ...
  let num = parseFloat(s);
  return isNaN(num) ? 0 : num;  // Повернути 0 для невалідних значень
}
```

**Scenario:** Значення не може бути конвертоване в число
**Action:** Повернути 0 як значення за замовчуванням

## Testing Strategy

### Unit Testing Approach

**Test Utilities:**
- Створити тестову таблицю з відомими даними
- Використовувати mock об'єкти для ізоляції функцій
- Перевіряти результати через assertions

**Key Test Cases:**

1. **Merged Cells Handling**
   - Тест: Копіювання простого об'єднання (2x2)
   - Тест: Копіювання складного об'єднання (різні розміри)
   - Тест: Діапазон без об'єднань
   - Тест: Об'єднання на краях діапазону

2. **Value Comparison**
   - Тест: Порівняння з зростанням (перевірити ↑ та зелений фон)
   - Тест: Порівняння зі зменшенням (перевірити ↓ та червоний фон)
   - Тест: Порівняння без змін (перевірити відсутність стрілок)
   - Тест: Перший блок (без порівняння)
   - Тест: Пропуск перших двох стовпців

3. **Number Formatting**
   - Тест: Форматування цілих чисел
   - Тест: Форматування процентів (два знаки після коми)
   - Тест: Конвертація рядків з символами
   - Тест: Обробка порожніх значень

4. **Block Detection**
   - Тест: Знаходження попереднього блоку тієї ж висоти
   - Тест: Відсутність попереднього блоку
   - Тест: Кілька блоків різної висоти

5. **Timestamp Formatting**
   - Тест: Формат `dd.MM.yy HH:mm`
   - Тест: Часова зона Kyiv
   - Тест: Розпізнавання існуючих міток

### Integration Testing

**Test Scenario 1: First Run**
- Вихідні дані: Порожній цільовий лист
- Очікуваний результат: Дані вставлені без порівняння, об'єднання скопійовані

**Test Scenario 2: Second Run with Changes**
- Вихідні дані: Один існуючий блок, нові дані з змінами
- Очікуваний результат: Новий блок з підсвітками змін

**Test Scenario 3: Concurrent Execution**
- Вихідні дані: Два одночасних запуски
- Очікуваний результат: Один виконується, другий пропускається

**Test Scenario 4: Large Dataset**
- Вихідні дані: Великий діапазон (100+ рядків)
- Очікуваний результат: Успішне копіювання без timeout

### Manual Testing Checklist

- [ ] Перевірити створення тригера через Apps Script UI
- [ ] Перевірити виконання о 17:00 за київським часом
- [ ] Візуально перевірити збереження об'єднаних ячейок
- [ ] Перевірити правильність підсвітки змін (зелений/червоний)
- [ ] Перевірити форматування процентів
- [ ] Перевірити роботу з реальними таблицями

## Implementation Notes

### Reusing Existing Code

Наступні функції будуть використані без змін з існуючого скрипта:
- `toNum(v, isPercent)`
- `formatVal(x, isPercent)`
- `findPrevBlockTop(sheet, nextRow, numRows)`
- `isDateStamp(v)`

### New Code Requirements

Потрібно створити:
- `copyETSDataToRebHistory()` - головна функція
- `createDailyTrigger()` - управління тригером
- `copyMergedCells()` - обробка об'єднаних ячейок
- Модифікована версія `copyTableWithDiff()` з підтримкою об'єднань

### Configuration

```javascript
const CONFIG = {
  sourceSpreadsheetId: '1_qqXBn9ke1IQGtC_sA025GPOTgqs96ANJjdnhy9jSWw',
  targetSpreadsheetId: '1z75tfCOSpwQ3IE5v15aYCLqR2TlnpjOpgiS5eEwAbn0',
  sourceSheetName: 'ЕТС',
  targetSheetName: 'Різниця РЕБ',
  timezone: 'Europe/Kiev',
  triggerHour: 17,
  lockTimeout: 30000,
  dateFormat: 'dd.MM.yy HH:mm'
};
```

### Performance Considerations

1. **Batch Operations:** Використовувати `setValues()` замість циклу `setValue()`
2. **Range Caching:** Читати діапазони один раз, зберігати в змінних
3. **Merged Ranges:** Отримувати список об'єднань один раз
4. **Formatting:** Копіювати форматування масивами, не поелементно

### Google Apps Script Quotas

- **Execution time:** Максимум 6 хвилин на виконання
- **Trigger quota:** 20 тригерів на скрипт
- **Spreadsheet operations:** Оптимізувати кількість викликів API

### Migration from Existing Script

Новий скрипт буде існувати паралельно з поточним:
- Поточний: `copyATDataToHistory()` - для листів "Загальна АТ"
- Новий: `copyETSDataToRebHistory()` - для листа "ЕТС"
- Обидва використовують спільні utility функції
