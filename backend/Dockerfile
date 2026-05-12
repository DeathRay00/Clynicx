FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for building python packages (like CrewAI dependencies)
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 3001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]
