/**
 * UI/Components/WinRegister/WinRegister.js
 *
 * In-game registration component
 *
 * @author Antigravity
 */

import KEYS from 'Controls/KeyEventHandler.js';
import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import htmlText from './WinRegister.html?raw';
import cssText from './WinRegister.css?raw';

/**
 * Create WinRegister component
 */
const WinRegister = new GUIComponent('WinRegister', cssText);

WinRegister.render = () => htmlText;

/**
 * Freeze mouse — modal dialog
 */
WinRegister.mouseMode = GUIComponent.MouseMode.FREEZE;

/**
 * Capture key events to allow typing in the inputs
 */
WinRegister.captureKeyEvents = true;

/**
 * State variable for gender
 */
let _gender = 'male';

/**
 * Initialize GUI
 */
WinRegister.init = function init() {
	// NOTE: No draggable() — this is a modal, it must stay fixed in place

	const root = this.getRoot();
	const overlay = root.querySelector('.register-overlay');
	const form = root.querySelector('.register-form');
	const closeBtn = root.querySelector('.btn-close');
	const genderBtns = root.querySelectorAll('.gender-btn');
	const inputs = root.querySelectorAll('input');

	// State reset
	_gender = 'male';

	// Close on close button click
	if (closeBtn) {
		closeBtn.addEventListener('click', () => this.remove());
	}

	// Close when clicking the backdrop overlay (but not the box itself)
	if (overlay) {
		overlay.addEventListener('mousedown', (event) => {
			if (event.target === overlay) {
				this.remove();
				event.stopImmediatePropagation();
			}
		});
	}

	// Block mousedown on input elements so selection works properly
	inputs.forEach(input => {
		input.addEventListener('mousedown', (event) => {
			input.focus();
			event.stopImmediatePropagation();
		});
	});

	// Gender selection toggles
	genderBtns.forEach(btn => {
		btn.addEventListener('click', (event) => {
			const selected = btn.dataset.gender;
			_gender = selected;

			genderBtns.forEach(b => b.classList.remove('active'));
			btn.classList.add('active');

			event.stopImmediatePropagation();
		});
	});

	// Form submit validation
	if (form) {
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			this.submit();
		});
	}
};

/**
 * Auto-focus username input on append, and force this window to the top
 */
WinRegister.onAppend = function onAppend() {
	// Set the host to cover the entire game canvas
	this._host.style.position = 'absolute';
	this._host.style.top = '0';
	this._host.style.left = '0';
	this._host.style.width = '100%';
	this._host.style.height = '100%';

	// Guarantee this is always the topmost element — higher than any UI component
	// (the framework uses z-index values starting at 50, so 99999 is always on top)
	this._host.style.zIndex = '99999';

	// Hide the WinLogin window so it can't intercept mouse events and re-raise its z-index
	const loginHost = document.getElementById('WinLogin')
		|| document.getElementById('WinLoginV2')
		|| document.getElementById('WinLoginV3');
	if (loginHost) {
		loginHost.dataset.regHidden = 'true';
		loginHost.style.display = 'none';
	}

	const root = this.getRoot();
	const userEl = root.querySelector('#reg-user');
	if (userEl) {
		userEl.focus();
	}
};

/**
 * Restore WinLogin visibility when registration modal is closed
 */
WinRegister.onRemove = function onRemove() {
	const loginHost = document.querySelector('[data-reg-hidden="true"]');
	if (loginHost) {
		loginHost.style.display = '';
		delete loginHost.dataset.regHidden;
	}
};


/**
 * Handle keys (Enter to submit, Escape to close)
 */
WinRegister.onKeyDown = function onKeyDown(event) {
	if (event.which === KEYS.ENTER) {
		this.submit();
		event.stopImmediatePropagation();
		return false;
	}
	if (event.which === KEYS.ESCAPE) {
		this.remove();
		event.stopImmediatePropagation();
		return false;
	}
	return true;
};

/**
 * Validate and submit
 */
WinRegister.submit = function submit() {
	const root = this.getRoot();
	const errorEl = root.querySelector('.error-msg');
	const userEl = root.querySelector('#reg-user');
	const passEl = root.querySelector('#reg-pass');
	const confirmEl = root.querySelector('#reg-confirm');

	const username = userEl ? userEl.value.trim() : '';
	const password = passEl ? passEl.value : '';
	const confirm = confirmEl ? confirmEl.value : '';

	// Reset error visibility
	if (errorEl) {
		errorEl.style.display = 'none';
		errorEl.textContent = '';
	}

	// 1. Check for empty fields
	if (!username || !password || !confirm) {
		showError('All fields are required.');
		return;
	}

	// 2. Validate Username Length & Chars (rAthena standard length is 4-23)
	if (username.length < 4 || username.length > 23) {
		showError('Username must be between 4 and 23 characters.');
		return;
	}

	if (!/^[a-zA-Z0-9_]+$/.test(username)) {
		showError('Username contains invalid characters. Use letters, numbers, and underscores.');
		return;
	}

	// 3. Validate Password Length
	if (password.length < 4 || password.length > 23) {
		showError('Password must be between 4 and 23 characters.');
		return;
	}

	// 4. Check if passwords match
	if (password !== confirm) {
		showError('Passwords do not match.');
		return;
	}

	// Validation passed! Clean up inputs and trigger onSubmitRequest
	this.remove();
	this.onSubmitRequest(username, password, _gender);

	function showError(msg) {
		if (errorEl) {
			errorEl.textContent = msg;
			errorEl.style.display = 'block';
		}
	}
};

/**
 * Placeholder submit callback
 */
WinRegister.onSubmitRequest = function onSubmitRequest() {};

/**
 * Add component to UIManager and export
 */
export default UIManager.addComponent(WinRegister);
