// Game Orchestrator for QuranVerse: Odyssey 30
// Manages state, updates, persistence, shop inventory, and interactions.

class Game {
  constructor() {
    this.animationFrameId = 0;
    try {
      if (window.showDebugMsg) window.showDebugMsg("Game starting initialization...");
      this.state = 'MENU'; // MENU, PLAYING, PAUSED, PUZZLE
      
      // Game progression stats (loaded from localStorage)
      this.shards = 0;
      this.score = 0;
      this.highScore = 0;
      this.unlockedStages = []; // Mulai dengan semua gerbang terkunci (Gerbang 1 Al-Fatihah terkunci)
      this.unlockedSkins = [1]; // Default skin is unlocked
      this.currentSkinId = 1;
      this.collectedShards = []; // List of collected shard IDs across all sessions
      
      // Proximity state
      this.currentProximityGate = null;
      
      // Skin Catalog
      this.skins = [
        { id: 1, name: "Neon Emerald (Default)", color: "#00e676", cost: 0 },
        { id: 2, name: "Solar Amber", color: "#ffd700", cost: 20 },
        { id: 3, name: "Noor Ruby", color: "#ff1744", cost: 40 },
        { id: 4, name: "Siber Sapphire", color: "#29b6f6", cost: 60 },
        { id: 5, name: "Quds Amethyst", color: "#ab47bc", cost: 80 }
      ];

      // Load saved data
      this.loadProgress();
      if (window.showDebugMsg) window.showDebugMsg("Progress loaded");

      // Initialize modules
      this.controls = new Controls();
      if (window.showDebugMsg) window.showDebugMsg("Controls initialized");
      this.audio = new AudioManager();
      if (window.showDebugMsg) window.showDebugMsg("Audio Manager initialized");
      this.ui = new UIManager(this);
      if (window.showDebugMsg) window.showDebugMsg("UI Manager initialized");
      this.engine = new Engine3D(this);
      if (window.showDebugMsg) window.showDebugMsg("3D Engine initialized");

      // Initial sync
      this.engine.syncWorldState();
      this.engine.updatePlayerSkinColor();
      
      // Bind interaction event
      this.controls.bindInteract(() => this.handleInteraction());

      // Start Game Loop
      this.lastTime = performance.now();
      this.animate();
      if (window.showDebugMsg) window.showDebugMsg("Game system ready!");
    } catch (error) {
      console.error("Critical error during game initialization:", error);
      this.displayCriticalError(error);
    }
  }

  // Save/Load persistence
  loadProgress() {
    try {
      const data = localStorage.getItem('quranverse_save_v1');
      if (data) {
        const parsed = JSON.parse(data);
        this.shards = parsed.shards || 0;
        this.highScore = parsed.highScore || 0;
        
        // Ensure array formatting
        if (Array.isArray(parsed.unlockedStages)) this.unlockedStages = parsed.unlockedStages;
        if (Array.isArray(parsed.unlockedSkins)) this.unlockedSkins = parsed.unlockedSkins;
        if (Array.isArray(parsed.collectedShards)) this.collectedShards = parsed.collectedShards;
        
        this.currentSkinId = parsed.currentSkinId || 1;
      }
    } catch (e) {
      console.error("Failed to load progress from localStorage", e);
    }
  }

  saveProgress() {
    try {
      const saveState = {
        shards: this.shards,
        highScore: this.highScore,
        unlockedStages: this.unlockedStages,
        unlockedSkins: this.unlockedSkins,
        collectedShards: this.collectedShards,
        currentSkinId: this.currentSkinId
      };
      localStorage.setItem('quranverse_save_v1', JSON.stringify(saveState));
    } catch (e) {
      console.error("Failed to save progress to localStorage", e);
    }
  }

