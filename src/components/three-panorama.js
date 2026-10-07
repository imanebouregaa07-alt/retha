import * as THREE from 'three';

export class PanoramaViewer {
  constructor(containerElement, imageUrl) {
    this.container = containerElement;
    this.imageUrl = imageUrl;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.sphere = null;

    this.isUserInteracting = false;
    this.onMouseDownMouseX = 0;
    this.onMouseDownMouseY = 0;
    this.lon = 90;
    this.onMouseDownLon = 0;
    this.lat = 0;
    this.onMouseDownLat = 0;
    this.phi = 0;
    this.theta = 0;
    this.target = new THREE.Vector3();
    this.fov = 75;
    this.autoRotate = true;
    this.autoRotateSpeed = 0.04;
    this.animId = null;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.fov, width / height, 1, 1100);
    this.camera.target = new THREE.Vector3(0, 0, 0);

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(this.imageUrl, () => {
      if (this.renderer) this.render();
    });
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshBasicMaterial({ map: texture });
    this.sphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.sphere);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.bindEvents();
    this.animate();
  }

  bindEvents() {
    const dom = this.renderer.domElement;

    this.onPointerDownHandler = (event) => {
      this.isUserInteracting = true;
      this.autoRotate = false;
      const clientX = event.clientX || (event.touches && event.touches[0].clientX);
      const clientY = event.clientY || (event.touches && event.touches[0].clientY);
      this.onMouseDownMouseX = clientX;
      this.onMouseDownMouseY = clientY;
      this.onMouseDownLon = this.lon;
      this.onMouseDownLat = this.lat;
    };

    this.onPointerMoveHandler = (event) => {
      if (!this.isUserInteracting) return;
      const clientX = event.clientX || (event.touches && event.touches[0].clientX);
      const clientY = event.clientY || (event.touches && event.touches[0].clientY);
      this.lon = (this.onMouseDownMouseX - clientX) * 0.15 + this.onMouseDownLon;
      this.lat = (clientY - this.onMouseDownMouseY) * 0.15 + this.onMouseDownLat;
    };

    this.onPointerUpHandler = () => {
      this.isUserInteracting = false;
      // Resume slow idle rotate after 3 seconds of inactivity
      clearTimeout(this.idleTimeout);
      this.idleTimeout = setTimeout(() => {
        this.autoRotate = true;
      }, 2500);
    };

    this.onWheelHandler = (event) => {
      event.preventDefault();
      this.fov += event.deltaY * 0.05;
      this.fov = Math.max(40, Math.min(95, this.fov));
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    };

    this.onResizeHandler = () => {
      if (!this.container || !this.renderer) return;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      if (width && height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
      }
    };

    dom.addEventListener('mousedown', this.onPointerDownHandler, { passive: true });
    window.addEventListener('mousemove', this.onPointerMoveHandler, { passive: true });
    window.addEventListener('mouseup', this.onPointerUpHandler, { passive: true });

    dom.addEventListener('touchstart', this.onPointerDownHandler, { passive: true });
    window.addEventListener('touchmove', this.onPointerMoveHandler, { passive: true });
    window.addEventListener('touchend', this.onPointerUpHandler, { passive: true });

    dom.addEventListener('wheel', this.onWheelHandler, { passive: false });
    window.addEventListener('resize', this.onResizeHandler);
  }

  animate() {
    this.animId = requestAnimationFrame(() => this.animate());

    if (this.autoRotate && !this.isUserInteracting) {
      this.lon += this.autoRotateSpeed;
    }

    this.lat = Math.max(-85, Math.min(85, this.lat));
    this.phi = THREE.MathUtils.degToRad(90 - this.lat);
    this.theta = THREE.MathUtils.degToRad(this.lon);

    this.target.x = 500 * Math.sin(this.phi) * Math.cos(this.theta);
    this.target.y = 500 * Math.cos(this.phi);
    this.target.z = 500 * Math.sin(this.phi) * Math.sin(this.theta);

    this.camera.lookAt(this.target);
    this.render();
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
    clearTimeout(this.idleTimeout);

    window.removeEventListener('mousemove', this.onPointerMoveHandler);
    window.removeEventListener('mouseup', this.onPointerUpHandler);
    window.removeEventListener('touchmove', this.onPointerMoveHandler);
    window.removeEventListener('touchend', this.onPointerUpHandler);
    window.removeEventListener('resize', this.onResizeHandler);

    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
    if (this.sphere && this.sphere.geometry) {
      this.sphere.geometry.dispose();
    }
  }
}
