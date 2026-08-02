(() => {
  "use strict";

  const ROUND_MS = 90_000;
  const LEVEL_MS = 30_000;
  const MAX_QUEUE = 5;
  const TAU = Math.PI * 2;

  const LEVELS = [
    { name: "Back-garden basics", subcopy: "Keep the first plates happy.", capacity: 6, cookMs: 9_000, supplyMs: 4_800, queueMs: 6_600 },
    { name: "More plates, less time", subcopy: "Jude is moving faster now.", capacity: 7, cookMs: 7_400, supplyMs: 3_700, queueMs: 5_400 },
    { name: "The sun is going down", subcopy: "Tiny green windows. Big BBQ energy.", capacity: 8, cookMs: 6_100, supplyMs: 2_850, queueMs: 4_400 }
  ];

  const CUSTOMERS = [
    { name: "Maya", group: "child", avatar: "🧒", order: "burger", color: "#b9df5d" },
    { name: "Graham", group: "adult", avatar: "🧔", order: "sausage", color: "#f1c64d" },
    { name: "Priya", group: "teen", avatar: "🧑‍🎓", order: "burger", color: "#e8a6ae" },
    { name: "Rob", group: "adult", avatar: "👨", order: "sausage", color: "#9ccbd0" },
    { name: "Nina", group: "child", avatar: "👧", order: "burger", color: "#d8b5e1" },
    { name: "Tom", group: "teen", avatar: "🧑", order: "sausage", color: "#f4a269" },
    { name: "Ellie", group: "adult", avatar: "👩", order: "burger", color: "#c6dca2" },
    { name: "Sam", group: "child", avatar: "👦", order: "sausage", color: "#e2c49b" },
    { name: "Aisha", group: "teen", avatar: "🧑‍🦱", order: "burger", color: "#d99aac" },
    { name: "Ben", group: "adult", avatar: "👨‍🦰", order: "sausage", color: "#a7c4df" }
  ];

  const JUDE_LINES = [
    "Hurry up, Dave!",
    "People are waiting!",
    "I'm doing the salad over here!",
    "You said you could do the barbecue!",
    "The sun's going down!",
    "Come on, bungle — make some space!",
    "C'mon Dave, I've got to get to the Post Office!",
    "Hurry up Dave, I've got to get back to Morrisons!",
    "Faster Dave. It's all burning!",
    "You can't even cook a burger, Dave!",
    "I'm starving, Dave — hurry up!",
    "The queue's getting bigger, Bungle!",
    "I need to put suncream on your big head — hurry up!"
  ];

  const JUDE_DIALOGUE = JUDE_LINES.concat([
    "Everyone's waiting, Dave!",
    "Hurry up, I've got to do the salad!",
    "We should never have had this BBQ — I knew you couldn't do it!",
    "I smell burning and it's not my fag!",
    "Ooooooo, me back! Where's me fag?"
  ]);

  const els = {
    canvas: document.getElementById("gameCanvas"),
    stageFrame: document.getElementById("stageFrame"),
    startOverlay: document.getElementById("startOverlay"),
    startButton: document.getElementById("startButton"),
    helpOverlay: document.getElementById("helpOverlay"),
    helpButton: document.getElementById("helpButton"),
    closeHelpButton: document.getElementById("closeHelpButton"),
    closeHelpButtonBottom: document.getElementById("closeHelpButtonBottom"),
    pauseButton: document.getElementById("pauseButton"),
    pauseOverlay: document.getElementById("pauseOverlay"),
    resumeButton: document.getElementById("resumeButton"),
    gameOverOverlay: document.getElementById("gameOverOverlay"),
    playAgainButton: document.getElementById("playAgainButton"),
    orientationOverlay: document.getElementById("orientationOverlay"),
    queueRibbon: document.getElementById("queueRibbon"),
    dragHint: document.getElementById("dragHint"),
    gameStatus: document.getElementById("gameStatus"),
    stageMessage: document.getElementById("stageMessage"),
    liveText: document.getElementById("liveText"),
    comboPill: document.getElementById("comboPill"),
    levelValue: document.getElementById("levelValue"),
    levelName: document.getElementById("levelName"),
    levelSubcopy: document.getElementById("levelSubcopy"),
    scoreValue: document.getElementById("scoreValue"),
    timeValue: document.getElementById("timeValue"),
    bestValue: document.getElementById("bestValue"),
    toast: document.getElementById("toast"),
    toastIcon: document.getElementById("toastIcon"),
    toastText: document.getElementById("toastText"),
    finalScore: document.getElementById("finalScore"),
    finalPerfect: document.getElementById("finalPerfect"),
    finalUnhappy: document.getElementById("finalUnhappy"),
    endSummary: document.getElementById("endSummary"),
    endEyebrow: document.getElementById("endEyebrow")
  };

  const ctx = els.canvas.getContext("2d");
  const images = { dave: new Image(), jude: new Image() };
  images.dave.src = "Dave.png";
  images.jude.src = "Jude.png";

  let state = createState();
  let lastFrame = 0;
  let frameId = null;
  let hudAccumulator = 0;
  let toastTimer = 0;
  let audioContext = null;

  function createState() {
    return {
      running: false,
      paused: false,
      elapsed: 0,
      levelIndex: 0,
      score: 0,
      best: readBestScore(),
      perfect: 0,
      unhappy: 0,
      served: 0,
      combo: 0,
      nextFoodId: 1,
      nextCustomerId: 1,
      grill: [],
      tray: [],
      queue: [],
      particles: [],
      reaction: null,
      serving: null,
      passDrop: null,
      flip: 0,
      exitCustomer: null,
      dragging: null,
      supplyAccumulator: 0,
      queueAccumulator: 0,
      supplyPending: false,
      jude: { x: -150, waiting: false, departing: 0, step: 0, speechIndex: 0, speechTimer: 0, speechVisible: 0, speechText: "" },
      banner: null,
      hintDismissed: false,
      scene: { width: 1280, height: 720, mobile: false, portrait: false, dpr: 1 },
      orientationPaused: false,
      time: 0,
      lastAnnouncement: ""
    };
  }

  function currentLevel() {
    return LEVELS[state.levelIndex];
  }

  function readBestScore() {
    try {
      return Number(window.localStorage.getItem("bbq-dash-best") || 0);
    } catch (error) {
      return 0;
    }
  }

  function saveBestScore() {
    try {
      window.localStorage.setItem("bbq-dash-best", String(state.best));
    } catch (error) {
      // The game does not depend on local storage.
    }
  }

  function resizeCanvas() {
    const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 900;
    state.scene.mobile = false;
    state.scene.portrait = portrait;
    state.scene.width = 1280;
    state.scene.height = 720;
    state.scene.dpr = Math.min(window.devicePixelRatio || 1, 2);
    els.canvas.width = Math.round(state.scene.width * state.scene.dpr);
    els.canvas.height = Math.round(state.scene.height * state.scene.dpr);
    els.orientationOverlay.classList.toggle("hidden", !portrait);
    if (portrait && state.running && !state.paused) {
      state.paused = true;
      state.orientationPaused = true;
    } else if (!portrait && state.orientationPaused) {
      state.paused = false;
      state.orientationPaused = false;
    }
    els.canvas.setAttribute("aria-label", "BBQ Dash landscape playfield. Drag food from the grill into the rectangular pass box, then watch it drop to the front customer's plate.");
    render();
  }

  function startGame() {
    if (frameId) window.cancelAnimationFrame(frameId);
    state = createState();
    state.running = true;
    resizeCanvas();
    seedQueue();
    addGrillFood("burger", 1_200);
    addGrillFood("sausage", 3_100);
    addGrillFood("burger", 5_000);
    state.supplyAccumulator = currentLevel().supplyMs * 0.52;
    state.hintDismissed = false;
    els.startOverlay.classList.add("hidden");
    els.helpOverlay.classList.add("hidden");
    els.pauseOverlay.classList.add("hidden");
    els.gameOverOverlay.classList.add("hidden");
    els.dragHint.classList.remove("dismissed");
    unlockAudio();
    showToast("Drag food to the hot grill!", "↗");
    announce("Service started. Drag Jude's tray to the BBQ, then drag green food into the pass box.");
    lastFrame = performance.now();
    hudAccumulator = 0;
    frameId = window.requestAnimationFrame(loop);
  }

  function seedQueue() {
    while (state.queue.length < 4) addCustomer();
  }

  function addCustomer() {
    const template = CUSTOMERS[(state.nextCustomerId - 1) % CUSTOMERS.length];
    state.queue.push({
      id: state.nextCustomerId++,
      name: template.name,
      group: template.group,
      avatar: template.avatar,
      order: template.order,
      color: template.color,
      mood: "waiting",
      bob: Math.random() * TAU
    });
  }

  function createFood(kind, ageMs = 0) {
    return {
      id: state.nextFoodId++,
      kind,
      ageMs,
      spawn: 1,
      wobble: Math.random() * TAU
    };
  }

  function addGrillFood(kind, ageMs = 0) {
    if (state.grill.length >= currentLevel().capacity) return null;
    const food = createFood(kind, ageMs);
    state.grill.push(food);
    return food;
  }

  function sayJude(line, duration = 2_200) {
    state.jude.speechText = line;
    state.jude.speechVisible = duration;
    announce(line);
  }

  function addTrayFood() {
    if (state.tray.length > 0) return null;
    const food = createFood(Math.random() > 0.48 ? "burger" : "sausage");
    state.tray.push(food);
    state.supplyPending = false;
    state.jude.waiting = false;
    state.jude.departing = 0;
    state.jude.speechIndex = (state.jude.speechIndex + 1) % JUDE_DIALOGUE.length;
    sayJude(JUDE_DIALOGUE[state.jude.speechIndex]);
    spawnBurst(judeTarget().x + 40, judeTarget().y + 12, "supply");
    announce("Jude has arrived with more food. Drag it onto an empty grill slot.");
    return food;
  }

  function trySupply() {
    if (state.tray.length > 0) return;
    if (state.grill.length >= currentLevel().capacity) {
      state.supplyPending = true;
      state.jude.waiting = true;
      state.jude.speechTimer = 0;
      showToast("Jude is waiting — make some space!", "!");
      sayJude(JUDE_DIALOGUE[state.jude.speechIndex]);
      return;
    }
    addTrayFood();
  }

  function loop(timestamp) {
    const delta = Math.min(80, Math.max(0, timestamp - lastFrame));
    lastFrame = timestamp;
    state.time += delta;
    if (state.running && !state.paused) update(delta);
    render();
    if (state.running) frameId = window.requestAnimationFrame(loop);
  }

  function update(delta) {
    const level = currentLevel();
    state.elapsed += delta;
    state.supplyAccumulator += delta;
    state.queueAccumulator += delta;
    state.jude.step += delta * 0.008;
    if (state.jude.speechVisible > 0) state.jude.speechVisible = Math.max(0, state.jude.speechVisible - delta);

    state.grill.forEach((food) => {
      food.ageMs += delta;
      food.spawn = Math.min(1, food.spawn + delta / 300);
    });
    if (state.flip > 0) state.flip = Math.max(0, state.flip - delta / 700);
    state.tray.forEach((food) => { food.spawn = Math.min(1, food.spawn + delta / 300); });

    if (state.tray.length === 0 && !state.jude.waiting && state.supplyAccumulator >= level.supplyMs) {
      state.supplyAccumulator = 0;
      trySupply();
    }

    if (state.jude.waiting) {
      state.jude.speechTimer += delta;
      if (state.jude.speechTimer >= 1_900) {
        state.jude.speechTimer = 0;
        state.jude.speechIndex = (state.jude.speechIndex + 1) % JUDE_DIALOGUE.length;
        sayJude(JUDE_DIALOGUE[state.jude.speechIndex]);
      }
    }

    if (state.jude.departing > 0) {
      state.jude.departing += delta;
      if (state.jude.departing >= 850) state.jude.departing = 0;
    }

    if (state.queueAccumulator >= level.queueMs && state.queue.length < MAX_QUEUE) {
      state.queueAccumulator = 0;
      addCustomer();
    }

    if (state.serving) {
      state.serving.t += delta / 650;
      if (state.serving.t >= 1) beginPassDrop();
    }

    if (state.passDrop) {
      state.passDrop.t += delta / 720;
      if (state.passDrop.t >= 1) completeServing();
    }

    if (state.exitCustomer) {
      state.exitCustomer.t += delta;
      if (state.exitCustomer.t >= 950) {
        state.queue.shift();
        if (state.queue.length < MAX_QUEUE) addCustomer();
        state.exitCustomer = null;
      }
    }

    if (state.reaction) {
      state.reaction.t += delta;
      if (state.reaction.t > 2_000) state.reaction = null;
    }

    updateParticles(delta);
    updateJudePosition(delta);

    const nextLevel = Math.min(LEVELS.length - 1, Math.floor(state.elapsed / LEVEL_MS));
    if (nextLevel !== state.levelIndex) {
      state.levelIndex = nextLevel;
      state.banner = { t: 0, title: LEVELS[nextLevel].name, subcopy: "The pace is picking up!" };
      spawnBurst(state.scene.width * 0.5, state.scene.height * 0.45, "level");
      showToast(`Level ${nextLevel + 1}: ${LEVELS[nextLevel].name}`, "↑");
      announce(`Level ${nextLevel + 1}. ${LEVELS[nextLevel].name}.`);
    }
    if (state.banner) {
      state.banner.t += delta;
      if (state.banner.t > 2_900) state.banner = null;
    }

    if (state.elapsed >= ROUND_MS) endGame();
    hudAccumulator += delta;
    if (hudAccumulator >= 90) {
      hudAccumulator = 0;
      updateHud();
    }
  }

  function updateJudePosition(delta) {
    const target = judeTarget();
    if (state.jude.waiting || state.tray.length > 0) {
      state.jude.x += (target.x - state.jude.x) * Math.min(1, delta / 260);
      return;
    }
    if (state.jude.departing > 0) {
      const leaveT = easeInOut(Math.min(1, state.jude.departing / 850));
      state.jude.x = lerp(target.x, state.scene.mobile ? -120 : -160, leaveT);
      return;
    }
    const approach = clamp(state.supplyAccumulator / (currentLevel().supplyMs * 0.86), 0, 1);
    state.jude.x = lerp(state.scene.mobile ? -120 : -160, target.x, easeOut(approach));
  }

  function updateParticles(delta) {
    state.particles = state.particles.filter((particle) => {
      particle.t += delta;
      particle.x += particle.vx * delta / 16;
      particle.y += particle.vy * delta / 16;
      particle.vy += particle.gravity * delta / 16;
      return particle.t < particle.life;
    });

    if (state.running && !state.paused && Math.random() < delta / 210) {
      const box = grillBounds();
      state.particles.push({ type: "smoke", x: box.x + box.w * (0.3 + Math.random() * 0.4), y: box.y + 13, vx: (Math.random() - 0.5) * 0.25, vy: -0.4 - Math.random() * 0.35, gravity: -0.005, t: 0, life: 1_300 + Math.random() * 800, size: 6 + Math.random() * 9 });
    }
    if (state.running && !state.paused && Math.random() < delta / 190) {
      const box = grillBounds();
      state.particles.push({ type: "ember", x: box.x + Math.random() * box.w, y: box.y + box.h - 17, vx: (Math.random() - 0.5) * 0.7, vy: -1.4 - Math.random() * 1.4, gravity: 0.015, t: 0, life: 480 + Math.random() * 420, size: 1.5 + Math.random() * 2.5 });
    }
  }

  function getCookState(food) {
    const ratio = food.ageMs / currentLevel().cookMs;
    if (ratio < 0.49) return "underdone";
    if (ratio <= 0.74) return "perfect";
    return "overdone";
  }

  function getResult(food, customer) {
    const cookState = getCookState(food);
    if (food.kind !== customer.order) return { state: "wrong", points: -6, good: false, icon: "×", text: "Wrong plate!", toast: `${customer.name} asked for a ${customer.order}. −6` };
    if (cookState === "perfect") return { state: "perfect", points: 10, good: true, icon: "♥", text: "Perfect!", toast: `${customer.name} is delighted! +10` };
    if (cookState === "underdone") return { state: "underdone", points: -5, good: false, icon: "~", text: "Still pink!", toast: `${customer.name} says it needs more time. −5` };
    return { state: "overdone", points: -8, good: false, icon: "♨", text: "Too smoky!", toast: `${customer.name} says it is charcoal. −8` };
  }

  function startServing(food, start) {
    if (state.serving || state.passDrop || state.exitCustomer || state.queue.length === 0) return;
    const customer = state.queue[0];
    const result = getResult(food, customer);
    state.serving = { food, customer, result, t: 0, start, end: passTarget().center };
    state.flip = 1;
    state.grill = state.grill.filter((item) => item.id !== food.id);
    state.dragging = null;
    state.hintDismissed = true;
    els.dragHint.classList.add("dismissed");
    spawnBurst(start.x, start.y, "flip");
    playTone(result.good ? 480 : 170, result.good ? 0.12 : 0.16, result.good ? "triangle" : "sawtooth");
    announce(`Sending ${food.kind} into the pass box for ${customer.name}.`);
    if (state.supplyPending && state.grill.length < currentLevel().capacity) {
      state.supplyPending = false;
      state.jude.waiting = false;
      addTrayFood();
    }
  }

  function beginPassDrop() {
    const serving = state.serving;
    if (!serving) return;
    state.passDrop = { food: serving.food, customer: serving.customer, result: serving.result, t: 0, start: passTarget().center, end: plateTarget().center };
    state.serving = null;
    spawnBurst(passTarget().center.x, passTarget().center.y, "drop");
    announce(`${serving.customer.name}'s plate is dropping from the pass.`);
    playTone(390, 0.1, "triangle");
  }

  function completeServing() {
    const delivery = state.passDrop;
    if (!delivery) return;
    const { result, customer } = delivery;
    if (state.queue[0]) state.queue[0].mood = result.good ? "happy" : "angry";
    state.exitCustomer = { customer, result, t: 0 };
    state.score += result.points;
    state.served += 1;
    if (result.good) {
      state.perfect += 1;
      state.combo += 1;
    } else {
      state.unhappy += 1;
      state.combo = 0;
    }
    if (state.score > state.best) {
      state.best = state.score;
      saveBestScore();
    }
    state.reaction = { text: result.text, icon: result.icon, good: result.good, t: 0, x: plateTarget().center.x, y: plateTarget().center.y - 75 };
    state.passDrop = null;
    spawnBurst(plateTarget().center.x, plateTarget().center.y, result.good ? "happy" : "sad");
    showToast(result.toast, result.icon);
    announce(`${customer.name}: ${result.text} ${formatPoints(result.points)}.`);
    playTone(result.good ? 720 : 120, result.good ? 0.2 : 0.18, result.good ? "sine" : "square");
    updateHud();
  }

  function loadTrayToGrill(food, slotIndex) {
    const emptySlot = getSlotRect(slotIndex);
    state.tray = state.tray.filter((item) => item.id !== food.id);
    state.grill.push(food);
    food.ageMs = 0;
    food.spawn = 0;
    state.jude.departing = 1;
    state.jude.waiting = false;
    state.supplyAccumulator = 0;
    state.hintDismissed = true;
    els.dragHint.classList.add("dismissed");
    spawnBurst(emptySlot.x + emptySlot.w / 2, emptySlot.y + emptySlot.h / 2, "drop");
    showToast(`${food.kind === "burger" ? "Burger" : "Sausage"} on the heat!`, "♨");
    announce(`${food.kind} placed on grill spot ${slotIndex + 1}. Watch for green.`);
    playTone(280, 0.1, "triangle");
  }

  function onPointerDown(event) {
    if (!state.running || state.paused || state.serving || state.passDrop) return;
    event.preventDefault();
    unlockAudio();
    const point = pointerPosition(event);
    const hit = hitFood(point);
    if (!hit) return;
    state.dragging = { source: hit.source, food: hit.food, index: hit.index, x: point.x, y: point.y, start: point };
    state.hintDismissed = true;
    els.dragHint.classList.add("dismissed");
    try { els.canvas.setPointerCapture(event.pointerId); } catch (error) { /* pointer capture is optional */ }
    playTone(250, 0.05, "triangle");
  }

  function onPointerMove(event) {
    if (!state.dragging) return;
    event.preventDefault();
    const point = pointerPosition(event);
    state.dragging.x = point.x;
    state.dragging.y = point.y;
  }

  function onPointerUp(event) {
    if (!state.dragging) return;
    event.preventDefault();
    const point = pointerPosition(event);
    const dragging = state.dragging;
    state.dragging = null;
    try { els.canvas.releasePointerCapture(event.pointerId); } catch (error) { /* pointer capture is optional */ }

    if (dragging.source === "tray") {
      const slotIndex = emptySlotAt(point);
      if (slotIndex >= 0) {
        loadTrayToGrill(dragging.food, slotIndex);
      } else {
        showToast("Drop Jude's food on an empty grill spot.", "↗");
      }
      return;
    }

    if (pointInRect(point, passTarget().rect)) {
      startServing(dragging.food, dragging.start);
    } else {
      showToast("Drop cooked food into the pass box.", "🍽");
    }
  }

  function onPointerCancel() {
    if (state.dragging) showToast("Food back on the grill.", "↩");
    state.dragging = null;
  }

  function pointerPosition(event) {
    const rect = els.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * state.scene.width, y: (event.clientY - rect.top) / rect.height * state.scene.height };
  }

  function hitFood(point) {
    if (state.tray[0] && pointInRect(point, trayRect())) return { source: "tray", food: state.tray[0], index: 0 };
    for (let index = state.grill.length - 1; index >= 0; index -= 1) {
      const rect = getSlotRect(index);
      if (pointInRect(point, rect)) return { source: "grill", food: state.grill[index], index };
    }
    return null;
  }

  function emptySlotAt(point) {
    for (let index = 0; index < currentLevel().capacity; index += 1) {
      const rect = getSlotRect(index);
      if (pointInRect(point, rect) && !state.grill[index]) return index;
    }
    return -1;
  }

  function getSlotRect(index) {
    const mobile = state.scene.mobile;
    const columns = mobile ? 2 : 3;
    const gap = mobile ? 13 : 12;
    const width = mobile ? 296 : 150;
    const height = mobile ? 101 : 112;
    const x = mobile ? 48 + (index % columns) * (width + gap) : 310 + (index % columns) * (width + gap);
    const y = mobile ? 318 + Math.floor(index / columns) * (height + gap) : 280 + Math.floor(index / columns) * (height + gap);
    return { x, y, w: width, h: height, center: { x: x + width / 2, y: y + height / 2 } };
  }

  function trayRect() {
    return state.scene.mobile ? { x: 44, y: 792, w: 305, h: 110 } : { x: 83, y: 525, w: 190, h: 105 };
  }

  function grillBounds() {
    return state.scene.mobile ? { x: 30, y: 280, w: 660, h: 495 } : { x: 273, y: 232, w: 625, h: 405 };
  }

  function passTarget() {
    const rect = { x: 925, y: 230, w: 240, h: 140 };
    return { rect, center: { x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.5 } };
  }

  function plateTarget() {
    return { center: { x: 1045, y: 492 } };
  }

  function judeTarget() {
    return state.scene.mobile ? { x: 202, y: 772 } : { x: 164, y: 470 };
  }

  function render() {
    ctx.setTransform(state.scene.dpr, 0, 0, state.scene.dpr, 0, 0);
    ctx.clearRect(0, 0, state.scene.width, state.scene.height);
    drawBackground();
    drawGardenDetails();
    drawQueue();
    drawDave();
    drawGrill();
    drawJude();
    drawParticles();
    drawServingFlight();
    drawPassDrop();
    drawReaction();
    drawBanner();
    drawDragOverlay();
  }

  function drawBackground() {
    const W = state.scene.width;
    const H = state.scene.height;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, state.scene.mobile ? "#547d88" : "#527e83");
    sky.addColorStop(0.45, "#e1a06c");
    sky.addColorStop(0.62, "#f3c67c");
    sky.addColorStop(1, "#4e7b4e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const sunX = state.scene.mobile ? W - 105 : W - 145;
    const sunY = state.scene.mobile ? 95 : 104;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#ffe4a0";
    ctx.beginPath(); ctx.arc(sunX, sunY, 78, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = "#ffdf8e";
    ctx.beginPath(); ctx.arc(sunX, sunY, 37, 0, TAU); ctx.fill();
    ctx.restore();

    const groundY = state.scene.mobile ? 225 : 230;
    ctx.fillStyle = "#3b6944";
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = "rgba(23, 54, 37, 0.18)";
    ctx.fillRect(0, groundY, W, 18);
    ctx.fillStyle = "rgba(255, 239, 171, 0.12)";
    ctx.fillRect(0, groundY + 20, W, 2);

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#112c1e";
    for (let i = 0; i < (state.scene.mobile ? 17 : 30); i += 1) {
      const x = (i * 87 + 31) % W;
      const h = 24 + (i % 4) * 12;
      ctx.beginPath(); ctx.arc(x, groundY + 34, 27 + (i % 3) * 7, Math.PI, TAU); ctx.fill();
      ctx.fillRect(x - 2, groundY + 25, 4, h);
    }
    ctx.restore();
  }

  function drawGardenDetails() {
    const W = state.scene.width;
    const fenceY = state.scene.mobile ? 210 : 205;
    ctx.save();
    ctx.fillStyle = "rgba(26, 65, 51, 0.36)";
    ctx.fillRect(0, fenceY, W, 7);
    for (let x = -12; x < W + 32; x += 52) {
      ctx.fillStyle = x % 104 === 0 ? "rgba(21, 59, 47, 0.28)" : "rgba(16, 53, 43, 0.18)";
      ctx.fillRect(x, fenceY - 18, 35, 71);
      ctx.fillStyle = "rgba(252, 224, 157, 0.12)";
      ctx.fillRect(x + 6, fenceY - 6, 2, 52);
    }
    ctx.strokeStyle = "rgba(247, 236, 180, 0.52)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (state.scene.mobile) {
      ctx.moveTo(24, 155); ctx.quadraticCurveTo(355, 185, 690, 130);
    } else {
      ctx.moveTo(30, 110); ctx.quadraticCurveTo(W * 0.44, 172, W - 20, 91);
    }
    ctx.stroke();
    const bulbs = state.scene.mobile ? 8 : 13;
    for (let i = 0; i < bulbs; i += 1) {
      const x = state.scene.mobile ? 34 + i * 91 : 52 + i * 97;
      const y = state.scene.mobile ? 158 + Math.sin(i * 0.8) * 7 : 123 + Math.sin(i * 0.8) * 22;
      ctx.fillStyle = i % 3 === 0 ? "#ffd56f" : i % 3 === 1 ? "#a6e0ba" : "#ffab72";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x, y + 3, 4, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(255, 236, 180, 0.9)";
    ctx.font = "900 15px Trebuchet MS, sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("DAVE'S BBQ", state.scene.mobile ? 44 : 280, state.scene.mobile ? 276 : 220);
    ctx.restore();
  }

  function drawGrill() {
    const box = grillBounds();
    ctx.save();
    drawShadow(box.x + box.w / 2, box.y + box.h + 15, box.w * 0.42, 20, "rgba(11, 28, 19, 0.32)");
    fillRoundRect(box.x, box.y, box.w, box.h, 25, "#18352a");
    strokeRoundRect(box.x, box.y, box.w, box.h, 25, "rgba(255, 246, 204, 0.25)", 2);

    const hoodH = state.scene.mobile ? 34 : 43;
    fillRoundRect(box.x + 9, box.y + 9, box.w - 18, hoodH, 17, "#11291f");
    fillRoundRect(box.x + box.w * 0.38, box.y + 3, box.w * 0.24, 10, 5, "#0d2119");
    ctx.fillStyle = "rgba(255, 238, 179, 0.2)";
    ctx.fillRect(box.x + 28, box.y + 25, box.w * 0.21, 3);
    ctx.fillRect(box.x + box.w - 88, box.y + 25, box.w * 0.09, 3);

    for (let index = 0; index < currentLevel().capacity; index += 1) drawSlot(index);
    drawFlames(box);
    ctx.fillStyle = "#0d2119";
    ctx.fillRect(box.x + 15, box.y + box.h - 20, box.w - 30, 7);
    ctx.fillStyle = "rgba(255, 174, 77, 0.5)";
    ctx.fillRect(box.x + 28, box.y + box.h - 18, box.w * 0.18, 2);
    ctx.fillRect(box.x + box.w * 0.62, box.y + box.h - 18, box.w * 0.17, 2);
    ctx.restore();
  }

  function drawSlot(index) {
    const rect = getSlotRect(index);
    const food = state.grill[index];
    const isDragging = state.dragging && state.dragging.source === "grill" && state.dragging.food.id === food?.id;
    const stateName = food ? getCookState(food) : "empty";
    const perfect = stateName === "perfect";
    const empty = !food;
    ctx.save();
    const fill = empty ? "rgba(8, 24, 18, 0.33)" : isDragging ? "#3a5434" : "rgba(8, 24, 18, 0.75)";
    fillRoundRect(rect.x, rect.y, rect.w, rect.h, 16, fill);
    if (perfect) {
      ctx.shadowColor = "rgba(210, 237, 98, 0.85)";
      ctx.shadowBlur = 19 + Math.sin(state.time / 150) * 5;
    }
    strokeRoundRect(rect.x, rect.y, rect.w, rect.h, 16, empty ? "rgba(247, 241, 223, 0.17)" : perfect ? "#d2ed62" : stateName === "overdone" ? "#ec744f" : "rgba(247, 241, 223, 0.22)", empty ? 1 : perfect ? 3 : 2);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(247, 241, 223, 0.57)";
    ctx.font = "900 9px Trebuchet MS, sans-serif";
    ctx.fillText(`SPOT ${String(index + 1).padStart(2, "0")}`, rect.x + 10, rect.y + 17);
    if (empty) {
      ctx.strokeStyle = "rgba(210, 237, 98, 0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rect.center.x, rect.center.y + 4, 13, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rect.center.x - 7, rect.center.y + 4); ctx.lineTo(rect.center.x + 7, rect.center.y + 4); ctx.moveTo(rect.center.x, rect.center.y - 3); ctx.lineTo(rect.center.x, rect.center.y + 11); ctx.stroke();
      ctx.fillStyle = "rgba(247, 241, 223, 0.52)";
      ctx.font = "800 8px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("DROP JUDE'S FOOD", rect.center.x, rect.y + rect.h - 12);
      ctx.restore();
      return;
    }

    const progress = clamp(food.ageMs / currentLevel().cookMs, 0, 1.24);
    const popScale = 0.87 + 0.13 * easeOut(food.spawn);
    drawFood(food.kind, rect.center.x, rect.y + rect.h * 0.47, Math.min(rect.w, rect.h) * 0.56 * popScale, stateName, state.time + food.wobble);
    drawSteam(rect.center.x + 18, rect.y + 31, 0.8 + progress * 0.3);
    drawMeter(rect.x + 10, rect.y + rect.h - 25, rect.w - 20, 7, progress);
    ctx.fillStyle = perfect ? "#d2ed62" : stateName === "overdone" ? "#ff9a62" : "#ffd36a";
    ctx.font = "950 8px Trebuchet MS, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(perfect ? "FLIP NOW" : stateName === "overdone" ? "SMOKING" : stateName === "underdone" ? "KEEP COOKING" : "WATCH IT", rect.x + 10, rect.y + rect.h - 7);
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(progress * 100)}%`, rect.x + rect.w - 10, rect.y + rect.h - 7);
    ctx.restore();
  }

  function drawDave() {
    const mobile = state.scene.mobile;
    const x = mobile ? 493 : 105;
    const y = mobile ? 204 : 188;
    const w = mobile ? 150 : 180;
    const h = mobile ? 137 : 205;
    const bob = Math.sin(state.time / 320) * 2;
    ctx.save();
    drawShadow(x + w * 0.52, y + h + 10, w * 0.4, 10, "rgba(11, 28, 19, 0.3)");
    fillRoundRect(x - 9, y + 47 + bob, w + 20, h - 42, 28, "#284f3a");
    fillRoundRect(x + 16, y + h - 80 + bob, w - 30, 74, 22, "#e8dbc0");
    drawCoverImage(images.dave, x, y + bob, w, h, 0.5, 0.18, 25);
    ctx.fillStyle = "rgba(18, 48, 35, 0.77)";
    ctx.beginPath(); ctx.moveTo(x + 26, y + h - 18); ctx.lineTo(x + w / 2, y + h - 70); ctx.lineTo(x + w - 22, y + h - 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f7eed5";
    ctx.font = "950 10px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DAVE", x + w / 2, y + h + 19);
    ctx.restore();

    const armX = mobile ? 505 : 232;
    const armY = mobile ? 292 : 292;
    const flipLift = state.flip > 0 ? Math.sin((1 - state.flip) * Math.PI) * (mobile ? 25 : 40) : 0;
    ctx.save();
    ctx.strokeStyle = "#e2aa82";
    ctx.lineWidth = mobile ? 11 : 14;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(armX, armY); ctx.quadraticCurveTo(armX + 32, armY - 22 - Math.sin(state.time / 190) * 6 - flipLift * 0.65, armX + 59, armY + 4 - flipLift); ctx.stroke();
    ctx.strokeStyle = "#18382a";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(armX + 49, armY - 7 - flipLift * 0.7); ctx.lineTo(armX + 76, armY - 19 - flipLift); ctx.stroke();
    ctx.restore();
  }

  function drawJude() {
    const target = judeTarget();
    const mobile = state.scene.mobile;
    const y = target.y;
    const step = Math.sin(state.jude.step) * 5;
    const waiting = state.jude.waiting;
    const x = state.jude.x + (waiting ? Math.sin(state.time / 65) * 2.5 : 0);
    ctx.save();
    drawShadow(x + 53, y + 173, 56, 13, "rgba(11, 28, 19, 0.3)");
    ctx.strokeStyle = "#233e31";
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x + 49, y + 112); ctx.lineTo(x + 35, y + 163 + step); ctx.moveTo(x + 70, y + 112); ctx.lineTo(x + 86, y + 163 - step); ctx.stroke();
    ctx.fillStyle = "#e6d7b4";
    ctx.beginPath(); ctx.ellipse(x + 29, y + 167 + step, 18, 7, -0.08, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 90, y + 167 - step, 18, 7, 0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = waiting ? "#c75e58" : "#d96f80";
    ctx.beginPath(); ctx.moveTo(x + 22, y + 53); ctx.quadraticCurveTo(x + 64, y + 36, x + 91, y + 68); ctx.lineTo(x + 82, y + 128); ctx.lineTo(x + 20, y + 128); ctx.closePath(); ctx.fill();
    drawCoverImage(images.jude, x + 24, y, 62, 80, 0.5, 0.05, 22);
    ctx.strokeStyle = "#e7aa9b";
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(x + 27, y + 73); ctx.lineTo(x - 8, y + 103); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 81, y + 72); ctx.lineTo(x + 108, y + 89); ctx.stroke();
    const tray = trayRect();
    if (state.tray.length > 0) {
      const trayX = mobile ? x + 64 : x + 76;
      const trayY = y + 91;
      ctx.save();
      ctx.translate(trayX, trayY + Math.sin(state.time / 200) * 2);
      ctx.rotate(-0.06);
      fillRoundRect(-44, -11, 90, 18, 8, "#f5db9b");
      strokeRoundRect(-44, -11, 90, 18, 8, "#9b5d3d", 2);
      ctx.restore();
      drawFood(state.tray[0].kind, trayX, trayY - 17, 40, "perfect", state.time);
    }
    ctx.fillStyle = waiting ? "#ffe0a0" : "#f6efda";
    ctx.font = "950 9px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("JUDE", x + 55, y + 190);
    if (state.jude.speechVisible > 0 && state.jude.speechText) drawSpeechBubble(x - 55, y - 178, state.jude.speechText, 105);
    ctx.restore();
  }

  function drawQueue() {
    const pass = passTarget();
    const plate = plateTarget();
    const front = state.exitCustomer ? state.exitCustomer.customer : state.queue[0];
    if (front) {
      const baseX = plate.center.x - 32;
      const exitT = state.exitCustomer ? easeOut(clamp(state.exitCustomer.t / 950, 0, 1)) : 0;
      const exitDirection = state.exitCustomer?.result.good ? 1 : -1;
      const exitX = baseX + exitDirection * exitT * (state.scene.mobile ? 135 : 180);
      drawCustomer(front, exitX, plate.center.y - 82, true, 1.1);
      drawPlate(plate.center.x, plate.center.y, front.order, true);
    }
    const behind = state.queue.slice(1);
    behind.forEach((customer, index) => {
      const p = state.scene.mobile
        ? { x: 70 + index * 130, y: 159 + (index % 2) * 22 }
        : { x: 1095 + index * 52, y: 475 + (index % 2) * 14 };
      drawCustomer(customer, p.x, p.y, false, customer.group === "child" ? 0.72 : customer.group === "teen" ? 0.83 : 0.92);
      drawPlate(p.x + 27, p.y + 63, customer.order, false);
    });

    ctx.save();
    const rect = pass.rect;
    const glow = state.dragging && state.dragging.source === "grill";
    const moving = state.serving || state.passDrop;
    ctx.globalAlpha = 0.98;
    fillRoundRect(rect.x, rect.y, rect.w, rect.h, 18, glow ? "rgba(47, 77, 47, 0.98)" : "rgba(18, 48, 36, 0.96)");
    strokeRoundRect(rect.x, rect.y, rect.w, rect.h, 18, glow ? "#d2ed62" : "rgba(255, 239, 177, 0.72)", glow ? 4 : 2);
    fillRoundRect(rect.x + 12, rect.y + 31, rect.w - 24, rect.h - 43, 12, glow ? "rgba(210, 237, 98, 0.13)" : "rgba(4, 20, 14, 0.48)");
    ctx.strokeStyle = glow ? "rgba(210, 237, 98, 0.8)" : "rgba(255, 239, 177, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.w / 2, rect.y + 45);
    ctx.lineTo(rect.x + rect.w / 2, rect.y + rect.h - 22);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = glow ? "#d2ed62" : "rgba(255, 244, 209, 0.9)";
    ctx.font = "950 10px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(glow ? "DROP FOOD HERE" : "PASS BOX", rect.x + rect.w / 2, rect.y + 18);
    ctx.fillStyle = moving ? "#ffd36a" : "rgba(255, 244, 209, 0.62)";
    ctx.font = "800 8px Trebuchet MS, sans-serif";
    ctx.fillText(moving ? "ON ITS WAY TO THE PLATE" : "FOOD DROPS TO FRONT PLATE", rect.x + rect.w / 2, rect.y + rect.h - 9);
    ctx.restore();
  }

  function drawCustomer(customer, x, y, front, scale) {
    const size = 48 * scale;
    const bob = Math.sin(state.time / 350 + customer.bob) * (front ? 2.8 : 1.6);
    const shake = customer.mood === "angry" ? Math.sin(state.time / 48) * 2.5 : 0;
    ctx.save();
    ctx.translate(x + shake, y + bob);
    drawShadow(0, 64 * scale, 32 * scale, 7 * scale, "rgba(13, 34, 24, 0.25)");
    const bodyColor = customer.group === "child" ? "#e88970" : customer.group === "teen" ? "#5d8f9f" : "#a86463";
    const hairColor = customer.group === "child" ? "#694b40" : customer.group === "teen" ? "#263d42" : "#3e3230";
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.moveTo(-24 * scale, 63 * scale); ctx.quadraticCurveTo(-28 * scale, 28 * scale, 0, 24 * scale); ctx.quadraticCurveTo(28 * scale, 28 * scale, 24 * scale, 63 * scale); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e8ad83";
    ctx.beginPath(); ctx.arc(0, 14 * scale, 20 * scale, 0, TAU); ctx.fill();
    ctx.fillStyle = hairColor;
    ctx.beginPath(); ctx.arc(0, 7 * scale, 20 * scale, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "#1e2a25";
    ctx.beginPath(); ctx.arc(-7 * scale, 16 * scale, 2 * scale, 0, TAU); ctx.arc(7 * scale, 16 * scale, 2 * scale, 0, TAU); ctx.fill();
    ctx.strokeStyle = customer.mood === "angry" ? "#9c4b42" : "#704236";
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    if (customer.mood === "happy") { ctx.arc(0, 22 * scale, 7 * scale, 0, Math.PI); } else if (customer.mood === "angry") { ctx.moveTo(-7 * scale, 25 * scale); ctx.lineTo(7 * scale, 21 * scale); } else { ctx.moveTo(-5 * scale, 24 * scale); ctx.lineTo(5 * scale, 24 * scale); }
    ctx.stroke();
    if (front) {
      ctx.fillStyle = "rgba(251, 243, 223, 0.9)";
      ctx.font = "950 9px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(customer.name, 0, -32 * scale);
      ctx.fillStyle = "#f6efda";
      ctx.fillRect(-4 * scale, 42 * scale, 8 * scale, 9 * scale);
    }
    ctx.restore();
  }

  function drawPlate(x, y, order, front) {
    ctx.save();
    ctx.fillStyle = "rgba(13, 34, 24, 0.24)";
    ctx.beginPath(); ctx.ellipse(x, y + 5, front ? 39 : 21, front ? 12 : 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#f8ecd1";
    ctx.strokeStyle = front ? "#d2ed62" : "rgba(247, 241, 223, 0.55)";
    ctx.lineWidth = front ? 3 : 2;
    ctx.beginPath(); ctx.ellipse(x, y, front ? 37 : 20, front ? 11 : 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    drawFood(order, x, y - (front ? 9 : 5), front ? 34 : 20, "perfect", state.time);
    ctx.restore();
  }

  function drawFood(kind, x, y, size, foodState, wobble) {
    const s = size / 54;
    const jiggle = Math.sin(wobble / 160) * (foodState === "perfect" ? 1.5 : 0.6);
    ctx.save();
    ctx.translate(x, y + jiggle);
    ctx.scale(s, s);
    if (kind === "burger") drawBurger(foodState); else drawSausage(foodState);
    ctx.restore();
  }

  function drawFlames(box) {
    const baseY = box.y + box.h - 25;
    const count = state.scene.mobile ? 4 : 7;
    ctx.save();
    for (let index = 0; index < count; index += 1) {
      const x = box.x + 54 + index * ((box.w - 108) / Math.max(1, count - 1));
      const wave = Math.sin(state.time / 150 + index * 1.7) * 5;
      const height = 12 + (Math.sin(state.time / 175 + index) + 1) * 5;
      ctx.fillStyle = index % 2 ? "rgba(255, 157, 70, 0.7)" : "rgba(255, 206, 97, 0.76)";
      ctx.beginPath();
      ctx.moveTo(x - 7, baseY);
      ctx.quadraticCurveTo(x - 10 + wave, baseY - height * 0.48, x + wave, baseY - height);
      ctx.quadraticCurveTo(x + 9 + wave, baseY - height * 0.45, x + 7, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255, 239, 177, 0.66)";
      ctx.beginPath();
      ctx.moveTo(x - 3, baseY);
      ctx.quadraticCurveTo(x - 4 + wave, baseY - height * 0.38, x + 1 + wave, baseY - height * 0.63);
      ctx.quadraticCurveTo(x + 5 + wave, baseY - height * 0.3, x + 3, baseY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBurger(foodState) {
    const dark = foodState === "overdone" ? "#4e3028" : "#6d3d27";
    const bun = foodState === "overdone" ? "#8b5838" : "#d99b4e";
    ctx.fillStyle = "rgba(9, 23, 15, 0.42)";
    ctx.beginPath(); ctx.ellipse(0, 24, 35, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#d78f43"; roundRectPath(-32, 8, 64, 16, 7); ctx.fill();
    ctx.fillStyle = dark; roundRectPath(-31, -2, 62, 17, 7); ctx.fill();
    ctx.fillStyle = "#e8ce56"; ctx.beginPath(); ctx.moveTo(-29, -4); ctx.lineTo(30, -4); ctx.lineTo(22, 6); ctx.lineTo(-20, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#83ad4b"; ctx.beginPath(); ctx.arc(-20, -7, 8, 0, Math.PI); ctx.arc(-5, -8, 8, 0, Math.PI); ctx.arc(11, -7, 8, 0, Math.PI); ctx.arc(25, -7, 7, 0, Math.PI); ctx.fill();
    ctx.fillStyle = bun; ctx.beginPath(); ctx.ellipse(0, -16, 35, 18, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255, 235, 171, 0.65)";
    for (let i = -2; i <= 2; i += 1) { ctx.beginPath(); ctx.ellipse(i * 10, -21 + Math.abs(i) * 1.5, 2.4, 1.3, -0.3, 0, TAU); ctx.fill(); }
  }

  function drawSausage(foodState) {
    const sausage = foodState === "overdone" ? "#532c27" : "#bd563b";
    ctx.fillStyle = "rgba(9, 23, 15, 0.42)";
    ctx.beginPath(); ctx.ellipse(0, 19, 39, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#dca565"; roundRectPath(-40, -9, 80, 25, 12); ctx.fill();
    ctx.fillStyle = sausage; roundRectPath(-31, -14, 62, 17, 8); ctx.fill();
    ctx.strokeStyle = foodState === "overdone" ? "#2b1815" : "#7d3027"; ctx.lineWidth = 2;
    for (let x = -17; x < 25; x += 14) { ctx.beginPath(); ctx.moveTo(x, -12); ctx.lineTo(x - 6, 2); ctx.stroke(); }
    ctx.strokeStyle = "#f4d36d"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-23, 9); ctx.quadraticCurveTo(-5, 3, 11, 10); ctx.stroke();
  }

  function drawServingFlight() {
    if (!state.serving) return;
    const flight = state.serving;
    const t = easeInOut(clamp(flight.t, 0, 1));
    const x = lerp(flight.start.x, flight.end.x, t);
    const y = lerp(flight.start.y, flight.end.y, t) - Math.sin(t * Math.PI) * (state.scene.mobile ? 125 : 170);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * Math.PI * 3);
    drawFood(flight.food.kind, 0, 0, state.scene.mobile ? 59 : 67, getCookState(flight.food), state.time);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = "#fff2b3";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 12]);
    ctx.beginPath(); ctx.moveTo(flight.start.x, flight.start.y); ctx.quadraticCurveTo((flight.start.x + flight.end.x) / 2, flight.start.y - 170, flight.end.x, flight.end.y); ctx.stroke();
    ctx.restore();
  }

  function drawPassDrop() {
    if (!state.passDrop) return;
    const delivery = state.passDrop;
    const t = easeInOut(clamp(delivery.t, 0, 1));
    const x = lerp(delivery.start.x, delivery.end.x, t);
    const y = lerp(delivery.start.y, delivery.end.y, t) - Math.sin(t * Math.PI) * 18;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "#ffd36a";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 8]);
    ctx.beginPath();
    ctx.moveTo(delivery.start.x, delivery.start.y);
    ctx.lineTo(delivery.end.x, delivery.end.y);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * Math.PI) * 0.15);
    drawFood(delivery.food.kind, 0, 0, state.scene.mobile ? 59 : 67, getCookState(delivery.food), state.time);
    ctx.restore();
  }

  function drawDragOverlay() {
    if (!state.dragging) return;
    const food = state.dragging.food;
    const x = state.dragging.x;
    const y = state.dragging.y;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#d2ed62";
    ctx.beginPath(); ctx.arc(x, y, 47 + Math.sin(state.time / 120) * 4, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    drawFood(food.kind, x, y - 13, state.scene.mobile ? 65 : 72, state.dragging.source === "grill" ? getCookState(food) : "perfect", state.time);
    ctx.restore();
  }

  function drawReaction() {
    if (!state.reaction) return;
    const reaction = state.reaction;
    const fade = clamp(1 - Math.max(0, reaction.t - 1_200) / 800, 0, 1);
    const rise = Math.min(36, reaction.t / 1_200 * 36);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = reaction.good ? "#d2ed62" : "#ffb06f";
    ctx.font = "950 22px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${reaction.icon} ${reaction.text}`, reaction.x, reaction.y - rise);
    ctx.restore();
  }

  function drawBanner() {
    if (!state.banner) return;
    const t = state.banner.t;
    const fade = t < 250 ? t / 250 : t > 2_500 ? (2_900 - t) / 400 : 1;
    const W = state.scene.width;
    const H = state.scene.height;
    ctx.save();
    ctx.globalAlpha = clamp(fade, 0, 1);
    fillRoundRect(W * 0.19, H * 0.39, W * 0.62, 116, 25, "rgba(16, 33, 25, 0.92)");
    ctx.strokeStyle = "#d2ed62"; ctx.lineWidth = 2; roundRectPath(W * 0.19, H * 0.39, W * 0.62, 116, 25); ctx.stroke();
    ctx.fillStyle = "#d2ed62"; ctx.font = "950 10px Trebuchet MS, sans-serif"; ctx.textAlign = "center"; ctx.fillText("LEVEL UP", W / 2, H * 0.39 + 29);
    ctx.fillStyle = "#fbf3df"; ctx.font = "950 25px Trebuchet MS, sans-serif"; ctx.fillText(state.banner.title, W / 2, H * 0.39 + 62);
    ctx.fillStyle = "rgba(251,243,223,0.68)"; ctx.font = "800 11px Trebuchet MS, sans-serif"; ctx.fillText(state.banner.subcopy, W / 2, H * 0.39 + 86);
    ctx.restore();
  }

  function drawParticles() {
    state.particles.forEach((particle) => {
      const life = clamp(1 - particle.t / particle.life, 0, 1);
      ctx.save();
      ctx.globalAlpha = life * (particle.type === "smoke" ? 0.28 : 0.9);
      if (particle.type === "smoke") {
        ctx.fillStyle = "#f7f0db";
        ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size * (1 + (1 - life) * 1.2), 0, TAU); ctx.fill();
      } else if (particle.type === "ember") {
        ctx.fillStyle = "#ff9f53";
        ctx.shadowColor = "#ff9f53"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = particle.color || "#d2ed62";
        ctx.font = `${particle.size}px Trebuchet MS, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(particle.symbol || "✦", particle.x, particle.y);
      }
      ctx.restore();
    });
  }

  function drawSteam(x, y, amount) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 242, 212, 0.33)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i += 1) {
      const wave = Math.sin(state.time / 260 + i) * 4;
      ctx.beginPath(); ctx.moveTo(x + i * 9, y); ctx.quadraticCurveTo(x - 5 + wave + i * 9, y - 10 * amount, x + 4 + i * 9, y - 20 * amount); ctx.stroke();
    }
    ctx.restore();
  }

  function drawMeter(x, y, width, height, progress) {
    const safeProgress = clamp(progress, 0, 1);
    ctx.save();
    fillRoundRect(x, y, width, height, height / 2, "rgba(247, 241, 223, 0.14)");
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, "#ffd36a");
    gradient.addColorStop(0.48, "#ffd36a");
    gradient.addColorStop(0.49, "#d2ed62");
    gradient.addColorStop(0.74, "#d2ed62");
    gradient.addColorStop(0.75, "#f47a3f");
    gradient.addColorStop(1, "#e65743");
    fillRoundRect(x, y, width, height, height / 2, gradient);
    ctx.fillStyle = "rgba(16, 26, 25, 0.42)";
    ctx.fillRect(x + width * 0.49, y, 2, height);
    ctx.fillRect(x + width * 0.74, y, 2, height);
    ctx.fillStyle = "#fbf3df";
    ctx.beginPath(); ctx.arc(x + width * safeProgress, y + height / 2, height * 0.9, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawSpeechBubble(x, y, text, tailOffset = 36) {
    const width = state.scene.mobile ? 310 : 300;
    const lineHeight = 17;
    ctx.font = "900 15px Georgia, serif";
    const lines = wrapLines(text, width - 24);
    const height = Math.max(68, 25 + lines.length * lineHeight);
    const bubbleX = clamp(x, 16, state.scene.width - width - 16);
    const bubbleY = clamp(y, 20, state.scene.height - height - 22);
    ctx.save();
    fillRoundRect(bubbleX, bubbleY, width, height, 16, "#fbf3df");
    strokeRoundRect(bubbleX, bubbleY, width, height, 16, "#17382a", 3);
    ctx.fillStyle = "#17382a";
    const tailX = clamp(bubbleX + tailOffset, bubbleX + 25, bubbleX + width - 38);
    ctx.beginPath(); ctx.moveTo(tailX - 8, bubbleY + height); ctx.lineTo(tailX + 8, bubbleY + height); ctx.lineTo(tailX - 1, bubbleY + height + 17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#17382a";
    ctx.textAlign = "left";
    lines.forEach((line, index) => ctx.fillText(line, bubbleX + 14, bubbleY + 23 + index * lineHeight));
    ctx.restore();
  }

  function renderQueueRibbon() {
    els.queueRibbon.innerHTML = state.queue.map((person, index) => `
      <div class="queue-person ${index === 0 ? "front" : ""}">
        <span class="person-face" style="background:${person.color}" aria-hidden="true">${person.avatar}</span>
        <span class="queue-person-copy"><strong>${person.name}</strong><small>${person.group}</small><span class="queue-order">${person.order === "burger" ? "🍔" : "🌭"} ${person.order}</span></span>
        <span class="queue-plate" aria-hidden="true">🍽</span>
      </div>`).join("");
  }

  function updateHud() {
    const remaining = Math.max(0, Math.ceil((ROUND_MS - state.elapsed) / 1_000));
    const minutes = Math.floor(remaining / 60);
    const seconds = String(remaining % 60).padStart(2, "0");
    const level = currentLevel();
    els.levelValue.textContent = String(state.levelIndex + 1);
    els.levelName.textContent = level.name;
    els.levelSubcopy.textContent = level.subcopy;
    els.scoreValue.textContent = String(state.score);
    els.timeValue.textContent = `${minutes}:${seconds}`;
    els.bestValue.textContent = String(state.best);
    els.comboPill.textContent = `COMBO x${state.combo}`;
    els.pauseButton.textContent = state.paused ? "▶" : "Ⅱ";
    els.liveText.textContent = state.paused ? "PAUSED" : state.jude.waiting ? "JUDE IS WAITING" : "LIVE SERVICE";
    els.stageMessage.textContent = getStageMessage();
    renderQueueRibbon();
  }

  function getStageMessage() {
    if (state.paused) return "Service paused.";
    if (state.serving) return "Dave is flipping food into the pass box...";
    if (state.passDrop) return "The pass is dropping it onto the front plate...";
    if (state.jude.waiting) return "Jude is waiting for an empty grill spot.";
    if (state.tray.length > 0) return "Drag Jude's tray onto an empty grill spot.";
    if (state.dragging?.source === "grill") return "Now drop it into the rectangular pass box.";
    const perfect = state.grill.some((food) => getCookState(food) === "perfect");
    if (perfect) return "Green food is ready — drag it into the pass box!";
    return "Watch the green cooking window, then use the pass box.";
  }

  function endGame() {
    state.running = false;
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = null;
    updateHud();
    els.finalScore.textContent = String(state.score);
    els.finalPerfect.textContent = String(state.perfect);
    els.finalUnhappy.textContent = String(state.unhappy);
    els.endEyebrow.textContent = state.score >= 50 ? "THE GARDEN IS CHEERING" : state.score >= 0 ? "SERVICE COMPLETE" : "THE COALS WON";
    els.endSummary.textContent = state.score >= 50 ? "Dave, Jude and the queue are calling that a blinder." : state.score >= 0 ? "A few smoky moments, but the garden was fed." : "Jude has a few notes for Dave about timing.";
    window.setTimeout(() => els.gameOverOverlay.classList.remove("hidden"), 350);
  }

  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    if (state.paused) els.pauseOverlay.classList.remove("hidden"); else els.pauseOverlay.classList.add("hidden");
    updateHud();
    announce(state.paused ? "Service paused." : "Service resumed.");
  }

  function openHelp() {
    if (state.running && !state.paused) togglePause();
    els.helpOverlay.classList.remove("hidden");
  }

  function closeHelp() {
    els.helpOverlay.classList.add("hidden");
  }

  function showToast(message, icon) {
    window.clearTimeout(toastTimer);
    els.toastText.textContent = message;
    els.toastIcon.textContent = icon || "✦";
    els.toast.classList.add("show");
    toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 2_450);
  }

  function announce(message) {
    if (message === state.lastAnnouncement) return;
    state.lastAnnouncement = message;
    els.gameStatus.textContent = message;
  }

  function spawnBurst(x, y, kind) {
    const count = kind === "level" ? 32 : kind === "supply" ? 10 : 14;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const speed = 0.45 + Math.random() * (kind === "level" ? 2.4 : 1.6);
      const symbol = kind === "happy" ? (i % 2 ? "♥" : "✦") : kind === "sad" ? (i % 2 ? "~" : "×") : kind === "supply" ? "✦" : "•";
      state.particles.push({ type: "spark", x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.7, gravity: 0.02, t: 0, life: 650 + Math.random() * 850, size: 12 + Math.random() * 8, color: kind === "happy" ? "#d2ed62" : kind === "sad" ? "#ffad72" : kind === "level" ? "#ffd36a" : "#fbf3df", symbol });
    }
  }

  function unlockAudio() {
    if (!audioContext) {
      try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); } catch (error) { audioContext = null; }
    }
    if (audioContext?.state === "suspended") audioContext.resume();
  }

  function playTone(frequency, duration, type) {
    if (!audioContext) return;
    try {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, audioContext.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration + 0.02);
    } catch (error) {
      // Audio is an enhancement; gameplay should never depend on it.
    }
  }

  function formatPoints(points) { return points > 0 ? `+${points}` : String(points).replace("-", "−"); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function pointInRect(point, rect) { return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h; }

  function drawCoverImage(image, x, y, w, h, focusX, focusY, radius) {
    if (!image.complete || !image.naturalWidth) return;
    ctx.save();
    roundRectPath(x, y, w, h, radius);
    ctx.clip();
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    ctx.drawImage(image, x + (w - dw) * focusX, y + (h - dh) * focusY, dw, dh);
    ctx.restore();
  }

  function drawShadow(x, y, rx, ry, color) {
    ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore();
  }

  function fillRoundRect(x, y, w, h, radius, color) { roundRectPath(x, y, w, h, radius); ctx.fillStyle = color; ctx.fill(); }
  function strokeRoundRect(x, y, w, h, radius, color, lineWidth) { roundRectPath(x, y, w, h, radius); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke(); }
  function roundRectPath(x, y, w, h, radius = 0) { const r = Math.min(radius, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function wrapLines(text, maxWidth) {
    const words = text.split(" ");
    let line = "";
    const lines = [];
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else { line = test; }
    });
    if (line) lines.push(line);
    return lines;
  }

  els.canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  els.canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  els.canvas.addEventListener("pointerup", onPointerUp, { passive: false });
  els.canvas.addEventListener("pointercancel", onPointerCancel, { passive: false });
  els.startButton.addEventListener("click", startGame);
  els.playAgainButton.addEventListener("click", startGame);
  els.pauseButton.addEventListener("click", togglePause);
  els.resumeButton.addEventListener("click", togglePause);
  els.helpButton.addEventListener("click", openHelp);
  els.closeHelpButton.addEventListener("click", closeHelp);
  els.closeHelpButtonBottom.addEventListener("click", () => { closeHelp(); if (state.paused && state.running) togglePause(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeHelp(); if (state.paused && els.pauseOverlay.classList.contains("hidden")) togglePause(); } });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state.running && !state.paused) togglePause(); });
  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  updateHud();
})();