  // Start game from menu
  startGame() {
    if (window.showDebugMsg) window.showDebugMsg("startGame() executing...");
    this.state = 'PLAYING';
    this.ui.showScreen('hud');
    this.score = 0;
    if (this.audio) this.audio.startBGM();

    // Tempatkan pemain di pulau terjauh yang bisa diakses
    const furthestStageId = Math.min(30, this.unlockedStages.length + 1);
    if (window.showDebugMsg) window.showDebugMsg("Reset player to stage: " + furthestStageId);
    this.engine.resetPlayerToStage(furthestStageId);
    
    // Reset temporary session collections
    this.engine.clearScene();
    
    // Respawn any shards that have not been permanently collected yet
    this.engine.shards.forEach(shard => {
      if (this.collectedShards.includes(shard.id)) {
        shard.collected = true;
        shard.mesh.visible = false;
        this.engine.scene.remove(shard.mesh);
      }
    });

    this.engine.syncWorldState();
    if (window.showDebugMsg) window.showDebugMsg("World state synced");
    
    // Visual update
    const stageName = window.quranData[furthestStageId - 1]?.name || 'Odyssey';
    const percentDecrypted = Math.round((this.unlockedStages.length / 30) * 100);
    this.ui.updateHUD(this.shards, this.score, furthestStageId, stageName, percentDecrypted);
    this.ui.showNotification("Sistem Dimuat. Selamat Menghafal!");
    if (window.showDebugMsg) window.showDebugMsg("Game interface loaded!");
  }

  pauseGame() {
    this.state = 'PAUSED';
    if (this.engine && this.engine.player) {
      this.engine.player.velocity.set(0, 0, 0);
    }
  }

  resumeGame() {
    this.state = 'PLAYING';
    this.ui.showScreen('hud');
  }

  exitToMenu() {
    this.saveProgress();
    this.state = 'MENU';
    this.ui.showScreen('menu');
    if (this.audio) this.audio.stopBGM();
  }

  updateScore(newScore) {
    if (newScore > this.score) {
      this.score = newScore;
      if (this.score > this.highScore) {
        this.highScore = this.score;
      }
    }
    
    // Update HUD
    const currentStageId = this.engine.player.lastSafeIslandIndex + 1;
    const stageName = window.quranData[currentStageId - 1]?.name || 'Odyssey';
    const percentDecrypted = Math.round((this.unlockedStages.length / 30) * 100);
    
    this.ui.updateHUD(this.shards, this.score, currentStageId, stageName, percentDecrypted);
  }

  // Shards Collection
  collectShard(shardId) {
    if (!this.collectedShards.includes(shardId)) {
      this.collectedShards.push(shardId);
      this.shards += 1; // 1 Shard per node
      this.saveProgress();
      if (this.audio) this.audio.playShard();
      
      const currentStageId = this.engine.player.lastSafeIslandIndex + 1;
      const stageName = window.quranData[currentStageId - 1]?.name || 'Odyssey';
      const percentDecrypted = Math.round((this.unlockedStages.length / 30) * 100);
      this.ui.updateHUD(this.shards, this.score, currentStageId, stageName, percentDecrypted);
    }
  }

  // Proximity to Anomaly Gates
  setProximityGate(gate) {
    this.currentProximityGate = gate;
  }

  // Handle Action Trigger (E key or Mobile button click)
  handleInteraction() {
    if (this.state !== 'PLAYING') return;
    if (!this.currentProximityGate) return;

    // Check if player is near a locked gate
    const gateId = this.currentProximityGate.id;
    const isUnlocked = this.unlockedStages.includes(gateId);
    
    if (!isUnlocked) {
      this.triggerGateDecryption(gateId);
    }
  }

