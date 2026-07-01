/**
 * UI/Components/TipBox/TipBox.js
 *
 * Tip of the Day UI Component
 *
 * @author Antigravity
 */

import DB from 'DB/DBManager.js';
import Preferences from 'Core/Preferences.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './TipBox.html?raw';
import cssText from './TipBox.css?raw';

/**
 * Create TipBox Component
 */
const TipBox = new GUIComponent('TipBox', cssText);

TipBox.render = () => htmlText;

// Stored current indexes
let _currentTab = 'general'; // 'general' or 'guild'
let _generalIndex = 0;
let _guildIndex = 0;

/**
 * Preferences storage
 */
const _preferences = Preferences.get(
	'TipBox',
	{
		x: 200,
		y: 200,
		showAtStartup: true
	},
	1.0
);

/**
 * Initialize Component
 */
TipBox.init = function init() {
	const root = this.getRoot();

	this.draggable('.titlebar');

	// Close Button
	const closeBtn = root.querySelector('.btn-close');
	if (closeBtn) {
		closeBtn.addEventListener('click', () => this.remove());
	}

	// Tabs
	root.querySelectorAll('.tab-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			_currentTab = btn.dataset.tab;
			this.updateTipDisplay();
		});
	});

	// Next / Prev buttons
	const btnPrev = root.querySelector('.btn-prev');
	if (btnPrev) {
		btnPrev.addEventListener('click', () => this.prevTip());
	}

	const btnNext = root.querySelector('.btn-next');
	if (btnNext) {
		btnNext.addEventListener('click', () => this.nextTip());
	}

	// Show at startup checkbox
	const startupCheckbox = root.querySelector('#show-startup');
	if (startupCheckbox) {
		startupCheckbox.checked = _preferences.showAtStartup;
		startupCheckbox.addEventListener('change', (e) => {
			_preferences.showAtStartup = e.target.checked;
			_preferences.save();
		});
	}
};

/**
 * On append to DOM
 */
TipBox.onAppend = function onAppend() {
	// Restore position
	this._host.style.left = `${_preferences.x}px`;
	this._host.style.top = `${_preferences.y}px`;

	// Pick a random tip to show initially
	const tips = DB.getTips();
	const guildTips = DB.getGuildTips();
	if (tips.length > 0) {
		_generalIndex = Math.floor(Math.random() * tips.length);
	}
	if (guildTips.length > 0) {
		_guildIndex = Math.floor(Math.random() * guildTips.length);
	}

	// Make sure general tab is selected initially
	const root = this.getRoot();
	const generalTab = root.querySelector('.tab-btn[data-tab="general"]');
	if (generalTab) {
		generalTab.click();
	}

	this.updateTipDisplay();
};

/**
 * On remove from DOM
 */
TipBox.onRemove = function onRemove() {
	// Save coordinates
	_preferences.x = parseInt(this._host.style.left, 10) || 200;
	_preferences.y = parseInt(this._host.style.top, 10) || 200;
	_preferences.save();
};

/**
 * Display the current tip based on tab and index
 */
TipBox.updateTipDisplay = function updateTipDisplay() {
	const root = this.getRoot();
	const tipTextEl = root.querySelector('.tip-text');
	if (!tipTextEl) return;

	let text = '';
	if (_currentTab === 'general') {
		const tips = DB.getTips();
		if (tips && tips.length > 0) {
			text = tips[_generalIndex];
		} else {
			text = 'No tips available. Please check if tipOfTheDay.txt is loaded correctly.';
		}
	} else {
		const guildTips = DB.getGuildTips();
		if (guildTips && guildTips.length > 0) {
			text = guildTips[_guildIndex];
		} else {
			text = 'No guild tips available. Please check if GuildTip.txt is loaded correctly.';
		}
	}

	// Format text: replace carriage returns and format line breaks nicely
	text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	
	// Convert line breaks to <br />
	tipTextEl.innerHTML = text.split('\n').map(line => {
		// Highlight bracketed text like [Alt] or [F10]
		return line.replace(/\[([^\]]+)\]/g, '<span style="color: #0044cc; font-weight: bold;">[$1]</span>');
	}).join('<br />');
};

/**
 * Show next tip
 */
TipBox.nextTip = function nextTip() {
	if (_currentTab === 'general') {
		const tips = DB.getTips();
		if (tips.length > 0) {
			_generalIndex = (_generalIndex + 1) % tips.length;
		}
	} else {
		const guildTips = DB.getGuildTips();
		if (guildTips.length > 0) {
			_guildIndex = (_guildIndex + 1) % guildTips.length;
		}
	}
	this.updateTipDisplay();
};

/**
 * Show previous tip
 */
TipBox.prevTip = function prevTip() {
	if (_currentTab === 'general') {
		const tips = DB.getTips();
		if (tips.length > 0) {
			_generalIndex = (_generalIndex - 1 + tips.length) % tips.length;
		}
	} else {
		const guildTips = DB.getGuildTips();
		if (guildTips.length > 0) {
			_guildIndex = (_guildIndex - 1 + guildTips.length) % guildTips.length;
		}
	}
	this.updateTipDisplay();
};

/**
 * Toggle TipBox window
 */
TipBox.toggle = function toggle() {
	if (this.__active) {
		this.remove();
	} else {
		this.append();
	}
};

/**
 * Auto-show on startup helper (should be called when player logs in)
 */
TipBox.checkStartup = function checkStartup() {
	if (_preferences.showAtStartup) {
		this.append();
	}
};

export default UIManager.addComponent(TipBox);
