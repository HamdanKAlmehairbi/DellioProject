# Use the latest Python image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies including ffmpeg and python development files
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    python3-dev \
    build-essential \
    libavcodec-extra \
    libavformat-dev \
    libavutil-dev \
    libswscale-dev \
    libmagic1 \  
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy backend files into the container
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose the port FastAPI will run on
EXPOSE 8000

# Command to run the FastAPI app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
