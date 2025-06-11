// Custom commands for Corporate Influence Coach testing

// Deep link testing command
Cypress.Commands.add('visitDeepLink', (path) => {
  // For web testing, we'll simulate deep link behavior
  cy.visit(`/?deeplink=${encodeURIComponent(path)}`);
});

// User tier management
Cypress.Commands.add('setUserTier', (tier) => {
  cy.window().then((win) => {
    win.localStorage.setItem('userTier', tier);
  });
});

// Mock API responses for testing
Cypress.Commands.add('mockChatResponse', (response) => {
  cy.intercept('POST', '**/api/v1/chat', {
    statusCode: 200,
    body: {
      response: response,
      usage: { tokens: 100 },
      tier: 'guest'
    }
  }).as('chatRequest');
});

// Mock tier limit exceeded
Cypress.Commands.add('mockTierLimitExceeded', () => {
  cy.intercept('POST', '**/api/v1/chat', {
    statusCode: 429,
    body: {
      error: 'Daily query limit exceeded',
      limit: 3,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }
  }).as('limitExceeded');
});

// Authentication helpers
Cypress.Commands.add('signUp', (email, password) => {
  cy.get('[data-testid="signup-tab"]').click();
  cy.get('[data-testid="email-input"]').type(email);
  cy.get('[data-testid="password-input"]').type(password);
  cy.get('[data-testid="confirm-password-input"]').type(password);
  cy.get('[data-testid="signup-button"]').click();
});

// Onboarding flow
Cypress.Commands.add('completeOnboarding', () => {
  // Skip intro screens
  cy.get('[data-testid="skip-intro"]').click();
  
  // Select user type (if applicable)
  cy.get('[data-testid="user-type-professional"]').click();
  cy.get('[data-testid="continue-button"]').click();
  
  // Complete onboarding
  cy.get('[data-testid="start-coaching"]').click();
});

// Payment flow simulation
Cypress.Commands.add('simulateUpgrade', () => {
  cy.get('[data-testid="upgrade-to-power"]').click();
  cy.get('[data-testid="payment-method-card"]').click();
  
  // Mock successful payment
  cy.intercept('POST', '**/api/v1/payments/process', {
    statusCode: 200,
    body: { success: true, tier: 'power' }
  }).as('paymentSuccess');
  
  cy.get('[data-testid="confirm-payment"]').click();
  cy.wait('@paymentSuccess');
});

// Error banner testing
Cypress.Commands.add('checkErrorBanner', (message) => {
  cy.get('[data-testid="error-banner"]').should('be.visible');
  cy.get('[data-testid="error-message"]').should('contain', message);
});

// Network simulation
Cypress.Commands.add('simulateOffline', () => {
  cy.intercept('**', { forceNetworkError: true }).as('offline');
});

Cypress.Commands.add('simulateSlowNetwork', () => {
  cy.intercept('**', (req) => {
    req.reply((res) => {
      res.delay(3000); // 3 second delay
    });
  }).as('slowNetwork');
});