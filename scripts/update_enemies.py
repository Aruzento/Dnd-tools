from pathlib import Path
import csv
import json
import re

ROOT_DIR = Path(__file__).resolve().parent.parent

ENEMIES_DIR = ROOT_DIR / "content" / "enemies"
CSV_FILE = ROOT_DIR / "data" / "enemies.csv"
JS_FILE = ROOT_DIR / "assets" / "js" / "enemies.js"
HTML_FILE = ROOT_DIR / "pages" / "tool-3.html"

NAME_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
HP_RE = re.compile(r"\*\*Хиты:\*\*\s*(\d+)")

FALLBACK_CSV_RE = re.compile(
    r"const FALLBACK_ENEMIES_CSV = `.*?`;",
    re.DOTALL
)

MD_FALLBACK_RE = re.compile(
    r"window\.ENEMY_MD_FALLBACK\s*=\s*\{.*?\};",
    re.DOTALL
)


def parse_enemy(path: Path):
    text = path.read_text(encoding="utf-8")

    name_match = NAME_RE.search(text)
    hp_match = HP_RE.search(text)

    if not name_match:
        print(f"[SKIP] Не найдено название: {path.name}")
        return None

    if not hp_match:
        print(f"[SKIP] Не найдены хиты: {path.name}")
        return None

    return {
        "Название": name_match.group(1).strip(),
        "Хиты всего": int(hp_match.group(1)),
        "Файл": f"../content/enemies/{path.name}",
        "markdown": text,
    }


def main():
    if not ENEMIES_DIR.exists():
        raise SystemExit(f"Папка не найдена: {ENEMIES_DIR}")

    if not JS_FILE.exists():
        raise SystemExit(f"Файл не найден: {JS_FILE}")

    enemies = []

    for md_file in sorted(ENEMIES_DIR.glob("*.md")):
        enemy = parse_enemy(md_file)
        if enemy:
            enemies.append(enemy)
            print(
                f"[OK] {enemy['Название']} — "
                f"{enemy['Хиты всего']} HP — "
                f"{enemy['Файл']}"
            )

    if not enemies:
        raise SystemExit("В content/enemies не найдено ни одного корректного .md.")

    with CSV_FILE.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file, delimiter=";")
        writer.writerow(["Название", "Хиты всего", "Файл"])

        for enemy in enemies:
            writer.writerow([
                enemy["Название"],
                enemy["Хиты всего"],
                enemy["Файл"],
            ])

    fallback_csv = "Название;Хиты всего;Файл\n" + "\n".join(
        f"{enemy['Название']};{enemy['Хиты всего']};{enemy['Файл']}"
        for enemy in enemies
    )

    markdown_fallback = {
        enemy["Файл"]: enemy["markdown"]
        for enemy in enemies
    }

    js = JS_FILE.read_text(encoding="utf-8")

    new_csv_block = (
        "const FALLBACK_ENEMIES_CSV = `"
        + fallback_csv
        + "`;"
    )

    if not FALLBACK_CSV_RE.search(js):
        raise SystemExit(
            "В assets/js/enemies.js не найден FALLBACK_ENEMIES_CSV."
        )

    js = FALLBACK_CSV_RE.sub(lambda _: new_csv_block, js, count=1)

    new_md_block = (
        "window.ENEMY_MD_FALLBACK = "
        + json.dumps(markdown_fallback, ensure_ascii=False, indent=2)
        + ";"
    )

    if MD_FALLBACK_RE.search(js):
        js = MD_FALLBACK_RE.sub(lambda _: new_md_block, js, count=1)
    else:
        js = js.replace(
            new_csv_block,
            new_csv_block + "\n\n" + new_md_block,
            1
        )

    JS_FILE.write_text(js, encoding="utf-8")

    for old_file in (
        ROOT_DIR / "enemy-details.js",
        ROOT_DIR / "assets" / "js" / "enemy-details.js",
    ):
        if old_file.exists():
            old_file.unlink()
            print(f"[DELETE] {old_file.relative_to(ROOT_DIR)}")

    if HTML_FILE.exists():
        html = HTML_FILE.read_text(encoding="utf-8")
        html = re.sub(
            r'\s*<script\s+src=["\'][^"\']*enemy-details\.js["\']\s*></script>\s*',
            "\n",
            html
        )
        HTML_FILE.write_text(html, encoding="utf-8")

    print()
    print("Готово.")
    print(f"Врагов: {len(enemies)}")
    print(f"Обновлён: {CSV_FILE.relative_to(ROOT_DIR)}")
    print(f"Обновлён: {JS_FILE.relative_to(ROOT_DIR)}")


if __name__ == "__main__":
    main()
