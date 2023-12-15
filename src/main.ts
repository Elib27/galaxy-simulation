import './style.css'
import * as THREE from 'three';
import * as dat from 'dat.gui';
import Stats from 'three/examples/jsm/libs/stats.module'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas') as HTMLCanvasElement,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

camera.position.set(0, 1000, 0);

const stats = new Stats()
document.body.appendChild(stats.dom)

let IS_SIMULATION_RUNNING = true;

// GUI
var parameters = {
  initialSpeed: 5,
  starsNumber: 500,
  timeStep: 1,
  pauseResume: () => IS_SIMULATION_RUNNING = !IS_SIMULATION_RUNNING,
  reset: () => initialiseSimulation(),
};

var gui = new dat.GUI();

var cam = gui.addFolder('simulation');
cam.add(parameters, 'initialSpeed', 0, 10).name('initial speed').listen().onChange(() => initialiseSimulation());
cam.add(parameters, 'starsNumber', 100, 2000).step(10).name('stars number').listen().onChange(() => initialiseSimulation());
cam.add(parameters, 'timeStep', 0, 10).step(0.1).name('time step').listen();
cam.open();

gui.add(parameters, 'pauseResume').name('pause/resume');
gui.add(parameters, 'reset');

const GALAXY_DIAMETER = 1000;
const GALAXY_HEIGHT = 50;
const SMOOTHING_LENGTH = 30;

let stars: number[] = []
let starSpeeds: number[] = []

function initialiseStarsPosition() {
  stars = Array<number>(parameters.starsNumber * 3).fill(0)
  for (let i = 0; i < parameters.starsNumber; i++) {
    const r = Math.cbrt(Math.random()) * GALAXY_DIAMETER / 2;
    const theta = THREE.MathUtils.randFloat(0, 2 * Math.PI); 
    const phi = Math.acos(THREE.MathUtils.randFloat(-1, 1));

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta) * GALAXY_HEIGHT / GALAXY_DIAMETER;
    const z = r * Math.cos(phi);

    stars[3*i] = x;
    stars[3*i + 1] = y;
    stars[3*i + 2] = z;
  }
  geometryStars.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
}

function initialiseStarsSpeed() {
  starSpeeds = Array<number>(parameters.starsNumber * 3).fill(0);
  for (let i = 0; i < parameters.starsNumber; i++) {
    const speed = Math.sqrt(stars[3*i]**2 + stars[3*i + 2]**2) * parameters.initialSpeed / (GALAXY_DIAMETER * 2);
    const r = new THREE.Vector3(stars[3*i], 0, stars[3*i + 2]).normalize();
    const speedVector = new THREE.Vector3(-r.z, 0, r.x).multiplyScalar(speed);
    starSpeeds[3*i] = speedVector.x;
    starSpeeds[3*i + 2] = speedVector.z;
  }
}

function initialiseSimulation() {
  initialiseStarsPosition();
  initialiseStarsSpeed();
}

const geometryStars = new THREE.BufferGeometry();
geometryStars.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
const material = new THREE.PointsMaterial({ color: 0xffffff });
const points = new THREE.Points(geometryStars, material);

initialiseSimulation();

scene.add(points);

function updateStarPositions() {
  const positionAttribute = points.geometry.getAttribute('position');
  const newPositions = new THREE.Float32BufferAttribute(Array(parameters.starsNumber * 3), 3);
  for (let i = 0; i < parameters.starsNumber; i++) {
    const acceleration = new THREE.Vector3(0, 0, 0);
    const currStar = new THREE.Vector3(positionAttribute.getX(i), positionAttribute.getY(i), positionAttribute.getZ(i));
    for (let j = 0; j < parameters.starsNumber; j++) {
      if (i === j) continue;
      const star = new THREE.Vector3(positionAttribute.getX(j), positionAttribute.getY(j), positionAttribute.getZ(j));
      const distance = currStar.distanceTo(star);
      const direction = star.sub(currStar).normalize();
      acceleration.add(direction.divideScalar(distance**2 + SMOOTHING_LENGTH));
    }
    starSpeeds[3*i] += acceleration.x * parameters.timeStep;
    starSpeeds[3*i + 1] += acceleration.y * parameters.timeStep;
    starSpeeds[3*i + 2] += acceleration.z * parameters.timeStep;
    const speed = new THREE.Vector3(starSpeeds[3*i], starSpeeds[3*i + 1], starSpeeds[3*i + 2]);
    currStar.add(speed.multiplyScalar(parameters.timeStep));
    newPositions.setXYZ(i, currStar.x, currStar.y, currStar.z);
  }
  geometryStars.setAttribute('position', newPositions);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (IS_SIMULATION_RUNNING) {
    updateStarPositions();
  }
  stats.update();
  renderer.render(scene, camera);
}

animate();

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize( window.innerWidth, window.innerHeight );
}

window.addEventListener( 'resize', onWindowResize);