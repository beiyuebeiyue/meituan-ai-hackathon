import subprocess
import sys
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
import unittest

from src.app import get_message, run


class MainProgramTests(unittest.TestCase):
    def test_core_logic_is_in_src(self) -> None:
        self.assertEqual(get_message(), "Hello from src!")

    def test_run_prints_message_and_returns_success(self) -> None:
        output = StringIO()
        with redirect_stdout(output):
            exit_code = run()

        self.assertEqual(exit_code, 0)
        self.assertEqual(output.getvalue().strip(), "Hello from src!")

    def test_main_py_starts_program(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        result = subprocess.run(
            [sys.executable, str(repo_root / "main.py")],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0)
        self.assertIn("Hello from src!", result.stdout)


if __name__ == "__main__":
    unittest.main()
