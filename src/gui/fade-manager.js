/**
 * @module gui/fade-manager
 * @description Auto-fade manager for UI elements.
 * Elements fade to opacity 0 after a period of inactivity,
 * and reappear when hovering over their area.
 */

/**
 * Default fade delay in milliseconds
 * @type {number}
 */
const DEFAULT_FADE_DELAY = 2000; // 2 seconds

/**
 * CSS transition duration in milliseconds
 * @type {number}
 */
const TRANSITION_DURATION = 300;

/**
 * Padding around elements for hover detection
 * @type {number}
 */
const HOVER_PADDING = 30;

/**
 * Active fade controllers
 * @type {Map<string, Object>}
 */
const activeControllers = new Map();

/**
 * Track if fade manager has been initialized with global styles
 * @type {boolean}
 */
let stylesInitialized = false;

/**
 * Track if mouse move listener is active
 * @type {boolean}
 */
let mouseListenerActive = false;

/**
 * Initialize global CSS styles for fade behavior
 */
function initStyles() {
  if (stylesInitialized) return;

  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    .fade-ui {
      transition: opacity ${TRANSITION_DURATION}ms ease-in-out;
      opacity: 1;
    }
    
    .fade-ui.fade-hidden {
      opacity: 0;
      pointer-events: none;
    }
    
    .fade-ui.fade-visible {
      opacity: 1;
      pointer-events: auto;
    }
  `;
  document.head.appendChild(styleSheet);
  stylesInitialized = true;
}

/**
 * Check if mouse is over an element (with padding)
 * @param {HTMLElement} element - The element to check
 * @param {number} clientX - Mouse X position
 * @param {number} clientY - Mouse Y position
 * @returns {boolean} True if mouse is over the element area
 */
function isMouseOverElement(element, clientX, clientY) {
  const rect = element.getBoundingClientRect();
  return (
    clientX >= rect.left - HOVER_PADDING &&
    clientX <= rect.right + HOVER_PADDING &&
    clientY >= rect.top - HOVER_PADDING &&
    clientY <= rect.bottom + HOVER_PADDING
  );
}

/**
 * Global mouse move handler to check all faded elements
 */
function handleGlobalMouseMove(e) {
  activeControllers.forEach((controller, key) => {
    if (controller.isFaded) {
      if (isMouseOverElement(controller.element, e.clientX, e.clientY)) {
        controller.showElement();
        controller.isHovering = true;
      }
    } else if (controller.isHovering) {
      if (!isMouseOverElement(controller.element, e.clientX, e.clientY)) {
        controller.isHovering = false;
        controller.startFadeTimer();
      }
    }
  });
}

/**
 * Start global mouse move listener
 */
function startMouseListener() {
  if (!mouseListenerActive) {
    document.addEventListener('mousemove', handleGlobalMouseMove);
    mouseListenerActive = true;
  }
}

/**
 * Stop global mouse move listener if no controllers active
 */
function stopMouseListener() {
  if (mouseListenerActive && activeControllers.size === 0) {
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    mouseListenerActive = false;
  }
}

/**
 * Apply fade behavior to an element
 * @param {HTMLElement} element - The element to apply fade behavior to
 * @param {number} [fadeDelay=10000] - Time in ms before fading (default 10s)
 * @returns {Function} Cleanup function to remove fade behavior
 */
export function applyFadeBehavior(element, fadeDelay = DEFAULT_FADE_DELAY) {
  if (!element) return () => {};

  initStyles();
  startMouseListener();

  // Add fade class
  element.classList.add('fade-ui');
  element.classList.add('fade-visible');

  let fadeTimer = null;
  
  const controller = {
    element: element,
    fadeTimer: null,
    isHovering: false,
    isFaded: false,
    
    showElement: function() {
      clearTimeout(this.fadeTimer);
      this.isFaded = false;
      element.classList.remove('fade-hidden');
      element.classList.add('fade-visible');
    },
    
    hideElement: function() {
      if (this.isHovering) return;
      this.isFaded = true;
      element.classList.remove('fade-visible');
      element.classList.add('fade-hidden');
    },
    
    startFadeTimer: function() {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = setTimeout(() => {
        if (!this.isHovering) {
          this.hideElement();
        }
      }, fadeDelay);
    }
  };

  const key = element.id || `fade-${Date.now()}-${Math.random()}`;
  activeControllers.set(key, controller);

  // Add direct event listeners for immediate response
  element.addEventListener('mouseenter', () => {
    controller.isHovering = true;
    controller.showElement();
  });

  element.addEventListener('mouseleave', () => {
    controller.isHovering = false;
    controller.startFadeTimer();
  });

  // Start initial timer
  controller.startFadeTimer();

  // Return cleanup function
  return function cleanup() {
    clearTimeout(controller.fadeTimer);
    activeControllers.delete(key);
    element.removeEventListener('mouseenter', () => {});
    element.removeEventListener('mouseleave', () => {});
    element.classList.remove('fade-ui', 'fade-visible', 'fade-hidden');
    stopMouseListener();
  };
}

/**
 * Apply fade behavior to multiple elements
 * @param {HTMLElement[]} elements - Array of elements to apply fade behavior to
 * @param {number} [fadeDelay=10000] - Time in ms before fading
 * @returns {Function} Cleanup function to remove all fade behaviors
 */
export function applyFadeToElements(elements, fadeDelay = DEFAULT_FADE_DELAY) {
  const cleanupFunctions = elements.map(el => applyFadeBehavior(el, fadeDelay));
  return function cleanupAll() {
    cleanupFunctions.forEach(fn => fn());
  };
}

/**
 * Reset fade timer for an element (keeps it visible)
 * @param {HTMLElement} element - The element to reset
 */
export function resetFadeTimer(element) {
  if (!element) return;
  
  // Find the controller for this element
  for (const [key, controller] of activeControllers) {
    if (controller.element === element) {
      controller.showElement();
      controller.startFadeTimer();
      break;
    }
  }
}

/**
 * Clear all active fade timers
 */
export function clearAllFadeTimers() {
  activeControllers.forEach(controller => {
    clearTimeout(controller.fadeTimer);
  });
}

/**
 * Remove fade behavior from all elements with the fade-ui class
 */
export function removeAllFadeBehaviors() {
  // Show all elements first
  activeControllers.forEach(controller => {
    clearTimeout(controller.fadeTimer);
    controller.element.classList.remove('fade-ui', 'fade-visible', 'fade-hidden');
  });
  
  activeControllers.clear();
  
  if (mouseListenerActive) {
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    mouseListenerActive = false;
  }
}

/**
 * Apply fade behavior to the settings toggle button
 * @param {number} [fadeDelay=10000] - Time in ms before fading
 * @returns {Function} Cleanup function
 */
export function applyFadeToSettingsButton(fadeDelay = DEFAULT_FADE_DELAY) {
  const toggleBtn = document.getElementById('toggle-controls');
  if (toggleBtn) {
    return applyFadeBehavior(toggleBtn, fadeDelay);
  }
  return () => {};
}
