from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class BuiltinPromptSeed:
    slug: str
    name: str
    category_slug: str
    description: str
    user_prompt_text: str
    evaluation_notes: str | None
    tags: tuple[str, ...]
    system_prompt_text: str | None = None
    difficulty: int | None = None
    scenario_type: str | None = None
    objective: str | None = None
    context: str | None = None
    input_artifacts_jsonb: tuple[dict[str, Any], ...] = field(default_factory=tuple)
    constraints_jsonb: dict[str, Any] | list[Any] | None = None
    expected_behavior_jsonb: dict[str, Any] | list[Any] | None = None
    gold_facts_jsonb: dict[str, Any] | None = None
    judge_rubric_jsonb: dict[str, Any] | None = None
    estimated_input_tokens: int | None = None
    expected_output_format: str | None = None
    cost_tier: str | None = "low"
    weight: int | None = 1
    version: str | None = "1.0"
    test_cases_visible: tuple[dict, ...] | None = None
    test_cases_hidden: tuple[dict, ...] | None = None


def rubric(*keys: str) -> dict[str, Any]:
    weight = max(1, 100 // max(1, len(keys)))
    return {
        "criteria": [
            {"key": key, "label": key.replace("_", " ").title(), "weight": weight, "description": f"Evaluate {key.replace('_', ' ')}."}
            for key in keys
        ],
        "penalties": [
            {"key": "hallucination", "weight": -20, "description": "Penalize facts, files, or constraints not supported by the scenario."},
            {"key": "verbosity", "weight": -10, "description": "Penalize padded answers that do not add useful information."},
        ],
    }


COMMON_GOLD_FACTS: dict[str, list[str]] = {
    "must_include": [],
    "must_not_include": [],
    "acceptable_solutions": [],
    "common_failure_modes": [],
}


BUILTIN_PROMPT_SEEDS: tuple[BuiltinPromptSeed, ...] = (
    BuiltinPromptSeed(
        slug="fastapi-offer-skills-debug",
        name="FastAPI offer creation loses linked skills",
        category_slug="code_debug",
        description="Debug a realistic FastAPI/SQLAlchemy offer creation flow where many-to-many skills are silently dropped.",
        system_prompt_text="You are a senior backend engineer reviewing a production bug. Be precise, minimal, and test-driven.",
        scenario_type="code_debug",
        objective="Diagnose the root cause, propose the smallest safe patch, and specify two tests that would fail before the fix and pass after it.",
        context=(
            "A recruiting SaaS exposes POST /offers. The endpoint returns 201 and creates the offer row, "
            "but selected skills never appear on the offer detail page. The team suspects serialization, "
            "but the API logs show the request payload includes skill_ids."
        ),
        input_artifacts_jsonb=(
            {
                "name": "app/features/offers/router.py",
                "kind": "code",
                "language": "python",
                "content": """from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.features.offers.repository import OfferRepository
from app.features.offers.schemas import OfferCreate, OfferRead

router = APIRouter(prefix="/offers", tags=["offers"])


@router.post("", response_model=OfferRead, status_code=status.HTTP_201_CREATED)
def create_offer(payload: OfferCreate, db: Session = Depends(get_db)) -> OfferRead:
    repository = OfferRepository(db)
    company = repository.get_company(payload.company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")

    offer = repository.create_offer(
        title=payload.title,
        description=payload.description,
        company_id=payload.company_id,
        seniority=payload.seniority,
        remote_policy=payload.remote_policy,
    )
    db.commit()
    db.refresh(offer)
    return offer
""",
            },
            {
                "name": "app/features/offers/repository.py",
                "kind": "code",
                "language": "python",
                "content": """from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.features.companies.models import Company
from app.features.offers.models import Offer
from app.features.skills.models import Skill


class OfferRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_company(self, company_id: int) -> Company | None:
        return self.db.get(Company, company_id)

    def get_skills_by_ids(self, skill_ids: list[int]) -> list[Skill]:
        if not skill_ids:
            return []
        result = self.db.execute(select(Skill).where(Skill.id.in_(skill_ids)))
        return list(result.scalars().all())

    def create_offer(
        self,
        *,
        title: str,
        description: str,
        company_id: int,
        seniority: str,
        remote_policy: str,
    ) -> Offer:
        offer = Offer(
            title=title,
            description=description,
            company_id=company_id,
            seniority=seniority,
            remote_policy=remote_policy,
        )
        self.db.add(offer)
        return offer

    def get_offer(self, offer_id: int) -> Offer | None:
        result = self.db.execute(
            select(Offer)
            .options(selectinload(Offer.skills))
            .where(Offer.id == offer_id)
        )
        return result.scalar_one_or_none()
""",
            },
            {
                "name": "app/features/offers/models.py",
                "kind": "code",
                "language": "python",
                "content": """from sqlalchemy import Column, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

offer_skill = Table(
    "offer_skill",
    Base.metadata,
    Column("offer_id", ForeignKey("offer.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", ForeignKey("skill.id", ondelete="RESTRICT"), primary_key=True),
)


class Offer(Base):
    __tablename__ = "offer"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("company.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    seniority: Mapped[str] = mapped_column(String(40), nullable=False)
    remote_policy: Mapped[str] = mapped_column(String(40), nullable=False)

    skills = relationship("Skill", secondary=offer_skill, lazy="selectin")
""",
            },
            {
                "name": "app/features/offers/schemas.py",
                "kind": "code",
                "language": "python",
                "content": """from pydantic import BaseModel, Field


class SkillRead(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class OfferCreate(BaseModel):
    company_id: int
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=20)
    seniority: str
    remote_policy: str
    skill_ids: list[int] = Field(default_factory=list)


class OfferRead(BaseModel):
    id: int
    company_id: int
    title: str
    description: str
    seniority: str
    remote_policy: str
    skills: list[SkillRead] = []

    model_config = {"from_attributes": True}
""",
            },
            {
                "name": "app/features/skills/models.py",
                "kind": "code",
                "language": "python",
                "content": """from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Skill(Base):
    __tablename__ = "skill"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
""",
            },
            {
                "name": "tests/test_offers_api.py",
                "kind": "code",
                "language": "python",
                "content": """def test_create_offer_returns_selected_skills(client, company, python_skill, fastapi_skill):
    payload = {
        "company_id": company.id,
        "title": "Backend Engineer",
        "description": "Build APIs and maintain integrations for the platform.",
        "seniority": "senior",
        "remote_policy": "hybrid",
        "skill_ids": [python_skill.id, fastapi_skill.id],
    }

    response = client.post("/offers", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert {skill["id"] for skill in body["skills"]} == {python_skill.id, fastapi_skill.id}


def test_create_offer_allows_empty_skills(client, company):
    payload = {
        "company_id": company.id,
        "title": "Delivery Manager",
        "description": "Coordinate delivery rituals and project reporting.",
        "seniority": "lead",
        "remote_policy": "remote",
        "skill_ids": [],
    }

    response = client.post("/offers", json=payload)

    assert response.status_code == 201
    assert response.json()["skills"] == []
""",
            },
            {
                "name": "tests/conftest.py",
                "kind": "code",
                "language": "python",
                "content": """@pytest.fixture
def python_skill(db):
    skill = Skill(name="Python")
    db.add(skill)
    db.commit()
    return skill


@pytest.fixture
def fastapi_skill(db):
    skill = Skill(name="FastAPI")
    db.add(skill)
    db.commit()
    return skill
""",
            },
            {
                "name": "alembic/versions/20260214_0912_offer_skill.py",
                "kind": "code",
                "language": "python",
                "content": """def upgrade() -> None:
    op.create_table(
        "offer_skill",
        sa.Column("offer_id", sa.Integer(), nullable=False),
        sa.Column("skill_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["offer_id"], ["offer.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["skill_id"], ["skill.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("offer_id", "skill_id"),
    )
""",
            },
            {
                "name": "production.log",
                "kind": "document",
                "content": """2026-04-27T09:14:03Z INFO request_id=7fb POST /offers status=201 payload.skill_ids=[3,5]
2026-04-27T09:14:03Z INFO request_id=7fb sql="insert into offer ..."
2026-04-27T09:14:03Z INFO request_id=7fb response.skills=[]
2026-04-27T09:15:21Z INFO request_id=812 GET /offers/418 response.skills=[]
""",
            },
            {
                "name": "bug-ticket.md",
                "kind": "document",
                "content": """Users can select skills in the offer form. The frontend sends skill_ids correctly.
The created offer appears in the list, but the detail page shows no skills.
Do not change the API contract unless strictly required; mobile clients already use it.
""",
            },
        ),
        constraints_jsonb=[
            "Do not rewrite the architecture or introduce a service layer.",
            "Do not add dependencies.",
            "Preserve the POST /offers request and response schemas.",
            "Handle empty skill_ids without failing.",
            "Mention how to handle unknown skill ids.",
            "Keep the answer under 500 words.",
        ],
        gold_facts_jsonb={
            **COMMON_GOLD_FACTS,
            "must_include": [
                "router ignores payload.skill_ids",
                "repository has get_skills_by_ids but create_offer never uses it",
                "assign offer.skills before commit",
                "refresh or load offer with skills before returning",
                "test selected skills and empty skill_ids",
            ],
            "must_not_include": [
                "blame Pydantic serialization as the primary bug",
                "add a new dependency",
                "rewrite the database schema",
            ],
            "common_failure_modes": [
                "only changing OfferRead",
                "committing before assigning skills and not persisting association",
                "ignoring unknown skill ids",
            ],
        },
        judge_rubric_jsonb=rubric(
            "root_cause",
            "minimal_patch",
            "transaction_correctness",
            "test_coverage",
            "constraint_following",
        ),
        expected_output_format=(
            "Use four sections: Root cause, Patch, Tests, Risks. Include concise code snippets only where useful."
        ),
        user_prompt_text="Diagnose this bug and propose the minimal safe fix.",
        evaluation_notes="Strong answers use the existing repository method, preserve the API contract, and discuss unknown skill ids.",
        tags=("benchmark", "code", "fastapi", "sqlalchemy", "debug"),
        difficulty=5,
        estimated_input_tokens=1900,
        cost_tier="medium",
        weight=3,
        version="2.0",
    ),
    BuiltinPromptSeed(
        slug="consultant-skill-search-review",
        name="Consultant skill search PR review",
        category_slug="code_review",
        description="Review a realistic PR adding consultant search by skill, availability, and pagination.",
        system_prompt_text="Act as a pragmatic senior reviewer. Focus on defects, regressions, and missing tests.",
        scenario_type="code_review",
        objective="Produce a senior review with blocking, important, and improvement findings grounded in the diff.",
        context=(
            "A PR adds consultant search by skill for an internal staffing tool. The endpoint will be used by account managers during live client calls."
        ),
        input_artifacts_jsonb=(
            {
                "name": "pull_request.md",
                "kind": "document",
                "content": """Title: Add consultant search by skill
Notes from author:
- Search should support partial skill names.
- Availability filter is optional.
- Pagination added with limit/offset.
- I skipped DB indexes for now because the table is small in staging.
""",
            },
            {
                "name": "app/features/consultants/router.py",
                "kind": "code",
                "language": "python",
                "content": """@router.get("/consultants/search", response_model=list[ConsultantRead])
def search_consultants(
    skill: str | None = None,
    available_from: date | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    service = ConsultantSearchService(db)
    return service.search(skill=skill, available_from=available_from, limit=limit, offset=offset)
""",
            },
            {
                "name": "app/features/consultants/search_service.py",
                "kind": "code",
                "language": "python",
                "content": """class ConsultantSearchService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def search(self, *, skill: str | None, available_from: date | None, limit: int, offset: int):
        query = self.db.query(Consultant).join(Consultant.skills)
        if skill:
            query = query.filter(Skill.name.contains(skill))
        if available_from:
            query = query.filter(Consultant.available_from <= available_from)
        return query.offset(offset).limit(limit).all()
""",
            },
            {
                "name": "app/features/consultants/models.py",
                "kind": "code",
                "language": "python",
                "content": """class Consultant(Base):
    __tablename__ = "consultant"
    id = Column(Integer, primary_key=True)
    full_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="active")
    available_from = Column(Date, nullable=True)
    skills = relationship("Skill", secondary=consultant_skill)


class Skill(Base):
    __tablename__ = "skill"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
""",
            },
            {
                "name": "tests/test_consultant_search.py",
                "kind": "code",
                "language": "python",
                "content": """def test_search_by_skill_returns_matching_consultant(client, consultant_factory):
    consultant_factory(full_name="Alice", skills=["Python"])
    response = client.get("/consultants/search?skill=python")
    assert response.status_code == 200
    assert response.json()[0]["full_name"] == "Alice"
""",
            },
        ),
        constraints_jsonb=[
            "Findings must be grouped as Blocking, Important, Improvement.",
            "Only mention issues supported by the diff.",
            "Do not spend findings on pure style.",
            "Call out missing or weak tests precisely.",
            "Keep at most six findings.",
        ],
        gold_facts_jsonb={
            **COMMON_GOLD_FACTS,
            "must_include": [
                "case-sensitive contains may not match python vs Python depending database",
                "inner join drops consultants with no skills even when skill filter is absent",
                "limit and offset lack bounds",
                "duplicates possible when a consultant has multiple matching skills",
                "test does not cover case insensitivity, pagination bounds, availability, or no skill filter",
            ],
            "must_not_include": ["SQL injection through contains without evidence", "authentication missing as a diff finding"],
        },
        judge_rubric_jsonb=rubric(
            "issue_relevance",
            "severity_prioritization",
            "specificity",
            "test_awareness",
            "non_hallucination",
        ),
        expected_output_format="Markdown review with Blocking, Important, Improvement sections.",
        user_prompt_text="Review the PR as if you were leaving comments before merge.",
        evaluation_notes="Strong reviews catch join semantics, case normalization, duplicate rows, pagination bounds, and thin tests.",
        tags=("benchmark", "code-review", "backend", "sqlalchemy"),
        difficulty=5,
        estimated_input_tokens=1250,
        cost_tier="medium",
        weight=3,
        version="2.0",
    ),
    BuiltinPromptSeed(
        slug="extract-validate-persist-refactor",
        name="Invoice import refactor under compatibility constraints",
        category_slug="refactor_constrained",
        description="Refactor a service that mixes CSV parsing, validation, duplicate detection, and persistence.",
        system_prompt_text="Propose maintainable Python refactors without changing public behavior.",
        scenario_type="refactor_constrained",
        objective="Design a low-risk refactor that separates extraction, validation, and persistence while preserving the public API.",
        context=(
            "The import job runs nightly for enterprise customers. A recent bug fix is risky because all logic is packed into one method."
        ),
        input_artifacts_jsonb=(
            {
                "name": "app/features/invoices/service.py",
                "kind": "code",
                "language": "python",
                "content": """class InvoiceImportService:
    def __init__(self, repository, notifier, clock):
        self.repository = repository
        self.notifier = notifier
        self.clock = clock

    def import_rows(self, rows: list[dict[str, str]], *, dry_run: bool = False) -> ImportResult:
        imported = []
        errors = []
        seen_external_ids = set()
        for index, row in enumerate(rows, start=1):
            try:
                external_id = row["external_id"].strip()
                if not external_id:
                    raise ValueError("missing external_id")
                if external_id in seen_external_ids:
                    raise ValueError("duplicate external_id in file")
                seen_external_ids.add(external_id)
                amount = Decimal(row["amount"].replace(",", "."))
                if amount <= 0:
                    raise ValueError("amount must be positive")
                currency = row.get("currency", "EUR").strip().upper()
                if currency not in {"EUR", "USD", "GBP"}:
                    raise ValueError("unsupported currency")
                due_date = datetime.strptime(row["due_date"], "%Y-%m-%d").date()
                if due_date < self.clock.today():
                    raise ValueError("due_date is in the past")
                customer_email = row["customer_email"].strip().lower()
                if "@" not in customer_email:
                    raise ValueError("invalid email")
                invoice = Invoice(
                    external_id=external_id,
                    amount=amount,
                    currency=currency,
                    due_date=due_date,
                    customer_email=customer_email,
                )
                if self.repository.exists_external_id(external_id):
                    raise ValueError("external_id already imported")
                if not dry_run:
                    self.repository.save(invoice)
                    self.notifier.enqueue_invoice_imported(invoice)
                imported.append(invoice)
            except Exception as exc:
                errors.append(ImportError(row_number=index, message=str(exc), raw=row))
        return ImportResult(imported=imported, errors=errors)
""",
            },
            {
                "name": "app/features/invoices/models.py",
                "kind": "code",
                "language": "python",
                "content": """@dataclass
class Invoice:
    external_id: str
    amount: Decimal
    currency: str
    due_date: date
    customer_email: str


@dataclass
class ImportError:
    row_number: int
    message: str
    raw: dict[str, str]


@dataclass
class ImportResult:
    imported: list[Invoice]
    errors: list[ImportError]
""",
            },
            {
                "name": "tests/test_invoice_import.py",
                "kind": "code",
                "language": "python",
                "content": """def test_dry_run_validates_without_saving(repository, notifier, service):
    result = service.import_rows([valid_row("INV-1")], dry_run=True)
    assert len(result.imported) == 1
    assert repository.saved == []
    assert notifier.jobs == []


def test_duplicate_external_id_in_file_is_error(service):
    result = service.import_rows([valid_row("INV-1"), valid_row("INV-1")])
    assert result.errors[0].row_number == 2
""",
            },
            {
                "name": "architecture-note.md",
                "kind": "document",
                "content": """Keep InvoiceImportService.import_rows(rows, *, dry_run=False) as the public entry point.
No new dependency is allowed this quarter because the package is embedded in two customer deployments.
The team prefers small private helpers over a new framework.
""",
            },
        ),
        constraints_jsonb=[
            "Do not change the public import_rows signature.",
            "Do not change ImportResult or ImportError fields.",
            "Do not add dependencies.",
            "Preserve dry_run behavior exactly.",
            "Keep repository and notifier side effects in the same order for valid rows.",
        ],
        gold_facts_jsonb={
            **COMMON_GOLD_FACTS,
            "must_include": [
                "separate row parsing from validation",
                "extract duplicate detection",
                "keep side effects outside validation",
                "preserve partial success behavior",
                "add characterization tests before refactor",
            ],
            "must_not_include": ["change import_rows return type", "introduce pandas", "make import all-or-nothing"],
        },
        judge_rubric_jsonb=rubric(
            "architecture",
            "minimality",
            "backward_compatibility",
            "side_effect_safety",
            "clarity",
        ),
        expected_output_format="Refactor plan, helper/function sketch, and regression test list.",
        user_prompt_text="Propose a refactor plan and show the key shape of the resulting code.",
        evaluation_notes="Reward candidates that preserve public behavior and identify characterization tests.",
        tags=("benchmark", "refactor", "python", "service-design"),
        difficulty=5,
        estimated_input_tokens=1550,
        cost_tier="medium",
        weight=3,
        version="2.0",
    ),
    BuiltinPromptSeed(
        slug="rate-limiter-debug",
        name="Distributed rate limiter boundary bug",
        category_slug="code_debug",
        description="Debug a rolling-window rate limiter with out-of-order events and Redis persistence.",
        system_prompt_text="Focus on correctness, race conditions, and edge cases before style.",
        scenario_type="code_debug",
        objective="Identify the correctness bug, explain a failing case, and propose a minimal algorithmic fix.",
        context=(
            "The API should allow at most 3 accepted requests per user in any 10-second window. "
            "Requests can be replayed from a queue after network failures, so timestamps may arrive out of order."
        ),
        input_artifacts_jsonb=(
            {
                "name": "app/rate_limit/limiter.py",
                "kind": "code",
                "language": "python",
                "content": """class RollingWindowLimiter:
    def __init__(self, store, limit: int = 3, window_seconds: int = 10):
        self.store = store
        self.limit = limit
        self.window_seconds = window_seconds

    def allow(self, user_id: str, timestamp: int) -> bool:
        key = f"rl:{user_id}"
        events = [
            item for item in self.store.get_list(key)
            if item > timestamp - self.window_seconds
        ]
        allowed = len(events) < self.limit
        if allowed:
            events.append(timestamp)
        self.store.set_list(key, events, ttl=self.window_seconds)
        return allowed
""",
            },
            {
                "name": "app/rate_limit/store.py",
                "kind": "code",
                "language": "python",
                "content": """class InMemoryStore:
    def __init__(self):
        self.data = {}

    def get_list(self, key):
        return list(self.data.get(key, []))

    def set_list(self, key, values, ttl):
        self.data[key] = list(values)
""",
            },
            {
                "name": "tests/test_limiter.py",
                "kind": "code",
                "language": "python",
                "content": """def test_allows_three_in_window():
    limiter = RollingWindowLimiter(InMemoryStore())
    assert limiter.allow("u1", 100)
    assert limiter.allow("u1", 101)
    assert limiter.allow("u1", 102)
    assert not limiter.allow("u1", 103)


def test_boundary_after_window():
    limiter = RollingWindowLimiter(InMemoryStore())
    assert limiter.allow("u1", 100)
    assert limiter.allow("u1", 101)
    assert limiter.allow("u1", 102)
    assert limiter.allow("u1", 110)
""",
            },
            {
                "name": "incident.md",
                "kind": "document",
                "content": """Incident: a user got 5 accepted requests between t=100 and t=109.
Replay order observed in logs: 107, 108, 109, then delayed events 100, 101.
The implementation was originally tested only with monotonic timestamps.
""",
            },
        ),
        constraints_jsonb=[
            "Use only Python standard library concepts in the patch sketch.",
            "Do not switch to fixed windows.",
            "State whether the window is inclusive or half-open.",
            "Include one failing test for out-of-order timestamps.",
            "Mention concurrency risk if relevant, but do not over-engineer the answer.",
        ],
        gold_facts_jsonb={
            **COMMON_GOLD_FACTS,
            "must_include": [
                "current pruning keeps future events for delayed timestamps",
                "algorithm checks only count before current timestamp, not every affected window",
                "out-of-order replay can accept too many events in one real window",
                "store sorted accepted timestamps",
                "test delayed events after later accepted events",
            ],
            "must_not_include": ["fixed window as equivalent solution", "ignore replay order"],
        },
        judge_rubric_jsonb=rubric(
            "correctness",
            "counterexample_quality",
            "algorithmic_fix",
            "test_relevance",
            "constraint_following",
        ),
        expected_output_format="Diagnosis, concrete failing sequence, corrected algorithm, and one test.",
        user_prompt_text="Debug the limiter and propose the smallest robust fix.",
        evaluation_notes="Strong answers reason about any 10-second window, not only [timestamp-window, timestamp].",
        tags=("benchmark", "code", "algorithm", "debug"),
        difficulty=5,
        estimated_input_tokens=1150,
        cost_tier="medium",
        weight=3,
        version="2.0",
    ),
    BuiltinPromptSeed(
        slug="client-delay-email",
        name="Client email after integration delay",
        category_slug="professional_writing",
        description="Draft a client email using an internal timeline, risk notes, and delivery options.",
        system_prompt_text="Write professionally. Be transparent without exposing unnecessary internal blame.",
        scenario_type="professional_writing",
        objective="Draft a client-ready email explaining a delivery delay and proposing a realistic next step.",
        context="A B2B implementation project slipped after a connector issue appeared during final integration testing.",
        input_artifacts_jsonb=(
            {
                "name": "internal-timeline.md",
                "kind": "document",
                "content": """Mon Apr 20: connector tests green against sandbox fixture.
Wed Apr 22: client provided production-like export with optional tax columns.
Thu Apr 23: import job failed on 18% of rows because the vendor changed column order when optional fields are present.
Fri Apr 24: engineering built a parser fix and is validating against the full export.
Current realistic plan: send validated import report Tuesday morning; deploy Tuesday afternoon if no new anomaly appears.
""",
            },
            {
                "name": "account-manager-notes.md",
                "kind": "document",
                "content": """Client sponsor is worried because their internal steering committee is Wednesday.
Do not mention that QA missed the optional tax-column case.
Do not promise Tuesday deployment as guaranteed.
Offer either a short Monday status call or a written validation report.
Tone should be direct, calm, and accountable.
""",
            },
        ),
        constraints_jsonb=[
            "Do not blame QA, the vendor, or the client.",
            "Do not promise a guaranteed Tuesday deployment.",
            "Mention the concrete next validation step.",
            "Offer one useful client action or meeting.",
            "Keep under 220 words.",
        ],
        gold_facts_jsonb={
            **COMMON_GOLD_FACTS,
            "must_include": [
                "delay caused by production-like export integration issue",
                "parser fix is being validated",
                "Tuesday is a target not a guarantee",
                "offer status call or validation report",
            ],
            "must_not_include": ["QA missed it", "vendor caused the delay", "guaranteed Tuesday deploy"],
        },
        judge_rubric_jsonb=rubric(
            "tone",
            "transparency",
            "risk_control",
            "actionability",
            "constraint_following",
        ),
        expected_output_format="One client email with subject line and body, under 220 words.",
        user_prompt_text="Write the email.",
        evaluation_notes="Reward specific next actions and controlled wording. Penalize vague apologies or overpromising.",
        tags=("benchmark", "writing", "client", "delivery"),
        difficulty=4,
        estimated_input_tokens=650,
        cost_tier="low",
        weight=2,
        version="2.0",
    ),
    BuiltinPromptSeed(
        slug="unhappy-ai-tool-client-response",
        name="Risk-aware response to unhappy AI tool client",
        category_slug="professional_writing",
        description="Respond to a client complaint about inconsistent AI results using support history and legal constraints.",
        system_prompt_text="Be empathetic, precise, and careful with liability.",
        scenario_type="professional_writing",
        objective="Write a professional response that acknowledges the issue and proposes an analysis plan without admitting legal fault.",
        context="A client says an AI matching tool gives inconsistent consultant rankings and wants a refund discussion.",
        input_artifacts_jsonb=(
            {
                "name": "client-email.txt",
                "kind": "document",
                "content": """We ran the same CV against the same offer three times and got different top matches.
This makes the tool hard to trust. We presented the pilot internally and now look exposed.
Before we discuss renewal, we need a serious explanation and a plan.
""",
            },
            {
                "name": "support-notes.md",
                "kind": "document",
                "content": """Known facts:
- Temperature was set to 0.7 in the pilot environment.
- Ranking prompt was updated Friday but cache invalidation was delayed.
- No evidence of data loss.
- Legal says: acknowledge impact, do not say breach, defect, negligence, or guaranteed accuracy.
""",
            },
            {
                "name": "proposed-analysis-plan.md",
                "kind": "document",
                "content": """1. Re-run the three submitted examples with deterministic settings.
2. Compare prompt versions and cache state.
3. Send variance report with recommended configuration changes.
4. Schedule a 30-minute review with sponsor and project lead.
""",
            },
        ),
        constraints_jsonb=[
            "Acknowledge the business impact.",
            "Do not admit breach, negligence, or guaranteed accuracy.",
            "Mention the deterministic rerun and variance report.",
            "Do not blame the client.",
            "Under 200 words.",
        ],
        gold_facts_jsonb={
            **COMMON_GOLD_FACTS,
            "must_include": ["deterministic rerun", "prompt/cache comparison", "variance report", "review meeting"],
            "must_not_include": ["breach", "negligence", "guaranteed accuracy", "client misuse"],
        },
        judge_rubric_jsonb=rubric(
            "empathy",
            "professionalism",
            "risk_control",
            "specificity",
            "actionability",
        ),
        expected_output_format="A reply email under 200 words.",
        user_prompt_text="Draft the response.",
        evaluation_notes="Strong answers are accountable without making legally risky admissions.",
        tags=("benchmark", "writing", "customer-success", "risk"),
        difficulty=4,
        estimated_input_tokens=750,
        cost_tier="low",
        weight=2,
        version="2.0",
    ),
    BuiltinPromptSeed(
        slug="contradictory-meeting-notes-synthesis",
        name="Contradictory steering committee synthesis",
        category_slug="document_synthesis",
        description="Synthesize conflicting meeting notes, chat follow-ups, and a decision log into a faithful action summary.",
        system_prompt_text="Stay faithful to the source documents. Do not resolve contradictions by guessing.",
        scenario_type="document_synthesis",
        objective="Produce confirmed decisions, contradictions, open questions, and next actions from inconsistent source notes.",
        context="Three teams left a steering committee with different understandings of MVP scope and launch date.",
        input_artifacts_jsonb=(
            {
                "name": "product-notes.md",
                "kind": "document",
                "content": """Product notes:
- MVP includes CSV import and manual review queue.
- Launch target: May 20 if data mapping is signed off by May 8.
- Lina owns import workflow.
- Matching score explanation can be a tooltip in v1.
""",
            },
            {
                "name": "sales-notes.md",
                "kind": "document",
                "content": """Sales notes:
- Client heard May 20 as committed date.
- They expect CSV import plus automated ranking export.
- Manual review queue was described as optional.
- Sponsor asked for a one-page risk summary before procurement call.
""",
            },
            {
                "name": "engineering-notes.md",
                "kind": "document",
                "content": """Engineering notes:
- CSV import feasible for May 20 only if vendor sample arrives this week.
- Automated ranking export is not estimated and should be v2.
- Manual review queue is required to handle low-confidence matches.
- Tooltip can be shipped, but detailed explanation report is not in v1.
""",
            },
            {
                "name": "decision-log.md",
                "kind": "document",
                "content": """Confirmed during call:
1. Lina owns CSV import spike.
2. Risk summary due Friday.
3. Final date will be reconfirmed after vendor sample validation.
Unresolved: whether ranking export is in MVP.
""",
            },
        ),
        constraints_jsonb=[
            "Do not invent a final launch commitment.",
            "Separate confirmed decisions from contradictions.",
            "Call out source names for contradictions.",
            "Include owners and due dates only when supported.",
            "Keep the synthesis concise but complete.",
        ],
        gold_facts_jsonb={
            **COMMON_GOLD_FACTS,
            "must_include": [
                "May 20 is conditional or disputed, not confirmed",
                "ranking export is unresolved or v2 per engineering",
                "Lina owns CSV import spike",
                "risk summary due Friday",
                "manual review queue disagreement",
            ],
            "must_not_include": ["May 20 committed unconditionally", "ranking export confirmed in MVP"],
        },
        judge_rubric_jsonb=rubric(
            "faithfulness",
            "contradiction_handling",
            "source_grounding",
            "structure",
            "actionability",
        ),
        expected_output_format="Four sections: Confirmed decisions, Contradictions, Open questions, Next actions.",
        user_prompt_text="Synthesize the notes for the project lead.",
        evaluation_notes="Reward explicit source-grounded contradictions and no invented commitments.",
        tags=("benchmark", "synthesis", "meetings", "project"),
        difficulty=5,
        estimated_input_tokens=1050,
        cost_tier="medium",
        weight=3,
        version="2.0",
    ),
    BuiltinPromptSeed(
        slug="messy-chat-action-extraction",
        name="Messy Slack action extraction with uncertainty",
        category_slug="document_synthesis",
        description="Extract action items from a noisy team thread with ambiguous ownership and conditional deadlines.",
        system_prompt_text="Extract only actions supported by the conversation. Preserve uncertainty.",
        scenario_type="document_synthesis",
        objective="Extract actions with owner, deadline, evidence, and confidence.",
        context="A cross-functional team is preparing a client steering committee and needs a clean action list from a messy thread.",
        input_artifacts_jsonb=(
            {
                "name": "slack-thread.txt",
                "kind": "document",
                "content": """09:02 Mia: We need the steering deck before Friday or the sponsor review slips.
09:04 Noah: I can take a first pass, but I need the latest metrics from Finance.
09:05 Lea: Finance said maybe EOD Wednesday. I can sanity check numbers if they arrive.
09:08 Omar: Who owns the risk slide? Last time it was missing.
09:10 Mia: Noah owns deck overall. Omar please draft risk slide by Thu noon?
09:12 Omar: yes for risks, but not the mitigation table.
09:14 Sam: I can do mitigation if someone sends me the incident list.
09:16 Mia: ok Sam mitigation table, dependent on incident list from me.
09:19 Noah: If Finance is late, I will leave metrics as TBD and flag it.
09:21 Lea: I will validate metrics Thursday morning if Finance sends them Wednesday.
""",
            },
            {
                "name": "team-context.md",
                "kind": "document",
                "content": """Known roles:
Mia = project lead
Noah = account manager
Lea = data analyst
Omar = delivery lead
Sam = solution architect
""",
            },
        ),
        constraints_jsonb=[
            "Return only supported actions.",
            "Use confidence high, medium, or low.",
            "Represent dependencies explicitly.",
            "Do not invent exact dates; use relative deadlines as written.",
            "Include evidence snippets.",
        ],
        gold_facts_jsonb={
            **COMMON_GOLD_FACTS,
            "must_include": [
                "Noah owns steering deck first pass",
                "Omar drafts risk slide by Thu noon",
                "Sam does mitigation table dependent on incident list from Mia",
                "Lea validates metrics Thursday morning if Finance sends them Wednesday",
            ],
            "must_not_include": ["Lea owns the deck", "Finance has already sent metrics"],
        },
        judge_rubric_jsonb=rubric(
            "information_extraction",
            "uncertainty_handling",
            "dependency_handling",
            "no_invention",
            "structure",
        ),
        expected_output_format="JSON array with action, owner, deadline, dependency, confidence, evidence.",
        user_prompt_text="Extract the action items.",
        evaluation_notes="Reward precise uncertainty and dependencies; penalize invented owners or dates.",
        tags=("benchmark", "extraction", "synthesis", "actions"),
        difficulty=4,
        estimated_input_tokens=850,
        cost_tier="low",
        weight=2,
        version="2.0",
    ),
    BuiltinPromptSeed(
        slug="invoice-csv-data-quality",
        name="Invoice CSV data quality triage",
        category_slug="data_quality",
        description="Find blocking and warning-level anomalies in a messy invoice export and propose validation rules.",
        system_prompt_text="Think like a data quality analyst. Separate evidence from assumptions.",
        scenario_type="data_quality",
        objective="Identify anomalies, classify severity, and propose practical validation rules.",
        context="Finance wants to import invoices from a legacy billing tool. Bad imports can trigger incorrect revenue reporting.",
        input_artifacts_jsonb=(
            {
                "name": "invoices.csv",
                "kind": "data",
                "content": """invoice_id,customer_id,customer_name,total,currency,issue_date,due_date,status,paid_at
INV-001,C-10,Acme,1200.00,EUR,2026-04-01,2026-04-30,paid,2026-04-12
INV-002,C-10,Acme,-50.00,EUR,2026-04-02,2026-05-02,open,
INV-002,C-11,Beta,300.00,USD,2026-04-03,2026-05-03,open,
INV-004,C-12,Gamma,299.00,EURO,2026/04/05,2026-05-05,open,
INV-005,C-13,Delta,0,EUR,2026-04-07,2026-04-01,paid,2026-04-08
INV-006,,Epsilon,450.50,GBP,2026-04-08,2026-05-08,cancelled,
INV-007,C-14,Zeta,100.00,EUR,2026-04-10,2026-05-10,paid,
INV-008,C-15,Eta,850.25,EUR,2026-04-11,2026-05-11,open,2026-04-13
INV-009,C-16,Theta,1,234.00,EUR,2026-04-12,2026-05-12,open,
""",
            },
            {
                "name": "business-rules.md",
                "kind": "document",
                "content": """Rules:
- invoice_id must be unique.
- total must be strictly positive.
- currency must be ISO 4217 code: EUR, USD, GBP are currently allowed.
- issue_date and due_date must be ISO date strings.
- due_date must be on or after issue_date.
- paid status requires paid_at; open and cancelled should not have paid_at.
- customer_id is mandatory for accounting reconciliation.
""",
            },
        ),
        constraints_jsonb=[
            "Distinguish blocking issues from alerts.",
            "Use row-level evidence.",
            "Do not silently correct data.",
            "Mention malformed CSV risk if applicable.",
            "Tie each validation rule to business impact.",
        ],
        gold_facts_jsonb={
            **COMMON_GOLD_FACTS,
            "must_include": [
                "duplicate INV-002",
                "negative total",
                "invalid currency EURO",
                "non-ISO date 2026/04/05",
                "due date before issue date",
                "paid without paid_at",
                "open with paid_at",
                "missing customer_id",
                "malformed amount with comma may break columns",
            ],
        },
        judge_rubric_jsonb=rubric(
            "anomaly_detection",
            "severity_classification",
            "rule_quality",
            "business_relevance",
            "evidence_quality",
        ),
        expected_output_format="Table with row, issue, severity, evidence, validation rule, business impact.",
        user_prompt_text="Analyze data quality and propose validation rules.",
        evaluation_notes="Reward comprehensive anomaly detection with exact evidence. Penalize generic validation advice.",
        tags=("benchmark", "data-quality", "csv", "finance"),
        difficulty=5,
        estimated_input_tokens=1000,
        cost_tier="medium",
        weight=3,
        version="2.0",
    ),
    BuiltinPromptSeed(
        slug="cv-offer-matching-mvp",
        name="AI CV-offer matching MVP roadmap",
        category_slug="product_reasoning",
        description="Scope an economical AI matching product using stakeholder notes, budget, and risk constraints.",
        system_prompt_text="Prioritize realistic product sequencing and operational risk.",
        scenario_type="product_reasoning",
        objective="Propose a v1/v2/v3 roadmap for an AI CV-offer matching product with limited budget and no labeled dataset.",
        context="A 70-person consulting firm wants to match consultants to client opportunities faster without custom model training upfront.",
        input_artifacts_jsonb=(
            {
                "name": "stakeholder-interviews.md",
                "kind": "document",
                "content": """Sales director: I need a shortlist in under 5 minutes during intake calls.
Staffing manager: CVs are inconsistent PDFs and old Word files. Skills are often outdated.
Consultants: We worry about being matched to irrelevant missions because keywords are ambiguous.
CEO: Budget is 40k for first release. We cannot hire ML engineers this quarter.
Legal: Explainability matters. Avoid fully automated staffing decisions.
""",
            },
            {
                "name": "current-process.md",
                "kind": "document",
                "content": """Current process:
1. Account manager receives client offer.
2. Staffing manager searches spreadsheet by skill tags.
3. Senior manager manually checks availability and domain fit.
4. Candidate shortlist is sent to sales.
Pain points: stale skill data, no audit trail, repeated manual reading of CVs.
""",
            },
            {
                "name": "constraints.md",
                "kind": "document",
                "content": """Constraints:
- No labeled historical match dataset.
- Existing CRM has consultant availability and seniority.
- CV files can be parsed in batch, but quality varies.
- Team can maintain rules and prompt templates.
- First release must run on hosted APIs and standard database/search tooling.
""",
            },
        ),
        constraints_jsonb=[
            "Do not propose custom model training in v1.",
            "Include explainability and human review.",
            "Separate v1, v2, and v3 clearly.",
            "Mention data quality and adoption risks.",
            "Keep the roadmap economical.",
        ],
        gold_facts_jsonb={
            **COMMON_GOLD_FACTS,
            "must_include": [
                "v1 retrieval or rules plus LLM summarization",
                "human review before shortlist decisions",
                "CV normalization or skill taxonomy",
                "feedback collection for later learning",
                "risks around stale skills and explainability",
            ],
            "must_not_include": ["train a custom model in v1", "fully automated staffing decision"],
        },
        judge_rubric_jsonb=rubric(
            "realism",
            "prioritization",
            "business_understanding",
            "risk_awareness",
            "technical_feasibility",
        ),
        expected_output_format="v1/v2/v3 roadmap with features, rationale, risks, and success metrics.",
        user_prompt_text="Propose the roadmap.",
        evaluation_notes="Reward pragmatic sequencing and risk controls; penalize expensive ML-first plans.",
        tags=("benchmark", "product", "ai", "roadmap"),
        difficulty=5,
        estimated_input_tokens=1000,
        cost_tier="medium",
        weight=3,
        version="2.0",
    ),
    BuiltinPromptSeed(
        slug="out-of-scope-request-response",
        name="Diplomatic out-of-scope escalation response",
        category_slug="sensitive_communication",
        description="Respond to a client pushing for urgent out-of-scope work using contract and delivery context.",
        system_prompt_text="Be diplomatic, firm, and commercially aware.",
        scenario_type="sensitive_communication",
        objective="Draft a response that refuses the weekend delivery as framed while preserving the relationship and offering alternatives.",
        context="A client asks for a weekend feature delivery outside signed scope two days before a steering committee.",
        input_artifacts_jsonb=(
            {
                "name": "client-message.txt",
                "kind": "document",
                "content": """Can you add the custom Excel export by Monday morning?
This should be simple since the data is already in the tool. We need it for the board pack.
Please confirm today that it will be included at no extra cost.
""",
            },
            {
                "name": "contract-excerpt.md",
                "kind": "document",
                "content": """Signed scope includes CSV export for candidate shortlists.
Custom Excel formatting, board-pack templates, and weekend support require a change request.
Change requests must include impact on timeline and cost before work starts.
""",
            },
            {
                "name": "delivery-context.md",
                "kind": "document",
                "content": """Team capacity is fully allocated this weekend to production migration.
A manual CSV-to-Excel workaround could be prepared by Monday noon.
A scoped change request could be estimated by Tuesday EOD.
""",
            },
        ),
        constraints_jsonb=[
            "Do not say bluntly impossible.",
            "Do not agree to free out-of-scope work.",
            "Offer a practical workaround and a change-request path.",
            "Avoid legalistic or hostile tone.",
            "Keep under 180 words.",
        ],
        gold_facts_jsonb={
            **COMMON_GOLD_FACTS,
            "must_include": ["outside signed scope", "manual workaround", "change request estimate", "capacity or migration constraint"],
            "must_not_include": ["we will include it at no extra cost", "impossible", "not our problem"],
        },
        judge_rubric_jsonb=rubric(
            "diplomacy",
            "assertiveness",
            "commercial_control",
            "clarity",
            "alternative_quality",
        ),
        expected_output_format="Short client message under 180 words.",
        user_prompt_text="Draft the response.",
        evaluation_notes="Reward firm scope control with useful alternatives.",
        tags=("benchmark", "sensitive", "client", "scope"),
        difficulty=4,
        estimated_input_tokens=700,
        cost_tier="low",
        weight=2,
        version="2.0",
    ),
    BuiltinPromptSeed(
        slug="b2b-ai-matching-naming",
        name="B2B AI matching naming with brand constraints",
        category_slug="creative_constrained",
        description="Generate professional product names from a positioning brief, competitor list, and forbidden cliches.",
        system_prompt_text="Be creative within constraints. Avoid generic startup naming.",
        scenario_type="creative_constrained",
        objective="Generate 10 credible B2B SaaS names with short rationales and risk notes.",
        context="The product helps staffing teams match consultants to project opportunities with explainable AI assistance.",
        input_artifacts_jsonb=(
            {
                "name": "positioning-brief.md",
                "kind": "document",
                "content": """Audience: consulting firms, staffing managers, sales directors.
Promise: faster shortlist creation with explainable fit signals.
Tone: professional, reliable, modern, not playful.
Avoid implying the system replaces human staffing judgment.
Preferred semantic territory: fit, alignment, signal, roster, capability, assignment.
""",
            },
            {
                "name": "forbidden-list.md",
                "kind": "document",
                "content": """Avoid:
MatchAI, TalentBot, StaffGPT, SkillSync, HireMind, Recruitly, Copilot anything,
names ending in -ify, -ly, -ster, or using obvious AI prefixes.
Avoid names that sound like job boards or automated hiring decisions.
""",
            },
            {
                "name": "competitor-notes.md",
                "kind": "document",
                "content": """Competitors use names around talent marketplaces, workforce clouds, and resource planning.
The client wants something more precise than generic HR branding.
Name should be usable in English and French sales conversations.
""",
            },
        ),
        constraints_jsonb=[
            "Return exactly 10 names.",
            "Each name must include a one-sentence rationale.",
            "Add one possible concern per name.",
            "Avoid the forbidden patterns.",
            "Professional B2B tone only.",
        ],
        gold_facts_jsonb={
            **COMMON_GOLD_FACTS,
            "must_include": ["10 names", "rationale", "concern"],
            "must_not_include": ["MatchAI", "TalentBot", "StaffGPT", "SkillSync", "HireMind", "Recruitly"],
        },
        judge_rubric_jsonb=rubric(
            "originality",
            "brand_fit",
            "constraint_following",
            "b2b_credibility",
            "clarity",
        ),
        expected_output_format="Numbered list of 10 names with Rationale and Concern for each.",
        user_prompt_text="Generate the names.",
        evaluation_notes="Reward names that are restrained, memorable, and not generic AI cliches.",
        tags=("benchmark", "creative", "naming", "b2b"),
        difficulty=4,
        estimated_input_tokens=750,
        cost_tier="low",
        weight=2,
        version="2.0",
    ),
    BuiltinPromptSeed(
        slug="code-gen-reverse-words",
        name="Reverse words in a sentence",
        category_slug="code_generation",
        description="Implement a function that reverses the word order of a sentence.",
        scenario_type="code_generation",
        objective="Complete the Python function stub so that it reverses the order of words in the input sentence.",
        user_prompt_text="""Complete the Python function below:

def reverse_words(sentence: str) -> str:
    \"\"\"Return the sentence with word order reversed.

    Example:
        >>> reverse_words("hello world")
        'world hello'
    \"\"\"
""",
        evaluation_notes="A correct solution splits on whitespace and reverses the word list.",
        tags=("benchmark", "code-generation", "strings"),
        difficulty=2,
        estimated_input_tokens=120,
        cost_tier="low",
        weight=1,
        version="1.0",
        test_cases_visible=(
            {"fn": "reverse_words", "args": ["hello world"], "kwargs": {}, "expected": "world hello"},
        ),
        test_cases_hidden=(
            {"fn": "reverse_words", "args": ["one two three"], "kwargs": {}, "expected": "three two one"},
            {"fn": "reverse_words", "args": ["single"], "kwargs": {}, "expected": "single"},
            {"fn": "reverse_words", "args": ["a b c d"], "kwargs": {}, "expected": "d c b a"},
        ),
    ),
    BuiltinPromptSeed(
        slug="code-gen-sum-even-numbers",
        name="Sum even numbers in a list",
        category_slug="code_generation",
        description="Implement a function that returns the sum of all even numbers in a list.",
        scenario_type="code_generation",
        objective="Complete the Python function stub so that it returns the sum of all even integers in the input list.",
        user_prompt_text="""Complete the Python function below:

def sum_even(numbers: list[int]) -> int:
    \"\"\"Return the sum of all even numbers in the list.

    Example:
        >>> sum_even([1, 2, 3, 4])
        6
    \"\"\"
""",
        evaluation_notes="A correct solution filters for even numbers (n % 2 == 0) and sums them.",
        tags=("benchmark", "code-generation", "lists", "math"),
        difficulty=2,
        estimated_input_tokens=120,
        cost_tier="low",
        weight=1,
        version="1.0",
        test_cases_visible=(
            {"fn": "sum_even", "args": [[1, 2, 3, 4]], "kwargs": {}, "expected": 6},
        ),
        test_cases_hidden=(
            {"fn": "sum_even", "args": [[]], "kwargs": {}, "expected": 0},
            {"fn": "sum_even", "args": [[1, 3, 5]], "kwargs": {}, "expected": 0},
            {"fn": "sum_even", "args": [[2, 4, 6]], "kwargs": {}, "expected": 12},
            {"fn": "sum_even", "args": [[-2, -1, 0, 1]], "kwargs": {}, "expected": -2},
        ),
    ),
    BuiltinPromptSeed(
        slug="code-gen-count-vowels",
        name="Count vowels in a string",
        category_slug="code_generation",
        description="Implement a function that counts the number of vowels in a string.",
        scenario_type="code_generation",
        objective="Complete the Python function stub so that it counts vowels (a, e, i, o, u) case-insensitively.",
        user_prompt_text="""Complete the Python function below:

def count_vowels(text: str) -> int:
    \"\"\"Return the number of vowel characters (a, e, i, o, u) in text.

    Case-insensitive.

    Example:
        >>> count_vowels("Hello")
        2
    \"\"\"
""",
        evaluation_notes="A correct solution checks each character against the set of vowels, case-insensitively.",
        tags=("benchmark", "code-generation", "strings"),
        difficulty=2,
        estimated_input_tokens=130,
        cost_tier="low",
        weight=1,
        version="1.0",
        test_cases_visible=(
            {"fn": "count_vowels", "args": ["Hello"], "kwargs": {}, "expected": 2},
        ),
        test_cases_hidden=(
            {"fn": "count_vowels", "args": [""], "kwargs": {}, "expected": 0},
            {"fn": "count_vowels", "args": ["rhythm"], "kwargs": {}, "expected": 0},
            {"fn": "count_vowels", "args": ["AEIOU"], "kwargs": {}, "expected": 5},
            {"fn": "count_vowels", "args": ["BenchForge"], "kwargs": {}, "expected": 3},
        ),
    ),
)
