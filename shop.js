const categorySelect = document.getElementById("shop-category");
const refreshButton = document.getElementById("shop-refresh");
const shopList = document.getElementById("shop-list");
const shopSummary = document.getElementById("shop-summary");
const shopError = document.getElementById("shop-error");
const shopItemTemplate = document.getElementById("shop-item-template");

const shopItems = (Array.isArray(lootTable) ? lootTable : [])
  .map((item) => ({
    name: String(item.name ?? item["Предмет"] ?? "").trim(),
    description: String(item.description ?? item["Описание"] ?? "").trim(),
    price: Number(item.price ?? item["Стоимость"]),
    category: String(item.category ?? item["Категория"] ?? "").trim()
  }))
  .filter((item) => item.name && item.category && Number.isFinite(item.price) && item.price >= 0);

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

function formatPrice(price) {
  return `${price.toLocaleString("ru-RU")} ММ`;
}

function getCategories() {
  return [...new Set(shopItems.map((item) => item.category))]
    .sort((a, b) => a.localeCompare(b, "ru"));
}

function fillCategories() {
  const categories = getCategories();
  categorySelect.replaceChildren();

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  if (!categories.length) {
    categorySelect.disabled = true;
    refreshButton.disabled = true;
    shopError.textContent = "В базе лута нет категорий.";
  }
}

function renderShop() {
  shopError.textContent = "";
  shopList.replaceChildren();

  const category = categorySelect.value;
  if (!category) {
    shopSummary.textContent = "";
    return;
  }

  const categoryItems = shopItems.filter((item) => item.category === category);
  if (!categoryItems.length) {
    shopError.textContent = "В выбранной категории нет предметов.";
    shopSummary.textContent = "";
    return;
  }

  const desiredCount = randomInt(20, 50);
  const count = Math.min(desiredCount, categoryItems.length);
  const inventory = shuffled(categoryItems).slice(0, count);
  const fragment = document.createDocumentFragment();

  inventory.forEach((item) => {
    const node = shopItemTemplate.content.cloneNode(true);
    node.querySelector(".shop-item-name").textContent = item.name;
    node.querySelector(".shop-item-description").textContent = item.description || "Описание не указано.";
    node.querySelector(".shop-item-price").textContent = formatPrice(item.price);
    fragment.appendChild(node);
  });

  shopList.appendChild(fragment);
  shopSummary.textContent = `${category} · ${inventory.length} позиций`;
}

refreshButton.addEventListener("click", renderShop);
categorySelect.addEventListener("change", renderShop);

fillCategories();
if (!categorySelect.disabled) {
  renderShop();
}
