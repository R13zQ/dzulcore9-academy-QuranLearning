// 3D Engine for QuranVerse: Odyssey 30
// Built with Three.js. Handles rendering, physics, player, levels, and animations.

class Engine3D {
  constructor(game) {
    this.game = game;
    this.container = document.getElementById('canvas-container');
    
    // Physics parameters
    this.gravity = -22;
    this.jumpForce = 9.5;
    this.moveSpeed = 12;
    this.playerRadius = 0.8;
    this.playerHeight = 2.0;
    
    // Engine State
    this.player = {
      mesh: null,
      visor: null,
      position: new THREE.Vector3(0, 2, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      onGround: false,
      isFalling: false,
      lastSafePosition: new THREE.Vector3(0, 2, 0),
      lastSafeIslandIndex: 0
    };
    
    // Camera State
    this.cameraRotation = {
      yaw: 0,
      pitch: -0.2 // Slightly looking down
    };
    this.targetCameraDistance = 8;
    this.cameraDistance = 8;
    this.cameraFocusMode = false; // Zoomed in on gate
    this.cameraFocusTarget = null;
    
    // Collectibles & Level objects
    this.islands = [];
    this.bridges = [];
    this.shards = [];
    this.gates = [];
    
    this.shardsCollectedThisRun = new Set(); // Set of Shard IDs collected
    this.activeParticles = []; // List of active particle systems
    this.balloons = []; // List of cyber balloons
    this.lasers = []; // List of laser beams

    this.init();
  }

  init() {
    // Proactively check if WebGL is supported by checking browser context
    const canvasCheck = document.createElement('canvas');
    const gl = canvasCheck.getContext('webgl') || canvasCheck.getContext('experimental-webgl');
    if (!gl) {
      throw new Error("WebGL tidak didukung oleh kartu grafis Anda atau dinonaktifkan di pengaturan browser Chrome Anda.");
    }

    // 1. Create Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05080c, 0.015);
    
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
      if (!this.renderer.getContext()) {
        throw new Error("Gagal menginisialisasi WebGL context.");
      }
    } catch (err) {
      throw new Error("WebGL gagal diinisialisasi: " + err.message);
    }
    
    // Fallback safe width and height calculation to avoid clientWidth/Height = 0 and NaN aspect ratios
    const width = this.container.clientWidth || window.innerWidth || 800;
    const height = this.container.clientHeight || window.innerHeight || 600;

    this.renderer.setSize(width, height);
    // Capped pixel ratio to 1.2 instead of 2 to avoid rendering extra pixels on high-DPI screens
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
    this.renderer.shadowMap.enabled = false; // Disabled shadow maps for lightweight execution
    this.container.appendChild(this.renderer.domElement);
    
    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    
    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x0c1626, 1.2);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffdf9e, 1.0);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = false; // Disabled shadows
    this.scene.add(dirLight);

    // Add a secondary soft siberian light
    const fillLight = new THREE.DirectionalLight(0x00e676, 0.35);
    fillLight.position.set(-20, 10, -20);
    this.scene.add(fillLight);

    // 4. Starry Background
    this.createStars();

    // 5. Build Environment (Islands, Gates, Bridges)
    this.buildWorld();

    // 6. Create Player Mesh
    this.createPlayer();

    // 7. Mouse Orbit Listeners (Desktop)
    this.initMouseOrbit();

    // 8. Resize Listener
    window.addEventListener('resize', () => this.onWindowResize());
  }

  createStars() {
    const starCount = 300; // Reduced star count to save drawing overhead
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      // Random coordinates in a large sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const dist = 150 + Math.random() * 150;

      positions[i * 3] = dist * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = dist * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = dist * Math.cos(phi);

      // White/emerald/gold star colors
      const r = Math.random();
      if (r < 0.2) {
        colors[i * 3] = 0.0; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 0.5; // Emerald
      } else if (r < 0.4) {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 0.0; // Gold
      } else {
        colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 1.0; // White
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    });

    const starParticles = new THREE.Points(geometry, material);
    this.scene.add(starParticles);
  }

  buildWorld() {
    const numIslands = 30;
    
    // Hitung koordinat helical (spiral melingkar naik) terlebih dahulu
    const islandPositions = [];
    for (let i = 0; i < numIslands; i++) {
      const x = Math.sin(i * 0.45) * 18;
      const y = i * 1.6;
      const z = -i * 42;
      islandPositions.push(new THREE.Vector3(x, y, z));
    }

    for (let i = 0; i < numIslands; i++) {
      const stageId = i + 1;
      const currentPos = islandPositions[i];
      const islandRadius = stageId === 30 ? 14 : 7; // Tri-surah (pulau terakhir) lebih besar
      const islandHeight = 1.5;
      
      // 1. Buat Mesh Pulau (Silinder)
      const islandGeo = new THREE.CylinderGeometry(islandRadius, islandRadius + 0.5, islandHeight, 16);
      const islandMat = new THREE.MeshStandardMaterial({
        color: 0x090f17,
        roughness: 0.4,
        metalness: 0.8,
        flatShading: true
      });
      
      const island = new THREE.Mesh(islandGeo, islandMat);
      island.position.copy(currentPos);
      // Removed receiveShadow and castShadow to optimize draw performance
      this.scene.add(island);

      // Batas Visual: Cincin emerald menyala di bibir atas platform
      const ringGeo = new THREE.RingGeometry(islandRadius - 0.1, islandRadius + 0.1, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00e676,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(currentPos.x, currentPos.y + islandHeight / 2 + 0.02, currentPos.z);
      this.scene.add(ring);

      // Sirkuit emas menyala di tengah platform
      const circuitGeo = new THREE.BoxGeometry(islandRadius * 0.8, 0.01, islandRadius * 0.8);
      const circuitMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        roughness: 0.2,
        metalness: 1.0,
        emissive: 0xffd700,
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.4
      });
      const circuit = new THREE.Mesh(circuitGeo, circuitMat);
      circuit.position.set(currentPos.x, currentPos.y + islandHeight / 2 + 0.01, currentPos.z);
      this.scene.add(circuit);

      // Simpan data pulau untuk fisika
      this.islands.push({
        id: stageId,
        x: currentPos.x,
        y: currentPos.y + islandHeight / 2, // Altitudo berdiri pemain
        z: currentPos.z,
        radius: islandRadius
      });

      // 2. Tempatkan Gerbang Anomali (Portal) di pulau
      const gatePos = new THREE.Vector3(currentPos.x, currentPos.y + islandHeight / 2, currentPos.z - islandRadius + 2.5);
      this.createGate(stageId, gatePos);

      // 3. Tempatkan Shard Cahaya di pulau ini
      this.createIslandShards(stageId, currentPos, islandRadius);

      // 4. Hubungkan jembatan ke pulau berikutnya
      if (i < numIslands - 1) {
        const nextPos = islandPositions[i + 1];
        const bridgeEnd = new THREE.Vector3(nextPos.x, nextPos.y + islandHeight / 2, nextPos.z);
        this.createBridge(stageId, gatePos, bridgeEnd);
      }
    }

    // Panggil dekorasi alam semesta siber (balon ayat Quran & lampu laser)
    this.createCyberUniverseDecoration();
  }

  createGate(stageId, position) {
    const gateGroup = new THREE.Group();
    gateGroup.position.copy(position);

    // Frame (Glowing Arch)
    const archGeo = new THREE.TorusGeometry(2.5, 0.3, 8, 24, Math.PI);
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x00e676,
      emissive: 0x00e676,
      emissiveIntensity: 1.0,
      metalness: 0.8
    });
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.position.y = 0.5; // Offset because torus origin is center
    gateGroup.add(arch);

    // Base support pillars
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.5, 8);
    const pillarL = new THREE.Mesh(pillarGeo, archMat);
    pillarL.position.set(-2.5, 0.5, 0);
    const pillarR = pillarL.clone();
    pillarR.position.x = 2.5;
    gateGroup.add(pillarL);
    gateGroup.add(pillarR);

    // Portal vortex shield (semi-transparent glowing center)
    const portalGeo = new THREE.CircleGeometry(2.3, 24);
    const portalMat = new THREE.MeshBasicMaterial({
      color: 0xffd700, // Golden portal
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const portal = new THREE.Mesh(portalGeo, portalMat);
    portal.position.y = 0.5;
    gateGroup.add(portal);

    // Removed the PointLight at the gate to save 30 point light calculations.
    // Removed 960 curved letter textures and meshes to free massive GPU VRAM memory.

    this.scene.add(gateGroup);

    this.gates.push({
      id: stageId,
      position: position.clone(),
      mesh: gateGroup,
      portalMesh: portal,
      radius: 3.5
    });
  }

  createBridge(stageId, startPos, endPos) {
    // Generate path vector
    // We want the bridge to start near the gate, and end at the border of the next island
    const bridgeStart = startPos.clone().add(new THREE.Vector3(0, 0.1, -1)); // Slightly offset forward
    const nextIslandRadius = stageId === 29 ? 14 : 7; // Radius pulau berikutnya
    
    // We want the bridge to end at the edge of the next island
    const direction = new THREE.Vector3().subVectors(endPos, bridgeStart);
    const distance = direction.length();
    direction.normalize();
    
    // Position bridge center
    const bridgeLength = distance - nextIslandRadius + 1; // End a bit inside next island
    const bridgeCenter = bridgeStart.clone().add(direction.clone().multiplyScalar(bridgeLength / 2));

    const bridgeGeo = new THREE.BoxGeometry(3, 0.2, bridgeLength);
    
    // Custom material that glows
    const bridgeMat = new THREE.MeshStandardMaterial({
      color: 0x00e676,
      emissive: 0x00e676,
      emissiveIntensity: 0.1, // Dim when locked
      transparent: true,
      opacity: 0.15, // Barely visible when locked
      roughness: 0.2,
      metalness: 0.9
    });

    const bridgeMesh = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridgeMesh.position.copy(bridgeCenter);
    
    // Align bridge direction to face the next island
    const alignObject = new THREE.Object3D();
    alignObject.position.copy(bridgeCenter);
    alignObject.lookAt(endPos);
    bridgeMesh.rotation.copy(alignObject.rotation);
    
    this.scene.add(bridgeMesh);

    this.bridges.push({
      stageId: stageId, // Locks progression after this stage
      mesh: bridgeMesh,
      material: bridgeMat,
      active: false,
      // For collision detection, save analytical coordinates
      center: bridgeCenter.clone(),
      length: bridgeLength,
      width: 3.0,
      direction: direction.clone(),
      angle: alignObject.rotation.y
    });
  }

  createIslandShards(stageId, islandCenter, radius) {
    // Berikan 6 shard di pulau Tri-surah terakhir, sisanya 3 shard
    const shardCount = stageId === 30 ? 6 : 3;
    const heightOffset = 1.6;

    for (let j = 0; j < shardCount; j++) {
      const angle = (j / shardCount) * Math.PI * 2 + (stageId * 0.5);
      const dist = radius * 0.6; // 60% distance from center
      const shardX = islandCenter.x + Math.sin(angle) * dist;
      const shardZ = islandCenter.z + Math.cos(angle) * dist;
      const shardY = islandCenter.y + heightOffset; // Static height

      const shardId = `shard_${stageId}_${j}`;

      // Shard geometry: Octahedron (2-sided diamond)
      const shardGeo = new THREE.OctahedronGeometry(0.5, 0);
      const shardMat = new THREE.MeshStandardMaterial({
        color: 0xff1744, // Glowing Red/Magenta
        emissive: 0xff1744,
        emissiveIntensity: 0.8,
        metalness: 0.9,
        roughness: 0.1
      });

      const shardMesh = new THREE.Mesh(shardGeo, shardMat);
      shardMesh.position.set(shardX, shardY, shardZ);
      // Removed castShadow to optimize draw performance
      this.scene.add(shardMesh);

      // Removed PointLights from all shards to save 90 point lights calculations.
      // Emissive material alone provides a great futuristic neon glow effect.

      this.shards.push({
        id: shardId,
        stageId: stageId,
        mesh: shardMesh,
        collected: false
      });
    }
  }

  // Set visual states of bridges based on unlocked stages
  syncWorldState() {
    const unlockedStages = this.game.unlockedStages; // E.g., [1] means stage 1 is solved, bridge 1 should unlock
    
    this.bridges.forEach(bridge => {
      // Bridge id represents the stage needed to unlock it
      // E.g., solve Stage 1 (An-Naba) -> unlock Bridge 1 which leads to Island 2
      const isUnlocked = unlockedStages.includes(bridge.stageId);
      bridge.active = isUnlocked;

      if (isUnlocked) {
        bridge.material.color.setHex(0x00e676);
        bridge.material.emissive.setHex(0x00e676);
        bridge.material.emissiveIntensity = 0.8;
        bridge.material.opacity = 0.8;
      } else {
        // Locked: Dim/translucent
        bridge.material.color.setHex(0x33443b);
        bridge.material.emissive.setHex(0x33443b);
        bridge.material.emissiveIntensity = 0.05;
        bridge.material.opacity = 0.15;
      }
    });

    // Update portal lights
    this.gates.forEach(gate => {
      const isCleared = unlockedStages.includes(gate.id);
      if (isCleared) {
        // Change gate to golden victory color
        gate.portalMesh.material.color.setHex(0x00e676);
        gate.portalMesh.material.opacity = 0.6;
      } else {
        gate.portalMesh.material.color.setHex(0xffd700);
        gate.portalMesh.material.opacity = 0.35;
      }
    });
  }

  createPlayer() {
    this.player.group = new THREE.Group();
    
    // Head (Helmet)
    const headGeo = new THREE.SphereGeometry(0.45, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x111622, metalness: 0.9, roughness: 0.1 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.3;
    // Removed castShadow to optimize performance
    this.player.group.add(head);

    // Visor (Glowing part of helmet)
    const visorGeo = new THREE.BoxGeometry(0.6, 0.15, 0.3);
    const visorColor = this.game.getCurrentSkinColor();
    this.player.visorMat = new THREE.MeshBasicMaterial({ color: visorColor });
    this.player.visor = new THREE.Mesh(visorGeo, this.player.visorMat);
    this.player.visor.position.set(0, 1.35, 0.3);
    this.player.group.add(this.player.visor);

    // Body (Techwear Thobe shape)
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.1, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x090f17, metalness: 0.6, roughness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    // Removed castShadow and receiveShadow to optimize performance
    this.player.group.add(body);

    // Neon details lining the suit body
    const trimGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 8);
    this.player.trimMat = new THREE.MeshBasicMaterial({ color: visorColor });
    const trimTop = new THREE.Mesh(trimGeo, this.player.trimMat);
    trimTop.position.y = 0.9;
    this.player.group.add(trimTop);

    const trimBot = trimTop.clone();
    trimBot.position.y = 0.2;
    this.player.group.add(trimBot);

    // Floating glowing hands (L & R)
    const handGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const handMat = new THREE.MeshBasicMaterial({ color: visorColor });
    this.player.handL = new THREE.Mesh(handGeo, handMat);
    this.player.handL.position.set(-0.6, 0.65, 0);
    this.player.group.add(this.player.handL);

    this.player.handR = this.player.handL.clone();
    this.player.handR.position.x = 0.6;
    this.player.group.add(this.player.handR);

    // Position player group
    this.player.group.position.copy(this.player.position);
    this.scene.add(this.player.group);
  }

  // Update dynamic player skin color from inventory
  updatePlayerSkinColor() {
    const colorStr = this.game.getCurrentSkinColor();
    const hex = parseInt(colorStr.replace('#', '0x'));
    
    if (this.player.visorMat) this.player.visorMat.color.setHex(hex);
    if (this.player.trimMat) this.player.trimMat.color.setHex(hex);
    if (this.player.handL) this.player.handL.material.color.setHex(hex);
  }
  initMouseOrbit() {
    let isDragging = false;
    let previousMouseX = 0;
    let previousMouseY = 0;
    
    // Tap detection variables for mouse
    let clickStartX = 0;
    let clickStartY = 0;
    let clickStartTime = 0;

    // Handle mouse drag to rotate camera yaw/pitch at window level
    window.addEventListener('mousedown', (e) => {
      if (this.cameraFocusMode || this.game.state !== 'PLAYING') return;
      
      // Ignore if clicking UI elements
      let target = e.target;
      if (target) {
        if (target.nodeType === 3) { // Node.TEXT_NODE
          target = target.parentNode;
        }
        if (target && typeof target.closest === 'function') {
          if (target.closest('.hud-btn') || 
              target.closest('.hud-panel') || 
              target.closest('#interact-prompt') ||
              target.closest('.puzzle-container') || 
              target.closest('.archive-container') || 
              target.closest('.customizer-container') ||
              target.closest('#joystick-zone') ||
              target.closest('.dpad-container') ||
              target.closest('.dpad-btn')) {
            return;
          }
        }
      }
      
      isDragging = true;
      previousMouseX = e.clientX;
      previousMouseY = e.clientY;
      
      clickStartX = e.clientX;
      clickStartY = e.clientY;
      clickStartTime = Date.now();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging || this.cameraFocusMode) return;
      
      const deltaX = e.clientX - previousMouseX;
      const deltaY = e.clientY - previousMouseY;

      this.cameraRotation.yaw -= deltaX * 0.005;
      this.cameraRotation.pitch = Math.max(-0.6, Math.min(0.2, this.cameraRotation.pitch - deltaY * 0.005));

      previousMouseX = e.clientX;
      previousMouseY = e.clientY;
    });

    window.addEventListener('mouseup', (e) => {
      isDragging = false;
      
      if (this.cameraFocusMode || this.game.state !== 'PLAYING') return;
      
      // Detect tap (click with minimal drag and quick release)
      const dx = e.clientX - clickStartX;
      const dy = e.clientY - clickStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = Date.now() - clickStartTime;
      
      if (dist < 10 && duration < 300) {
        if (this.game.currentProximityGate) {
          this.game.handleInteraction();
        }
      }
    });

    // Touch orbit controls for mobile
    let isDraggingCamera = false;
    let cameraTouchId = null;
    let touchStartX = 0;
    let touchStartY = 0;
    
    // Tap detection variables for touch
    let touchStartTapX = 0;
    let touchStartTapY = 0;
    let touchStartTapTime = 0;
    
    window.addEventListener('touchstart', (e) => {
      if (this.cameraFocusMode || this.game.state !== 'PLAYING') return;
      
      const touch = e.changedTouches[0];
      if (!touch) return;
      
      // Ignore if clicking virtual control regions or HUD elements
      let target = touch.target;
      if (target) {
        if (target.nodeType === 3) { // Node.TEXT_NODE
          target = target.parentNode;
        }
        if (target && typeof target.closest === 'function') {
          if (target.closest('#joystick-zone') || 
              target.closest('.hud-btn') || 
              target.closest('.hud-panel') || 
              target.closest('#interact-prompt') ||
              target.closest('.puzzle-container') || 
              target.closest('.archive-container') || 
              target.closest('.customizer-container') ||
              target.closest('.dpad-container') ||
              target.closest('.dpad-btn')) {
            return;
          }
        }
      }

      if (isDraggingCamera) return; // Only track one camera drag touch at a time

      isDraggingCamera = true;
      cameraTouchId = touch.identifier;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      
      touchStartTapX = touch.clientX;
      touchStartTapY = touch.clientY;
      touchStartTapTime = Date.now();
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isDraggingCamera || this.cameraFocusMode || this.game.state !== 'PLAYING') return;
      
      let touch = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === cameraTouchId) {
          touch = e.touches[i];
          break;
        }
      }
      if (!touch) return;
      
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      this.cameraRotation.yaw -= deltaX * 0.008;
      this.cameraRotation.pitch = Math.max(-0.6, Math.min(0.2, this.cameraRotation.pitch - deltaY * 0.008));

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    const endCameraDrag = (e) => {
      if (!isDraggingCamera) return;
      
      let touchEnded = false;
      let endedTouch = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === cameraTouchId) {
          touchEnded = true;
          endedTouch = e.changedTouches[i];
          break;
        }
      }
      
      if (touchEnded) {
        isDraggingCamera = false;
        cameraTouchId = null;
        
        // Detect tap (touch release with minimal movement and short duration)
        if (endedTouch && this.game.state === 'PLAYING' && !this.cameraFocusMode) {
          const dx = endedTouch.clientX - touchStartTapX;
          const dy = endedTouch.clientY - touchStartTapY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const duration = Date.now() - touchStartTapTime;
          
          if (dist < 15 && duration < 350) {
            if (this.game.currentProximityGate) {
              this.game.handleInteraction();
            }
          }
        }
      }
    };

    window.addEventListener('touchend', endCameraDrag);
    window.addEventListener('touchcancel', endCameraDrag);
  }

  // Smooth Focus transition during puzzles
  setCameraFocus(enabled, targetGate = null) {
    this.cameraFocusMode = enabled;
    this.cameraFocusTarget = targetGate;
    
    if (enabled) {
      this.targetCameraDistance = 3.5;
    } else {
      this.targetCameraDistance = 8;
    }
  }

  onWindowResize() {
    const width = this.container.clientWidth || window.innerWidth || 800;
    const height = this.container.clientHeight || window.innerHeight || 600;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // Main game update loop
  update(deltaTime) {
    if (deltaTime > 0.1) deltaTime = 0.1; // Cap delta to avoid giant physics steps

    // Rotate shards
    this.shards.forEach(shard => {
      if (!shard.collected) {
        shard.mesh.rotation.y += 1.5 * deltaTime;
        shard.mesh.rotation.x += 0.5 * deltaTime;
        // Removed wavy hover animation to save CPU Math.sin calls
      }
    });

    // Update active particle systems
    this.updateParticles(deltaTime);

    // Disabled cyber universe update call since balloons and lasers are static now

    // Only simulate player/physics if active and not in puzzle focus mode
    if (this.game.state === 'PLAYING') {
      if (!this.cameraFocusMode) {
        this.updatePhysics(deltaTime);
      }
      this.checkCollisions();
    }

    this.updateCamera(deltaTime);
    this.renderer.render(this.scene, this.camera);
  }

  updatePhysics(deltaTime) {
    // 1. Get input vector from controls
    const input = this.game.controls.getMovement();
    
    // 2. Convert input to camera coordinates
    // W moves forward relative to camera view yaw direction
    const forwardVec = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraRotation.yaw);
    const rightVec = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraRotation.yaw);
    
    const moveVec = new THREE.Vector3()
      .addScaledVector(forwardVec, -input.z) // Keyboard W is -z, joystick y is - to +
      .addScaledVector(rightVec, input.x);
    
    if (moveVec.length() > 0) {
      moveVec.normalize();
      
      // Face player to movement direction
      const angle = Math.atan2(moveVec.x, moveVec.z);
      this.player.group.rotation.y = angle;
      
      // Accelerate player velocity
      this.player.velocity.x = moveVec.x * this.moveSpeed;
      this.player.velocity.z = moveVec.z * this.moveSpeed;
      
      // Floating hands swinging animation
      const swing = Math.sin(Date.now() * 0.01) * 0.25;
      this.player.handL.position.z = swing;
      this.player.handR.position.z = -swing;
    } else {
      // Decelerate (Friction)
      this.player.velocity.x *= 0.15;
      this.player.velocity.z *= 0.15;
      
      // Idle hands animation
      this.player.handL.position.z = 0;
      this.player.handR.position.z = 0;
    }

    // 3. Gravity & Jump
    if (!this.player.onGround) {
      this.player.velocity.y += this.gravity * deltaTime;
    } else if (this.game.controls.getJump()) {
      this.player.velocity.y = this.jumpForce;
      this.player.onGround = false;
      this.createJumpParticles();
    }

    // 4. Update Position
    this.player.position.x += this.player.velocity.x * deltaTime;
    this.player.position.y += this.player.velocity.y * deltaTime;
    this.player.position.z += this.player.velocity.z * deltaTime;
    
    this.player.group.position.copy(this.player.position);
    
    // Save distance score based on progress along Z axis
    // Start island center is Z=0. Player runs in negative Z direction.
    const distanceScore = Math.max(0, Math.floor(-this.player.position.z));
    this.game.updateScore(distanceScore);
  }

  checkCollisions() {
    let standingOnObject = false;
    let standingY = -999;

    // A. Collision with Islands
    this.islands.forEach((island, index) => {
      // Distance check on X/Z plane
      const dx = this.player.position.x - island.x;
      const dz = this.player.position.z - island.z;
      const distSq = dx * dx + dz * dz;

      // Player stands on cylinder top
      if (distSq < (island.radius + 0.3) * (island.radius + 0.3)) {
        // Vertical height overlap check
        if (this.player.position.y >= island.y - 0.5 && this.player.position.y <= island.y + 0.8) {
          standingOnObject = true;
          standingY = Math.max(standingY, island.y);
          
          // Save checkpoint
          this.player.lastSafePosition.set(island.x, island.y + 1, island.z);
          this.player.lastSafeIslandIndex = index;
        }
      }
    });

    // B. Collision with Bridges (if active/unlocked)
    this.bridges.forEach(bridge => {
      if (!bridge.active) return;

      // Project player onto the bridge line path in 3D
      const toPlayer = new THREE.Vector3().subVectors(this.player.position, bridge.center);
      const localZ = toPlayer.dot(bridge.direction); // Position along the length of the bridge

      // Calculate perpendicular horizontal distance (width check) using X/Z plane projection
      const dir2D = new THREE.Vector2(bridge.direction.x, bridge.direction.z).normalize();
      const perp2D = new THREE.Vector2(dir2D.y, -dir2D.x);
      const toPlayer2D = new THREE.Vector2(this.player.position.x - bridge.center.x, this.player.position.z - bridge.center.z);
      const localX = toPlayer2D.dot(perp2D);

      if (Math.abs(localZ) <= bridge.length / 2 && Math.abs(localX) <= bridge.width / 2 + 0.4) {
        // Dynamic height calculation on the inclined bridge surface
        const bridgeSurfaceY = bridge.center.y + localZ * bridge.direction.y;
        
        // Toleransi tinggi berdiri di atas jembatan miring
        if (this.player.position.y >= bridgeSurfaceY - 0.5 && this.player.position.y <= bridgeSurfaceY + 0.8) {
          standingOnObject = true;
          standingY = Math.max(standingY, bridgeSurfaceY);
          
          // Save bridge position as safe checkpoint
          this.player.lastSafePosition.copy(this.player.position);
        }
      }
    });

    // Ground landing resolve
    if (standingOnObject) {
      if (this.player.velocity.y <= 0) {
        this.player.position.y = standingY;
        this.player.velocity.y = 0;
        this.player.onGround = true;
        this.player.group.position.y = this.player.position.y;
      }
    } else {
      this.player.onGround = false;
    }

    // C. Collision with Noor Shards (Collectibles)
    this.shards.forEach(shard => {
      if (shard.collected) return;

      const dx = this.player.position.x - shard.mesh.position.x;
      const dy = this.player.position.y + 1.0 - shard.mesh.position.y; // Match mid player height
      const dz = this.player.position.z - shard.mesh.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < 1.8 * 1.8) {
        this.collectShard(shard);
      }
    });

    // D. Proximity detection with Anomaly Gates
    let nearGate = null;
    this.gates.forEach(gate => {
      const dx = this.player.position.x - gate.position.x;
      const dz = this.player.position.z - gate.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < gate.radius) {
        nearGate = gate;
      }
    });

    if (nearGate) {
      const isAlreadyUnlocked = this.game.unlockedStages.includes(nearGate.id);
      if (!isAlreadyUnlocked) {
        this.game.ui.showInteractPrompt(`Memulihkan Gerbang ${window.quranData[nearGate.id - 1].name}`);
        this.game.setProximityGate(nearGate);
      } else {
        this.game.ui.showInteractPrompt(`Mushaf ${window.quranData[nearGate.id - 1].name} Pulih`);
        this.game.setProximityGate(null); // No interactive gate because solved
      }
    } else {
      this.game.ui.hideInteractPrompt();
      this.game.setProximityGate(null);
    }

    // E. Deteksi jatuh bebas (berdasarkan altitudo aman terakhir)
    const currentSafeY = this.player.lastSafePosition.y;
    if (this.player.position.y < currentSafeY - 12 && !this.player.isFalling) {
      this.handlePlayerFall();
    }
  }

  collectShard(shard) {
    shard.collected = true;
    shard.mesh.visible = false;
    this.scene.remove(shard.mesh);

    // Audio/visual splash
    this.createShardSplashParticles(shard.mesh.position);

    // Register collection in game session
    this.game.collectShard(shard.id);
  }

  handlePlayerFall() {
    this.player.isFalling = true;
    this.game.ui.showNotification("Sistem Runtuh! Memulihkan Posisi...", "incorrect");

    // Glitch effect: flash screen or fade player
    setTimeout(() => {
      // Teleport to last safe checkpoint
      this.player.position.copy(this.player.lastSafePosition);
      this.player.velocity.set(0, 0, 0);
      this.player.group.position.copy(this.player.position);
      this.player.onGround = true;
      this.player.isFalling = false;
    }, 1000);
  }

  // Particle VFX on Shard collection
  createShardSplashParticles(position) {
    const count = 15;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 5 + 2,
          (Math.random() - 0.5) * 6
        )
      );
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xff1744, // Pink/red particles
      size: 0.6,
      transparent: true,
      opacity: 1
    });

    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);

    // Register active particles for update loop
    this.activeParticles.push({
      mesh: particles,
      geometry: geometry,
      material: material,
      velocities: velocities,
      age: 0,
      maxAge: 0.8,
      count: count,
      isJumpParticle: false
    });
  }

  createJumpParticles() {
    const count = 8;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = this.player.position.x + (Math.random() - 0.5) * 0.8;
      positions[i * 3 + 1] = this.player.position.y;
      positions[i * 3 + 2] = this.player.position.z + (Math.random() - 0.5) * 0.8;

      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 1.5,
          (Math.random() - 0.5) * 2
        )
      );
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x00e676, // Emerald glow
      size: 0.35,
      transparent: true,
      opacity: 0.8
    });

    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);

    this.activeParticles.push({
      mesh: particles,
      geometry: geometry,
      material: material,
      velocities: velocities,
      age: 0,
      maxAge: 0.4,
      count: count,
      isJumpParticle: true
    });
  }

  // Update active particle systems in main loop (VSync aligned)
  updateParticles(deltaTime) {
    for (let idx = this.activeParticles.length - 1; idx >= 0; idx--) {
      const p = this.activeParticles[idx];
      p.age += deltaTime;

      if (p.age >= p.maxAge) {
        this.scene.remove(p.mesh);
        p.geometry.dispose();
        p.material.dispose();
        if (p.light) {
          this.scene.remove(p.light);
        }
        this.activeParticles.splice(idx, 1);
        continue;
      }

      const positions = p.mesh.geometry.attributes.position.array;
      for (let i = 0; i < p.count; i++) {
        const vel = p.velocities[i];
        positions[i * 3] += vel.x * deltaTime;
        positions[i * 3 + 1] += vel.y * deltaTime;
        positions[i * 3 + 2] += vel.z * deltaTime;

        // Apply dynamic gravity depending on particle type
        if (p.isFirework) {
          vel.y -= 3.0 * deltaTime; // Slower graceful fall for firework sparks
        } else if (!p.isJumpParticle) {
          vel.y -= 9.8 * deltaTime; // Normal gravity for shard splash
        }
      }
      p.mesh.geometry.attributes.position.needsUpdate = true;

      // Peredupan intensitas cahaya PointLight kembang api
      if (p.light) {
        p.light.intensity = Math.max(0, 4.0 * (1.0 - (p.age / p.maxAge)));
      }

      // Smooth opacity fade
      if (p.isJumpParticle) {
        p.material.opacity = 0.8 - (p.age / p.maxAge) * 0.8;
      } else {
        p.material.opacity = 1.0 - (p.age / p.maxAge);
      }
    }
  }

  // Camera Follow Positioning
  updateCamera(deltaTime) {
    // Zoom easing
    this.cameraDistance = THREE.MathUtils.lerp(this.cameraDistance, this.targetCameraDistance, 5 * deltaTime);

    if (this.cameraFocusMode && this.cameraFocusTarget) {
      // 1. Puzzle focus view: Place camera in front of the gate facing it
      const gatePos = this.cameraFocusTarget.position;
      const targetCamPos = gatePos.clone().add(new THREE.Vector3(0, 2.0, 4));
      
      this.camera.position.lerp(targetCamPos, 6 * deltaTime);
      this.camera.lookAt(gatePos.clone().add(new THREE.Vector3(0, 1.5, 0)));
    } else {
      // 2. Normal Third-Person follow view
      const targetLookAt = this.player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      
      // Calculate offset based on yaw/pitch
      const offset = new THREE.Vector3(0, 0, this.cameraDistance);
      offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraRotation.pitch);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraRotation.yaw);
      
      const targetCamPos = targetLookAt.clone().add(offset);
      
      // Smoothly interpolate camera position
      this.camera.position.lerp(targetCamPos, 7 * deltaTime);
      this.camera.lookAt(targetLookAt);
    }
  }

  // Removed createCharacterTexture since letter geometries were optimized out

  createFireworkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    return new THREE.CanvasTexture(canvas);
  }

  // Pemicu ledakan kembang api siber spherical
  triggerFireworkExplosion(position, color) {
    const count = 30; // Reduced particles for performance
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 5.5 + Math.random() * 6.5;

      velocities.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed + 2.0,
          Math.cos(phi) * speed
        )
      );
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: color,
      size: 1.4,
      map: this.fireworkTexture || (this.fireworkTexture = this.createFireworkTexture()),
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);

    // Removed the dynamic PointLight creation to prevent shader recompilation lag

    this.activeParticles.push({
      mesh: particles,
      geometry: geometry,
      material: material,
      velocities: velocities,
      age: 0,
      maxAge: 1.6,
      count: count,
      isFirework: true
    });
  }

  // Dekorasi Alam Semesta Siber (Balon Ayat Quran & Laser)
  createCyberUniverseDecoration() {
    const quranPhrases = [
      "بِسْمِ ٱللَّهِ", "ٱلْحَمْدُ لِلَّهِ", "سُبْحَانَ ٱللَّهِ", "ٱللَّهُ أَكْبَرُ",
      "لَا إِلَٰهَ إِلَّا ٱللَّهُ", "مَا شَاءَ ٱللَّهُ", "إِنْ شَاءَ ٱللَّهُ", "أَسْتَغْفِرُ ٱللَّهِ",
      "قُلْ هُوَ ٱللَّهُ أَحَدٌ", "ٱلصَّمَدُ", "رَبِّ ٱلْعَـٰلَمِينَ", "ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ"
    ];

    // 1. Buat 15 Balon Udara Kaligrafi Melayang (Ditempatkan langsung dekat pulau secara statis)
    for (let i = 0; i < 15; i++) {
      const stageIdx = Math.min(this.islands.length - 1, Math.floor(i * 2));
      const targetIsland = this.islands[stageIdx] || this.islands[0];

      const angle = Math.random() * Math.PI * 2;
      const dist = 14 + Math.random() * 8; // Ditempatkan langsung dekat pulau
      const x = targetIsland.x + Math.sin(angle) * dist;
      const z = targetIsland.z + Math.cos(angle) * dist;
      const y = targetIsland.y + 6 + Math.random() * 8;

      this.createCyberBalloon(new THREE.Vector3(x, y, z), quranPhrases[i % quranPhrases.length]);
    }

    // 2. Buat 3 Tiang Sinar Laser Berkilau (Dikecilkan jumlahnya demi performa)
    const laserColors = [0x00e676, 0xffd700, 0xff1744, 0x29b6f6, 0xab47bc];
    for (let i = 0; i < 3; i++) {
      const islandIdx = Math.floor(Math.random() * 28) + 1;
      const island = this.islands[islandIdx];
      if (island) {
        const angle = Math.random() * Math.PI * 2;
        const x = island.x + Math.sin(angle) * (island.radius - 1.5);
        const z = island.z + Math.cos(angle) * (island.radius - 1.5);
        const y = island.y;

        const color = laserColors[i % laserColors.length];
        this.createLaserBeam(new THREE.Vector3(x, y, z), color);
      }
    }
  }

  createCyberBalloon(position, text) {
    const balloonGroup = new THREE.Group();
    balloonGroup.position.copy(position);

    // 1. Balon Udara neon frame (Lampion siber) - simplified geometry and material
    const balloonGeo = new THREE.SphereGeometry(1.8, 12, 12); // Reduced segments for performance
    
    const canvas = document.createElement('canvas');
    canvas.width = 128; // Reduced canvas resolution
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background glowing soft siber
    ctx.fillStyle = 'rgba(10, 24, 16, 0.88)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border neon emas
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    
    // Teks Arab Uthmani Kaligrafi
    ctx.font = 'bold 20px Amiri, serif';
    ctx.fillStyle = '#00e676'; // Emerald neon
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const balloonMat = new THREE.MeshStandardMaterial({
      map: texture,
      emissive: 0x00e676,
      emissiveIntensity: 0.35,
      metalness: 0.1,
      roughness: 0.2,
      transparent: true,
      opacity: 0.95
    });

    const balloonMesh = new THREE.Mesh(balloonGeo, balloonMat);
    balloonGroup.add(balloonMesh);

    // Removed the Saturn ring, Cylinder rope, Bulb geometry, and local PointLight to greatly optimize drawing and GPU performance.

    this.scene.add(balloonGroup);

    // Balloons are now static meshes, so we do not push them to the update loop array (no reference errors or runtime animation costs!)
  }

  createLaserBeam(position, color) {
    const laserGroup = new THREE.Group();
    laserGroup.position.copy(position);

    const height = 120;
    const laserGeo = new THREE.CylinderGeometry(0.08, 0.08, height, 8);
    const laserMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });

    const laserMesh = new THREE.Mesh(laserGeo, laserMat);
    laserMesh.position.y = height / 2;
    laserGroup.add(laserMesh);

    // Cincin pelindung laser di dasar
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.8, 0.3, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x111622, metalness: 0.9, roughness: 0.2 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.15;
    laserGroup.add(baseMesh);

    this.scene.add(laserGroup);

    this.lasers.push({
      group: laserGroup,
      mesh: laserMesh,
      material: laserMat,
      baseOpacity: 0.45,
      angleSpeed: 0.05 + Math.random() * 0.05,
      wobbleSpeed: 0.5 + Math.random() * 0.8,
      seed: Math.random() * 100
    });
  }

  // Animasikan balon udara Quran dan tiang sinar laser (VSync aligned)
  updateCyberUniverse(deltaTime) {
    // Disabled all balloon and laser animations for maximum performance and completely static scenery
  }

  // Teleport player back to start of current stage (useful on exit or reset)
  resetPlayerToStage(stageId) {
    const islandIndex = Math.max(0, stageId - 1);
    const island = this.islands[islandIndex];
    if (island) {
      this.player.position.set(island.x, island.y + 1, island.z);
      this.player.velocity.set(0, 0, 0);
      this.player.group.position.copy(this.player.position);
      this.player.lastSafePosition.copy(this.player.position);
      this.player.lastSafeIslandIndex = islandIndex;
      this.player.onGround = true;
    }
  }

  clearScene() {
    // Reset collected shards on reset
    this.shards.forEach(shard => {
      if (shard.collected) {
        shard.collected = false;
        shard.mesh.visible = true;
        this.scene.add(shard.mesh);
      }
    });
  }
}

// Export Engine3D
if (typeof window !== 'undefined') {
  window.Engine3D = Engine3D;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Engine3D;
}
