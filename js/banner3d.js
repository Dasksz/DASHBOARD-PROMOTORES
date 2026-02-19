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

    function loadChester() {
        // Ensure GLTFLoader is loaded
        if (typeof THREE.GLTFLoader === 'undefined') {
            console.warn("THREE.GLTFLoader not found. Chester will not be loaded.");
            return;
        }

        const loader = new THREE.GLTFLoader();
        loader.load('imagens/Swimming.glb', function (gltf) {
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
            console.error('An error occurred loading Chester:', error);
        });
    }

    function spawnChester() {
        if (!chesterModel || !camera) return;

        const container = document.getElementById('banner-container');
        // Default aspect ratio if container not found
        const aspect = container ? container.clientWidth / container.clientHeight : window.innerWidth / window.innerHeight;
        
        // Random Selection of Modes
        const rand = Math.random();
        let spawnMode = 'EDGE_TO_EDGE';

        if (rand < 0.6) {
            spawnMode = 'CLOSE_UP'; // 60% Chance - Very Close & Prominent (Increased visibility)
        } else if (rand < 0.9) {
            spawnMode = 'EDGE_TO_EDGE'; // 30% Chance - Standard Flyby
        } else {
            spawnMode = 'DEEP_SPAWN'; // 10% Chance - Background (Reduced to prevent "invisible" confusion)
        }

        // --- Common Math for Off-screen Calculation ---
        // The camera looks at (8, 0, 0), so the view is centered roughly at x=8.
        const viewCenterX = 8;
        
        // --- MODE C: CLOSE UP (Fly near camera) ---
        if (spawnMode === 'CLOSE_UP') {
            // Z Range near camera (Camera is at Z=25)
            const zClose = 18 + (Math.random() - 0.5) * 4; 
            
            // Calculate visible bounds at this depth
            const dist = camera.position.z - zClose;
            const vFOV = THREE.MathUtils.degToRad(camera.fov);
            const visibleHeight = 2 * Math.tan(vFOV / 2) * dist;
            const visibleWidth = visibleHeight * aspect;

            const startLeft = Math.random() > 0.5;
            // HUGE offset to ensure no pop-in, accounting for camera pan/rotation
            const offset = 35; 
            
            const xLeft = viewCenterX - (visibleWidth / 2) - offset;
            const xRight = viewCenterX + (visibleWidth / 2) + offset;
            
            const xStart = startLeft ? xLeft : xRight;
            const xEnd = startLeft ? xRight : xLeft;

            // Curve points
            const p1 = new THREE.Vector3(xStart, (Math.random()-0.5) * 5, zClose);
            // Bulge towards camera for "in your face" effect
            const p2 = new THREE.Vector3(startLeft ? viewCenterX - 5 : viewCenterX + 5, (Math.random()-0.5) * 8, zClose + 2); 
            const p3 = new THREE.Vector3(startLeft ? viewCenterX + 5 : viewCenterX - 5, (Math.random()-0.5) * 8, zClose + 2);
            const p4 = new THREE.Vector3(xEnd, (Math.random()-0.5) * 5, zClose);

            chesterPath = new THREE.CatmullRomCurve3([p1, p2, p3, p4]);
            
            // High chance to look at camera ("Belly Swim")
            // chesterOrientationMode = Math.random() > 0.3 ? 'CAMERA' : 'PATH'; 
            chesterOrientationMode = 'PATH'; // Always align with swim path
        } 
        // --- MODE A: EDGE TO EDGE (Mid Range) ---
        else if (spawnMode === 'EDGE_TO_EDGE') {
            // Calculate frustum width at a random depth
            const zDepth = (Math.random() - 0.5) * 10; // Z range: -5 to 5
            const dist = camera.position.z - zDepth;
            const vFOV = THREE.MathUtils.degToRad(camera.fov);
            const visibleHeight = 2 * Math.tan(vFOV / 2) * dist;
            const visibleWidth = visibleHeight * aspect;

            const startLeft = Math.random() > 0.5;
            const offset = 60; // Extremely large buffer to ensure smooth entry/exit
            
            const xLeft = viewCenterX - (visibleWidth / 2) - offset;
            const xRight = viewCenterX + (visibleWidth / 2) + offset;

            const xStart = startLeft ? xLeft : xRight;
            const xEnd = startLeft ? xRight : xLeft;

            const p1 = new THREE.Vector3(xStart, (Math.random() - 0.5) * visibleHeight * 0.6, zDepth);
            const p2 = new THREE.Vector3(viewCenterX - 10, (Math.random() - 0.5) * visibleHeight * 0.6, zDepth + (Math.random() - 0.5) * 5);
            const p3 = new THREE.Vector3(viewCenterX + 10, (Math.random() - 0.5) * visibleHeight * 0.6, zDepth + (Math.random() - 0.5) * 5);
            const p4 = new THREE.Vector3(xEnd, (Math.random() - 0.5) * visibleHeight * 0.6, zDepth);

            chesterPath = new THREE.CatmullRomCurve3([p1, p2, p3, p4]);
            
            // Occasionally look at camera
            // chesterOrientationMode = Math.random() > 0.8 ? 'CAMERA' : 'PATH'; 
            chesterOrientationMode = 'PATH'; // Always align with swim path

        } 
        // --- MODE B: DEEP SPAWN (Background) ---
        else {
            // Start far back, come towards camera/side
            // Centered around ViewCenter
            const startX = viewCenterX + (Math.random() - 0.5) * 30;
            const endX = viewCenterX + (Math.random() - 0.5) * 60;
            
            // Brought closer (-60 to -40) so he's more visible
            const p1 = new THREE.Vector3(startX, (Math.random() - 0.5) * 10, -50); 
            const p2 = new THREE.Vector3(startX * 0.6 + viewCenterX, (Math.random() - 0.5) * 15, -30);
            const p3 = new THREE.Vector3(endX * 0.4 + viewCenterX, (Math.random() - 0.5) * 20, -10);
            const p4 = new THREE.Vector3(endX, (Math.random() - 0.5) * 25, 20); // Past camera

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
        
        // Speed variation: Slower if close-up to appreciate details
        let speedBase = 0.0003;
        if (spawnMode === 'CLOSE_UP') speedBase = 0.00015; // Slower flyby
        chesterSpeed = speedBase + Math.random() * 0.0004;
    }

    function updateOrientation(point, tangent) {
        if (!chesterModel) return;

        // Force tangent-based orientation for natural swimming
        // We always want him to "swim forward" along the path.
        // If chesterOrientationMode was 'CAMERA', we would use lookAt(camera.position)
        // But the user reported "facing front" while moving sideways is weird.
        // So we default to PATH alignment for most cases.
        
        // Ensure tangent is normalized
        const t = tangent.clone().normalize();
        
        // Calculate look target ahead on the path
        const lookTarget = point.clone().add(t);
        
        chesterModel.lookAt(lookTarget);
        
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
                chesterState = 'HIDDEN';
                chesterModel.visible = false;
                // Faster respawn! 1-4 seconds
                chesterNextSpawnTime = time + 1.0 + Math.random() * 3.0; 
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
