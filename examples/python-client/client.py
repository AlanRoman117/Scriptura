"""
Simple Python client for the Scriptura REST API.

Usage:
  python client.py translations
  python client.py verse kjv John 3 16
  python client.py search kjv "God so loved"
"""

import sys
import requests

BASE_URL = "http://localhost:3000"


def list_translations() -> None:
    resp = requests.get(f"{BASE_URL}/translations")
    resp.raise_for_status()
    for t in resp.json():
        print(f"  {t['id']:<12} {t['name']} ({t['language']})")


def get_verse(translation: str, book: str, chapter: str, verse: str) -> None:
    resp = requests.get(f"{BASE_URL}/translations/{translation}/{book}/{chapter}/{verse}")
    resp.raise_for_status()
    data = resp.json()
    print(f"{book} {chapter}:{verse} ({translation})")
    print(f"  {data['text']}")


def search(translation: str, query: str) -> None:
    resp = requests.get(f"{BASE_URL}/search", params={"q": query, "translation": translation})
    resp.raise_for_status()
    results = resp.json()
    print(f"Found {len(results)} result(s):\n")
    for r in results[:20]:
        print(f"  {r['ref']}: {r['text']}")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == "translations":
        list_translations()
    elif command == "verse" and len(sys.argv) == 6:
        get_verse(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
    elif command == "search" and len(sys.argv) >= 4:
        search(sys.argv[2], " ".join(sys.argv[3:]))
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
