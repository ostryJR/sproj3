from sqlalchemy.orm import Session
from models.desk import Desk

def add_or_update_desk(db: Session, desk_id: str, desk_data: dict):
    """
    Inserts a new desk or updates an existing one in SQLite, safely.
    """
    data = desk_data.get("desk_data", {})

    config = data.get("config", {})
    state = data.get("state", {})
    usage = data.get("usage", {})
    last_errors = data.get("lastErrors", [])

    desk = Desk(
        desk_id=desk_id,
        name=config.get("name", f"Desk {desk_id}"),
        manufacturer=config.get("manufacturer", "Unknown"),
        position_mm=state.get("position_mm", 0),
        speed_mms=state.get("speed_mms", 0),
        status=state.get("status", "Unknown"),
        isPositionLost=state.get("isPositionLost", False),
        isOverloadProtectionUp=state.get("isOverloadProtectionUp", False),
        isOverloadProtectionDown=state.get("isOverloadProtectionDown", False),
        isAntiCollision=state.get("isAntiCollision", False),
        activationsCounter=usage.get("activationsCounter", 0),
        sitStandCounter=usage.get("sitStandCounter", 0),
        last_errors=last_errors,
        user_status=desk_data.get("user", "inactive")
    )

    db.merge(desk)
    db.commit()
