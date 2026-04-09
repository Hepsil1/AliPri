# 📖 API Reference — СчётДетей

Базовый URL: `http://localhost:3000/api`

Все ответы в формате JSON.

---

## 🏷️ Группы `/api/groups`

### GET `/api/groups`
Получить все группы.

**Ответ:**
```json
[
  {
    "id": 1,
    "name": "Начинающие",
    "color": "#4CAF50",
    "schedule": "Пн/Ср/Пт 17:00",
    "athlete_count": 14,
    "created_at": "2026-04-09T20:00:00"
  }
]
```

### POST `/api/groups`
Создать группу.

**Тело запроса:**
```json
{
  "name": "Начинающие",
  "color": "#4CAF50",
  "schedule": "Пн/Ср/Пт 17:00"
}
```

### PUT `/api/groups/:id`
Обновить группу.

### DELETE `/api/groups/:id`
Удалить группу. **Ошибка 400** если в группе есть спортсмены.

---

## 👤 Спортсмены `/api/athletes`

### GET `/api/athletes?group_id=1`
Получить спортсменов. Опциональный фильтр по группе.

**Ответ:**
```json
[
  {
    "id": 1,
    "name": "Иванов Иван",
    "phone": "+7 900 123 4567",
    "telegram": "@ivanov",
    "group_id": 1,
    "group_name": "Начинающие",
    "payment_type": "subscription",
    "status": "active",
    "subscription": {
      "id": 5,
      "total_sessions": 8,
      "used_sessions": 3,
      "remaining": 5,
      "status": "active"
    }
  }
]
```

### GET `/api/athletes/:id`
Полная карточка спортсмена с историей посещений.

### POST `/api/athletes`
Добавить спортсмена.

**Тело запроса:**
```json
{
  "name": "Иванов Иван",
  "phone": "+7 900 123 4567",
  "telegram": "@ivanov",
  "group_id": 1,
  "payment_type": "subscription"
}
```

### PUT `/api/athletes/:id`
Обновить данные спортсмена.

### DELETE `/api/athletes/:id`
Деактивировать спортсмена (soft delete: `status = inactive`).

---

## 🎫 Абонементы `/api/subscriptions`

### GET `/api/subscriptions/:athlete_id`
История абонементов спортсмена.

### POST `/api/subscriptions`
Создать абонемент.

**Тело запроса:**
```json
{
  "athlete_id": 1,
  "total_sessions": 8
}
```

**Ошибка 400** если у спортсмена уже есть активный абонемент.

### PUT `/api/subscriptions/:id/freeze`
Заморозить абонемент.

**Тело запроса:**
```json
{
  "reason": "Болезнь"
}
```

### PUT `/api/subscriptions/:id/unfreeze`
Разморозить абонемент.

---

## 📋 Тренировки `/api/trainings`

### GET `/api/trainings?group_id=1&date=2026-04-09`
Получить тренировки. Фильтр по группе и/или дате.

### POST `/api/trainings`
Создать тренировку.

**Тело запроса:**
```json
{
  "group_id": 1,
  "date": "2026-04-09",
  "time": "18:00"
}
```

### DELETE `/api/trainings/:id`
Удалить тренировку (+ все записи посещений).

---

## ✅ Посещения `/api/attendance`

### GET `/api/attendance/:training_id`
Журнал посещений для тренировки.

**Ответ:**
```json
[
  {
    "id": 1,
    "athlete_id": 1,
    "athlete_name": "Иванов Иван",
    "status": "present",
    "subscription_remaining": 4,
    "amount_paid": null,
    "notes": ""
  }
]
```

### POST `/api/attendance`
Отметить посещение.

**Тело запроса:**
```json
{
  "training_id": 10,
  "athlete_id": 1,
  "status": "present"
}
```

**Для разовой оплаты:**
```json
{
  "training_id": 10,
  "athlete_id": 2,
  "status": "single_pay",
  "amount_paid": 500
}
```

### PUT `/api/attendance/:id`
Изменить статус посещения (например, исправить ошибку).

---

## 📊 Дашборд `/api/dashboard`

### GET `/api/dashboard`
Сводная статистика.

**Ответ:**
```json
{
  "total_athletes": 45,
  "active_subscriptions": 38,
  "expiring_soon": 5,
  "expired": 3,
  "groups": [
    {
      "id": 1,
      "name": "Начинающие",
      "athlete_count": 14,
      "today_training": true
    }
  ],
  "alerts": [
    {
      "athlete_id": 7,
      "athlete_name": "Петров Пётр",
      "type": "subscription_expired",
      "message": "Абонемент закончился (0/8)"
    }
  ]
}
```

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успех |
| 201 | Создано |
| 400 | Ошибка валидации |
| 404 | Не найдено |
| 500 | Внутренняя ошибка сервера |

**Формат ошибки:**
```json
{
  "error": true,
  "message": "У спортсмена уже есть активный абонемент"
}
```
