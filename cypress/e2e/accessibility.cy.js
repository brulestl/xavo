describe('Accessibility Audit Tests', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Core App Screens Accessibility', () => {
    it('should pass accessibility audit on welcome screen', () => {
      cy.visit('/');
      cy.waitForApp();
      
      // Inject axe and run accessibility check
      cy.injectAxe();
      cy.checkA11y(null, {
        rules: {
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true },
          'focus-management': { enabled: true }
        }
      });
      
      // Check specific accessibility features
      cy.get('[data-testid="welcome-title"]').should('have.attr', 'role', 'heading');
      cy.get('[data-testid="get-started-button"]').should('be.focusable');
    });

    it('should pass accessibility audit on authentication screens', () => {
      cy.visit('/');
      cy.waitForApp();
      cy.get('[data-testid="get-started-button"]').click();
      
      cy.injectAxe();
      cy.checkA11y();
      
      // Check form accessibility
      cy.get('[data-testid="email-input"]').should('have.attr', 'aria-label');
      cy.get('[data-testid="password-input"]').should('have.attr', 'aria-label');
      cy.get('[data-testid="login-button"]').should('have.attr', 'aria-describedby');
    });

    it('should pass accessibility audit on onboarding screens', () => {
      cy.visit('/');
      cy.waitForApp();
      cy.loginAsGuest();
      
      cy.injectAxe();
      cy.checkA11y();
      
      // Check onboarding accessibility
      cy.get('[data-testid="onboarding-progress"]').should('have.attr', 'role', 'progressbar');
      cy.get('[data-testid="skip-intro"]').should('have.attr', 'aria-label', 'Skip introduction');
    });

    it('should pass accessibility audit on chat screen', () => {
      cy.visit('/');
      cy.waitForApp();
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      cy.injectAxe();
      cy.checkA11y();
      
      // Check chat accessibility
      cy.get('[data-testid="chat-messages"]').should('have.attr', 'role', 'log');
      cy.get('[data-testid="chat-input"]').should('have.attr', 'aria-label', 'Type your message');
      cy.get('[data-testid="send-button"]').should('have.attr', 'aria-label', 'Send message');
    });

    it('should pass accessibility audit on paywall screen', () => {
      cy.visit('/');
      cy.waitForApp();
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Trigger paywall
      cy.mockTierLimitExceeded();
      cy.sendChatMessage('Trigger paywall');
      cy.wait('@limitExceeded');
      
      cy.injectAxe();
      cy.checkA11y();
      
      // Check paywall accessibility
      cy.get('[data-testid="paywall-modal"]').should('have.attr', 'role', 'dialog');
      cy.get('[data-testid="paywall-modal"]').should('have.attr', 'aria-modal', 'true');
      cy.get('[data-testid="upgrade-button"]').should('be.focusable');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation on welcome screen', () => {
      cy.visit('/');
      cy.waitForApp();
      
      // Test tab navigation
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'get-started-button');
      
      // Test enter key activation
      cy.focused().type('{enter}');
      cy.get('[data-testid="auth-choice-screen"]').should('be.visible');
    });

    it('should support keyboard navigation in forms', () => {
      cy.visit('/');
      cy.waitForApp();
      cy.get('[data-testid="get-started-button"]').click();
      cy.get('[data-testid="sign-in-button"]').click();
      
      // Test form navigation
      cy.get('[data-testid="email-input"]').focus().type('test@example.com');
      cy.get('[data-testid="email-input"]').tab();
      cy.focused().should('have.attr', 'data-testid', 'password-input');
      
      cy.focused().type('password123');
      cy.get('[data-testid="password-input"]').tab();
      cy.focused().should('have.attr', 'data-testid', 'login-button');
    });

    it('should support keyboard navigation in chat', () => {
      cy.visit('/');
      cy.waitForApp();
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Test chat input focus
      cy.get('[data-testid="chat-input"]').should('be.focused');
      
      // Test send with Enter key
      cy.mockChatResponse('Test response');
      cy.get('[data-testid="chat-input"]').type('Test message{enter}');
      cy.wait('@chatRequest');
      
      // Focus should return to input
      cy.get('[data-testid="chat-input"]').should('be.focused');
    });
  });

  describe('Screen Reader Support', () => {
    it('should have proper ARIA labels and roles', () => {
      cy.visit('/');
      cy.waitForApp();
      
      // Check main navigation
      cy.get('[data-testid="main-navigation"]').should('have.attr', 'role', 'navigation');
      cy.get('[data-testid="main-navigation"]').should('have.attr', 'aria-label', 'Main navigation');
      
      // Check headings hierarchy
      cy.get('h1').should('exist');
      cy.get('h1').should('have.attr', 'aria-level', '1');
    });

    it('should announce dynamic content changes', () => {
      cy.visit('/');
      cy.waitForApp();
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Check live region for chat messages
      cy.get('[data-testid="chat-messages"]').should('have.attr', 'aria-live', 'polite');
      
      // Send message and check announcement
      cy.mockChatResponse('AI response for screen reader test');
      cy.sendChatMessage('Test message');
      cy.wait('@chatRequest');
      
      cy.get('[data-testid="latest-message"]').should('have.attr', 'aria-label');
    });

    it('should provide status updates for loading states', () => {
      cy.visit('/');
      cy.waitForApp();
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Check loading state announcements
      cy.simulateSlowNetwork();
      cy.sendChatMessage('Slow message');
      
      cy.get('[data-testid="loading-status"]').should('have.attr', 'aria-live', 'assertive');
      cy.get('[data-testid="loading-status"]').should('contain', 'Sending message');
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should meet WCAG AA color contrast requirements', () => {
      cy.visit('/');
      cy.waitForApp();
      
      cy.injectAxe();
      cy.checkA11y(null, {
        rules: {
          'color-contrast': { enabled: true }
        }
      });
    });

    it('should support high contrast mode', () => {
      // Simulate high contrast mode
      cy.visit('/', {
        onBeforeLoad: (win) => {
          win.matchMedia = cy.stub().returns({
            matches: true,
            media: '(prefers-contrast: high)',
            addEventListener: cy.stub(),
            removeEventListener: cy.stub()
          });
        }
      });
      
      cy.waitForApp();
      
      // Check high contrast styles are applied
      cy.get('[data-testid="app-container"]').should('have.class', 'high-contrast');
    });

    it('should support reduced motion preferences', () => {
      // Simulate reduced motion preference
      cy.visit('/', {
        onBeforeLoad: (win) => {
          win.matchMedia = cy.stub().returns({
            matches: true,
            media: '(prefers-reduced-motion: reduce)',
            addEventListener: cy.stub(),
            removeEventListener: cy.stub()
          });
        }
      });
      
      cy.waitForApp();
      
      // Check animations are disabled
      cy.get('[data-testid="animated-element"]').should('have.class', 'no-animation');
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly in modals', () => {
      cy.visit('/');
      cy.waitForApp();
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Trigger modal
      cy.mockTierLimitExceeded();
      cy.sendChatMessage('Trigger modal');
      cy.wait('@limitExceeded');
      
      // Focus should move to modal
      cy.get('[data-testid="paywall-modal"]').should('be.visible');
      cy.focused().should('be.within', '[data-testid="paywall-modal"]');
      
      // Close modal and check focus return
      cy.get('[data-testid="close-modal"]').click();
      cy.focused().should('have.attr', 'data-testid', 'chat-input');
    });

    it('should trap focus within modals', () => {
      cy.visit('/');
      cy.waitForApp();
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Open modal
      cy.mockTierLimitExceeded();
      cy.sendChatMessage('Trigger modal');
      cy.wait('@limitExceeded');
      
      // Test focus trap
      cy.get('[data-testid="first-focusable"]').focus();
      cy.get('[data-testid="first-focusable"]').tab({ shift: true });
      cy.focused().should('have.attr', 'data-testid', 'last-focusable');
      
      cy.get('[data-testid="last-focusable"]').tab();
      cy.focused().should('have.attr', 'data-testid', 'first-focusable');
    });
  });

  describe('Error State Accessibility', () => {
    it('should announce errors to screen readers', () => {
      cy.visit('/');
      cy.waitForApp();
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Trigger error
      cy.simulateOffline();
      cy.sendChatMessage('This will fail');
      
      // Check error announcement
      cy.get('[data-testid="error-banner"]').should('have.attr', 'role', 'alert');
      cy.get('[data-testid="error-banner"]').should('have.attr', 'aria-live', 'assertive');
    });

    it('should provide clear error descriptions', () => {
      cy.visit('/');
      cy.waitForApp();
      cy.get('[data-testid="get-started-button"]').click();
      cy.get('[data-testid="sign-in-button"]').click();
      
      // Trigger form validation error
      cy.get('[data-testid="login-button"]').click();
      
      // Check error descriptions
      cy.get('[data-testid="email-error"]').should('have.attr', 'role', 'alert');
      cy.get('[data-testid="email-input"]').should('have.attr', 'aria-describedby');
      cy.get('[data-testid="email-input"]').should('have.attr', 'aria-invalid', 'true');
    });
  });

  describe('Mobile Accessibility', () => {
    it('should support touch accessibility features', () => {
      cy.viewport('iphone-x');
      cy.visit('/');
      cy.waitForApp();
      
      // Check touch target sizes (minimum 44px)
      cy.get('[data-testid="get-started-button"]').should('have.css', 'min-height', '44px');
      cy.get('[data-testid="get-started-button"]').should('have.css', 'min-width', '44px');
    });

    it('should support voice control', () => {
      cy.visit('/');
      cy.waitForApp();
      
      // Check voice control labels
      cy.get('[data-testid="get-started-button"]').should('have.attr', 'aria-label');
      cy.get('[data-testid="get-started-button"]').should('have.attr', 'data-voice-command');
    });
  });

  describe('Internationalization Accessibility', () => {
    it('should support RTL languages', () => {
      cy.visit('/', {
        onBeforeLoad: (win) => {
          win.document.documentElement.setAttribute('dir', 'rtl');
          win.document.documentElement.setAttribute('lang', 'ar');
        }
      });
      
      cy.waitForApp();
      
      // Check RTL layout
      cy.get('[data-testid="app-container"]').should('have.attr', 'dir', 'rtl');
      cy.get('[data-testid="navigation-menu"]').should('have.css', 'direction', 'rtl');
    });

    it('should provide proper language attributes', () => {
      cy.visit('/');
      cy.waitForApp();
      
      // Check language attributes
      cy.get('html').should('have.attr', 'lang');
      cy.get('[data-testid="main-content"]').should('have.attr', 'lang', 'en');
    });
  });
});