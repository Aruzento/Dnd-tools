(() => {
  "use strict";

  const RUNS = 1200;
  const BATCH_SIZE = 60;

  const successNode = document.getElementById("combat-success");
  const hardNode = document.getElementById("combat-hard");
  const failNode = document.getElementById("combat-fail");
  const stateNode = document.getElementById("combat-evaluation-state");
  const evaluationNode = document.getElementById("combat-evaluation");
  const enemyListNode = document.getElementById("enemy-list");
  const playersGridNode = document.getElementById("players-grid");

  if (!successNode || !hardNode || !failNode || !stateNode || !evaluationNode ||
      !enemyListNode || !playersGridNode) {
    return;
  }

  const PLAYER_PROFILES = window.PLAYER_COMBAT_PROFILES || {};

  const CR_DPR = {
    "0": 1, "0.125": 2.5, "0.25": 4.5, "0.5": 7,
    "1": 11.5, "2": 17.5, "3": 23.5, "4": 29.5, "5": 35.5,
    "6": 41.5, "7": 47.5, "8": 53.5, "9": 59.5, "10": 65.5,
    "11": 71.5, "12": 77.5, "13": 83.5, "14": 89.5, "15": 95.5,
    "16": 101.5, "17": 107.5, "18": 113.5, "19": 119.5, "20": 125.5
  };

  const CR_ATTACK = {
    "0": 3, "0.125": 3, "0.25": 3, "0.5": 3, "1": 3, "2": 3,
    "3": 4, "4": 5, "5": 6, "6": 6, "7": 6, "8": 7, "9": 7,
    "10": 7, "11": 8, "12": 8, "13": 8, "14": 8, "15": 8,
    "16": 9, "17": 10, "18": 10, "19": 10, "20": 10
  };

  const PHYSICAL = ["дробящий", "колющий", "рубящий"];

  let timer = null;
  let calculationId = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function avgDice(expression) {
    const text = String(expression || "")
      .toLowerCase()
      .replace(/к/g, "d")
      .replace(/−/g, "-")
      .replace(/\s+/g, "");

    const match = text.match(/^(\d+)d(\d+)([+-]\d+)?$/);
    if (!match) {
      const number = Number(text);
      return Number.isFinite(number) ? number : 0;
    }

    return Number(match[1]) * (Number(match[2]) + 1) / 2 + Number(match[3] || 0);
  }

  function parseCr(md) {
    const match = String(md || "").match(/(?:ориентировочно\s+)?КС\s+(\d+\/\d+|\d+)/i);
    if (!match) return 0;

    if (match[1].includes("/")) {
      const bits = match[1].split("/").map(Number);
      return bits[1] ? bits[0] / bits[1] : 0;
    }

    return Number(match[1]) || 0;
  }

  function crLookup(table, cr, fallback) {
    const direct = table[String(cr)];
    if (Number.isFinite(direct)) return direct;

    const rounded = clamp(Math.round(cr), 0, 20);
    const roundedValue = table[String(rounded)];
    return Number.isFinite(roundedValue) ? roundedValue : fallback;
  }

  function damageTypes(text) {
    const lower = String(text || "").toLowerCase();
    const dict = [
      ["дробящ", "дробящий"], ["колющ", "колющий"], ["рубящ", "рубящий"],
      ["огн", "огонь"], ["холод", "холод"], ["электр", "электричество"],
      ["яд", "яд"], ["некрот", "некротический"], ["излуч", "излучение"],
      ["псих", "психический"], ["силов", "силовое поле"], ["звук", "звук"],
      ["кислот", "кислота"]
    ];

    const result = [];
    for (const pair of dict) {
      if (lower.includes(pair[0]) && !result.includes(pair[1])) result.push(pair[1]);
    }
    return result;
  }

  function parseDefenses(md) {
    const result = { resist: [], immune: [] };
    const resist = String(md || "").match(/\*\*Сопротивлени[ея] урону:\*\*\s*([^\n]+)/i);
    const immune = String(md || "").match(/\*\*Иммунитет к урону:\*\*\s*([^\n]+)/i);

    if (resist) result.resist = damageTypes(resist[1]);
    if (immune) result.immune = damageTypes(immune[1]);

    return result;
  }

  function paragraphDamage(text) {
    const values = [];
    const regex = /`([^`]+)`/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const value = avgDice(match[1]);
      if (value > 0) values.push(value);
    }

    if (!values.length) return 0;

    const lower = text.toLowerCase();
    if (
      lower.includes("либо") ||
      lower.includes("при использовании") ||
      lower.includes("в ярости") ||
      lower.includes("если у ")
    ) {
      return Math.max.apply(null, values);
    }

    return values.reduce((sum, value) => sum + value, 0);
  }

  function extractEnemyProfile(enemy, hp) {
    const md =
      (window.ENEMY_MD_FALLBACK &&
       enemy.file &&
       window.ENEMY_MD_FALLBACK[enemy.file]) || "";

    const cr = parseCr(md);
    const acMatch = md.match(/\*\*КД:\*\*\s*(\d+)/i);
    const ac = acMatch ? Number(acMatch[1]) : 12 + Math.floor(cr / 3);

    let actions = md;
    const actionIndex = md.indexOf("## Действия");
    if (actionIndex >= 0) {
      actions = md.slice(actionIndex);
      const reactionIndex = actions.indexOf("## Реакции");
      if (reactionIndex >= 0) actions = actions.slice(0, reactionIndex);
    }

    const paragraphs = actions.split(/\n\s*\n/);
    const attacks = [];

    for (const paragraph of paragraphs) {
      const bonusMatch = paragraph.match(/([+-]\d+)\s+к попаданию/i);
      if (!bonusMatch) continue;

      const damage = paragraphDamage(paragraph);
      if (damage <= 0) continue;

      attacks.push({
        bonus: Number(bonusMatch[1]),
        damage: damage,
        types: damageTypes(paragraph)
      });
    }

    let multiCount = 1;
    const multi = actions.match(/\*\*Мультиатака\.\*\*\s*([^\n]+)/i);
    if (multi) {
      const low = multi[1].toLowerCase();
      if (/\bтри\b/.test(low)) multiCount = 3;
      else if (/\bдве\b|\bдва\b/.test(low)) multiCount = 2;
      else if (/\bчетыре\b/.test(low)) multiCount = 4;
    } else if (/один или два .*луча за ход/i.test(actions)) {
      multiCount = 2;
    }

    let attack;
    if (attacks.length) {
      attack = attacks.slice().sort((a, b) => b.damage - a.damage)[0];
    } else {
      attack = {
        bonus: crLookup(CR_ATTACK, cr, 4),
        damage: Math.max(2, crLookup(CR_DPR, cr, 8)),
        types: []
      };
      multiCount = 1;
    }

    const rawDpr = attack.damage * multiCount;
    const expectedByCr = crLookup(CR_DPR, cr, rawDpr);
    let scale = 1;

    if (rawDpr > 0 && expectedByCr > rawDpr) {
      scale = Math.min(1.45, expectedByCr / rawDpr);
    }

    const control =
      /паралич|ошелом|опутан|испуг|ослеп/i.test(actions) ? 1.08 : 1;

    const aoe =
      /сфер[аы]\s+радиус|конус|каждое .*существ/i.test(actions) ? 1.08 : 1;

    const defenses = parseDefenses(md);

    return {
      kind: "enemy",
      name: enemy.name,
      hp: Math.max(0, hp),
      maxHp: enemy.maxHp,
      ac: ac,
      attackBonus: Math.max(attack.bonus, scale > 1.2 ? crLookup(CR_ATTACK, cr, attack.bonus) : attack.bonus),
      damage: attack.damage * multiCount * scale * control * aoe,
      attacks: 1,
      damageTypes: attack.types,
      advantage: /Безрассудная атака/i.test(md),
      resist: defenses.resist,
      immune: defenses.immune
    };
  }

  function readPlayers() {
    return Array.from(playersGridNode.querySelectorAll(".player-card")).map((card) => {
      const name = (card.querySelector(".player-name")?.textContent || "").trim();
      const current = Number(card.querySelector(".player-current-hp")?.value);
      const maxHp = Number(card.querySelector(".player-total-hp")?.textContent);
      const ac = Number(card.querySelector(".player-ac")?.textContent);

      const profile = PLAYER_PROFILES[name] || {
        attackBonus: 5,
        damage: 8,
        attacks: 1,
        damageType: "неизвестный"
      };

      return {
        kind: "player",
        name,
        hp: Number.isFinite(current) ? current : maxHp,
        maxHp: Number.isFinite(maxHp) ? maxHp : 1,
        ac: Number.isFinite(ac) ? ac : 13,
        ...profile
      };
    }).filter((player) => player.name);
  }

  function readEnemies() {
    let source = [];

    try {
      if (typeof enemies !== "undefined" && Array.isArray(enemies)) {
        source = enemies;
      }
    } catch (error) {
      source = [];
    }

    return Array.from(enemyListNode.querySelectorAll(".enemy-entry")).map((entry) => {
      const select = entry.querySelector(".enemy-name");
      const hpInput = entry.querySelector(".enemy-current-hp");
      const enemy = source[Number(select?.value)];

      if (!enemy) return null;

      const hp = Number(hpInput?.value);
      return extractEnemyProfile(enemy, Number.isFinite(hp) ? hp : enemy.maxHp);
    }).filter(Boolean);
  }

  function cloneActors(list) {
    return list.map((actor) => ({
      ...actor,
      resist: Array.isArray(actor.resist) ? actor.resist.slice() : [],
      immune: Array.isArray(actor.immune) ? actor.immune.slice() : [],
      everDown: false,
      healCharges: actor.heal ? 1 : 0,
      surgeAvailable: Boolean(actor.actionSurge),
      secondWindAvailable: Boolean(actor.secondWind),
      relentlessAvailable: Boolean(actor.relentless)
    }));
  }

  function seededRandom(seed) {
    let x = seed >>> 0;

    return function () {
      x += 0x6D2B79F5;
      let t = x;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashState(players, foes) {
    let text = "";

    for (const player of players) {
      text += player.name + ":" + Math.round(player.hp) + ":" + player.ac + "|";
    }
    for (const foe of foes) {
      text += foe.name + ":" + Math.round(foe.hp) + ":" + foe.ac + "|";
    }

    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  function rollD20(random, advantage) {
    const first = 1 + Math.floor(random() * 20);
    if (!advantage) return first;
    const second = 1 + Math.floor(random() * 20);
    return Math.max(first, second);
  }

  function resistanceAdjusted(target, damage, types, attackerKind) {
    const list = Array.isArray(types) ? types : [];

    if (attackerKind === "enemy" && list.length &&
        list.every((type) => PHYSICAL.includes(type))) {
      if (target.physicalImmunity) return 0;
      if (target.physicalResistance) damage *= 0.5;
    }

    if (Array.isArray(target.immune) &&
        list.some((type) => target.immune.includes(type))) {
      return 0;
    }

    if (Array.isArray(target.resist) &&
        list.some((type) => target.resist.includes(type))) {
      damage *= 0.5;
    }

    return damage;
  }

  function makeAttack(attacker, target, random, options) {
    const attackBonus = Number(options.attackBonus) || 0;
    const averageDamage = Number(options.damage) || 0;
    const roll = rollD20(random, Boolean(options.advantage));

    if (roll === 1) return;
    if (roll !== 20 && roll + attackBonus < target.ac) return;

    let damage = averageDamage * (0.75 + random() * 0.5);
    if (roll === 20) damage *= 1.5;

    damage = resistanceAdjusted(
      target,
      damage,
      options.damageTypes || [],
      attacker.kind
    );

    target.hp -= damage;

    if (target.hp <= 0) {
      if (target.kind === "player" && target.relentlessAvailable) {
        target.relentlessAvailable = false;
        target.hp = 1;
      } else {
        target.hp = 0;
        target.everDown = true;
      }
    }
  }

  function chooseEnemy(foes, random) {
    const alive = foes.filter((foe) => foe.hp > 0);
    if (!alive.length) return null;

    if (random() < 0.7) {
      alive.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
      return alive[0];
    }

    return alive[Math.floor(random() * alive.length)];
  }

  function choosePlayer(players, random) {
    const alive = players.filter((player) => player.hp > 0);
    if (!alive.length) return null;

    if (random() < 0.55) {
      alive.sort((a, b) => {
        const hpDiff = (a.hp / a.maxHp) - (b.hp / b.maxHp);
        return hpDiff !== 0 ? hpDiff : a.ac - b.ac;
      });
      return alive[Math.floor(random() * Math.min(2, alive.length))];
    }

    return alive[Math.floor(random() * alive.length)];
  }

  function playerTurn(player, players, foes, round, random) {
    if (player.hp <= 0) return;

    if (player.secondWindAvailable && player.hp <= player.maxHp * 0.45) {
      player.secondWindAvailable = false;
      player.hp = Math.min(player.maxHp, player.hp + player.secondWind);
    }

    const downed = players.filter((ally) => ally !== player && ally.hp <= 0);

    if (player.healCharges > 0 && downed.length) {
      player.healCharges = 0;
      downed[0].hp = Math.min(downed[0].maxHp, player.heal);

      if (player.healMode === "action") return;
    }

    let attackCount = player.attacks || 1;

    if (player.surgeAvailable && round === 1) {
      player.surgeAvailable = false;
      attackCount += 1;
    }

    for (let i = 0; i < attackCount; i += 1) {
      const target = chooseEnemy(foes, random);
      if (!target) return;

      makeAttack(player, target, random, {
        attackBonus: player.attackBonus,
        damage: player.damage,
        damageTypes: [player.damageType],
        advantage: Boolean(player.advantage || (player.firstRoundAdvantage && round === 1))
      });
    }
  }

  function enemyTurn(enemy, players, random) {
    if (enemy.hp <= 0) return;

    const target = choosePlayer(players, random);
    if (!target) return;

    makeAttack(enemy, target, random, {
      attackBonus: enemy.attackBonus,
      damage: enemy.damage,
      damageTypes: enemy.damageTypes,
      advantage: enemy.advantage
    });
  }

  function simulate(playersBase, foesBase, random) {
    const players = cloneActors(playersBase);
    const foes = cloneActors(foesBase);

    const fullPlayerHp = players.reduce((sum, p) => sum + p.maxHp, 0);
    const fullEnemyHp = foes.reduce((sum, e) => sum + e.maxHp, 0);

    let rounds = 0;

    for (let round = 1; round <= 8; round += 1) {
      rounds = round;

      const order = [];

      for (const player of players) {
        order.push({ side: "player", actor: player, initiative: random() });
      }
      for (const foe of foes) {
        order.push({ side: "enemy", actor: foe, initiative: random() });
      }

      order.sort((a, b) => b.initiative - a.initiative);

      for (const turn of order) {
        if (turn.side === "player") {
          playerTurn(turn.actor, players, foes, round, random);
        } else {
          enemyTurn(turn.actor, players, random);
        }

        if (!players.some((p) => p.hp > 0) || !foes.some((e) => e.hp > 0)) {
          break;
        }
      }

      if (!players.some((p) => p.hp > 0) || !foes.some((e) => e.hp > 0)) {
        break;
      }
    }

    const alivePlayers = players.filter((p) => p.hp > 0);
    const aliveEnemies = foes.filter((e) => e.hp > 0);
    const currentPlayerHp = players.reduce((sum, p) => sum + Math.max(0, p.hp), 0);
    const currentEnemyHp = foes.reduce((sum, e) => sum + Math.max(0, e.hp), 0);
    const playerRatio = fullPlayerHp ? currentPlayerHp / fullPlayerHp : 0;
    const enemyRatio = fullEnemyHp ? currentEnemyHp / fullEnemyHp : 0;
    const downedCount = players.filter((p) => p.everDown).length;

    if (!alivePlayers.length) return "fail";

    if (!aliveEnemies.length) {
      if (downedCount === 0 && playerRatio >= 0.45 && rounds <= 5) {
        return "success";
      }
      return "hard";
    }

    if (playerRatio > enemyRatio * 1.35 &&
        alivePlayers.length >= Math.ceil(players.length / 2)) {
      return "hard";
    }

    return "fail";
  }

  function clearResult(message) {
    calculationId += 1;
    evaluationNode.classList.remove("is-calculating");
    successNode.textContent = "—";
    hardNode.textContent = "—";
    failNode.textContent = "—";
    stateNode.textContent = message;
  }

  function showError(error) {
    calculationId += 1;
    evaluationNode.classList.remove("is-calculating");
    successNode.textContent = "—";
    hardNode.textContent = "—";
    failNode.textContent = "—";
    stateNode.textContent = "Ошибка расчёта";
    console.error("[combat-evaluator]", error);
  }

  function evaluate() {
    const myId = ++calculationId;

    let players;
    let foes;

    try {
      players = readPlayers();
      foes = readEnemies().filter((foe) => foe.hp > 0);
    } catch (error) {
      showError(error);
      return;
    }

    if (!players.length) {
      clearResult("Нет данных игроков");
      return;
    }

    if (!foes.length) {
      clearResult("Добавьте врагов");
      return;
    }

    if (!players.some((player) => player.hp > 0)) {
      successNode.textContent = "0%";
      hardNode.textContent = "0%";
      failNode.textContent = "100%";
      stateNode.textContent = "Группа без сознания";
      return;
    }

    evaluationNode.classList.add("is-calculating");
    successNode.textContent = "…";
    hardNode.textContent = "…";
    failNode.textContent = "…";
    stateNode.textContent = "Расчёт 0%";

    const random = seededRandom(hashState(players, foes));
    const result = { success: 0, hard: 0, fail: 0 };
    let done = 0;

    function runBatch() {
      if (myId !== calculationId) return;

      try {
        const end = Math.min(done + BATCH_SIZE, RUNS);

        while (done < end) {
          const outcome = simulate(players, foes, random);
          result[outcome] += 1;
          done += 1;
        }

        const progress = Math.round(done / RUNS * 100);
        stateNode.textContent = `Расчёт ${progress}%`;

        if (done < RUNS) {
          setTimeout(runBatch, 0);
          return;
        }

        const success = Math.round(result.success / RUNS * 100);
        const fail = Math.round(result.fail / RUNS * 100);
        const hard = Math.max(0, 100 - success - fail);

        successNode.textContent = `${success}%`;
        hardNode.textContent = `${hard}%`;
        failNode.textContent = `${fail}%`;
        stateNode.textContent = `${RUNS.toLocaleString("ru-RU")} симуляций`;
        evaluationNode.classList.remove("is-calculating");
      } catch (error) {
        showError(error);
      }
    }

    setTimeout(runBatch, 0);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(evaluate, 120);
  }

  document.addEventListener("input", (event) => {
    if (
      event.target.matches(".player-current-hp") ||
      event.target.matches(".enemy-current-hp")
    ) {
      schedule();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches(".enemy-name")) schedule();
  });

  const observer = new MutationObserver(schedule);
  observer.observe(playersGridNode, { childList: true });
  observer.observe(enemyListNode, { childList: true });

  // Запускаем после того, как players.js/enemies.js успеют заполнить интерфейс.
  window.addEventListener("load", () => {
    setTimeout(schedule, 50);
  });
})();
