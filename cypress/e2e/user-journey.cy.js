describe('Corporate Influence Coach - Complete User Journey', () => {
  beforeEach(() => {
    // Clear any existing data
    cy.clearLocalStorage();
    cy.clearCookies();
    
    // Visit the app
    cy.visit('/');
    cy.waitForApp();
  });

  describe('Guest User Flow', () => {
    it('should complete guest onboarding and reach chat', () => {
      // Start as guest
      cy.get('[data-testid="continue-as-guest"]').click();
      
      // Complete onboarding
      cy.completeOnboarding();
      
      // Should reach chat screen
      cy.get('[data-testid="chat-screen"]').should('be.visible');
      cy.checkTierLimits('guest');
    });

    it('should show paywall after 3 queries', () => {
      // Start as guest
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Mock chat responses
      cy.mockChatResponse('Great question! Here\'s my advice...');
      
      // Send 3 messages (guest limit)
      for (let i = 1; i <= 3; i++) {
        cy.sendChatMessage(`Test message ${i}`);
        cy.wait('@chatRequest');
        cy.get('[data-testid="query-count"]').should('contain', `${4-i}`);
      }
      
      // 4th message should trigger paywall
      cy.mockTierLimitExceeded();
      cy.sendChatMessage('This should trigger paywall');
      cy.wait('@limitExceeded');
      
      // Check paywall appears
      cy.checkPaywall();
    });
  });

  describe('Sign-up Flow', () => {
    it('should complete full sign-up to upgrade journey', () => {
      const testEmail = `test-${Date.now()}@example.com`;
      const testPassword = 'TestPassword123!';
      
      // Navigate to sign-up
      cy.get('[data-testid="get-started-button"]').click();
      cy.get('[data-testid="create-account-button"]').click();
      
      // Complete sign-up
      cy.signUp(testEmail, testPassword);
      
      // Should redirect to onboarding
      cy.get('[data-testid="onboarding-welcome"]').should('be.visible');
      cy.completeOnboarding();
      
      // Should reach chat with Essential tier
      cy.get('[data-testid="chat-screen"]').should('be.visible');
      cy.checkTierLimits('essential');
      
      // Test chat functionality
      cy.mockChatResponse('Welcome! I\'m here to help with your workplace challenges.');
      cy.sendChatMessage('How do I handle a difficult colleague?');
      cy.wait('@chatRequest');
      
      // Should see response
      cy.get('[data-testid="chat-message"]').should('contain', 'Welcome! I\'m here to help');
      
      // Exhaust Essential tier limits
      cy.mockChatResponse('Here\'s another helpful response...');
      cy.sendChatMessage('Follow-up question 1');
      cy.wait('@chatRequest');
      
      cy.sendChatMessage('Follow-up question 2');
      cy.wait('@chatRequest');
      
      // Next message should trigger paywall
      cy.mockTierLimitExceeded();
      cy.sendChatMessage('This should show upgrade prompt');
      cy.wait('@limitExceeded');
      
      // Check paywall for Power tier upgrade
      cy.checkPaywall();
      cy.get('[data-testid="power-tier-benefits"]').should('be.visible');
      
      // Simulate upgrade process
      cy.simulateUpgrade();
      
      // Should now have Power tier access
      cy.get('[data-testid="power-tier-badge"]').should('be.visible');
      cy.checkTierLimits('power');
      
      // Test unlimited access
      cy.mockChatResponse('You now have unlimited access!');
      cy.sendChatMessage('Test unlimited access');
      cy.wait('@chatRequest');
      
      cy.get('[data-testid="unlimited-badge"]').should('be.visible');
    });
  });

  describe('Login Flow', () => {
    it('should login existing user and maintain tier status', () => {
      // Navigate to login
      cy.get('[data-testid="get-started-button"]').click();
      cy.get('[data-testid="sign-in-button"]').click();
      
      // Login with test credentials
      cy.loginWithCredentials('existing-user@example.com', 'password123');
      
      // Should skip onboarding for existing user
      cy.get('[data-testid="chat-screen"]').should('be.visible');
      
      // Check user tier is maintained
      cy.get('[data-testid="user-tier"]').should('exist');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Simulate network error
      cy.simulateOffline();
      cy.sendChatMessage('This should fail');
      
      // Should show error banner
      cy.checkErrorBanner('Network error. Please check your connection.');
    });

    it('should handle slow network with loading states', () => {
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Simulate slow network
      cy.simulateSlowNetwork();
      cy.sendChatMessage('This should show loading');
      
      // Should show loading indicator
      cy.get('[data-testid="message-loading"]').should('be.visible');
      cy.get('[data-testid="message-loading"]', { timeout: 5000 }).should('not.exist');
    });
  });

  describe('Accessibility', () => {
    it('should pass accessibility audit on main screens', () => {
      // Test welcome screen
      cy.checkA11y();
      
      // Test onboarding
      cy.loginAsGuest();
      cy.checkA11y();
      
      // Test chat screen
      cy.completeOnboarding();
      cy.checkA11y();
      
      // Test paywall
      cy.mockTierLimitExceeded();
      cy.sendChatMessage('Trigger paywall');
      cy.wait('@limitExceeded');
      cy.checkA11y();
    });
  });
});