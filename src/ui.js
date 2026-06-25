// UI Manager for QuranVerse: Odyssey 30
// Manages HTML overlay screen states, transitions, HUD updates, and menus

class UIManager {
  constructor(game) {
    this.game = game;
    this.activeScreen = 'menu';
    this.timerInterval = null;
    
    this.screens = {
      menu: document.getElementById('menu-screen'),
      hud: document.getElementById('hud-screen'),
      puzzle: document.getElementById('puzzle-screen'),
      archive: document.getElementById('archive-screen'),
      customizer: document.getElementById('customizer-screen')
    };

    this.initButtons();
  }

  bindElement(el, callback) {
    if (!el) return;

    let lastTouchTime = 0;
    const handler = (e) => {
      const now = Date.now();
      
      // Ignore simulated clicks on touch devices
      if (e.type === 'click' && (now - lastTouchTime < 600)) {
        return;
      }
      
      if (e.type === 'touchstart') {
        lastTouchTime = now;
      }

      if (e.cancelable) {
        e.preventDefault();
      }
      
      callback(e);
    };

    el.addEventListener('click', handler, { passive: false });
    el.addEventListener('touchstart', handler, { passive: false });
  }

  bindButton(id, callback) {
    const btn = document.getElementById(id);
    this.bindElement(btn, callback);
  }

  initButtons() {
    // Bind main menu buttons using dual touch/click binding
    this.bindButton('btn-play', () => {
      if (window.showDebugMsg) window.showDebugMsg("Mulai Perjalanan clicked!");
      this.game.startGame();
    });

    this.bindButton('btn-archive', () => {
      this.showScreen('archive');
      this.renderArchive();
    });

    this.bindButton('btn-customizer', () => {
      this.showScreen('customizer');
      this.renderCustomizer();
    });

    this.bindButton('btn-reset', () => {
      if (confirm("Apakah Anda yakin ingin me-reset seluruh progres hafalan Anda? Semua Noor Shards, skin visor yang dibeli, dan pintu gerbang yang terbuka akan dihapus.")) {
        // Hapus data save lokal safely
        try {
          localStorage.removeItem('quranverse_save_v1');
        } catch (e) {
          console.warn("localStorage.removeItem failed in Incognito mode:", e);
        }
        
        // Reset variabel game
        this.game.shards = 0;
        this.game.unlockedStages = [];
        this.game.unlockedSkins = [1];
        this.game.currentSkinId = 1;
        this.game.collectedShards = [];
        
        // Sinkronisasi ulang dunia 3D
        this.game.engine.clearScene();
        this.game.engine.syncWorldState();
        this.game.engine.updatePlayerSkinColor();
        
        this.showNotification("Progres berhasil di-reset!", "success");
      }
    });

    // Bind back buttons
    this.bindButton('btn-back-archive', () => {
      this.showScreen('menu');
    });

    this.bindButton('btn-back-customizer', () => {
      this.showScreen('menu');
    });

    // Bind HUD buttons
    this.bindButton('hud-btn-archive', () => {
      this.game.pauseGame();
      this.showScreen('archive');
      this.renderArchive();
    });

    this.bindButton('hud-btn-customizer', () => {
      this.game.pauseGame();
      this.showScreen('customizer');
      this.renderCustomizer();
    });

    this.bindButton('hud-btn-home', () => {
      this.game.exitToMenu();
    });

    // Mobile interact prompt overlay touch helper
    const interactPrompt = document.getElementById('interact-prompt');
    if (interactPrompt) {
      const handler = (e) => {
        e.preventDefault();
        this.game.controls.triggerInteract();
      };
      interactPrompt.addEventListener('click', handler);
      interactPrompt.addEventListener('touchstart', handler, { passive: false });
      // Enable mouse/touch on prompt
      interactPrompt.style.pointerEvents = 'auto';
    }
  }

  showScreen(screenId) {
    this.activeScreen = screenId;
    
    // Hide all screens
    Object.keys(this.screens).forEach(key => {
      if (this.screens[key]) {
        this.screens[key].classList.remove('active');
      }
    });

    // Show selected screen
    if (this.screens[screenId]) {
      this.screens[screenId].classList.add('active');
    }

    // Toggle pointer-events on ui-container based on active screen to fix mobile browsers hit-testing
    const uiContainer = document.getElementById('ui-container');
    if (uiContainer) {
      if (screenId === 'hud') {
        uiContainer.style.pointerEvents = 'none'; // Pass touch drag events to 3D canvas
      } else {
        uiContainer.style.pointerEvents = 'auto'; // Capture clicks for menu buttons
      }
    }
  }