  triggerGateDecryption(stageId) {
    this.state = 'PUZZLE';
    this.ui.hideInteractPrompt();
    
    // Focus camera onto gate
    this.engine.setCameraFocus(true, this.currentProximityGate);
    
    // Fetch stage data
    const stageData = window.quranData.find(s => s.id === stageId);
    if (!stageData) {
      this.state = 'PLAYING';
      this.engine.setCameraFocus(false);
      return;
    }

    // Generate exactly 10 questions with progressive difficulty (1 to 10) covering the entire surah
    const selectedPuzzles = this.generatePuzzlesForStage(stageId);
    let currentQuestionIdx = 0;
    const totalQuestions = 10;

    const askNextQuestion = () => {
      if (currentQuestionIdx >= totalQuestions) {
        // Sukses: Pemain menyelesaikan kesepuluh soal dengan benar!
        this.state = 'PLAYING';
        this.engine.setCameraFocus(false);
        this.ui.showScreen('hud');

        // Buka tahap ini jika belum terbuka
        if (!this.unlockedStages.includes(stageId)) {
          this.unlockedStages.push(stageId);
        }

        // Tambahkan reward Noor Shards (+40 shards untuk kuis 10 soal yang lebih menantang)
        this.shards += 40; 
        this.saveProgress();

        this.engine.syncWorldState();

        // Pemicu selebrasi kembang api yang optimal di gerbang yang baru pulih
        if (this.currentProximityGate) {
          const gatePos = this.currentProximityGate.position;
          this.engine.triggerFireworkExplosion(gatePos.clone().add(new THREE.Vector3(0, 3, 0)), 0x00e676);
          setTimeout(() => {
            if (this.engine) this.engine.triggerFireworkExplosion(gatePos.clone().add(new THREE.Vector3(-1.5, 4, -1)), 0xffd700);
          }, 300);
          setTimeout(() => {
            if (this.engine) this.engine.triggerFireworkExplosion(gatePos.clone().add(new THREE.Vector3(1.5, 4.5, 1)), 0xff1744);
          }, 600);
        }

        // Perbarui HUD
        const percentDecrypted = Math.round((this.unlockedStages.length / 30) * 100);
        this.ui.updateHUD(this.shards, this.score, stageId, stageData.name, percentDecrypted);
        this.ui.showNotification("Gerbang Pulih! Jembatan Cahaya Aktif.", "success");
        return;
      }

      const activePuzzle = selectedPuzzles[currentQuestionIdx];
      
      this.ui.openPuzzle(
        activePuzzle,
        currentQuestionIdx,
        totalQuestions,
        () => {
          // Jawaban Benar: Lanjut ke pertanyaan berikutnya setelah jeda singkat
          currentQuestionIdx++;
          setTimeout(() => {
            askNextQuestion();
          }, 400);
        },
        () => {
          // Jawaban Salah: Terpental mundur dan kuis di-reset
          this.state = 'PLAYING';
          this.engine.setCameraFocus(false);

          // Pantulkan pemain ke belakang (berlawanan dari arah gerbang)
          const bounceDir = new THREE.Vector3(0, 0, 8); // Dorong sejauh 8 meter
          this.engine.player.position.add(bounceDir);
          this.engine.player.velocity.set(0, 0, 0);
          this.engine.player.group.position.copy(this.engine.player.position);
          this.engine.player.onGround = true;

          this.ui.showNotification("Dekripsi Gagal! Keamanan Gerbang Mereset.", "incorrect");
        }
      );
    };

    setTimeout(() => {
      askNextQuestion();
    }, 800); // Jeda transisi zoom kamera
  }

  // Helper to shuffle distractor options and track index of correct option
  shuffleOptions(correctOption, distractor1, distractor2) {
    const list = [correctOption, distractor1, distractor2];
    const shuffled = [...list].sort(() => 0.5 - Math.random());
    const correctIndex = shuffled.indexOf(correctOption);
    return {
      options: shuffled,
      answerIndex: correctIndex
    };
  }

