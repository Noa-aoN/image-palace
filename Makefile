up:
	docker compose up

down:
	docker compose down

restart:
	docker compose down && docker compose up

reset:
	docker compose down -v && docker compose up --build

logs:
	docker compose logs -f

shell:
	docker compose exec web bash

migrate:
	docker compose exec web rails db:migrate

console:
	docker compose exec web rails c
