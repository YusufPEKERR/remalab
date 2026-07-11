import os
import json


class SessionManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SessionManager, cls).__new__(cls)
            cls._instance._init_state()
        return cls._instance

    def _init_state(self):
        self.token = None
        self.user_id = None
        self.username = None
        self.role = None
        self.session_file = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), ".session"
        )

    def set_session(self, token: str, payload: dict, remember: bool = False):
        self.token = token
        self.user_id = payload.get("user_id")
        self.username = payload.get("sub")
        self.role = payload.get("role")

        if remember:
            self.save_session_to_disk()

    def clear_session(self):
        self.token = None
        self.user_id = None
        self.username = None
        self.role = None
        if os.path.exists(self.session_file):
            os.remove(self.session_file)

    def is_authenticated(self) -> bool:
        return self.token is not None

    def has_role(self, required_role: str) -> bool:
        return self.role == required_role

    def save_session_to_disk(self):
        data = {"token": self.token}
        with open(self.session_file, "w") as f:
            json.dump(data, f)

    def load_session_from_disk(self) -> str:
        if os.path.exists(self.session_file):
            try:
                with open(self.session_file, "r") as f:
                    data = json.load(f)
                    return data.get("token")
            except Exception:
                return None
        return None
