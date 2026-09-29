const moneyForm = document.getElementById("money-form");
const dndCopperInput = document.getElementById("dnd-copper");
const etaraCopperInput = document.getElementById("etara-copper");
const moneyError = document.getElementById("money-error");

// Курс конвертации: 1 ММ DND = 35 ММ Этара.
const ETARA_COPPER_PER_DND_COPPER = 35;

function parseAmount(input) {
  if (input.value.trim() === "") return null;
  const value = Number(input.value);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(10)));
}

moneyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  moneyError.textContent = "";

  const dndCopper = parseAmount(dndCopperInput);
  const etaraCopper = parseAmount(etaraCopperInput);

  if (Number.isNaN(dndCopper) || Number.isNaN(etaraCopper)) {
    moneyError.textContent = "Введите число не меньше нуля.";
    return;
  }

  // Верхнее поле всегда имеет приоритет, если заполнено.
  if (dndCopper !== null) {
    etaraCopperInput.value = formatNumber(dndCopper * ETARA_COPPER_PER_DND_COPPER);
    return;
  }

  if (etaraCopper !== null) {
    dndCopperInput.value = formatNumber(etaraCopper / ETARA_COPPER_PER_DND_COPPER);
    return;
  }

  moneyError.textContent = "Введите сумму хотя бы в одно поле.";
});
