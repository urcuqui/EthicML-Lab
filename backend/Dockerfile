FROM python:3.13-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY lab ./lab
RUN mkdir /data
EXPOSE 8000
CMD ["uvicorn", "lab.api:app", "--host", "0.0.0.0", "--port", "8000"]
