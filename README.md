
# QuestForge Backend

Бэкенд для генерации образовательных текстовых квестов через локальную LLM Qwen3-8B + LoRA.

## Стек технологий

- **FastAPI** — API и автодокументация.
- **llama-server** — OpenAI-совместимый инференс (CPU).
- **Docker Compose** — оркестрация.

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

## Запуск

```bash
docker compose up -d --build
```
Проверка API:

```bash
curl http://localhost:8000/health
```

Swagger UI: http://localhost:8000/docs

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
4. **Очистка ответа.** Удаление блоков `<think>` и Markdown-обёрток.
5. **Валидация результата.** Проверка JSON через `Quest.model_validate`.
6. **Повторная попытка.** При ошибке используется новый скелет; количество попыток ограничено `max_retries`.
7. **Формирование ответа.** Возвращается валидный квест либо ошибка 502.

> **Важно:** системный промпт должен в точности соответствовать инструкции для LoRA. Любое отклонение может нарушить генерацию JSON.

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

## Troubleshooting

| Проблема | Возможная причина | Решение |
|---|---|---|
| `503 Loading model` | Модель ещё загружается | Дождаться `listening at 0.0.0.0:8080` в логах |
| `/quest` возвращает 502 через 5 секунд | `llama-server` ещё не готов | Подождать 1–2 минуты и повторить запрос |
| `/quest` возвращает 502 через 300 секунд | Истёк таймаут | Увеличить `llm.timeout_s` до 600 |
| `Failed to generate valid quest` | Модель возвращает невалидный JSON | Проверить `--reasoning off`, увеличить `max_retries`, снизить `temperature` до 0.5 |
| `Config file not found` | `app/config.yaml` отсутствует в образе | Проверить инструкцию `COPY . ./app` в Dockerfile |
| Контейнер находится в состоянии `Restarting` | Недостаточно RAM или повреждён GGUF-файл | Проверить `docker compose logs llama-server` |

---

**QuestForge Backend** — локальный API для генерации образовательных текстовых квестов с использованием Qwen3-8B и LoRA-адаптера.
