# EMZ: Hybrid Movie & TV Recommendation System

Интеллектуальная система рекомендаций фильмов и сериалов. Проект дипломного уровня, включающий современный стек технологий, гибридные алгоритмы машинного обучения и интеграцию с LLM.

## Основные возможности
- **Гибридная модель**: сочетание Content-Based (TF-IDF) и Collaborative Filtering (SVD).
- **Холодный старт**: интерактивный онбординг (Bubble Cloud) для новых пользователей.
- **Мультиплатформенность**: веб-приложение (React) и Telegram-бот.
- **Объяснимый ИИ (XAI)**: расшифровка причин каждой рекомендации ("Потому что вам понравилось X").
- **LLM Integration**: автоматическое перефразирование технических объяснений в человекочитаемый вид (OpenAI-совместимый API).
- **Аналитика**: персональная статистика по жанрам и активности.

---

## Технологический стек
- **Frontend**: React 18, Vite, Axios, React Router.
- **Backend**: Node.js, Express, MongoDB (Mongoose), Zod.
- **ML Service**: Python 3.10, FastAPI, Scikit-learn, Pandas, Surprise (SVD).
- **Database**: MongoDB.
- **Bot**: Telegraf (Telegram Bot API).
- **External API**: TMDB (The Movie Database).

---

## Быстрый запуск (Docker)

1. **Клонируйте репозиторий**:
   ```bash
   git clone https://github.com/your-username/emz-view.git
   cd emz-view
   ```

2. **Настройте окружение**:
   Скопируйте пример файла конфигурации в корневой `.env`:
   ```bash
   cp .env.example .env
   ```
   Отредактируйте `.env`, указав ваш **TMDB_API_KEY** и **TELEGRAM_BOT_TOKEN**.
   *Все сервисы теперь используют один общий файл конфигурации в корне проекта.*

3. **Запустите контейнеры**:
   ```bash
   docker-compose up -d --build
   ```

---

## Наполнение данными (Seed/Sync)
Для корректной работы ML-сервиса базе данных нужны фильмы и сериалы.
Выполните следующие запросы к бэкенду (через Postman или `curl`):

- **Синхронизация трендов**:
  `GET http://localhost:8080/api/movies/sync/trending`
- **Загрузка популярных**:
  `GET http://localhost:8080/api/movies/sync/popular`

*Рекомендуется запустить 2-3 раза для формирования базы из 200+ объектов.*

---

## Настройка LLM (Optional)
Чтобы включить "красивые" объяснения:
1. В корневом `.env` установите `LLM_ENABLED=true`.
2. По умолчанию используется локальный LLM-сервис **Ollama** из `docker-compose` через OpenAI-compatible endpoint `OPENAI_BASE_URL=http://ollama:11434/v1`.
3. При первом запуске скачайте модель в Ollama (один раз):
   ```bash
   docker compose exec ollama ollama pull llama3.2:3b
   ```

Если хотите использовать OpenAI вместо локальной модели:
- Укажите `OPENAI_BASE_URL=https://api.openai.com/v1`
- Заполните `OPENAI_API_KEY`

---

## API Documentation (Основные эндпоинты)

### Auth
- `POST /api/auth/register` — Регистрация.
- `POST /api/auth/login` — Вход.

### Recommendations
- `GET /api/recommendations/for-you` — Персональная лента (Hybrid).
- `GET /api/recommendations/mood?mood=fun` — По настроению (Mood: fun, sad, tense, chill).
- `GET /api/recommendations/similar-users` — "Люди со схожими вкусами смотрят".

### Actions
- `POST /api/actions/rate` — Оценка (value: 1 или -1).
- `GET /api/actions/history` — История оценок пользователя.

### Users
- `GET /api/users/stats` — Статистика (счетчики, топ жанров).

---

## Telegram Бот
Бот полностью синхронизирован с веб-версией.
- Позволяет получать рекомендации в дороге.
- Поддерживает выбор настроения.
- Оценки в боте мгновенно влияют на выдачу в веб-приложении.

Monorepo with:
- `backend/` — Node.js + Express API (JWT, MongoDB, TMDB integration)
- `ml-service/` — Python + FastAPI (content-based TF-IDF, collaborative SVD, hybrid logic)
- `telegram-bot/` — Telegram bot (cards, inline like/dislike, sync with backend)
- `frontend/` — React UI (Netflix-like layout, onboarding, recommendations with explanations)

## 1) Requirements

- Docker + Docker Compose (recommended)

Or local:
- Node.js 18+
- Python 3.11+
- MongoDB 6+

## 2) Environment variables

Copy the example env files and fill in your keys:

- `backend/.env` from `backend/.env.example`
- `ml-service/.env` from `ml-service/.env.example`
- `telegram-bot/.env` from `telegram-bot/.env.example`
- `frontend/.env` from `frontend/.env.example`

You need:
- `TMDB_API_KEY` — from https://www.themoviedb.org/
- `TELEGRAM_BOT_TOKEN` — from @BotFather

## 3) Run with Docker

```bash
docker compose up --build
```

Services:
- Backend: http://localhost:8080
- ML Service: http://localhost:8000
- Frontend: http://localhost:5173

## 4) Run locally (without Docker)

### Backend

```bash
npm install
npm run dev
```

### ML Service

```bash
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Telegram bot

```bash
npm install
npm run dev
```

### Frontend

```bash
npm install
npm run dev
```

## 5) API examples

### Register

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass12345","name":"Test"}'
```

### Login

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass12345"}'
```

### Get recommendations

```bash
curl http://localhost:8080/api/recommendations/for-you?limit=20 \
  -H "Authorization: Bearer <JWT>"
```

---

This repo is structured to be a diploma-level reference implementation, but still readable and runnable.
