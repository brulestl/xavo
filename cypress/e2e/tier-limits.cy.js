describe('Tier Limits & Error Banner Tests', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.visit('/');
    cy.waitForApp();
  });

  describe('Guest Tier Limits', () => {
    beforeEach(() => {
      cy.loginAsGuest();
      cy.completeOnboarding();
    });

    it('should display correct daily limit for guest users', () => {
      cy.get('[data-testid="tier-badge"]').should('contain', 'Guest');
      cy.get('[data-testid="daily-limit"]').should('contain', '3 queries per day');
      cy.get('[data-testid="queries-remaining"]').should('contain', '3');
    });

    it('should decrement query count after each message', () => {
      cy.mockChatResponse('Here\'s my advice...');
      
      // First query
      cy.sendChatMessage('First question');
      cy.wait('@chatRequest');
      cy.get('[data-testid="queries-remaining"]').should('contain', '2');
      
      // Second query
      cy.sendChatMessage('Second question');
      cy.wait('@chatRequest');
      cy.get('[data-testid="queries-remaining"]').should('contain', '1');
      
      // Third query
      cy.sendChatMessage('Third question');
      cy.wait('@chatRequest');
      cy.get('[data-testid="queries-remaining"]').should('contain', '0');
    });

    it('should show paywall after exceeding daily limit', () => {
      cy.mockChatResponse('Response');
      
      // Use up all 3 queries
      for (let i = 1; i <= 3; i++) {
        cy.sendChatMessage(`Question ${i}`);
        cy.wait('@chatRequest');
      }
      
      // 4th query should trigger limit
      cy.mockTierLimitExceeded();
      cy.sendChatMessage('This should be blocked');
      cy.wait('@limitExceeded');
      
      // Should show limit exceeded error
      cy.checkErrorBanner('Daily query limit exceeded');
      cy.get('[data-testid="upgrade-prompt"]').should('be.visible');
      cy.get('[data-testid="reset-time"]').should('exist');
    });

    it('should disable input after limit exceeded', () => {
      // Exhaust limit
      cy.mockTierLimitExceeded();
      cy.setUserTier('guest-exceeded');
      
      cy.get('[data-testid="chat-input"]').should('be.disabled');
      cy.get('[data-testid="send-button"]').should('be.disabled');
      cy.get('[data-testid="limit-exceeded-message"]').should('be.visible');
    });
  });

  describe('Essential Tier Limits', () => {
    beforeEach(() => {
      // Sign up for Essential tier
      cy.get('[data-testid="get-started-button"]').click();
      cy.get('[data-testid="create-account-button"]').click();
      cy.signUp(`test-${Date.now()}@example.com`, 'TestPassword123!');
      cy.completeOnboarding();
    });

    it('should display correct limits for Essential tier', () => {
      cy.get('[data-testid="tier-badge"]').should('contain', 'Essential');
      cy.get('[data-testid="daily-limit"]').should('contain', '3 queries per day');
      cy.get('[data-testid="tier-features"]').should('contain', 'Priority support');
    });

    it('should show upgrade options when limit exceeded', () => {
      // Exhaust Essential limit
      cy.mockChatResponse('Response');
      for (let i = 1; i <= 3; i++) {
        cy.sendChatMessage(`Question ${i}`);
        cy.wait('@chatRequest');
      }
      
      cy.mockTierLimitExceeded();
      cy.sendChatMessage('Trigger upgrade prompt');
      cy.wait('@limitExceeded');
      
      // Should show Power tier upgrade options
      cy.get('[data-testid="upgrade-to-power"]').should('be.visible');
      cy.get('[data-testid="power-tier-benefits"]').should('contain', 'Unlimited queries');
      cy.get('[data-testid="pricing-display"]').should('contain', '$30/month');
    });
  });

  describe('Power Tier (Unlimited)', () => {
    beforeEach(() => {
      // Mock Power tier user
      cy.setUserTier('power');
      cy.visit('/');
      cy.waitForApp();
    });

    it('should display unlimited access for Power tier', () => {
      cy.get('[data-testid="tier-badge"]').should('contain', 'Power Strategist');
      cy.get('[data-testid="unlimited-badge"]').should('be.visible');
      cy.get('[data-testid="queries-remaining"]').should('contain', 'Unlimited');
    });

    it('should not show query limits for Power tier', () => {
      cy.mockChatResponse('Unlimited response');
      
      // Send multiple messages without limits
      for (let i = 1; i <= 10; i++) {
        cy.sendChatMessage(`Unlimited question ${i}`);
        cy.wait('@chatRequest');
        cy.get('[data-testid="unlimited-badge"]').should('be.visible');
      }
      
      // Should never show limit exceeded
      cy.get('[data-testid="limit-exceeded-message"]').should('not.exist');
    });
  });

  describe('Error Banner Functionality', () => {
    beforeEach(() => {
      cy.loginAsGuest();
      cy.completeOnboarding();
    });

    it('should show network error banner', () => {
      cy.simulateOffline();
      cy.sendChatMessage('This will fail');
      
      cy.checkErrorBanner('Network error. Please check your connection.');
      cy.get('[data-testid="retry-button"]').should('exist');
      cy.get('[data-testid="error-icon"]').should('be.visible');
    });

    it('should show server error banner', () => {
      cy.intercept('POST', '**/api/v1/chat', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('serverError');
      
      cy.sendChatMessage('This will cause server error');
      cy.wait('@serverError');
      
      cy.checkErrorBanner('Server error. Please try again later.');
    });

    it('should show authentication error banner', () => {
      cy.intercept('POST', '**/api/v1/chat', {
        statusCode: 401,
        body: { error: 'Authentication required' }
      }).as('authError');
      
      cy.sendChatMessage('This will cause auth error');
      cy.wait('@authError');
      
      cy.checkErrorBanner('Please log in to continue');
      cy.get('[data-testid="login-button"]').should('exist');
    });

    it('should auto-dismiss error banner after timeout', () => {
      cy.simulateOffline();
      cy.sendChatMessage('This will show error');
      
      cy.checkErrorBanner('Network error');
      
      // Should auto-dismiss after 5 seconds
      cy.get('[data-testid="error-banner"]', { timeout: 6000 }).should('not.exist');
    });

    it('should allow manual dismissal of error banner', () => {
      cy.simulateOffline();
      cy.sendChatMessage('This will show error');
      
      cy.checkErrorBanner('Network error');
      cy.get('[data-testid="dismiss-error"]').click();
      
      cy.get('[data-testid="error-banner"]').should('not.exist');
    });

    it('should show retry functionality', () => {
      cy.simulateOffline();
      cy.sendChatMessage('This will fail initially');
      
      cy.checkErrorBanner('Network error');
      
      // Restore network and retry
      cy.mockChatResponse('Success after retry');
      cy.get('[data-testid="retry-button"]').click();
      cy.wait('@chatRequest');
      
      cy.get('[data-testid="error-banner"]').should('not.exist');
      cy.get('[data-testid="chat-message"]').should('contain', 'Success after retry');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      cy.loginAsGuest();
      cy.completeOnboarding();
    });

    it('should show rate limit error for rapid requests', () => {
      cy.intercept('POST', '**/api/v1/chat', {
        statusCode: 429,
        body: { 
          error: 'Rate limit exceeded',
          retryAfter: 60
        }
      }).as('rateLimited');
      
      // Send rapid requests
      cy.sendChatMessage('Rapid request 1');
      cy.sendChatMessage('Rapid request 2');
      cy.wait('@rateLimited');
      
      cy.checkErrorBanner('Too many requests. Please wait 60 seconds.');
      cy.get('[data-testid="countdown-timer"]').should('exist');
    });

    it('should show countdown timer for rate limit', () => {
      cy.intercept('POST', '**/api/v1/chat', {
        statusCode: 429,
        body: { 
          error: 'Rate limit exceeded',
          retryAfter: 5
        }
      }).as('rateLimited');
      
      cy.sendChatMessage('Rate limited request');
      cy.wait('@rateLimited');
      
      cy.get('[data-testid="countdown-timer"]').should('contain', '5');
      
      // Should count down
      cy.get('[data-testid="countdown-timer"]', { timeout: 2000 }).should('contain', '3');
    });
  });

  describe('Tier Upgrade Flow', () => {
    it('should handle successful tier upgrade', () => {
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Trigger upgrade flow
      cy.mockTierLimitExceeded();
      cy.sendChatMessage('Trigger upgrade');
      cy.wait('@limitExceeded');
      
      cy.get('[data-testid="upgrade-to-power"]').click();
      cy.simulateUpgrade();
      
      // Should update tier display
      cy.get('[data-testid="tier-badge"]').should('contain', 'Power Strategist');
      cy.get('[data-testid="unlimited-badge"]').should('be.visible');
      
      // Should remove previous limits
      cy.get('[data-testid="limit-exceeded-message"]').should('not.exist');
      cy.get('[data-testid="chat-input"]').should('not.be.disabled');
    });

    it('should handle failed tier upgrade', () => {
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Mock failed payment
      cy.intercept('POST', '**/api/v1/payments/process', {
        statusCode: 400,
        body: { error: 'Payment failed' }
      }).as('paymentFailed');
      
      cy.mockTierLimitExceeded();
      cy.sendChatMessage('Trigger upgrade');
      cy.wait('@limitExceeded');
      
      cy.get('[data-testid="upgrade-to-power"]').click();
      cy.get('[data-testid="confirm-payment"]').click();
      cy.wait('@paymentFailed');
      
      // Should show payment error
      cy.checkErrorBanner('Payment failed. Please try again.');
      cy.get('[data-testid="tier-badge"]').should('contain', 'Guest'); // Should remain Guest
    });
  });

  describe('Daily Reset Functionality', () => {
    it('should reset query count at midnight', () => {
      cy.loginAsGuest();
      cy.completeOnboarding();
      
      // Mock time to be near midnight
      cy.clock(new Date('2024-01-01T23:59:30').getTime());
      
      // Exhaust queries
      cy.mockTierLimitExceeded();
      cy.setUserTier('guest-exceeded');
      
      cy.get('[data-testid="queries-remaining"]').should('contain', '0');
      
      // Advance time past midnight
      cy.tick(60000); // 1 minute
      
      // Should reset queries
      cy.get('[data-testid="queries-remaining"]').should('contain', '3');
      cy.get('[data-testid="chat-input"]').should('not.be.disabled');
    });
  });
});