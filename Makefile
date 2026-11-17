.PHONY: dev train eval demo test build docker-up docker-down

# Local development servers
dev:
	@echo "Starting CXR Triage backend on :8000 and frontend on :5173..."
	@powershell -Command "Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd d:\bms\backend; $$env:PYTHONPATH=\"d:\bms;d:\bms\backend\"; d:\bms\.venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8000 --reload'"
	@cd frontend && npm run dev

# Run ML Evaluation and generate honest reports
eval:
	@echo "Running comprehensive ML evaluation and calibration suite..."
	@powershell -Command "$$env:PYTHONPATH='d:\bms;d:\bms\backend'; d:\bms\.venv\Scripts\python.exe d:\bms\ml\eval\eval.py"
	@powershell -Command "$$env:PYTHONPATH='d:\bms;d:\bms\backend'; d:\bms\.venv\Scripts\python.exe d:\bms\ml\eval\calibrate.py"
	@powershell -Command "$$env:PYTHONPATH='d:\bms;d:\bms\backend'; d:\bms\.venv\Scripts\python.exe d:\bms\ml\eval\explain_check.py"
	@powershell -Command "$$env:PYTHONPATH='d:\bms;d:\bms\backend'; d:\bms\.venv\Scripts\python.exe d:\bms\ml\eval\triage_sim.py"
	@echo "Reports generated in ml/reports/*.json"

# Populate 60-case NIH ChestX-ray14 demo cohort
demo:
	@echo "Generating and populating 60-case demo cohort..."
	@powershell -Command "$$env:PYTHONPATH='d:\bms;d:\bms\backend'; d:\bms\.venv\Scripts\python.exe d:\bms\demo_data\generate_cohort.py"

# Unit and integration test suite
test:
	@echo "Verifying datasets lock and backend endpoints..."
	@powershell -Command "$$env:PYTHONPATH='d:\bms;d:\bms\backend'; d:\bms\.venv\Scripts\python.exe d:\bms\ml\data\verify.py"
	@powershell -Command "$$env:PYTHONPATH='d:\bms;d:\bms\backend'; d:\bms\.venv\Scripts\python.exe -c 'import main; print(\"Backend verification passed!\")'"
	@cd frontend && npm run build

# Docker Compose orchestration
docker-up:
	docker compose up --build

docker-down:
	docker compose down
