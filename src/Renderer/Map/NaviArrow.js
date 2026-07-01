/**
 * Renderer/Map/NaviArrow.js
 *
 * Renders navigation path arrows on the ground in 3D space.
 * When the Navigation system has an active path, arrows are drawn
 * on each cell along the path pointing in the direction of travel.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import WebGL from 'Utils/WebGL.js';
import Altitude from 'Renderer/Map/Altitude.js';
import _vertexShader from './NaviArrow.vs?raw';
import _fragmentShader from './NaviArrow.fs?raw';

/**
 * @var {WebGLProgram}
 */
let _program = null;

/**
 * @var {WebGLBuffer} quad buffer (one arrow quad, centered at origin)
 */
let _buffer = null;

/**
 * @var {WebGLTexture} arrow texture (procedurally generated)
 */
let _texture = null;

/**
 * @var {boolean} is the renderer ready
 */
let _ready = false;

/**
 * @var {Array} current path from Navigation
 */
let _currentPath = [];

/**
 * Maximum number of arrows to render along the path
 * (avoids rendering thousands of arrows on very long paths)
 */
const MAX_ARROWS = 50;

/**
 * Arrow half-size in world units (one cell = 1 unit)
 */
const ARROW_HALF = 0.45;

/**
 * Pulsing animation alpha range
 */
const ALPHA_MIN = 0.5;
const ALPHA_MAX = 0.95;
const ALPHA_PERIOD = 1500; // ms

/**
 * Generate the arrow texture procedurally on a canvas.
 * Returns an HTMLCanvasElement with a directional arrow drawn on it.
 * Arrow points UP (+Y on canvas = +direction in world Z).
 *
 * @returns {HTMLCanvasElement}
 */
function generateArrowCanvas() {
	const size = 64;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');

	const cx = size / 2;
	const cy = size / 2;
	const scale = size * 0.4;

	ctx.clearRect(0, 0, size, size);

	// Draw arrow body: points upward (toward top of canvas)
	ctx.beginPath();
	// Arrow tip at top center
	ctx.moveTo(cx, cy - scale);
	// Right wing
	ctx.lineTo(cx + scale * 0.5, cy + scale * 0.1);
	// Right inner notch
	ctx.lineTo(cx + scale * 0.2, cy + scale * 0.1);
	// Right tail
	ctx.lineTo(cx + scale * 0.2, cy + scale * 0.5);
	// Left tail
	ctx.lineTo(cx - scale * 0.2, cy + scale * 0.5);
	// Left inner notch
	ctx.lineTo(cx - scale * 0.2, cy + scale * 0.1);
	// Left wing
	ctx.lineTo(cx - scale * 0.5, cy + scale * 0.1);
	ctx.closePath();

	// Fill with cyan (matches the minimap path color)
	ctx.fillStyle = 'rgba(0, 220, 255, 0.9)';
	ctx.fill();

	// White border for visibility
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
	ctx.lineWidth = 2;
	ctx.stroke();

	return canvas;
}

/**
 * Build the quad buffer for one arrow.
 * The quad is centered at origin (0,0,0), axis-aligned.
 * Rotation is applied in the vertex shader via uAngle.
 *
 * Layout: x, y, z, u, v  (stride = 5 floats)
 * Two triangles (6 vertices).
 */
function buildQuadBuffer() {
	const h = ARROW_HALF;
	// prettier-ignore
	return new Float32Array([
		// Triangle 1
		-h, 0, -h,   0.0, 0.0,
		+h, 0, -h,   1.0, 0.0,
		+h, 0, +h,   1.0, 1.0,
		// Triangle 2
		+h, 0, +h,   1.0, 1.0,
		-h, 0, +h,   0.0, 1.0,
		-h, 0, -h,   0.0, 0.0,
	]);
}

/**
 * Compute the rotation angle (radians) for a step in the path.
 * In RO's coordinate system: +X = East, +Y = North (in world XZ plane).
 * The arrow texture points "up" on canvas = world +Z (North) by default.
 *
 * @param {number} dx - direction x component
 * @param {number} dy - direction y component
 * @returns {number} angle in radians to rotate the arrow quad
 */
function directionToAngle(dx, dy) {
	// Reversed to point forward along the path (away from the player, towards the target)
	return Math.atan2(-dx, -dy);
}

/**
 * Initialize the NaviArrow renderer.
 *
 * @param {WebGLRenderingContext} gl
 */
function init(gl) {
	// Create shader program
	_program = WebGL.createShaderProgram(gl, _vertexShader, _fragmentShader);

	// Build and upload quad buffer
	const quadData = buildQuadBuffer();
	_buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, _buffer);
	gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);

	// Build arrow texture from canvas
	const arrowCanvas = generateArrowCanvas();
	_texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, _texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, arrowCanvas);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.bindTexture(gl.TEXTURE_2D, null);

	_ready = true;
}

