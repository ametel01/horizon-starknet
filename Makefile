.PHONY: help dev-up dev-down dev-logs clean-env

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  dev-up     Start docker-compose with contracts deployment"
	@echo "  dev-down   Stop and remove volumes"
	@echo "  dev-logs   Follow container logs"
	@echo "  clean-env  Reset environment variables"
	@echo "  dev-build  Build docker-compose"

# =============================================================================
# Docker Development
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
# Environment
# =============================================================================

clean-env:
	./deploy/scripts/reset-env.sh
