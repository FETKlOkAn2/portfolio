# Plan A: Portfolio Content API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 67-line Flask app with a FastAPI + SQLAlchemy content API that serves projects, experience, certificates and articles, and lets one admin edit them.

**Architecture:** Typed SQLAlchemy 2 models, a generic `Repository[ModelT]` base class, services that take collaborators through the constructor, and thin routes. `GET /api/v1/content` returns everything with a content-hash `version` and honours `If-None-Match`. One CRUD router factory serves all four resources.

**Tech Stack:** Python 3.13, uv, FastAPI, SQLAlchemy 2 (sync), Alembic, Pydantic v2, pydantic-settings, PyJWT, argon2-cffi, psycopg 3, pytest. SQLite locally and in tests, Postgres (Neon) in production.

**Spec:** `docs/superpowers/specs/2026-10-10-portfolio-rebuild-design.md` in the `portfolio` repo (read sections 5, 7 and 8).

**Run order:** This is plan A of three. Plan B (frontend site) needs this plan's Tasks 1 to 8 finished, because it reads its first content snapshot from this API running locally.

## Global Constraints

- Work in `/Users/tomasmaxim/Developer/portfolio_backend` on branch `rebuild/fastapi`. Never commit to `main`.
- Never push, merge, deploy, change a Render or GitHub setting, or rewrite git history. Task 9 lists those steps for the owner.
- Never print, log or commit a secret. Never choose the admin password. Never read old `.env` values out of git history.
- Python `>=3.13`. Run everything through `uv run`.
- JSON on the wire is camelCase. Python attributes and columns are snake_case.
- `status` is one of `released | prototype | in-progress | archived`. `category` is one of `platform | agents | data | web`. `repoVisibility` is `public | private`. Link `kind` is `live | repo | doc`.
- Use integer HTTP status codes in code and tests (`401`, not `status.HTTP_401_...`). Starlette renamed some constants.
- Do not add `from __future__ import annotations` to any file under `app/api/`. FastAPI must see real classes in route signatures.
- Copy in `seeds/content.json` is final. Do not reword it, and do not add claims. No em dashes anywhere in it.
- No new dependencies beyond those in Task 1.

## File Structure

```
.gitignore, .python-version, .env.example, pyproject.toml, uv.lock, alembic.ini, render.yaml, README.md
.github/workflows/ci.yml
app/__init__.py
app/main.py                      create_app(), CORS, /healthz, router wiring
app/cli.py                       seed | hash-password
app/core/__init__.py
app/core/config.py               Settings, get_settings
app/core/security.py             PasswordVerifier, TokenService, LoginThrottle
app/db/__init__.py
app/db/base.py                   Base, TimestampMixin
app/db/session.py                engine, SessionLocal, get_session
app/models/__init__.py           re-exports the four models
app/models/project.py, experience.py, certificate.py, article.py
app/schemas/__init__.py
app/schemas/base.py              ApiModel (camelCase aliases)
app/schemas/content.py           read/write schemas, ContentPayload, SeedContent
app/schemas/auth.py              LoginRequest, TokenResponse
app/repositories/__init__.py
app/repositories/base.py         Repository[ModelT]
app/repositories/content.py      the four concrete repositories
app/services/__init__.py
app/services/content.py          ContentService
app/services/auth.py             AuthService, InvalidCredentials, TooManyAttempts
app/services/seed.py             SeedService
app/api/__init__.py
app/api/deps.py                  get_content_service, get_auth_service, require_admin
app/api/crud.py                  build_crud_router
app/api/v1/__init__.py
app/api/v1/content.py, auth.py, router.py
alembic/env.py, alembic/versions/<rev>_initial_schema.py
seeds/content.json
tests/__init__.py, conftest.py, factories.py
tests/test_health.py, test_config.py, test_models.py, test_schemas.py, test_repositories.py,
tests/test_security.py, test_auth_service.py, test_content_api.py, test_auth_api.py, test_crud_api.py, test_seed.py
```

---

### Task 1: Clean the repo and stand up a FastAPI skeleton

**Files:**
- Delete: `app.py`, `requirements.txt`; untrack `venv/`, `.env`
- Create: `.gitignore`, `.env.example`, `pyproject.toml`, `app/__init__.py`, `app/core/__init__.py`, `app/core/config.py`, `app/main.py`, `tests/__init__.py`, `tests/test_health.py`, `tests/test_config.py`

**Interfaces:**
- Produces: `app.core.config.Settings` with fields `environment, database_url, cors_origins, jwt_secret, jwt_ttl_minutes, admin_password_hash, seed_file`, properties `cors_origin_list: list[str]`, `is_sqlite: bool`, method `assert_safe() -> None`; `get_settings() -> Settings` (cached); `app.main.create_app() -> FastAPI`; `app.main.app`.

- [ ] **Step 1: Branch and remove what should never have been tracked**

```bash
cd /Users/tomasmaxim/Developer/portfolio_backend
git switch -c rebuild/fastapi
git rm -r --cached --quiet venv .env
git rm --quiet app.py requirements.txt
rm -rf venv
```

Expected: `git status --short | grep -c '^D'` prints a number above 1100. The empty `.env` file stays on disk, untracked.

- [ ] **Step 2: Write `.gitignore`**

```gitignore
.env
.venv/
venv/
__pycache__/
*.pyc
.pytest_cache/
*.db
```

- [ ] **Step 3: Write `.env.example`**

```dotenv
# Copy to .env for local work. Every value has a safe local default, so .env can stay empty.
ENVIRONMENT=local
DATABASE_URL=sqlite:///./portfolio.db
CORS_ORIGINS=http://localhost:5173
# Production only. Generate with: python -c "import secrets; print(secrets.token_urlsafe(48))"
JWT_SECRET=
# Production only. Generate with: uv run python -m app.cli hash-password
ADMIN_PASSWORD_HASH=
```

- [ ] **Step 4: Write `pyproject.toml`**

```toml
[project]
name = "portfolio-backend"
version = "2.0.0"
description = "Content API for the portfolio site"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "sqlalchemy>=2.0.36",
    "alembic>=1.14",
    "pydantic>=2.9",
    "pydantic-settings>=2.6",
    "psycopg[binary]>=3.2",
    "pyjwt>=2.9",
    "argon2-cffi>=23.1",
]

[dependency-groups]
dev = ["pytest>=8.3", "httpx>=0.27"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 5: Install**

```bash
uv python pin 3.13
uv sync
```

Expected: uv creates `.venv/` and `uv.lock`, and prints the installed packages. `uv run python --version` prints `Python 3.13.x`.

- [ ] **Step 6: Write the failing tests**

Create empty `app/__init__.py`, `app/core/__init__.py`, `tests/__init__.py`.

`tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_healthz_reports_ok():
    client = TestClient(create_app())

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

`tests/test_config.py`:

```python
import pytest

from app.core.config import DEV_JWT_SECRET, Settings

# Every test passes each value it depends on, so a local .env cannot change the outcome.
PRODUCTION = {
    "environment": "production",
    "database_url": "postgresql://u:p@h/d",
    "jwt_secret": "x" * 48,
    "admin_password_hash": "$argon2id$stub",
}


def test_postgres_urls_are_rewritten_for_psycopg3():
    settings = Settings(database_url="postgresql://user:pw@host/db?sslmode=require")

    assert settings.database_url == "postgresql+psycopg://user:pw@host/db?sslmode=require"


def test_cors_origins_split_on_commas():
    settings = Settings(cors_origins="https://a.example, http://localhost:5173")

    assert settings.cors_origin_list == ["https://a.example", "http://localhost:5173"]


def test_local_environment_is_always_safe():
    Settings(environment="local", jwt_secret=DEV_JWT_SECRET, admin_password_hash="").assert_safe()


def test_a_complete_production_config_is_safe():
    Settings(**PRODUCTION).assert_safe()


def test_production_rejects_the_development_secret():
    settings = Settings(**{**PRODUCTION, "jwt_secret": DEV_JWT_SECRET})

    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        settings.assert_safe()


def test_production_rejects_a_missing_password_hash():
    settings = Settings(**{**PRODUCTION, "admin_password_hash": ""})

    with pytest.raises(RuntimeError, match="ADMIN_PASSWORD_HASH"):
        settings.assert_safe()


def test_production_rejects_sqlite():
    settings = Settings(**{**PRODUCTION, "database_url": "sqlite:///./portfolio.db"})

    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        settings.assert_safe()
```

- [ ] **Step 7: Run the tests and watch them fail**

Run: `uv run pytest -q`
Expected: collection errors, `ModuleNotFoundError: No module named 'app.main'` and `app.core.config`.

- [ ] **Step 8: Write `app/core/config.py`**

```python
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-secret-change-me-0123456789abcdef"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "local"
    database_url: str = "sqlite:///./portfolio.db"
    cors_origins: str = "http://localhost:5173"
    jwt_secret: str = DEV_JWT_SECRET
    jwt_ttl_minutes: int = 30
    admin_password_hash: str = ""
    seed_file: str = "seeds/content.json"

    @field_validator("database_url")
    @classmethod
    def _use_psycopg3(cls, value: str) -> str:
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    def assert_safe(self) -> None:
        if self.environment != "production":
            return
        if self.jwt_secret == DEV_JWT_SECRET or len(self.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be a random value of 32+ characters in production")
        if not self.admin_password_hash:
            raise RuntimeError("ADMIN_PASSWORD_HASH must be set in production")
        if self.is_sqlite:
            raise RuntimeError("DATABASE_URL must point at Postgres in production")


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 9: Write `app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    settings.assert_safe()

    app = FastAPI(title="Portfolio API", version="2.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "If-None-Match"],
        expose_headers=["ETag"],
    )

    @app.get("/healthz", tags=["health"])
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
```

- [ ] **Step 10: Run the tests**

Run: `uv run pytest -q`
Expected: `8 passed`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: replace Flask app with a FastAPI skeleton and untrack venv and .env"
```

