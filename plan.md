1. **Analyze UX/A11y Opportunities**: I have identified several icon-only buttons missing `aria-label` attributes.
   - `togglePassword`: Toggle password visibility.
   - `login-google-btn`: Login with Google.
   - `admin-view-toggle-btn`: Admin view toggle.
   - `open-admin-btn`: Open admin modal.
   - `mobile-menu-toggle`: Mobile menu toggle.
   - `user-menu-btn`: User menu toggle.
2. **Select Enhancement**: The icon-only buttons in the navigation and login form are crucial for accessibility. Screen reader users would have a difficult time navigating without descriptive labels.
3. **Implementation**: Add appropriate `aria-label` to these buttons.
   - `#togglePassword`: `aria-label="Mostrar senha"`
   - `#login-google-btn`: `aria-label="Entrar com Google"`
   - `#admin-view-toggle-btn`: `aria-label="Alternar Visão (Promotor/Vendedor)"`
   - `#open-admin-btn`: `aria-label="Upload de Dados Admin"`
   - `#mobile-menu-toggle`: `aria-label="Abrir menu mobile"`
   - `#user-menu-btn`: `aria-label="Menu do usuário"`
4. **Pre-commit**: Run pre-commit instructions.
5. **Submit**: Create PR.