  // HUD updates
  updateHUD(shards, score, currentStageIndex, stageName, percentDecrypted) {
    const elShards = document.getElementById('hud-shards');
    const elScore = document.getElementById('hud-score');
    const elStageName = document.getElementById('hud-stage-name');
    const elProgress = document.getElementById('hud-progress');

    if (elShards) elShards.textContent = shards;
    if (elScore) elScore.textContent = `${score}m`;
    if (elStageName) elStageName.textContent = stageName;
    if (elProgress) elProgress.textContent = `${percentDecrypted}% Decrypted`;
  }

  // Top notifications
  showNotification(text, type = 'success') {
    const notif = document.getElementById('notification');
    if (!notif) return;

    notif.textContent = text;
    notif.className = 'glass show';
    if (type === 'incorrect') {
      notif.classList.add('incorrect');
    } else {
      notif.classList.add('glow-emerald');
    }

    setTimeout(() => {
      notif.classList.remove('show');
    }, 3000);
  }

  // Decryption proximity prompts
  showInteractPrompt(actionText) {
    const prompt = document.getElementById('interact-prompt');
    if (!prompt) return;

    // Detect if mobile to change E key hint
    const isMobile = this.game.controls.isTouchDevice;
    const actionKey = isMobile ? 'TAP' : '[E]';
    prompt.innerHTML = `<span style="color: var(--accent-color); font-weight: 800; animation: pulse 0.5s infinite alternate;">${actionKey}</span> ${actionText}`;
    prompt.classList.add('show');
  }

  hideInteractPrompt() {
    const prompt = document.getElementById('interact-prompt');
    if (prompt) {
      prompt.classList.remove('show');
    }
  }

