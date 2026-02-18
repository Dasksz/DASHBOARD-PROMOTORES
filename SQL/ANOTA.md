<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Prime Distribuição (Sistema Operacional)</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                    },
                    colors: {
                        brand: {
                            orange: '#FF5E00', // Laranja Prime
                            darkOrange: '#CC4A00',
                            bg: '#050505',
                        }
                    },
                    animation: {
                        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    }
                }
            }
        }
    </script>

    <style>
        body {
            background-color: #050505;
            background-image: 
                radial-gradient(at 0% 0%, rgba(255, 94, 0, 0.15) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(255, 0, 0, 0.1) 0px, transparent 50%);
        }

        .glass-card {
            background: rgba(20, 20, 20, 0.6);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 0 40px rgba(0,0,0,0.8);
        }

        .input-field {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
        }
        
        .input-field:focus {
            border-color: #FF5E00;
            box-shadow: 0 0 0 2px rgba(255, 94, 0, 0.2);
            background: rgba(0, 0, 0, 0.6);
        }

        .logo-glow {
            filter: drop-shadow(0 0 10px rgba(255, 94, 0, 0.6));
        }

        /* Esconder spinner por padrão */
        .loader { display: none; }
        .loading .loader { display: block; }
        .loading .btn-text { display: none; }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">

    <!-- Efeitos de Fundo -->
    <div class="fixed inset-0 pointer-events-none">
        <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-orange/10 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] animate-pulse-slow" style="animation-delay: 2s"></div>
    </div>

    <!-- Container Principal -->
    <div class="glass-card w-full max-w-md rounded-2xl p-8 relative z-10">
        
        <!-- CABEÇALHO -->
        <div class="flex flex-col items-center mb-6">
            <div class="w-24 h-24 mb-4 relative">
                <div class="absolute inset-0 bg-brand-orange/20 rounded-full blur-xl"></div>
                <!-- LOGO COM "P" E DUAS SETAS INTERNAS -->
                <svg class="w-full h-full logo-glow relative z-10" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="gradLogo" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#FF8C00;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#FF2E00;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    
                    <!-- Moldura Hexagonal -->
                    <path d="M50 5 L90 27 V73 L50 95 L10 73 V27 Z" stroke="url(#gradLogo)" stroke-width="3" stroke-linejoin="round" fill="none" opacity="0.5"/>
                    
                    <!-- Letra "P" -->
                    <path d="M25 25 H55 C70 25 80 35 80 50 C80 65 70 75 55 75 H40 V85 H25 V25 Z" fill="url(#gradLogo)"/>
                    
                    <!-- Detalhe Interno: Duas Setas (Inspiradas na imagem enviada) -->
                    <!-- Seta 1 (Esquerda - Mais escura) -->
                    <path d="M40 44 L50 50 L40 56 L43 50 Z" fill="#4d1b00" />
                    <!-- Seta 2 (Direita - Principal/Destaque) -->
                    <path d="M48 40 L64 50 L48 60 L54 50 Z" fill="#141414" />
                </svg>
            </div>
            <h1 class="text-2xl font-bold text-white tracking-tight text-center">Prime Distribuição</h1>
            <p class="text-sm text-gray-400 mt-1 text-center">Sistema Operacional</p>
        </div>

        <!-- FORMULÁRIO -->
        <form id="loginForm" class="space-y-5">
            <div class="space-y-1.5">
                <label for="email" class="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">E-mail</label>
                <div class="relative">
                    <input type="email" id="email" required class="input-field w-full rounded-lg py-3 px-4 text-white placeholder-gray-600 outline-none" placeholder="seu@email.com">
                    <svg class="w-5 h-5 absolute right-3 top-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                </div>
            </div>

            <div class="space-y-1.5">
                <label for="password" class="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Senha</label>
                <div class="relative">
                    <input type="password" id="password" required class="input-field w-full rounded-lg py-3 px-4 text-white placeholder-gray-600 outline-none" placeholder="••••••••">
                    <button type="button" id="togglePassword" class="absolute right-3 top-3.5 text-gray-600 cursor-pointer hover:text-white transition-colors">
                        <svg id="eyeIcon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="flex items-center justify-between text-sm">
                <label class="flex items-center space-x-2 cursor-pointer group">
                    <input type="checkbox" class="w-4 h-4 rounded border-gray-600 bg-transparent text-brand-orange focus:ring-offset-0 focus:ring-brand-orange">
                    <span class="text-gray-400 group-hover:text-gray-300 transition-colors">Lembrar-me</span>
                </label>
                <a href="#" class="text-gray-500 hover:text-brand-orange transition-colors">Esqueceu a senha?</a>
            </div>

            <button type="submit" id="submitBtn" class="w-full bg-gradient-to-r from-brand-orange to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-orange-900/50 transform active:scale-[0.99] transition-all flex justify-center items-center">
                <span class="btn-text">ENTRAR</span>
                <!-- Spinner Animado -->
                <svg class="loader animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </button>
        </form>

        <div class="flex items-center my-6">
            <div class="flex-grow border-t border-white/10"></div>
            <span class="mx-4 text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Ou entre com</span>
            <div class="flex-grow border-t border-white/10"></div>
        </div>

        <!-- BOTÃO GOOGLE -->
        <div class="flex justify-center mb-6">
            <button type="button" class="w-12 h-12 rounded-full border border-gray-700 flex items-center justify-center hover:bg-white/5 hover:border-gray-500 transition-all group active:scale-90 shadow-sm relative">
                <svg class="w-9 h-9 text-gray-500 group-hover:text-gray-300 transition-colors" fill="currentColor" viewBox="0 0 52 52">
                    <g transform="translate(10, 14)">
                        <path d="M24 12.23c0-1.18-.1-2.32-.3-3.43H12v6.51h6.75c-.29 1.57-1.17 2.9-2.5 3.79v4.23h4.05c2.37-2.18 3.7-5.39 3.7-9.1z"/>
                        <path d="M12 24.5c3.24 0 5.96-1.07 7.95-2.91l-4.05-4.23c-1.12.75-2.55 1.19-3.9 1.19-3 0-5.54-2.03-6.45-4.76H1.4v4.41c2 3.97 6.1 6.71 10.6 6.71z"/>
                        <path d="M5.55 13.79a7.19 7.19 0 0 1 0-4.58V4.8H1.4a11.98 11.98 0 0 0 0 14.4l4.15-4.41z"/>
                        <path d="M12 4.31c1.76 0 3.34.6 4.59 1.8l3.43-3.43A11.94 11.94 0 0 0 12 0C7.5 0 3.4 2.74 1.4 6.71l4.15 4.41c.91-2.73 3.45-4.81 6.45-4.81z"/>
                    </g>
                    <path d="M48 24.5h-4.5v-4.5h-3v4.5h-4.5v3h4.5v4.5h3v-4.5h4.5v-3z"/>
                </svg>
            </button>
        </div>

        <!-- RODAPÉ -->
        <div class="text-center">
            <p class="text-sm text-gray-400">
                Não tem conta? <a href="#" class="font-semibold text-brand-orange hover:text-red-500 transition-colors">Cadastre-se</a>
            </p>
            <p class="text-xs text-gray-600 mt-6">© 2026 Prime Distribuição</p>
        </div>
    </div>

    <!-- SCRIPTS -->
    <script>
        const toggleBtn = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('password');
        
        toggleBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            toggleBtn.classList.toggle('text-brand-orange');
        });

        const loginForm = document.getElementById('loginForm');
        const submitBtn = document.getElementById('submitBtn');

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;

            setTimeout(() => {
                submitBtn.classList.remove('loading');
                submitBtn.classList.replace('from-brand-orange', 'from-green-600');
                submitBtn.classList.replace('to-red-600', 'to-green-500');
                document.querySelector('.btn-text').innerText = "SUCESSO!";
                setTimeout(() => location.reload(), 1500);
            }, 2000);
        });
    </script>
</body>
</html>
