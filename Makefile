.PHONY: help dev-up dev-down dev-logs dev-build dev-fork dev-fork-down dev-fork-logs dev-fork-build clean-env build test

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Local Development (Mock Oracle):"
	@echo "  dev-up      Start docker-compose with contracts deployment"
	@echo "  dev-down    Stop and remove volumes"
	@echo "  dev-logs    Follow container logs"
	@echo "  dev-build   Build docker-compose images"
	@echo ""
	@echo "Fork Mode (Real Mainnet Pragma Oracle):"
	@echo "  dev-fork       Start forked mainnet devnet"
	@echo "  dev-fork-down  Stop forked devnet"
	@echo "  dev-fork-logs  Follow forked devnet logs"
	@echo "  dev-fork-build Build forked devnet images"
	@echo ""
	@echo "Build & Test:"
	@echo "  build       Build contracts"
	@echo "  test        Run tests"
	@echo "  clean-env   Reset environment variables"

# =============================================================================
# Docker Development (Local with Mock Oracle)
# =============================================================================

dev-up:
	docker-compose up -d

dev-down:
	docker-compose down -v

dev-logs:
	docker-compose logs -f

dev-build:
	docker-compose build

# =============================================================================
# Docker Development (Fork Mode with Real Pragma Oracle)
# =============================================================================

dev-fork:
	@echo "Starting forked mainnet devnet with real Pragma TWAP oracle..."
	@echo "Fork source: Starknet Mainnet"
	@echo "Pragma TWAP: 0x49eefafae944d07744d07cc72a5bf14728a6fb463c3eae5bca13552f5d455fd"
	@echo ""
	docker-compose -f docker-compose.fork.yml up -d
	@echo ""
	@echo "Forked devnet is starting. Use 'make dev-fork-logs' to view deployment progress."
	@echo "RPC URL: http://localhost:5050"

dev-fork-down:
	docker-compose -f docker-compose.fork.yml down -v

dev-fork-logs:
	docker-compose -f docker-compose.fork.yml logs -f

dev-fork-build:
	docker-compose -f docker-compose.fork.yml build

# =============================================================================
# Build & Test
# =============================================================================

build:
	cd contracts && scarb build

test:
	cd contracts && snforge test

# =============================================================================
# Environment
# =============================================================================

clean-env:
	./deploy/scripts/reset-env.sh .env.devnet
	./deploy/scripts/reset-env.sh .env.fork 2>/dev/null || true
