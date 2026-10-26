# QuestForge Backend

Бэкенд для генерации образовательных текстовых квестов через локальную LLM Qwen3-8B + LoRA.

## Архитектура

Система состоит из трёх контейнеров в единой Docker-сети:

```
┌─────────────┐       ┌─────────────┐       ┌──────────────┐
│  Frontend   │──────▶│   Backend   │──────▶│ llama-server │
│  (nginx)    │       │  (FastAPI)  │       │   (Qwen3)    │
│   :8081     │       │    :8000    │       │    :8080     │
└─────────────┘       └─────────────┘       └──────────────┘
                             │
                             ▼
                      ┌─────────────┐
                      │  config.yaml│
                      │  (hot reload)│
                      └─────────────┘
```

- **Frontend** раздаёт статику через nginx и проксирует запросы `/api/*` на backend.
- **Backend** валидирует запросы, формирует промпты, вызывает LLM и возвращает валидный JSON-сценарий.
- **llama-server** выполняет инференс модели Qwen3-8B с применённым LoRA-адаптером.

## Стек технологий

- **FastAPI** — API и автодокументация.
- **llama-server** — OpenAI-совместимый инференс (CPU).
- **Docker Compose** — оркестрация.
- **Pydantic** — валидация JSON-схемы квеста.
- **httpx** — асинхронные запросы к LLM.

## Требования

- Docker + Docker Compose v2.
- Не менее 10 ГБ RAM.
- Модели в директории `models/`:
  - `Qwen3-8B-Q4_K_M.gguf`
  - `lora_adapter_computer_science.gguf`

### Скачивание модели

```bash
mkdir -p models && cd models
wget https://huggingface.co/unsloth/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf
```

> **Важно:** LoRA обучена именно на Qwen3-8B Q4_K_M. Другая модель или квантизация может нарушить генерацию JSON.

## Структура проекта

```
questforge/
├── docker-compose.yml          # Оркестрация всех сервисов
├── app/                        # Бэкенд FastAPI
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── config.yaml             # Конфигурация LLM и генерации изображений
│   ├── main.py                 # Точка входа FastAPI
│   ├── routes/
│   │   ├── health.py
│   │   ├── config.py
│   │   ├── quest.py
│   │   └── image.py
│   ├── schemas/
│   │   ├── quest.py            # Pydantic-модели Quest, Slide, Answer
│   │   └── request.py
│   ├── services/
│   │   ├── llm_client.py       # Вызовы к llama-server
│   │   ├── image_client.py     # Вызовы к драйверу изображений
│   │   └── prompt_builder.py   # Сборка промптов из скелетов
│   └── prompts/
│       └── skeletons.py        # 5 вариантов скелетов промптов
├── frontend/                   # Фронтенд (vanilla JS + nginx)
│   ├── Dockerfile
│   ├── nginx.conf.template
│   ├── index.html
│   ├── config.js
│   ├── api.js
│   ├── app.js
│   ├── styles.css
│   └── assets/
└── models/                     # GGUF-файлы моделей
    ├── Qwen3-8B-Q4_K_M.gguf
    └── lora_adapter_computer_science.gguf
```

## Запуск

```bash
docker compose up -d --build
```
Проверка API:

```bash
curl http://localhost:8000/health
```

Swagger UI: http://localhost:8000/docs

Запуск игрового UI (Начало игры): http://localhost:8081/

