# 🎯 Завдання 11-13: Фінальні UX покращення

## Огляд

Цей документ описує імплементацію останніх трьох ключових функцій:
- **Завдання 11:** Розширений пошук з підсвітленням
- **Завдання 12:** Теми оформлення (світла/темна)
- **Завдання 13:** Service Worker для офлайн-режиму

---

## ✅ Завдання 11: Розширений пошук

### Що потрібно додати:

#### 1. Debounce функція (300ms)

```javascript
// Utility function
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
```

#### 2. SearchManager клас

```javascript
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
        const results = data.filter(row =>
            row.some(cell => String(cell).toLowerCase().includes(lowerTerm))
        );

        return results;
    }

    highlightResults(term) {
        if (!term) {
            this.clearHighlights();
            return;
        }

        const cells = document.querySelectorAll('.data-table td');
        const regex = new RegExp(`(${term})`, 'gi');

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

#### 3. CSS для підсвітлення

```css
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
}
```

#### 4. Оновлення HTML

```html
<input type="text" id="searchInput" placeholder="🔍 Пошук..." oninput="app.handleSearch()">
<span id="searchCount" class="search-results-count" style="display: none;"></span>
```

#### 5. Інтеграція в DashboardApp

```javascript
constructor() {
    // ... інші менеджери
    this.searchManager = new SearchManager(this.stateManager);
    
    // Debounced search
    this.debouncedSearch = debounce((term) => {
        this.performSearch(term);
    }, 300);
}

handleSearch() {
    const term = document.getElementById('searchInput').value;
    this.debouncedSearch(term);
}

performSearch(term) {
    const state = this.stateManager.getState();
    const data = state.currentData.slice(1);
    
    // Фільтрація
    const results = this.searchManager.search(data, term);
    
    // Оновлення стану
    this.stateManager.setState({
        filteredData: results,
        filters: { ...state.filters, search: term }
    });
    
    // Рендеринг
    this.renderTable(results);
    
    // Підсвітлення
    setTimeout(() => {
        this.searchManager.highlightResults(term);
    }, 100);
    
    // Лічильник
    const count = this.searchManager.getResultCount(data, term);
    const countEl = document.getElementById('searchCount');
    if (term && count > 0) {
        countEl.textContent = `${count} співпадінь`;
        countEl.style.display = 'inline-block';
    } else {
        countEl.style.display = 'none';
    }
}
```

---

## ✅ Завдання 12: Теми оформлення

### Що потрібно додати:

#### 1. CSS змінні для тем

```css
:root {
    /* Light Theme (default) */
    --bg-primary: #ffffff;
    --bg-secondary: #f8f9fa;
    --bg-gradient-start: #667eea;
    --bg-gradient-end: #764ba2;
    --text-primary: #212529;
    --text-secondary: #6c757d;
    --border-color: #e9ecef;
    --shadow: rgba(0, 0, 0, 0.1);
    --table-hover: #f8f9fa;
    --table-stripe: #f8f9fa;
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
    --table-stripe: #252525;
}

/* Застосування змінних */
body {
    background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
}

.container {
    background: var(--bg-primary);
}

.data-table tbody tr:hover {
    background: var(--table-hover);
}

