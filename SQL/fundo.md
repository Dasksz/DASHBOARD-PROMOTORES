<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prime Distribuição - Login</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            overflow: hidden; /* Evita scroll por causa da animação */
            background: #050a18;
        }

        /* Animação do Gradiente de Fundo */
        .bg-animated {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -2;
            background: radial-gradient(circle at 50% 50%, #1a2a4a 0%, #050a18 100%);
            animation: pulseBg 10s ease infinite alternate;
        }

        @keyframes pulseBg {
            0% { transform: scale(1); }
            100% { transform: scale(1.1); }
        }

        /* Efeito de Vidro (Glassmorphism) */
        .glass-card {
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Canvas para partículas */
        #particle-canvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            pointer-events: none;
        }

        .btn-gradient {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            transition: all 0.3s ease;
        }

        .btn-gradient:hover {
            filter: brightness(1.1);
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(234, 88, 12, 0.4);
        }

        .input-field {
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.2s ease;
        }

        .input-field:focus {
            border-color: #f97316;
            background: rgba(30, 41, 59, 0.8);
            outline: none;
        }
    </style>
</head>
<body class="flex items-center justify-center min-h-screen p-4">

    <!-- Fundo Animado -->
    <div class="bg-animated"></div>
    <canvas id="particle-canvas"></canvas>

    <!-- Card Principal -->
    <main class="glass-card flex flex-col md:flex-row w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl">
        
        <!-- Lado Esquerdo: Branding -->
        <section class="w-full md:w-1/2 p-12 flex flex-col items-center justify-center text-center space-y-6 bg-blue-900/20">
            <!-- Logo Placeholder (Hexágono) -->
            <div class="relative w-24 h-24 flex items-center justify-center">
                <div class="absolute inset-0 bg-orange-600 opacity-20 blur-xl rounded-full"></div>
                <svg viewBox="0 0 100 100" class="w-20 h-20 text-orange-500 relative z-10">
                    <path fill="none" stroke="currentColor" stroke-width="4" d="M50 5 L89 27.5 L89 72.5 L50 95 L11 72.5 L11 27.5 Z" />
                    <path fill="currentColor" d="M40 35 L65 50 L40 65 V35 Z" />
                </svg>
            </div>
            
            <div class="space-y-2">
                <h1 class="text-white text-4xl font-bold tracking-tight">Bem-vindo!</h1>
                <p class="text-blue-200/70 text-sm leading-relaxed px-6">
                    Acesse o painel de Promotores da <br> 
                    <span class="text-orange-500 font-semibold uppercase tracking-wider">Prime Distribuição</span>
                </p>
            </div>
        </section>

        <!-- Lado Direito: Formulário -->
        <section class="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
            <div class="mb-8 text-center md:text-left">
                <h2 class="text-white text-2xl font-semibold mb-1">Login</h2>
                <p class="text-gray-400 text-sm">Preencha suas credenciais para continuar</p>
            </div>

            <form class="space-y-5" onsubmit="event.preventDefault();">
                <!-- E-mail -->
                <div class="relative group">
                    <span class="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors">
                        <i data-lucide="mail" class="w-5 h-5"></i>
                    </span>
                    <input type="email" placeholder="E-mail" class="input-field w-full pl-12 pr-4 py-3 rounded-xl text-white placeholder-gray-500">
                </div>

                <!-- Senha -->
                <div class="relative group">
                    <span class="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors">
                        <i data-lucide="lock" class="w-5 h-5"></i>
                    </span>
                    <input type="password" placeholder="Senha" class="input-field w-full pl-12 pr-4 py-3 rounded-xl text-white placeholder-gray-500">
                </div>

                <!-- Opções Adicionais -->
                <div class="flex items-center justify-between text-xs text-gray-400">
                    <label class="flex items-center cursor-pointer hover:text-gray-200 transition-colors">
                        <input type="checkbox" class="mr-2 accent-orange-600">
                        Lembrar-me
                    </label>
                    <a href="#" class="hover:text-orange-500 transition-colors">Esqueceu a senha?</a>
                </div>

                <!-- Botão Entrar -->
                <button class="btn-gradient w-full py-3.5 rounded-xl text-white font-bold text-lg shadow-lg">
                    Entrar
                </button>

                <div class="relative flex py-2 items-center">
                    <div class="flex-grow border-t border-gray-700"></div>
                    <span class="flex-shrink mx-4 text-gray-500 text-xs">Ou entre com</span>
                    <div class="flex-grow border-t border-gray-700"></div>
                </div>

                <!-- Botão Google -->
                <button class="w-full py-3 rounded-xl bg-white text-gray-800 font-medium flex items-center justify-center gap-3 hover:bg-gray-100 transition-all border border-transparent active:scale-95">
                    <svg class="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                </button>
            </form>

            <p class="mt-8 text-center text-sm text-gray-400">
                Não tem conta? <a href="#" class="text-orange-500 font-semibold hover:underline">Cadastre-se</a>
            </p>
        </section>
    </main>

    <script>
        // Inicializa os ícones Lucide
        lucide.createIcons();

        // --- Lógica das Partículas Flutuantes ---
        const canvas = document.getElementById('particle-canvas');
        const ctx = canvas.getContext('2d');
        let particles = [];

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        window.addEventListener('resize', resize);
        resize();

        class Particle {
            constructor() {
                this.reset();
            }
            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = Math.random() * 0.5 - 0.25;
                this.speedY = Math.random() * 0.5 - 0.25;
                this.opacity = Math.random() * 0.5 + 0.2;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
                    this.reset();
                }
            }
            draw() {
                ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function init() {
            for (let i = 0; i < 80; i++) {
                particles.push(new Particle());
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            requestAnimationFrame(animate);
        }

        init();
        animate();
    </script>
</body>
</html>
