# 🏗️ Архитектура — СчётДетей

## Обзор стека

```
┌─────────────────────────────────────────┐
│           🖥️  БРАУЗЕР (SPA)             │
│  HTML + Vanilla JS + CSS                │
│  Адаптивный дизайн (mobile-first)       │
└───────────────┬─────────────────────────┘
                │ HTTP/REST API
┌───────────────▼─────────────────────────┐
│           ⚙️  NODE.JS SERVER             │
│  Express.js                             │
│  Порт: 3000                             │
│  Middleware: CORS, JSON, Static         │
└───────────────┬─────────────────────────┘
                │ SQL
┌───────────────▼─────────────────────────┐
│           💾  SQLite                     │
│  Файл: data/club.db                     │
│  Библиотека: better-sqlite3             │
└─────────────────────────────────────────┘
```

## Структура проекта

```
shetdetey/
├── server.js              # Точка входа, Express сервер
├── database.js            # Инициализация БД, миграции
├── package.json           # NPM конфигурация
│
├── routes/                # API маршруты
│   ├── groups.js          # /api/groups
│   ├── athletes.js        # /api/athletes
│   ├── trainings.js       # /api/trainings
│   ├── attendance.js      # /api/attendance
│   └── subscriptions.js   # /api/subscriptions
│
├── public/                # Статические файлы (Frontend)
│   ├── index.html         # Единственная HTML-страница (SPA)
│   ├── css/
│   │   └── styles.css     # Полная дизайн-система
│   ├── js/
│   │   ├── app.js         # Роутер, состояние, API-клиент
│   │   └── pages/         # Модули страниц
│   │       ├── dashboard.js
│   │       ├── groups.js
│   │       ├── athletes.js
│   │       ├── attendance.js
│   │       └── subscriptions.js
│   └── assets/            # Иконки, шрифты
│
├── data/                  # Данные (gitignore)
│   └── club.db            # SQLite база данных
│
└── docs/                  # Документация
    ├── PROJECT_VISION.md
    ├── ARCHITECTURE.md
    ├── DATA_MODEL.md
    ├── API_REFERENCE.md
    ├── BUSINESS_LOGIC.md
    └── CHANGELOG.md
```

## API Endpoints

### Группы
| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/groups` | Все группы с количеством спортсменов |
| POST | `/api/groups` | Создать группу |
| PUT | `/api/groups/:id` | Обновить группу |
| DELETE | `/api/groups/:id` | Удалить группу |

### Спортсмены
| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/athletes` | Все спортсмены (фильтр по группе) |
| GET | `/api/athletes/:id` | Карточка спортсмена + абонемент + история |
| POST | `/api/athletes` | Добавить спортсмена |
| PUT | `/api/athletes/:id` | Обновить данные |
| DELETE | `/api/athletes/:id` | Удалить спортсмена |

### Тренировки
| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/trainings` | Список тренировок (фильтр по группе/дате) |
| POST | `/api/trainings` | Создать тренировку |
| DELETE | `/api/trainings/:id` | Удалить тренировку |

### Посещения
| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/attendance/:training_id` | Журнал тренировки |
| POST | `/api/attendance` | Отметить посещение |
| PUT | `/api/attendance/:id` | Изменить статус |

### Абонементы
| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/subscriptions/:athlete_id` | Абонементы спортсмена |
| POST | `/api/subscriptions` | Создать абонемент |
| PUT | `/api/subscriptions/:id/freeze` | Заморозить |
| PUT | `/api/subscriptions/:id/unfreeze` | Разморозить |

---

## Принципы разработки

1. **Простота** — минимум зависимостей, максимум надёжности
2. **Один файл БД** — бэкап = копирование одного файла
3. **Без авторизации** — только один пользователь, локальный доступ
4. **Graceful degradation** — если JS сломался, данные в БД в безопасности
