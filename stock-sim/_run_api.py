"""Run the FastAPI server with SQLite JSONB patch applied."""
import os
os.environ["DATABASE_URL"] = "sqlite:///stocksim.db"

from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
SQLiteTypeCompiler.visit_JSONB = SQLiteTypeCompiler.visit_JSON

import uvicorn
from apps.api.main import create_app

app = create_app()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
