import { useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  BoxGeometry,
  CapsuleGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  ACESFilmicToneMapping,
  Scene,
  Fog,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ACTIVE_STAFF, coreRoomForStaff, getRoomStaff, type CoreRoomId } from '../staff';
import type { OfficeJob } from '../workflowTypes';
import type { PrayerBreak } from '../lib/prayerSchedule';
import { officeActivityAt } from '../lib/officeSchedule';

const officeRooms: { roomId: CoreRoomId; name: string; color: string; x: number; z: number }[] = [
  { roomId: 'product_research', name: 'PRODUK & RISET', color: '#10b981', x: -7.5, z: -6.5 },
  { roomId: 'content_sales', name: 'KONTEN & PENJUALAN', color: '#f43f5e', x: 0, z: -6.5 },
  { roomId: 'client_service', name: 'LAYANAN KLIEN', color: '#0ea5e9', x: 7.5, z: -6.5 },
];

type StaffVisual = {
  root: Group;
  screen: Mesh;
  statusLight: Mesh;
  statusBubble: Sprite;
  chatBubble: Sprite;
  torso: Mesh;
  head: Group;
  eyes: Group[];
  mouth: Mesh;
  leftArm: Group;
  rightArm: Group;
  leftLeg: Group;
  rightLeg: Group;
  home: Vector3;
  path: Vector3[];
  goal: string;
  walking: boolean;
  active: boolean;
  failed: boolean;
  done: boolean;
  praying: boolean;
  delivering: boolean;
  officeActivity: 'WORK' | 'BREAK' | 'OFF';
  unknown: boolean;
  queued: number;
  interactionOffset: number;
  interactionDirection: number;
  chatLine: string;
};

function box(
  parent: Group,
  size: [number, number, number],
  position: [number, number, number],
  color: string,
  options: { roughness?: number; metalness?: number; transparent?: boolean; opacity?: number } = {},
): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(...size),
    new MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.82,
      metalness: options.metalness ?? 0,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1,
    }),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function label(text: string, position: [number, number, number], color = '#f8fafc'): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 144;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D tidak tersedia untuk label denah.');
  context.fillStyle = '#102b2b';
  context.beginPath();
  context.roundRect(8, 8, 752, 128, 22);
  context.fill();
  context.strokeStyle = '#a7e4c4';
  context.lineWidth = 5;
  context.stroke();
  context.fillStyle = color;
  context.font = 'bold 48px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 384, 74, 710);
  const texture = new CanvasTexture(canvas);
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.set(...position);
  sprite.scale.set(4.4, 0.84, 1);
  sprite.renderOrder = 5;
  return sprite;
}

function createDesk(parent: Group, x: number, z: number, active: boolean): Mesh {
  box(parent, [0.7, 0.12, 0.48], [x, 0.76, z], '#a66f4c');
  box(parent, [0.09, 0.72, 0.09], [x - 0.25, 0.36, z - 0.14], '#79543c');
  box(parent, [0.09, 0.72, 0.09], [x + 0.25, 0.36, z - 0.14], '#79543c');
  box(parent, [0.09, 0.72, 0.09], [x - 0.25, 0.36, z + 0.14], '#79543c');
  box(parent, [0.09, 0.72, 0.09], [x + 0.25, 0.36, z + 0.14], '#79543c');
  box(parent, [0.38, 0.31, 0.07], [x, 1.0, z - 0.12], '#203c49');
  return box(parent, [0.31, 0.22, 0.025], [x, 1.0, z - 0.075], active ? '#51dbc0' : '#557987', {
    metalness: 0.15,
    roughness: 0.35,
  });
}

function createStatusBubble(parent: Group): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 144;
  canvas.height = 112;
  const texture = new CanvasTexture(canvas);
  const bubble = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  bubble.position.set(0.38, 2.75, 0);
  bubble.scale.set(0.78, 0.58, 1);
  bubble.renderOrder = 8;
  parent.add(bubble);
  return bubble;
}

function updateStatusBubble(bubble: Sprite, status: string, color: string): void {
  if (bubble.userData.status === status) return;
  bubble.userData.status = status;
  const canvas = document.createElement('canvas');
  canvas.width = 144;
  canvas.height = 112;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D tidak tersedia untuk status staf.');
  context.fillStyle = '#fffdf5';
  context.beginPath();
  context.roundRect(10, 8, 124, 92, 26);
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 9;
  context.stroke();
  context.fillStyle = color;
  context.font = 'bold 68px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(status, 72, 53);
  const material = bubble.material as SpriteMaterial;
  material.map?.dispose();
  material.map = new CanvasTexture(canvas);
  material.needsUpdate = true;
}

function createChatBubble(parent: Group): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 144;
  const texture = new CanvasTexture(canvas);
  const bubble = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  bubble.position.set(-0.2, 3.05, 0.05);
  bubble.scale.set(1.48, 0.59, 1);
  bubble.renderOrder = 9;
  bubble.visible = false;
  parent.add(bubble);
  return bubble;
}