## API

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/health` | Проверка работоспособности |
| GET | `/config` | Получение текущей конфигурации |
| PUT | `/config` | Обновление конфигурации без перезапуска |
| POST | `/quest` | Генерация квеста |
| POST | `/image` | Заглушка изображения (PNG 1×1) |

## Генерация квеста — POST /quest

### Пример запроса

```json
{
  "topic": "Machine Learning",
  "genre": "cyberpunk",
  "difficulty": "medium",
  "n": 5,
  "include_theory": false
}
```

### Параметры запроса

| Поле | Тип | Описание |
|---|---|---|
| `topic` | string | Тема, от 2 до 300 символов |
| `n` | int | Количество слайдов: от 3 до 12 |
| `genre` | enum | Жанр квеста |
| `difficulty` | enum | Уровень сложности |
| `include_theory` | bool | Добавить справочную информацию на первый слайд |

### Доступные жанры

- `cyberpunk`
- `fantasy`
- `sci-fi`
- `adventure`
- `mystery`
- `dystopia`
- `superhero`
- `medieval`

### Уровни сложности

- `easy` — лёгкий.
- `medium` — средний.
- `hard` — сложный.

### Коды ответов

| Код | Значение |
|---|---|
| 200 | Квест успешно сгенерирован |
| 422 | Невалидный запрос |
| 502 | LLM не выдала валидный JSON |

Время генерации на CPU: 2–4 минуты для `n = 5`.

## Генерация изображений — POST /image

Эндпоинт возвращает изображение-заглушку PNG размером 1×1 пиксель в Base64.

Драйвер настраивается в `app/config.yaml`:

- `stub` — заглушка, используется сейчас.
- `a1111` — интеграция с AUTOMATIC1111.
- `openai_images` — интеграция с API генерации изображений.

## Схема квеста

### Пример JSON-ответа

```json
{
  "slides_count": 3,
  "slides": [
    {
      "slide_id": 1,
      "type": "story",
      "speaker": "Narrator",
      "text": "...",
      "answers": [],
      "picture": "... digital illustration, vibrant colors, adventure game style"
    },
    {
      "slide_id": 2,
      "type": "question_select",
      "speaker": "",
      "text": "...",
      "answers": [
        {
          "number": 1,
          "answer_text": "...",
          "is_correct": true
        },
        {
          "number": 2,
          "answer_text": "...",
          "is_correct": false
        },
        {
          "number": 3,
          "answer_text": "...",
          "is_correct": false
        },
        {
          "number": 4,
          "answer_text": "...",
          "is_correct": false
        }
      ],
      "picture": "..."
    }
  ]
}
```

### Правила валидации Pydantic

- `slides_count == len(slides)`.
- `slide_id` начинается с 1 и увеличивается последовательно.
- Первый слайд всегда имеет тип `story`.
- Слайд `question_select`:
  - Содержит ровно 4 варианта ответа.
  - Ровно один вариант имеет `is_correct: true`.
  - Номера ответов — от 1 до 4.
  - `speaker` должен быть пустой строкой (`""`).
- Слайд `story`:
  - `answers` должен быть пустым массивом (`[]`).
  - `speaker` должен быть непустым.

## Конфигурация

Файл конфигурации: `app/config.yaml`.

```yaml
llm:
  base_url: "http://llama-server:8080/v1"
  model: "qwen3-8b-lora"
  token: ""
  timeout_s: 300
  max_retries: 3

image:
  driver: "stub"
  base_url: ""
  model: ""
  token: ""
  width: 1024
  height: 576
  steps: 25
  timeout_s: 300
```

### Hot reload конфигурации

Для обновления настроек используй `PUT /config`.

Эндпоинт перезаписывает файл конфигурации и сразу применяет изменения. Перезапуск контейнеров не требуется.

## Как работает /quest

1. **Валидация запроса.** Проверка `QuestRequest` с помощью Pydantic.
2. **Формирование промпта.** Выбор одного из пяти скелетов с учётом `topic`, `genre`, `difficulty` и `n`.
3. **Запрос к LLM.** Вызов `llama-server` через `/v1/chat/completions`.
4. **Очистка ответа.** Удаление блоков `think` и Markdown-обёрток.
5. **Валидация результата.** Проверка JSON через `Quest.model_validate`.
6. **Повторная попытка.** При ошибке используется новый скелет; количество попыток ограничено `max_retries`.
7. **Формирование ответа.** Возвращается валидный квест либо ошибка 502.

> **Важно:** системный промпт должен в точности соответствовать инструкции для LoRA. Любое отклонение может нарушить генерацию JSON.

## Датасет и обучение LoRA

Адаптер `lora_adapter_computer_science.gguf` обучен методом QLoRA на базе **Qwen3-8B** в Google Colab (T4, 14 ГБ VRAM) с использованием библиотеки **Unsloth**.

### Источник данных

Исходный датасет — **MMLU-Pro**, содержащий 23 961 вопрос с множественным выбором (от 9 до 10 вариантов) по 17 предметным областям. Для данного адаптера отобраны только вопросы домена `computer_science` (10 186 строк).

### Предобработка

1. Фильтрация по `question_type == "multiple_choice"` и домену `computer_science`.
2. Структурные проверки: корректность JSON-полей, отсутствие дублей вариантов.
3. Текстовые фильтры: удаление вопросов со ссылками на внешние изображения, пассажи, ответы вида «all of the above».
4. Урезание 9–10 вариантов до 4: правильный + 3 родных дистрактора из MMLU-Pro, детерминированный шафл для баланса позиций.
5. Дедупликация по нормализованному тексту вопроса.
6. Стратифицированный сплит 80/10/10 по подтемам (≈8062 / 1008 / 1008).

Итоговый размер обучающей выборки: ~10 078 вопросов.

### Формат обучающих примеров

Каждый пример — пара `instruction → target_json`, где `target_json` — это **полный сценарий квеста** в канонической JSON-сериализации (один объект, ни одного символа вне него). Сценарии генерируются синтетически на основе вопросов датасета с помощью генератора скелетов (15+ сеттингов, шаблоны подводок и интро).

### Параметры обучения

| Параметр | Значение |
|---|---|
| Базовая модель | `unsloth/Qwen3-8B-bnb-4bit` |
| Метод | QLoRA (NF4, double quant) |
| LoRA rank (r) | 16 |
| LoRA alpha | 16 |
| LoRA dropout | 0.05 |
| Target modules | q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj |
| Learning rate | 2e-4 |
| Optimizer | AdamW 8-bit |
| Epochs | 1 |
| Max seq length | 2048 |
| Batch size | 1 + gradient accumulation 16 |

### Экспорт

После обучения адаптер сохраняется как GGUF через `convert_lora_to_gguf.py` (из llama.cpp) с флагом `--base-model-id unsloth/Qwen3-8B`. Итоговый файл `lora_adapter_computer_science.gguf` весит ~177 МБ и применяется к базовой модели динамически через флаг `--lora` при запуске `llama-server`.

## Локальная разработка (без Docker)

Для отладки бэкенда вне Docker:

```bash
cd app
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Запустить llama-server локально (должен быть собран или скачан бинарник)
llama-server \
  --model ../models/Qwen3-8B-Q4_K_M.gguf \
  --lora ../models/lora_adapter_computer_science.gguf \
  --ctx-size 4096 --port 8080 --reasoning off

