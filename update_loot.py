from pathlib import Path
import csv
import json

BASE_DIR = Path(__file__).resolve().parent
CSV_FILE = BASE_DIR / "loot.csv"
JS_FILE = BASE_DIR / "loot-data.js"

COLUMNS = [
    "Предмет",
    "Эффект",
    "Описание",
    "Стоимость",
    "Редкость",
    "Категория",
]


def main():
    if not CSV_FILE.exists():
        raise SystemExit(f"Файл не найден: {CSV_FILE}")

    items = []

    with CSV_FILE.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file, delimiter=";")

        if reader.fieldnames != COLUMNS:
            actual = ";".join(reader.fieldnames or [])
            expected = ";".join(COLUMNS)
            raise SystemExit(
                f"Неверные колонки loot.csv.\n"
                f"Ожидаются: {expected}\n"
                f"Получены:  {actual}"
            )

        for line_number, row in enumerate(reader, start=2):
            name = (row["Предмет"] or "").strip()
            if not name:
                print(f"[SKIP] Строка {line_number}: пустое название")
                continue

            raw_price = (row["Стоимость"] or "").strip().replace(" ", "")
            try:
                price = int(raw_price)
            except ValueError:
                raise SystemExit(
                    f"Строка {line_number}: некорректная стоимость {raw_price!r}"
                )

            if price < 0:
                raise SystemExit(
                    f"Строка {line_number}: стоимость не может быть отрицательной"
                )

            items.append({
                "name": name,
                "effect": row["Эффект"] or "",
                "description": row["Описание"] or "",
                "price": price,
                "rarity": (row["Редкость"] or "").strip(),
                "category": (row["Категория"] or "").strip(),
            })

    if not items:
        raise SystemExit("В loot.csv нет корректных предметов.")

    content = (
        "// AUTO-GENERATED FROM loot.csv. Edit loot.csv and run update_loot.py.\n"
        "const lootTable = "
        + json.dumps(items, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )

    JS_FILE.write_text(content, encoding="utf-8")

    print(f"[OK] Предметов: {len(items)}")
    print(f"[OK] Обновлён: {JS_FILE.name}")


if __name__ == "__main__":
    main()
