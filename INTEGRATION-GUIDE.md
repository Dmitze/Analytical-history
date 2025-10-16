# 🔧 Інтеграція завдань 11-13 - Покрокова інструкція

## Огляд

Цей гайд допоможе інтегрувати останні функції (Пошук, Теми, Service Worker) в WebAppEnhanced.html

---

## 📋 Чек-лист перед початком

- [ ] Зроблено backup WebAppEnhanced.html
- [ ] Прочитано FINAL-FEATURES-11-13.md
- [ ] Готовий service-worker.js файл
- [ ] Є доступ до редагування файлів

---

## Крок 1: Додати CSS для нових функцій

### 1.1 Підсвітлення пошуку

Додайте перед `/* Responsive */`:

```css
/* Search Highlighting */
.search-highlight {
    background-color: #ffeb3b;
    color: #000;
    padding: 2px 4px;
    border-radius: 3px;
    font-weight: 600;
}

.search-results-count {
    background: #28a745;
    color: white;
    padding: 5px 12px;
    border-radius: 15px;
    font-size: 12px;
    font-weight: 600;
    margin-left: 10px;
    display: inline-block;
}
```

### 1.2 CSS змінні для тем

Замініть початок CSS (після `*` селектора):

```css
:root {
    /* Light Theme */
    --bg-primary: #ffffff;
    --bg-secondary: #f8f9fa;
    --bg-gradient-start: #667eea;
    --bg-gradient-end: #764ba2;
    --text-primary: #212529;
    --text-secondary: #6c757d;
    --border-color: #e9ecef;
    --shadow: rgba(0, 0, 0, 0.1);
    --table-hover: #f8f9fa;
}

[data-theme="dark"] {
    /* Dark Theme */
    --bg-primary: #1a1a1a;
    --bg-secondary: #2d2d2d;
    --bg-gradient-start: #4a5568;
    --bg-gradient-end: #2d3748;
    --text-primary: #e9ecef;
    --text-secondary: #adb5bd;
    --border-color: #495057;
    --shadow: rgba(0, 0, 0, 0.5);
    --table-hover: #2d2d2d;
}

body {
    background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
}

.container {
    background: var(--bg-primary);
    color: var(--text-primary);
}
```

### 1.3 Індикатор онлайн/офлайн

```css
.online-indicator {
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10000;
    transition: opacity 0.3s ease;
}

.online-indicator.online {
    background: #28a745;
    color: white;
}

.online-indicator.offline {
    background: #dc3545;
    color: white;
}
```

---

## Крок 2: Оновити HTML

### 2.1 Додати кнопку теми в header

Знайдіть секцію з кнопками в header і додайте:

```html
<button class="btn-pdf" id="themeToggle" onclick="app.toggleTheme()">
    🌙 Темна
</button>
```

### 2.2 Додати лічильник пошуку

Знайдіть `<input type="text" id="searchInput"` і після нього додайте:

```html
<span id="searchCount" class="search-results-count" style="display: none;"></span>
```

### 2.3 Додати індикатор онлайн/офлайн

Після `<body>` додайте:

```html
<div id="onlineIndicator" class="online-indicator" style="opacity: 0;"></div>
```

---

## Крок 3: Додати JavaScript класи

### 3.1 Utility функції

Додайте на початку JavaScript секції:

```javascript
// ============================================
// UTILITY FUNCTIONS
// ============================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
```

### 3.2 SearchManager

Додайте перед `// APPLICATION CLASS`:

```javascript
/**
 * SearchManager - Розширений пошук з підсвітленням
 */
class SearchManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.highlightClass = 'search-highlight';
    }

    search(data, term) {
        if (!term) {
            this.clearHighlights();
            return data;
        }

        const lowerTerm = term.toLowerCase();
        return data.filter(row =>
            row.some(cell => String(cell).toLowerCase().includes(lowerTerm))
        );
    }

    highlightResults(term) {
        if (!term) {
            this.clearHighlights();
            return;
        }

        const cells = document.querySelectorAll('.data-table td');
        const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');

        cells.forEach(cell => {
            const text = cell.textContent;
            if (text.toLowerCase().includes(term.toLowerCase())) {
                cell.innerHTML = text.replace(regex, '<mark class="search-highlight">$1</mark>');
            }
        });
    }

    clearHighlights() {
        const highlights = document.querySelectorAll('.search-highlight');
        highlights.forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
        });
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getResultCount(data, term) {
        if (!term) return 0;
        
        let count = 0;
        const lowerTerm = term.toLowerCase();
        
        data.forEach(row => {
            row.forEach(cell => {
                if (String(cell).toLowerCase().includes(lowerTerm)) {
                    count++;
                }
            });
        });
        
        return count;
    }
}
```

### 3.3 ThemeManager

```javascript
/**
 * ThemeManager - Управління темами
 */
class ThemeManager {
    constructor() {
        this.STORAGE_KEY = 'dashboard_theme';
        this.currentTheme = this.loadTheme();
        this.applyTheme(this.currentTheme);
    }

    loadTheme() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) return saved;

        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }

        return 'light';
    }

    saveTheme(theme) {
        localStorage.setItem(this.STORAGE_KEY, theme);
        this.currentTheme = theme;
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.saveTheme(theme);
        this.updateThemeButton();
    }

    toggle() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }

    updateThemeButton() {
        const btn = document.getElementById('themeToggle');
        if (btn) {
            btn.textContent = this.currentTheme === 'light' ? '🌙 Темна' : '☀️ Світла';
        }
    }

    watchSystemTheme() {
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem(this.STORAGE_KEY)) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }
}
```

