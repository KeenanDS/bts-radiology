FROM python:3.9

WORKDIR /app

# Install FFmpeg (required for pydub)
RUN apt-get update && apt-get install -y ffmpeg

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"] 