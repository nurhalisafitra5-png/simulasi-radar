/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { createRadarDialTexture, createTextSprite } from '../proceduralTextures.ts';
import { CalculatedAngles } from '../../types/maritime.ts';

export class AngleVisualization {
  public group: THREE.Group;

  // 1. Ray Lines
  private lineOA: THREE.Line;
  private lineOB: THREE.Line;
  private linePA: THREE.Line;
  private linePB: THREE.Line;

  // 2. Animated Pulse Particles along rays
  private pulseMeshOA: THREE.InstancedMesh;
  private pulseMeshOB: THREE.InstancedMesh;
  private pulseMeshPA: THREE.InstancedMesh;
  private pulseMeshPB: THREE.InstancedMesh;

  // 3. Intercepted Arc AB
  private arcABMesh: THREE.Line;
  private arcABGeometry: THREE.BufferGeometry;

  // 4. Center Angle Arc (∠AOB) & Ship Angle Arc (∠APB)
  private angleArcO: THREE.Line;
  private angleArcOGeometry: THREE.BufferGeometry;
  private angleArcP: THREE.Line;
  private angleArcPGeometry: THREE.BufferGeometry;

  // 5. Degree Badge Sprites
  private badgeAOB: THREE.Sprite;
  private badgeAPB: THREE.Sprite;

  // 6. Tactical Dial Plane
  private dialMesh: THREE.Mesh;

  private radius: number = 14;

