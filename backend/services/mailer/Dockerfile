FROM python:3.11-alpine3.21
WORKDIR /app
COPY requirements.txt .
RUN apk add --no-cache gcc musl-dev libpq-dev && \
    apk upgrade --no-cache && \
    pip install --no-cache-dir -r requirements.txt && \
    apk del gcc musl-dev libpq-dev
COPY . .
CMD ["python", "main.py"]
