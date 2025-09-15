# Парсер закупок zakupki.gov.ru

Система для парсинга и анализа данных о государственных закупках с сайта zakupki.gov.ru.

## Возможности

- Парсинг страниц поиска контрактов
- Загрузка файлов контрактов 
- Парсинг XML файлов контрактов
- Сохранение данных в PostgreSQL
- REST API для управления парсингом
- Просмотр и анализ данных

## Установка и запуск

### Требования
- Node.js 18+
- Docker и Docker Compose
- PostgreSQL 15

### Быстрый старт с Docker

1. Клонировать репозиторий
2. Запустить с помощью Docker Compose:

```bash
docker-compose up -d
```

### Локальная разработка

1. Установить зависимости:
```bash
npm install
```

2. Создать файл `.env`:
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=parser_db
DATABASE_USER=parser_user
DATABASE_PASSWORD=parser_password
NODE_ENV=development
```

3. Запустить PostgreSQL (можно через Docker):
```bash
docker-compose up postgres -d
```

4. Запустить приложение:
```bash
npm run start:dev
```

## API Endpoints

### Парсинг

#### Поиск контрактов
```http
GET /parser/contracts/search?page=1
GET /parser/contracts/search?startPage=1&endPage=5
```

#### Загрузка файлов контракта
```http
POST /parser/download/:reestrNumber
```

#### Парсинг XML файла
```http
POST /parser/parse-xml
Content-Type: application/json

{
  "xmlContent": "<xml content>"
}
```

#### Парсинг файла по пути
```http
POST /parser/parse-file
Content-Type: application/json

{
  "filePath": "/path/to/file.xml"
}
```

#### Парсинг всех XML файлов в папке
```http
POST /parser/parse-directory
Content-Type: application/json

{
  "directoryPath": "/path/to/directory"
}
```

#### Полная обработка контракта (загрузка + парсинг)
```http
POST /parser/process-contract/:reestrNumber
```

#### Массовая обработка
```http
POST /parser/batch-process
Content-Type: application/json

{
  "startPage": 1,
  "endPage": 3,
  "downloadOnly": false
}
```

### Просмотр данных

#### Список контрактов
```http
GET /data/contracts?page=1&limit=20&search=query
```

#### Детали контракта
```http
GET /data/contracts/:id
```

#### Список заказчиков
```http
GET /data/customers?page=1&limit=20&search=query
```

#### Список моделей
```http
GET /data/models?page=1&limit=20&search=query
```

#### Детали модели
```http
GET /data/models/:id
```

#### Характеристики модели
```http
GET /data/models/:id/characteristics
```

#### Статистика
```http
GET /data/statistics
```

## Структура базы данных

### Таблицы

- `customers` - Заказчики
- `participants` - Участники (поставщики)
- `contracts` - Контракты
- `models` - Модели товаров/оборудования
- `model_variants` - Варианты моделей в разных контрактах
- `characteristics` - Характеристики моделей

### Связи

- Контракт принадлежит одному заказчику и одному участнику
- Контракт может содержать несколько вариантов моделей
- Модель может иметь разные варианты в разных контрактах
- Каждый вариант модели имеет свои характеристики

## Примеры использования

### 1. Поиск и загрузка контрактов

```bash
# Поиск контрактов на странице 1
curl "http://localhost:3000/parser/contracts/search?page=1"

# Загрузка файлов конкретного контракта
curl -X POST "http://localhost:3000/parser/download/0322100003825000019"

# Полная обработка контракта
curl -X POST "http://localhost:3000/parser/process-contract/0322100003825000019"
```

### 2. Массовая обработка

```bash
curl -X POST "http://localhost:3000/parser/batch-process" \
  -H "Content-Type: application/json" \
  -d '{
    "startPage": 1,
    "endPage": 2,
    "downloadOnly": false
  }'
```

### 3. Парсинг локальных файлов

```bash
# Парсинг одного файла
curl -X POST "http://localhost:3000/parser/parse-file" \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/path/to/contract.xml"}'

# Парсинг папки с файлами
curl -X POST "http://localhost:3000/parser/parse-directory" \
  -H "Content-Type: application/json" \
  -d '{"directoryPath": "/path/to/downloads"}'
```

### 4. Просмотр данных

```bash
# Статистика
curl "http://localhost:3000/data/statistics"

# Список контрактов
curl "http://localhost:3000/data/contracts?page=1&limit=10"

# Поиск моделей
curl "http://localhost:3000/data/models?search=ультразвуковой"
```

## Разработка

### Структура проекта

```
src/
├── config/              # Конфигурация
├── database/
│   └── entities/        # TypeORM сущности
├── modules/
│   └── parser/          # Модуль парсинга
│       ├── controllers/ # REST контроллеры
│       ├── services/    # Бизнес-логика
│       └── dto/         # Типы данных
```

### Добавление новых возможностей

1. **Новый парсер** - добавить в `src/modules/parser/services/`
2. **Новые API** - добавить в контроллеры
3. **Новые сущности** - добавить в `src/database/entities/`

### Тестирование

```bash
# Юнит-тесты
npm run test

# E2E тесты
npm run test:e2e

# Покрытие кода
npm run test:cov
```

## Логирование

Приложение использует встроенный логгер NestJS. Логи включают:

- Информацию о парсинге контрактов
- Ошибки загрузки файлов
- Статистику обработки
- Ошибки базы данных

## Лимиты и ограничения

- Задержка 2 секунды между запросами к zakupki.gov.ru
- Максимум 100 записей на страницу в API
- Поддерживаются файлы: XML, DOC, DOCX, PDF

## Поддержка

При возникновении проблем проверьте:

1. Соединение с базой данных
2. Доступность сайта zakupki.gov.ru
3. Права на запись в папку downloads
4. Корректность XML файлов