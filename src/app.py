"""Core application logic."""


def get_message() -> str:
    return "Hello from src!"


def run() -> int:
    print(get_message())
    return 0