---

### Task 2: Database base, session and the four models

**Files:**
- Create: `app/db/__init__.py`, `app/db/base.py`, `app/db/session.py`, `app/models/__init__.py`, `app/models/project.py`, `app/models/experience.py`, `app/models/certificate.py`, `app/models/article.py`, `tests/conftest.py`, `tests/test_models.py`

**Interfaces:**
- Consumes: `get_settings()` from Task 1.
- Produces: `app.db.base.Base`, `TimestampMixin`; `app.db.session.engine`, `SessionLocal`, `get_session() -> Iterator[Session]`; models `Project`, `Experience`, `Certificate`, `Article` importable from `app.models`; pytest fixture `session` (in-memory SQLite `Session`).

- [ ] **Step 1: Write the `session` fixture**

Create empty `app/db/__init__.py`.

`tests/conftest.py`:

```python
from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  registers the tables on Base.metadata
from app.db.base import Base


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        yield db
    engine.dispose()
```

- [ ] **Step 2: Write the failing tests**

`tests/test_models.py`:

```python
from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import Article, Certificate, Experience, Project


def _project(slug: str = "demo") -> Project:
    return Project(
        slug=slug,
        title="Demo",
        tagline="A demo project.",
        description="Longer text.",
        highlights=["first"],
        tech=["Python"],
        flow=["a", "b"],
        links=[{"kind": "repo", "label": "Source", "url": "https://example.com/repo"}],
        status="released",
        category="platform",
        repo_visibility="public",
    )


def test_project_round_trips_its_json_columns(session):
    session.add(_project())
    session.commit()
    session.expire_all()

    stored = session.scalars(select(Project)).one()

    assert stored.links == [{"kind": "repo", "label": "Source", "url": "https://example.com/repo"}]
    assert stored.flow == ["a", "b"]
    assert stored.featured is False
    assert stored.sort_order == 0
    assert stored.created_at is not None
    assert stored.updated_at is not None


def test_project_slug_is_unique(session):
    session.add(_project("same"))
    session.commit()
    session.add(_project("same"))

    with pytest.raises(IntegrityError):
        session.commit()


def test_experience_allows_an_open_end_date(session):
    session.add(
        Experience(
            role="Software Engineer",
            company="Iron Mountain",
            start_date=date(2026, 7, 1),
        )
    )
    session.commit()
    session.expire_all()

    stored = session.scalars(select(Experience)).one()

    assert stored.end_date is None
    assert stored.employment_type is None
    assert stored.summary == ""
    assert stored.skills == []


def test_certificate_and_article_persist(session):
    session.add(Certificate(title="CCNA 1", issuer="Cisco", issued_label="2023"))
    session.add(
        Article(
            title="A post",
            publication="Medium",
            topic="Engineering",
            summary="About a thing.",
            url="https://medium.com/post",
        )
    )
    session.commit()

    assert session.scalars(select(Certificate)).one().sort_order == 0
    assert session.scalars(select(Article)).one().publication == "Medium"
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `uv run pytest tests/test_models.py -q`
Expected: `ModuleNotFoundError: No module named 'app.models'`.

- [ ] **Step 4: Write `app/db/base.py`**

```python
from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
```

- [ ] **Step 5: Write `app/db/session.py`**

```python
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

_settings = get_settings()
_connect_args = {"check_same_thread": False} if _settings.is_sqlite else {}

engine = create_engine(_settings.database_url, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
```

- [ ] **Step 6: Write the models**

`app/models/project.py`:

```python
from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Project(TimestampMixin, Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(120))
    tagline: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    highlights: Mapped[list[str]] = mapped_column(JSON, default=list)
    tech: Mapped[list[str]] = mapped_column(JSON, default=list)
    flow: Mapped[list[str]] = mapped_column(JSON, default=list)
    links: Mapped[list[dict[str, str]]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20))
    category: Mapped[str] = mapped_column(String(20))
    repo_visibility: Mapped[str] = mapped_column(String(10))
    featured: Mapped[bool] = mapped_column(default=False)
    sort_order: Mapped[int] = mapped_column(default=0, index=True)
```

`app/models/experience.py`:

```python
from datetime import date

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Experience(TimestampMixin, Base):
    __tablename__ = "experience"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(120))
    company: Mapped[str] = mapped_column(String(120))
    employment_type: Mapped[str | None] = mapped_column(String(40))
    location: Mapped[str | None] = mapped_column(String(120))
    start_date: Mapped[date] = mapped_column(index=True)
    end_date: Mapped[date | None]
    summary: Mapped[str] = mapped_column(Text, default="")
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
```

`app/models/certificate.py`:

```python
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Certificate(TimestampMixin, Base):
    __tablename__ = "certificates"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    issuer: Mapped[str] = mapped_column(String(120))
    issued_label: Mapped[str] = mapped_column(String(40))
    sort_order: Mapped[int] = mapped_column(default=0, index=True)
