"""Legacy compatibility notice for ZYNNOX.

The production API now lives in ``server/src`` and is started with:

    npm run dev --workspace server

This file is intentionally kept so existing references do not break, but it no
longer starts the old prototype server or connects to a local model runtime.
"""


def main() -> None:
    """Print the supported production startup command."""
    print("ZYNNOX production API: npm run dev --workspace server")
    print("ZYNNOX dashboard: npm run dev --workspace client")


if __name__ == "__main__":
    main()
