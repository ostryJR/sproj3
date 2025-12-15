# setup_db.py
from db import engine, Base
from models.desk import Desk  # import Desk model

def initialize_db():
    """
    Creates tables in SQLite without adding any data.
    """
    Base.metadata.create_all(bind=engine)
    print("Desk table created successfully.")