function updateChatBubble(bubble: Sprite, message: string, color: string): void {
  if (bubble.userData.message === message) return;
  bubble.userData.message = message;
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 144;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D tidak tersedia untuk dialog kantor.');
  context.fillStyle = '#fffdf5';
  context.beginPath();
  context.roundRect(12, 8, 336, 112, 28);
  context.fill();
  context.moveTo(68, 112);
  context.lineTo(48, 138);
  context.lineTo(104, 112);
  context.closePath();
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 8;
  context.stroke();
  context.fillStyle = '#254247';
  context.font = 'bold 35px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(message, 180, 64, 300);
  const material = bubble.material as SpriteMaterial;
  material.map?.dispose();
  material.map = new CanvasTexture(canvas);
  material.needsUpdate = true;
}

function createStaffVisual(world: Group, roomGroup: Group, person: typeof ACTIVE_STAFF[number], index: number, room: typeof officeRooms[number]): StaffVisual {
  const x = index === 0 ? -1.35 : 1.35;
  const z = -0.55;

  const workstation = new Group();
  workstation.position.set(x, 0, z);
  roomGroup.add(workstation);
  const screen = createDesk(workstation, 0, -0.22, false);
  box(workstation, [0.42, 0.12, 0.38], [0, 0.47, 0.58], '#53616a');
  box(workstation, [0.08, 0.4, 0.08], [0, 0.56, 0.66], '#364650');

  const root = new Group();
  root.position.set(room.x + x, 0, room.z + z + 0.98);
  root.userData.staffId = person.id;
  world.add(root);

  const clothing = new MeshStandardMaterial({
    color: new Color(person.division === 'paud' ? '#b6753e' : room.color),
    roughness: 0.72,
  });
  const shirtColors = ['#f3ead5', '#f4f0e5', '#dcefe5', '#f2dfd7', '#dce8f2'];
  const skinColors = ['#c98f70', '#9d6248', '#e0ad87', '#b97858', '#d49b79'];
  const hairColors = ['#302b2a', '#211f22', '#594336', '#332827', '#3d302b'];
  const trouserColors = ['#34445a', '#46505c', '#384c48', '#51434d', '#344451'];
  const shirt = new MeshStandardMaterial({ color: shirtColors[index % shirtColors.length], roughness: 0.85 });
  const skin = new MeshStandardMaterial({ color: skinColors[index % skinColors.length], roughness: 0.78 });
  const hairMaterial = new MeshStandardMaterial({ color: hairColors[index % hairColors.length], roughness: 0.92 });
  const trousers = new MeshStandardMaterial({ color: trouserColors[index % trouserColors.length], roughness: 0.8 });
  const shoes = new MeshStandardMaterial({ color: index % 2 ? '#3d3432' : '#27343b', roughness: 0.7 });

  const torso = new Mesh(new CapsuleGeometry(0.25, 0.58, 5, 12), clothing);
  torso.position.set(0, 1.22, 0);
  torso.castShadow = true;
  root.add(torso);
  const shirtFront = new Mesh(new CapsuleGeometry(0.105, 0.38, 4, 9), shirt);
  shirtFront.position.set(0, 1.25, -0.215);
  shirtFront.scale.set(0.82, 0.9, 0.34);
  root.add(shirtFront);
  const collarLeft = new Mesh(new ConeGeometry(0.075, 0.19, 4), shirt);
  collarLeft.position.set(-0.075, 1.55, -0.207);
  collarLeft.rotation.z = Math.PI / 3;
  root.add(collarLeft);
  const collarRight = new Mesh(new ConeGeometry(0.075, 0.19, 4), shirt);
  collarRight.position.set(0.075, 1.55, -0.207);
  collarRight.rotation.z = -Math.PI / 3;
  root.add(collarRight);
  const lanyard = new Mesh(
    new CylinderGeometry(0.012, 0.012, 0.36, 6),
    new MeshStandardMaterial({ color: index % 2 ? '#f6c85f' : '#d8eee4', roughness: 0.65 }),
  );
  lanyard.position.set(0, 1.37, -0.239);
  lanyard.rotation.z = Math.PI / 14;
  root.add(lanyard);
  const badge = new Mesh(
    new BoxGeometry(0.105, 0.13, 0.025),
    new MeshStandardMaterial({ color: '#fffaf0', roughness: 0.55 }),
  );
  badge.position.set(0.025, 1.19, -0.255);
  root.add(badge);

  const neck = new Mesh(new CylinderGeometry(0.085, 0.095, 0.2, 12), skin);
  neck.position.set(0, 1.77, 0);
  root.add(neck);
  const head = new Group();
  head.position.set(0, 2.02, 0);
  root.add(head);
  const face = new Mesh(new SphereGeometry(0.23, 18, 14), skin);
  face.castShadow = true;
  head.add(face);
  const hair = new Mesh(new SphereGeometry(0.235, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), hairMaterial);
  hair.position.set(0, 0.04, 0.015);
  hair.castShadow = true;
  head.add(hair);
  if (index % 3 !== 1) {
    const sideLock = new Mesh(new SphereGeometry(0.09, 10, 8), hairMaterial);
    sideLock.position.set(index % 2 ? 0.17 : -0.17, 0.005, -0.015);
    sideLock.scale.set(0.8, 1.45, 0.9);
    head.add(sideLock);
  } else {
    const bun = new Mesh(new SphereGeometry(0.105, 10, 8), hairMaterial);
    bun.position.set(0, 0.14, 0.17);
    head.add(bun);
  }
  for (const side of [-1, 1]) {
    const ear = new Mesh(new SphereGeometry(0.052, 8, 6), skin);
    ear.position.set(side * 0.22, -0.005, -0.005);
    ear.scale.set(0.68, 1.05, 0.74);
    head.add(ear);
  }
  const eyes = [-1, 1].map((side) => {
    const eye = new Group();
    eye.position.set(side * 0.075, 0.025, -0.198);
    const white = new Mesh(new SphereGeometry(0.035, 10, 8), new MeshStandardMaterial({ color: '#fffaf0', roughness: 0.48 }));
    eye.add(white);
    const pupil = new Mesh(new SphereGeometry(0.016, 8, 6), new MeshStandardMaterial({ color: '#27343b', roughness: 0.42 }));
    pupil.position.set(0, -0.002, -0.027);
    eye.add(pupil);
    const brow = new Mesh(new BoxGeometry(0.072, 0.014, 0.018), new MeshStandardMaterial({ color: '#302b2a', roughness: 0.9 }));
    brow.position.set(0, 0.056, -0.003);
    eye.add(brow);
    head.add(eye);
    return eye;
  });
  if (index % 4 === 2) {
    for (const side of [-1, 1]) {
      const frame = new Mesh(
        new TorusGeometry(0.047, 0.008, 5, 12),
        new MeshStandardMaterial({ color: '#344450', metalness: 0.15, roughness: 0.45 }),
      );
      frame.position.set(side * 0.075, 0.025, -0.222);
      head.add(frame);
    }
    const bridge = new Mesh(new BoxGeometry(0.055, 0.012, 0.012), new MeshStandardMaterial({ color: '#344450', roughness: 0.45 }));
    bridge.position.set(0, 0.025, -0.222);
    head.add(bridge);
  }
  const mouth = new Mesh(new SphereGeometry(0.035, 10, 8), new MeshStandardMaterial({ color: '#874d4a', roughness: 0.65 }));
  mouth.position.set(0, -0.083, -0.215);
  mouth.scale.set(1.5, 0.35, 0.35);
  head.add(mouth);

  const makeArm = (side: -1 | 1) => {
    const arm = new Group();
    arm.position.set(side * 0.25, 1.47, 0);
    const upper = new Mesh(new CapsuleGeometry(0.095, 0.28, 4, 9), clothing);
    upper.position.y = -0.19;
    upper.rotation.z = side * -0.12;
    upper.castShadow = true;
    arm.add(upper);
    const forearm = new Mesh(new CapsuleGeometry(0.072, 0.25, 4, 9), skin);
    forearm.position.set(side * 0.015, -0.54, -0.015);
    forearm.castShadow = true;
    arm.add(forearm);
    const hand = new Mesh(new SphereGeometry(0.075, 10, 8), skin);
    hand.position.set(side * 0.015, -0.75, -0.015);
    arm.add(hand);
    root.add(arm);
    return arm;
  };
  const makeLeg = (side: -1 | 1) => {
    const leg = new Group();
    leg.position.set(side * 0.13, 0.88, 0);
    const lower = new Mesh(new CapsuleGeometry(0.105, 0.48, 4, 10), trousers);
    lower.position.y = -0.34;
    lower.castShadow = true;
    leg.add(lower);
    const shoe = new Mesh(new CapsuleGeometry(0.09, 0.18, 3, 8), shoes);
    shoe.rotation.x = Math.PI / 2;
    shoe.position.set(0, -0.73, -0.045);
    shoe.castShadow = true;
    leg.add(shoe);
    root.add(leg);
    return leg;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  const statusLight = new Mesh(
    new SphereGeometry(0.09, 10, 8),
    new MeshStandardMaterial({ color: '#83928b', emissive: '#000000', roughness: 0.4 }),
  );
  statusLight.position.set(0.33, 1.48, -0.2);
  root.add(statusLight);
  const statusBubble = createStatusBubble(root);
  const chatBubble = createChatBubble(root);
  root.rotation.y = Math.PI;
  const home = root.position.clone();
  root.userData.baseY = root.position.y;
  return {
    root, screen, statusLight, statusBubble, chatBubble, torso, head, eyes, mouth, leftArm, rightArm, leftLeg, rightLeg,
    home, path: [], goal: 'desk', walking: false,
    active: false, failed: false, done: false, praying: false, delivering: false,
    officeActivity: 'OFF', unknown: true, queued: 0,
    interactionOffset: Math.floor(index / 2) * 2.5,
    interactionDirection: index % 2 === 0 ? -0.72 : 0.72,
    chatLine: index % 2 === 0 ? 'Ide baru!' : 'Coba kita cek!',
  };
}

function addRoom(parent: Group, room: typeof officeRooms[number], staffVisuals: Map<string, StaffVisual>) {
  const roomGroup = new Group();
  roomGroup.position.set(room.x, 0, room.z);
  parent.add(roomGroup);
  box(roomGroup, [6.2, 0.3, 5.4], [0, 0.15, 0], '#e7d8bd');
  box(roomGroup, [6.2, 2.2, 0.22], [0, 1.25, -2.68], '#c4b397');
  box(roomGroup, [0.22, 2.2, 5.4], [-3.08, 1.25, 0], '#b8a88f');
  box(roomGroup, [0.22, 2.2, 5.4], [3.08, 1.25, 0], '#b8a88f');
  box(roomGroup, [2.0, 0.12, 0.12], [0, 0.08, 2.65], '#667f78');
  box(roomGroup, [0.1, 1.15, 0.1], [-2.4, 0.82, -2.25], room.color);
  box(roomGroup, [0.1, 1.15, 0.1], [2.4, 0.82, -2.25], room.color);
  roomGroup.add(label(room.name, [0, 2.05, 0.05], room.color));

  getRoomStaff(room.roomId).forEach((person, index) => {
    staffVisuals.set(person.id, createStaffVisual(parent, roomGroup, person, index, room));
  });
}

function addPrayerRoom(parent: Group) {
  const building = new Group();
  building.position.set(-10.5, 0, 8.8);
  parent.add(building);
  box(building, [4.8, 0.36, 4.2], [0, 0.18, 0], '#d9c9a9');
  box(building, [4.5, 1.8, 3.9], [0, 1.08, 0], '#e6d9bb');
  box(building, [2.0, 2.0, 0.14], [0, 1.0, 1.98], '#426b5e');
  box(building, [5.0, 0.22, 4.4], [0, 2.03, 0], '#66866b');
  const dome = new Mesh(new SphereGeometry(0.95, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new MeshStandardMaterial({ color: '#479b78', roughness: 0.65 }));
  dome.position.set(0, 2.14, 0);
  building.add(dome);
  const minaret = new Mesh(new CylinderGeometry(0.16, 0.22, 2.7, 10), new MeshStandardMaterial({ color: '#e8d9bc', roughness: 0.72 }));
  minaret.position.set(1.8, 1.35, -1.35);
  building.add(minaret);
  const minaretTop = new Mesh(new ConeGeometry(0.28, 0.6, 10), new MeshStandardMaterial({ color: '#cba55d', roughness: 0.55 }));
  minaretTop.position.set(1.8, 2.95, -1.35);
  building.add(minaretTop);
  building.add(label('MUSHOLA', [0, 3.05, 0.2], '#d9f99d'));
}

function prayerPosition(index: number): Vector3 {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return new Vector3(-11.4 + column * 0.9, 0, 11.4 + row * 0.76);
}

function addPrayerMats(parent: Group): Group[] {
  return ACTIVE_STAFF.map((_, index) => {
    const position = prayerPosition(index);
    const mat = new Group();
    mat.position.set(position.x, 0, position.z);
    const border = new Mesh(
      new PlaneGeometry(0.58, 0.82),
      new MeshStandardMaterial({ color: '#bca878', roughness: 0.9, side: DoubleSide }),
    );
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0.045;
    mat.add(border);
    const center = new Mesh(
      new PlaneGeometry(0.48, 0.7),
      new MeshStandardMaterial({ color: '#438875', roughness: 0.88, side: DoubleSide }),
    );
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.05;
    mat.add(center);
    mat.visible = false;
    parent.add(mat);
    return mat;
  });
}

function addPool(parent: Group) {
  const pool = new Group();
  pool.position.set(5.2, 0, 8.8);
  parent.add(pool);
  box(pool, [6.6, 0.34, 4.4], [0, 0.17, 0], '#e8dcc5');
  box(pool, [5.8, 0.25, 3.6], [0, 0.36, 0], '#2f6d79');
  box(pool, [5.4, 0.12, 3.2], [0, 0.5, 0], '#3cb7c2', { metalness: 0.3, roughness: 0.18, transparent: true, opacity: 0.88 });
  box(pool, [5.8, 0.05, 0.16], [0, 0.58, -1.7], '#fbf4df');
  box(pool, [5.8, 0.05, 0.16], [0, 0.58, 1.7], '#fbf4df');
  box(pool, [0.16, 0.05, 3.2], [-2.82, 0.58, 0], '#fbf4df');
  box(pool, [0.16, 0.05, 3.2], [2.82, 0.58, 0], '#fbf4df');
  pool.add(label('KOLAM RENANG', [0, 1.35, 0], '#cffafe'));
}

function addKitchen(parent: Group) {
  const kitchen = new Group();
  kitchen.position.set(-2.5, 0, 8.8);
  parent.add(kitchen);
  box(kitchen, [6.0, 0.3, 3.8], [0, 0.15, 0], '#e8dcc5');
  box(kitchen, [6.0, 2.0, 0.18], [0, 1.1, -1.81], '#d7c6a9');
  box(kitchen, [0.18, 1.5, 3.7], [-2.9, 0.85, 0], '#b8a88f');
  box(kitchen, [0.18, 1.5, 3.7], [2.9, 0.85, 0], '#b8a88f');
  box(kitchen, [2.2, 0.78, 0.62], [-1.55, 0.65, -1.25], '#879b91');
  box(kitchen, [2.35, 0.12, 0.7], [-1.55, 1.1, -1.25], '#f4eee0');
  box(kitchen, [0.95, 1.55, 0.8], [2.05, 0.92, -1.2], '#eef2e8');
  box(kitchen, [0.7, 0.12, 0.7], [2.05, 0.98, -0.73], '#8fd0cc');
  box(kitchen, [1.65, 0.14, 0.95], [0, 0.9, 0.45], '#a66f4c');
  box(kitchen, [0.12, 0.7, 0.12], [-0.62, 0.43, 0.12], '#79543c');
  box(kitchen, [0.12, 0.7, 0.12], [0.62, 0.43, 0.12], '#79543c');
  box(kitchen, [0.12, 0.7, 0.12], [-0.62, 0.43, 0.78], '#79543c');
  box(kitchen, [0.12, 0.7, 0.12], [0.62, 0.43, 0.78], '#79543c');
  for (const x of [-0.4, 0.4]) {
    const mug = new Mesh(new CylinderGeometry(0.065, 0.055, 0.13, 10), new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.55 }));
    mug.position.set(x, 1.03, 0.45);
    kitchen.add(mug);
  }
  box(kitchen, [0.38, 0.06, 0.22], [0, 1.03, 0.72], '#d9ad67');
  for (const x of [-1.15, 1.15]) {
    box(kitchen, [0.52, 0.12, 0.52], [x, 0.48, 0.52], '#698578');
    box(kitchen, [0.12, 0.42, 0.12], [x, 0.23, 0.52], '#50665d');
  }
  kitchen.add(label('DAPUR & PANTRY', [0, 2.05, 0], '#fde68a'));
}