```

`app/models/article.py`:

```python
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Article(TimestampMixin, Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    publication: Mapped[str] = mapped_column(String(80))
    topic: Mapped[str] = mapped_column(String(80))
    summary: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(String(300))
    sort_order: Mapped[int] = mapped_column(default=0, index=True)
```

`app/models/__init__.py`:

```python
from app.models.article import Article
from app.models.certificate import Certificate
from app.models.experience import Experience
from app.models.project import Project

__all__ = ["Article", "Certificate", "Experience", "Project"]
```

- [ ] **Step 7: Run the tests**

Run: `uv run pytest -q`
Expected: `12 passed`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add SQLAlchemy models for projects, experience, certificates and articles"
```

---

### Task 3: Schemas and repositories

**Files:**
- Create: `app/schemas/__init__.py`, `app/schemas/base.py`, `app/schemas/content.py`, `app/repositories/__init__.py`, `app/repositories/base.py`, `app/repositories/content.py`, `tests/factories.py`, `tests/test_schemas.py`, `tests/test_repositories.py`

**Interfaces:**
- Consumes: models and the `session` fixture from Task 2.
- Produces:
  - `app.schemas.base.ApiModel`
  - `app.schemas.content`: `Link`, `ProjectWrite`, `ProjectRead`, `ExperienceWrite`, `ExperienceRead`, `CertificateWrite`, `CertificateRead`, `ArticleWrite`, `ArticleRead`, `ContentPayload(version, projects, experience, certificates, articles)`, `SeedContent(projects, experience, certificates, articles)`
  - `app.repositories.base.Repository[ModelT]` with `session`, `all() -> list[ModelT]`, `get(entity_id: int) -> ModelT | None`, `count() -> int`, `add(data: dict) -> ModelT`, `update(entity, data: dict) -> ModelT`, `delete(entity) -> None`, `ordering() -> tuple`
  - `app.repositories.content`: `ProjectRepository` (adds `get_by_slug(slug) -> Project | None`), `ExperienceRepository`, `CertificateRepository`, `ArticleRepository`
  - `tests.factories`: `project_data(**overrides) -> dict` (snake_case model kwargs), `project_body(**overrides) -> dict` (camelCase request body), `experience_body(**overrides) -> dict`

- [ ] **Step 1: Write the factories**

Create empty `app/schemas/__init__.py` and `app/repositories/__init__.py`.

`tests/factories.py`:

```python
from typing import Any


def project_data(**overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "slug": "demo",
        "title": "Demo",
        "tagline": "A demo project.",
        "description": "Longer text.",
        "highlights": ["first"],
        "tech": ["Python"],
        "flow": ["a", "b"],
        "links": [{"kind": "repo", "label": "Source", "url": "https://example.com/repo"}],
        "status": "released",
        "category": "platform",
        "repo_visibility": "public",
        "featured": False,
        "sort_order": 0,
    }
    data.update(overrides)
    return data


def project_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "slug": "demo",
        "title": "Demo",
        "tagline": "A demo project.",
        "description": "Longer text.",
        "highlights": ["first"],
        "tech": ["Python"],
        "flow": ["a", "b"],
        "links": [{"kind": "repo", "label": "Source", "url": "https://example.com/repo"}],
        "status": "released",
        "category": "platform",
        "repoVisibility": "public",
        "featured": False,
        "sortOrder": 0,
    }
    body.update(overrides)
    return body


def experience_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "role": "Python Developer",
        "company": "Example Co",
        "employmentType": "Contract",
        "location": "Remote",
        "startDate": "2025-09-01",
        "endDate": "2026-01-01",
        "summary": "Built things.",
        "skills": ["Python"],
    }
    body.update(overrides)
    return body
```

- [ ] **Step 2: Write the failing schema tests**

`tests/test_schemas.py`:

```python
import pytest
from pydantic import ValidationError

from app.schemas.content import ExperienceWrite, ProjectRead, ProjectWrite
from tests.factories import experience_body, project_body, project_data


def test_project_write_reads_camel_case_and_dumps_snake_case():
    parsed = ProjectWrite.model_validate(project_body(repoVisibility="private", sortOrder=30))

    dumped = parsed.model_dump()

    assert dumped["repo_visibility"] == "private"
    assert dumped["sort_order"] == 30
    assert dumped["links"] == [
        {"kind": "repo", "label": "Source", "url": "https://example.com/repo"}
    ]


def test_project_read_serialises_camel_case():
    read = ProjectRead.model_validate({"id": 7, **project_data()})

    body = read.model_dump(mode="json", by_alias=True)

    assert body["id"] == 7
    assert body["repoVisibility"] == "public"
    assert "repo_visibility" not in body


@pytest.mark.parametrize(
    "override",
    [
        {"slug": "Has Spaces"},
        {"slug": "trailing-"},
        {"status": "shipped"},
        {"category": "misc"},
        {"repoVisibility": "secret"},
        {"highlights": ["one", "two", "three", "four"]},
        {"links": [{"kind": "repo", "label": "Source", "url": "javascript:alert(1)"}]},
        {"links": [{"kind": "video", "label": "Demo", "url": "https://example.com"}]},
        {"title": ""},
    ],
)
def test_project_write_rejects_invalid_input(override):
    with pytest.raises(ValidationError):
        ProjectWrite.model_validate(project_body(**override))


def test_experience_accepts_an_open_end_date():
    parsed = ExperienceWrite.model_validate(experience_body(endDate=None))

    assert parsed.end_date is None


def test_experience_rejects_an_end_before_its_start():
    with pytest.raises(ValidationError, match="endDate"):
        ExperienceWrite.model_validate(experience_body(endDate="2025-01-01"))
```

- [ ] **Step 3: Write the failing repository tests**

`tests/test_repositories.py`:

```python
from datetime import date

from app.repositories.content import (
    CertificateRepository,
    ExperienceRepository,
    ProjectRepository,
)
from tests.factories import project_data


def test_projects_come_back_in_sort_order(session):
    repo = ProjectRepository(session)
    repo.add(project_data(slug="second", sort_order=20))
    repo.add(project_data(slug="first", sort_order=10))
    repo.add(project_data(slug="third", sort_order=20))

    assert [p.slug for p in repo.all()] == ["first", "second", "third"]


def test_experience_comes_back_newest_first(session):
    repo = ExperienceRepository(session)
    repo.add({"role": "Old", "company": "A", "start_date": date(2024, 7, 1)})
    repo.add({"role": "New", "company": "B", "start_date": date(2026, 7, 1)})

    assert [e.role for e in repo.all()] == ["New", "Old"]


def test_add_get_update_delete_and_count(session):
    repo = CertificateRepository(session)
    assert repo.count() == 0

    created = repo.add({"title": "CCNA 1", "issuer": "Cisco", "issued_label": "2023"})
    assert repo.count() == 1
    assert repo.get(created.id).title == "CCNA 1"

    updated = repo.update(created, {"title": "CCNA 2", "issued_label": "2025"})
    assert updated.title == "CCNA 2"
    assert repo.get(created.id).issued_label == "2025"

    repo.delete(updated)
    assert repo.count() == 0
    assert repo.get(created.id) is None


def test_get_by_slug(session):
    repo = ProjectRepository(session)
    repo.add(project_data(slug="aptum"))

    assert repo.get_by_slug("aptum").title == "Demo"
    assert repo.get_by_slug("missing") is None
```

- [ ] **Step 4: Run the tests and watch them fail**

Run: `uv run pytest tests/test_schemas.py tests/test_repositories.py -q`
Expected: `ModuleNotFoundError` for `app.schemas.content` and `app.repositories.content`.

- [ ] **Step 5: Write `app/schemas/base.py`**

```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    """Base for every schema: camelCase on the wire, snake_case in Python."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
```

- [ ] **Step 6: Write `app/schemas/content.py`**

```python
from datetime import date
from typing import Literal, Self

from pydantic import Field, field_validator, model_validator

from app.schemas.base import ApiModel

Status = Literal["released", "prototype", "in-progress", "archived"]
Category = Literal["platform", "agents", "data", "web"]
RepoVisibility = Literal["public", "private"]
LinkKind = Literal["live", "repo", "doc"]


def require_http(url: str) -> str:
    if not url.startswith(("https://", "http://")):
        raise ValueError("url must start with http:// or https://")
    return url


class Link(ApiModel):
    kind: LinkKind
    label: str = Field(min_length=1, max_length=40)
    url: str = Field(max_length=300)

    @field_validator("url")
    @classmethod
    def _http_only(cls, value: str) -> str:
        return require_http(value)


class ProjectWrite(ApiModel):
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=80)
    title: str = Field(min_length=1, max_length=120)
    tagline: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    highlights: list[str] = Field(default_factory=list, max_length=3)
    tech: list[str] = Field(default_factory=list)
    flow: list[str] = Field(default_factory=list)
    links: list[Link] = Field(default_factory=list)
    status: Status
    category: Category
    repo_visibility: RepoVisibility
    featured: bool = False
    sort_order: int = 0


class ProjectRead(ProjectWrite):
    id: int


class ExperienceWrite(ApiModel):
    role: str = Field(min_length=1, max_length=120)
    company: str = Field(min_length=1, max_length=120)
    employment_type: str | None = Field(default=None, max_length=40)
    location: str | None = Field(default=None, max_length=120)
    start_date: date
    end_date: date | None = None
    summary: str = ""
    skills: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _ends_after_start(self) -> Self:
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("endDate must not be before startDate")
        return self


class ExperienceRead(ExperienceWrite):
    id: int


class CertificateWrite(ApiModel):
    title: str = Field(min_length=1, max_length=160)
    issuer: str = Field(min_length=1, max_length=120)
    issued_label: str = Field(min_length=1, max_length=40)
    sort_order: int = 0


class CertificateRead(CertificateWrite):
    id: int


class ArticleWrite(ApiModel):
    title: str = Field(min_length=1, max_length=200)
    publication: str = Field(min_length=1, max_length=80)
    topic: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1)
    url: str = Field(max_length=300)
    sort_order: int = 0

    @field_validator("url")
    @classmethod
    def _http_only(cls, value: str) -> str:
        return require_http(value)


class ArticleRead(ArticleWrite):
    id: int


class ContentPayload(ApiModel):
    version: str
    projects: list[ProjectRead]
    experience: list[ExperienceRead]
    certificates: list[CertificateRead]
    articles: list[ArticleRead]


class SeedContent(ApiModel):
    projects: list[ProjectWrite]
    experience: list[ExperienceWrite]
    certificates: list[CertificateWrite]
    articles: list[ArticleWrite]
```

- [ ] **Step 7: Write `app/repositories/base.py`**

```python
from typing import Any, Generic, TypeVar

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class Repository(Generic[ModelT]):
    """CRUD over one table. Subclasses set `model` and may override `ordering`."""

    model: type[ModelT]

    def __init__(self, session: Session) -> None:
        self.session = session

    def ordering(self) -> tuple[Any, ...]:
        return (self.model.id,)

    def all(self) -> list[ModelT]:
        statement = select(self.model).order_by(*self.ordering())
        return list(self.session.scalars(statement))

    def get(self, entity_id: int) -> ModelT | None:
        return self.session.get(self.model, entity_id)

    def count(self) -> int:
        return self.session.scalar(select(func.count()).select_from(self.model)) or 0

    def add(self, data: dict[str, Any]) -> ModelT:
        entity = self.model(**data)
        self.session.add(entity)
        self.session.commit()
        self.session.refresh(entity)
        return entity

    def update(self, entity: ModelT, data: dict[str, Any]) -> ModelT:
        for key, value in data.items():
            setattr(entity, key, value)
        self.session.commit()
        self.session.refresh(entity)
        return entity

    def delete(self, entity: ModelT) -> None:
        self.session.delete(entity)
        self.session.commit()
```

- [ ] **Step 8: Write `app/repositories/content.py`**

```python
from typing import Any

from sqlalchemy import select

from app.models import Article, Certificate, Experience, Project
from app.repositories.base import Repository


class ProjectRepository(Repository[Project]):
    model = Project

    def ordering(self) -> tuple[Any, ...]:
        return (Project.sort_order, Project.id)

    def get_by_slug(self, slug: str) -> Project | None:
        return self.session.scalar(select(Project).where(Project.slug == slug))


class ExperienceRepository(Repository[Experience]):
    model = Experience

    def ordering(self) -> tuple[Any, ...]:
        return (Experience.start_date.desc(), Experience.id)


class CertificateRepository(Repository[Certificate]):
    model = Certificate

    def ordering(self) -> tuple[Any, ...]:
        return (Certificate.sort_order, Certificate.id)


class ArticleRepository(Repository[Article]):
    model = Article

    def ordering(self) -> tuple[Any, ...]:
        return (Article.sort_order, Article.id)
```

- [ ] **Step 9: Run the tests**

Run: `uv run pytest -q`
Expected: `29 passed`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add camelCase schemas and a generic repository layer"
```

---

### Task 4: Security classes and AuthService

**Files:**
- Create: `app/core/security.py`, `app/services/__init__.py`, `app/services/auth.py`, `tests/test_security.py`, `tests/test_auth_service.py`

**Interfaces:**
- Produces:
  - `PasswordVerifier(password_hash: str)` with `matches(password: str) -> bool` and static `hash(password: str) -> str`
  - `TokenService(secret: str, ttl_minutes: int)` with `ttl_seconds: int`, `issue() -> str`, `is_valid(token: str) -> bool`
  - `LoginThrottle(max_failures=5, window_seconds=300, clock=time.monotonic)` with `is_blocked(key) -> bool`, `record_failure(key) -> None`, `reset(key) -> None`
  - `AuthService(verifier, tokens, throttle)` with `login(password: str, client_key: str) -> tuple[str, int]` (token, ttl seconds) and `is_authorised(token: str) -> bool`; exceptions `InvalidCredentials`, `TooManyAttempts`

- [ ] **Step 1: Write the failing security tests**

Create empty `app/services/__init__.py`.

`tests/test_security.py`:

```python
from app.core.security import LoginThrottle, PasswordVerifier, TokenService

SECRET = "test-secret-0123456789abcdef0123456789"


def test_verifier_accepts_the_right_password_only():
    verifier = PasswordVerifier(PasswordVerifier.hash("hunter2 but longer"))

    assert verifier.matches("hunter2 but longer") is True
    assert verifier.matches("something else") is False


def test_verifier_with_no_hash_accepts_nothing():
    assert PasswordVerifier("").matches("anything") is False


def test_verifier_with_a_malformed_hash_accepts_nothing():
    assert PasswordVerifier("not-a-hash").matches("anything") is False


def test_issued_token_is_valid():
    tokens = TokenService(SECRET, ttl_minutes=30)

    assert tokens.ttl_seconds == 1800
    assert tokens.is_valid(tokens.issue()) is True


def test_expired_token_is_invalid():
    tokens = TokenService(SECRET, ttl_minutes=-1)

    assert tokens.is_valid(tokens.issue()) is False


def test_token_signed_with_another_secret_is_invalid():
    other = TokenService("another-secret-0123456789abcdef012345", ttl_minutes=30)

    assert TokenService(SECRET, ttl_minutes=30).is_valid(other.issue()) is False


def test_garbage_token_is_invalid():
    assert TokenService(SECRET, ttl_minutes=30).is_valid("not.a.token") is False


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_throttle_blocks_after_the_limit_and_recovers_after_the_window():
    clock = FakeClock()
    throttle = LoginThrottle(max_failures=2, window_seconds=60, clock=clock)

    throttle.record_failure("1.2.3.4")
    assert throttle.is_blocked("1.2.3.4") is False
    throttle.record_failure("1.2.3.4")
    assert throttle.is_blocked("1.2.3.4") is True
    assert throttle.is_blocked("5.6.7.8") is False

    clock.now += 61
    assert throttle.is_blocked("1.2.3.4") is False


def test_throttle_reset_clears_failures():
    throttle = LoginThrottle(max_failures=1, window_seconds=60)
    throttle.record_failure("1.2.3.4")

    throttle.reset("1.2.3.4")

    assert throttle.is_blocked("1.2.3.4") is False
```

- [ ] **Step 2: Write the failing AuthService tests**

`tests/test_auth_service.py`:

```python
import pytest

from app.core.security import LoginThrottle, PasswordVerifier, TokenService
from app.services.auth import AuthService, InvalidCredentials, TooManyAttempts

PASSWORD = "correct horse battery staple"


@pytest.fixture
def auth() -> AuthService:
    return AuthService(
        PasswordVerifier(PasswordVerifier.hash(PASSWORD)),
        TokenService("test-secret-0123456789abcdef0123456789", ttl_minutes=30),
        LoginThrottle(max_failures=2, window_seconds=300),
    )


def test_login_returns_a_valid_token_and_its_lifetime(auth):
    token, ttl = auth.login(PASSWORD, "1.2.3.4")

    assert ttl == 1800
    assert auth.is_authorised(token) is True


def test_wrong_password_raises(auth):
    with pytest.raises(InvalidCredentials):
        auth.login("wrong", "1.2.3.4")


def test_repeated_failures_block_even_the_right_password(auth):
    for _ in range(2):
        with pytest.raises(InvalidCredentials):
            auth.login("wrong", "1.2.3.4")

    with pytest.raises(TooManyAttempts):
        auth.login(PASSWORD, "1.2.3.4")


def test_a_success_clears_earlier_failures(auth):
    with pytest.raises(InvalidCredentials):
        auth.login("wrong", "1.2.3.4")
    auth.login(PASSWORD, "1.2.3.4")

    with pytest.raises(InvalidCredentials):
        auth.login("wrong", "1.2.3.4")
    auth.login(PASSWORD, "1.2.3.4")


def test_unknown_token_is_not_authorised(auth):
    assert auth.is_authorised("nope") is False
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `uv run pytest tests/test_security.py tests/test_auth_service.py -q`
Expected: `ModuleNotFoundError: No module named 'app.core.security'`.

- [ ] **Step 4: Write `app/core/security.py`**

```python
import time
from collections import defaultdict, deque
from collections.abc import Callable
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError


class PasswordVerifier:
    """Checks a password against one stored argon2 hash."""

    def __init__(self, password_hash: str) -> None:
        self._hash = password_hash
        self._hasher = PasswordHasher()

    def matches(self, password: str) -> bool:
        if not self._hash:
            return False
        try:
            return self._hasher.verify(self._hash, password)
        except (VerificationError, InvalidHashError):
            return False

    @staticmethod
    def hash(password: str) -> str:
        return PasswordHasher().hash(password)


class TokenService:
    """Issues and checks the admin's short-lived JWT."""

    algorithm = "HS256"
    subject = "admin"

    def __init__(self, secret: str, ttl_minutes: int) -> None:
        self._secret = secret
        self.ttl_seconds = ttl_minutes * 60

    def issue(self) -> str:
        now = datetime.now(timezone.utc)
        claims = {
            "sub": self.subject,
            "iat": now,
            "exp": now + timedelta(seconds=self.ttl_seconds),
        }
        return jwt.encode(claims, self._secret, algorithm=self.algorithm)

    def is_valid(self, token: str) -> bool:
        try:
            claims = jwt.decode(token, self._secret, algorithms=[self.algorithm])
        except jwt.PyJWTError:
            return False
        return claims.get("sub") == self.subject


class LoginThrottle:
    """Counts failed logins per client inside a sliding window. In memory, one process."""

    def __init__(
        self,
        max_failures: int = 5,
        window_seconds: int = 300,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_failures = max_failures
        self._window_seconds = window_seconds
        self._clock = clock
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _recent(self, key: str) -> deque[float]:
        entries = self._failures[key]
        cutoff = self._clock() - self._window_seconds
        while entries and entries[0] <= cutoff:
            entries.popleft()
        return entries

    def is_blocked(self, key: str) -> bool:
        return len(self._recent(key)) >= self._max_failures

    def record_failure(self, key: str) -> None:
        self._recent(key).append(self._clock())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)
```

- [ ] **Step 5: Write `app/services/auth.py`**

```python
from app.core.security import LoginThrottle, PasswordVerifier, TokenService


class InvalidCredentials(Exception):
    pass


class TooManyAttempts(Exception):
    pass


class AuthService:
    def __init__(
        self,
        verifier: PasswordVerifier,
        tokens: TokenService,
        throttle: LoginThrottle,
    ) -> None:
        self._verifier = verifier
        self._tokens = tokens
        self._throttle = throttle

    def login(self, password: str, client_key: str) -> tuple[str, int]:
        if self._throttle.is_blocked(client_key):
            raise TooManyAttempts
        if not self._verifier.matches(password):
            self._throttle.record_failure(client_key)
            raise InvalidCredentials
        self._throttle.reset(client_key)
        return self._tokens.issue(), self._tokens.ttl_seconds

    def is_authorised(self, token: str) -> bool:
        return self._tokens.is_valid(token)
```

- [ ] **Step 6: Run the tests**

Run: `uv run pytest -q`
Expected: `43 passed`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add password verification, JWT issuing and login throttling"
```

---

### Task 5: Content endpoint, login endpoint and HTTP test fixtures

**Files:**
- Create: `app/services/content.py`, `app/schemas/auth.py`, `app/api/__init__.py`, `app/api/deps.py`, `app/api/v1/__init__.py`, `app/api/v1/content.py`, `app/api/v1/auth.py`, `app/api/v1/router.py`, `tests/test_content_api.py`, `tests/test_auth_api.py`
- Modify: `app/main.py` (include the router), `tests/conftest.py` (replace whole file)

**Interfaces:**
- Consumes: repositories and schemas (Task 3), `AuthService` and security classes (Task 4), `get_session` (Task 2).
- Produces:
  - `ContentService(session)` with `payload() -> ContentPayload`
  - `app.api.deps`: `get_content_service`, `get_auth_service` (cached singleton), `require_admin`
  - `app.api.v1.router.api_router` (prefix `/api/v1`)
  - `GET /api/v1/content`, `POST /api/v1/auth/login`
  - pytest fixtures: `auth_service`, `client` (TestClient with DB and auth overridden), `admin_headers` (`{"Authorization": "Bearer ..."}`); constant `tests.conftest.ADMIN_PASSWORD`

- [ ] **Step 1: Replace `tests/conftest.py` with the full fixture set**

```python
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  registers the tables on Base.metadata
from app.api.deps import get_auth_service
from app.core.security import LoginThrottle, PasswordVerifier, TokenService
from app.db.base import Base
from app.db.session import get_session
from app.main import create_app
from app.services.auth import AuthService

ADMIN_PASSWORD = "correct horse battery staple"


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        yield db
    engine.dispose()


@pytest.fixture
def auth_service() -> AuthService:
    return AuthService(
        PasswordVerifier(PasswordVerifier.hash(ADMIN_PASSWORD)),
        TokenService("test-secret-0123456789abcdef0123456789", ttl_minutes=30),
        LoginThrottle(max_failures=3, window_seconds=300),
    )


@pytest.fixture
def client(session: Session, auth_service: AuthService) -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_auth_service] = lambda: auth_service
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def admin_headers(auth_service: AuthService) -> dict[str, str]:
    token, _ = auth_service.login(ADMIN_PASSWORD, "fixture")
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 2: Write the failing content tests**

