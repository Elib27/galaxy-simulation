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

let IS_SIMULATION_RUNNING = false;

// GUI
var parameters = {
  initialSpeed: 5,
  starsNumber: 1000,
  timeStep: 1,
  pauseResume: () => IS_SIMULATION_RUNNING = !IS_SIMULATION_RUNNING,
  reset: () => initialiseSimulation(),
};

var gui = new dat.GUI();

var cam = gui.addFolder('simulation');
cam.add(parameters, 'initialSpeed', 0, 50).name('initial speed').listen().onChange(() => initialiseSimulation());
cam.add(parameters, 'starsNumber', 100, 10000).step(10).name('stars number').listen().onChange(() => initialiseSimulation());
cam.add(parameters, 'timeStep', 0.1, 10).step(0.1).name('time step').listen();
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

// function updateStarPositions() {
//   const positionAttribute = points.geometry.getAttribute('position');
//   const newPositions = new THREE.Float32BufferAttribute(Array(parameters.starsNumber * 3), 3);
//   for (let i = 0; i < parameters.starsNumber; i++) {
//     const acceleration = new THREE.Vector3(0, 0, 0);
//     const currStar = new THREE.Vector3(positionAttribute.getX(i), positionAttribute.getY(i), positionAttribute.getZ(i));
//     for (let j = 0; j < parameters.starsNumber; j++) {
//       if (i === j) continue;
//       const star = new THREE.Vector3(positionAttribute.getX(j), positionAttribute.getY(j), positionAttribute.getZ(j));
//       const distance = currStar.distanceTo(star);
//       const direction = star.sub(currStar).normalize();
//       acceleration.add(direction.divideScalar(distance**2 + SMOOTHING_LENGTH));
//     }
//     starSpeeds[3*i] += acceleration.x * parameters.timeStep;
//     starSpeeds[3*i + 1] += acceleration.y * parameters.timeStep;
//     starSpeeds[3*i + 2] += acceleration.z * parameters.timeStep;
//     const speed = new THREE.Vector3(starSpeeds[3*i], starSpeeds[3*i + 1], starSpeeds[3*i + 2]);
//     currStar.add(speed.multiplyScalar(parameters.timeStep));
//     newPositions.setXYZ(i, currStar.x, currStar.y, currStar.z);
//   }
//   geometryStars.setAttribute('position', newPositions);
// }

// Octree and Barnes-Hut algorithm

const MIN_OCT_SIZE = 0.01;
const THETA = 2;

type Bounds = { x: number, y: number, z: number, s: number}

class node {
  centerOfMass: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  mass: number = 0;
  star: THREE.Vector3 | null = null;
  bounds: Bounds;
  children: node[] = [];

  constructor (bounds: Bounds) {
    this.bounds = bounds;
  }

  subdivide() {
    const x = this.bounds.x;
    const y = this.bounds.y;
    const z = this.bounds.z;
    const s = this.bounds.s / 2;

    this.children.push(new node({ x: x, y: y, z: z, s: s }));
    this.children.push(new node({ x: x + s, y: y, z: z, s: s}));
    this.children.push(new node({ x: x, y: y + s, z: z, s: s}));
    this.children.push(new node({ x: x + s, y: y + s, z: z, s: s}));
    this.children.push(new node({ x: x, y: y, z: z + s, s: s }));
    this.children.push(new node({ x: x + s, y: y, z: z + s, s: s}));
    this.children.push(new node({ x: x, y: y + s, z: z + s, s: s}));
    this.children.push(new node({ x: x + s, y: y + s, z: z + s, s: s}));
  }

  isStarInBounds(star: THREE.Vector3) {
    return star.x >= this.bounds.x && star.x < this.bounds.x + this.bounds.s
      && star.y >= this.bounds.y && star.y < this.bounds.y + this.bounds.s
      && star.z >= this.bounds.z && star.z < this.bounds.z + this.bounds.s;
  }

  insertStar(star: THREE.Vector3) {
    if (!this.isStarInBounds(star)) return;
    else if (this.bounds.s > MIN_OCT_SIZE) {
      if (this.star === null) {
        if (this.children.length === 0) this.star = star;
        else {
          for (let i = 0; i < this.children.length; i++) {
            this.children[i].insertStar(star);
          }
        }
      }
      else { // déjà une étoile dans le noeud
        this.subdivide();
        for (let i = 0; i < this.children.length; i++) {
          this.children[i].insertStar(this.star);
          this.children[i].insertStar(star);
        }
        this.star = null;
      }
    }
    else {
      // On met plusieurs étoiles dans le même noeud
      console.log('limite de taille atteinte')
    }
  }
  
