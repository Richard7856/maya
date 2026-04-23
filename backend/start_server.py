"""
Bootstrap script for running the FastAPI server via preview_start.

The problem: `python3 -m uvicorn` inserts '' (empty string) in sys.path, which
causes Python to call os.getcwd() when scanning import paths. In the preview_start
sandbox, getcwd() raises PermissionError. This script sets sys.path explicitly
with no empty string, avoiding the issue entirely.

Also: CommandLineTools python3 lacks TCC access to ~/Downloads. Uses the python.org
Python 3.13 installation which has the correct permissions.
"""
import sys

# Explicit sys.path — no '' entry (getcwd-safe), no user site-packages
sys.path = [
    "/Users/richardfigueroa/Downloads/Maya/backend/deps",   # third-party deps
    "/Users/richardfigueroa/Downloads/Maya/backend",         # app source
    "/Library/Frameworks/Python.framework/Versions/3.13/lib/python313.zip",
    "/Library/Frameworks/Python.framework/Versions/3.13/lib/python3.13",
    "/Library/Frameworks/Python.framework/Versions/3.13/lib/python3.13/lib-dynload",
    "/Library/Frameworks/Python.framework/Versions/3.13/lib/python3.13/site-packages",
]

import uvicorn

uvicorn.run(
    "app.main:app",
    host="0.0.0.0",
    port=8001,
    http="h11",       # pure-Python HTTP parser (no httptools C extension)
    loop="asyncio",   # built-in loop (no uvloop C extension)
)
