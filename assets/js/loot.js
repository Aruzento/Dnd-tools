const form = document.getElementById("loot-form");
const minInput = document.getElementById("loot-min");
const maxInput = document.getElementById("loot-max");
const budgetInput = document.getElementById("loot-budget");
const resultOutput = document.getElementById("loot-result");
const resultMeta = document.getElementById("result-meta");
const formError = document.getElementById("form-error");
const copyButton = document.getElementById("copy-button");

// Нормализуем базу, чтобы генератор переживал расширение схемы
// и продолжал работать с name/price, не завися от новых полей.
const lootItems = (Array.isArray(lootTable) ? lootTable : [])
  .map((item) => ({
    name: String(item.name ?? item["Предмет"] ?? "").trim(),
    effect: String(item.effect ?? item["Эффект"] ?? ""),
    description: String(item.description ?? item["Описание"] ?? ""),
    price: Number(item.price ?? item["Стоимость"]),
    rarity: String(item.rarity ?? item["Редкость"] ?? ""),
    category: String(item.category ?? item["Категория"] ?? "")
  }))
  .filter((item) => item.name && Number.isFinite(item.price) && item.price >= 0);

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateLoot(count, budget) {
  if (count > lootItems.length) return null;

  let available = lootItems.map((item, itemIndex) => ({ item, itemIndex }));
  const minimumTotal = [...available]
    .sort((a, b) => a.item.price - b.item.price)
    .slice(0, count)
    .reduce((sum, entry) => sum + entry.item.price, 0);

  if (budget < minimumTotal) return null;

  const selected = [];
  let remainingBudget = budget;

  for (let slot = 0; slot < count; slot += 1) {
    const remainingSlots = count - slot - 1;
    const sortedByPrice = [...available].sort((a, b) => a.item.price - b.item.price);
    const cheapest = sortedByPrice.slice(0, remainingSlots);
    const cheapestIds = new Set(cheapest.map((entry) => entry.itemIndex));
    const cheapestTotal = cheapest.reduce((sum, entry) => sum + entry.item.price, 0);
    const nextCheapest = sortedByPrice[remainingSlots];

    const candidates = available.filter((entry) => {
      if (entry.item.price > remainingBudget) return false;
      if (remainingSlots === 0) return true;

      let reserve = cheapestTotal;
      if (cheapestIds.has(entry.itemIndex)) {
        reserve = reserve - entry.item.price + nextCheapest.item.price;
      }
      return entry.item.price + reserve <= remainingBudget;
    });

    if (candidates.length === 0) return null;
    const chosen = candidates[randomInt(0, candidates.length - 1)];
    selected.push(chosen.item);
    remainingBudget -= chosen.item.price;
    available = available.filter((entry) => entry.itemIndex !== chosen.itemIndex);
  }

  return selected;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formError.textContent = "";

  const min = Number(minInput.value);
  const max = Number(maxInput.value);
  const budget = Number(budgetInput.value);

  if (lootItems.length === 0) {
    formError.textContent = "База предметов пуста или повреждена. Проверьте loot.csv и запустите update_loot.py.";
    return;
  }
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < 1) {
    formError.textContent = "Количество предметов должно быть целым числом от 1.";
    return;
  }
  if (min > max) {
    formError.textContent = "Значение «от» не может быть больше значения «до».";
    return;
  }
  if (max > 50) {
    formError.textContent = "Генератор поддерживает до 50 предметов за один раз.";
    return;
  }
  if (!Number.isFinite(budget) || budget < 1) {
    formError.textContent = "Укажите максимальную стоимость лута больше нуля.";
    return;
  }

  const count = randomInt(min, max);
  const loot = generateLoot(count, budget);
  if (!loot) {
    formError.textContent = `Для ${count} предметов бюджет слишком мал. Увеличьте максимальную стоимость.`;
    return;
  }

  const total = loot.reduce((sum, item) => sum + item.price, 0);
  resultOutput.value = loot
    .map((item, index) => `${index + 1}. ${item.name} — ${item.price.toLocaleString("ru-RU")} ММ`)
    .join("\n");

  resultMeta.textContent = `${loot.length} предметов · общая стоимость ${total.toLocaleString("ru-RU")} из ${budget.toLocaleString("ru-RU")} ММ`;
  copyButton.disabled = false;
});

copyButton.addEventListener("click", async () => {
  if (!resultOutput.value) return;
  try {
    await navigator.clipboard.writeText(resultOutput.value);
    const previousText = copyButton.textContent;
    copyButton.textContent = "Скопировано";
    setTimeout(() => { copyButton.textContent = previousText; }, 1200);
  } catch (error) {
    resultOutput.focus();
    resultOutput.select();
    document.execCommand("copy");
  }
});