  // Generates 10 puzzles with increasing difficulty (1 to 10) covering beginning, middle, and end of surah
  generatePuzzlesForStage(stageId) {
    const surah = window.quranData.find(s => s.id === stageId);
    if (!surah) return [];

    const puzzles = [];
    const N = surah.verses.length;

    // Helper functions to fetch random verses/translations from other surahs for distractor options
    const getOtherVerse = () => {
      const otherSurahs = window.quranData.filter(s => s.id !== stageId);
      const randomSurah = otherSurahs[Math.floor(Math.random() * otherSurahs.length)];
      return randomSurah.verses[Math.floor(Math.random() * randomSurah.verses.length)];
    };

    const getOtherTranslation = () => {
      const otherSurahs = window.quranData.filter(s => s.id !== stageId);
      const randomSurah = otherSurahs[Math.floor(Math.random() * otherSurahs.length)];
      return randomSurah.translations[Math.floor(Math.random() * randomSurah.translations.length)];
    };

    const getWordFromSurah = (excludeWord) => {
      const words = surah.verses.join(" ").split(/\s+/).map(w => w.trim()).filter(w => w.length > 2 && w !== excludeWord);
      if (words.length > 0) {
        return words[Math.floor(Math.random() * words.length)];
      }
      return "ٱللَّهِ"; // fallback
    };

    // Helper to generate a connector question (Difficulty i)
    const makeConnector = (verseIndex, levelName) => {
      const vIdx = Math.min(N - 2, Math.max(0, verseIndex));
      const currentVerse = surah.verses[vIdx];
      const nextVerse = surah.verses[vIdx + 1];
      
      const dist1 = getOtherVerse();
      let dist2 = getOtherVerse();
      let attempts = 0;
      while (dist2 === dist1 && attempts < 15) {
        dist2 = getOtherVerse();
        attempts++;
      }

      const shuf = this.shuffleOptions(nextVerse, dist1, dist2);
      return {
        type: "connector",
        question: `[LEVEL ${levelName}]\nSambunglah ayat berikut:\n« ${currentVerse} »`,
        options: shuf.options,
        answerIndex: shuf.answerIndex
      };
    };

    // Helper to generate a translation question (Difficulty i)
    const makeTranslation = (verseIndex, levelName) => {
      const vIdx = Math.min(N - 1, Math.max(0, verseIndex));
      const currentVerse = surah.verses[vIdx];
      const translation = surah.translations[vIdx];

      const dist1 = getOtherTranslation();
      let dist2 = getOtherTranslation();
      let attempts = 0;
      while (dist2 === dist1 && attempts < 15) {
        dist2 = getOtherTranslation();
        attempts++;
      }

      const shuf = this.shuffleOptions(translation, dist1, dist2);
      return {
        type: "translation",
        question: `[LEVEL ${levelName}]\nApa terjemahan dari ayat berikut?\n« ${currentVerse} »`,
        options: shuf.options,
        answerIndex: shuf.answerIndex
      };
    };

    // Helper to generate a missing word question (Difficulty i)
    const makeMissingWord = (verseIndex, levelName) => {
      const vIdx = Math.min(N - 1, Math.max(0, verseIndex));
      const verseText = surah.verses[vIdx];
      const words = verseText.trim().split(/\s+/);

      if (words.length <= 1) {
        return makeTranslation(verseIndex, levelName);
      }

      let wordIndex = Math.floor(Math.random() * words.length);
      for (let attempt = 0; attempt < 5; attempt++) {
        const idx = Math.floor(Math.random() * words.length);
        if (words[idx].length > 3) {
          wordIndex = idx;
          break;
        }
      }

      const missingWord = words[wordIndex];
      // Clone words array
      const wordsClone = [...words];
      wordsClone[wordIndex] = "___";
      const questionText = wordsClone.join(" ");

      let dist1 = getWordFromSurah(missingWord);
      let dist2 = getWordFromSurah(missingWord);
      let attempts = 0;
      while (dist2 === dist1 && attempts < 15) {
        dist2 = getWordFromSurah(missingWord);
        attempts++;
      }

      const shuf = this.shuffleOptions(missingWord, dist1, dist2);
      return {
        type: "missing_word",
        question: `[LEVEL ${levelName}]\nLengkapi kata yang hilang:\n« ${questionText} »`,
        options: shuf.options,
        answerIndex: shuf.answerIndex
      };
    };

    // Generate 5 variations for each of the 10 levels (Total 50 questions in pool)
    const pool = [];
    const numVariations = 5;

    for (let v = 0; v < numVariations; v++) {
      // Level 1: Connector of Verse 1 (Very Easy)
      pool.push({ level: 1, puzzle: makeConnector(0, "1 (SANGAT MUDAH)") });

      // Level 2: Translation of Verse 1 (Very Easy)
      pool.push({ level: 2, puzzle: makeTranslation(0, "2 (SANGAT MUDAH)") });

      // Level 3: Connector of Verse 2 or early middle
      pool.push({ level: 3, puzzle: makeConnector(Math.floor(N * 0.15), "3 (MUDAH)") });

      // Level 4: Missing word in early middle verse
      pool.push({ level: 4, puzzle: makeMissingWord(Math.floor(N * 0.35), "4 (MUDAH)") });

      // Level 5: Translation of a middle verse
      pool.push({ level: 5, puzzle: makeTranslation(Math.floor(N * 0.5), "5 (SEDANG)") });

      // Level 6: Connector of a middle verse
      pool.push({ level: 6, puzzle: makeConnector(Math.floor(N * 0.65), "6 (SEDANG)") });

      // Level 7: Missing word in a middle-late verse
      pool.push({ level: 7, puzzle: makeMissingWord(Math.floor(N * 0.75), "7 (SULIT)") });

      // Level 8: Connector of a late verse
      pool.push({ level: 8, puzzle: makeConnector(Math.floor(N * 0.85), "8 (SULIT)") });

      // Level 9: Exclusion verse
      const getTwoVersesFromSurah = () => {
        let idx1 = Math.floor(Math.random() * N);
        let idx2 = Math.floor(Math.random() * N);
        let attempts = 0;
        while (idx2 === idx1 && N > 1 && attempts < 15) {
          idx2 = Math.floor(Math.random() * N);
          attempts++;
        }
        return [surah.verses[idx1], surah.verses[idx2]];
      };
      const ownVerses = getTwoVersesFromSurah();
      const wrongVerse = getOtherVerse();
      const shufExclude = this.shuffleOptions(wrongVerse, ownVerses[0], ownVerses[1]);
      pool.push({
        level: 9,
        puzzle: {
          type: "exclusion_verse",
          question: `[LEVEL 9 (SANGAT SULIT)]\nMana di antara ayat berikut yang BUKAN bagian dari Surat ${surah.name}?`,
          options: shufExclude.options,
          answerIndex: shufExclude.answerIndex
        }
      });

      // Level 10: Translation of the final verse (Very Hard)
      pool.push({ level: 10, puzzle: makeTranslation(N - 1, "10 (LEGENDARIS)") });
    }

    // Now select exactly one random puzzle for each level (1 to 10)
    for (let level = 1; level <= 10; level++) {
      const levelPuzzles = pool.filter(p => p.level === level);
      const randomPuzzleObj = levelPuzzles[Math.floor(Math.random() * levelPuzzles.length)];
      puzzles.push(randomPuzzleObj.puzzle);
    }

    return puzzles;
  }

