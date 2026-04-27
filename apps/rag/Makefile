.PHONY: install install-venv dev build lint format clean

VENV_DIR := .venv
PYTHON := $(VENV_DIR)/bin/python
PIP := $(VENV_DIR)/bin/pip
UVICORN := $(VENV_DIR)/bin/uvicorn

# ─── 虚拟环境安装（推荐）──────────────────────────────────────────────────────

## 创建虚拟环境并安装依赖（首次使用运行此命令）
install-venv:
	python3 -m venv $(VENV_DIR)
	$(PIP) install --upgrade pip
	$(PIP) install -e ".[dev]"
	@echo ""
	@echo "✅ 虚拟环境安装完成！"
	@echo "   激活命令: source $(VENV_DIR)/bin/activate"
	@echo "   启动服务: make dev"

## 在已激活的虚拟环境中安装依赖
install:
	pip install -e ".[dev]"

# ─── 开发服务器 ───────────────────────────────────────────────────────────────

## 启动开发服务器（需先激活虚拟环境，或使用 make dev-venv）
dev:
	uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

## 直接通过虚拟环境启动开发服务器（无需手动激活）
dev-venv:
	$(UVICORN) src.main:app --reload --host 0.0.0.0 --port 8000

# ─── 代码检查 ─────────────────────────────────────────────────────────────────

lint:
	$(VENV_DIR)/bin/ruff check src/

format:
	$(VENV_DIR)/bin/ruff format src/

# ─── 清理 ─────────────────────────────────────────────────────────────────────

clean:
	rm -rf $(VENV_DIR) __pycache__ src/__pycache__ dist *.egg-info
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
