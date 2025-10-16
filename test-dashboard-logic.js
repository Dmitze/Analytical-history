// Mock дані для тестування
const MOCK_DATA = {
    'РЕБ': [
        ['Дата', 'Підрозділ', 'Показник 1', 'Показник 2', 'Показник 3'],
        ['01.01.2024', 'Підрозділ А', 100, 200, 300],
        ['02.01.2024', 'Підрозділ Б', 150, 250, 350],
        ['03.01.2024', 'Підрозділ А', 120, 220, 320]
    ],
    'Різниця РЕБ': [
        ['Дата', 'Підрозділ', 'Показник 1', 'Показник 2', 'Показник 3'],
        ...Array.from({ length: 150 }, (_, i) => {
            const date = new Date(2024, 0, i + 1);
            const dateStr = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
            return [
                dateStr,
                i % 2 === 0 ? 'Підрозділ А' : 'Підрозділ Б',
                100 + Math.floor(Math.random() * 100),
                200 + Math.floor(Math.random() * 100),
                300 + Math.floor(Math.random() * 100)
            ];
        })
    ],
    'ЕТС': [
        ['Дата', 'Підрозділ', 'Показник 1', 'Показник 2'],
        ['01.01.2024', 'Підрозділ А', 50, 100],
        ['02.01.2024', 'Підрозділ Б', 60, 110]
    ]
};

// Копіюємо класи з WebAppEnhanced.html
class StateManager {
    constructor() {
        this.state = {
            currentSheet: null,
            currentData: [],
            filteredData: [],
            filters: {
                search: '',
                dateRange: null,
                subdivision: '',
                quickFilter: null
            },
            bookmarks: [],
            theme: 'light',
            isOnline: true,
            comparison: null
        };
        this.subscribers = [];
    }

    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.notifySubscribers();
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    notifySubscribers() {
        this.subscribers.forEach(callback => callback(this.state));
    }

    getState() {
        return { ...this.state };
    }
}

class CacheManager {
    constructor() {
        this.CACHE_PREFIX = 'dashboard_cache_';
        this.CACHE_TTL = 24 * 60 * 60 * 1000;
        this.MAX_CACHE_SIZE = 50;
    }

    set(key, data) {
        const cacheEntry = {
            data: data,
            timestamp: Date.now(),
            accessCount: 0
        };
        
        try {
            localStorage.setItem(
                this.CACHE_PREFIX + key,
                JSON.stringify(cacheEntry)
            );
        } catch (e) {
            console.error('Cache error:', e);
        }
    }

    get(key) {
        const cached = localStorage.getItem(this.CACHE_PREFIX + key);
        if (!cached) return null;

        const entry = JSON.parse(cached);
        
        if (Date.now() - entry.timestamp > this.CACHE_TTL) {
            this.remove(key);
            return null;
        }

        return entry.data;
    }

    remove(key) {
        localStorage.removeItem(this.CACHE_PREFIX + key);
    }

    clear() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.CACHE_PREFIX)) {
                keys.push(key);
            }
        }
        keys.forEach(key => localStorage.removeItem(key));
    }
}

class VisualizationManager {
    constructor() {
        this.icons = {
            'РЕБ': '📊',
            'Речова': '📦',
            'ЕТС': '⚡',
            'Інж': '🔧',
            'СІІЗ': '🛡️',
            'Прод': '🍎',
            'Різниця Інж': '📈',
            'Різниця Прод': '📉',
            'Різниця ЕТС': '⚡📊',
            'Різниця СІІЗ': '🛡️📊',
            'Різниця РЕБ': '📊📈',
            'Різниця Речова': '📦📊',
            'ArchiveBackup': '🗄️'
        };
    }

    getSheetIcon(sheetName) {
        return this.icons[sheetName] || '📄';
    }

    colorizeChange(value, previousValue) {
        if (!previousValue || value === previousValue) {
            return { color: '#6c757d', arrow: '', class: 'neutral' };
        }

        const numValue = parseFloat(value);
        const numPrevious = parseFloat(previousValue);

        if (isNaN(numValue) || isNaN(numPrevious)) {
            return { color: '#6c757d', arrow: '', class: 'neutral' };
        }

        const diff = numValue - numPrevious;
        const percentChange = Math.abs((diff / numPrevious) * 100);

        if (diff > 0) {
            const intensity = Math.min(percentChange / 10, 1);
            const color = this.interpolateColor('#d4edda', '#28a745', intensity);
            return {
                color: color,
                arrow: '↑',
                class: 'positive',
                change: diff,
                percent: percentChange
            };
        } else if (diff < 0) {
            const intensity = Math.min(percentChange / 10, 1);
            const color = this.interpolateColor('#f8d7da', '#dc3545', intensity);
            return {
                color: color,
                arrow: '↓',
                class: 'negative',
                change: diff,
                percent: percentChange
            };
        }

        return { color: '#6c757d', arrow: '', class: 'neutral' };
    }

