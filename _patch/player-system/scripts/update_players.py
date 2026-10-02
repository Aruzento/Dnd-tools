from __future__ import annotations

from pathlib import Path
import json
import os
import re
import tempfile

ROOT_DIR = Path(__file__).resolve().parent.parent

CHARACTERS_DIR = ROOT_DIR / "content" / "characters"
CSV_FILE = ROOT_DIR / "data" / "players.csv"
CHARACTERS_DATA_FILE = ROOT_DIR / "data" / "characters-data.js"
JS_FILE = ROOT_DIR / "assets" / "js" / "players.js"

TITLE_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
HP_RE = re.compile(r"\*\*Хиты:\*\*\s*(\d+)")
AC_RE = re.compile(r"\*\*КД:\*\*\s*(\d+)")
COMBAT_RE = re.compile(
    r"<!--\s*DND-TOOLS-COMBAT\s*(\{.*?\})\s*DND-TOOLS-COMBAT\s*-->",
    re.DOTALL,
)
FALLBACK_CSV_RE = re.compile(
    r"const FALLBACK_PLAYERS_CSV = `.*?`;",
    re.DOTALL,
)

ALLOWED_COMBAT_KEYS = {
    "attackBonus",
    "damage",
    "attacks",
    "damageType",
    "heal",
    "healMode",
    "firstRoundAdvantage",
    "resist",
    "relentless",
    "actionSurge",
    "secondWind",
    "physicalImmunity",
    "advantage",
    "physicalResistance",
}


def extract_player_name(title: str) -> str:
    left = title.split("—", 1)[0].strip()
    parts = left.split(maxsplit=1)
    name = parts[1].strip() if len(parts) == 2 else left
    return name.strip(' "\'“”«»')


def validate_combat_profile(profile, filename):
    if not isinstance(profile, dict):
        raise ValueError(f"{filename}: профиль калькулятора должен быть JSON-объектом")

    unknown = sorted(set(profile) - ALLOWED_COMBAT_KEYS)
    if unknown:
        raise ValueError(
            f"{filename}: неизвестные поля профиля калькулятора: "
            + ", ".join(unknown)
        )

    for field in ("attackBonus", "damage", "heal", "secondWind"):
        if field in profile and (
            isinstance(profile[field], bool)
            or not isinstance(profile[field], (int, float))
        ):
            raise ValueError(f"{filename}: {field} должен быть числом")

    if "attacks" in profile:
        attacks = profile["attacks"]
        if not isinstance(attacks, int) or isinstance(attacks, bool) or attacks < 1:
            raise ValueError(f"{filename}: attacks должен быть целым числом от 1")

    if "damageType" in profile and not isinstance(profile["damageType"], str):
        raise ValueError(f"{filename}: damageType должен быть строкой")

    if "healMode" in profile and profile["healMode"] not in ("bonus", "action"):
        raise ValueError(f"{filename}: healMode должен быть bonus или action")

    for field in (
        "firstRoundAdvantage",
        "relentless",
        "actionSurge",
        "physicalImmunity",
        "advantage",
        "physicalResistance",
    ):
        if field in profile and not isinstance(profile[field], bool):
            raise ValueError(f"{filename}: {field} должен быть true или false")

    if "resist" in profile:
        resist = profile["resist"]
        if not isinstance(resist, list) or not all(isinstance(x, str) for x in resist):
            raise ValueError(f"{filename}: resist должен быть массивом строк")


def parse_character(path: Path):
    text = path.read_text(encoding="utf-8")

    title_match = TITLE_RE.search(text)
    hp_match = HP_RE.search(text)
    ac_match = AC_RE.search(text)

    errors = []

    if not title_match:
        errors.append("нет заголовка вида # Класс Имя — Подкласс")
    if not hp_match:
        errors.append("нет поля **Хиты:** число")
    if not ac_match:
        errors.append("нет поля **КД:** число")

    if errors:
        raise ValueError(f"{path.name}: " + "; ".join(errors))

    title = title_match.group(1).strip()
    name = extract_player_name(title)
    hp = int(hp_match.group(1))
    armor_class = int(ac_match.group(1))

    combat = None
    combat_match = COMBAT_RE.search(text)

    if combat_match:
        try:
            combat = json.loads(combat_match.group(1))
        except json.JSONDecodeError as error:
            raise ValueError(
                f"{path.name}: ошибка JSON в DND-TOOLS-COMBAT: {error}"
            ) from error

        validate_combat_profile(combat, path.name)

    display_markdown = COMBAT_RE.sub("", text).strip()

    return {
        "name": name,
        "title": title,
        "maxHp": hp,
        "armorClass": armor_class,
        "file": path.name,
        "markdown": display_markdown,
        "combat": combat,
    }


