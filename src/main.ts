import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas') as HTMLCanvasElement,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

camera.position.set(0, 800, 0);

const axesHelper = new THREE.AxesHelper( 100 );
scene.add( axesHelper );


const STARS_NUMBER = 500;
const GALAXY_DIAMETER = 1000;
const GALAXY_HEIGHT = 100;
const TIME_STEP = 2;
const SMOOTHING_LENGTH = 30;
const INITIAL_SPEED = 5;

// Create and position stars in a galax
const vertices = [];
for (let i = 0; i < STARS_NUMBER; i++) {
  const r = Math.cbrt(Math.random()) * GALAXY_DIAMETER / 2;
  const theta = THREE.MathUtils.randFloat(0, 2 * Math.PI); 
  const phi = Math.acos(THREE.MathUtils.randFloat(-1, 1));

  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta) * GALAXY_HEIGHT / GALAXY_DIAMETER;
  const z = r * Math.cos(phi);

  vertices.push(x, y, z);
}

// const speeds = Array<number>(STARS_NUMBER * 3).fill(0);

// initialise speeds to make the galaxy turn on itself
const speeds: number[] = [];
// const arrows = new THREE.Group;
for (let i = 0; i < STARS_NUMBER; i++) {
  const speed = Math.sqrt(vertices[3*i]**2 + vertices[3*i + 2]**2) * INITIAL_SPEED / (GALAXY_DIAMETER * 2);
  const r = new THREE.Vector3(vertices[3*i], 0, vertices[3*i + 2]).normalize();
  const speedVector = new THREE.Vector3(-r.z, 0, r.x).multiplyScalar(speed);
  speeds.push(speedVector.x, 0, speedVector.z);
  // const arrowHelper = new THREE.ArrowHelper(speedVector.normalize, new THREE.Vector3(vertices[3*i], vertices[3*i + 1], vertices[3*i + 2]), speed * 100 / INITIAL_SPEED, 0xff0000);
  // arrows.add(arrowHelper);
}

// scene.add(arrows);

// function updateArrows() {
//   const vertices = points.geometry.getAttribute('position').array;
//   for (let i = 0; i < STARS_NUMBER; i++) {
//     const speedVector = new THREE.Vector3(speeds[3*i], speeds[3*i + 1], speeds[3*i + 2]);
//     const speed = speedVector.length();
//     arrows.children[i].setDirection(speedVector.normalize());
//     arrows.children[i].position.set(vertices[3*i], vertices[3*i + 1], vertices[3*i + 2]);
//     arrows.children[i].setLength(speed * 100 / INITIAL_SPEED);
//   }
// }

const geometryStars = new THREE.BufferGeometry();
geometryStars.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
const material = new THREE.PointsMaterial({ color: 0xffffff });
const points = new THREE.Points(geometryStars, material);

scene.add(points);

function updateStarPositions() {
  const positionAttribute = points.geometry.getAttribute('position');
  const newPositions = new THREE.Float32BufferAttribute(Array(STARS_NUMBER * 3), 3);
  for (let i = 0; i < STARS_NUMBER; i++) {
    const acceleration = new THREE.Vector3(0, 0, 0);
    const currStar = new THREE.Vector3(positionAttribute.getX(i), positionAttribute.getY(i), positionAttribute.getZ(i));
    for (let j = 0; j < STARS_NUMBER; j++) {
      if (i === j) continue;
      const star = new THREE.Vector3(positionAttribute.getX(j), positionAttribute.getY(j), positionAttribute.getZ(j));
      const distance = currStar.distanceTo(star);
      const direction = star.sub(currStar).normalize();
      acceleration.add(direction.divideScalar(distance**2 + SMOOTHING_LENGTH));
    }
    speeds[3*i] += acceleration.x * TIME_STEP;
    speeds[3*i + 1] += acceleration.y * TIME_STEP;
    speeds[3*i + 2] += acceleration.z * TIME_STEP;
    const speed = new THREE.Vector3(speeds[3*i], speeds[3*i + 1], speeds[3*i + 2]);
    currStar.add(speed.multiplyScalar(TIME_STEP));
    newPositions.setXYZ(i, currStar.x, currStar.y, currStar.z);
  }
  geometryStars.setAttribute('position', newPositions);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateStarPositions();
  // updateArrows();
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