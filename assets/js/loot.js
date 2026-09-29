const form = document.getElementById("loot-form");
const minInput = document.getElementById("loot-min");
const maxInput = document.getElementById("loot-max");
const budgetMinInput = document.getElementById("loot-budget-min");
const budgetMaxInput = document.getElementById("loot-budget-max");
const categoriesContainer = document.getElementById("loot-categories");
const categoriesAllButton = document.getElementById("loot-categories-all");
const categoriesNoneButton = document.getElementById("loot-categories-none");
const categorySummary = document.getElementById("loot-category-summary");
const resultOutput = document.getElementById("loot-result");
const resultMeta = document.getElementById("result-meta");
const formError = document.getElementById("form-error");
const copyButton = document.getElementById("copy-button");

// Нормализуем базу, чтобы генератор переживал расширение схемы.
const lootItems = (Array.isArray(lootTable) ? lootTable : [])
  .map((item) => ({
    name: String(item.name ?? item["Предмет"] ?? "").trim(),
    effect: String(item.effect ?? item["Эффект"] ?? ""),
    description: String(item.description ?? item["Описание"] ?? ""),
    price: Number(item.price ?? item["Стоимость"]),
    rarity: String(item.rarity ?? item["Редкость"] ?? "").trim(),
    category: String(item.category ?? item["Категория"] ?? "").trim()
  }))
  .filter((item) => (
    item.name &&
    item.category &&
    Number.isFinite(item.price) &&
    item.price >= 0
  ));

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffled(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = randomInt(0, index);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }

  return copy;
}

function formatPrice(value) {
  return Number(value).toLocaleString("ru-RU");
}

function getCategories() {
  return [...new Set(lootItems.map((item) => item.category))]
    .sort((a, b) => a.localeCompare(b, "ru"));
}

function updateCategorySummary() {
  const checkboxes = [...categoriesContainer.querySelectorAll('input[type="checkbox"]')];
  const selected = checkboxes.filter((checkbox) => checkbox.checked).length;

  categorySummary.textContent = `Выбрано ${selected} из ${checkboxes.length}`;
}

function renderCategories() {
  const categories = getCategories();
  const counts = new Map();

  lootItems.forEach((item) => {
    counts.set(item.category, (counts.get(item.category) || 0) + 1);
  });

  const fragment = document.createDocumentFragment();

  categories.forEach((category, index) => {
    const label = document.createElement("label");
    label.className = "loot-category-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = category;
    checkbox.checked = true;
    checkbox.id = `loot-category-${index}`;

    const name = document.createElement("span");
    name.className = "loot-category-name";
    name.textContent = category;

    const count = document.createElement("small");
    count.textContent = String(counts.get(category) || 0);

    label.append(checkbox, name, count);
    fragment.appendChild(label);
  });

  categoriesContainer.replaceChildren(fragment);
  updateCategorySummary();
}

function setAllCategories(checked) {
  categoriesContainer
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.checked = checked;
    });

  updateCategorySummary();
}

function getSelectedCategories() {
  return new Set(
    [...categoriesContainer.querySelectorAll('input[type="checkbox"]:checked')]
      .map((checkbox) => checkbox.value)
  );
}

function getFeasibleCounts(items, minCount, maxCount, minBudget, maxBudget) {
  const prices = items
    .map((item) => item.price)
    .sort((a, b) => a - b);

  const prefix = [0];

  for (const price of prices) {
    prefix.push(prefix[prefix.length - 1] + price);
  }

  const total = prefix[prefix.length - 1];
  const feasible = [];

  for (let count = minCount; count <= maxCount; count += 1) {
    if (count > prices.length) continue;

    const cheapestTotal = prefix[count];
    const mostExpensiveTotal = total - prefix[prices.length - count];

    if (
      cheapestTotal <= maxBudget &&
      mostExpensiveTotal >= minBudget
    ) {
      feasible.push(count);
    }
  }

  return feasible;
}

