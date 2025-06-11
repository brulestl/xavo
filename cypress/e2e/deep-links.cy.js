describe('Deep Link Routing Tests', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('xavo:// Deep Link Scheme', () => {
    it('should handle chat deep link with ID', () => {
      // Test xavo://chat?id=123
      cy.visitDeepLink('xavo://chat?id=123');
      
      // Should navigate to specific chat
      cy.get('[data-testid="chat-screen"]').should('be.visible');
      cy.get('[data-testid="chat-id"]').should('contain', '123');
    });

    it('should handle chat deep link without ID', () => {
      // Test xavo://chat
      cy.visitDeepLink('xavo://chat');
      
      // Should navigate to new chat
      cy.get('[data-testid="chat-screen"]').should('be.visible');
      cy.get('[data-testid="new-chat-indicator"]').should('be.visible');
    });

    it('should handle profile deep link', () => {
      // Test xavo://profile
      cy.visitDeepLink('xavo://profile');
      
      // Should navigate to profile/account screen
      cy.get('[data-testid="account-screen"]').should('be.visible');
    });

    it('should handle upgrade deep link', () => {
      // Test xavo://upgrade
      cy.visitDeepLink('xavo://upgrade');
      
      // Should navigate to paywall/upgrade screen
      cy.get('[data-testid="paywall-screen"]').should('be.visible');
      cy.get('[data-testid="upgrade-options"]').should('be.visible');
    });

    it('should handle settings deep link', () => {
      // Test xavo://settings
      cy.visitDeepLink('xavo://settings');
      
      // Should navigate to settings screen
      cy.get('[data-testid="settings-screen"]').should('be.visible');
    });
  });

  describe('Deep Link Authentication', () => {
    it('should redirect to login for authenticated-only deep links', () => {
      // Test deep link that requires authentication
      cy.visitDeepLink('xavo://profile');
      
      // Should redirect to auth screen if not logged in
      cy.get('[data-testid="auth-required-modal"]').should('be.visible');
      cy.get('[data-testid="login-to-continue"]').should('exist');
    });

    it('should preserve deep link destination after login', () => {
      // Visit deep link while not authenticated
      cy.visitDeepLink('xavo://chat?id=456');
      
      // Complete authentication
      cy.get('[data-testid="login-to-continue"]').click();
      cy.loginWithCredentials('test@example.com', 'password123');
      
      // Should navigate to original deep link destination
      cy.get('[data-testid="chat-screen"]').should('be.visible');
      cy.get('[data-testid="chat-id"]').should('contain', '456');
    });
  });

  describe('Deep Link Error Handling', () => {
    it('should handle invalid deep link gracefully', () => {
      // Test invalid deep link
      cy.visitDeepLink('xavo://invalid-route');
      
      // Should show error or redirect to home
      cy.get('[data-testid="deep-link-error"]').should('be.visible');
      cy.get('[data-testid="return-home-button"]').should('exist');
    });

    it('should handle malformed deep link parameters', () => {
      // Test malformed parameters
      cy.visitDeepLink('xavo://chat?id=invalid-id&malformed=param');
      
      // Should handle gracefully and show appropriate error
      cy.get('[data-testid="invalid-chat-error"]').should('be.visible');
    });

    it('should handle non-existent chat ID', () => {
      // Test non-existent chat ID
      cy.visitDeepLink('xavo://chat?id=999999');
      
      // Should show chat not found error
      cy.get('[data-testid="chat-not-found"]').should('be.visible');
      cy.get('[data-testid="start-new-chat"]').should('exist');
    });
  });

  describe('Deep Link Analytics', () => {
    it('should track deep link usage', () => {
      // Mock analytics tracking
      cy.window().then((win) => {
        win.analytics = { track: cy.stub().as('analyticsTrack') };
      });
      
      cy.visitDeepLink('xavo://chat?id=123');
      
      // Should track deep link usage
      cy.get('@analyticsTrack').should('have.been.calledWith', 'deep_link_used', {
        scheme: 'xavo',
        path: 'chat',
        parameters: { id: '123' }
      });
    });
  });

  describe('Cross-Platform Deep Links', () => {
    it('should handle web fallback for mobile deep links', () => {
      // Test web fallback behavior
      cy.visit('/?fallback=xavo://chat?id=123');
      
      // Should handle web fallback appropriately
      cy.get('[data-testid="mobile-app-prompt"]').should('be.visible');
      cy.get('[data-testid="continue-in-web"]').click();
      
      // Should navigate to web equivalent
      cy.get('[data-testid="chat-screen"]').should('be.visible');
    });

    it('should provide app store links for uninstalled app', () => {
      // Test app store redirect
      cy.visit('/?install=true&deeplink=xavo://chat');
      
      // Should show app installation options
      cy.get('[data-testid="install-app-modal"]').should('be.visible');
      cy.get('[data-testid="app-store-link"]').should('exist');
      cy.get('[data-testid="play-store-link"]').should('exist');
    });
  });

  describe('Deep Link Security', () => {
    it('should validate deep link parameters for security', () => {
      // Test potential XSS in parameters
      cy.visitDeepLink('xavo://chat?id=<script>alert("xss")</script>');
      
      // Should sanitize parameters
      cy.get('[data-testid="chat-id"]').should('not.contain', '<script>');
      cy.get('[data-testid="sanitized-id"]').should('exist');
    });

    it('should prevent unauthorized access via deep links', () => {
      // Test accessing restricted content via deep link
      cy.visitDeepLink('xavo://admin/dashboard');
      
      // Should show unauthorized error
      cy.get('[data-testid="unauthorized-access"]').should('be.visible');
      cy.get('[data-testid="login-required"]').should('exist');
    });
  });

  describe('Deep Link Performance', () => {
    it('should load deep link destinations quickly', () => {
      const startTime = Date.now();
      
      cy.visitDeepLink('xavo://chat?id=123');
      cy.get('[data-testid="chat-screen"]').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(3000); // Should load within 3 seconds
      });
    });
  });
});