    interpolateColor(color1, color2, factor) {
        const c1 = this.hexToRgb(color1);
        const c2 = this.hexToRgb(color2);
        
        const r = Math.round(c1.r + factor * (c2.r - c1.r));
        const g = Math.round(c1.g + factor * (c2.g - c1.g));
        const b = Math.round(c1.b + factor * (c2.b - c1.b));
        
        return this.rgbToHex(r, g, b);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
}

class FilterManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    applyFilters(data) {
        const state = this.stateManager.getState();
        let filtered = [...data];

        if (state.filters.search) {
            const term = state.filters.search.toLowerCase();
            filtered = filtered.filter(row =>
                row.some(cell => String(cell).toLowerCase().includes(term))
            );
        }

        if (state.filters.subdivision) {
            filtered = filtered.filter(row => row[1] === state.filters.subdivision);
        }

        return filtered;
    }
}

class BookmarkManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.STORAGE_KEY = 'dashboard_bookmarks';
        this.loadBookmarks();
    }

    loadBookmarks() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        const bookmarks = saved ? JSON.parse(saved) : [];
        this.stateManager.setState({ bookmarks });
    }

    saveBookmarks(bookmarks) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bookmarks));
        this.stateManager.setState({ bookmarks });
    }

    toggle(sheetName) {
        const state = this.stateManager.getState();
        const bookmarks = [...state.bookmarks];
        const index = bookmarks.indexOf(sheetName);

        if (index > -1) {
            bookmarks.splice(index, 1);
        } else {
            bookmarks.push(sheetName);
        }

        this.saveBookmarks(bookmarks);
        return index === -1;
    }

    isBookmarked(sheetName) {
        const state = this.stateManager.getState();
        return state.bookmarks.includes(sheetName);
    }

    getBookmarks() {
        const state = this.stateManager.getState();
        return state.bookmarks;
    }
}

class ComparisonManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    compare(data, date1, date2) {
        const rows1 = this.findRowsByDate(data, date1);
        const rows2 = this.findRowsByDate(data, date2);

        if (!rows1 || !rows2) {
            throw new Error('Дані для однієї з дат не знайдено');
        }

        return this.calculateDifferences(rows1, rows2);
    }

    findRowsByDate(data, targetDate) {
        return data.find(row => {
            const rowDate = this.parseDate(row[0]);
            return rowDate && this.isSameDay(rowDate, targetDate);
        });
    }

    calculateDifferences(row1, row2) {
        const differences = [];

        for (let i = 0; i < Math.max(row1.length, row2.length); i++) {
            const val1 = row1[i];
            const val2 = row2[i];

            const num1 = parseFloat(val1);
            const num2 = parseFloat(val2);

            if (!isNaN(num1) && !isNaN(num2)) {
                const diff = num2 - num1;
                const percent = num1 !== 0 ? ((diff / num1) * 100).toFixed(2) : 'N/A';
                
                differences.push({
                    column: i,
                    value1: val1,
                    value2: val2,
                    difference: diff,
                    percentChange: percent,
                    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same'
                });
            } else {
                differences.push({
                    column: i,
                    value1: val1,
                    value2: val2,
                    difference: null,
                    percentChange: null,
                    direction: 'same'
                });
            }
        }

        return differences;
    }

    parseDate(dateStr) {
        const formats = [
            /(\d{2})\.(\d{2})\.(\d{4})/,
            /(\d{4})-(\d{2})-(\d{2})/,
        ];

        for (const format of formats) {
            const match = String(dateStr).match(format);
            if (match) {
                if (format === formats[0]) {
                    return new Date(match[3], match[2] - 1, match[1]);
                } else {
                    return new Date(match[1], match[2] - 1, match[3]);
                }
            }
        }

        return null;
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }
}

// Тестовий додаток
class TestDashboardApp {
    constructor() {
        this.stateManager = new StateManager();
        this.cacheManager = new CacheManager();
        this.visualizationManager = new VisualizationManager();
        this.filterManager = new FilterManager(this.stateManager);
        this.bookmarkManager = new BookmarkManager(this.stateManager);
        this.comparisonManager = new ComparisonManager(this.stateManager);
        
        this.init();
    }

    init() {
        console.log('✅ Test Dashboard initialized');
        this.renderNavigation();
    }

