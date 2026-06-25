// Controls Manager for QuranVerse: Odyssey 30
// Handles Keyboard and Touch Input (Virtual Joystick)

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
      touchId: null, // Track specific touch identifier
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      vector: { x: 0, y: 0 }, // -1 to 1 values
      maxDistance: 50 // Pixels the knob can travel
    };

    // Instant touch detection using window check & navigator capabilities
    // Detect if touchscreen device AND screen size is mobile/tablet (<= 1024px)
    // This prevents virtual mobile controls from cluttering touch-enabled laptops.
    this.isTouchDevice = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0)) && window.matchMedia("(max-width: 1024px)").matches;
    this.onInteractCallback = null;

    this.initKeyboard();
    this.initTouch();
    this.initDpad();
  }

  // Detect and set up keyboard listeners
  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.handleKey(e, true);
    });

    window.addEventListener('keyup', (e) => {
      this.handleKey(e, false);
    });
  }

  handleKey(e, isDown) {
    const code = e.code;
    const key = e.key;
    const keyCode = e.keyCode;

    // Prevent default scrolling on arrow keys and spacebar
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      // Only prevent if the user is playing, not typing in a text field
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        // e.preventDefault();
      }
    }

    // Map keys with multiple fallbacks (code, key, or keyCode)
    const isW = (code === 'KeyW' || key === 'w' || key === 'W' || keyCode === 87);
    const isUp = (code === 'ArrowUp' || key === 'ArrowUp' || keyCode === 38);
    const isS = (code === 'KeyS' || key === 's' || key === 'S' || keyCode === 83);
    const isDownKey = (code === 'ArrowDown' || key === 'ArrowDown' || keyCode === 40);
    const isA = (code === 'KeyA' || key === 'a' || key === 'A' || keyCode === 65);
    const isLeft = (code === 'ArrowLeft' || key === 'ArrowLeft' || keyCode === 37);
    const isD = (code === 'KeyD' || key === 'd' || key === 'D' || keyCode === 68);
    const isRight = (code === 'ArrowRight' || key === 'ArrowRight' || keyCode === 39);
    const isSpace = (code === 'Space' || key === ' ' || keyCode === 32);
    const isE = (code === 'KeyE' || key === 'e' || key === 'E' || keyCode === 69);

    if (isW || isUp) {
      this.keys.forward = isDown;
    } else if (isS || isDownKey) {
      this.keys.backward = isDown;
    } else if (isA || isLeft) {
      this.keys.left = isDown;
    } else if (isD || isRight) {
      this.keys.right = isDown;
    } else if (isSpace) {
      this.keys.jump = isDown;
    } else if (isE) {
      if (isDown && !this.keys.interact) {
        if (this.onInteractCallback) this.onInteractCallback();
      }
      this.keys.interact = isDown;
    }

    // If keyboard is used, we ensure we display keyboard hints if appropriate
    if (isDown && this.isTouchDevice) {
      this.switchToDesktopLayout();
    }
  }

  // Set up mobile touch listeners
  initTouch() {
    const joystickZone = document.getElementById('joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');
    const mobileControls = document.querySelector('.mobile-controls');

    if (!joystickZone || !joystickKnob) return;

    // Show controls immediately if detected
    if (this.isTouchDevice && mobileControls) {
      mobileControls.classList.remove('hidden');
    }

    // Fallback/Recovery touch event listener to enable touch layout if tapped
    window.addEventListener('touchstart', () => {
      if (!this.isTouchDevice) {
        this.switchToTouchLayout();
      }
    }, { passive: true });

    // Joystick Touch events with stopPropagation to avoid camera panning conflict
    joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.targetTouches[0] || e.changedTouches[0] || e.touches[0];
      if (!touch) return;

      const rect = joystickZone.getBoundingClientRect();
      
      this.joystick.active = true;
      this.joystick.touchId = touch.identifier;
      // Start position is the center of the joystick zone
      this.joystick.startX = rect.left + rect.width / 2;
      this.joystick.startY = rect.top + rect.height / 2;
      
      this.updateJoystick(touch.clientX, touch.clientY, joystickKnob);
    }, { passive: false });

    // Window-level touchmove with identifier verification and passive:false to block mobile browser pull-scroll
    window.addEventListener('touchmove', (e) => {
      if (!this.joystick.active) return;
      
      let touch = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.joystick.touchId) {
          touch = e.touches[i];
          break;
        }
      }
      if (!touch) return;

      this.updateJoystick(touch.clientX, touch.clientY, joystickKnob);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    const endJoystick = (e) => {
      if (!this.joystick.active) return;

      let touchEnded = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.joystick.touchId) {
          touchEnded = true;
          break;
        }
      }
      if (!touchEnded) return;

      this.joystick.active = false;
      this.joystick.touchId = null;
      this.joystick.vector = { x: 0, y: 0 };
      if (joystickKnob) {
        joystickKnob.style.transform = 'translate(0px, 0px)';
      }
    };

    window.addEventListener('touchend', endJoystick);
    window.addEventListener('touchcancel', endJoystick);
  }

  initDpad() {
    const btnUp = document.getElementById('dpad-up');
    const btnDown = document.getElementById('dpad-down');
    const btnLeft = document.getElementById('dpad-left');
    const btnRight = document.getElementById('dpad-right');

    if (!btnUp || !btnDown || !btnLeft || !btnRight) return;

    const bindDpadKey = (el, keyName) => {
      // Touch events
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.keys[keyName] = true;
      }, { passive: false });

      const endTouch = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.keys[keyName] = false;
      };
      el.addEventListener('touchend', endTouch, { passive: false });
      el.addEventListener('touchcancel', endTouch, { passive: false });

      // Mouse fallback events for laptop touchscreen click emulation
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.keys[keyName] = true;
      });

      const endMouse = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.keys[keyName] = false;
      };
      el.addEventListener('mouseup', endMouse);
      el.addEventListener('mouseleave', endMouse);
    };

    bindDpadKey(btnUp, 'forward');
    bindDpadKey(btnDown, 'backward');
    bindDpadKey(btnLeft, 'left');
    bindDpadKey(btnRight, 'right');
  }

  updateJoystick(clientX, clientY, knobElement) {
    let dx = clientX - this.joystick.startX;
    let dy = clientY - this.joystick.startY;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > this.joystick.maxDistance) {
      dx = (dx / distance) * this.joystick.maxDistance;
      dy = (dy / distance) * this.joystick.maxDistance;
    }
    
    if (knobElement) {
      knobElement.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    
    // Normalize vector between -1 and 1
    this.joystick.vector.x = dx / this.joystick.maxDistance;
    this.joystick.vector.y = dy / this.joystick.maxDistance;
  }

  // Swapper functions
  switchToDesktopLayout() {
    this.isTouchDevice = false;
    const mobileControls = document.querySelector('.mobile-controls');
    if (mobileControls) mobileControls.classList.add('hidden');
  }

  switchToTouchLayout() {
    this.isTouchDevice = true;
    const mobileControls = document.querySelector('.mobile-controls');
    if (mobileControls) mobileControls.classList.remove('hidden');
  }

  // Get current normalized movement directions
  getMovement() {
    let x = 0;
    let z = 0;

    // Keyboard values
    if (this.keys.forward) z -= 1;
    if (this.keys.backward) z += 1;
    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;

    // Normalized keyboard vector
    if (x !== 0 && z !== 0) {
      const length = Math.sqrt(x * x + z * z);
      x /= length;
      z /= length;
    }

    // Override with joystick values if active
    if (this.joystick.active) {
      x = this.joystick.vector.x;
      // Joystick y maps to depth (z)
      z = this.joystick.vector.y;
    }

    return { x, z };
  }

  // Check jump status and reset trigger
  getJump() {
    return this.keys.jump;
  }

  // Bind E interaction callback
  bindInteract(callback) {
    this.onInteractCallback = callback;
  }

  // Trigger manual interaction (e.g., clicking the screen overlay or mobile context button)
  triggerInteract() {
    if (this.onInteractCallback) {
      this.onInteractCallback();
    }
  }
}

// Export Controls
if (typeof window !== 'undefined') {
  window.Controls = Controls;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Controls;
}
