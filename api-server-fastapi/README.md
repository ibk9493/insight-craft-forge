
# SWE-QA FastAPI Backend

This is a FastAPI backend for the SWE-QA annotation system, using SQLAlchemy for database operations.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in this directory with the following content:
```
DATABASE_URL=sqlite:///./swe_qa.db
API_KEY=your_api_key_here
```

## Running the server

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at http://localhost:8000/api/

## API Documentation

FastAPI automatically generates interactive API documentation. Visit:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Database

This application uses SQLAlchemy with an SQLite database by default. To use a different database, change the DATABASE_URL in the .env file.

## API Key Authentication

Most endpoints require an API key for authentication. Set this in the .env file and provide it in requests using the X-API-Key header.
