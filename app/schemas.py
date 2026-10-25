from typing import Literal
from pydantic import BaseModel, Field, model_validator

Genre = Literal[
    "cyberpunk", "fantasy", "sci-fi", "adventure",
    "mystery", "dystopia", "superhero", "medieval",
]
Difficulty = Literal["easy", "medium", "hard"]


class Answer(BaseModel):
    number: int = Field(ge=1, le=4)
    answer_text: str
    is_correct: bool


class Slide(BaseModel):
    slide_id: int = Field(ge=1)
    type: Literal["story", "question_select"]
    speaker: str
    text: str
    answers: list[Answer]
    picture: str

    @model_validator(mode="after")
    def _check(self):
        if self.type == "story":
            if self.answers:
                raise ValueError("story: answers must be []")
            if not self.speaker:
                raise ValueError("story: speaker required")
        else:
            if self.speaker != "":
                raise ValueError("question_select: speaker must be empty")
            if len(self.answers) != 4:
                raise ValueError("question_select: exactly 4 answers")
            if sum(a.is_correct for a in self.answers) != 1:
                raise ValueError("question_select: exactly one correct answer")
            if sorted(a.number for a in self.answers) != [1, 2, 3, 4]:
                raise ValueError("question_select: numbers 1..4")
        return self


class Quest(BaseModel):
    slides_count: int
    slides: list[Slide]

    @model_validator(mode="after")
    def _check(self):
        if self.slides_count != len(self.slides):
            raise ValueError("slides_count != len(slides)")
        if [s.slide_id for s in self.slides] != list(range(1, len(self.slides) + 1)):
            raise ValueError("slide_id must be sequential from 1")
        if self.slides[0].type != "story":
            raise ValueError("slide 1 must be story")
        return self


class QuestRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=300)
    n: int = Field(ge=3, le=12, description="adventure length in slides")
    genre: Genre
    difficulty: Difficulty
    include_theory: bool = True