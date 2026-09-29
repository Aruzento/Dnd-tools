# Dnd-tools

Локальный набор инструментов для ведения D&D-кампании. Сайт работает без веб-сервера через `file://`.

## Инструменты

- `pages/tool-1.html` — генератор лута на базе 4450 предметов.
- `pages/tool-2.html` — конвертер денег D&D ↔ Этара.
- `pages/tool-3.html` — калькулятор боя: группа, враги и вероятность исхода.
- `pages/tool-4.html` — карточки персонажей.
- `pages/tool-5.html` — магазин по категориям базы лута.

## Структура

```text
Dnd-tools/
├─ index.html
├─ Update and launch.bat
├─ README.md
├─ pages/
│  ├─ tool-1.html
│  ├─ tool-2.html
│  ├─ tool-3.html
│  ├─ tool-4.html
│  └─ tool-5.html
├─ assets/
│  ├─ css/
│  │  ├─ styles.css
│  │  └─ combat-evaluator.css
│  └─ js/
│     ├─ loot.js
│     ├─ money.js
│     ├─ players.js
│     ├─ enemies.js
│     ├─ combat-evaluator.js
│     └─ shop.js
├─ data/
│  ├─ loot.csv
│  ├─ loot-data.js
│  ├─ players.csv
│  └─ enemies.csv
├─ content/
│  ├─ characters/
│  └─ enemies/
└─ scripts/
   ├─ update_loot.py
   ├─ update_players.py
   └─ update_enemies.py

```

## Запуск

Запустите `Update and launch.bat`.

Перед открытием сайта он:

1. собирает `data/enemies.csv` и fallback в `assets/js/enemies.js` из `content/enemies/*.md`;
2. собирает `data/players.csv` и fallback в `assets/js/players.js` из `content/characters/*.md`;
3. собирает `data/loot-data.js` из `data/loot.csv`;
4. открывает `index.html`.

## База лута

Редактируемый источник: `data/loot.csv`

Формат:

```text
Предмет;Эффект;Описание;Стоимость;Редкость;Категория
```

## Враги

Исходные карточки находятся в `content/enemies/*.md`.

`data/enemies.csv` генерируется автоматически:

```text
Название;Хиты всего;Файл
```

Для `file://` Markdown-карточки также встраиваются в `assets/js/enemies.js`.

## Персонажи

Исходные карточки находятся в `content/characters/*.md`.

Из них автоматически формируется `data/players.csv`:

```text
имя;хиты;КД
```

## Калькулятор боя

Инструмент 3 использует текущие хиты игроков и врагов, КД и боевые профили. Вероятности пересчитываются локально в браузере; интернет для расчёта не нужен.
