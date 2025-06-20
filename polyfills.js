// Polyfill for useInsertionEffect to fix Android React Native compatibility
if (typeof global !== 'undefined') {
  if (!global.React) {
    global.React = require('react');
  }
  
  if (!global.React.useInsertionEffect) {
    global.React.useInsertionEffect = global.React.useLayoutEffect || global.React.useEffect;
  }
}

// Export for manual import if needed
export const polyfillUseInsertionEffect = () => {
  const React = require('react');
  if (!React.useInsertionEffect) {
    React.useInsertionEffect = React.useLayoutEffect || React.useEffect;
  }
}; 