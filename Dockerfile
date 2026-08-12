FROM python:3.11-slim

# Install system dependencies required by PySide6 (Qt) in a headless environment
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libxkbcommon0 \
    libegl1 \
    libfontconfig1 \
    libdbus-1-3 \
    libxcb-cursor0 \
    libxcb-icccm4 \
    libxcb-image0 \
    libxcb-keysyms1 \
    libxcb-randr0 \
    libxcb-render-util0 \
    libxcb-shape0 \
    libxcb-xfixes0 \
    libx11-xcb1 \
    libgssapi-krb5-2 \
    libnss3 \
    libnspr4 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Set up work directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . .

# Environment variables for headless Qt execution
ENV QT_QPA_PLATFORM=offscreen
ENV PYTHONPATH=/app

# Expose the server port (Render will override this, but standard is 5174 or $PORT)
EXPOSE 5174

# Command to start the headless server
CMD ["python", "server.py"]
