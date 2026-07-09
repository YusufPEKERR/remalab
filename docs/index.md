# Welcome to RemaLab WMS Documentation

RemaLab Warehouse Management System (WMS) is a comprehensive solution for managing inventory, parts, locations, and movements.

## Architecture
The system consists of:
- **PySide6 Desktop Client**: For warehouse operators.
- **FastAPI API**: For integrations and remote access.
- **SQLAlchemy ORM**: For database interactions.

## Setup
Refer to the `requirements.txt` to install the necessary dependencies.

```bash
pip install -r requirements.txt
```

To run the API server:
```bash
uvicorn api.main:app --reload
```
