window.Auth = {
    isCheckingProfile: false,
    isAppReady: false,

    init: function() {
        this.bindEvents();
        this.setupSessionListener();
    },

    bindEvents: function() {
        const supabaseClient = window.supabaseClient;

        // Login Button (Google)
        const loginButton = document.getElementById('login-button');
        if (loginButton) {
            loginButton.addEventListener('click', async () => {
                await supabaseClient.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: window.location.origin + window.location.pathname }
                });
            });
        }

        // Email/Password Login
        const formSignin = document.getElementById('form-signin');
        if (formSignin) {
            formSignin.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = formSignin.email.value;
                const password = formSignin.password.value;

                const btn = formSignin.querySelector('button[type="submit"]');
                const oldText = btn.textContent;
                btn.disabled = true; btn.textContent = 'Entrando...';

                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) {
                    this.handleError(error);
                    btn.disabled = false; btn.textContent = oldText;
                }
            });
        }

        // Sign Up
        const formSignup = document.getElementById('form-signup');
        if (formSignup) {
            formSignup.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = formSignup.name.value;
                const email = formSignup.email.value;
                const phone = formSignup.phone.value;
                const password = formSignup.password.value;

                // Validate Password
                if (password.length < 8) {
                    window.Utils.showToast('warning', 'A senha deve ter no mínimo 8 caracteres.');
                    return;
                }
                if (!/[A-Z]/.test(password)) {
                    window.Utils.showToast('warning', 'A senha deve conter pelo menos uma letra maiúscula.');
                    return;
                }
                if (!/[a-z]/.test(password)) {
                    window.Utils.showToast('warning', 'A senha deve conter pelo menos uma letra minúscula.');
                    return;
                }
                if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                    window.Utils.showToast('warning', 'A senha deve conter pelo menos um caractere especial.');
                    return;
                }

                const btn = formSignup.querySelector('button[type="submit"]');
                const oldText = btn.textContent;
                btn.disabled = true; btn.textContent = 'Cadastrando...';

                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name,
                            phone: phone,
                            password: password
                        }
                    }
                });

                if (error) {
                    this.handleError(error);
                    btn.disabled = false; btn.textContent = oldText;
                    return;
                }

                if (data && data.user) {
                    window.Utils.showToast('success', 'Cadastro realizado! Sua conta aguarda aprovação manual.');
                    setTimeout(() => window.location.reload(), 2000);
                }
            });
        }

        // Forgot Password
        const formForgot = document.getElementById('form-forgot');
        if (formForgot) {
            formForgot.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = formForgot.email.value;

                const btn = formForgot.querySelector('button[type="submit"]');
                const oldText = btn.textContent;
                btn.disabled = true; btn.textContent = 'Enviando...';

                try {
                    const { data: profile, error: profileError } = await supabaseClient
                        .from('profiles')
                        .select('status')
                        .eq('email', email)
                        .maybeSingle();

                    if (profileError) {
                        console.error('Erro ao verificar perfil:', profileError);
                        window.Utils.showToast('error', 'Não foi possível verificar o e-mail. Tente novamente mais tarde.');
                        btn.disabled = false; btn.textContent = oldText;
                        return;
                    }

                    if (!profile || profile.status !== 'aprovado') {
                        window.Utils.showToast('error', 'E-mail não encontrado ou cadastro pendente de aprovação.');
                        btn.disabled = false; btn.textContent = oldText;
                        return;
                    }

                    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                        redirectTo: window.location.origin,
                    });

                    if (error) {
                        this.handleError(error);
                    } else {
                        window.Utils.showToast('success', 'Verifique seu e-mail para o link de redefinição de senha.');
                        // Toggle views
                        document.getElementById('login-form-forgot').classList.add('hidden');
                        document.getElementById('login-form-signin').classList.remove('hidden');
                    }

                } catch (err) {
                    console.error('Erro inesperado:', err);
                    window.Utils.showToast('error', 'Ocorreu um erro ao processar sua solicitação.');
                } finally {
                    btn.disabled = false; btn.textContent = oldText;
                }
            });
        }

        // Logout from Pending Screen
        const logoutButtonPendente = document.getElementById('logout-button-pendente');
        if (logoutButtonPendente) {
            logoutButtonPendente.addEventListener('click', async () => {
                await supabaseClient.auth.signOut();
                window.location.reload();
            });
        }

        // Toggle UI Logic
        const btnShowSignup = document.getElementById('btn-show-signup');
        const btnShowSignin = document.getElementById('btn-show-signin');
        const btnForgotPassword = document.getElementById('btn-forgot-password');
        const btnBackToLogin = document.getElementById('btn-back-to-login');
        const loginFormSignin = document.getElementById('login-form-signin');
        const loginFormSignup = document.getElementById('login-form-signup');
        const loginFormForgot = document.getElementById('login-form-forgot');

        if (btnShowSignup) {
            btnShowSignup.addEventListener('click', () => {
                loginFormSignin.classList.add('hidden');
                loginFormSignup.classList.remove('hidden');
                loginFormForgot.classList.add('hidden');
            });
        }
        if (btnShowSignin) {
            btnShowSignin.addEventListener('click', () => {
                loginFormSignup.classList.add('hidden');
                loginFormSignin.classList.remove('hidden');
                loginFormForgot.classList.add('hidden');
            });
        }
        if (btnForgotPassword) {
            btnForgotPassword.addEventListener('click', (e) => {
                e.preventDefault();
                loginFormSignin.classList.add('hidden');
                loginFormSignup.classList.add('hidden');
                loginFormForgot.classList.remove('hidden');
            });
        }
        if (btnBackToLogin) {
            btnBackToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                loginFormForgot.classList.add('hidden');
                loginFormSignin.classList.remove('hidden');
            });
        }

        // Password Toggle
        const btnTogglePasswordSignup = document.getElementById('btn-toggle-password-signup');
        const inputPasswordSignup = document.getElementById('signup-password');
        if (btnTogglePasswordSignup && inputPasswordSignup) {
            btnTogglePasswordSignup.addEventListener('click', () => {
                const type = inputPasswordSignup.getAttribute('type') === 'password' ? 'text' : 'password';
                inputPasswordSignup.setAttribute('type', type);
                if (type === 'text') {
                    btnTogglePasswordSignup.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>';
                } else {
                    btnTogglePasswordSignup.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>';
                }
            });
        }
    },

    setupSessionListener: function() {
        const supabaseClient = window.supabaseClient;
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                this.verifyUserProfile(session);
            } else {
                document.getElementById('tela-login').classList.remove('hidden');
            }
        });

        // Visibility Change for seamless reconnection
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
                const errorCard = document.getElementById('loading-card-content');
                if (errorCard && errorCard.innerHTML.includes('Erro de Conexão')) {
                    const { data } = await supabaseClient.auth.getSession();
                    if (data && data.session) {
                        this.isCheckingProfile = false;
                        this.verifyUserProfile(data.session);
                    } else {
                        window.location.reload();
                    }
                }
            }
        });
    },

    verifyUserProfile: async function(session) {
        if (window.Data && window.Data.isDataLoaded) {
            document.getElementById('tela-loading').classList.add('hidden');
            document.getElementById('tela-login').classList.add('hidden');
            return;
        }

        if (this.isCheckingProfile || !session) return;
        this.isCheckingProfile = true;

        if (!this.isAppReady) {
            document.getElementById('tela-login').classList.add('hidden');
            document.getElementById('tela-pendente').classList.add('hidden');
            document.getElementById('tela-loading').classList.remove('hidden');
        }

        try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Tempo limite excedido')), 15000));
            const profilePromise = window.supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
            const { data: profile, error } = await Promise.race([profilePromise, timeout]);

            if (error && error.code !== 'PGRST116') throw error;

            if (profile && profile.status === 'aprovado') {
                window.userRole = profile.role; // Legacy support
                window.AppState.userHierarchyContext.role = profile.role; // New State

                const welcomeEl = document.getElementById('welcome-header');
                if (welcomeEl) {
                    const fullName = session.user.user_metadata.full_name || session.user.user_metadata.name || session.user.email;
                    welcomeEl.textContent = `Olá, ${window.Utils.getFirstName(fullName)}!`;
                }

                if (!this.isAppReady) {
                    document.getElementById('tela-loading').classList.add('hidden');
                    // Trigger Data Loading
                    window.Data.load(window.supabaseClient);
                }
            } else {
                document.getElementById('tela-loading').classList.add('hidden');
                document.getElementById('tela-pendente').classList.remove('hidden');

                const statusMsg = document.getElementById('pendente-status-msg');
                if (statusMsg) {
                    if (profile && profile.status === 'bloqueado') {
                        statusMsg.textContent = "Acesso Bloqueado pelo Administrador";
                        statusMsg.style.color = "#e53e3e";
                    } else {
                        statusMsg.textContent = "Aguardando Liberação";
                        statusMsg.style.color = "#FF9933";
                    }
                }
                const contentWrapper = document.getElementById('content-wrapper');
                if(contentWrapper) contentWrapper.classList.add('hidden');
            }
        } catch (err) {
            console.error("Auth Error:", err);
            window.Utils.showToast('error', "Erro de conexão: " + err.message);
            if(!this.isAppReady) {
                document.getElementById('tela-loading').classList.add('hidden');
                document.getElementById('tela-pendente').classList.remove('hidden');
                // Could render retry button here
            }
        } finally {
            this.isCheckingProfile = false;
        }
    },

    handleError: function(error) {
        console.error('Supabase Error:', error);
        let msg = error.message || "Ocorreu um erro desconhecido.";
        if (msg.includes("email rate limit exceeded")) msg = "Muitas tentativas. Aguarde.";
        else if (msg.includes("Invalid login credentials")) msg = "Email ou senha incorretos.";
        else if (msg.includes("User already registered")) msg = "Este email já está cadastrado.";
        window.Utils.showToast('error', msg);
    }
};

// Alias for legacy calls if any
window.handleSupabaseError = window.Auth.handleError;
