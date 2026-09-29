from pathlib import Path
import csv
import re

ROOT_DIR = Path(__file__).resolve().parent.parent

CHARACTERS_DIR = ROOT_DIR / "content" / "characters"
CSV_FILE = ROOT_DIR / "data" / "players.csv"
JS_FILE = ROOT_DIR / "assets" / "js" / "players.js"

TITLE_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
HP_RE = re.compile(r"\*\*Хиты:\*\*\s*(\d+)")
AC_RE = re.compile(r"\*\*КД:\*\*\s*(\d+)")

FALLBACK_CSV_RE = re.compile(
    r"const FALLBACK_PLAYERS_CSV = `.*?`;",
    re.DOTALL
)


def extract_player_name(title: str) -> str:
    left = title.split("—", 1)[0].strip()
    parts = left.split(maxsplit=1)
    name = parts[1].strip() if len(parts) == 2 else left
    return name.strip(' "\'“”«»')


def parse_character(path: Path):
    text = path.read_text(encoding="utf-8")

    title_match = TITLE_RE.search(text)
    hp_match = HP_RE.search(text)
    ac_match = AC_RE.search(text)

    if not title_match:
        print(f"[SKIP] Не найден заголовок # ...: {path.name}")
        return None

    if not hp_match:
        print(f"[SKIP] Не найдены хиты: {path.name}")
        return None

    if not ac_match:
        print(f"[SKIP] Не найден КД: {path.name}")
        return None

    title = title_match.group(1).strip()

    return {
        "имя": extract_player_name(title),
        "хиты": int(hp_match.group(1)),
        "КД": int(ac_match.group(1)),
    }


def main():
    if not CHARACTERS_DIR.exists():
        raise SystemExit(f"Папка не найдена: {CHARACTERS_DIR}")

    if not JS_FILE.exists():
        raise SystemExit(f"Файл не найден: {JS_FILE}")

    players = []

    for md_file in sorted(CHARACTERS_DIR.glob("*.md")):
        player = parse_character(md_file)
        if not player:
            continue

        players.append(player)
        print(
            f"[OK] {player['имя']} — "
            f"{player['хиты']} HP — "
            f"КД {player['КД']}"
        )

    if not players:
        raise SystemExit(
            "В content/characters не найдено ни одного корректного .md."
        )

    with CSV_FILE.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file, delimiter=";")
        writer.writerow(["имя", "хиты", "КД"])

        for player in players:
            writer.writerow([
                player["имя"],
                player["хиты"],
                player["КД"],
            ])

    fallback_csv = "имя;хиты;КД\n" + "\n".join(
        f"{player['имя']};{player['хиты']};{player['КД']}"
        for player in players
    )

    js = JS_FILE.read_text(encoding="utf-8")

    new_block = (
        "const FALLBACK_PLAYERS_CSV = `"
        + fallback_csv
        + "`;"
    )

    if not FALLBACK_CSV_RE.search(js):
        raise SystemExit(
            "В assets/js/players.js не найден FALLBACK_PLAYERS_CSV."
        )

    js = FALLBACK_CSV_RE.sub(lambda _: new_block, js, count=1)
    JS_FILE.write_text(js, encoding="utf-8")

    print()
    print("Готово.")
    print(f"Игроков: {len(players)}")
    print(f"Обновлён: {CSV_FILE.relative_to(ROOT_DIR)}")
    print(f"Обновлён: {JS_FILE.relative_to(ROOT_DIR)}")


if __name__ == "__main__":
    main()