function addRestroom(parent: Group) {
  const restroom = new Group();
  restroom.position.set(11.6, 0, 8.8);
  parent.add(restroom);
  box(restroom, [3.8, 0.28, 3.4], [0, 0.14, 0], '#e8dcc5');
  box(restroom, [3.7, 1.8, 0.18], [0, 1.04, -1.61], '#d7c6a9');
  box(restroom, [0.18, 1.8, 3.2], [-1.76, 1.04, 0], '#c4b397');
  box(restroom, [0.18, 1.8, 3.2], [1.76, 1.04, 0], '#c4b397');
  box(restroom, [0.74, 1.55, 0.1], [-0.62, 0.91, -0.56], '#426b5e');
  box(restroom, [0.74, 1.55, 0.1], [0.62, 0.91, -0.56], '#426b5e');
  box(restroom, [0.88, 0.12, 0.14], [-0.62, 1.7, -0.56], '#e8dcc5');
  box(restroom, [0.88, 0.12, 0.14], [0.62, 1.7, -0.56], '#e8dcc5');
  for (const x of [-0.62, 0.62]) {
    const bowl = new Mesh(new SphereGeometry(0.24, 16, 10), new MeshStandardMaterial({ color: '#f5f4ed', roughness: 0.28 }));
    bowl.scale.set(1, 0.55, 1);
    bowl.position.set(x, 0.42, -1.03);
    restroom.add(bowl);
    box(restroom, [0.68, 0.08, 0.66], [x, 0.28, -1.03], '#f5f4ed');
  }
  box(restroom, [0.68, 0.58, 0.52], [1.15, 0.58, 0.88], '#f4eee0');
  box(restroom, [0.74, 0.68, 0.04], [1.15, 1.05, 0.52], '#8fd0cc', { metalness: 0.18, roughness: 0.22 });
  restroom.add(label('TOILET', [0, 2.0, 0], '#d9f99d'));
}