  constructor(radius: number = 14, maxAnisotropy: number = 4) {
    this.radius = radius;
    this.group = new THREE.Group();
    this.group.name = 'AngleVisualization';

    // Tactical Radar Dial Floor Plane
    const dialGeom = new THREE.PlaneGeometry(radius * 2.3, radius * 2.3);
    dialGeom.rotateX(-Math.PI / 2);
    const dialMat = new THREE.MeshBasicMaterial({
      map: createRadarDialTexture(maxAnisotropy),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.dialMesh = new THREE.Mesh(dialGeom, dialMat);
    this.dialMesh.position.y = 0.06;
    this.group.add(this.dialMesh);

    // Common Line Material for OA & OB (Warm Amber / Orange)
    const lineMatCentral = new THREE.LineBasicMaterial({
      color: 0xf97316,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
    });

    const geomOA = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const geomOB = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.lineOA = new THREE.Line(geomOA, lineMatCentral);
    this.lineOB = new THREE.Line(geomOB, lineMatCentral);
    this.group.add(this.lineOA, this.lineOB);

    // Common Line Material for PA & PB (Cyan / Teal)
    const lineMatInscribed = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
    });

    const geomPA = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const geomPB = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.linePA = new THREE.Line(geomPA, lineMatInscribed);
    this.linePB = new THREE.Line(geomPB, lineMatInscribed);
    this.group.add(this.linePA, this.linePB);

    // Laser Pulse Particles (Instanced Mesh for high performance)
    const particleGeom = new THREE.SphereGeometry(0.18, 8, 8);
    const particleMatAmber = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const particleMatCyan = new THREE.MeshBasicMaterial({ color: 0xa5f3fc });

    this.pulseMeshOA = new THREE.InstancedMesh(particleGeom, particleMatAmber, 4);
    this.pulseMeshOB = new THREE.InstancedMesh(particleGeom, particleMatAmber, 4);
    this.pulseMeshPA = new THREE.InstancedMesh(particleGeom, particleMatCyan, 4);
    this.pulseMeshPB = new THREE.InstancedMesh(particleGeom, particleMatCyan, 4);

    this.group.add(this.pulseMeshOA, this.pulseMeshOB, this.pulseMeshPA, this.pulseMeshPB);

    // Intercepted Arc AB Mesh (Glowing Emerald / Cyan)
    this.arcABGeometry = new THREE.BufferGeometry();
    const arcABMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      linewidth: 6,
      transparent: true,
      opacity: 0.95,
    });
    this.arcABMesh = new THREE.Line(this.arcABGeometry, arcABMat);
    this.group.add(this.arcABMesh);

    // Angle Arcs
    this.angleArcOGeometry = new THREE.BufferGeometry();
    const arcMatO = new THREE.LineBasicMaterial({ color: 0xf97316, linewidth: 4 });
    this.angleArcO = new THREE.Line(this.angleArcOGeometry, arcMatO);

    this.angleArcPGeometry = new THREE.BufferGeometry();
    const arcMatP = new THREE.LineBasicMaterial({ color: 0x22d3ee, linewidth: 4 });
    this.angleArcP = new THREE.Line(this.angleArcPGeometry, arcMatP);

    this.group.add(this.angleArcO, this.angleArcP);

    // Degree Badges
    this.badgeAOB = createTextSprite('∠AOB = 80.0°', 'rgba(249, 115, 22, 0.9)', '#FFFFFF');
    this.badgeAPB = createTextSprite('∠APB = 40.0°', 'rgba(6, 182, 212, 0.9)', '#FFFFFF');
    this.group.add(this.badgeAOB, this.badgeAPB);
  }

  /**
   * Updates lines, arcs, and degree badges based on current angles
   */
  public updateGeometry(
    posO: THREE.Vector3,
    posA: THREE.Vector3,
    posB: THREE.Vector3,
    posP: THREE.Vector3,
    angleA: number,
    angleB: number,
    angleP: number,
    angles: CalculatedAngles,
    time: number,
    pulseSpeed: number = 1.0
  ) {
    // 1. Update OA and OB Line Endpoints
    const elevate = 0.5; // elevate rays slightly above water surface
    const pO = posO.clone().setY(posO.y + elevate);
    const pA = posA.clone().setY(posA.y + elevate);
    const pB = posB.clone().setY(posB.y + elevate);
    const pP = posP.clone().setY(posP.y + elevate);

    this.lineOA.geometry.setFromPoints([pO, pA]);
    this.lineOB.geometry.setFromPoints([pO, pB]);
    this.linePA.geometry.setFromPoints([pP, pA]);
    this.linePB.geometry.setFromPoints([pP, pB]);

    // 2. Animate Pulses along rays
    this.updatePulseMesh(this.pulseMeshOA, pO, pA, time * pulseSpeed, 0);
    this.updatePulseMesh(this.pulseMeshOB, pO, pB, time * pulseSpeed, 0.25);
    this.updatePulseMesh(this.pulseMeshPA, pP, pA, time * pulseSpeed, 0.5);
    this.updatePulseMesh(this.pulseMeshPB, pP, pB, time * pulseSpeed, 0.75);

    // 3. Update Intercepted Arc AB
    let a1 = angleA % (Math.PI * 2);
    let a2 = angleB % (Math.PI * 2);
    if (a1 < 0) a1 += Math.PI * 2;
    if (a2 < 0) a2 += Math.PI * 2;

    let diff = a2 - a1;
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;

    const arcPoints: THREE.Vector3[] = [];
    const segments = 48;
    for (let i = 0; i <= segments; i++) {
      const theta = a1 + (diff * i) / segments;
      arcPoints.push(new THREE.Vector3(this.radius * Math.cos(theta), elevate + 0.1, this.radius * Math.sin(theta)));
    }
    this.arcABGeometry.setFromPoints(arcPoints);

    // 4. Update Central Angle Arc ∠AOB
    const arcRadiusO = 3.6;
    const arcPointsO: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const theta = a1 + (diff * i) / 32;
      arcPointsO.push(new THREE.Vector3(posO.x + arcRadiusO * Math.cos(theta), elevate + 0.2, posO.z + arcRadiusO * Math.sin(theta)));
    }
    this.angleArcOGeometry.setFromPoints(arcPointsO);

    // Position ∠AOB Badge at midpoint of arc
    const midAngleO = a1 + diff / 2;
    this.badgeAOB.position.set(
      posO.x + (arcRadiusO + 1.8) * Math.cos(midAngleO),
      posO.y + 2.0,
      posO.z + (arcRadiusO + 1.8) * Math.sin(midAngleO)
    );

    // 5. Update Inscribed Angle Arc ∠APB
    const arcRadiusP = 2.8;
    const vPA = new THREE.Vector3().subVectors(pA, pP).normalize();
    const vPB = new THREE.Vector3().subVectors(pB, pP).normalize();

    const angPA = Math.atan2(vPA.z, vPA.x);
    const angPB = Math.atan2(vPB.z, vPB.x);

    let diffP = angPB - angPA;
    if (diffP < -Math.PI) diffP += Math.PI * 2;
    if (diffP > Math.PI) diffP -= Math.PI * 2;

    const arcPointsP: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const theta = angPA + (diffP * i) / 24;
      arcPointsP.push(new THREE.Vector3(pP.x + arcRadiusP * Math.cos(theta), pP.y + 0.3, pP.z + arcRadiusP * Math.sin(theta)));
    }
    this.angleArcPGeometry.setFromPoints(arcPointsP);

    // Position ∠APB Badge
    const midAngleP = angPA + diffP / 2;
    this.badgeAPB.position.set(
      pP.x + (arcRadiusP + 1.6) * Math.cos(midAngleP),
      pP.y + 2.2,
      pP.z + (arcRadiusP + 1.6) * Math.sin(midAngleP)
    );
  }

  private updatePulseMesh(
    mesh: THREE.InstancedMesh,
    start: THREE.Vector3,
    end: THREE.Vector3,
    timeOffset: number,
    phase: number
  ) {
    const count = 4;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const progress = ((timeOffset * 0.45 + phase + i / count) % 1.0);
      const px = THREE.MathUtils.lerp(start.x, end.x, progress);
      const py = THREE.MathUtils.lerp(start.y, end.y, progress);
      const pz = THREE.MathUtils.lerp(start.z, end.z, progress);

      dummy.position.set(px, py, pz);
      dummy.scale.setScalar(1.0 - Math.abs(progress - 0.5) * 0.7);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  public setRadius(radius: number) {
    this.radius = radius;
    this.dialMesh.scale.set(radius / 14, radius / 14, 1);
  }
}