/**
 * Free GPU resources.
 *
 * @param {WebGLRenderingContext} gl
 */
function free(gl) {
	if (_texture) {
		gl.deleteTexture(_texture);
		_texture = null;
	}
	if (_buffer) {
		gl.deleteBuffer(_buffer);
		_buffer = null;
	}
	if (_program) {
		gl.deleteProgram(_program);
		_program = null;
	}
	_currentPath = [];
	_ready = false;
}

/**
 * Update the path to render arrows along.
 * Called by Navigation.js whenever the path changes.
 *
 * @param {Array} path - array of {x, y} objects
 */
function setPath(path) {
	_currentPath = path || [];
}

/**
 * Render navigation arrows along the current path.
 *
 * @param {WebGLRenderingContext} gl
 * @param {Float32Array} modelView
 * @param {Float32Array} projection
 * @param {object} fog
 * @param {number} tick
 */
function render(gl, modelView, projection, fog, tick) {
	if (!_ready || !_currentPath || _currentPath.length < 2) {
		return;
	}

	const path = _currentPath;
	const uniform = _program.uniform;
	const attribute = _program.attribute;
	const stride = 5 * 4; // 5 floats × 4 bytes

	// Pulsing alpha
	const phase = (tick % ALPHA_PERIOD) / ALPHA_PERIOD;
	const alpha = ALPHA_MIN + (ALPHA_MAX - ALPHA_MIN) * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2));

	gl.useProgram(_program);

	// Matrices
	gl.uniformMatrix4fv(uniform.uModelViewMat, false, modelView);
	gl.uniformMatrix4fv(uniform.uProjectionMat, false, projection);

	// Alpha
	gl.uniform1f(uniform.uAlpha, alpha);

	// Fog
	gl.uniform1i(uniform.uFogUse, fog.use && fog.exist ? 1 : 0);
	gl.uniform1f(uniform.uFogNear, fog.near);
	gl.uniform1f(uniform.uFogFar, fog.far);
	gl.uniform3fv(uniform.uFogColor, fog.color);

	// Texture
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, _texture);
	gl.uniform1i(uniform.uDiffuse, 0);

	// Buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, _buffer);
	gl.enableVertexAttribArray(attribute.aPosition);
	gl.enableVertexAttribArray(attribute.aTextCoord);
	gl.vertexAttribPointer(attribute.aPosition, 3, gl.FLOAT, false, stride, 0);
	gl.vertexAttribPointer(attribute.aTextCoord, 2, gl.FLOAT, false, stride, 3 * 4);

	// Blending for transparent arrows
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.depthMask(false);

	// Render arrows near the player with a fixed step (every 2nd cell)
	// This ensures consistent arrow spacing regardless of the total path distance.
	const totalPoints = path.length;
	const step = 2; 
	let renderedCount = 0;

	for (let i = 0; i < totalPoints - 1; i += step) {
		if (renderedCount >= MAX_ARROWS) {
			break;
		}

		const curr = path[i];
		const next = path[Math.min(i + step, totalPoints - 1)];

		// Skip warp teleport segments (visual jump)
		if (curr.isWarp) {
			continue;
		}

		// Direction vector
		const dx = next.x - curr.x;
		const dy = next.y - curr.y;

		if (dx === 0 && dy === 0) {
			continue;
		}

		// Cell center position
		const wx = curr.x + 0.5;
		const wy = curr.y + 0.5;

		// Height at this cell
		const wz = -Altitude.getCellHeight(curr.x, curr.y);

		// Rotation angle
		const angle = directionToAngle(dx, dy);

		gl.uniform1f(uniform.uAngle, angle);
		gl.uniform3f(uniform.uOffset, wx, wz, wy);

		gl.drawArrays(gl.TRIANGLES, 0, 6);
		renderedCount++;
	}

	// Draw the final destination marker if it's within range and visible
	const lastIdx = totalPoints - 1;
	if (totalPoints >= 2 && lastIdx < MAX_ARROWS * step) {
		const prev = path[lastIdx - 1];
		const last = path[lastIdx];
		const dx = last.x - prev.x;
		const dy = last.y - prev.y;
		const angle = directionToAngle(dx, dy);
		const wx = last.x + 0.5;
		const wy = last.y + 0.5;
		const wz = -Altitude.getCellHeight(last.x, last.y);
		gl.uniform1f(uniform.uAngle, angle);
		gl.uniform3f(uniform.uOffset, wx, wz, wy);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}

	// Restore state
	gl.depthMask(true);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.disableVertexAttribArray(attribute.aPosition);
	gl.disableVertexAttribArray(attribute.aTextCoord);
	gl.bindTexture(gl.TEXTURE_2D, null);
}

/**
 * Export
 */
export default {
	init,
	free,
	setPath,
	render
};