const restStops: { id: string; position: Vector3 }[] = [
  { id: 'mushola', position: new Vector3(-10.5, 0, 11.4) },
  { id: 'poolside', position: new Vector3(5.2, 0, 11.4) },
  { id: 'pantry', position: new Vector3(-2.5, 0, 11.2) },
  { id: 'toilet', position: new Vector3(11.6, 0, 11.1) },
  { id: 'garden', position: new Vector3(-12.5, 0, -9.5) },
];

function routeTo(visual: StaffVisual, destination: Vector3, goal: string, reducedMotion: boolean): void {
  if (visual.goal === goal) return;
  visual.goal = goal;
  const current = visual.root.position.clone();
  const waypoints = [
    new Vector3(current.x, 0, 0),
    new Vector3(destination.x, 0, 0),
    destination,
  ];
  visual.path = waypoints
    .filter((point, index, points) => index === 0
      ? visual.root.position.distanceTo(point) > 0.12
      : points[index - 1].distanceTo(point) > 0.12);
  visual.walking = visual.path.length > 0;
  if (reducedMotion) {
    visual.root.position.copy(destination);
    visual.path = [];
    visual.walking = false;
  }
}

function createGrassTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#7bb472';
    ctx.fillRect(0, 0, 256, 256);
    for (let x = 16; x < 256; x += 32) {
      for (let y = 16; y < 256; y += 32) {
        ctx.fillStyle = (x + y) % 64 === 0 ? '#8bc47e' : '#71a968';
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = 1000; // RepeatWrapping
  texture.repeat.set(12, 11);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function createOfficeWorld(canvas: HTMLCanvasElement, onSelect: (staffId: string) => void, onExecutiveClick: () => void) {
  const scene = new Scene();
  scene.background = new Color('#c6e4dd');
  scene.fog = new Fog('#c6e4dd', 40, 85);
  const camera = new PerspectiveCamera(38, 1, 0.1, 120);
  camera.position.set(17, 16, 20);
  camera.lookAt(0, 0.5, 0);
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  scene.add(new AmbientLight('#ffffff', 1.75));
  const sunlight = new DirectionalLight('#fff4df', 3.0);
  sunlight.position.set(-15, 28, 12);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  sunlight.shadow.camera.left = -22;
  sunlight.shadow.camera.right = 22;
  sunlight.shadow.camera.top = 20;
  sunlight.shadow.camera.bottom = -20;
  scene.add(sunlight);

  const world = new Group();
  scene.add(world);
  const grassTexture = createGrassTexture();
  grassTexture.repeat.set(10, 9);
  const ground = new Mesh(new PlaneGeometry(34, 30), new MeshStandardMaterial({ map: grassTexture, roughness: 0.96 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);
  box(world, [23, 0.06, 1.25], [0, 0.05, -2.5], '#c5b99f');
  box(world, [1.25, 0.07, 9], [0, 0.055, 2.0], '#c5b99f');
  box(world, [25, 0.06, 1.25], [0, 0.05, 6.2], '#c5b99f');
  const staffVisuals = new Map<string, StaffVisual>();
  officeRooms.forEach((room) => addRoom(world, room, staffVisuals));
  addKitchen(world);
  addRestroom(world);

  const executive = new Group();
  executive.position.set(0, 0, 1.6);
  executive.userData.executiveRoom = true;
  world.add(executive);
  box(executive, [6.4, 0.34, 3.8], [0, 0.17, 0], '#d7c6a9');
  box(executive, [6.4, 2.2, 0.22], [0, 1.25, -1.8], '#a79780');
  box(executive, [0.22, 2.2, 3.6], [-3.1, 1.25, 0], '#b5a48c');
  box(executive, [0.22, 2.2, 3.6], [3.1, 1.25, 0], '#b5a48c');
  executive.add(label('RUANG PIMPINAN', [0, 2.3, -0.4], '#fde68a'));
  box(executive, [1.8, 0.18, 0.9], [0, 0.86, 0.2], '#8c5c3c');
  box(executive, [1.2, 0.08, 0.08], [0, 1.0, 0.0], '#e8f4e9');

  addPrayerRoom(world);
  const prayerMats = addPrayerMats(world);
  addPool(world);

  for (const [x, z] of [[-13.5, -10.5], [-13.5, 11.5], [13.5, -10.5], [13.5, 11.5]] as const) {
    const tree = new Mesh(new CylinderGeometry(0.15, 0.22, 1.3, 7), new MeshStandardMaterial({ color: '#79583e' }));
    tree.position.set(x, 0.65, z);
    tree.castShadow = true;
    world.add(tree);
    const leaves = new Mesh(new SphereGeometry(0.95, 10, 8), new MeshStandardMaterial({ color: '#3e8654', roughness: 1 }));
    leaves.position.set(x, 1.65, z);
    leaves.castShadow = true;
    world.add(leaves);
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.6, 0.5);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 12;
  controls.maxDistance = 42;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minPolarAngle = Math.PI * 0.16;
  controls.update();

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let pointerStart: { x: number; y: number } | null = null;
  const pointerDown = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY }; };
  const pointerUp = (event: PointerEvent) => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...staffVisuals.values()].map((visual) => visual.root).concat(executive), true)[0];
    let target = hit?.object ?? null;
    while (target && typeof target.userData.staffId !== 'string' && target.userData.executiveRoom !== true) {
      const parent = target.parent;
      if (!parent) break;
      target = parent;
    }
    if (target && typeof target.userData.staffId === 'string') onSelect(target.userData.staffId);
    else if (target?.userData.executiveRoom === true) onExecutiveClick();
  };
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerup', pointerUp);

  const resizeObserver = new ResizeObserver(() => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
  });
  resizeObserver.observe(canvas);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.enableDamping = !reducedMotion;
  const render = () => renderer.render(scene, camera);
  if (reducedMotion) controls.addEventListener('change', render);
  const startedAt = performance.now();
  let previousFrameAt = startedAt;
  let frame = 0;
  if (!reducedMotion) {
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = performance.now();
      const time = (now - startedAt) / 1000;
      const delta = Math.min((now - previousFrameAt) / 1000, 0.05);
      previousFrameAt = now;
      for (const visual of staffVisuals.values()) {
        let distance = 2.2 * delta;
        while (distance > 0 && visual.path.length > 0) {
          const waypoint = visual.path[0];
          const remaining = visual.root.position.distanceTo(waypoint);
          if (remaining <= distance) {
            visual.root.position.copy(waypoint);
            visual.path.shift();
            distance -= remaining;
          } else {
            visual.root.position.lerp(waypoint, distance / remaining);
            distance = 0;
          }
        }
        visual.walking = visual.path.length > 0;
        visual.root.position.y = visual.walking ? Math.abs(Math.sin(time * 9)) * 0.07 : visual.praying ? Math.sin(time * 1.3) * 0.008 : visual.active ? Math.sin(time * 6) * 0.025 : Math.sin(time * 1.6) * 0.009;
        const interactionTime = (time + visual.interactionOffset) % 11;
        const chatting = !visual.walking && !visual.praying && !visual.active && !visual.unknown &&
          interactionTime > 1.2 && interactionTime < 5.4;
        const presenting = !visual.walking && !visual.praying && visual.active &&
          (time + visual.interactionOffset) % 13 < 2.2;
        const talking = chatting || presenting;
        const blinkTime = (time + visual.interactionOffset * 1.7) % 4.8;
        for (const eye of visual.eyes) eye.scale.y = blinkTime < 0.13 ? 0.12 : 1;
        visual.root.rotation.y = Math.PI + (chatting ? visual.interactionDirection : presenting ? -0.22 : 0);
        visual.head.rotation.y = visual.walking
          ? 0
          : chatting ? (interactionTime < 3.3 ? 0.46 : -0.46) + Math.sin(time * 2.5) * 0.06
            : Math.sin(time * (visual.active ? 2.4 : 0.8)) * (visual.active ? 0.12 : 0.18);
        visual.head.rotation.z = Math.sin(time * 1.7 + visual.interactionOffset) * (chatting ? 0.08 : 0.035);
        visual.mouth.scale.y = talking ? 0.8 + Math.abs(Math.sin(time * 9)) * 1.1 : 0.35;
        visual.chatBubble.visible = talking;
        if (talking) updateChatBubble(visual.chatBubble, presenting ? 'Cek hasil!' : visual.chatLine, visual.active ? '#26a879' : '#cb75b5');
        if (visual.walking) {
          visual.leftArm.rotation.x = Math.sin(time * 8) * 0.46;
          visual.rightArm.rotation.x = -Math.sin(time * 8) * 0.46;
          visual.leftArm.rotation.z = 0;
          visual.rightArm.rotation.z = 0;
          visual.leftLeg.rotation.x = -Math.sin(time * 8) * 0.55;
          visual.rightLeg.rotation.x = Math.sin(time * 8) * 0.55;
          visual.torso.rotation.x = 0.04;
        } else if (visual.active && !visual.praying) {
          const gesture = presenting ? Math.sin(time * 5) : 0;
          visual.leftArm.rotation.x = presenting ? -0.12 : Math.sin(time * 11) * 0.3;
          visual.rightArm.rotation.x = presenting ? -0.16 : Math.cos(time * 11) * 0.3;
          visual.leftArm.rotation.z = presenting ? 0.55 + gesture * 0.18 : Math.sin(time * 7) * 0.035;
          visual.rightArm.rotation.z = presenting ? -0.72 - gesture * 0.2 : Math.cos(time * 8) * 0.04;
          visual.leftLeg.rotation.x = 0;
          visual.rightLeg.rotation.x = 0;
          visual.torso.rotation.x = presenting ? -0.09 : Math.sin(time * 3) * 0.025;
        } else if (chatting) {
          const gesture = Math.sin(time * 5.5 + visual.interactionOffset);
          visual.leftArm.rotation.x = -0.12 + gesture * 0.08;
          visual.rightArm.rotation.x = -0.16 - gesture * 0.08;
          visual.leftArm.rotation.z = 0.32 + Math.max(0, gesture) * 0.34;
          visual.rightArm.rotation.z = -0.36 - Math.max(0, -gesture) * 0.38;
          visual.leftLeg.rotation.x = 0;
          visual.rightLeg.rotation.x = 0;
          visual.torso.rotation.x = -0.035;
        } else {
          const idle = Math.sin(time * 1.8 + visual.interactionOffset);
          const gesture = Math.sin(time * 2.1 + visual.interactionOffset);
          visual.leftArm.rotation.x = -0.04 + idle * 0.035;
          visual.rightArm.rotation.x = 0.02 + idle * 0.04;
          visual.leftArm.rotation.z = 0.08 + Math.max(0, gesture) * 0.16;
          visual.rightArm.rotation.z = -0.08 - Math.max(0, -gesture) * 0.17;
          visual.leftLeg.rotation.x = 0;
          visual.rightLeg.rotation.x = 0;
          visual.torso.rotation.x = Math.sin(time * 1.5 + visual.interactionOffset) * 0.018;
        }
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  } else {
    render();
  }

  return {
    focusRoom(roomId: CoreRoomId) {
      const room = officeRooms.find((item) => item.roomId === roomId);
      if (!room) return;
      const nextTarget = new Vector3(room.x, 0.7, room.z);
      const offset = nextTarget.clone().sub(controls.target);
      controls.target.copy(nextTarget);
      camera.position.add(offset);
      controls.update();
      render();
    },
    update(jobs: OfficeJob[] | null, selectedStaffId: string, prayerBreak: PrayerBreak | null, reportDeliveryStaffIds: string[], now: Date) {
      prayerMats.forEach((mat) => { mat.visible = prayerBreak !== null; });
      for (const [staffIndex, [staffId, visual]] of [...staffVisuals.entries()].entries()) {
        const assigned = jobs?.filter((job) => job.staffId === staffId) ?? [];
        visual.officeActivity = officeActivityAt(now, staffIndex);
        visual.praying = prayerBreak !== null;
        visual.unknown = jobs === null;
        visual.active = assigned.some((job) => job.status === 'RUNNING');
        visual.queued = assigned.filter((job) => job.status === 'QUEUED').length;
        const lastFinished = assigned.filter((job) => job.status === 'DONE' || job.status === 'FAILED')
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        visual.failed = !visual.active && visual.queued === 0 && lastFinished?.status === 'FAILED';
        visual.done = !visual.active && visual.queued === 0 && lastFinished?.status === 'DONE';
        visual.delivering = !visual.praying && !visual.active && visual.queued === 0 && reportDeliveryStaffIds.includes(staffId);
        const stateColor = visual.praying ? '#8b69c7' : visual.delivering ? '#3e9bc1' : visual.active ? '#26c281' : visual.failed ? '#e15a52' : visual.queued > 0 ? '#e8ac45' : visual.done ? '#3d9b6c' : jobs ? '#81928b' : '#76818a';
        const statusMaterial = visual.statusLight.material as MeshStandardMaterial;
        statusMaterial.color.set(stateColor);
        statusMaterial.emissive.set(visual.active ? '#0c633f' : '#000000');
        statusMaterial.emissiveIntensity = visual.active ? 0.8 : 0;
        const screenMaterial = visual.screen.material as MeshStandardMaterial;
        screenMaterial.color.set(visual.active ? '#51dbc0' : '#557987');
        screenMaterial.emissive.set(visual.active ? '#125947' : '#000000');
        const bubbleStatus = visual.praying ? '🕌' : visual.delivering ? '📄' : visual.unknown ? '?' : visual.active ? '⌨' : visual.failed ? '!' : visual.queued > 0 ? '…' : visual.done ? '✓' : visual.officeActivity === 'OFF' ? '🌙' : '☕';
        updateStatusBubble(visual.statusBubble, bubbleStatus, stateColor);
        visual.statusBubble.visible = true;
        if (prayerBreak) {
          const index = ACTIVE_STAFF.findIndex((person) => person.id === staffId);
          routeTo(visual, prayerPosition(index < 0 ? 0 : index), 'prayer', reducedMotion);
        } else if (visual.delivering) {
          const personIndex = ACTIVE_STAFF.findIndex((person) => person.id === staffId);
          routeTo(visual, new Vector3(((personIndex % 3) - 1) * 0.75, 0, 4.1), 'deliver-report', reducedMotion);
        } else {
          if (visual.active || visual.queued > 0 || visual.failed || visual.officeActivity === 'WORK') {
            routeTo(visual, visual.home, 'desk', reducedMotion);
          } else {
            const rest = restStops[staffIndex % restStops.length];
            const personIndex = staffIndex;
            const offset = new Vector3(((personIndex % 3) - 1) * 0.42, 0, (Math.floor(personIndex / 3) % 3 - 1) * 0.32);
            const activity = visual.officeActivity === 'OFF' ? 'off' : 'break';
            routeTo(visual, rest.position.clone().add(offset), `${activity}:${rest.id}`, reducedMotion);
          }
        }
        visual.root.scale.setScalar(staffId === selectedStaffId ? 1.12 : 1);
      }
      if (reducedMotion) renderer.render(scene, camera);
      if (reducedMotion) render();
    },
    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointerup', pointerUp);
      scene.traverse((object) => {
        if (object instanceof Mesh || object instanceof Sprite) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if ('map' in material && material.map) material.map.dispose();
            material.dispose();
          }
        }
      });
      renderer.dispose();
    },
  };
}

