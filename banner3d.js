(function() {
    let scene, camera, renderer;
    let cheetos = [], dustParticles;
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    let animationId;

    function initBanner() {
        const container = document.getElementById('banner-container');
        if (!container) return; // Guard clause

        let width = container.clientWidth;
        let height = container.clientHeight;

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

        const updateInput = (x, y) => {
            const rect = container.getBoundingClientRect();
            mouseX = ((x - rect.left) / width - 0.5) * 2;
            mouseY = ((y - rect.top) / height - 0.5) * 2;
        };

        container.addEventListener('mousemove', (e) => updateInput(e.clientX, e.clientY));
        container.addEventListener('touchmove', (e) => {
            if(e.touches.length > 0) updateInput(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        window.addEventListener('resize', onWindowResize);
        animate();
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
        // Stop if container removed (view switch)
        if (!document.getElementById('banner-container')) return;

        animationId = requestAnimationFrame(animate);

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

        if(renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }

    function generateNoiseTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ff6600';
        ctx.fillRect(0,0,size,size);

        const imageData = ctx.getImageData(0,0,size,size);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const grain = (Math.random() - 0.4) * 240;
            data[i] = Math.max(0, Math.min(255, data[i] + grain));
            data[i+1] = Math.max(0, Math.min(255, data[i+1] + grain * 0.6));
            data[i+2] = Math.max(0, Math.min(255, data[i+2] + grain * 0.05));
        }

        ctx.putImageData(imageData, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2.5, 2.5);
        return texture;
    }

    function smoothDeform(geometry, seed, yOffset = 0) {
        const pos = geometry.attributes.position;
        const vec = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
            vec.fromBufferAttribute(pos, i);
            const absoluteY = vec.y + yOffset;

            const noise = (
                Math.sin(absoluteY * 3.5 + seed) * Math.cos(vec.x * 2.5 + seed) +
                Math.sin(vec.z * 4.0 + seed) * 0.5
            ) * 0.12;

            const dir = vec.clone().normalize();
            pos.setXYZ(i, vec.x + dir.x * noise, vec.y + dir.y * noise, vec.z + dir.z * noise);
        }
        geometry.computeVertexNormals();
    }

    function createCheetoFactory() {
        const noiseTexture = generateNoiseTexture();

        const material = new THREE.MeshPhysicalMaterial({
            color: 0xff7700,
            map: noiseTexture,
            bumpMap: noiseTexture,
            bumpScale: 0.135,
            roughness: 0.98,
            roughnessMap: noiseTexture,
            metalness: 0.0,
            clearcoat: 0.0,
            emissive: 0xff3300,
            emissiveIntensity: 0.034
        });

        for (let i = 0; i < 35; i++) {
            const group = new THREE.Group();
            const radius = 0.35 + Math.random() * 0.15;
            const len = 1.6 + Math.random() * 0.8;
            const seed = Math.random() * 100;

            const bodyGeo = new THREE.CylinderGeometry(radius, radius, len, 32, 20, true);
            smoothDeform(bodyGeo, seed, 0);

            const capGeo = new THREE.SphereGeometry(radius, 32, 24);

            const cap1 = new THREE.Mesh(capGeo.clone(), material);
            const cap2 = new THREE.Mesh(capGeo.clone(), material);
            const body = new THREE.Mesh(bodyGeo, material);

            cap1.position.y = len/2;
            cap2.position.y = -len/2;

            smoothDeform(cap1.geometry, seed, len/2);
            smoothDeform(cap2.geometry, seed, -len/2);

            cap1.castShadow = cap2.castShadow = body.castShadow = true;
            group.add(body, cap1, cap2);

            resetCheeto(group, true);
            cheetos.push(group);
            scene.add(group);
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

    // Run automatically if container exists
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBanner);
    } else {
        initBanner();
    }

})();
