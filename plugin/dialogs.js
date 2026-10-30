/*\
title: $:/plugins/BenSweaterVest/cloudflare-saver/dialogs.js
type: application/javascript
module-type: library

Small modal dialogs built directly in the DOM. The password dialog never
writes the password into a tiddler, so it cannot end up in a saved wiki.

\*/

'use strict';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text) {
    node.textContent = text;
  }
  return node;
}

/**
 * Build an accessible modal shell and return its parts.
 */
function shell(title, message) {
  const overlay = element('div', 'cfs-overlay');
  const dialog = element('div', 'cfs-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const heading = element('h2', 'cfs-dialog-title', title);
  heading.id = `cfs-dialog-${Date.now()}`;
  dialog.setAttribute('aria-labelledby', heading.id);
  dialog.appendChild(heading);
  if (message) {
    dialog.appendChild(element('p', 'cfs-dialog-message', message));
  }
  overlay.appendChild(dialog);

  const previousFocus = document.activeElement;
  const close = () => {
    overlay.remove();
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
  };
  return { overlay, dialog, close };
}

/**
 * Ask for the wiki password.
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {function(string): Promise<string|null>} options.submit - returns an
 *   error message to show, or null on success
 * @returns {Promise<boolean>} true when submit succeeded, false if cancelled
 */
exports.askPassword = function({ title, message, submit }) {
  return new Promise(resolve => {
    const { overlay, dialog, close } = shell(title, message);
    const form = element('form', 'cfs-dialog-form');

    // A username field (hidden) helps browser password managers.
    const user = element('input');
    user.type = 'text';
    user.name = 'username';
    user.autocomplete = 'username';
    user.value = 'wiki';
    user.hidden = true;

    const label = element('label', 'cfs-dialog-label', 'Wiki password');
    const input = element('input', 'cfs-dialog-input');
    input.type = 'password';
    input.name = 'password';
    input.autocomplete = 'current-password';
    input.required = true;
    label.appendChild(input);

    const error = element('p', 'cfs-dialog-error');
    error.setAttribute('role', 'alert');

    const buttons = element('div', 'cfs-dialog-buttons');
    const cancel = element('button', 'cfs-button', 'Cancel');
    cancel.type = 'button';
    const ok = element('button', 'cfs-button cfs-button-primary', 'Sign in');
    ok.type = 'submit';
    buttons.append(cancel, ok);

    form.append(user, label, error, buttons);
    dialog.appendChild(form);

    const finish = result => {
      close();
      resolve(result);
    };
    cancel.addEventListener('click', () => finish(false));
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        finish(false);
      }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      ok.disabled = true;
      error.textContent = '';
      const problem = await submit(input.value);
      ok.disabled = false;
      if (problem) {
        error.textContent = problem;
        input.select();
      } else {
        input.value = '';
        finish(true);
      }
    });

    document.body.appendChild(overlay);
    input.focus();
  });
};

/**
 * Ask the user to pick one of several actions.
 * @param {object} options - { title, message, buttons: [{ id, label, primary }] }
 * @returns {Promise<string|null>} the chosen button id, or null if dismissed
 */
exports.choose = function({ title, message, buttons }) {
  return new Promise(resolve => {
    const { overlay, dialog, close } = shell(title, message);
    const row = element('div', 'cfs-dialog-buttons');
    let primary = null;
    const finish = result => {
      close();
      resolve(result);
    };
    for (const spec of buttons) {
      const button = element('button', spec.primary ? 'cfs-button cfs-button-primary' : 'cfs-button', spec.label);
      button.type = 'button';
      button.addEventListener('click', () => finish(spec.id));
      if (spec.primary) {
        primary = button;
      }
      row.appendChild(button);
    }
    dialog.appendChild(row);
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        finish(null);
      }
    });
    document.body.appendChild(overlay);
    (primary || row.firstChild).focus();
  });
};