  // Skin Purchases & Equipping
  getCurrentSkinColor() {
    const skin = this.skins.find(s => s.id === this.currentSkinId);
    return skin ? skin.color : "#00e676";
  }

  equipSkin(skinId) {
    if (this.unlockedSkins.includes(skinId)) {
      this.currentSkinId = skinId;
      this.saveProgress();
      
      // Update player color directly in 3D
      if (this.engine) {
        this.engine.updatePlayerSkinColor();
      }
      this.ui.showNotification("Skin visor berhasil digunakan!");
    }
  }

  buySkin(skinId) {
    const skin = this.skins.find(s => s.id === skinId);
    if (skin && !this.unlockedSkins.includes(skinId)) {
      if (this.shards >= skin.cost) {
        this.shards -= skin.cost;
        this.unlockedSkins.push(skinId);
        this.currentSkinId = skinId;
        this.saveProgress();
        
        if (this.engine) {
          this.engine.updatePlayerSkinColor();
        }
        this.ui.showNotification(`Skin ${skin.name} berhasil dibeli!`, "success");
      }
    }
  }

  // Animation ticks
  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    try {
      const time = performance.now();
      const deltaTime = (time - this.lastTime) / 1000;
      this.lastTime = time;

      // Always update engine (handles canvas render)
      if (this.engine) {
        this.engine.update(deltaTime);
      }
    } catch (error) {
      console.error("Critical error in animation loop:", error);
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      this.displayCriticalError(error);
    }
  }

  displayCriticalError(error) {
    const msg = error.message || String(error);
    let detailedInstructions = "";
    
    if (msg.toLowerCase().includes("webgl") || msg.toLowerCase().includes("context") || msg.toLowerCase().includes("shader") || msg.toLowerCase().includes("renderer")) {
      detailedInstructions = `
        <div style="margin-top: 20px; font-size: 0.95rem; line-height: 1.6; text-align: left; color: #ffd700; border-top: 1px dashed rgba(255,215,0,0.2); padding-top: 15px;">
          <strong>Cara mengaktifkan Akselerasi Perangkat Keras di Google Chrome:</strong><br>
          1. Klik tombol menu tiga titik (<strong>⋮</strong>) di pojok kanan atas Chrome, lalu pilih <strong>Setelan</strong> (Settings).<br>
          2. Di menu sebelah kiri, klik <strong>Sistem</strong> (System).<br>
          3. Aktifkan opsi <strong>"Gunakan akselerasi perangkat keras jika tersedia"</strong> (Use graphics acceleration when available).<br>
          4. Klik tombol <strong>Luncurkan Ulang</strong> (Relaunch) untuk memuat ulang Chrome.<br><br>
          <em>Jika Anda menggunakan Laptop, pastikan driver GPU terintegrasi (Intel/AMD) atau GPU diskrit (NVIDIA/AMD) Anda sudah diperbarui.</em>
        </div>
      `;
    }

    const errorOverlay = document.createElement('div');
    errorOverlay.style.position = 'fixed';
    errorOverlay.style.top = '0';
    errorOverlay.style.left = '0';
    errorOverlay.style.width = '100vw';
    errorOverlay.style.height = '100vh';
    errorOverlay.style.background = 'radial-gradient(circle at center, rgba(30, 10, 15, 0.98) 0%, rgba(10, 5, 5, 0.99) 100%)';
    errorOverlay.style.color = '#ff1744';
    errorOverlay.style.display = 'flex';
    errorOverlay.style.flexDirection = 'column';
    errorOverlay.style.justifyContent = 'center';
    errorOverlay.style.alignItems = 'center';
    errorOverlay.style.zIndex = '9999999';
    errorOverlay.style.padding = '30px';
    errorOverlay.style.fontFamily = "'Outfit', sans-serif";
    errorOverlay.style.textAlign = 'center';

    errorOverlay.innerHTML = `
      <div class="glass glow-gold" style="max-width: 600px; padding: 40px; background: rgba(15, 5, 5, 0.95); border: 1px solid #ff1744; border-radius: 20px; box-shadow: 0 0 30px rgba(255, 23, 68, 0.35);">
        <h2 style="font-size: 2rem; margin-bottom: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #ff1744;">⚠️ Gagal Memuat Modul 3D</h2>
        <p style="font-size: 1.1rem; color: #e0e6ed; margin-bottom: 15px; font-weight: 600;">Sistem mendeteksi kegagalan pada mesin grafis WebGL peramban Anda.</p>
        <div style="background: rgba(0,0,0,0.4); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,23,68,0.25); font-family: monospace; font-size: 0.9rem; color: #ff5252; word-break: break-all;">
          ${msg}
        </div>
        ${detailedInstructions}
        <button onclick="window.location.reload()" style="margin-top: 30px; background: #ff1744; color: white; border: none; padding: 12px 30px; border-radius: 8px; font-weight: bold; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: 0.2s;" onmouseover="this.style.background='#ff5252'" onmouseout="this.style.background='#ff1744'">Muat Ulang Halaman</button>
      </div>
    `;
    document.body.appendChild(errorOverlay);
  }
}

// Start game safely when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
  });
} else {
  window.game = new Game();
}

if (typeof window !== 'undefined') {
  window.Game = Game;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Game;
}