`tests/test_content_api.py`:

```python
from app.repositories.content import CertificateRepository, ProjectRepository
from tests.factories import project_data

SECTIONS = ("projects", "experience", "certificates", "articles")


def test_empty_database_returns_empty_sections(client):
    response = client.get("/api/v1/content")

    body = response.json()
    assert response.status_code == 200
    assert all(body[section] == [] for section in SECTIONS)
    assert len(body["version"]) == 16
    assert response.headers["etag"] == f'"{body["version"]}"'


def test_projects_are_served_in_camel_case(client, session):
    ProjectRepository(session).add(project_data(slug="aptum", repo_visibility="private"))

    project = client.get("/api/v1/content").json()["projects"][0]

    assert project["slug"] == "aptum"
    assert project["repoVisibility"] == "private"
    assert project["sortOrder"] == 0
    assert "created_at" not in project and "createdAt" not in project


def test_matching_etag_gets_304_with_no_body(client):
    etag = client.get("/api/v1/content").headers["etag"]

    response = client.get("/api/v1/content", headers={"If-None-Match": etag})

    assert response.status_code == 304
    assert response.content == b""
    assert response.headers["etag"] == etag


def test_version_changes_when_content_changes(client, session):
    before = client.get("/api/v1/content").json()["version"]

    CertificateRepository(session).add(
        {"title": "CCNA 1", "issuer": "Cisco", "issued_label": "2023"}
    )
    after = client.get("/api/v1/content").json()["version"]

    assert before != after
    stale = client.get("/api/v1/content", headers={"If-None-Match": f'"{before}"'})
    assert stale.status_code == 200


def test_version_is_stable_between_identical_reads(client):
    first = client.get("/api/v1/content").json()["version"]
    second = client.get("/api/v1/content").json()["version"]

    assert first == second


def test_preflight_allows_the_configured_origin(client):
    response = client.options(
        "/api/v1/content",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "if-none-match",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
```

