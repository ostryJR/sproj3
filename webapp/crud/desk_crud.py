# webapp/crud/desk_crud.py
from sqlalchemy.orm import Session
from models.desk import Desk

def add_or_update_desk(db: Session, desk_id: str, desk_data: dict):
    """
    Inserts a new desk or updates an existing one in SQLite, excluding clock_s.
    """
    desk = Desk(
        desk_id=desk_id,
        name=desk_data["desk_data"]["config"]["name"],
        manufacturer=desk_data["desk_data"]["config"]["manufacturer"],
        position_mm=desk_data["desk_data"]["state"]["position_mm"],
        speed_mms=desk_data["desk_data"]["state"]["speed_mms"],
        status=desk_data["desk_data"]["state"]["status"],
        isPositionLost=desk_data["desk_data"]["state"]["isPositionLost"],
        isOverloadProtectionUp=desk_data["desk_data"]["state"]["isOverloadProtectionUp"],
        isOverloadProtectionDown=desk_data["desk_data"]["state"]["isOverloadProtectionDown"],
        isAntiCollision=desk_data["desk_data"]["state"]["isAntiCollision"],
        activationsCounter=desk_data["desk_data"]["usage"]["activationsCounter"],
        sitStandCounter=desk_data["desk_data"]["usage"]["sitStandCounter"],
        last_errors=desk_data["desk_data"]["lastErrors"],  # store as JSON
        user_status=desk_data.get("user", "inactive")     # default to inactive if missing
    )
    db.merge(desk)  # merge works for SQLite: inserts or updates
    db.commit()