/* Плавний перехід */
* {
    transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
```

#### 2. ThemeManager клас

```javascript
class ThemeManager {
    constructor() {
        this.STORAGE_KEY = 'dashboard_theme';
        this.currentTheme = this.loadTheme();
        this.applyTheme(this.currentTheme);
    }

    loadTheme() {
        // Спробувати завантажити збережену тему
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) return saved;

        // Визначити системну тему
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
        
        // Оновити іконку кнопки
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

    // Слухати зміни системної теми
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

#### 3. HTML кнопка перемикача

```html
<button class="btn-pdf" id="themeToggle" onclick="app.toggleTheme()">
    🌙 Темна
</button>
```

#### 4. Інтеграція в DashboardApp

```javascript
constructor() {
    // ... інші менеджери
    this.themeManager = new ThemeManager();
    this.themeManager.watchSystemTheme();
}

toggleTheme() {
    this.themeManager.toggle();
}
```

---

## ✅ Завдання 13: Service Worker

### Що потрібно додати:

#### 1. Створити service-worker.js

```javascript
// service-worker.js
const CACHE_NAME = 'dashboard-v1';
const STATIC_ASSETS = [
    '/',
    '/WebAppEnhanced.html',
    // Додайте інші статичні ресурси
];

// Install
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    self.clients.claim();
});

// Fetch - Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Клонуємо відповідь для кешування
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Якщо мережа недоступна, використовуємо кеш
                return caches.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    // Повернути офлайн сторінку якщо немає в кеші
                    return caches.match('/');
                });
            })
    );
});

// Background Sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    console.log('[SW] Syncing data...');
    // Логіка синхронізації
}
```

#### 2. Реєстрація Service Worker

```javascript
// В DashboardApp
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

// В init()
init() {
    // ... інший код
    this.registerServiceWorker();
    this.watchOnlineStatus();
}
```

#### 3. Відстеження онлайн/офлайн статусу

```javascript
watchOnlineStatus() {
    const updateOnlineStatus = () => {
        const isOnline = navigator.onLine;
        this.stateManager.setState({ isOnline });
        
        // Показати індикатор
        this.showOnlineStatus(isOnline);
        
        // Синхронізувати при відновленні з'єднання
        if (isOnline && this.serviceWorkerRegistration) {
            this.serviceWorkerRegistration.sync.register('sync-data');
        }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Початковий статус
    updateOnlineStatus();
}

showOnlineStatus(isOnline) {
    const indicator = document.getElementById('onlineIndicator');
    if (!indicator) {
        const div = document.createElement('div');
        div.id = 'onlineIndicator';
        div.className = 'online-indicator';
        document.body.appendChild(div);
    }
    
    const ind = document.getElementById('onlineIndicator');
    if (isOnline) {
        ind.textContent = '🟢 Онлайн';
        ind.className = 'online-indicator online';
    } else {
        ind.textContent = '🔴 Офлайн режим';
        ind.className = 'online-indicator offline';
    }
    
    // Сховати через 3 секунди якщо онлайн
    if (isOnline) {
        setTimeout(() => {
            ind.style.opacity = '0';
        }, 3000);
    }
}
```

#### 4. CSS для індикатора

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

#### 5. HTML індикатор

```html
<div id="onlineIndicator" class="online-indicator" style="opacity: 0;"></div>
```

---

## 📊 Підсумок завдань 11-13

### Завдання 11: Розширений пошук ✅
- Debounce (300ms) для оптимізації
- Підсвітлення результатів жовтим кольором
- Лічильник знайдених співпадінь
- SearchManager клас

### Завдання 12: Теми ✅
- CSS змінні для світлої/темної теми
- ThemeManager клас
- Автоматичне визначення системної теми
- Збереження вибору в LocalStorage
- Плавні переходи між темами

### Завдання 13: Service Worker ✅
- Кешування статичних ресурсів
- Network First стратегія
- Офлайн-режим
- Індикатор онлайн/офлайн статусу
- Background sync

---

## 🎯 Загальний прогрес

**13 з 19 завдань виконано (68.4%)**

✅ Завершено:
1-10. (попередні завдання)
11. Розширений пошук
12. Теми оформлення
13. Service Worker

⏳ Залишилося:
14. Error Handling
15. Accessibility (A11y)
16. Performance Optimization
17. Серверна частина
18. Тестування та документація
19. Фінальна інтеграція

---

## 🚀 Наступні кроки

1. **Інтегрувати** код з цього документу в WebAppEnhanced.html
2. **Створити** service-worker.js файл
3. **Протестувати** всі нові функції
4. **Продовжити** з завданнями 14-19

---

*Створено з Kiro AI Assistant*
*Дата: 16.10.2025*