- [ ] **Step 3: Write the failing login tests**

`tests/test_auth_api.py`:

```python
from tests.conftest import ADMIN_PASSWORD


def test_login_with_the_right_password_returns_a_token(client, auth_service):
    response = client.post("/api/v1/auth/login", json={"password": ADMIN_PASSWORD})

    body = response.json()
    assert response.status_code == 200
    assert body["expiresIn"] == 1800
    assert auth_service.is_authorised(body["accessToken"]) is True


def test_login_with_the_wrong_password_is_401(client):
    response = client.post("/api/v1/auth/login", json={"password": "wrong"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Wrong password"}


def test_login_is_throttled_after_repeated_failures(client):
    for _ in range(3):
        client.post("/api/v1/auth/login", json={"password": "wrong"})

    response = client.post("/api/v1/auth/login", json={"password": ADMIN_PASSWORD})

    assert response.status_code == 429


def test_login_requires_a_password_field(client):
    response = client.post("/api/v1/auth/login", json={})

    assert response.status_code == 422
```

- [ ] **Step 4: Run the tests and watch them fail**

Run: `uv run pytest tests/test_content_api.py tests/test_auth_api.py -q`
Expected: `ModuleNotFoundError: No module named 'app.api'` raised from `tests/conftest.py`.

- [ ] **Step 5: Write `app/services/content.py`**

```python
import hashlib
import json

from sqlalchemy.orm import Session

from app.repositories.content import (
    ArticleRepository,
    CertificateRepository,
    ExperienceRepository,
    ProjectRepository,
)
from app.schemas.content import (
    ArticleRead,
    CertificateRead,
    ContentPayload,
    ExperienceRead,
    ProjectRead,
)


class ContentService:
    """Builds the whole-site payload and a version that changes only when content does."""

    def __init__(self, session: Session) -> None:
        self._projects = ProjectRepository(session)
        self._experience = ExperienceRepository(session)
        self._certificates = CertificateRepository(session)
        self._articles = ArticleRepository(session)

    def payload(self) -> ContentPayload:
        sections = {
            "projects": [ProjectRead.model_validate(row) for row in self._projects.all()],
            "experience": [ExperienceRead.model_validate(row) for row in self._experience.all()],
            "certificates": [
                CertificateRead.model_validate(row) for row in self._certificates.all()
            ],
            "articles": [ArticleRead.model_validate(row) for row in self._articles.all()],
        }
        canonical = json.dumps(
            {
                name: [item.model_dump(mode="json", by_alias=True) for item in items]
                for name, items in sections.items()
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        version = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]
        return ContentPayload(version=version, **sections)
```

- [ ] **Step 6: Write `app/schemas/auth.py`**

```python
from pydantic import Field

from app.schemas.base import ApiModel


class LoginRequest(ApiModel):
    password: str = Field(min_length=1, max_length=200)


class TokenResponse(ApiModel):
    access_token: str
    expires_in: int
```

- [ ] **Step 7: Write `app/api/deps.py`**

Create empty `app/api/__init__.py` and `app/api/v1/__init__.py`.

```python
from functools import lru_cache

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import LoginThrottle, PasswordVerifier, TokenService
from app.db.session import get_session
from app.services.auth import AuthService
from app.services.content import ContentService

bearer = HTTPBearer(auto_error=False)


def get_content_service(session: Session = Depends(get_session)) -> ContentService:
    return ContentService(session)


@lru_cache
def get_auth_service() -> AuthService:
    """One instance per process, so the login throttle remembers across requests."""
    settings = get_settings()
    return AuthService(
        PasswordVerifier(settings.admin_password_hash),
        TokenService(settings.jwt_secret, settings.jwt_ttl_minutes),
        LoginThrottle(),
    )


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    auth: AuthService = Depends(get_auth_service),
) -> None:
    if credentials is None or not auth.is_authorised(credentials.credentials):
        raise HTTPException(
            401,
            "Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
```

- [ ] **Step 8: Write `app/api/v1/content.py`**

```python
from fastapi import APIRouter, Depends, Request, Response

from app.api.deps import get_content_service
from app.schemas.content import ContentPayload
from app.services.content import ContentService

router = APIRouter(tags=["content"])


@router.get("/content", response_model=ContentPayload)
def read_content(
    request: Request,
    response: Response,
    service: ContentService = Depends(get_content_service),
):
    payload = service.payload()
    etag = f'"{payload.version}"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "no-cache"
    return payload
```

- [ ] **Step 9: Write `app/api/v1/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.deps import get_auth_service
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.auth import AuthService, InvalidCredentials, TooManyAttempts

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    request: Request,
    auth: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    client_key = request.client.host if request.client else "unknown"
    try:
        token, ttl_seconds = auth.login(body.password, client_key)
    except TooManyAttempts:
        raise HTTPException(429, "Too many attempts. Try again in a few minutes.") from None
    except InvalidCredentials:
        raise HTTPException(401, "Wrong password") from None
    return TokenResponse(access_token=token, expires_in=ttl_seconds)
```

- [ ] **Step 10: Write `app/api/v1/router.py`**

```python
from fastapi import APIRouter

from app.api.v1 import auth, content

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(content.router)
api_router.include_router(auth.router)
```

- [ ] **Step 11: Include the router in `app/main.py`**

Replace the whole file:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    settings.assert_safe()

    app = FastAPI(title="Portfolio API", version="2.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "If-None-Match"],
        expose_headers=["ETag"],
    )

    @app.get("/healthz", tags=["health"])
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api_router)
    return app


app = create_app()
```

- [ ] **Step 12: Run the tests**

Run: `uv run pytest -q`
Expected: `53 passed`.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: serve the content payload with ETag revalidation and add admin login"
```

---

### Task 6: CRUD router factory for all four resources

**Files:**
- Create: `app/api/crud.py`, `tests/test_crud_api.py`
- Modify: `app/api/v1/router.py` (replace whole file)

**Interfaces:**
- Consumes: `Repository` and the four repositories (Task 3), read/write schemas (Task 3), `require_admin` and `get_session` (Tasks 2 and 5), fixtures `client`, `admin_headers`, `session` (Task 5), factories (Task 3).
- Produces: `build_crud_router(*, path, tag, repository, read_schema, write_schema, conflict_message="Already exists") -> APIRouter`; routes `GET|POST /api/v1/{projects,experience,certificates,articles}` and `PUT|DELETE /api/v1/<resource>/{entity_id}`.

- [ ] **Step 1: Write the failing tests**

`tests/test_crud_api.py`:

```python
import pytest

from tests.factories import experience_body, project_body

CERTIFICATE = {"title": "CCNA 1", "issuer": "Cisco", "issuedLabel": "2023", "sortOrder": 10}
ARTICLE = {
    "title": "A post",
    "publication": "Medium",
    "topic": "Engineering",
    "summary": "About a thing.",
    "url": "https://medium.com/post",
    "sortOrder": 10,
}


def test_list_is_public_and_starts_empty(client):
    response = client.get("/api/v1/projects")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/api/v1/projects"),
        ("put", "/api/v1/projects/1"),
        ("delete", "/api/v1/projects/1"),
        ("post", "/api/v1/experience"),
        ("post", "/api/v1/certificates"),
        ("post", "/api/v1/articles"),
    ],
)
def test_writes_require_a_token(client, method, path):
    kwargs = {} if method == "delete" else {"json": project_body()}

    response = getattr(client, method)(path, **kwargs)

    assert response.status_code == 401


def test_a_bad_token_is_rejected(client):
    response = client.post(
        "/api/v1/projects",
        json=project_body(),
        headers={"Authorization": "Bearer nope"},
    )

    assert response.status_code == 401


def test_create_then_list_a_project(client, admin_headers):
    created = client.post("/api/v1/projects", json=project_body(), headers=admin_headers)

    assert created.status_code == 201
    body = created.json()
    assert body["id"] > 0
    assert body["repoVisibility"] == "public"
    assert client.get("/api/v1/projects").json() == [body]


def test_duplicate_slug_is_409(client, admin_headers):
    client.post("/api/v1/projects", json=project_body(), headers=admin_headers)

    again = client.post("/api/v1/projects", json=project_body(), headers=admin_headers)

    assert again.status_code == 409
    assert again.json() == {"detail": "A project with this slug already exists"}
    assert len(client.get("/api/v1/projects").json()) == 1


def test_invalid_body_is_422(client, admin_headers):
    response = client.post(
        "/api/v1/projects",
        json=project_body(status="shipped"),
        headers=admin_headers,
    )

    assert response.status_code == 422


def test_update_replaces_the_project(client, admin_headers):
    created = client.post("/api/v1/projects", json=project_body(), headers=admin_headers).json()

    updated = client.put(
        f"/api/v1/projects/{created['id']}",
        json=project_body(title="Renamed", flow=[], featured=True),
        headers=admin_headers,
    )

    assert updated.status_code == 200
    assert updated.json()["title"] == "Renamed"
    assert updated.json()["flow"] == []
    assert updated.json()["featured"] is True


def test_update_of_a_missing_project_is_404(client, admin_headers):
    response = client.put("/api/v1/projects/999", json=project_body(), headers=admin_headers)

    assert response.status_code == 404


def test_delete_removes_the_project(client, admin_headers):
    created = client.post("/api/v1/projects", json=project_body(), headers=admin_headers).json()

    deleted = client.delete(f"/api/v1/projects/{created['id']}", headers=admin_headers)

    assert deleted.status_code == 204
    assert client.get("/api/v1/projects").json() == []
    assert client.delete(f"/api/v1/projects/{created['id']}", headers=admin_headers).status_code == 404


def test_experience_lists_newest_first(client, admin_headers):
    client.post(
        "/api/v1/experience",
        json=experience_body(role="Old", startDate="2024-07-01", endDate="2024-09-01"),
        headers=admin_headers,
    )
    client.post(
        "/api/v1/experience",
        json=experience_body(role="New", startDate="2026-07-01", endDate=None),
        headers=admin_headers,
    )

    roles = [item["role"] for item in client.get("/api/v1/experience").json()]

    assert roles == ["New", "Old"]


@pytest.mark.parametrize(
    ("path", "body"),
    [("/api/v1/certificates", CERTIFICATE), ("/api/v1/articles", ARTICLE)],
)
def test_certificates_and_articles_round_trip(client, admin_headers, path, body):
    created = client.post(path, json=body, headers=admin_headers)

    assert created.status_code == 201
    assert client.get(path).json() == [{"id": created.json()["id"], **body}]


def test_writes_show_up_in_the_content_payload(client, admin_headers):
    client.post("/api/v1/projects", json=project_body(slug="aptum"), headers=admin_headers)

    content = client.get("/api/v1/content").json()

    assert [p["slug"] for p in content["projects"]] == ["aptum"]
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `uv run pytest tests/test_crud_api.py -q`
Expected: failures with `404 Not Found` on `/api/v1/projects` (the routes do not exist yet).

- [ ] **Step 3: Write `app/api/crud.py`**

No `from __future__ import annotations` in this file: `body: write_schema` must hold the real class when FastAPI inspects the function.

```python
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_session
from app.repositories.base import Repository
from app.schemas.base import ApiModel


