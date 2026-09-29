from pathlib import Path
import csv
import re

BASE_DIR = Path(__file__).resolve().parent

CHARACTERS_DIR = BASE_DIR / "characters"
CSV_FILE = BASE_DIR / "players.csv"
JS_FILE = BASE_DIR / "players.js"

TITLE_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
HP_RE = re.compile(r"\*\*Хиты:\*\*\s*(\d+)")
AC_RE = re.compile(r"\*\*КД:\*\*\s*(\d+)")

FALLBACK_CSV_RE = re.compile(
    r"const FALLBACK_PLAYERS_CSV = `.*?`;",
    re.DOTALL
)


def extract_player_name(title: str) -> str:
    """
    Примеры:
    'Бард Лазарь — Коллегия Очарования' -> 'Лазарь'
    'Варвар "Громм" — Путь Зверя'       -> 'Громм'
    'Воин Ренкай — Воин Эха'            -> 'Ренкай'
    """
    left = title.split("—", 1)[0].strip()

    parts = left.split(maxsplit=1)
    if len(parts) == 2:
        name = parts[1].strip()
    else:
        name = left

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
    name = extract_player_name(title)
    hp = int(hp_match.group(1))
    armor_class = int(ac_match.group(1))

    return {
        "имя": name,
        "хиты": hp,
        "КД": armor_class,
    }


def main():
    if not CHARACTERS_DIR.exists():
        raise SystemExit(f"Папка не найдена: {CHARACTERS_DIR}")

    if not JS_FILE.exists():
        raise SystemExit(f"Файл не найден: {JS_FILE}")

    players = []

    # Сортировка по имени файла сохраняет порядок 01_, 02_, 03_...
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
            "В папке characters не найдено ни одного корректного .md."
        )

    # 1. Пересобираем players.csv
    with CSV_FILE.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file, delimiter=";")
        writer.writerow(["имя", "хиты", "КД"])

        for player in players:
            writer.writerow([
                player["имя"],
                player["хиты"],
                player["КД"],
            ])

    # 2. Формируем тот же список для fallback внутри players.js.
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
            "В players.js не найден блок "
            "const FALLBACK_PLAYERS_CSV = `...`;"
        )

    js = FALLBACK_CSV_RE.sub(
        lambda _: new_block,
        js,
        count=1,
    )

    JS_FILE.write_text(js, encoding="utf-8")

    print()
    print("Готово.")
    print(f"Игроков: {len(players)}")
    print(f"Обновлён: {CSV_FILE.name}")
    print(f"Обновлён: {JS_FILE.name}")
    print("Хиты и КД теперь наследуются из characters/*.md")


if __name__ == "__main__":
    main()