function tryGenerateLoot(items, count, minBudget, maxBudget) {
  const sorted = items
    .map((item, itemIndex) => ({ item, itemIndex }))
    .sort((a, b) => a.item.price - b.item.price);

  const absoluteMin = sorted
    .slice(0, count)
    .reduce((sum, entry) => sum + entry.item.price, 0);

  const absoluteMax = sorted
    .slice(-count)
    .reduce((sum, entry) => sum + entry.item.price, 0);

  const targetMin = Math.max(minBudget, absoluteMin);
  const targetMax = Math.min(maxBudget, absoluteMax);

  if (targetMin > targetMax) return null;

  // Несколько попыток нужны только для редких случаев с "дырками" между ценами.
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const available = [...sorted];
    const selected = [];
    let selectedTotal = 0;
    const targetTotal = targetMin + Math.random() * (targetMax - targetMin);

    let failed = false;

    for (let slot = 0; slot < count; slot += 1) {
      const remainingSlots = count - slot - 1;
      const size = available.length;

      let cheapestTotal = 0;
      let expensiveTotal = 0;

      for (let index = 0; index < remainingSlots; index += 1) {
        cheapestTotal += available[index].item.price;
        expensiveTotal += available[size - 1 - index].item.price;
      }

      const nextCheapest = remainingSlots < size
        ? available[remainingSlots]
        : null;

      const nextExpensiveIndex = size - remainingSlots - 1;
      const nextExpensive = nextExpensiveIndex >= 0
        ? available[nextExpensiveIndex]
        : null;

      const desiredPrice = (
        targetTotal - selectedTotal
      ) / (remainingSlots + 1);

      const candidates = [];

      for (let index = 0; index < size; index += 1) {
        const entry = available[index];
        const nextTotal = selectedTotal + entry.item.price;

        if (nextTotal > maxBudget) continue;

        let minReserve = cheapestTotal;
        if (remainingSlots > 0 && index < remainingSlots) {
          if (!nextCheapest) continue;
          minReserve = (
            cheapestTotal -
            entry.item.price +
            nextCheapest.item.price
          );
        }

        let maxReserve = expensiveTotal;
        if (
          remainingSlots > 0 &&
          index >= size - remainingSlots
        ) {
          if (!nextExpensive) continue;
          maxReserve = (
            expensiveTotal -
            entry.item.price +
            nextExpensive.item.price
          );
        }

        const minimumPossible = nextTotal + minReserve;
        const maximumPossible = nextTotal + maxReserve;

        if (
          minimumPossible <= maxBudget &&
          maximumPossible >= minBudget
        ) {
          candidates.push({
            index,
            entry,
            distance: Math.abs(entry.item.price - desiredPrice)
          });
        }
      }

      if (!candidates.length) {
        failed = true;
        break;
      }

      // Тянемся к случайной цели внутри диапазона, но сохраняем вариативность.
      candidates.sort((a, b) => a.distance - b.distance);
      const shortlistSize = Math.min(80, candidates.length);
      const chosen = candidates[randomInt(0, shortlistSize - 1)];

      selected.push(chosen.entry.item);
      selectedTotal += chosen.entry.item.price;
      available.splice(chosen.index, 1);
    }

    if (
      !failed &&
      selected.length === count &&
      selectedTotal >= minBudget &&
      selectedTotal <= maxBudget
    ) {
      return selected;
    }
  }

  return null;
}

function generateLoot(items, minCount, maxCount, minBudget, maxBudget) {
  const feasibleCounts = getFeasibleCounts(
    items,
    minCount,
    maxCount,
    minBudget,
    maxBudget
  );

  if (!feasibleCounts.length) return null;

  for (const count of shuffled(feasibleCounts)) {
    const loot = tryGenerateLoot(
      items,
      count,
      minBudget,
      maxBudget
    );

    if (loot) return loot;
  }

  return null;
}

categoriesContainer.addEventListener("change", updateCategorySummary);
categoriesAllButton.addEventListener("click", () => setAllCategories(true));
categoriesNoneButton.addEventListener("click", () => setAllCategories(false));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formError.textContent = "";

  const min = Number(minInput.value);
  const max = Number(maxInput.value);
  const minBudget = Number(budgetMinInput.value);
  const maxBudget = Number(budgetMaxInput.value);
  const selectedCategories = getSelectedCategories();

  if (lootItems.length === 0) {
    formError.textContent = "База предметов пуста или повреждена. Проверьте data/loot.csv и запустите Update and launch.bat.";
    return;
  }

  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < 1) {
    formError.textContent = "Количество предметов должно быть целым числом от 1.";
    return;
  }

  if (min > max) {
    formError.textContent = "Количество предметов «от» не может быть больше значения «до».";
    return;
  }

  if (max > 50) {
    formError.textContent = "Генератор поддерживает до 50 предметов за один раз.";
    return;
  }

  if (
    !Number.isFinite(minBudget) ||
    !Number.isFinite(maxBudget) ||
    minBudget < 0 ||
    maxBudget < 0
  ) {
    formError.textContent = "Стоимость лута должна быть числом от 0.";
    return;
  }

  if (minBudget > maxBudget) {
    formError.textContent = "Стоимость «от» не может быть больше стоимости «до».";
    return;
  }

  if (!selectedCategories.size) {
    formError.textContent = "Выберите хотя бы одну категорию лута.";
    return;
  }

  const filteredItems = lootItems.filter((item) => (
    selectedCategories.has(item.category)
  ));

  if (filteredItems.length < min) {
    formError.textContent = `В выбранных категориях только ${filteredItems.length} предметов. Уменьшите количество или добавьте категории.`;
    return;
  }

  const loot = generateLoot(
    filteredItems,
    min,
    max,
    minBudget,
    maxBudget
  );

  if (!loot) {
    formError.textContent = "Для выбранных категорий, количества и диапазона стоимости подходящую комбинацию найти не удалось.";
    return;
  }

  const total = loot.reduce((sum, item) => sum + item.price, 0);

  resultOutput.value = loot
    .map((item, index) => (
      `${index + 1}. ${item.name} — ${formatPrice(item.price)} ММ`
    ))
    .join("\n");

  resultMeta.textContent = (
    `${loot.length} предметов · ` +
    `общая стоимость ${formatPrice(total)} ММ · ` +
    `диапазон ${formatPrice(minBudget)}–${formatPrice(maxBudget)} ММ`
  );

  copyButton.disabled = false;
});

copyButton.addEventListener("click", async () => {
  if (!resultOutput.value) return;

  try {
    await navigator.clipboard.writeText(resultOutput.value);
    const previousText = copyButton.textContent;
    copyButton.textContent = "Скопировано";

    setTimeout(() => {
      copyButton.textContent = previousText;
    }, 1200);
  } catch (error) {
    resultOutput.focus();
    resultOutput.select();
    document.execCommand("copy");
  }
});

renderCategories();
