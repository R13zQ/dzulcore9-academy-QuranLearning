// Game Orchestrator for QuranVerse: Odyssey 30
// Manages state, updates, persistence, shop inventory, and interactions.

class Game {
  constructor() {
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

    // Pilih 5 pertanyaan acak dari kumpulan bank kuis surat ini
    const stagePuzzles = [...stageData.puzzles];
    const shuffled = stagePuzzles.sort(() => 0.5 - Math.random());
    const selectedPuzzles = shuffled.slice(0, 5); // Tepat 5 pertanyaan

    let currentQuestionIdx = 0;
    const totalQuestions = 5;

    const askNextQuestion = () => {
      if (currentQuestionIdx >= totalQuestions) {
        // Sukses: Pemain menyelesaikan kelima soal dengan benar!
        this.state = 'PLAYING';
        this.engine.setCameraFocus(false);
        this.ui.showScreen('hud');

        // Buka tahap ini jika belum terbuka
        if (!this.unlockedStages.includes(stageId)) {
          this.unlockedStages.push(stageId);
        }

        // Tambahkan reward Noor Shards (+20 shards)
        this.shards += 20; 
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
          // Menghindari terjebak di area sensor gerbang
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
    requestAnimationFrame(() => this.animate());

    const time = performance.now();
    const deltaTime = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Always update engine (handles canvas render)
    if (this.engine) {
      this.engine.update(deltaTime);
    }
  }
}

// Start game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});

if (typeof window !== 'undefined') {
  window.Game = Game;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Game;
}