export function OfficeWorld3D({ jobs, selectedStaffId, prayerBreak, reportDeliveryStaffIds, now, onSelectStaff, onExecutiveClick }: {
  jobs: OfficeJob[] | null;
  selectedStaffId: string;
  prayerBreak: PrayerBreak | null;
  reportDeliveryStaffIds: string[];
  now: Date;
  onSelectStaff: (staffId: string) => void;
  onExecutiveClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<ReturnType<typeof createOfficeWorld> | null>(null);
  const onSelectRef = useRef(onSelectStaff);
  const onExecutiveClickRef = useRef(onExecutiveClick);
  const previousSelectionRef = useRef(selectedStaffId);
  const [unavailable, setUnavailable] = useState('');
  onSelectRef.current = onSelectStaff;
  onExecutiveClickRef.current = onExecutiveClick;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      worldRef.current = createOfficeWorld(canvas, (staffId) => onSelectRef.current(staffId), () => onExecutiveClickRef.current());
    } catch (error) {
      setUnavailable(error instanceof Error ? `3D tidak dapat dimuat: ${error.message}` : '3D tidak dapat dimuat di browser ini.');
      return;
    }
    return () => {
      worldRef.current?.dispose();
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    worldRef.current?.update(jobs, selectedStaffId, prayerBreak, reportDeliveryStaffIds, now);
  }, [jobs, selectedStaffId, prayerBreak, reportDeliveryStaffIds, now]);

  useEffect(() => {
    if (previousSelectionRef.current === selectedStaffId) return;
    previousSelectionRef.current = selectedStaffId;
    worldRef.current?.focusRoom(coreRoomForStaff(selectedStaffId));
  }, [selectedStaffId]);

  return <div className="office-3d-scene">
    <canvas ref={canvasRef} className="office-3d-canvas" aria-label="Kantor 3D interaktif. Seret untuk memutar, gulir untuk memperbesar, atau pilih staf." />
    <div className="office-3d-help">Seret untuk memutar · Gulir untuk zoom · Klik staf untuk melihat tugas · klik Ruang Pimpinan untuk ringkasan</div>
    <div className="office-3d-legend" aria-hidden="true">
      <span><i className="office-legend-dot office-legend-active" />⌨ Bekerja</span>
      <span><i className="office-legend-dot office-legend-queued" />… Antre</span>
      <span><i className="office-legend-dot office-legend-idle" />☕ Istirahat</span>
      <span><i className="office-legend-dot office-legend-active" />✓ Selesai</span>
      <span><i className="office-legend-dot office-legend-failed" />! Gagal</span>
      <span><i className="office-legend-dot office-legend-delivering" />📄 Antar laporan (simulasi)</span>
    </div>
    {unavailable && <p role="alert" className="office-3d-error">{unavailable}</p>}
  </div>;
}