def atomic_write_text(path: Path, text: str, encoding="utf-8"):
    path.parent.mkdir(parents=True, exist_ok=True)

    fd, temp_name = tempfile.mkstemp(
        prefix=path.name + ".",
        suffix=".tmp",
        dir=path.parent,
    )

    try:
        with os.fdopen(fd, "w", encoding=encoding, newline="") as file:
            file.write(text)
        os.replace(temp_name, path)
    finally:
        temp_path = Path(temp_name)
        if temp_path.exists():
            temp_path.unlink()


def main():
    if not CHARACTERS_DIR.exists():
        raise SystemExit(f"Папка не найдена: {CHARACTERS_DIR}")

    if not JS_FILE.exists():
        raise SystemExit(f"Файл не найден: {JS_FILE}")

    md_files = sorted(CHARACTERS_DIR.glob("*.md"))

    if not md_files:
        raise SystemExit("В content/characters нет .md-файлов.")

    # Сначала проверяем ВСЕ карточки. До успешной проверки ничего не записываем.
    characters = []
    errors = []

    for md_file in md_files:
        try:
            characters.append(parse_character(md_file))
        except ValueError as error:
            errors.append(str(error))

    if errors:
        raise SystemExit(
            "Обновление игроков отменено. Исправьте карточки:\n- "
            + "\n- ".join(errors)
            + "\n\nСтарые сгенерированные данные не изменены."
        )

    names = [character["name"] for character in characters]
    duplicates = sorted({name for name in names if names.count(name) > 1})

    if duplicates:
        raise SystemExit(
            "Обновление игроков отменено: повторяются имена: "
            + ", ".join(duplicates)
        )

    csv_rows = ["имя;хиты;КД"]
    csv_rows.extend(
        f"{character['name']};{character['maxHp']};{character['armorClass']}"
        for character in characters
    )
    csv_text = "\ufeff" + "\n".join(csv_rows) + "\n"

    fallback_csv = "имя;хиты;КД\n" + "\n".join(
        f"{character['name']};{character['maxHp']};{character['armorClass']}"
        for character in characters
    )

    players_js = JS_FILE.read_text(encoding="utf-8")
    new_fallback = "const FALLBACK_PLAYERS_CSV = `" + fallback_csv + "`;"

    if not FALLBACK_CSV_RE.search(players_js):
        raise SystemExit(
            "В assets/js/players.js не найден FALLBACK_PLAYERS_CSV. "
            "Сгенерированные данные не изменены."
        )

    players_js = FALLBACK_CSV_RE.sub(
        lambda _: new_fallback,
        players_js,
        count=1,
    )

    public_characters = [
        {
            "name": character["name"],
            "title": character["title"],
            "markdown": character["markdown"],
            "file": character["file"],
        }
        for character in characters
    ]

    combat_profiles = {
        character["name"]: character["combat"]
        for character in characters
        if character["combat"] is not None
    }

    characters_data = (
        "// AUTO-GENERATED FROM content/characters/*.md.\n"
        "// Do not edit manually. Run Update and launch.bat.\n"
        "window.CHARACTERS = "
        + json.dumps(public_characters, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
        "window.PLAYER_COMBAT_PROFILES = "
        + json.dumps(combat_profiles, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )

    # Запись только после полной успешной проверки.
    atomic_write_text(CSV_FILE, csv_text)
    atomic_write_text(JS_FILE, players_js)
    atomic_write_text(CHARACTERS_DATA_FILE, characters_data)

    print()
    print("Готово.")
    print(f"Игроков: {len(characters)}")
    print(f"[OK] {CSV_FILE.relative_to(ROOT_DIR)}")
    print(f"[OK] {JS_FILE.relative_to(ROOT_DIR)}")
    print(f"[OK] {CHARACTERS_DATA_FILE.relative_to(ROOT_DIR)}")

    missing_profiles = [
        character["name"]
        for character in characters
        if character["combat"] is None
    ]

    if missing_profiles:
        print()
        print("[WARN] Нет DND-TOOLS-COMBAT у: " + ", ".join(missing_profiles))
        print(
            "Персонажи будут отображаться, но калькулятор использует "
            "для них нейтральный боевой профиль."
        )


if __name__ == "__main__":
    main()
