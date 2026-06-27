// Controls Manager for QuranVerse: Odyssey 30
// Handles Keyboard and Touch Input (Virtual Joystick & D-Pad)

class Controls {
  constructor() {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      interact: false
    };

    this.joystick = {
      active: false,
      touchId: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      vector: { x: 0, y: 0 }, // Nilai -1 sampai 1
      maxDistance: 50 // Batas maksimal pergeseran knob dalam pixel
    };

    // Deteksi mutlak perangkat mobile/tablet
    this.isTouchDevice = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) && window.matchMedia("(max-width: 1024px)").matches;
    this.onInteractCallback = null;

    // JINAKKAN POINTER LOCK DI MOBILE
    // Memotong fungsi requestPointerLock agar Chrome HP tidak hang / membeku saat inisialisasi game 3D
    if (this.isTouchDevice) {
      this.bypassPointerLockForMobile();
    }

    this.initKeyboard();
    this.initTouch();
    this.initDpad();
  }

  bypassPointerLockForMobile() {
    if (window.PointerLockControls) {
      window.PointerLockControls.prototype.lock = function() {
        console.log("QuranVerse System: PointerLock diabaikan di mobile.");
      };
    }
    Element.prototype.requestPointerLock = function() {
      return Promise.resolve();
    };
    document.exitPointerLock = function() {
      return Promise.resolve();
    };
  }

  initKeyboard() {
    const handleKeyDown = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.keys.forward = true; break;
        case 'KeyS': case 'ArrowDown': this.keys.backward = true; break;
        case 'KeyA': case 'ArrowLeft': this.keys.left = true; break;
        case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
        case 'Space': this.keys.jump = true; break;
        case 'KeyE': 
          this.keys.interact = true; 
          if (this.onInteractCallback) this.onInteractCallback();
          break;
      }
    };

    const handleKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.keys.forward = false; break;
        case 'KeyS': case 'ArrowDown': this.keys.backward = false; break;
        case 'KeyA': case 'ArrowLeft': this.keys.left = false; break;
        case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
        case 'Space': this.keys.jump = false; break;
        case 'KeyE': this.keys.interact = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  }

  initTouch() {
    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    if (!zone || !knob) return;

    zone.addEventListener('touchstart', (e) => {
      if (this.joystick.active) return;
      
      const touch = e.changedTouches[0];
      this.joystick.active = true;
      this.joystick.touchId = touch.identifier;
      
      const rect = zone.getBoundingClientRect();
      this.joystick.startX = rect.left + rect.width / 2;
      this.joystick.startY = rect.top + rect.height / 2;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!this.joystick.active) return;

      let relevantTouch = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.joystick.touchId) {
          relevantTouch = e.touches[i];
          break;
        }
      }

      if (!relevantTouch) return;

      let deltaX = relevantTouch.clientX - this.joystick.startX;
      let deltaY = relevantTouch.clientY - this.joystick.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > this.joystick.maxDistance) {
        deltaX = (deltaX / distance) * this.joystick.maxDistance;
        deltaY = (deltaY / distance) * this.joystick.maxDistance;
      }

      knob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

      // Konversi ke Vektor Gerakan -1 sampai 1
      this.joystick.vector.x = deltaX / this.joystick.maxDistance;
      this.joystick.vector.y = -(deltaY / this.joystick.maxDistance); // Inversi sumbu Y untuk game 3D

      // Hubungkan ke state pergerakan karakter utama
      this.keys.forward = this.joystick.vector.y > 0.3;
      this.keys.backward = this.joystick.vector.y < -0.3;
      this.keys.left = this.joystick.vector.x < -0.3;
      this.keys.right = this.joystick.vector.x > 0.3;
    }, { passive: true });

    const resetJoystick = (e) => {
      if (!this.joystick.active) return;
      
      let touchTriggered = false;
      if (e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.joystick.touchId) {
            touchTriggered = true;
            break;
          }
        }
      } else {
        touchTriggered = true;
      }

      if (touchTriggered) {
        this.joystick.active = false;
        this.joystick.touchId = null;
        this.joystick.vector = { x: 0, y: 0 };
        knob.style.transform = 'translate(0px, 0px)';
        
        // Reset state tombol gerak
        this.keys.forward = false;
        this.keys.backward = false;
        this.keys.left = false;
        this.keys.right = false;
      }
    };

    zone.addEventListener('touchend', resetJoystick, { passive: true });
    zone.addEventListener('touchcancel', resetJoystick, { passive: true });
  }

  initDpad() {
    const dpadButtons = {
      'dpad-up': 'forward',
      'dpad-down': 'backward',
      'dpad-left': 'left',
      'dpad-right': 'right'
    };

    Object.keys(dpadButtons).forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;

      const keyName = dpadButtons[id];

      // Event saat tombol D-Pad ditekan (Touch)
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.keys[keyName] = true;
      }, { passive: false });

      // Event saat tombol D-Pad dilepas (Touch)
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.keys[keyName] = false;
      }, { passive: false });
    });
  }
}

// Inisialisasi secara global agar bisa diakses oleh engine3d.js / game.js
window.Controls = Controls;
// Inisialisasi secara global agar bisa diakses oleh engine3d.js / game.js
window.Controls = Controls;

// Trik Kompatibilitas: Menyediakan objek instansiasi otomatis dengan huruf kecil
// agar engine3d.js atau game.js tidak mendeteksi kegagalan WebGL akibat objek undefined
if (!window.controls) {
    window.controls = new Controls();
}
