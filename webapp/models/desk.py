from sqlalchemy import Column, String, Integer, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from ..db import Base

class Desk(Base):
    __tablename__ = "desks"

    # Identification
    desk_id = Column(String, primary_key=True, index=True)  # e.g., "cd:fb:1a:53:fb:e6"
    name = Column(String)
    manufacturer = Column(String)

    # State
    position_mm = Column(Integer)
    speed_mms = Column(Integer)
    status = Column(String)
    isPositionLost = Column(Boolean)
    isOverloadProtectionUp = Column(Boolean)
    isOverloadProtectionDown = Column(Boolean)
    isAntiCollision = Column(Boolean)

    # Usage
    activationsCounter = Column(Integer)
    sitStandCounter = Column(Integer)

    # Errors
    last_errors = Column(JSON)  # store the list of errors as JSON

    # User status
    user_status = Column(String)  # "active" / "inactive"
