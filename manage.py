import sys

import uvicorn


def runserver() -> None:
    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else "runserver"

    if command == "runserver":
        runserver()
        return

    print("Unknown command.")
    print("Usage: python manage.py runserver")
    raise SystemExit(1)


if __name__ == "__main__":
    main()
