// Import commands.js using ES2015 syntax:
import './commands';

// Import React Native testing utilities
import { mount } from 'cypress/react';

// Extend Cypress namespace for component testing
Cypress.Commands.add('mount', mount);

// Component testing specific commands
Cypress.Commands.add('mountWithProviders', (component, options = {}) => {
  const { providers = [], ...mountOptions } = options;
  
  let wrappedComponent = component;
  
  // Wrap with providers if specified
  providers.forEach(Provider => {
    wrappedComponent = <Provider>{wrappedComponent}</Provider>;
  });
  
  return cy.mount(wrappedComponent, mountOptions);
});

// Theme testing helper
Cypress.Commands.add('mountWithTheme', (component, theme = 'light') => {
  return cy.mountWithProviders(component, {
    providers: [
      ({ children }) => (
        <ThemeProvider initialTheme={theme}>
          {children}
        </ThemeProvider>
      )
    ]
  });
});

// Auth context testing helper
Cypress.Commands.add('mountWithAuth', (component, authState = {}) => {
  return cy.mountWithProviders(component, {
    providers: [
      ({ children }) => (
        <AuthProvider initialState={authState}>
          {children}
        </AuthProvider>
      )
    ]
  });
});