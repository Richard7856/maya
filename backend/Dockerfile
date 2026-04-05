FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (cached layer, only rebuilds when requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Use uvicorn with multiple workers in production.
# In dev, the docker-compose.yml overrides this with --reload.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
