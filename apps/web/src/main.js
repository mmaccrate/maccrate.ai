// main.js - Entry point for Three.js stage
import * as THREE from 'three';

export class StageScene {
  scene;
  camera;
  renderer;
  canvas;
  raycaster;
  mouse;
  instruments = [];
  hoveredInstrument = null;
  isInitialized = false;
  animationFrameId = null;

  constructor(canvas, slots = []) {
    this.canvas = canvas;
    this.slots = slots;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);
    this.scene.fog = new THREE.FogExp2(0x0a0a0f, 0.02);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 15, 25);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.init();
  }

  init() {
    this.setupLighting();
    this.addGrid();
    this.loadSlots(this.slots);
    this.addEventListeners();
    this.isInitialized = true;
    this.animate();

    window.dispatchEvent(new CustomEvent('camera-ready', { detail: { camera: this.camera } }));
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    const blueLight1 = new THREE.PointLight(0x0066ff, 2, 50);
    blueLight1.position.set(-15, 5, 10);
    this.scene.add(blueLight1);

    const blueLight2 = new THREE.PointLight(0x0066ff, 2, 50);
    blueLight2.position.set(15, 5, 10);
    this.scene.add(blueLight2);
  }

  addGrid() {
    const gridHelper = new THREE.GridHelper(50, 50, 0x333355, 0x111122);
    gridHelper.position.y = -1;
    this.scene.add(gridHelper);
  }

  loadSlots(slots) {
    slots.forEach(slot => this.addInstrumentSlot(slot));
  }

  addInstrumentSlot(slot) {
    let geometry, color;

    switch (slot.instrumentType) {
      case 'saxophone':
        geometry = new THREE.CylinderGeometry(0.15, 0.2, 2, 8);
        color = 0xC7894F;
        break;
      case 'trumpet':
      case 'trombone':
        geometry = new THREE.CylinderGeometry(0.1, 0.15, 1.5, 6);
        color = 0xC0C0C0;
        break;
      case 'piano':
        geometry = new THREE.BoxGeometry(1.5, 0.8, 0.6);
        color = 0x1a1a1a;
        break;
      case 'bass':
        geometry = new THREE.CylinderGeometry(0.08, 0.12, 2.5, 6);
        color = 0x3d2817;
        break;
      case 'drums':
        geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16);
        color = 0x8B4513;
        break;
      case 'guitar':
        geometry = new THREE.CylinderGeometry(0.1, 0.2, 1.2, 6);
        color = 0x8B4513;
        break;
      default:
        geometry = new THREE.OctahedronGeometry(0.3);
        color = 0x222244;
    }

    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: ['saxophone', 'trumpet', 'trombone'].includes(slot.instrumentType) ? 0.9 : 0.3,
      roughness: 0.2,
      emissive: slot.instrumentType === 'saxophone' ? 0x442200 : 0x000000,
      emissiveIntensity: 0.2,
      wireframe: true
    });

    const instrument = new THREE.Mesh(geometry, material);
    instrument.position.set(slot.position.x, slot.position.y + 1, slot.position.z);
    instrument.castShadow = true;
    instrument.userData = { 
      id: slot.id, 
      type: slot.instrumentType,
      content: slot.content,
      active: slot.isActive
    };

    this.instruments.push(instrument);
    this.scene.add(instrument);

    if (slot.content) {
      this.addTextLabel(slot.content.title, slot.position);
    }
  }

  addTextLabel(text, position) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#C7894F';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const maxWidth = canvas.width - 32;
    let displayText = text;
    if (ctx.measureText(text).width > maxWidth) {
      while (displayText.length > 0 && ctx.measureText(displayText + '...').width > maxWidth) {
        displayText = displayText.slice(0, -1);
      }
      displayText += '...';
    }
    
    ctx.fillText(displayText, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      opacity: 0.9
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(6, 1.5, 1);
    sprite.position.set(position.x, position.y + 3.5, position.z);
    sprite.userData = { isLabel: true, text: text };
    
    this.scene.add(sprite);
    this.instruments.push(sprite);
  }

  addEventListeners() {
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.returnToMacro();
    });
  }

  onMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.instruments);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (this.hoveredInstrument !== hit) {
        if (this.hoveredInstrument) this.resetHover(this.hoveredInstrument);
        this.hoveredInstrument = hit;
        this.applyHover(hit);
        this.canvas.style.cursor = 'pointer';
      }
    } else {
      if (this.hoveredInstrument) {
        this.resetHover(this.hoveredInstrument);
        this.hoveredInstrument = null;
      }
      this.canvas.style.cursor = 'default';
    }
  }

  applyHover(instrument) {
    const mat = instrument.material;
    if (mat.emissive) {
      mat.emissive.setHex(0x664422);
      mat.emissiveIntensity = 0.8;
    }
    instrument.scale.set(1.1, 1.1, 1.1);
  }

  resetHover(instrument) {
    const mat = instrument.material;
    if (mat.emissive) {
      mat.emissive.setHex(instrument.userData.type === 'saxophone' ? 0x442200 : 0x000000);
      mat.emissiveIntensity = 0.2;
    }
    instrument.scale.set(1, 1, 1);
  }

  onClick(event) {
    if (this.hoveredInstrument) {
      const inst = this.hoveredInstrument;
      const pos = inst.position;
      this.animateCameraTo(new THREE.Vector3(pos.x * 0.3, pos.y + 3, pos.z + 5), () => {
        this.camera.lookAt(pos);
        window.dispatchEvent(new CustomEvent('stagezoom', { detail: { level: 'mid', instrument: inst.userData.id } }));
      });
    }
  }

  animateCameraTo(target, onComplete) {
    const start = this.camera.position.clone();
    const duration = 800;
    const startTime = performance.now();

    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(start, target, eased);
      this.camera.lookAt(0, 0, 0);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (onComplete) {
        onComplete();
      }
    };
    requestAnimationFrame(animate);
  }

  returnToMacro() {
    this.animateCameraTo(new THREE.Vector3(0, 15, 25), () => {
      this.camera.lookAt(0, 0, 0);
      window.dispatchEvent(new CustomEvent('stagezoom', { detail: { level: 'macro', instrument: null } }));
    });
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    const time = performance.now() * 0.001;
    this.instruments.forEach(inst => {
      if (inst.userData && inst.userData.active) {
        const scale = 1 + Math.sin(time * 2) * 0.02;
        inst.scale.set(scale, scale, scale);
      }
    });
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    this.scene.clear();
  }
}

// Export for use in Astro components
export function initStage(canvasElement, slots = []) {
  if (!canvasElement || canvasElement.dataset.initialized) return null;
  
  canvasElement.dataset.initialized = 'true';
  return new StageScene(canvasElement, slots);
}