# В отдельном терминале — FastAPI
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

В `config.yaml` измените `llm.base_url` на `http://localhost:8080/v1`.

## Тестирование

### Быстрая проверка

```bash
# Проверка API
curl http://localhost:8000/health

# Проверка llama-server
curl http://localhost:8080/health

# Проверка конфигурации
curl http://localhost:8000/config
```

### Основной сценарий генерации

```bash
time curl -X POST http://localhost:8000/quest \
  -H "Content-Type: application/json" \
  -d '{"topic":"Machine Learning","genre":"cyberpunk","difficulty":"medium","n":5,"include_theory":false}'
```

## Ограничения

- **Производительность CPU:** примерно 4–8 токенов/с; генерация квеста занимает 2–4 минуты.
- **Производительность GPU:** ориентировочно 10–30 секунд на квест.
- **Контекст:** 4096 токенов. Рекомендуется использовать `n <= 8`.
- **Совместимость LoRA:** адаптер рассчитан на Qwen3-8B Q4_K_M.

## Планы развития

- **Диффузионная модель изображений.** Подключение AUTOMATIC1111 или ComfyUI через драйвер `a1111` в `config.yaml`. Текущая заглушка возвращает PNG 1×1 пиксель.
- **Вопросы с открытым ответом.** Поддержка нового типа `question_open` с оценкой ответа LLM (проходит/не проходит).
- **Мультидоменные адаптеры.** Дообучение LoRA на других доменах (History, Physics, Math) с переключением через конфиг без перезапуска.
- **Кеширование сценариев.** Сохранение сгенерированных квестов в Redis/SQLite для повторных запусков.
- **Динамическая загрузка LoRA.** Использование флага `--lora` в `llama-server` с переключением адаптеров на лету (multi-LoRA).
- **Интеграция со внешними LLM.** OpenRouter, GPTunnel, SprutDoc как альтернативы локальной модели.

## Troubleshooting

| Проблема | Возможная причина | Решение |
|---|---|---|
| `503 Loading model` | Модель ещё загружается | Дождаться `listening at 0.0.0.0:8080` в логах |
| `/quest` возвращает 502 через 5 секунд | `llama-server` ещё не готов | Подождать 1–2 минуты и повторить запрос |
| `/quest` возвращает 502 через 300 секунд | Истёк таймаут | Увеличить `llm.timeout_s` до 600 |
| `Failed to generate valid quest` | Модель возвращает невалидный JSON | Проверить `--reasoning off`, увеличить `max_retries`, снизить `temperature` до 0.5 |
| `Config file not found` | `app/config.yaml` отсутствует в образе | Проверить инструкцию `COPY . ./app` в Dockerfile |
| Контейнер находится в состоянии `Restarting` | Недостаточно RAM или повреждён GGUF-файл | Проверить `docker compose logs llama-server` |
| «Китайская каша» в ответе при использовании `--lora` | Несовпадение базовой модели и адаптера | Использовать GGUF только из `unsloth/Qwen3-8B-GGUF` (та же архитектура, что и при обучении) |
| Генерация обрывается на середине | Слишком низкий `-n` или агрессивная квантизация | Использовать `-n 2048+` и Q4_K_M (не Q3) |

---

**QuestForge Backend** — локальный API для генерации образовательных текстовых квестов с использованием Qwen3-8B и LoRA-адаптера.
