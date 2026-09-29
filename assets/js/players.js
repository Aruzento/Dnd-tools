const playersGrid = document.getElementById("players-grid");
const playersError = document.getElementById("players-error");

// Fallback для запуска через file://, где fetch соседнего CSV может быть запрещён.
const FALLBACK_PLAYERS_CSV = `имя;хиты;КД
Лазарь;18;14
Азраэль;15;13
Фредо;24;12
Марфа;23;14
Ренкай;31;19
Громм;35;15`;

function parsePlayersCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  return lines.slice(1).map((line) => {
    const parts = line.split(";").map((part) => part.trim());
    if (parts.length < 3) return null;

    const name = parts[0];
    const maxHp = Number(parts[1]);
    const armorClass = Number(parts[2]);

    if (!name || !Number.isFinite(maxHp) || maxHp < 0 || !Number.isFinite(armorClass)) {
      return null;
    }

    return { name, maxHp, armorClass };
  }).filter(Boolean);
}

function updatePlayerDeadState(card) {
  const currentHpInput = card.querySelector(".player-current-hp");
  const playerName = card.querySelector(".player-name");
  const hp = Number(currentHpInput.value);
  const isDead = Number.isFinite(hp) && hp === 0;

  card.classList.toggle("is-dead", isDead);
  playerName.classList.toggle("is-dead", isDead);
}

function createPlayerCard(player) {
  const card = document.createElement("article");
  card.className = "player-card";
  card.innerHTML = `
    <div class="player-name"></div>
    <div class="player-stats">
      <label class="player-stat">
        <span>Хиты</span>
        <input class="player-current-hp" type="number" min="0" step="1" inputmode="numeric" aria-label="Текущие хиты">
      </label>
      <div class="player-stat player-readonly-stat">
        <span>Всего</span>
        <strong class="player-total-hp"></strong>
      </div>
      <div class="player-stat player-readonly-stat">
        <span>КД</span>
        <strong class="player-ac"></strong>
      </div>
    </div>`;

  const name = card.querySelector(".player-name");
  const currentHp = card.querySelector(".player-current-hp");
  const totalHp = card.querySelector(".player-total-hp");
  const armorClass = card.querySelector(".player-ac");

  name.textContent = player.name;
  currentHp.value = String(player.maxHp);
  currentHp.max = String(player.maxHp);
  totalHp.textContent = String(player.maxHp);
  armorClass.textContent = String(player.armorClass);

  currentHp.addEventListener("input", () => {
    if (currentHp.value === "") {
      card.classList.remove("is-dead");
      name.classList.remove("is-dead");
      return;
    }

    let hp = Number(currentHp.value);
    if (!Number.isFinite(hp)) return;
    hp = Math.max(0, Math.min(player.maxHp, hp));

    if (String(hp) !== currentHp.value) {
      currentHp.value = String(hp);
    }

    updatePlayerDeadState(card);
  });

  return card;
}

async function loadPlayers() {
  let players;

  try {
    const response = await fetch("../data/players.csv", { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось загрузить players.csv");
    players = parsePlayersCsv(await response.text());
  } catch (error) {
    players = parsePlayersCsv(FALLBACK_PLAYERS_CSV);
  }

  if (!players.length) {
    playersError.textContent = "В players.csv нет доступных игроков.";
    return;
  }

  playersGrid.replaceChildren(...players.map(createPlayerCard));
}

loadPlayers();
