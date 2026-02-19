/* IMPORTANTE: Para ativar o desfoque (Blur), adicione isso ao seu CSS:

canvas {

filter: blur(1px);

}

*/



function createDeformedCheetoGeometry() {

const geometry = new THREE.CylinderGeometry(0.4, 0.4, 3.6, 48, 64, true);

const pos = geometry.attributes.position;

const vec = new THREE.Vector3();


// Parâmetros Finais

const bendIntensity = 0.3;

const taperStart = 0.82;

const tipExponent = 0.714;

const noiseInt = 0.12;

const noiseFreq = 4.1;


// Detalhes

const powderInt = 0.02;

const holesInt = 0.015;


const randomPhase = Math.random() * 100;



for (let i = 0; i < pos.count; i++) {

vec.fromBufferAttribute(pos, i);


const halfLen = 1.8;

const relativeY = vec.y / halfLen;



// 1. Afinamento

let radiusScale = 1.0;

if (Math.abs(relativeY) > taperStart) {

let distFromStart = (Math.abs(relativeY) - taperStart) / (1 - taperStart);

distFromStart = Math.max(0, Math.min(1, distFromStart));


if (distFromStart > 0.99) {

radiusScale = 0;

} else {

const cosVal = Math.max(0, Math.cos(distFromStart * Math.PI / 2));

radiusScale = Math.pow(cosVal, tipExponent);

}

}

vec.x *= radiusScale;

vec.z *= radiusScale;



// 2. Curvatura

const bendOffset = Math.pow(relativeY, 2) * bendIntensity;

vec.x += bendOffset;



let direction = new THREE.Vector3(vec.x - bendOffset, 0, vec.z);

if (direction.lengthSq() > 0) direction.normalize();

else direction.set(1,0,0);



const noiseFactor = radiusScale > 0.1 ? 1.0 : radiusScale * 10;



// 3. Texturas

const noise = Math.sin(vec.x * noiseFreq + randomPhase)

* Math.cos(vec.y * noiseFreq * 2 + randomPhase)

* Math.sin(vec.z * noiseFreq + randomPhase);

vec.addScaledVector(direction, noise * noiseInt * noiseFactor);



if (powderInt > 0) {

const powderFreq = 45.0;

const powderNoise = Math.abs(Math.sin(vec.x * powderFreq) * Math.cos(vec.y * powderFreq) * Math.sin(vec.z * powderFreq));

vec.addScaledVector(direction, powderNoise * powderInt * noiseFactor);

}



if (holesInt > 0) {

const holeFreq = 60.0;

const holeNoise = Math.abs(Math.cos(vec.x * holeFreq) * Math.sin(vec.y * holeFreq * 1.5) * Math.cos(vec.z * holeFreq));

vec.addScaledVector(direction, -holeNoise * holesInt * noiseFactor);

}



pos.setXYZ(i, vec.x, vec.y, vec.z);

}



geometry.computeVertexNormals();

return geometry;

}



// ATENÇÃO - MATERIAL:

// material.roughness = 0.84;

// material.clearcoat = 0.05;

// material.color.set("#6f2f01");