def build_crud_router(
    *,
    path: str,
    tag: str,
    repository: type[Repository[Any]],
    read_schema: type[ApiModel],
    write_schema: type[ApiModel],
    conflict_message: str = "Already exists",
) -> APIRouter:
    """List is public. Create, replace and delete need the admin token."""
    router = APIRouter(prefix=path, tags=[tag])
    admin_only = [Depends(require_admin)]

    def get_repository(session: Session = Depends(get_session)) -> Repository[Any]:
        return repository(session)

    def get_entity(
        entity_id: int,
        repo: Repository[Any] = Depends(get_repository),
    ) -> Any:
        entity = repo.get(entity_id)
        if entity is None:
            raise HTTPException(404, "Not found")
        return entity

    @router.get("", response_model=list[read_schema])
    def list_items(repo: Repository[Any] = Depends(get_repository)) -> Any:
        return repo.all()

    @router.post("", response_model=read_schema, status_code=201, dependencies=admin_only)
    def create_item(
        body: write_schema,
        repo: Repository[Any] = Depends(get_repository),
    ) -> Any:
        try:
            return repo.add(body.model_dump())
        except IntegrityError:
            repo.session.rollback()
            raise HTTPException(409, conflict_message) from None

    @router.put("/{entity_id}", response_model=read_schema, dependencies=admin_only)
    def replace_item(
        body: write_schema,
        entity: Any = Depends(get_entity),
        repo: Repository[Any] = Depends(get_repository),
    ) -> Any:
        try:
            return repo.update(entity, body.model_dump())
        except IntegrityError:
            repo.session.rollback()
            raise HTTPException(409, conflict_message) from None

    @router.delete("/{entity_id}", status_code=204, dependencies=admin_only)
    def delete_item(
        entity: Any = Depends(get_entity),
        repo: Repository[Any] = Depends(get_repository),
    ) -> None:
        repo.delete(entity)

    return router
```

- [ ] **Step 4: Replace `app/api/v1/router.py`**

```python
from fastapi import APIRouter

