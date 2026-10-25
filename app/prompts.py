import re

SYSTEM_PROMPT = """You are a game writer for an educational text quest. Create an interactive learning adventure as a single valid JSON object. Follow this schema exactly:

{"slides_count": int, "slides": [{"slide_id": int, "type": "story" | "question_select", "speaker": str, "text": str, "answers": [...], "picture": str}]}

Rules:
- slides_count equals the number of slides. slide_id is sequential from 1.
- Slide 1 is always "story": a short intro that sets the scene and introduces characters.
- "question_select" slides: narrative text leads naturally into the question; exactly 4 answers, numbered 1..4, exactly one has is_correct = true; speaker is "".
- "story" slides: answers is [], speaker is a character name or "Narrator".
- "picture" is a short English prompt for an image model describing the scene, ending with: "digital illustration, vibrant colors, adventure game style".
- The story text must NOT reveal correct answers.
- Output ONLY the JSON object. No markdown, no comments, no text outside."""


SKELETONS = [
    "Create an adventure with {n} slides about {topic}. Setting: {genre} style. Difficulty: {difficulty}.",
    "Generate a {n}-slide quest on {topic}. Genre: {genre}. Tone: {difficulty} challenge.",
    "Build an interactive story with {n} scenes. Topic: {topic}. Style: {genre}. Level: {difficulty}.",
    "Write a {n}-part adventure exploring {topic}. Atmosphere: {genre}. Difficulty: {difficulty}.",
    "Create a quest with {n} slides. Subject: {topic}. Genre: {genre}. Challenge level: {difficulty}.",
]

THEORY_HINT = (
    " The first slide must be a short reference on the topic that refreshes "
    "the player's knowledge before the quest starts; the questions that follow "
    "must be answerable using that reference."
)


def build_user_prompt(
    topic: str, genre: str, difficulty: str, n: int,
    include_theory: bool = False, variant: int = 0,
) -> str:
    template = SKELETONS[variant % len(SKELETONS)]
    prompt = template.format(topic=topic, genre=genre, difficulty=difficulty, n=n)
    if include_theory:
        prompt += THEORY_HINT
    return prompt


_THINK_RE = re.compile(r"<think>.*?</think>", re.S)
_JSON_RE = re.compile(r"\{.*\}", re.S)


def clean_output(text: str) -> str:
    """Убирает <think>, markdown-обёртки, оставляет только JSON-объект."""
    text = _THINK_RE.sub("", text or "")
    m = _JSON_RE.search(text)
    return (m.group(0) if m else text).strip()