  // Open Puzzle Mode
  openPuzzle(puzzleData, questionIndex, totalQuestions, onCorrect, onIncorrect) {
    this.showScreen('puzzle');
    
    const container = document.getElementById('puzzle-question-text');
    const optionsContainer = document.getElementById('puzzle-options-container');
    const timerElement = document.getElementById('puzzle-timer');
    const progressText = document.getElementById('puzzle-progress-text');
    const progressBar = document.getElementById('puzzle-progress-bar');
    
    if (!container || !optionsContainer) return;

    // Reset UI
    optionsContainer.innerHTML = '';
    
    // Perbarui teks progres dan bar progres
    if (progressText) {
      progressText.textContent = `SOAL ${questionIndex + 1} DARI ${totalQuestions}`;
    }
    if (progressBar) {
      progressBar.style.width = `${(questionIndex / totalQuestions) * 100}%`;
    }
    
    // Ubah format baris baru menjadi HTML break
    let formattedQuestion = puzzleData.question.replace(/\n/g, '<br>');
    
    // Berikan gaya menyala merah pada kata negasi seperti BUKAN atau SALAH
    formattedQuestion = formattedQuestion.replace(
      /(BUKAN|SALAH)/g,
      '<span style="color: var(--danger-color); font-weight: 800; text-shadow: 0 0 10px rgba(255, 23, 68, 0.5);">$1</span>'
    );
    
    container.innerHTML = `<span class="arabic-text">${formattedQuestion}</span>`;

    // Mulai Timer
    let timeLeft = 20; // batas waktu 20 detik
    if (timerElement) {
      timerElement.textContent = timeLeft;
      timerElement.style.display = 'block';
    }

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      timeLeft--;
      if (timerElement) timerElement.textContent = timeLeft;

      if (timeLeft <= 0) {
        clearInterval(this.timerInterval);
        this.showNotification("Waktu Habis! Akses Ditolak.", "incorrect");
        
        // Kunci tombol pilihan
        const buttons = optionsContainer.querySelectorAll('.option-btn');
        buttons.forEach(btn => btn.style.pointerEvents = 'none');
        
        setTimeout(() => {
          this.showScreen('hud');
          onIncorrect();
        }, 1500);
      }
    }, 1000);

    // Render Pilihan Jawaban
    let buttonsLocked = false;
    puzzleData.options.forEach((optionText, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn glass';
      
      btn.innerHTML = `<span class="arabic-option-text">${optionText}</span>`;
      
      this.bindElement(btn, () => {
        if (buttonsLocked) return;
        buttonsLocked = true;
        clearInterval(this.timerInterval);

        const isCorrect = (index === puzzleData.answerIndex);

        if (isCorrect) {
          btn.classList.add('correct');
          this.showNotification("Dekripsi Benar!", "success");
          
          if (progressBar) {
            progressBar.style.width = `${((questionIndex + 1) / totalQuestions) * 100}%`;
          }

          setTimeout(() => {
            onCorrect();
          }, 1200);
        } else {
          btn.classList.add('incorrect');
          
          // Tampilkan jawaban yang benar setelah jeda
          const correctBtn = optionsContainer.children[puzzleData.answerIndex];
          if (correctBtn) {
            setTimeout(() => correctBtn.classList.add('correct'), 500);
          }

          this.showNotification("Dekripsi Gagal! Jawaban Salah.", "incorrect");
          
          setTimeout(() => {
            this.showScreen('hud');
            onIncorrect();
          }, 1800);
        }
      });

      optionsContainer.appendChild(btn);
    });
  }

  // Render Mushaf / Stage Progress Archive
  renderArchive() {
    const listContainer = document.getElementById('archive-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const unlockedStages = this.game.unlockedStages; // Array of unlocked IDs
    
    window.quranData.forEach(stage => {
      const isUnlocked = unlockedStages.includes(stage.id);
      const card = document.createElement('div');
      
      card.className = 'archive-card glass';
      if (isUnlocked) {
        card.classList.add('unlocked', 'glow-emerald');
      } else {
        card.classList.add('locked');
      }

      // Glitched/Encrypted titles for locked stages
      const title = isUnlocked ? stage.name : this.generateGlitchedText(stage.name.length);
      const desc = isUnlocked ? stage.englishName : "DECRYPT GATEWAY TO ACCESS";
      const statusText = isUnlocked ? "Unlocked" : "Locked";

      card.innerHTML = `
        <div class="card-head">
          <span class="card-num">Stage ${stage.id}</span>
          <span class="card-status">${statusText}</span>
        </div>
        <div class="card-title">${title}</div>
        <div class="card-desc">${desc}</div>
      `;

      if (isUnlocked) {
        this.bindElement(card, () => {
          this.showMushafModal(stage);
        });
      }

      listContainer.appendChild(card);
    });
  }

  generateGlitchedText(len) {
    const chars = '01#%&*?@$X_';
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Mushaf View Modal
  showMushafModal(stage) {
    const modal = document.createElement('div');
    modal.className = 'mushaf-modal';
    
    const container = document.createElement('div');
    container.className = 'mushaf-container glass glow-gold';
    
    const header = document.createElement('div');
    header.className = 'screen-header';
    header.innerHTML = `
      <h2>Surat ${stage.name}</h2>
      <button class="hud-btn" id="btn-close-mushaf">✕</button>
    `;
    
    const versesBox = document.createElement('div');
    versesBox.className = 'mushaf-verses';
    
    stage.verses.forEach((verse, idx) => {
      const item = document.createElement('div');
      item.className = 'mushaf-verse-item';
      item.innerHTML = `
        <span class="mushaf-verse-text">${verse}</span>
        <span class="mushaf-verse-num">${idx + 1}</span>
      `;
      versesBox.appendChild(item);
    });

    container.appendChild(header);
    container.appendChild(versesBox);
    modal.appendChild(container);
    document.body.appendChild(modal);

    this.bindElement(document.getElementById('btn-close-mushaf'), () => {
      modal.remove();
    });
  }

  // Avatar Customizer
  renderCustomizer() {
    const container = document.getElementById('customizer-skins-list');
    if (!container) return;

    container.innerHTML = '';
    
    // Skins array
    const skins = this.game.skins;
    const unlockedSkins = this.game.unlockedSkins;
    const currentSkinId = this.game.currentSkinId;
    const shards = this.game.shards;

    // Update player preview glow color
    const previewSuit = skins.find(s => s.id === currentSkinId) || skins[0];
    const previewEl = document.getElementById('avatar-preview-box');
    if (previewEl) {
      previewEl.style.setProperty('--glow-color', previewSuit.color);
    }

    skins.forEach(skin => {
      const isUnlocked = unlockedSkins.includes(skin.id);
      const isSelected = (skin.id === currentSkinId);

      const item = document.createElement('div');
      item.className = `skin-item glass ${isSelected ? 'selected glow-emerald' : ''}`;
      
      let costText = '';
      if (!isUnlocked) {
        costText = `<span class="skin-cost">💎 ${skin.cost} Shards</span>`;
      } else if (isSelected) {
        costText = `<span style="color: var(--primary-color); font-weight: 800; font-size: 0.85rem;">EQUIPPED</span>`;
      } else {
        costText = `<span style="color: var(--text-muted); font-size: 0.85rem;">OWNED</span>`;
      }

      item.innerHTML = `
        <div class="skin-info">
          <span class="skin-name">${skin.name}</span>
          ${costText}
        </div>
        <div class="skin-dot" style="background-color: ${skin.color}; box-shadow: 0 0 10px ${skin.color}"></div>
      `;

      this.bindElement(item, () => {
        if (isUnlocked) {
          this.game.equipSkin(skin.id);
          this.renderCustomizer(); // Refresh
        } else {
          if (shards >= skin.cost) {
            this.game.buySkin(skin.id);
            this.renderCustomizer(); // Refresh
          } else {
            this.showNotification("Noor Shards tidak cukup!", "incorrect");
          }
        }
      });

      container.appendChild(item);
    });
  }
}

// Export UIManager
if (typeof window !== 'undefined') {
  window.UIManager = UIManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIManager;
}