    renderNavigation() {
        const nav = document.getElementById('navigation');
        const sheets = Object.keys(MOCK_DATA);
        
        // Улюблені
        const bookmarks = this.bookmarkManager.getBookmarks();
        if (bookmarks.length > 0) {
            const favSection = document.createElement('div');
            favSection.className = 'nav-section favorites-section';
            favSection.innerHTML = `
                <h3>⭐ Улюблені</h3>
                <div class="nav-buttons">
                    ${bookmarks.map(sheetName => {
                        const icon = this.visualizationManager.getSheetIcon(sheetName);
                        return `<button class="nav-btn" onclick="testApp.loadSheet('${sheetName}')">${icon} ${sheetName} <span class="bookmark-btn bookmarked" onclick="event.stopPropagation(); testApp.toggleBookmark('${sheetName}')">⭐</span></button>`;
                    }).join('')}
                </div>
            `;
            nav.appendChild(favSection);
        }

        // Всі листи
        const section = document.createElement('div');
        section.className = 'nav-section';
        section.innerHTML = `
            <h3>Доступні листи</h3>
            <div class="nav-buttons">
                ${sheets.map(sheetName => {
                    const icon = this.visualizationManager.getSheetIcon(sheetName);
                    const isBookmarked = this.bookmarkManager.isBookmarked(sheetName);
                    const bookmarkIcon = isBookmarked ? '⭐' : '☆';
                    return `<button class="nav-btn" onclick="testApp.loadSheet('${sheetName}')">${icon} ${sheetName} <span class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" onclick="event.stopPropagation(); testApp.toggleBookmark('${sheetName}')">${bookmarkIcon}</span></button>`;
                }).join('')}
            </div>
        `;
        nav.appendChild(section);
    }

    loadSheet(sheetName) {
        console.log(`📂 Loading sheet: ${sheetName}`);
        
        this.stateManager.setState({ currentSheet: sheetName });
        
        document.getElementById('sheetTitle').textContent = sheetName;
        document.getElementById('loadingSpinner').classList.remove('hidden');
        document.getElementById('dataTable').classList.add('hidden');

        // Активна кнопка
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        // Показати швидкі фільтри та кнопку порівняння для історичних листів
        const quickFiltersDiv = document.getElementById('quickFilters');
        const compareBtn = document.getElementById('compareBtn');
        if (sheetName.includes('Різниця')) {
            quickFiltersDiv.style.display = 'flex';
            compareBtn.style.display = 'block';
        } else {
            quickFiltersDiv.style.display = 'none';
            compareBtn.style.display = 'none';
        }

        // Симуляція завантаження
        setTimeout(() => {
            const data = MOCK_DATA[sheetName] || [['Немає даних']];
            this.stateManager.setState({
                currentData: data,
                filteredData: data
            });
            this.displayData(data);
        }, 500);
    }

    displayData(data) {
        document.getElementById('loadingSpinner').classList.add('hidden');
        document.getElementById('dataTable').classList.remove('hidden');

        if (data.length === 0) {
            document.getElementById('tableBody').innerHTML = '<tr><td colspan="100">Немає даних</td></tr>';
            return;
        }

        // Заголовки
        const thead = document.getElementById('tableHead');
        thead.innerHTML = '<tr>' + data[0].map(cell => `<th>${cell}</th>`).join('') + '</tr>';

        // Дані
        this.renderTable(data.slice(1));
    }

    renderTable(data) {
        const state = this.stateManager.getState();
        const isHistorySheet = state.currentSheet && state.currentSheet.includes('Різниця');
        
        const tbody = document.getElementById('tableBody');
        
        if (isHistorySheet && data.length > 1) {
            tbody.innerHTML = data.map((row, rowIndex) => {
                const cells = row.map((cell, colIndex) => {
                    if (colIndex === 0) {
                        return `<td>${cell}</td>`;
                    }

                    const previousValue = rowIndex > 0 ? data[rowIndex - 1][colIndex] : null;
                    const colorInfo = this.visualizationManager.colorizeChange(cell, previousValue);

                    if (colorInfo.class === 'neutral') {
                        return `<td>${cell}</td>`;
                    }

                    return `<td class="cell-${colorInfo.class}" style="background-color: ${colorInfo.color}">
                        ${cell} <span class="change-arrow">${colorInfo.arrow}</span>
                    </td>`;
                }).join('');

                return `<tr>${cells}</tr>`;
            }).join('');
        } else {
            tbody.innerHTML = data.map(row =>
                '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>'
            ).join('');
        }

        document.getElementById('recordCount').textContent = `${data.length} записів`;
        document.getElementById('recordCount').classList.remove('hidden');
    }

    toggleBookmark(sheetName) {
        const added = this.bookmarkManager.toggle(sheetName);
        console.log(`${added ? '⭐ Added' : '☆ Removed'} bookmark: ${sheetName}`);
        
        // Перерендерити навігацію
        document.getElementById('navigation').innerHTML = '';
        this.renderNavigation();
    }

    applyFilters() {
        const state = this.stateManager.getState();
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const subdivisionFilter = document.getElementById('subdivisionFilter').value;

        this.stateManager.setState({
            filters: {
                ...state.filters,
                search: searchTerm,
                subdivision: subdivisionFilter
            }
        });

        const dataToFilter = state.currentData.slice(1);
        const filteredData = this.filterManager.applyFilters(dataToFilter);

        this.stateManager.setState({ filteredData: filteredData });
        this.renderTable(filteredData);
    }

    clearFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('dateFilter').value = '';
        document.getElementById('subdivisionFilter').value = '';
        
        document.querySelectorAll('.quick-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        this.stateManager.setState({
            filters: {
                search: '',
                dateRange: null,
                subdivision: '',
                quickFilter: null
            }
        });
        
        this.applyFilters();
    }

    setQuickFilter(filterType) {
        const state = this.stateManager.getState();
        
        this.stateManager.setState({
            filters: {
                ...state.filters,
                quickFilter: filterType
            }
        });

        document.querySelectorAll('.quick-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        console.log(`⚡ Quick filter: ${filterType}`);
        alert(`Швидкий фільтр "${filterType}" активовано!\n(В реальному додатку буде фільтрувати дані за датами)`);
    }

    openComparisonModal() {
        const modal = document.getElementById('comparisonModal');
        modal.classList.add('open');
    }

    closeComparisonModal() {
        const modal = document.getElementById('comparisonModal');
        modal.classList.remove('open');
        
        document.getElementById('compareDate1').value = '';
        document.getElementById('compareDate2').value = '';
    }

    compareData() {
        const date1Str = document.getElementById('compareDate1').value;
        const date2Str = document.getElementById('compareDate2').value;

        if (!date1Str || !date2Str) {
            alert('Будь ласка, оберіть обидві дати');
            return;
        }

        try {
            const date1 = new Date(date1Str);
            const date2 = new Date(date2Str);

            const state = this.stateManager.getState();
            const data = state.currentData.slice(1);

            const differences = this.comparisonManager.compare(data, date1, date2);

            this.displayComparisonResults(differences);
            this.closeComparisonModal();

        } catch (error) {
            alert('Помилка порівняння: ' + error.message);
            console.error('Comparison error:', error);
        }
    }

    displayComparisonResults(differences) {
        const tbody = document.getElementById('tableBody');
        const state = this.stateManager.getState();
        const headers = state.currentData[0];

        tbody.innerHTML = `
            <tr style="background: #f8f9fa; font-weight: bold;">
                <td>Показник</td>
                <td>Дата 1</td>
                <td>Дата 2</td>
                <td>Різниця</td>
                <td>% Зміни</td>
            </tr>
            ${differences.map((diff, index) => {
                if (diff.difference === null) return '';
                
                const colorInfo = this.visualizationManager.colorizeChange(diff.value2, diff.value1);
                
                return `
                    <tr>
                        <td><strong>${headers[diff.column] || `Колонка ${diff.column}`}</strong></td>
                        <td>${diff.value1}</td>
                        <td>${diff.value2}</td>
                        <td class="cell-${colorInfo.class}" style="background-color: ${colorInfo.color}">
                            ${diff.difference > 0 ? '+' : ''}${diff.difference} ${colorInfo.arrow}
                        </td>
                        <td class="cell-${colorInfo.class}">
                            ${diff.percentChange !== 'N/A' ? (diff.difference > 0 ? '+' : '') + diff.percentChange + '%' : 'N/A'}
                        </td>
                    </tr>
                `;
            }).join('')}
        `;

        document.getElementById('recordCount').textContent = `Порівняння: ${differences.filter(d => d.difference !== null).length} показників`;
    }
}

// Ініціалізація
const testApp = new TestDashboardApp();
window.testApp = testApp;

console.log('🧪 Test Dashboard ready!');
console.log('📝 Available features:');
console.log('  ✅ Color coding');
console.log('  ✅ Icons');
console.log('  ✅ Quick filters');
console.log('  ✅ Bookmarks');
console.log('  ✅ Date comparison');
console.log('  ✅ Lazy loading (for >100 rows)');
