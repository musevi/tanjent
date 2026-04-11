# Import all models so Base.metadata is aware of every table
from app.models.user import User  # noqa: F401
from app.models.session import Session, SessionStatus  # noqa: F401
from app.models.message import Message, MessageRole  # noqa: F401