  calculateCenterOfMass() { // à optimiser, on peut calculer le centre de masse en même temps qu'on insère les étoiles
    if (this.star !== null && this.children.length === 0) {
      this.centerOfMass = this.star;
      this.mass = 1;
    }
    else if (this.children.length > 0) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].calculateCenterOfMass();
        this.centerOfMass.add(this.children[i].centerOfMass.clone().multiplyScalar(this.children[i].mass));
        this.mass += this.children[i].mass;
      }
      this.centerOfMass.divideScalar(this.mass);
    }
  }

  calculateAcceleration(star: THREE.Vector3) {
    if (star.equals(this.centerOfMass)) return new THREE.Vector3(0, 0, 0);
    const d = star.distanceTo(this.centerOfMass);
    const s = this.bounds.s;
    const acceleration = new THREE.Vector3(0, 0, 0);
    if ((s / d) < THETA) {
      const direction = this.centerOfMass.clone().sub(star).normalize();
      acceleration.add(direction.multiplyScalar(this.mass / (d**2 + SMOOTHING_LENGTH)));
    }
    else {
      for (let i = 0; i < this.children.length; i++) {
        acceleration.add(this.children[i].calculateAcceleration(star));
      }
    }
    return acceleration;
  }
}

/*
Quand on insère une étoile :
- si elle n'est pas dans les limites du noeud, on ne fait rien
- si elle est dans les limites du noeud, qu'il ne contient pas d'étoile, et qu'il ne possède pas d'enfants, on l'insère dans le noeud
- si elle est dans les limites du noeud, qu'il ne contient pas d'étoile, et qu'il possède des enfants, on l'insère dans chaque noeud enfant
- si elle est dans les limites du noeud et qu'il contient une étoile, on subdivise le noeud et on insère les deux étoiles dans chaque enfant
- ajouter cas où on met plusieurs étoiles dans le même noeud quand la limite est atteinte
*/

const OCTREE_BOUNDS_SIZE = 5000;

function createOctree(positionAttribute: THREE.BufferAttribute) {
  const initialBounds = { x: -OCTREE_BOUNDS_SIZE / 2, y: -OCTREE_BOUNDS_SIZE / 2, z: -OCTREE_BOUNDS_SIZE / 2, s: OCTREE_BOUNDS_SIZE };
  const root = new node(initialBounds);
  for (let i = 0; i < parameters.starsNumber; i++) {
    const star = new THREE.Vector3(positionAttribute.getX(i), positionAttribute.getY(i), positionAttribute.getZ(i))
    root.insertStar(star);
  }
  return root;
}

function updateStarPositions() {
  const positionAttribute = points.geometry.getAttribute('position');
  const galaxyOctree = createOctree(positionAttribute as THREE.BufferAttribute);
  galaxyOctree.calculateCenterOfMass();
  const newPositions = new THREE.Float32BufferAttribute(Array(parameters.starsNumber * 3), 3);
  for (let i = 0; i < parameters.starsNumber; i++) {
    const currStar = new THREE.Vector3(positionAttribute.getX(i), positionAttribute.getY(i), positionAttribute.getZ(i));
    const acceleration = galaxyOctree.calculateAcceleration(currStar);
    starSpeeds[3*i] += acceleration.x * parameters.timeStep;
    starSpeeds[3*i + 1] += acceleration.y * parameters.timeStep;
    starSpeeds[3*i + 2] += acceleration.z * parameters.timeStep;
    const speed = new THREE.Vector3(starSpeeds[3*i], starSpeeds[3*i + 1], starSpeeds[3*i + 2]);
    currStar.add(speed.multiplyScalar(parameters.timeStep));
    newPositions.setXYZ(i, currStar.x, currStar.y, currStar.z);
  }
  geometryStars.setAttribute('position', newPositions);
}

// function showCenterOfMass(n: number, node: node) {
//   if (node.centerOfMass.length() === 0) return;
//   if (n == 1) {
//     const geometry = new THREE.SphereGeometry( 5, 32, 32 );
//     const material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
//     const sphere = new THREE.Mesh( geometry, material );
//     sphere.position.set(node.centerOfMass.x, node.centerOfMass.y, node.centerOfMass.z);
//     scene.add( sphere );
//     return;
//   }
//   if (node.children.length === 0) return;
//   for (let i = 0; i < galaxyOctree.children.length; i++) {
//     showCenterOfMass(n - 1, node.children[i]);
//   }
// }

// showCenterOfMass(8, galaxyOctree);


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