from app.api.crud import build_crud_router
from app.api.v1 import auth, content
from app.repositories.content import (
    ArticleRepository,
    CertificateRepository,
    ExperienceRepository,
    ProjectRepository,
)
from app.schemas.content import (
    ArticleRead,
    ArticleWrite,
    CertificateRead,
    CertificateWrite,
    ExperienceRead,
    ExperienceWrite,
    ProjectRead,
    ProjectWrite,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(content.router)
api_router.include_router(auth.router)
api_router.include_router(
    build_crud_router(
        path="/projects",
        tag="projects",
        repository=ProjectRepository,
        read_schema=ProjectRead,
        write_schema=ProjectWrite,
        conflict_message="A project with this slug already exists",
    )
)
api_router.include_router(
    build_crud_router(
        path="/experience",
        tag="experience",
        repository=ExperienceRepository,
        read_schema=ExperienceRead,
        write_schema=ExperienceWrite,
    )
)
api_router.include_router(
    build_crud_router(
        path="/certificates",
        tag="certificates",
        repository=CertificateRepository,
        read_schema=CertificateRead,
        write_schema=CertificateWrite,
    )
)
api_router.include_router(
    build_crud_router(
        path="/articles",
        tag="articles",
        repository=ArticleRepository,
        read_schema=ArticleRead,
        write_schema=ArticleWrite,
    )
)
```

- [ ] **Step 5: Run the tests**

Run: `uv run pytest -q`
Expected: `72 passed`.

If `test_writes_require_a_token` returns `422` for a route, the auth dependency ran after body validation. Confirm `dependencies=admin_only` sits on the route decorator, as written above.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add one CRUD router factory and wire it to all four resources"
```

---

### Task 7: Seed content, SeedService and the CLI

**Files:**
- Create: `seeds/content.json`, `app/services/seed.py`, `app/cli.py`, `tests/test_seed.py`

**Interfaces:**
- Consumes: `SeedContent` and repositories (Task 3), `SessionLocal` (Task 2), `PasswordVerifier.hash` (Task 4), `get_settings` (Task 1).
- Produces: `SeedService(session)` with `seed_if_empty(path: Path) -> dict[str, int]` (rows inserted per table); `python -m app.cli seed`; `python -m app.cli hash-password`.

- [ ] **Step 1: Write `seeds/content.json`**

Copy this file exactly. The text comes from each project's README, the old `projects.json` and the owner's LinkedIn. Do not reword it.

```json
{
  "projects": [
    {
      "slug": "aptum",
      "title": "Aptum",
      "tagline": "Skill-based marketplace prototype where the best puzzle score wins the item.",
      "description": "Entrants pay a small fee to join a capacity-capped queue. Once the queue fills, they play the same deterministic puzzle round and the top score wins the item. I built the prototype to prove the money path first: the platform charges nobody unless the queue fills, chance plays no part in the result, and every movement of funds balances. The sandbox runs on test payments, with no real money.",
      "highlights": [
        "Redis Lua admits entrants atomically, so a queue cannot exceed its capacity",
        "PostgreSQL triggers enforce a double-entry, append-only ledger",
        "Seeded puzzle generation, commit-reveal and server-side scoring make each round replayable"
      ],
      "tech": ["Python 3.12", "FastAPI", "SQLAlchemy 2.0", "PostgreSQL", "Redis", "WebSockets", "React", "TypeScript"],
      "flow": ["list item", "queue fills", "capture payments", "play round", "score", "ship", "release escrow"],
      "links": [
        { "kind": "live", "label": "Open sandbox", "url": "https://sandbox-aptum.com/practice" }
      ],
      "status": "prototype",
      "category": "platform",
      "repoVisibility": "private",
      "featured": true,
      "sortOrder": 10
    },
    {
      "slug": "crypto-quant-platform",
      "title": "Crypto Quant Platform",
      "tagline": "Backtesting and walk-forward validation, built to tell you when a strategy does not work.",
      "description": "A self-hosted platform for testing crypto strategies and running the ones that survive. It backtests with vectorbt, validates walk-forward with a purge gap, simulates paper trading with an order book, fees and slippage, and executes live on Kraken with position reconciliation. An MCP server lets an AI agent run the research loop in plain English.",
      "highlights": [
        "Deflated Sharpe scores the luckiest of 200 zero-edge strategies at 43.7% and rejects it; a conventional test accepts it at 99.5%",
        "18 reference strategies ship as plug-ins; a new one subclasses Strategy",
        "The MCP server is paper-only: no tool can place a real order"
      ],
      "tech": ["Python 3.10", "vectorbt", "Flask", "WebSockets", "MCP", "Docker"],
      "flow": ["backtest", "walk-forward", "deflated Sharpe", "paper trade", "reconcile"],
      "links": [
        { "kind": "repo", "label": "Source", "url": "https://github.com/FETKlOkAn2/crypto-quant-platform" }
      ],
      "status": "released",
      "category": "platform",
      "repoVisibility": "public",
      "featured": false,
      "sortOrder": 20
    },
    {
      "slug": "book-pipeline",
      "title": "Book Pipeline",
      "tagline": "A team of small agents that drafts, critiques and fact-checks a novel section by section.",
      "description": "You create a book from a title, premise, genre and tone. The pipeline seeds an outline, then for each section it writes a draft, critiques it, revises where the critic objects, and extracts the new facts into a per-book canon that later sections read from. Generation runs as background jobs behind a FastAPI service with a Next.js app on top.",
      "highlights": [
        "Each section carries a contract: must establish, may assume, forbidden",
        "The writer agent queries the canon over MCP on demand",
        "Haiku drafts, Sonnet critiques, Opus proposes; a cost report estimates the run before and prints a receipt after"
      ],
      "tech": ["Python 3.13", "FastAPI", "SQLAlchemy", "Alembic", "Next.js 15", "TypeScript", "Claude API", "MCP"],
      "flow": ["outline", "draft", "critique", "revise", "extract canon", "coherence pass"],
      "links": [],
      "status": "prototype",
      "category": "agents",
      "repoVisibility": "private",
      "featured": false,
      "sortOrder": 30
    },
    {
      "slug": "betbrain",
      "title": "BetBrain",
      "tagline": "Football match intelligence pipeline that writes sourced match reports with model probabilities.",
      "description": "An MVP for five European competitions. The pipeline ingests news and data, extracts entities, scores each item for relevance, and runs a Dixon-Coles model for match probabilities. An LLM then writes the match report, and a citation validator sends the draft back for another attempt when a citation fails. The product surfaces analysis and probability estimates; the user decides.",
      "highlights": [
        "The pipeline runs end to end for five leagues; source credibility and outcome learning remain stubs",
        "Claude Haiku extracts entities at scale, Claude Sonnet writes the report",
        "78 tests, with full coverage on scoring, synthesis and API routes"
      ],
      "tech": ["Python 3.13", "FastAPI", "PostgreSQL", "TimescaleDB", "Redis", "Claude API"],
      "flow": ["ingest", "extract entities", "score relevance", "model probabilities", "synthesise", "validate citations", "detect value"],
      "links": [],
      "status": "in-progress",
      "category": "agents",
      "repoVisibility": "private",
      "featured": false,
      "sortOrder": 40
    },
    {
      "slug": "website-audit-agent",
      "title": "Website Audit Agent",
      "tagline": "Outreach engine that audits a business's website and writes the email from what it found.",
      "description": "The agent finds local businesses with weak websites through OpenStreetMap, qualifies them with free heuristics and a cheap model, and audits each site for conversion and design problems. A premium model writes an email that cites the findings. Grounding, tone and screenshot checks gate each email before it sends, and the agent watches the inbox for replies and posts them to Discord.",
      "highlights": [
        "Tiered Claude models control cost: a cheap model qualifies leads, the premium model writes",
        "About 40 modules and 450+ unit tests that run offline",
        "Three GitHub Actions workflows schedule the runs"
      ],
      "tech": ["Python 3.11", "Claude API", "OpenStreetMap Overpass", "PageSpeed API", "SMTP / IMAP", "GitHub Actions"],
      "flow": ["discover", "qualify", "audit", "write", "quality gates", "send", "monitor replies"],
      "links": [
        { "kind": "repo", "label": "Source", "url": "https://github.com/FETKlOkAn2/WebsiteAuditAgent" }
      ],
      "status": "released",
      "category": "agents",
      "repoVisibility": "public",
      "featured": false,
      "sortOrder": 50
    },
    {
      "slug": "image-analyzer",
      "title": "Image Analyzer",
      "tagline": "Filters, deduplicates and clusters product images before they reach a catalogue.",
      "description": "For each part number the pipeline downloads up to 20 candidate images, drops watermarked ones with OCR and alpha-channel checks, groups near-duplicates by perceptual hash, and ranks the survivors by structural similarity and background whiteness. The top five go to the catalogue. It grew out of contract work for a U.S. company on a catalogue of more than 100,000 product images.",
      "highlights": [
        "pHash fingerprints, clustered with DBSCAN on Hamming distance",
        "SSIM ranking and a white-background check pick the top five per part"
      ],
      "tech": ["Python", "OpenCV", "scikit-image", "scikit-learn", "imagehash", "Tesseract OCR", "AWS S3"],
      "flow": ["download", "watermark check", "pHash", "DBSCAN cluster", "SSIM rank", "top 5"],
      "links": [
        { "kind": "repo", "label": "Source", "url": "https://github.com/FETKlOkAn2/Image-Analyzer" }
      ],
      "status": "prototype",
      "category": "data",
      "repoVisibility": "public",
      "featured": false,
      "sortOrder": 60
    },
    {
      "slug": "face-recognition-app",
      "title": "Face Recognition App",
      "tagline": "React app that detects and outlines faces in an image.",
      "description": "The app sends an image to the Clarifai API and draws a box around each face it returns. Users register and sign in, and the app counts each user's submissions. Final project of the Zero To Mastery full-stack course.",
      "highlights": [],
      "tech": ["React", "Clarifai API", "REST API", "CSS"],
      "flow": [],
      "links": [
        { "kind": "repo", "label": "Source", "url": "https://github.com/FETKlOkAn2/face-recognition-brain" }
      ],
      "status": "archived",
      "category": "web",
      "repoVisibility": "public",
      "featured": false,
      "sortOrder": 70
    }
  ],
  "experience": [
    {
      "role": "Software Engineer",
      "company": "Iron Mountain",
      "employmentType": "Full-time",
      "location": "Bratislava, Slovakia · Remote",
      "startDate": "2026-07-01",
      "endDate": null,
      "summary": "",
      "skills": []
    },
    {
      "role": "Python Developer",
      "company": "Veach Solutions",
      "employmentType": "Contract",
      "location": "Texas, United States · Remote",
      "startDate": "2025-09-01",
      "endDate": "2026-01-01",
      "summary": "Designed and implemented a computer vision pipeline for automated image similarity detection and quality control across 100,000+ product images.",
      "skills": ["Python", "Computer vision", "Perceptual hashing"]
    },
    {
      "role": "RITR Project Participant",
      "company": "Unicorn",
      "employmentType": "Internship",
      "location": "Slovakia · Remote",
      "startDate": "2024-12-01",
      "endDate": "2025-03-01",
      "summary": "Worked on a cryptocurrency trading bot web application as part of a collaborative development environment.",
      "skills": ["APIs", "System design"]
    },
    {
      "role": "Tester",
      "company": "WABCO",
      "employmentType": null,
      "location": null,
      "startDate": "2024-07-01",
      "endDate": "2024-09-01",
      "summary": "Worked in an Agile team ensuring reliability of internal systems. Designed and executed test cases, reported defects, and joined sprint reviews.",
      "skills": []
    }
  ],
  "certificates": [
    { "title": "Python Developer Certificate", "issuer": "Zero To Mastery", "issuedLabel": "Sep 2025", "sortOrder": 10 },
    { "title": "Full Stack Developer Certificate", "issuer": "Zero To Mastery", "issuedLabel": "Aug 2025", "sortOrder": 20 },
    { "title": "Cisco Certified Network Associate (CCNA 3)", "issuer": "Cisco", "issuedLabel": "2025", "sortOrder": 30 },
    { "title": "Cisco Certified Network Associate (CCNA 2)", "issuer": "Cisco", "issuedLabel": "2025", "sortOrder": 40 },
    { "title": "Data Analytics Certificate", "issuer": "Codecademy", "issuedLabel": "2025", "sortOrder": 50 },
    { "title": "Cisco Certified Network Associate (CCNA 1)", "issuer": "Cisco", "issuedLabel": "2023", "sortOrder": 60 }
  ],
  "articles": [
    {
      "title": "From Spreadsheets to Insights: A Real-World Data Science Journey",
      "publication": "Medium",
      "topic": "Data Science",
      "summary": "How I modernised reporting workflows, automated insight generation and turned messy spreadsheet data into decisions.",
      "url": "https://medium.com/@tomas.maxim33/from-spreadsheets-to-insights-a-real-world-data-science-journey-b381bca3cced",
      "sortOrder": 10
    },
    {
      "title": "How I Built My First Crypto Trading Bot (and What I Learned)",
      "publication": "Medium",
      "topic": "Engineering",
      "summary": "An end-to-end breakdown of a Python crypto bot, from market data pipelines to risk controls.",
      "url": "https://medium.com/@tomas.maxim33/how-i-built-my-first-crypto-trading-bot-and-what-i-learned-fd95f368f1d7",
      "sortOrder": 20
    }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

`tests/test_seed.py`:

```python
import json
from pathlib import Path

from app.repositories.content import CertificateRepository, ProjectRepository
from app.services.seed import SeedService

SEED_FILE = Path("seeds/content.json")


def test_seed_fills_every_empty_table(session):
    inserted = SeedService(session).seed_if_empty(SEED_FILE)

    assert inserted == {"projects": 7, "experience": 4, "certificates": 6, "articles": 2}


def test_seed_is_idempotent(session):
    service = SeedService(session)
    service.seed_if_empty(SEED_FILE)

    second = service.seed_if_empty(SEED_FILE)

    assert second == {"projects": 0, "experience": 0, "certificates": 0, "articles": 0}
    assert ProjectRepository(session).count() == 7


def test_seed_skips_a_table_that_already_has_rows(session):
    CertificateRepository(session).add({"title": "Mine", "issuer": "Me", "issued_label": "2026"})

    inserted = SeedService(session).seed_if_empty(SEED_FILE)

    assert inserted["certificates"] == 0
    assert inserted["projects"] == 7
    assert [c.title for c in CertificateRepository(session).all()] == ["Mine"]


def test_seeded_projects_keep_their_display_order(session):
    SeedService(session).seed_if_empty(SEED_FILE)

    slugs = [project.slug for project in ProjectRepository(session).all()]

    assert slugs == [
        "aptum",
        "crypto-quant-platform",
        "book-pipeline",
        "betbrain",
        "website-audit-agent",
        "image-analyzer",
        "face-recognition-app",
    ]


def test_only_aptum_is_featured_and_it_links_to_the_sandbox(session):
    SeedService(session).seed_if_empty(SEED_FILE)

    featured = [p for p in ProjectRepository(session).all() if p.featured]

    assert [p.slug for p in featured] == ["aptum"]
    assert featured[0].links[0]["url"] == "https://sandbox-aptum.com/practice"


def test_private_projects_carry_no_repo_link(session):
    SeedService(session).seed_if_empty(SEED_FILE)

    for project in ProjectRepository(session).all():
        if project.repo_visibility == "private":
            assert all(link["kind"] != "repo" for link in project.links), project.slug


def test_seed_copy_contains_no_em_dashes():
    text = SEED_FILE.read_text(encoding="utf-8")

    assert "\u2014" not in text
    assert json.loads(text)["projects"][0]["slug"] == "aptum"
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `uv run pytest tests/test_seed.py -q`
Expected: `ModuleNotFoundError: No module named 'app.services.seed'`.

- [ ] **Step 4: Write `app/services/seed.py`**

```python
from pathlib import Path

from sqlalchemy.orm import Session

from app.repositories.content import (
    ArticleRepository,
    CertificateRepository,
    ExperienceRepository,
    ProjectRepository,
)
from app.schemas.content import SeedContent


class SeedService:
    """Loads bootstrap content into tables that are still empty. Safe to run on every boot."""

    def __init__(self, session: Session) -> None:
        self._targets = (
            ("projects", ProjectRepository(session)),
            ("experience", ExperienceRepository(session)),
            ("certificates", CertificateRepository(session)),
            ("articles", ArticleRepository(session)),
        )

    def seed_if_empty(self, path: Path) -> dict[str, int]:
        content = SeedContent.model_validate_json(path.read_text(encoding="utf-8"))
        inserted: dict[str, int] = {}
        for name, repository in self._targets:
            if repository.count() > 0:
                inserted[name] = 0
                continue
            items = getattr(content, name)
            for item in items:
                repository.add(item.model_dump())
            inserted[name] = len(items)
        return inserted
```

- [ ] **Step 5: Write `app/cli.py`**

```python
import argparse
import getpass
from pathlib import Path

from app.core.config import get_settings
from app.core.security import PasswordVerifier
from app.db.session import SessionLocal
from app.services.seed import SeedService


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("seed", help="Insert seed content into tables that are empty")
    commands.add_parser("hash-password", help="Print an argon2 hash for ADMIN_PASSWORD_HASH")
    args = parser.parse_args(argv)

    if args.command == "seed":
        with SessionLocal() as session:
            inserted = SeedService(session).seed_if_empty(Path(get_settings().seed_file))
        for table, count in inserted.items():
            print(f"seed: {table} +{count}")
        return 0

    print(PasswordVerifier.hash(getpass.getpass("Admin password: ")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 6: Run the tests**

Run: `uv run pytest -q`
Expected: `79 passed`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add seed content for seven projects and a seed/hash-password CLI"
```

---

### Task 8: Alembic migration and a local end-to-end run

**Files:**
- Create: `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, `alembic/versions/<rev>_initial_schema.py` (all generated, then edited)

**Interfaces:**
- Consumes: `Base.metadata`, the models, `get_settings`.
- Produces: `uv run alembic upgrade head` creates the four tables on any database `DATABASE_URL` points at; a local server on port 8000 that Plan B reads.

- [ ] **Step 1: Generate the Alembic scaffold**

```bash
uv run alembic init alembic
```

Expected: creates `alembic.ini` and the `alembic/` directory.

- [ ] **Step 2: Point `alembic/env.py` at the app**

In `alembic/env.py`, find the line `target_metadata = None` and replace that one line with:

```python
import app.models  # noqa: E402,F401  registers the tables on Base.metadata
from app.core.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402

config.set_main_option("sqlalchemy.url", get_settings().database_url.replace("%", "%%"))
target_metadata = Base.metadata
```

Leave the rest of the file as generated. `alembic.ini` already contains `prepend_sys_path = .`, which lets `env.py` import `app`.

- [ ] **Step 3: Autogenerate the first migration**

```bash
rm -f portfolio.db
uv run alembic revision --autogenerate -m "initial schema"
```

Expected: output lists `Detected added table 'articles'`, `'certificates'`, `'experience'`, `'projects'` and the indexes, and writes one file under `alembic/versions/`.

Open that file. Confirm `upgrade()` has four `op.create_table(...)` calls and `downgrade()` drops the same four. If it imports nothing but `sqlalchemy as sa` and `op`, it is portable to Postgres as is.

- [ ] **Step 4: Apply it and seed**

```bash
uv run alembic upgrade head
uv run python -m app.cli seed
```

Expected seed output:

```
seed: projects +7
seed: experience +4
seed: certificates +6
seed: articles +2
```

Run `uv run python -m app.cli seed` a second time. Expected: all four lines end in `+0`.

- [ ] **Step 5: Run the server and check the three public routes**

```bash
uv run uvicorn app.main:app --port 8000 &
SERVER_PID=$!
curl -s --retry 10 --retry-connrefused --retry-delay 1 http://localhost:8000/healthz
curl -s http://localhost:8000/api/v1/content | uv run python -c "import json,sys; d=json.load(sys.stdin); print(d['version'], [len(d[k]) for k in ('projects','experience','certificates','articles')])"
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/v1/projects -H 'Content-Type: application/json' -d '{}'
kill $SERVER_PID
```

Expected, in order: `{"status":"ok"}`, then a 16-character version followed by `[7, 4, 6, 2]`, then `401`.

- [ ] **Step 6: Run the whole suite and commit**

Run: `uv run pytest -q`
Expected: `79 passed`.

```bash
git add -A
git commit -m "feat: add Alembic with the initial schema migration"
```

---

### Task 9: Deploy config, CI, README, and the owner's rollout checklist

**Files:**
- Create: `render.yaml`, `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a branch that is ready for the owner to merge and deploy.

- [ ] **Step 1: Write `render.yaml`**

```yaml
services:
  - type: web
    name: portfolio-backend
    runtime: python
    plan: free
    buildCommand: pip install uv && uv sync --frozen --no-dev
    startCommand: .venv/bin/alembic upgrade head && .venv/bin/python -m app.cli seed && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'
    healthCheckPath: /healthz
    envVars:
      - key: PYTHON_VERSION
        value: 3.13.7
      - key: ENVIRONMENT
        value: production
      - key: CORS_ORIGINS
        value: https://fetklokan2.github.io
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: ADMIN_PASSWORD_HASH
        sync: false
```

- [ ] **Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v6
      - run: uv sync --frozen
      - run: uv run pytest -q
```

- [ ] **Step 3: Write `README.md`**

````markdown
# portfolio_backend

Content API for [fetklokan2.github.io/portfolio](https://fetklokan2.github.io/portfolio/).
FastAPI, SQLAlchemy 2, Alembic, Postgres. The site bundles a snapshot of
`GET /api/v1/content` and revalidates against this API in the background, so
the page never waits on it.

## Run it

```bash
uv sync
uv run alembic upgrade head
uv run python -m app.cli seed
uv run uvicorn app.main:app --reload --port 8000
```

Interactive docs: http://localhost:8000/docs. Local runs use SQLite and need no `.env`.

## Layout

| Path | Role |
|---|---|
| `app/models` | SQLAlchemy models: `Project`, `Experience`, `Certificate`, `Article` |
| `app/repositories` | `Repository[ModelT]` generic base and four subclasses |
| `app/services` | `ContentService`, `AuthService`, `SeedService` |
| `app/api/crud.py` | One router factory that serves all four resources |
| `app/core/security.py` | `PasswordVerifier`, `TokenService`, `LoginThrottle` |
| `seeds/content.json` | Bootstrap content, loaded into empty tables on start |

## API

| Method | Path | Auth |
|---|---|---|
| GET | `/healthz` | none |
| GET | `/api/v1/content` | none. Sends `ETag`, honours `If-None-Match` |
| POST | `/api/v1/auth/login` | none. `{password}` returns `{accessToken, expiresIn}` |
| GET | `/api/v1/projects`, `/experience`, `/certificates`, `/articles` | none |
| POST, PUT, DELETE | the same four | `Authorization: Bearer <token>` |

## Test

```bash
uv run pytest
```

Tests use SQLite in memory and touch no network.

## Deploy

Render runs `render.yaml`. Set `DATABASE_URL` (Neon Postgres), `JWT_SECRET` and
`ADMIN_PASSWORD_HASH` in the dashboard. Create the hash with
`uv run python -m app.cli hash-password`.
````

- [ ] **Step 4: Run the suite one last time and commit**

Run: `uv run pytest -q`
Expected: `79 passed`.

```bash
git add -A
git commit -m "docs: add Render config, CI workflow and README"
```

- [ ] **Step 5: Stop and hand the rollout to the owner**

Do not run any of the following. Print this checklist to the owner and wait.

1. **Token.** Open GitHub → Settings → Developer settings → Personal access tokens. Confirm the token that commit `3f861e0` exposed is gone or revoke it. This repo no longer uses any GitHub token.
2. **Database.** Create a free Postgres project at neon.tech. Copy its connection string.
3. **Admin password.** Run `uv run python -m app.cli hash-password` in this repo, type a password, copy the printed hash.
4. **Render environment.** On the `portfolio-backend` service set `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET` (output of `python -c "import secrets; print(secrets.token_urlsafe(48))"`), `ENVIRONMENT=production`, `CORS_ORIGINS=https://fetklokan2.github.io`, `PYTHON_VERSION=3.13.7`. Delete `GITHUB_TOKEN` and `FORM_PASSWORD`.
5. **Render commands.** Set the build and start commands to the two lines in `render.yaml`. Set the health check path to `/healthz`.
6. **Merge.** Push `rebuild/fastapi`, open a pull request, merge to `main`. Render deploys.
7. **Verify.** `curl https://portfolio-backend-y1jy.onrender.com/healthz` returns `{"status":"ok"}`. `curl https://portfolio-backend-y1jy.onrender.com/api/v1/content` returns seven projects.

The old site's Add Project form stops working at step 6. Plan C removes that form.