---

## Крок 4: Оновити DashboardApp

### 4.1 Додати в constructor

```javascript
constructor() {
    // ... існуючі менеджери
    this.searchManager = new SearchManager(this.stateManager);
    this.themeManager = new ThemeManager();
    
    // Debounced search
    this.debouncedSearch = debounce((term) => {
        this.performSearch(term);
    }, 300);
    
    this.init();
}
```

### 4.2 Додати в init()

```javascript
init() {
    // ... існуючий код
    
    // Теми
    this.themeManager.watchSystemTheme();
    
    // Service Worker
    this.registerServiceWorker();
    
    // Онлайн/офлайн статус
    this.watchOnlineStatus();
}
```

### 4.3 Додати нові методи

```javascript
// Пошук
handleSearch() {
    const term = document.getElementById('searchInput').value;
    this.debouncedSearch(term);
}

performSearch(term) {
    const state = this.stateManager.getState();
    const data = state.currentData.slice(1);
    
    const results = this.searchManager.search(data, term);
    
    this.stateManager.setState({
        filteredData: results,
        filters: { ...state.filters, search: term }
    });
    
    this.renderTable(results);
    
    setTimeout(() => {
        this.searchManager.highlightResults(term);
    }, 100);
    
    const count = this.searchManager.getResultCount(data, term);
    const countEl = document.getElementById('searchCount');
    if (term && count > 0) {
        countEl.textContent = `${count} співпадінь`;
        countEl.style.display = 'inline-block';
    } else {
        countEl.style.display = 'none';
    }
}

// Теми
toggleTheme() {
    this.themeManager.toggle();
}

// Service Worker
registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('✅ Service Worker registered:', registration);
                this.serviceWorkerRegistration = registration;
            })
            .catch((error) => {
                console.error('❌ Service Worker registration failed:', error);
            });
    }
}

// Онлайн/офлайн
watchOnlineStatus() {
    const updateOnlineStatus = () => {
        const isOnline = navigator.onLine;
        this.stateManager.setState({ isOnline });
        this.showOnlineStatus(isOnline);
        
        if (isOnline && this.serviceWorkerRegistration) {
            this.serviceWorkerRegistration.sync.register('sync-data');
        }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    updateOnlineStatus();
}

showOnlineStatus(isOnline) {
    let indicator = document.getElementById('onlineIndicator');
    
    if (isOnline) {
        indicator.textContent = '🟢 Онлайн';
        indicator.className = 'online-indicator online';
        indicator.style.opacity = '1';
        
        setTimeout(() => {
            indicator.style.opacity = '0';
        }, 3000);
    } else {
        indicator.textContent = '🔴 Офлайн режим';
        indicator.className = 'online-indicator offline';
        indicator.style.opacity = '1';
    }
}
```

---

## Крок 5: Оновити HTML input для пошуку

Замініть:
```html
<input type="text" id="searchInput" placeholder="🔍 Пошук..." oninput="app.applyFilters()">
```

На:
```html
<input type="text" id="searchInput" placeholder="🔍 Пошук..." oninput="app.handleSearch()">
```

---

## Крок 6: Додати service-worker.js

1. Скопіюйте файл `service-worker.js` в корінь проекту
2. Переконайтеся що шляхи в `STATIC_ASSETS` правильні
3. Для Google Apps Script - завантажте на окремий хостинг

---

## Крок 7: Тестування

### 7.1 Пошук
```
1. Введіть текст в поле пошуку
2. Почекайте 300ms (debounce)
3. Перевірте підсвітлення жовтим
4. Перевірте лічильник співпадінь
```

### 7.2 Теми
```
1. Клікніть кнопку "🌙 Темна"
2. Перевірте зміну кольорів
3. Перезавантажте сторінку
4. Перевірте що тема збереглася
```

### 7.3 Service Worker
```
1. Відкрийте DevTools → Application → Service Workers
2. Перевірте що SW зареєстрований
3. Відключіть інтернет
4. Перезавантажте сторінку
5. Перевірте що додаток працює офлайн
```

---

## 🐛 Troubleshooting

### Пошук не працює
- Перевірте що `handleSearch()` викликається
- Перевірте консоль на помилки
- Перевірте що `SearchManager` створений

### Теми не перемикаються
- Перевірте CSS змінні в `:root` та `[data-theme="dark"]`
- Перевірте що `data-theme` атрибут додається до `<html>`
- Очистіть LocalStorage і спробуйте знову

### Service Worker не реєструється
- Перевірте що файл доступний за `/service-worker.js`
- Перевірте консоль на помилки
- Для локального тестування потрібен HTTPS або localhost

---

## ✅ Чек-лист після інтеграції

- [ ] Пошук працює з debounce
- [ ] Підсвітлення результатів працює
- [ ] Лічильник співпадінь відображається
- [ ] Теми перемикаються
- [ ] Тема зберігається в LocalStorage
- [ ] Service Worker зареєстрований
- [ ] Офлайн-режим працює
- [ ] Індикатор онлайн/офлайн з'являється

---

## 🎉 Готово!

Після виконання всіх кроків у вас буде повністю функціональний додаток з:
- ✅ Розширеним пошуком
- ✅ Темами оформлення
- ✅ Service Worker
- ✅ Офлайн-режимом

**Наступний крок:** Протестуйте всі функції згідно TESTING-GUIDE.md

---

*Створено з Kiro AI Assistant*
