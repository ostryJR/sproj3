from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Use a user-local directory for the DB to avoid git changes
def get_default_db_path():
	local_app_data = os.getenv('LOCALAPPDATA')
	if local_app_data:
		db_dir = os.path.join(local_app_data, 'sproj3')
	else:
		db_dir = os.path.join(os.path.expanduser('~'), '.sproj3')
	os.makedirs(db_dir, exist_ok=True)
	return os.path.join(db_dir, 'users.db')

DB_PATH = get_default_db_path()

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
