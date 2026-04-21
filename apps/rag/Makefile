.PHONY: install dev build lint

install:
	pip install -e ".[dev]"

dev:
	uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

lint:
	ruff check src/

format:
	ruff format src/
