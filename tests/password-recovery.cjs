const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/init.js', 'utf8');

function element(hidden = false) {
    const classes = new Set(hidden ? ['hidden'] : []);
    return {
        value: '', textContent: 'Enviar', disabled: false, handlers: {},
        classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
        addEventListener(event, handler) { this.handlers[event] = handler; },
        querySelector() { return this.button; },
        reset() { this.wasReset = true; }
    };
}

function setup(error = null) {
    const ids = Object.fromEntries(['forgot-email', 'reset-password', 'reset-password-confirm',
        'view-reset', 'content-wrapper', 'top-navbar'].map(id => [id, element()]));
    const names = ['formForgot', 'formReset', 'viewForgot', 'viewLogin', 'viewSignup',
        'telaLogin', 'telaLoading', 'telaPendente'];
    const ui = Object.fromEntries(names.map(n => [n, element()]));
    ui.formForgot.button = element(); ui.formReset.button = element();
    ids.resetForm = ui.formReset;
    const calls = [], toasts = [];
    let authHandler;
    const context = vm.createContext({ ...ui, console,
        document: { getElementById: id => ids[id] },
        window: {
            location: { origin: 'https://dasksz.github.io', pathname: '/DASHBOARD-PROMOTORES/', reload() { calls.push('reload'); } },
            showToast: (...args) => toasts.push(args), handleSupabaseError: e => calls.push(e),
        },
        supabaseClient: {
            from() { throw new Error('Recovery must not read private profiles'); },
            auth: {
                resetPasswordForEmail: async (...args) => { calls.push(args); return { error }; },
                updateUser: async args => { calls.push(args); return { error }; },
                getSession: async () => ({ data: { session: { user: { id: 'test' } } } }),
                onAuthStateChange: handler => { authHandler = handler; }
            }
        },
        verifyUserProfile: () => { calls.push('profile'); },
        setTimeout: fn => { fn(); }
    });
    const resetStart = source.indexOf('        // Reset Password Form Logic');
    const resetEnd = source.indexOf('        if (btnTogglePasswordReset', resetStart);
    vm.runInContext(source.slice(resetStart, resetEnd), context);
    const listenerStart = source.indexOf('        // Auth State Listener');
    const listenerEnd = source.indexOf('        // Admin Modal Logic', listenerStart);
    vm.runInContext(source.slice(listenerStart, listenerEnd), context);
    return { ids, ui, calls, toasts, context, auth: (...args) => authHandler(...args) };
}

test('signed-out recovery sends a trimmed email and preserves the GitHub Pages path', async () => {
    const s = setup(); s.ids['forgot-email'].value = ' person@example.com ';
    await s.ui.formForgot.handlers.submit({ preventDefault() {} });
    assert.equal(s.calls[0][0], 'person@example.com');
    assert.equal(s.calls[0][1].redirectTo, 'https://dasksz.github.io/DASHBOARD-PROMOTORES/');
    assert.equal(s.ui.viewForgot.classList.contains('hidden'), true);
    assert.equal(s.ui.viewLogin.classList.contains('hidden'), false);
    assert.equal(s.ui.formForgot.button.disabled, false);
    assert.equal(s.toasts[0][0], 'success');
});

test('mail service failures keep the recovery form and re-enable retry', async () => {
    const error = { message: 'email rate limit exceeded' }; const s = setup(error);
    await s.ui.formForgot.handlers.submit({ preventDefault() {} });
    assert.equal(s.calls[1], error);
    assert.equal(s.ui.viewForgot.classList.contains('hidden'), false);
    assert.equal(s.ui.formForgot.button.disabled, false);
    assert.equal(s.toasts.length, 0);
});

test('recovery hides loading screens and blocks dashboard checks until password update succeeds', async () => {
    const s = setup();
    s.auth('PASSWORD_RECOVERY', { user: { id: 'test' } });
    assert.equal(s.ui.telaLoading.classList.contains('hidden'), true);
    assert.equal(s.ui.telaPendente.classList.contains('hidden'), true);
    assert.equal(s.ui.telaLogin.classList.contains('hidden'), false);
    assert.equal(s.ids['view-reset'].classList.contains('hidden'), false);
    // Run the real profile guard; it must exit before reading profiles.
    const start = source.indexOf('        let isCheckingProfile = false;');
    const end = source.indexOf('// Visibility Change Listener', start);
    vm.runInContext(source.slice(start, end), s.context);
    await vm.runInContext('verifyUserProfile({user: {id: "test"}})', s.context);
    assert.equal(vm.runInContext('isRecoveringPassword', s.context), true);
    // Restore the profile spy for the post-update transition.
    s.context.verifyUserProfile = () => s.calls.push('profile');
    s.ids['reset-password'].value = s.ids['reset-password-confirm'].value = 'New-test-password1!';
    await s.ui.formReset.handlers.submit({ preventDefault() {} });
    assert.equal(s.calls[0].password, 'New-test-password1!');
    assert.equal(vm.runInContext('isRecoveringPassword', s.context), false);
    assert.equal(s.ui.formReset.wasReset, true);
    assert.equal(s.calls.includes('profile'), true);
});

test('failed password updates keep recovery active', async () => {
    const s = setup({ message: 'Password rejected' });
    s.auth('PASSWORD_RECOVERY', { user: { id: 'test' } });
    s.ids['reset-password'].value = s.ids['reset-password-confirm'].value = 'New-test-password1!';
    await s.ui.formReset.handlers.submit({ preventDefault() {} });
    assert.equal(vm.runInContext('isRecoveringPassword', s.context), true);
    assert.equal(s.calls.includes('profile'), false);
    assert.equal(s.ui.formReset.button.disabled, false);
});
