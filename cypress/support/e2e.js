// Import commands.js using ES2015 syntax:
import './commands';

// Import cypress-axe for accessibility testing
import 'cypress-axe';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing on uncaught exceptions
  // that might occur in React Native development
  return false;
});

// Custom commands for React Native testing
Cypress.Commands.add('waitForApp', () => {
  cy.get('[data-testid="app-loaded"]', { timeout: 15000 }).should('exist');
});

Cypress.Commands.add('loginAsGuest', () => {
  cy.get('[data-testid="guest-continue-button"]').click();
});

Cypress.Commands.add('loginWithCredentials', (email, password) => {
  cy.get('[data-testid="email-input"]').type(email);
  cy.get('[data-testid="password-input"]').type(password);
  cy.get('[data-testid="login-button"]').click();
});

Cypress.Commands.add('checkTierLimits', (tier) => {
  // Check daily query limits based on tier
  if (tier === 'guest' || tier === 'essential') {
    cy.get('[data-testid="query-count"]').should('contain', '3');
  } else if (tier === 'power') {
    cy.get('[data-testid="unlimited-badge"]').should('exist');
  }
});

Cypress.Commands.add('sendChatMessage', (message) => {
  cy.get('[data-testid="chat-input"]').type(message);
  cy.get('[data-testid="send-button"]').click();
});

Cypress.Commands.add('checkPaywall', () => {
  cy.get('[data-testid="paywall-modal"]').should('be.visible');
  cy.get('[data-testid="upgrade-button"]').should('exist');
});

// Accessibility testing helper
Cypress.Commands.add('checkA11y', (context, options) => {
  cy.injectAxe();
  cy.checkA11y(context, options);
});