import subprocess
import sys
from pathlib import Path
import unittest

from src.app import get_message


class MainProgramTests(unittest.TestCase):
    def test_core_logic_is_in_src(self) -> None:
        self.assertEqual(get_message(), "Hello from src!")

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
