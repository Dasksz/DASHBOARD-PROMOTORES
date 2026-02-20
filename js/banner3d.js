(function() {
    let scene, camera, renderer;
    let cheetos = [], dustParticles;
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    let animationId;

    // Chester Variables
    let chesterModel, chesterMixer, clock;
    let chesterPath = null;
    let chesterProgress = 0;
    let chesterState = 'HIDDEN'; // HIDDEN, SWIMMING
    let chesterSpeed = 0.002;
    let chesterNextSpawnTime = 0;
    let chesterOrientationMode = 'PATH'; // 'PATH', 'CAMERA'
    let isBellySwim = false;

    function initBanner() {
        const container = document.getElementById('banner-container');
        if (!container) return; // Guard clause

        let width = container.clientWidth;
        let height = container.clientHeight;

        clock = new THREE.Clock(); // Initialize clock

        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x020617, 0.02); 

        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.z = 25; 
        
        renderer = new THREE.WebGLRenderer({ 
            alpha: true, 
            antialias: true,
            precision: "highp",
            powerPreference: "high-performance"
        });
        
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.94; 
        
        // Ensure no duplicate canvas if re-run
        const oldCanvas = container.querySelector('canvas');
        if (oldCanvas) oldCanvas.remove();

        container.insertBefore(renderer.domElement, container.firstChild);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.38); 
        scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffaa00, 2.1);
        mainLight.position.set(10, 20, 15);
        mainLight.castShadow = true;
        scene.add(mainLight);

        const rimLight = new THREE.SpotLight(0x4f46e5, 5.1);
        rimLight.position.set(-20, 5, -5);
        scene.add(rimLight);

        createCheetoFactory();
        createDust();
        loadChester(); // Load Chester

        const updateInput = (x, y) => {
            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                mouseX = ((x - rect.left) / rect.width - 0.5) * 2;
                mouseY = ((y - rect.top) / rect.height - 0.5) * 2;
            }
        };

        container.addEventListener('mousemove', (e) => updateInput(e.clientX, e.clientY));
        container.addEventListener('touchmove', (e) => {
            if(e.touches.length > 0) updateInput(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        
        window.addEventListener('resize', onWindowResize);
        animate();
    }

    function loadChester(retryCount = 0) {
        // Ensure GLTFLoader is loaded
        if (typeof THREE.GLTFLoader === 'undefined') {
            console.warn("THREE.GLTFLoader not found. Chester will not be loaded.");
            return;
        }

        const loader = new THREE.GLTFLoader();
        // Enable cross-origin loading if needed and robust path handling
        if (loader.setCrossOrigin) {
            loader.setCrossOrigin('anonymous');
        }

        // Use ./ to ensure relative path to current document context
        const modelPath = './imagens/Swimming.glb';

        loader.load(modelPath, function (gltf) {
            chesterModel = gltf.scene;
            
            // Initial setup
            chesterModel.scale.set(17.5, 17.5, 17.5); // Adjust scale to fit scene nicely
            chesterModel.visible = false;
            
            // Enable shadows
            chesterModel.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });

            scene.add(chesterModel);
            
            // Setup Animation
            chesterMixer = new THREE.AnimationMixer(chesterModel);
            if(gltf.animations.length > 0) {
                const action = chesterMixer.clipAction(gltf.animations[0]);
                action.play();
            }

            // Schedule first spawn
            chesterNextSpawnTime = clock.getElapsedTime() + 0.5; 
        }, undefined, function (error) {
            console.error(`An error occurred loading Chester (Attempt ${retryCount + 1}):`, error);

            // Retry logic for 503 or network errors
            if (retryCount < 3) {
                const delay = 1000 * (retryCount + 1); // Exponential backoff: 1s, 2s, 3s
                console.log(`Retrying model load in ${delay}ms...`);
                setTimeout(() => {
                    loadChester(retryCount + 1);
                }, delay);
            } else {
                console.error("Failed to load Chester model after multiple attempts.");
            }
        });
    }

    function spawnChester() {
        if (!chesterModel || !camera) return;

        const container = document.getElementById('banner-container');
        // Default aspect ratio if container not found
        const aspect = container ? container.clientWidth / container.clientHeight : window.innerWidth / window.innerHeight;
        
        // Random Selection of Modes
        const rand = Math.random();
        let spawnMode;

        if (rand < 0.6) {
            spawnMode = 'CLOSE_UP'; // 60% Chance - Very Close & Prominent
        } else if (rand < 0.9) {
            spawnMode = 'EDGE_TO_EDGE'; // 30% Chance - Standard Flyby
        } else {
            spawnMode = 'DEEP_SPAWN'; // 10% Chance - Background
        }

        // --- Common Math for Off-screen Calculation ---
        // The camera looks at (8, 0, 0), so the view is centered roughly at x=8.
        const viewCenterX = 8;
        
        // --- MODE C: CLOSE UP (Fly near camera) ---
        if (spawnMode === 'CLOSE_UP') {
            const zClose = 12 + (Math.random() - 0.5) * 4; // Range: 10 to 14
            const dist = camera.position.z - zClose;
            const vFOV = THREE.MathUtils.degToRad(camera.fov);
            const visibleHeight = 2 * Math.tan(vFOV / 2) * dist;
            const visibleWidth = visibleHeight * aspect;

            // Decision: Standard Close-Up vs Special "Face Camera"
            // Special Mode: Right to Left, facing camera
            const isSpecialFaceCam = Math.random() < 0.35;

            let startLeft;
            if (isSpecialFaceCam) {
                startLeft = false; // Must start Right to move Left
                chesterOrientationMode = 'CAMERA';
            } else {
                startLeft = Math.random() > 0.5;
                chesterOrientationMode = 'PATH';
            }

            const offset = 10;
            
            const xLeft = viewCenterX - (visibleWidth / 2) - offset;
            const xRight = viewCenterX + (visibleWidth / 2) + offset;
            
            const xStart = startLeft ? xLeft : xRight;
            const xEnd = startLeft ? xRight : xLeft;

            const p1 = new THREE.Vector3(xStart, (Math.random()-0.5) * 5, zClose - 8);
            
            // Mid points: Ensure monotonic X and center crossing
            const midX1 = startLeft ? viewCenterX - 8 : viewCenterX + 8;
            const midX2 = startLeft ? viewCenterX + 8 : viewCenterX - 8;

            const p2 = new THREE.Vector3(midX1, (Math.random()-0.5) * 10, zClose); // More Y variation
            const p3 = new THREE.Vector3(midX2, (Math.random()-0.5) * 10, zClose);
            
            const p4 = new THREE.Vector3(xEnd, (Math.random()-0.5) * 5, zClose - 8);

            chesterPath = new THREE.CatmullRomCurve3([p1, p2, p3, p4]);
        } 
        // --- MODE A: EDGE TO EDGE (Now supports Diagonal/Vertical) ---
        else if (spawnMode === 'EDGE_TO_EDGE') {
            const zDepth = (Math.random() - 0.5) * 10;
            const dist = camera.position.z - zDepth;
            const vFOV = THREE.MathUtils.degToRad(camera.fov);
            const visibleHeight = 2 * Math.tan(vFOV / 2) * dist;
            const visibleWidth = visibleHeight * aspect;

            const offset = 35; // Decreased buffer for faster entry
            const yOffset = visibleHeight / 2 + 40; // Vertical buffer

            // Sub-mode Randomization: 
            // 0: Horizontal (Left->Right)
            // 1: Horizontal (Right->Left)
            // 2: Diagonal (TopLeft->BottomRight)
            // 3: Diagonal (BottomRight->TopLeft)
            // 4: Vertical (Top->Bottom)
            
            const subMode = Math.floor(Math.random() * 5);
            let p1, p2, p3, p4;

            const leftX = viewCenterX - (visibleWidth / 2) - offset;
            const rightX = viewCenterX + (visibleWidth / 2) + offset;
            const topY = yOffset;
            const botY = -yOffset;

            if (subMode === 0) { // L -> R
                 p1 = new THREE.Vector3(leftX, (Math.random()-0.5)*10, zDepth-5);
                 p2 = new THREE.Vector3(viewCenterX - 10, (Math.random()-0.5)*10, zDepth);
                 p3 = new THREE.Vector3(viewCenterX + 10, (Math.random()-0.5)*10, zDepth);
                 p4 = new THREE.Vector3(rightX, (Math.random()-0.5)*10, zDepth-5);
            } else if (subMode === 1) { // R -> L
                 p1 = new THREE.Vector3(rightX, (Math.random()-0.5)*10, zDepth-5);
                 p2 = new THREE.Vector3(viewCenterX + 10, (Math.random()-0.5)*10, zDepth);
                 p3 = new THREE.Vector3(viewCenterX - 10, (Math.random()-0.5)*10, zDepth);
                 p4 = new THREE.Vector3(leftX, (Math.random()-0.5)*10, zDepth-5);
            } else if (subMode === 2) { // TL -> BR
                 p1 = new THREE.Vector3(leftX, topY, zDepth-5);
                 p2 = new THREE.Vector3(viewCenterX - 5, 5, zDepth);
                 p3 = new THREE.Vector3(viewCenterX + 5, -5, zDepth);
                 p4 = new THREE.Vector3(rightX, botY, zDepth-5);
            } else if (subMode === 3) { // BR -> TL
                 p1 = new THREE.Vector3(rightX, botY, zDepth-5);
                 p2 = new THREE.Vector3(viewCenterX + 5, -5, zDepth);
                 p3 = new THREE.Vector3(viewCenterX - 5, 5, zDepth);
                 p4 = new THREE.Vector3(leftX, topY, zDepth-5);
            } else { // Top -> Bottom (Centerish)
                 const rX = viewCenterX + (Math.random()-0.5) * 20;
                 p1 = new THREE.Vector3(rX, topY + 20, zDepth-5);
                 p2 = new THREE.Vector3(rX + (Math.random()-0.5)*10, 10, zDepth);
                 p3 = new THREE.Vector3(rX + (Math.random()-0.5)*10, -10, zDepth);
                 p4 = new THREE.Vector3(rX, botY - 20, zDepth-5);
            }

            chesterPath = new THREE.CatmullRomCurve3([p1, p2, p3, p4]);
            chesterOrientationMode = 'PATH'; 

        } 
        // --- MODE B: DEEP SPAWN (Background - More random) ---
        else {
            // Start far back, come towards camera/side
            const startLeft = Math.random() > 0.5;
            const startX = viewCenterX + (startLeft ? -65 : 65); 
            const endX = viewCenterX + (startLeft ? 65 : -65); 
            
            // Add vertical variation to deep spawns
            const startY = (Math.random() - 0.5) * 40;
            const endY = (Math.random() - 0.5) * 40;

            const p1 = new THREE.Vector3(startX, startY, -45);
            
            const midX1 = viewCenterX + (startLeft ? -15 : 15);
            const midX2 = viewCenterX + (startLeft ? 15 : -15);

            const p2 = new THREE.Vector3(midX1, (Math.random() - 0.5) * 20, -35);
            const p3 = new THREE.Vector3(midX2, (Math.random() - 0.5) * 25, -20);
            
            const p4 = new THREE.Vector3(endX, endY, 10); 

            chesterPath = new THREE.CatmullRomCurve3([p1, p2, p3, p4]);
            chesterOrientationMode = 'PATH';
        }

        chesterProgress = 0;
        chesterState = 'SWIMMING';
        
        // Set initial position immediately to avoid 1-frame jump
        const point = chesterPath.getPointAt(0);
        chesterModel.position.copy(point);
        
        // Update orientation immediately
        updateOrientation(point, chesterPath.getTangentAt(0));
        
        chesterModel.visible = true;
        
        // Randomize Belly Swim (30% Chance)
        // Disable for CAMERA mode to avoid weird rotations
        if (chesterOrientationMode === 'CAMERA') {
            isBellySwim = false;
        } else {
            isBellySwim = Math.random() < 0.3;
        }

        // ZERO GRAVITY SPEED: Much slower (Portal effect needs instant continuity but slow motion)
        let speedBase = 0.0003;
        if (spawnMode === 'CLOSE_UP') speedBase = 0.0002;
        chesterSpeed = speedBase + Math.random() * 0.0001;
    }

    function updateOrientation(point, tangent) {
        if (!chesterModel) return;

        if (chesterOrientationMode === 'CAMERA') {
            // Force face camera
            if (camera) {
                chesterModel.lookAt(camera.position);
            }
        } else {
            // Force tangent-based orientation for natural swimming
            // Ensure tangent is normalized
            const t = tangent.clone().normalize();

            // Calculate look target ahead on the path
            const lookTarget = point.clone().add(t);

            chesterModel.lookAt(lookTarget);

            // Apply Belly Swim Rotation (Roll) if active
            if (isBellySwim) {
                chesterModel.rotateZ(1.2);
            }
        }
        
        // Potential Correction:
        // GLTF models often have +Z as forward. 
        // If Chester is swimming sideways but facing the wrong way (e.g. backwards), 
        // we might need to rotate the mesh container 180 deg around Y.
        // However, standard mixamo/blender exports usually align +Z Forward.
        // If he looks "sideways" while swimming forward, we need to rotate mesh.
        // Without seeing it live, I assume standard lookAt works if the model is rigged correctly.
    }

    function updateChester(delta) {
        if (!chesterModel || !clock) return;
        
        // Update Animation
        if (chesterMixer) chesterMixer.update(delta);

        const time = clock.getElapsedTime();

        if (chesterState === 'HIDDEN') {
            if (time > chesterNextSpawnTime) {
                spawnChester();
            }
        } else if (chesterState === 'SWIMMING') {
            if (!chesterPath) return;

            // Move along path
            chesterProgress += chesterSpeed * (delta * 60); // frame independent-ish
            
            if (chesterProgress >= 1.0) {
                spawnChester(); // Instant respawn (Portal effect)
                return;
            }

            const point = chesterPath.getPointAt(chesterProgress);
            const tangent = chesterPath.getTangentAt(chesterProgress);
            
            chesterModel.position.copy(point);
            updateOrientation(point, tangent);

            // Smooth Entry/Exit Scale Logic
            // Ensures he never "pops" in/out even if the path boundaries are slightly off.
            // Scale goes 0 -> 1 over first 10% of path, and 1 -> 0 over last 10%.
            let scaleFactor = 1.0;
            if (chesterProgress < 0.1) {
                scaleFactor = chesterProgress / 0.1;
            } else if (chesterProgress > 0.9) {
                scaleFactor = (1.0 - chesterProgress) / 0.1;
            }
            // Base scale is 17.5
            const currentScale = 17.5 * scaleFactor;
            chesterModel.scale.set(currentScale, currentScale, currentScale);

            // Collision Avoidance Logic (Repel Cheetos)
            // Reduced radius to prevent "ghost" interactions when off-screen
            // Only repel if Z-depth is similar to avoid background Chester pushing foreground Cheetos
            const repulsionRadius = 8.0; 
            const forceStrength = 0.5;

            cheetos.forEach(c => {
                // Quick Z check first to avoid distant interactions (Ghosting fix)
                if (Math.abs(c.position.z - chesterModel.position.z) > 15) return;

                const distSq = c.position.distanceToSquared(chesterModel.position);
                if (distSq < repulsionRadius * repulsionRadius) {
                    const dist = Math.sqrt(distSq);
                    const dir = new THREE.Vector3().subVectors(c.position, chesterModel.position).normalize();
                    const push = (repulsionRadius - dist) * forceStrength;
                    
                    c.position.add(dir.multiplyScalar(push));
                    c.rotation.x += Math.random() * 0.1;
                    c.rotation.z += Math.random() * 0.1;
                }
            });
        }
    }

    function onWindowResize() {
        const container = document.getElementById('banner-container');
        if (!container || !camera || !renderer) return;
        
        const width = container.clientWidth; 
        const height = container.clientHeight;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    function animate() {
        const container = document.getElementById('banner-container');
        // Stop if container removed (view switch)
        if (!container) return;

        // Optimization: Pause rendering if not visible (e.g. hidden by tabs)
        if (container.offsetParent === null) {
            setTimeout(animate, 500); // Slow poll until visible
            return;
        }

        animationId = requestAnimationFrame(animate);

        const delta = clock ? clock.getDelta() : 0.016;

        targetX += (mouseX - targetX) * 0.05;
        targetY += (mouseY - targetY) * 0.05;
        
        if(camera) {
            camera.position.x = targetX * 2.5;
            camera.position.y = -targetY * 2.5;
            camera.lookAt(8, 0, 0);
        }

        if(cheetos) {
            cheetos.forEach(c => {
                c.position.z += c.userData.speed;
                c.rotation.x += c.userData.rot.x;
                c.rotation.y += c.userData.rot.y;
                c.rotation.z += c.userData.rot.z;
                if (c.position.z > 35) resetCheeto(c);
            });
        }

        if(dustParticles) {
            dustParticles.rotation.y += 0.0007;
            dustParticles.rotation.x += 0.0002;
        }

        // Update Chester
        updateChester(delta);

        if(renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }

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

    function createCheetoFactory() {
        const material = new THREE.MeshPhysicalMaterial({ 
            color: "#6f2f01",
            roughness: 0.84,
            clearcoat: 0.05
        });

        for (let i = 0; i < 35; i++) {
            const geometry = createDeformedCheetoGeometry();
            const mesh = new THREE.Mesh(geometry, material);
            
            mesh.castShadow = true;
            
            resetCheeto(mesh, true);
            cheetos.push(mesh);
            scene.add(mesh);
        }
    }

    function createDust() {
        const geo = new THREE.BufferGeometry();
        const count = 1500; 
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i*3] = (Math.random()-0.5)*75;
            pos[i*3+1] = (Math.random()-0.5)*45;
            pos[i*3+2] = (Math.random()-0.5)*45;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        dustParticles = new THREE.Points(geo, new THREE.PointsMaterial({ 
            size: 0.1, 
            color: 0xffcc00, 
            transparent: true, 
            opacity: 0.5 
        }));
        scene.add(dustParticles);
    }

    function resetCheeto(mesh, isInitial = false) {
        mesh.position.z = isInitial ? (Math.random() * 60) - 40 : -60;
        mesh.position.x = (Math.random() * 60) - 20; 
        mesh.position.y = (Math.random() - 0.5) * 35;
        mesh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        
        mesh.userData = {
            speed: 0.02 + Math.random() * 0.07,
            rot: new THREE.Vector3((Math.random()-0.5)*0.012, (Math.random()-0.5)*0.012, (Math.random()-0.5)*0.012)
        };
    }

    // Expose init globally or run on load
    window.initBanner3D = initBanner;
    window.resizeBanner3D = onWindowResize;

    // Run automatically if container exists (with delay to prevent blocking main thread)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initBanner, 200));
    } else {
        setTimeout(initBanner, 200);
    }

})();
