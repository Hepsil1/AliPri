# 💾 Модель данных — СчётДетей

## Таблицы

### groups — Группы

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | Уникальный ID |
| name | TEXT NOT NULL | Название (Начинающие, Средний, Проф, Взрослые) |
| color | TEXT | Цвет для UI (#hex) |
| schedule | TEXT | Расписание (Пн/Ср/Пт 18:00) |
| max_athletes | INTEGER | Макс. кол-во спортсменов |
| created_at | DATETIME | Дата создания |

**Начальные данные:**
| ID | Название | Цвет |
|----|----------|-------|
| 1 | Начинающие | #4CAF50 (зелёный) |
| 2 | Средний | #2196F3 (синий) |
| 3 | Проф | #FF9800 (оранжевый) |
| 4 | Взрослые | #9C27B0 (фиолетовый) |

---

### athletes — Спортсмены

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | Уникальный ID |
| name | TEXT NOT NULL | ФИО |
| phone | TEXT | Телефон |
| telegram | TEXT | Telegram username (для уведомлений) |
| group_id | INTEGER FK → groups.id | Группа |
| payment_type | TEXT | `subscription` / `single` — основной тип оплаты |
| status | TEXT | `active` / `inactive` |
| notes | TEXT | Заметки тренера |
| created_at | DATETIME | Дата добавления |

---

### subscriptions — Абонементы

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | Уникальный ID |
| athlete_id | INTEGER FK → athletes.id | Спортсмен |
| total_sessions | INTEGER | Куплено занятий (обычно 8) |
| used_sessions | INTEGER DEFAULT 0 | Использовано |
| status | TEXT | `active` / `expired` / `frozen` |
| purchased_at | DATE | Дата покупки |
| frozen_at | DATE | Дата заморозки (nullable) |
| freeze_reason | TEXT | Причина заморозки |
| notes | TEXT | Комментарий |

> **Подсчёт остатка**: `remaining = total_sessions - used_sessions`

> **Правила перехода статуса:**
> - `active` → `expired` (когда `used_sessions >= total_sessions`)
> - `active` → `frozen` (ручная заморозка)
> - `frozen` → `active` (разморозка)

---

### trainings — Тренировки

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | Уникальный ID |
| group_id | INTEGER FK → groups.id | Группа |
| date | DATE NOT NULL | Дата тренировки |
| time | TEXT | Время (18:00) |
| notes | TEXT | Заметки к тренировке |

---

### attendance — Посещения

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | Уникальный ID |
| training_id | INTEGER FK → trainings.id | Тренировка |
| athlete_id | INTEGER FK → athletes.id | Спортсмен |
| subscription_id | INTEGER FK → subscriptions.id | Абонемент (nullable) |
| status | TEXT NOT NULL | Статус посещения (см. ниже) |
| amount_paid | INTEGER | Сумма для разовой оплаты |
| notes | TEXT | Комментарий |
| marked_at | DATETIME | Время отметки |

**Статусы посещения:**

| Статус | Значение | Эффект на абонемент |
|--------|----------|---------------------|
| `present` | Был на тренировке | `used_sessions += 1` |
| `absent_counted` | Не был, но списано | `used_sessions += 1` |
| `absent_frozen` | Не был, заморозка (болезнь) | Без изменений |
| `single_pay` | Разовая оплата | Не связан с абонементом |
| `absent_free` | Не был (не считается) | Без изменений |

---

### notifications_log — Лог уведомлений

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | Уникальный ID |
| athlete_id | INTEGER FK | Спортсмен |
| subscription_id | INTEGER FK | Абонемент |
| type | TEXT | Тип уведомления |
| message | TEXT | Текст сообщения |
| is_sent | BOOLEAN | Отправлено ли |
| created_at | DATETIME | Время создания |

---

## Индексы

```sql
CREATE INDEX idx_athletes_group ON athletes(group_id);
CREATE INDEX idx_attendance_training ON attendance(training_id);
CREATE INDEX idx_attendance_athlete ON attendance(athlete_id);
CREATE INDEX idx_subscriptions_athlete ON subscriptions(athlete_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_trainings_date ON trainings(date);
CREATE INDEX idx_trainings_group ON trainings(group_id);
```
