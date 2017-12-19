(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.reactCubeview = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = function (THREE) {
	/**
  * @author qiao / https://github.com/qiao
  * @author mrdoob / http://mrdoob.com
  * @author alteredq / http://alteredqualia.com/
  * @author WestLangley / http://github.com/WestLangley
  * @author erich666 / http://erichaines.com
  * @author lucascassiano / http://github.com/lucascassiano
  */

	// This set of controls performs orbiting, dollying (zooming), and panning.
	// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
	//
	//    Orbit - left mouse / touch: one finger move
	//    Zoom - middle mouse, or mousewheel / touch: two finger spread or squish
	//    Pan - right mouse, or arrow keys / touch: three finter swipe

	/* -- last edit comments
 this script was changed to support better gets and sets of angles
 */
	function OrbitControls(object, domElement) {

		this.object = object;

		this.domElement = domElement !== undefined ? domElement : document;

		// Set to false to disable this control
		this.enabled = true;

		// "target" sets the location of focus, where the object orbits around
		this.target = new THREE.Vector3();

		// How far you can dolly in and out ( PerspectiveCamera only )
		this.minDistance = 0;
		this.maxDistance = Infinity;

		// How far you can zoom in and out ( OrthographicCamera only )
		this.minZoom = 0;
		this.maxZoom = Infinity;

		// How far you can orbit vertically, upper and lower limits.
		// Range is 0 to Math.PI radians.
		this.minPolarAngle = 0; // radians
		this.maxPolarAngle = Math.PI; // radians

		// How far you can orbit horizontally, upper and lower limits.
		// If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
		this.minAzimuthAngle = -Infinity; // radians
		this.maxAzimuthAngle = Infinity; // radians

		// Set to true to enable damping (inertia)
		// If damping is enabled, you must call controls.update() in your animation loop
		this.enableDamping = false;
		this.dampingFactor = 0.25;

		// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
		// Set to false to disable zooming
		this.enableZoom = true;
		this.zoomSpeed = 1.0;

		// Set to false to disable rotating
		this.enableRotate = true;
		this.rotateSpeed = 1.0;

		// Set to false to disable panning
		this.enablePan = true;
		this.keyPanSpeed = 7.0; // pixels moved per arrow key push

		// Set to true to automatically rotate around the target
		// If auto-rotate is enabled, you must call controls.update() in your animation loop
		this.autoRotate = false;
		this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

		// Set to false to disable use of the keys
		this.enableKeys = true;

		// The four arrow keys
		this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

		// Mouse buttons
		this.mouseButtons = { ORBIT: THREE.MOUSE.LEFT, ZOOM: THREE.MOUSE.MIDDLE, PAN: THREE.MOUSE.RIGHT };

		// for reset
		this.target0 = this.target.clone();
		this.position0 = this.object.position.clone();
		this.zoom0 = this.object.zoom;

		//
		// internals
		//

		var scope = this;

		var changeEvent = { type: 'change' };
		var startEvent = { type: 'start' };
		var endEvent = { type: 'end' };

		var STATE = { NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY: 4, TOUCH_PAN: 5 };

		var state = STATE.NONE;

		var EPS = 0.000001;

		// current position in spherical coordinates
		var spherical = new THREE.Spherical();
		var sphericalDelta = new THREE.Spherical();

		var scale = 1;
		var panOffset = new THREE.Vector3();
		var zoomChanged = false;

		// Current position in spherical coordinate system.
		var theta = 0;
		var phi = 0;

		// Pending changes
		var phiDelta = 0;
		var thetaDelta = 0;
		var scale = 1;
		var panOffset = new THREE.Vector3();
		var zoomChanged = false;
		//---
		//
		// public methods
		//

		this.getPolarAngle = function () {

			return spherical.phi;
		};

		this.getAzimuthalAngle = function () {

			return spherical.theta;
		};

		this.setPolarAngle = function (angle) {

			phi = angle;
			this.forceUpdate();
		};

		this.setAzimuthalAngle = function (angle) {
			theta = angle;
			this.forceUpdate();
		};

		this.rotateLeft = function (angle) {

			thetaDelta -= angle;
		};

		this.rotateUp = function (angle) {

			phiDelta = angle;
		};

		this.setPhiDelta = function (angle) {
			phiDelta = angle;
			//this.forceUpdate();
		};

		this.setThetaDelta = function (angle) {
			thetaDelta -= angle;
			//this.forceUpdate();
		};

		// pass in distance in world space to move left
		this.panLeft = (function () {

			var v = new THREE.Vector3();

			return function panLeft(distance) {

				var te = this.object.matrix.elements;

				// get X column of matrix
				v.set(te[0], te[1], te[2]);
				v.multiplyScalar(-distance);

				panOffset.add(v);
			};
		})();

		// pass in distance in world space to move up
		this.panUp = (function () {

			var v = new THREE.Vector3();

			return function panUp(distance) {

				var te = this.object.matrix.elements;

				// get Y column of matrix
				v.set(te[4], te[5], te[6]);
				v.multiplyScalar(distance);

				panOffset.add(v);
			};
		})();

		// pass in x,y of change desired in pixel space,
		// right and down are positive
		this.pan = function (deltaX, deltaY, screenWidth, screenHeight) {

			if (scope.object instanceof THREE.PerspectiveCamera) {

				// perspective
				var position = scope.object.position;
				var offset = position.clone().sub(scope.target);
				var targetDistance = offset.length();

				// half of the fov is center to top of screen
				targetDistance *= Math.tan(scope.object.fov / 2 * Math.PI / 180.0);

				// we actually don't use screenWidth, since perspective camera is fixed to screen height
				scope.panLeft(2 * deltaX * targetDistance / screenHeight);
				scope.panUp(2 * deltaY * targetDistance / screenHeight);
			} else if (scope.object instanceof THREE.OrthographicCamera) {

				// orthographic
				scope.panLeft(deltaX * (scope.object.right - scope.object.left) / screenWidth);
				scope.panUp(deltaY * (scope.object.top - scope.object.bottom) / screenHeight);
			} else {

				// camera neither orthographic or perspective
				console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
			}
		};

		this.dollyIn = function (dollyScale) {

			if (scope.object instanceof THREE.PerspectiveCamera) {

				scale /= dollyScale;
			} else if (scope.object instanceof THREE.OrthographicCamera) {

				scope.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom * dollyScale));
				scope.object.updateProjectionMatrix();
				zoomChanged = true;
			} else {

				console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
			}
		};

		this.dollyOut = function (dollyScale) {

			if (scope.object instanceof THREE.PerspectiveCamera) {

				scale *= dollyScale;
			} else if (scope.object instanceof THREE.OrthographicCamera) {

				scope.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / dollyScale));
				scope.object.updateProjectionMatrix();
				zoomChanged = true;
			} else {

				console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
			}
		};

		this.reset = function () {

			scope.target.copy(scope.target0);
			scope.object.position.copy(scope.position0);
			scope.object.zoom = scope.zoom0;

			scope.object.updateProjectionMatrix();
			scope.dispatchEvent(changeEvent);

			scope.update();

			state = STATE.NONE;
		};

		this.forceUpdate = (function () {

			var offset = new THREE.Vector3();

			// so camera.up is the orbit axis
			var quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));
			var quatInverse = quat.clone().inverse();

			var lastPosition = new THREE.Vector3();
			var lastQuaternion = new THREE.Quaternion();

			return function () {

				var position = this.object.position;

				offset.copy(position).sub(this.target);

				// rotate offset to "y-axis-is-up" space
				offset.applyQuaternion(quat);

				// restrict theta to be between desired limits
				theta = Math.max(this.minAzimuthAngle, Math.min(this.maxAzimuthAngle, theta));

				// restrict phi to be between desired limits
				phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, phi));

				// restrict phi to be betwee EPS and PI-EPS
				phi = Math.max(EPS, Math.min(Math.PI - EPS, phi));

				var radius = offset.length() * scale;

				// restrict radius to be between desired limits
				radius = Math.max(this.minDistance, Math.min(this.maxDistance, radius));

				// move target to panned location
				this.target.add(panOffset);

				offset.x = radius * Math.sin(phi) * Math.sin(theta);
				offset.y = radius * Math.cos(phi);
				offset.z = radius * Math.sin(phi) * Math.cos(theta);

				// rotate offset back to "camera-up-vector-is-up" space
				offset.applyQuaternion(quatInverse);

				position.copy(this.target).add(offset);

				this.object.lookAt(this.target);

				if (this.enableDamping === true) {

					thetaDelta *= 1 - this.dampingFactor;
					phiDelta *= 1 - this.dampingFactor;
				} else {

					thetaDelta = 0;
					phiDelta = 0;
				}

				scale = 1;
				panOffset.set(0, 0, 0);

				// update condition is:
				// min(camera displacement, camera rotation in radians)^2 > EPS
				// using small-angle approximation cos(x/2) = 1 - x^2 / 8

				if (zoomChanged || lastPosition.distanceToSquared(this.object.position) > EPS || 8 * (1 - lastQuaternion.dot(this.object.quaternion)) > EPS) {

					lastPosition.copy(this.object.position);
					lastQuaternion.copy(this.object.quaternion);
					zoomChanged = false;

					return true;
				}

				return false;
			};
		})();

		// this method is exposed, but perhaps it would be better if we can make it private...
		this.update = (function () {

			var offset = new THREE.Vector3();

			// so camera.up is the orbit axis
			var quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));
			var quatInverse = quat.clone().inverse();

			var lastPosition = new THREE.Vector3();
			var lastQuaternion = new THREE.Quaternion();

			return function update() {

				var position = scope.object.position;

				offset.copy(position).sub(scope.target);

				// rotate offset to "y-axis-is-up" space
				offset.applyQuaternion(quat);

				// angle from z-axis around y-axis
				spherical.setFromVector3(offset);

				if (scope.autoRotate && state === STATE.NONE) {

					rotateLeft(getAutoRotationAngle());
				}

				spherical.theta += sphericalDelta.theta;
				spherical.phi += sphericalDelta.phi;

				// restrict theta to be between desired limits
				spherical.theta = Math.max(scope.minAzimuthAngle, Math.min(scope.maxAzimuthAngle, spherical.theta));

				// restrict phi to be between desired limits
				spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));

				spherical.makeSafe();

				spherical.radius *= scale;

				// restrict radius to be between desired limits
				spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));

				// move target to panned location
				scope.target.add(panOffset);

				offset.setFromSpherical(spherical);

				// rotate offset back to "camera-up-vector-is-up" space
				offset.applyQuaternion(quatInverse);

				position.copy(scope.target).add(offset);

				scope.object.lookAt(scope.target);

				if (scope.enableDamping === true) {

					sphericalDelta.theta *= 1 - scope.dampingFactor;
					sphericalDelta.phi *= 1 - scope.dampingFactor;
				} else {

					sphericalDelta.set(0, 0, 0);
				}

				scale = 1;
				panOffset.set(0, 0, 0);

				// update condition is:
				// min(camera displacement, camera rotation in radians)^2 > EPS
				// using small-angle approximation cos(x/2) = 1 - x^2 / 8

				if (zoomChanged || lastPosition.distanceToSquared(scope.object.position) > EPS || 8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS) {

					scope.dispatchEvent(changeEvent);

					lastPosition.copy(scope.object.position);
					lastQuaternion.copy(scope.object.quaternion);
					zoomChanged = false;

					return true;
				}

				return false;
			};
		})();

		this.dispose = function () {

			scope.domElement.removeEventListener('contextmenu', onContextMenu, false);
			scope.domElement.removeEventListener('mousedown', onMouseDown, false);
			scope.domElement.removeEventListener('wheel', onMouseWheel, false);

			scope.domElement.removeEventListener('touchstart', onTouchStart, false);
			scope.domElement.removeEventListener('touchend', onTouchEnd, false);
			scope.domElement.removeEventListener('touchmove', onTouchMove, false);

			scope.domElement.removeEventListener('mousemove', onMouseMove, false);
			scope.domElement.removeEventListener('mouseup', onMouseUp, false);

			scope.domElement.removeEventListener('keydown', onKeyDown, false);

			//scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?
		};

		var rotateStart = new THREE.Vector2();
		var rotateEnd = new THREE.Vector2();
		var rotateDelta = new THREE.Vector2();

		var panStart = new THREE.Vector2();
		var panEnd = new THREE.Vector2();
		var panDelta = new THREE.Vector2();

		var dollyStart = new THREE.Vector2();
		var dollyEnd = new THREE.Vector2();
		var dollyDelta = new THREE.Vector2();

		function getAutoRotationAngle() {

			return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
		}

		function getZoomScale() {

			return Math.pow(0.95, scope.zoomSpeed);
		}

		function rotateLeft(angle) {

			sphericalDelta.theta -= angle;
		}

		function rotateUp(angle) {

			sphericalDelta.phi -= angle;
		}

		var panLeft = (function () {

			var v = new THREE.Vector3();

			return function panLeft(distance, objectMatrix) {

				v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
				v.multiplyScalar(-distance);

				panOffset.add(v);
			};
		})();

		var panUp = (function () {

			var v = new THREE.Vector3();

			return function panUp(distance, objectMatrix) {

				v.setFromMatrixColumn(objectMatrix, 1); // get Y column of objectMatrix
				v.multiplyScalar(distance);

				panOffset.add(v);
			};
		})();

		// deltaX and deltaY are in pixels; right and down are positive
		var pan = (function () {

			var offset = new THREE.Vector3();

			return function pan(deltaX, deltaY) {

				var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

				if (scope.object instanceof THREE.PerspectiveCamera) {

					// perspective
					var position = scope.object.position;
					offset.copy(position).sub(scope.target);
					var targetDistance = offset.length();

					// half of the fov is center to top of screen
					targetDistance *= Math.tan(scope.object.fov / 2 * Math.PI / 180.0);

					// we actually don't use screenWidth, since perspective camera is fixed to screen height
					panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix);
					panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix);
				} else if (scope.object instanceof THREE.OrthographicCamera) {

					// orthographic
					panLeft(deltaX * (scope.object.right - scope.object.left) / scope.object.zoom / element.clientWidth, scope.object.matrix);
					panUp(deltaY * (scope.object.top - scope.object.bottom) / scope.object.zoom / element.clientHeight, scope.object.matrix);
				} else {

					// camera neither orthographic nor perspective
					console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
					scope.enablePan = false;
				}
			};
		})();

		function dollyIn(dollyScale) {

			if (scope.object instanceof THREE.PerspectiveCamera) {

				scale /= dollyScale;
			} else if (scope.object instanceof THREE.OrthographicCamera) {

				scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom * dollyScale));
				scope.object.updateProjectionMatrix();
				zoomChanged = true;
			} else {

				console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
				scope.enableZoom = false;
			}
		}

		function dollyOut(dollyScale) {

			if (scope.object instanceof THREE.PerspectiveCamera) {

				scale *= dollyScale;
			} else if (scope.object instanceof THREE.OrthographicCamera) {

				scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / dollyScale));
				scope.object.updateProjectionMatrix();
				zoomChanged = true;
			} else {

				console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
				scope.enableZoom = false;
			}
		}

		//
		// event callbacks - update the object state
		//

		function handleMouseDownRotate(event) {

			//console.log( 'handleMouseDownRotate' );

			rotateStart.set(event.clientX, event.clientY);
		}

		function handleMouseDownDolly(event) {

			//console.log( 'handleMouseDownDolly' );

			dollyStart.set(event.clientX, event.clientY);
		}

		function handleMouseDownPan(event) {

			//console.log( 'handleMouseDownPan' );

			panStart.set(event.clientX, event.clientY);
		}

		function handleMouseMoveRotate(event) {

			//console.log( 'handleMouseMoveRotate' );

			rotateEnd.set(event.clientX, event.clientY);
			rotateDelta.subVectors(rotateEnd, rotateStart);

			var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

			// rotating across whole screen goes 360 degrees around
			rotateLeft(2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed);

			// rotating up and down along whole screen attempts to go 360, but limited to 180
			rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed);

			rotateStart.copy(rotateEnd);

			scope.update();
		}

		function handleMouseMoveDolly(event) {

			//console.log( 'handleMouseMoveDolly' );

			dollyEnd.set(event.clientX, event.clientY);

			dollyDelta.subVectors(dollyEnd, dollyStart);

			if (dollyDelta.y > 0) {

				dollyIn(getZoomScale());
			} else if (dollyDelta.y < 0) {

				dollyOut(getZoomScale());
			}

			dollyStart.copy(dollyEnd);

			scope.update();
		}

		function handleMouseMovePan(event) {

			//console.log( 'handleMouseMovePan' );

			panEnd.set(event.clientX, event.clientY);

			panDelta.subVectors(panEnd, panStart);

			pan(panDelta.x, panDelta.y);

			panStart.copy(panEnd);

			scope.update();
		}

		function handleMouseUp(event) {

			//console.log( 'handleMouseUp' );

		}

		function handleMouseWheel(event) {

			//console.log( 'handleMouseWheel' );

			if (event.deltaY < 0) {

				dollyOut(getZoomScale());
			} else if (event.deltaY > 0) {

				dollyIn(getZoomScale());
			}

			scope.update();
		}

		function handleKeyDown(event) {

			//console.log( 'handleKeyDown' );

			switch (event.keyCode) {

				case scope.keys.UP:
					pan(0, scope.keyPanSpeed);
					scope.update();
					break;

				case scope.keys.BOTTOM:
					pan(0, -scope.keyPanSpeed);
					scope.update();
					break;

				case scope.keys.LEFT:
					pan(scope.keyPanSpeed, 0);
					scope.update();
					break;

				case scope.keys.RIGHT:
					pan(-scope.keyPanSpeed, 0);
					scope.update();
					break;

			}
		}

		function handleTouchStartRotate(event) {

			//console.log( 'handleTouchStartRotate' );

			rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
		}

		function handleTouchStartDolly(event) {

			//console.log( 'handleTouchStartDolly' );

			var dx = event.touches[0].pageX - event.touches[1].pageX;
			var dy = event.touches[0].pageY - event.touches[1].pageY;

			var distance = Math.sqrt(dx * dx + dy * dy);

			dollyStart.set(0, distance);
		}

		function handleTouchStartPan(event) {

			//console.log( 'handleTouchStartPan' );

			panStart.set(event.touches[0].pageX, event.touches[0].pageY);
		}

		function handleTouchMoveRotate(event) {

			//console.log( 'handleTouchMoveRotate' );

			rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
			rotateDelta.subVectors(rotateEnd, rotateStart);

			var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

			// rotating across whole screen goes 360 degrees around
			rotateLeft(2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed);

			// rotating up and down along whole screen attempts to go 360, but limited to 180
			rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed);

			rotateStart.copy(rotateEnd);

			scope.update();
		}

		function handleTouchMoveDolly(event) {

			//console.log( 'handleTouchMoveDolly' );

			var dx = event.touches[0].pageX - event.touches[1].pageX;
			var dy = event.touches[0].pageY - event.touches[1].pageY;

			var distance = Math.sqrt(dx * dx + dy * dy);

			dollyEnd.set(0, distance);

			dollyDelta.subVectors(dollyEnd, dollyStart);

			if (dollyDelta.y > 0) {

				dollyOut(getZoomScale());
			} else if (dollyDelta.y < 0) {

				dollyIn(getZoomScale());
			}

			dollyStart.copy(dollyEnd);

			scope.update();
		}

		function handleTouchMovePan(event) {

			//console.log( 'handleTouchMovePan' );

			panEnd.set(event.touches[0].pageX, event.touches[0].pageY);

			panDelta.subVectors(panEnd, panStart);

			pan(panDelta.x, panDelta.y);

			panStart.copy(panEnd);

			scope.update();
		}

		function handleTouchEnd(event) {}

		//console.log( 'handleTouchEnd' );

		//
		// event handlers - FSM: listen for events and reset state
		//

		function onMouseDown(event) {

			if (scope.enabled === false) return;

			event.preventDefault();

			if (event.button === scope.mouseButtons.ORBIT) {

				if (scope.enableRotate === false) return;

				handleMouseDownRotate(event);

				state = STATE.ROTATE;
			} else if (event.button === scope.mouseButtons.ZOOM) {

				if (scope.enableZoom === false) return;

				handleMouseDownDolly(event);

				state = STATE.DOLLY;
			} else if (event.button === scope.mouseButtons.PAN) {

				if (scope.enablePan === false) return;

				handleMouseDownPan(event);

				state = STATE.PAN;
			}

			if (state !== STATE.NONE) {

				scope.domElement.addEventListener('mousemove', onMouseMove, false);
				scope.domElement.addEventListener('mouseup', onMouseUp, false);

				scope.dispatchEvent(startEvent);
			}
		}

		function onMouseMove(event) {

			if (scope.enabled === false) return;

			event.preventDefault();

			if (state === STATE.ROTATE) {

				if (scope.enableRotate === false) return;

				handleMouseMoveRotate(event);
			} else if (state === STATE.DOLLY) {

				if (scope.enableZoom === false) return;

				handleMouseMoveDolly(event);
			} else if (state === STATE.PAN) {

				if (scope.enablePan === false) return;

				handleMouseMovePan(event);
			}
		}

		function onMouseUp(event) {

			if (scope.enabled === false) return;

			handleMouseUp(event);

			document.removeEventListener('mousemove', onMouseMove, false);
			document.removeEventListener('mouseup', onMouseUp, false);

			scope.dispatchEvent(endEvent);

			state = STATE.NONE;
		}

		function onMouseWheel(event) {

			if (scope.enabled === false || scope.enableZoom === false || state !== STATE.NONE && state !== STATE.ROTATE) return;

			event.preventDefault();
			event.stopPropagation();

			handleMouseWheel(event);

			scope.dispatchEvent(startEvent); // not sure why these are here...
			scope.dispatchEvent(endEvent);
		}

		function onKeyDown(event) {

			if (scope.enabled === false || scope.enableKeys === false || scope.enablePan === false) return;

			handleKeyDown(event);
		}

		function onTouchStart(event) {

			if (scope.enabled === false) return;

			switch (event.touches.length) {

				case 1:
					// one-fingered touch: rotate

					if (scope.enableRotate === false) return;

					handleTouchStartRotate(event);

					state = STATE.TOUCH_ROTATE;

					break;

				case 2:
					// two-fingered touch: dolly

					if (scope.enableZoom === false) return;

					handleTouchStartDolly(event);

					state = STATE.TOUCH_DOLLY;

					break;

				case 3:
					// three-fingered touch: pan

					if (scope.enablePan === false) return;

					handleTouchStartPan(event);

					state = STATE.TOUCH_PAN;

					break;

				default:

					state = STATE.NONE;

			}

			if (state !== STATE.NONE) {

				scope.dispatchEvent(startEvent);
			}
		}

		function onTouchMove(event) {

			if (scope.enabled === false) return;

			event.preventDefault();
			event.stopPropagation();

			switch (event.touches.length) {

				case 1:
					// one-fingered touch: rotate

					if (scope.enableRotate === false) return;
					if (state !== STATE.TOUCH_ROTATE) return; // is this needed?...

					handleTouchMoveRotate(event);

					break;

				case 2:
					// two-fingered touch: dolly

					if (scope.enableZoom === false) return;
					if (state !== STATE.TOUCH_DOLLY) return; // is this needed?...

					handleTouchMoveDolly(event);

					break;

				case 3:
					// three-fingered touch: pan

					if (scope.enablePan === false) return;
					if (state !== STATE.TOUCH_PAN) return; // is this needed?...

					handleTouchMovePan(event);

					break;

				default:

					state = STATE.NONE;

			}
		}

		function onTouchEnd(event) {

			if (scope.enabled === false) return;

			handleTouchEnd(event);

			scope.dispatchEvent(endEvent);

			state = STATE.NONE;
		}

		function onContextMenu(event) {

			event.preventDefault();
		}

		//

		scope.domElement.addEventListener('contextmenu', onContextMenu, false);

		scope.domElement.addEventListener('mousedown', onMouseDown, false);
		scope.domElement.addEventListener('wheel', onMouseWheel, false);

		scope.domElement.addEventListener('touchstart', onTouchStart, false);
		scope.domElement.addEventListener('touchend', onTouchEnd, false);
		scope.domElement.addEventListener('touchmove', onTouchMove, false);

		scope.domElement.addEventListener('keydown', onKeyDown, false);

		// force an update at start

		this.update();
	};

	OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);
	OrbitControls.prototype.constructor = OrbitControls;

	Object.defineProperties(OrbitControls.prototype, {

		center: {

			get: function get() {

				console.warn('THREE.OrbitControls: .center has been renamed to .target');
				return this.target;
			}

		},

		// backward compatibility

		noZoom: {

			get: function get() {

				console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
				return !this.enableZoom;
			},

			set: function set(value) {

				console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
				this.enableZoom = !value;
			}

		},

		noRotate: {

			get: function get() {

				console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
				return !this.enableRotate;
			},

			set: function set(value) {

				console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
				this.enableRotate = !value;
			}

		},

		noPan: {

			get: function get() {

				console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
				return !this.enablePan;
			},

			set: function set(value) {

				console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
				this.enablePan = !value;
			}

		},

		noKeys: {

			get: function get() {

				console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
				return !this.enableKeys;
			},

			set: function set(value) {

				console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
				this.enableKeys = !value;
			}

		},

		staticMoving: {

			get: function get() {

				console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
				return !this.enableDamping;
			},

			set: function set(value) {

				console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
				this.enableDamping = !value;
			}

		},

		dynamicDampingFactor: {

			get: function get() {

				console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
				return this.dampingFactor;
			},

			set: function set(value) {

				console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
				this.dampingFactor = value;
			}

		}

	});

	return OrbitControls;
};

},{}],2:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x3, _x4, _x5) { var _again = true; _function: while (_again) { var object = _x3, property = _x4, receiver = _x5; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x3 = parent; _x4 = property; _x5 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _react = (typeof window !== "undefined" ? window['React'] : typeof global !== "undefined" ? global['React'] : null);

var _react2 = _interopRequireDefault(_react);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _reactSizeme = require('react-sizeme');

var _reactSizeme2 = _interopRequireDefault(_reactSizeme);

/*old import - useful for development, but not for production
//import texture_top from './img/cubeview_TOP.png';
//import texture_right from './img/cubeview_RIGHT.png';
//import texture_left from './img/cubeview_LEFT.png';
//import texture_front from './img/cubeview_FRONT.png';
//import texture_back from './img/cubeview_BACK.png';
//import texture_bottom from './img/cubeview_BOTTOM.png';
//import texture_shadow from './img/cubeview_SHADOW.png';
*/

var icon_home = 'data:image/svg+xml;base64,PHN2ZyBpZD0iaG9tZS1pY29uIiB3aWR0aD0iOTRweCIgaGVpZ2h0PSI5OHB4IiB2aWV3Qm94PSIwIDAgOTQgOTgiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+ICAgICAgICA8ZGVzYz5DcmVhdGVkIHdpdGggU2tldGNoLjwvZGVzYz4gICAgPGRlZnM+ICAgICAgICA8cGF0aCBkPSJNMC45OTQxMzk1OTgsMzcuNzcwMTE3OCBMNDMuMzQwMTExMywwLjU3OTU1MDY1OCBMNDMuMzQwMTExMywwLjU3OTU1MDY1OCBDNDMuNzE3NTgxOSwwLjI0ODAzNTEyIDQ0LjI4MjQxODEsMC4yNDgwMzUxMiA0NC42NTk4ODg3LDAuNTc5NTUwNjU4IEw4Ny4wMDU4NjA0LDM3Ljc3MDExNzggTDg3LjAwNTg2MDQsMzcuNzcwMTE3OCBDODcuNDIwODI2OSwzOC4xMzQ1NjQzIDg3LjQ2MTc4MTUsMzguNzY2NDAzNCA4Ny4wOTczMzUsMzkuMTgxMzY5OSBDODYuOTA3NDcxNiwzOS4zOTc1NTI1IDg2LjYzMzY5MjEsMzkuNTIxNDgxMiA4Ni4zNDU5NzE3LDM5LjUyMTQ4MTIgTDgyLDM5LjUyMTQ4MTIgTDgyLDM5LjUyMTQ4MTIgQzgxLjQ0NzcxNTMsMzkuNTIxNDgxMiA4MSwzOS45NjkxOTY0IDgxLDQwLjUyMTQ4MTIgTDgxLDg5IEw4MSw4OSBDODEsODkuNTUyMjg0NyA4MC41NTIyODQ3LDkwIDgwLDkwIEw5LDkwIEw5LDkwIEM4LjQ0NzcxNTI1LDkwIDgsODkuNTUyMjg0NyA4LDg5IEw4LDQwLjUyMTQ4MTIgTDgsNDAuNTIxNDgxMiBDOCwzOS45NjkxOTY0IDcuNTUyMjg0NzUsMzkuNTIxNDgxMiA3LDM5LjUyMTQ4MTIgTDEuNjU0MDI4MzIsMzkuNTIxNDgxMiBMMS42NTQwMjgzMiwzOS41MjE0ODEyIEMxLjEwMTc0MzU3LDM5LjUyMTQ4MTIgMC42NTQwMjgzMTcsMzkuMDczNzY1OSAwLjY1NDAyODMxNywzOC41MjE0ODEyIEMwLjY1NDAyODMxNywzOC4yMzM3NjA4IDAuNzc3OTU3MDM1LDM3Ljk1OTk4MTMgMC45OTQxMzk1OTgsMzcuNzcwMTE3OCBaIiBpZD0icGF0aC0xIj48L3BhdGg+ICAgICAgICA8ZmlsdGVyIHg9Ii04LjElIiB5PSItNS42JSIgd2lkdGg9IjExNi4xJSIgaGVpZ2h0PSIxMTUuNiUiIGZpbHRlclVuaXRzPSJvYmplY3RCb3VuZGluZ0JveCIgaWQ9ImZpbHRlci0yIj4gICAgICAgICAgICA8ZmVPZmZzZXQgZHg9IjAiIGR5PSIyIiBpbj0iU291cmNlQWxwaGEiIHJlc3VsdD0ic2hhZG93T2Zmc2V0T3V0ZXIxIj48L2ZlT2Zmc2V0PiAgICAgICAgICAgIDxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjIiIGluPSJzaGFkb3dPZmZzZXRPdXRlcjEiIHJlc3VsdD0ic2hhZG93Qmx1ck91dGVyMSI+PC9mZUdhdXNzaWFuQmx1cj4gICAgICAgICAgICA8ZmVDb21wb3NpdGUgaW49InNoYWRvd0JsdXJPdXRlcjEiIGluMj0iU291cmNlQWxwaGEiIG9wZXJhdG9yPSJvdXQiIHJlc3VsdD0ic2hhZG93Qmx1ck91dGVyMSI+PC9mZUNvbXBvc2l0ZT4gICAgICAgICAgICA8ZmVDb2xvck1hdHJpeCB2YWx1ZXM9IjAgMCAwIDAgMCAgIDAgMCAwIDAgMCAgIDAgMCAwIDAgMCAgMCAwIDAgMC4yMjc3Nzk2NjUgMCIgdHlwZT0ibWF0cml4IiBpbj0ic2hhZG93Qmx1ck91dGVyMSI+PC9mZUNvbG9yTWF0cml4PiAgICAgICAgPC9maWx0ZXI+ICAgIDwvZGVmcz4gICAgPGcgaWQ9IlBhZ2UtMSIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+ICAgICAgICA8ZyBpZD0iQ3ViZS10ZXh0dXJlcyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTU3LjAwMDAwMCwgLTg2LjAwMDAwMCkiPiAgICAgICAgICAgIDxnIGlkPSJIT01FIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSg2MC4wMDAwMDAsIDg4LjAwMDAwMCkiPiAgICAgICAgICAgICAgICA8ZyBpZD0iUmVjdGFuZ2xlLTUiPiAgICAgICAgICAgICAgICAgICAgPHVzZSBmaWxsPSJibGFjayIgZmlsbC1vcGFjaXR5PSIxIiBmaWx0ZXI9InVybCgjZmlsdGVyLTIpIiB4bGluazpocmVmPSIjcGF0aC0xIj48L3VzZT4gICAgICAgICAgICAgICAgICAgIDx1c2UgZmlsbD0iI0ZGRkZGRiIgZmlsbC1ydWxlPSJldmVub2RkIiB4bGluazpocmVmPSIjcGF0aC0xIj48L3VzZT4gICAgICAgICAgICAgICAgICAgIDxwYXRoIHN0cm9rZT0iIzc0NzQ3NCIgc3Ryb2tlLXdpZHRoPSIzIiBkPSJNMi45ODEwNDI0OCwzOC4wMjE0ODEyIEw3LDM4LjAyMTQ4MTIgQzguMzgwNzExODcsMzguMDIxNDgxMiA5LjUsMzkuMTQwNzY5MyA5LjUsNDAuNTIxNDgxMiBMOS41LDg4LjUgTDc5LjUsODguNSBMNzkuNSw0MC41MjE0ODEyIEM3OS41LDM5LjE0MDc2OTMgODAuNjE5Mjg4MSwzOC4wMjE0ODEyIDgyLDM4LjAyMTQ4MTIgTDg1LjAxODk1NzUsMzguMDIxNDgxMiBMNDQsMS45OTYzNzEwMSBMMi45ODEwNDI0OCwzOC4wMjE0ODEyIFoiPjwvcGF0aD4gICAgICAgICAgICAgICAgPC9nPiAgICAgICAgICAgICAgICA8cmVjdCBpZD0iUmVjdGFuZ2xlLTYiIGZpbGw9IiM3NDc0NzQiIHg9IjM0IiB5PSI0NiIgd2lkdGg9IjIxIiBoZWlnaHQ9IjQ0Ij48L3JlY3Q+ICAgICAgICAgICAgPC9nPiAgICAgICAgPC9nPiAgICA8L2c+PC9zdmc+';
var icon_home_hover = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTRweCIgaGVpZ2h0PSI5OHB4IiB2aWV3Qm94PSIwIDAgOTQgOTgiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+ICAgICAgICA8ZGVzYz5DcmVhdGVkIHdpdGggU2tldGNoLjwvZGVzYz4gICAgPGRlZnM+ICAgICAgICA8cGF0aCBkPSJNMC45OTQxMzk1OTgsMzcuNzcwMTE3OCBMNDMuMzQwMTExMywwLjU3OTU1MDY1OCBMNDMuMzQwMTExMywwLjU3OTU1MDY1OCBDNDMuNzE3NTgxOSwwLjI0ODAzNTEyIDQ0LjI4MjQxODEsMC4yNDgwMzUxMiA0NC42NTk4ODg3LDAuNTc5NTUwNjU4IEw4Ny4wMDU4NjA0LDM3Ljc3MDExNzggTDg3LjAwNTg2MDQsMzcuNzcwMTE3OCBDODcuNDIwODI2OSwzOC4xMzQ1NjQzIDg3LjQ2MTc4MTUsMzguNzY2NDAzNCA4Ny4wOTczMzUsMzkuMTgxMzY5OSBDODYuOTA3NDcxNiwzOS4zOTc1NTI1IDg2LjYzMzY5MjEsMzkuNTIxNDgxMiA4Ni4zNDU5NzE3LDM5LjUyMTQ4MTIgTDgyLDM5LjUyMTQ4MTIgTDgyLDM5LjUyMTQ4MTIgQzgxLjQ0NzcxNTMsMzkuNTIxNDgxMiA4MSwzOS45NjkxOTY0IDgxLDQwLjUyMTQ4MTIgTDgxLDg5IEw4MSw4OSBDODEsODkuNTUyMjg0NyA4MC41NTIyODQ3LDkwIDgwLDkwIEw5LDkwIEw5LDkwIEM4LjQ0NzcxNTI1LDkwIDgsODkuNTUyMjg0NyA4LDg5IEw4LDQwLjUyMTQ4MTIgTDgsNDAuNTIxNDgxMiBDOCwzOS45NjkxOTY0IDcuNTUyMjg0NzUsMzkuNTIxNDgxMiA3LDM5LjUyMTQ4MTIgTDEuNjU0MDI4MzIsMzkuNTIxNDgxMiBMMS42NTQwMjgzMiwzOS41MjE0ODEyIEMxLjEwMTc0MzU3LDM5LjUyMTQ4MTIgMC42NTQwMjgzMTcsMzkuMDczNzY1OSAwLjY1NDAyODMxNywzOC41MjE0ODEyIEMwLjY1NDAyODMxNywzOC4yMzM3NjA4IDAuNzc3OTU3MDM1LDM3Ljk1OTk4MTMgMC45OTQxMzk1OTgsMzcuNzcwMTE3OCBaIiBpZD0icGF0aC0xIj48L3BhdGg+ICAgICAgICA8ZmlsdGVyIHg9Ii04LjElIiB5PSItNS42JSIgd2lkdGg9IjExNi4xJSIgaGVpZ2h0PSIxMTUuNiUiIGZpbHRlclVuaXRzPSJvYmplY3RCb3VuZGluZ0JveCIgaWQ9ImZpbHRlci0yIj4gICAgICAgICAgICA8ZmVPZmZzZXQgZHg9IjAiIGR5PSIyIiBpbj0iU291cmNlQWxwaGEiIHJlc3VsdD0ic2hhZG93T2Zmc2V0T3V0ZXIxIj48L2ZlT2Zmc2V0PiAgICAgICAgICAgIDxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjIiIGluPSJzaGFkb3dPZmZzZXRPdXRlcjEiIHJlc3VsdD0ic2hhZG93Qmx1ck91dGVyMSI+PC9mZUdhdXNzaWFuQmx1cj4gICAgICAgICAgICA8ZmVDb21wb3NpdGUgaW49InNoYWRvd0JsdXJPdXRlcjEiIGluMj0iU291cmNlQWxwaGEiIG9wZXJhdG9yPSJvdXQiIHJlc3VsdD0ic2hhZG93Qmx1ck91dGVyMSI+PC9mZUNvbXBvc2l0ZT4gICAgICAgICAgICA8ZmVDb2xvck1hdHJpeCB2YWx1ZXM9IjAgMCAwIDAgMCAgIDAgMCAwIDAgMCAgIDAgMCAwIDAgMCAgMCAwIDAgMC4yMjc3Nzk2NjUgMCIgdHlwZT0ibWF0cml4IiBpbj0ic2hhZG93Qmx1ck91dGVyMSI+PC9mZUNvbG9yTWF0cml4PiAgICAgICAgPC9maWx0ZXI+ICAgIDwvZGVmcz4gICAgPGcgaWQ9IlBhZ2UtMSIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+ICAgICAgICA8ZyBpZD0iQ3ViZS10ZXh0dXJlcyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTE4NC4wMDAwMDAsIC04Ni4wMDAwMDApIj4gICAgICAgICAgICA8ZyBpZD0iSE9NRSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTg3LjAwMDAwMCwgODguMDAwMDAwKSI+ICAgICAgICAgICAgICAgIDxnIGlkPSJSZWN0YW5nbGUtNSI+ICAgICAgICAgICAgICAgICAgICA8dXNlIGZpbGw9ImJsYWNrIiBmaWxsLW9wYWNpdHk9IjEiIGZpbHRlcj0idXJsKCNmaWx0ZXItMikiIHhsaW5rOmhyZWY9IiNwYXRoLTEiPjwvdXNlPiAgICAgICAgICAgICAgICAgICAgPHVzZSBmaWxsPSIjRkZGRkZGIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHhsaW5rOmhyZWY9IiNwYXRoLTEiPjwvdXNlPiAgICAgICAgICAgICAgICAgICAgPHVzZSBmaWxsLW9wYWNpdHk9IjAuMyIgZmlsbD0iIzRBOTBFMiIgZmlsbC1ydWxlPSJldmVub2RkIiB4bGluazpocmVmPSIjcGF0aC0xIj48L3VzZT4gICAgICAgICAgICAgICAgICAgIDxwYXRoIHN0cm9rZT0iIzRBOTBFMiIgc3Ryb2tlLXdpZHRoPSIzIiBkPSJNMi45ODEwNDI0OCwzOC4wMjE0ODEyIEw3LDM4LjAyMTQ4MTIgQzguMzgwNzExODcsMzguMDIxNDgxMiA5LjUsMzkuMTQwNzY5MyA5LjUsNDAuNTIxNDgxMiBMOS41LDg4LjUgTDc5LjUsODguNSBMNzkuNSw0MC41MjE0ODEyIEM3OS41LDM5LjE0MDc2OTMgODAuNjE5Mjg4MSwzOC4wMjE0ODEyIDgyLDM4LjAyMTQ4MTIgTDg1LjAxODk1NzUsMzguMDIxNDgxMiBMNDQsMS45OTYzNzEwMSBMMi45ODEwNDI0OCwzOC4wMjE0ODEyIFoiPjwvcGF0aD4gICAgICAgICAgICAgICAgPC9nPiAgICAgICAgICAgICAgICA8cmVjdCBpZD0iUmVjdGFuZ2xlLTYiIGZpbGw9IiM0QTkwRTIiIHg9IjM0IiB5PSI0NiIgd2lkdGg9IjIxIiBoZWlnaHQ9IjQ0Ij48L3JlY3Q+ICAgICAgICAgICAgPC9nPiAgICAgICAgPC9nPiAgICA8L2c+PC9zdmc+';

//import icon_home from './img/cubeview_HOME.svg';
//import icon_home_hover from './img/cubeview_HOME_hover.svg';

//import './CubeView.css';

var OrbitControls = require('./OrbitControls')(THREE);

var renderer = undefined,
    scene = undefined,
    windowSize = { width: 0, height: 0 },
    animation = undefined,
    controllers = undefined;
var mouse = undefined,
    raycaster = undefined,
    INTERSECTED = undefined;
var cube = undefined;

//Base64 images converted @ https://www.base64-image.de
var texture_top = 'data:image/png;base64,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';
var texture_right = 'data:image/png;base64,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';
var texture_left = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAAXNSR0IArs4c6QAABGZJREFUeAHtnb1KK1EUhU/MFQURRAux8yHS+VNoJYqthfgMsUjvM+QptLURfAB9BUUbC8FKtBAb0VwmkMCWYTkh15m5Wd9AMHv2yTlnrfU5ZEIgjU6n00sctg5M2SpHeN+BPwMf2u324Cl/DRzodrt9lVwBDMJWEgFAuWPQAwCDkJVEAFDuGPQAwCBkJREAlDsGPQAwCFlJBADljkEPAAxCVhIBQLlj0AMAg5CVRABQ7hj0AMAgZCURAJQ7Bj0AMAhZSQQA5Y5BDwAMQlYSAUC5Y9ADAIOQlUQAUO4Y9ADAIGQlEQCUOwY9ADAIWUkEAOWOQQ8ADEJWEgFAuWPQAwCDkJVEAFDuGPQAwCBkJREAlDsGPQAwCFlJBADljkEPAAxCVhIBQLlj0AMAg5CVRABQ7hj0AMAgZCURAJQ7Bj0AMAhZSQQA5Y5BDwAMQlYSAUC5Y9ADAIOQlUQAUO4Y9ADAIGQlEQCUOwY9ADAIWUkEAOWOQQ8ADEJWEgFAuWPQAwCDkJXE4W8GqUFl9M7OztL7+3s6OjpK09PTIy15e3ubrq+vR3pNNnhubi4dHBwMXzfYw/BEgScrKyvp6empwMj8IcvLy2l3dze/WcLZ2gBwd3eX3t7e0ufn58gAvLy8pAyCRqORpqaKX9QWFhaCxYM9NJvNcF4V2dj7+/vcIV9fX6nX68l9fXx85L62rJO1AeBfCF5bW0v7+/tjT3VycpJmZ2fHnufq6iqdn5+njY2NtLe3N/Z8vzFB8X+X31idOSt3AAAqj6DaDQBAtf5XvjoAVB5BtRsAgGr9r3x1AKg8gmo3MFG3gQ8PD+ni4qKwo1tbW7m3e5eXlz9+FpF95rCzs1N4rboOnCgAHh8fU/Yoeqyvr+cCkN2//3RkHwABwE8uldxvtVppe3u78Krz8/O5Y4+Pj9PMzExub9JOTtQVIPv0bmlpaeyMFhcXc68MY09cwwl4E1jDUMrcEgCU6XYN1wKAGoZS5pYAoEy3a7gWANQwlDK3BABlul3DtWp3G3h6epqKfiNndXU1bW5uDm29ublJr6+vw7rIk8PDw8LrFZnvfxtTOwCyEIse30F5fn5O2WOUI/vKlvPR6HQ6fQfa7bazD3bau91uXzPvAeyij4IBIPphVwGAXeRRMABEP+wqALCLPAoGgOiHXQUAdpFHwQAQ/bCrAMAu8igYAKIfdhUA2EUeBQNA9MOuAgC7yKNgAIh+2FUAYBd5FAwA0Q+7CgDsIo+CASD6YVcBgF3kUTAARD/sKgCwizwKBoDoh10FAHaRR8EAEP2wqwDALvIoGACiH3YVANhFHgUDQPTDrgIAu8ijYACIfthVAGAXeRQMANEPuwoA7CKPggEg+mFXAYBd5FEwAEQ/7CoAsIs8CgaA6IddBQB2kUfBABD9sKsAwC7yKBgAoh92FQDYRR4FA0D0w64CALvIo2AAiH7YVQBgF3kUDADRD7sKAOwij4IBIPphVw1/M2jwEyJ2DpgL5gpgDsBfeI905rJ3A+AAAAAASUVORK5CYII=';
var texture_front = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAAXNSR0IArs4c6QAACRxJREFUeAHtXVeLVE0QrdU1hzVHjJhRMQfEnHANmAPoqw8iruC++xNkQR8EHwRFxYDog5gDqJgxK4qKGbOimHU/TkMPd3fn1s6MU/vVbFeBzp2u7rpdp053V3cPbF5xcXEpmQSLQI1gPTfHHQL5HoeioiL/aJ8BIFBSUuK8tBkggGBzLhoBOHQC0BkBAggy56IRgEMnAJ0RIIAgcy4aATh0AtAZAQIIMueiEYBDJwCdESCAIHMuGgE4dALQGQECCDLnohGAQycAnREggCBzLhoBOHQC0BkBAggy56IRgEMnAJ0RIIAgcy4aATh0AtAZAQIIMueiEYBDJwCdESCAIHMuGgE4dALQGQECCDLnohGAQycAnREggCBzLhoBOHQC0BkBAggy56IRgEMnAJ0RIIAgcy4aATh0AtAZAQIIMueiEYBDJwCdESCAIHMuGgE4dALQGQECCDLnohGAQycAnREggCBzLhoBOHQC0BkBAggy56IRgEMnAJ0RIIAgcy4aATh0AtAZAQIIMueiEYBDJwCdESCAIHMuGgE4dALQGQECCDLnohGAQycAnREggCBzLhoBOHQC0AVLgK9fv9KnT5/oz58/AYQ53sXE3wyKr5KeZseOHQRw05EZM2ZQq1at6O7du3T27NlKm9atW5eaN29Obdq0ob59+1LNmjUrbfPz50+6ePEiXb9+nZ4+fUq/f/9OtGncuDH17t2bhg4dSh07dkyUJ3vYunUrwdaAAQNo0KBByaokLTt9+jTdu3ePxo0bR127diX/PWnlFApbt25N06dPT6EmXyXrBICTX758SSkovmvfv393jx8+fHAkyMvLoxo14ien6Kht2rSpA6J///7eXIXP169f05YtW+jVq1dOV79+ferWrRsh8E+ePHHl58+fpwsXLtCkSZNo8uTJFWz4AviH/j58+JA6derkiOh13OfLly+dbyAOBH25f/9+0iZ///6l0tJS4nD49etX0rbpFmadAL4Da9euJYzUTGTUqFE0a9as2KYIwLt37+jcuXOEwG3bto0aNmzoRlb5Rjdu3KCdO3fSjx8/3OgbNmwYtWjRokw16B4/fkx79+6lI0eOuBliyZIlVK9evTL1ol8wC2C2W7FihQtUVJfK87x5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';
var texture_back = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAAXNSR0IArs4c6QAACoVJREFUeAHtXddrlFsQn8TYsfeGvfcuWFAU+4OIXURRsYJ5Cb74IP4J0ScRFbsgNlAUUcTeC/aCvffeldz7Gzi5X5L9Tr7djTsn98zAZne/06b8zsycOQtJy8rKyiElbzWQ7q3kKjhrIMPoITMz03zUdw80kJ2dzVKqB/DA2DYRFQA27XjQpgDwwMg2ERUANu140KYA8MDINhEVADbteNCmAPDAyDYRFQA27XjQpgDwwMg2ERUANu140KYA8MDINhEVADbteNCmAPDAyDYRFQA27XjQpgDwwMg2ERUANu140KYA8MDINhEVADbteNCmAPDAyDYRFQA27XjQpgDwwMg2ERUANu140KYA8MDINhEVADbteNCmAPDAyDYRFQA27XjQpgDwwMg2ERUANu140KYA8MDINhEVADbteNCmAPDAyDYRFQA27XjQpgDwwMg2ERUANu140KYA8MDINhEVADbteNCmAPDAyDYRFQA27XjQpgDwwMg2ERUANu140KYA8MDINhEVADbteNCmAPDAyDYRFQA27XjQpgDwwMg2ERUANu140KYA8MDINhEVADbteNCmAPDAyDYRFQA27XjQpgCIYOTv37/Tx48fI/Qsfl1y/2dQqljfvHkzff361bpcuXLlqEKFClSzZk3q0KEDlS5d2to/2Pjnzx/asGED/f79m7p06UKdOnUKNkf6jDnOnTtHly5donv37tGvX794XMmSJal69erUpEkT6t+/P1WqVCl0PiPnlClTCOOi0KNHj2j//v2Uk5NDffv2pebNm0cZllSflAPg1q1b9PnzZypRokQo4zCAoZ07d7IyhgwZYh5Z369evUpXrlzhPu/fv48bANjp69atowcPHvAcAF+zZs2oRo0a9PbtW3r27BkdO3aMTp06Rb169aIRI0bElMXICVmiAODOnTu0evVq+vnzJw0fPjwlxoeAKQcAa/XfP4sXL6YyZcqYr3nef/z4Qe/evaMLFy6wsg8cOMDtUUBw4sQJSk9Pp9q1a9PTp08Ju6pBgwZ55g/7cvfuXVq/fj0DtHv37tSnTx+eJy0tLXcIduf58+dp3759dPToUfry5QtNnDgxtz2RDwDsxo0bCWAZM2YM9ejRI5FpEhrjZA6AXQcD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';
var texture_bottom = 'data:image/png;base64,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';
var texture_shadow = 'data:image/png;base64,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';

var CubeView = (function (_Component) {
    _inherits(CubeView, _Component);

    function CubeView(props) {
        _classCallCheck(this, CubeView);

        _get(Object.getPrototypeOf(CubeView.prototype), 'constructor', this).call(this, props);
        this.DEBUG = this.props.DEBUG ? this.props.DEBUG : false;
        this.state = {
            icon_home: icon_home
        };

        this.hoverHomeOn = this.hoverHomeOn.bind(this);
        this.hoverHomeOff = this.hoverHomeOff.bind(this);
        this.clickHome = this.clickHome.bind(this);
    }

    //export default Container3;

    _createClass(CubeView, [{
        key: 'componentDidMount',
        value: function componentDidMount() {

            var canvas = this.refs.threeCanvas;
            this.hoverColor = this.props.hoverColor ? this.props.hoverColor : 0x0033ff;

            if (this.props.relatedCanvas) this.relatedCanvas = this.props.relatedCanvas();
            //console.log('cubeView', this.relatedCanvas);

            //if(this.relatedCanvas)
            this.init();
            this.updateDimensions();
            window.addEventListener('resize', this.updateDimensions.bind(this));

            canvas.addEventListener('mousemove', this.onMouseMove.bind(this));

            //this.mouseMoving = false;

            canvas.addEventListener('mousedown', this.onMouseDown.bind(this));

            canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        }
    }, {
        key: 'onMouseDown',
        value: function onMouseDown(event) {
            this.mouseMoving = false;
        }
    }, {
        key: 'onMouseUp',
        value: function onMouseUp(event) {
            if (this.mouseMoving == false) {
                console.log('click');
                if (INTERSECTED) {
                    console.log(INTERSECTED.name);
                    //var angle = controls.getAutoRotationAngle();
                    //this.controls.rotateLeft(45);
                    //this.controls.rotateLeft(45);
                    //this.controls.setAzimuthalAngle(Math.PI);
                    //var a = this.controls.getPolarAngle();
                    this.setViewAngle(INTERSECTED.name);

                    // var xAxis = new THREE.Vector3(1,1,0);
                    //this.camera.rotateOnAxis( xAxis, 10 );

                    //this.camera.position.set(0, this.cameraDistance, 0);
                    //this.controls.update();

                    //console.log('this.controls angles', (this.controls.getPolarAngle()/ Math.PI).toFixed(4), (this.controls.getAzimuthalAngle()/ Math.PI).toFixed(4));
                }
            } else if (this.mouseMoving = true) {
                    console.log('drag');
                }
        }
    }, {
        key: 'setViewAngle',
        value: function setViewAngle(name) {
            var phi, theta;

            switch (name) {
                //Faces
                case 'f0':
                    //RIGHT
                    phi = Math.PI * 0.5;
                    theta = Math.PI * 0.5;
                    break;
                case 'f1':
                    //TOP
                    phi = 0;
                    theta = 0;
                    break;
                case 'f2':
                    //FRONT
                    phi = Math.PI * 0.5;
                    theta = 0;
                    break;
                case 'f3':
                    //LEFT
                    phi = Math.PI * 0.5;
                    theta = -Math.PI * 0.5;
                    break;
                case 'f4':
                    //BOTTOM
                    phi = Math.PI;
                    theta = 0;
                    break;
                case 'f5':
                    //BACK
                    phi = Math.PI * 0.5;
                    theta = Math.PI;
                    break;
                //corners
                case 'c0':
                    //FRONT,TOP,RIGHT
                    phi = Math.PI * 0.25;
                    theta = Math.PI * 0.25;
                    break;
                case 'c1':
                    //FRONT,BOTTOM, RIGHT
                    phi = Math.PI * 0.75;
                    theta = Math.PI * 0.25;
                    break;
                case 'c2':
                    //FRONT,BOTTOM,lEFT
                    phi = Math.PI * 0.75;
                    theta = -Math.PI * 0.25;
                    break;
                case 'c3':
                    //FRONT,TOP,lEFT
                    phi = Math.PI * 0.25;
                    theta = -Math.PI * 0.25;
                    break;
                case 'c4':
                    //BACK,TOP,RIGHT
                    phi = Math.PI * 0.25;
                    theta = Math.PI * 0.75;
                    break;
                case 'c5':
                    //BACK,BOTTOM,RIGHT
                    phi = Math.PI * 0.75;
                    theta = Math.PI * 0.75;
                    break;
                case 'c6':
                    //BACK,BOTTOM,LEFT
                    phi = Math.PI * 0.75;
                    theta = -Math.PI * 0.75;
                    break;
                case 'c7':
                    //BACK,TOP,LEFT
                    phi = Math.PI * 0.25;
                    theta = -Math.PI * 0.75;
                    break;
                //Edges
                case 'e0':
                    //TOP,FRONT
                    phi = Math.PI * 0.25;
                    theta = 0;
                    break;
                case 'e1':
                    //TOP,BOTTOM
                    phi = Math.PI * 0.75;
                    theta = 0;
                    break;
                case 'e2':
                    //TOP,BACK
                    phi = Math.PI * 0.25;
                    theta = Math.PI;
                    break;
                case 'e3':
                    //BOTTOM,BACK
                    phi = Math.PI * 0.75;
                    theta = Math.PI;
                    break;
                case 'e4':
                    //FRONT,RIGHT
                    phi = Math.PI * 0.5;
                    theta = Math.PI * 0.25;
                    break;
                case 'e5':
                    //FRONT,LEFT
                    phi = Math.PI * 0.5;
                    theta = -Math.PI * 0.25;
                    break;
                case 'e6':
                    //BACK,RIGHT
                    phi = Math.PI * 0.5;
                    theta = Math.PI * 0.75;
                    break;
                case 'e7':
                    //BACK,LEFT
                    phi = Math.PI * 0.5;
                    theta = -Math.PI * 0.75;
                    break;
                case 'e8':
                    //BACK,LEFT
                    phi = Math.PI * 0.25;
                    theta = Math.PI * 0.5;
                    break;
                case 'e9':
                    //TOP,RIGHT
                    phi = Math.PI * 0.25;
                    theta = -Math.PI * 0.5;
                    break;
                case 'e10':
                    //BOTTOM,RIGHT
                    phi = Math.PI * 0.75;
                    theta = Math.PI * 0.5;
                    break;

                case 'e11':
                    //BOTTOM,LEFT
                    phi = Math.PI * 0.75;
                    theta = -Math.PI * 0.5;
                    break;
                default:

            }

            console.log(phi, theta);

            this.controls.setPolarAngle(phi);
            //this.controls.setPhiDelta(phi);
            //this.controls.setThetaDelta(theta);
            this.controls.setAzimuthalAngle(theta);

            //this.controls.setPolarAngle(phi);
            //this.controls.setAzimuthalAngle(theta);

            if (this.props.onUpdateAngles) {
                console.log('angles updated');
                this.props.onUpdateAngles(phi, theta);
            }
            //console.log('this.controls angles', (this.controls.getPolarAngle() / Math.PI).toFixed(4), (this.controls.getAzimuthalAngle() / Math.PI).toFixed(4));
            console.log('angles', phi, theta);
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            var canvas = this.refs.threeCanvas;
            renderer = null;
            scene = null;
            this.camera = null;
            window.removeEventListener('resize', this.updateDimensions.bind(this));
            canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
            canvas.removeEventListener('mouseup', this.handleClick.bind(this));
            this.controls.dispose();
        }
    }, {
        key: 'updateDimensions',
        value: function updateDimensions() {
            var _props$size = this.props.size;
            var width = _props$size.width;
            var height = _props$size.height;

            height = width / this.props.aspect;
            var canvas = this.refs.threeCanvas;
            renderer.setSize(width, height);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
    }, {
        key: 'init',
        value: function init() {
            var _props$size2 = this.props.size;
            var width = _props$size2.width;
            var height = _props$size2.height;

            var canvas = this.refs.threeCanvas;
            height = width / this.props.aspect;

            var marginTop = this.props.marginTop;

            scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);

            var antialias = this.props.antialias ? this.props.antialias : false;

            renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: antialias, alpha: true });

            renderer.setSize(width, height);
            renderer.sortObjects = false;

            //var geometry = new THREE.SphereGeometry(3, 24, 24);
            var material = new THREE.MeshBasicMaterial({ color: 0x00aaff, wireframe: false });
            //mainSphere = new THREE.Mesh(geometry, material);

            var geometry = new THREE.BoxGeometry(3, 3, 3);
            cube = new THREE.Mesh(geometry, material);
            //scene.add(cube);

            var gridXZ = new THREE.GridHelper(10, 20);
            gridXZ.name = 'grid';
            //scene.add(gridXZ);

            this.camera.position.z = this.props.zoom ? this.props.zoom : 8;
            this.cameraDistance = this.camera.position.z;

            //setup raycaster variables
            mouse = new THREE.Vector2();
            raycaster = new THREE.Raycaster();

            //canvas.addEventListener('mousedown', this.onClick, false)

            this._createCube();
            renderer.setPixelRatio(window.devicePixelRatio);

            /*controls*/

            if (this.relatedCanvas) {
                this.controls = new OrbitControls(this.camera, this.relatedCanvas);
            } else {
                this.controls = new OrbitControls(this.camera); //new OrbitControls(camera);
            }

            this.controls.enablePan = false;
            this.controls.enableZoom = false;
            this.controls.enableKeys = false;

            this.controls.setPolarAngle(Math.PI * 0.25);
            this.controls.setAzimuthalAngle(Math.PI * 0.25);
            // rotation in Y
            // controls.setAzimuthalAngle(theta);

            // rotation in X
            //controls.setPolarAngle(phi);
            var _this = this;

            this._render = function () {
                animation = requestAnimationFrame(_this._render);
                renderer.render(scene, _this.camera);

                _this.camera.updateMatrixWorld();

                raycaster.setFromCamera(mouse, _this.camera);
                var intersects = raycaster.intersectObjects(controllers.children);

                if (intersects.length > 0) {
                    if (_this.DEBUG) console.log('intersected', intersects);
                    if (INTERSECTED != intersects[0].object) {
                        if (INTERSECTED) {
                            INTERSECTED.material.color.setHex(INTERSECTED.currentHex); //<--putback
                            INTERSECTED.material.visible = INTERSECTED.currVisible;
                        }

                        INTERSECTED = intersects[0].object;
                        INTERSECTED.currentHex = INTERSECTED.material.color.getHex(); //<-putback

                        INTERSECTED.currVisible = INTERSECTED.material.visible;

                        //INTERSECTED.material.color.setHex(hoverColor);
                        INTERSECTED.material.visible = true;

                        if (_this.DEBUG) console.log('controller', INTERSECTED.name);
                        //INTERSECTED.visible = true;
                    }
                } else {
                        if (INTERSECTED) {
                            INTERSECTED.material.color.setHex(INTERSECTED.currentHex); //<-putback
                            INTERSECTED.material.visible = INTERSECTED.currVisible;
                        }

                        INTERSECTED = null;

                        _this.controls.update();
                    }
            };

            this._render();
        }
    }, {
        key: 'onClick',
        value: function onClick(event) {

            event.preventDefault();
            var x = event.clientX / window.innerWidth * 2 - 1;
            var y = -(event.clientY / window.innerHeight) * 2 + 1;
            var dir = new THREE.Vector3(x, y, -1);
            dir.unproject(this.camera);

            raycaster = new THREE.Raycaster(this.camera.position, dir.sub(this.camera.position).normalize());

            var intersects = raycaster.intersectObjects(scene.children);
            if (intersects.length > 0) {
                var SELECTED = intersects[0].object;
                //scene.add(transformControl);
                //transformControl.attach(SELECTED);
                var selectedNode = SELECTED;
            } else {
                //transformControl.detach(SELECTED);
            }
        }
    }, {
        key: 'onMouseMove',
        value: function onMouseMove(event) {
            this.mouseMoving = true;
            var canvas = this.refs.threeCanvas;
            var rect = canvas.getBoundingClientRect();
            mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            if (this.DEBUG) console.log('mouse', mouse);
        }

        //Insert all 3D elements here
    }, {
        key: '_createCube',
        value: function _createCube() {
            var size = this.props.cubeSize ? this.props.cubeSize : 2;
            var axisHelper = new THREE.AxisHelper(size + 1);
            axisHelper.position.x = -size / 2 - 0.01;
            axisHelper.position.z = -size / 2 - 0.01;
            axisHelper.position.y = -size / 2 - 0.01;
            scene.add(axisHelper);

            var dir = new THREE.Vector3(1, 0, 0);

            //normalize the direction vector (convert to vector of length 1)
            dir.normalize();

            var origin = new THREE.Vector3(-size / 2, -size / 2, -size / 2);
            var length = size + 1;
            var hex = 0xff0000;

            var arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex);
            //scene.add( arrowHelper );

            //var box = new THREE.BoxHelper( axisHelper, 0xffff00 );
            //scene.add( box );

            //Textures cube;
            //var texture_top = THREE.ImageUtils.loadTexture( './img/texture.jpg' );

            // texture.wrapS = THREE.RepeatWrapping;
            //texture.wrapT = THREE.RepeatWrapping;
            //texture.repeat.set(4, 4);

            var top = this.createTexturedPlane(size, texture_top);
            top.position.y = size / 2;
            top.rotation.x = -Math.PI / 2;
            scene.add(top);

            var front = this.createTexturedPlane(size, texture_front);
            front.position.z = size / 2;
            scene.add(front);

            var right = this.createTexturedPlane(size, texture_right);
            right.position.x = size / 2;
            right.rotation.y = Math.PI / 2;
            scene.add(right);

            var left = this.createTexturedPlane(size, texture_left);
            left.position.x = -size / 2;
            left.rotation.y = -Math.PI / 2;
            scene.add(left);

            var back = this.createTexturedPlane(size, texture_back);
            back.position.z = -size / 2;
            back.rotation.y = Math.PI;
            scene.add(back);

            var bottom = this.createTexturedPlane(size, texture_bottom);
            bottom.position.y = -size / 2;
            bottom.rotation.x = Math.PI / 2;
            scene.add(bottom);

            var shadow = this.createTexturedPlane(size + 1.5, texture_shadow, false);
            shadow.position.y = -size / 2 - 0.4;
            shadow.rotation.x = -Math.PI / 2;
            scene.add(shadow);

            controllers = new THREE.Object3D();

            //FRONT,TOP,RIGHT
            var c0 = this.createCornerCube(size, 1, 1, 1);
            c0.name = 'c0';
            controllers.add(c0);

            //FRONT,BOTTOM,RIGHT
            var c1 = this.createCornerCube(size, 1, -1, 1);
            c1.name = 'c1';
            controllers.add(c1);

            //FRONT,BOTTOM,lEFT
            var c2 = this.createCornerCube(size, -1, -1, 1);
            c2.name = 'c2';
            controllers.add(c2);

            //FRONT,TOP,lEFT
            var c3 = this.createCornerCube(size, -1, 1, 1);
            c3.name = 'c3';
            controllers.add(c3);

            //BACK,TOP,RIGHT
            var c4 = this.createCornerCube(size, 1, 1, -1);
            c4.name = 'c4';
            controllers.add(c4);

            //BACK,BOTTOM,RIGHT
            var c5 = this.createCornerCube(size, 1, -1, -1);
            c5.name = 'c5';
            controllers.add(c5);

            //BACK,BOTTOM,LEFT
            var c6 = this.createCornerCube(size, -1, -1, -1);
            c6.name = 'c6';
            controllers.add(c6);

            //BACK,TOP,LEFT
            var c7 = this.createCornerCube(size, -1, 1, -1);
            c7.name = 'c7';
            controllers.add(c7);

            //TOP,FRONT
            var e0 = this.createEdgeCube(size, 0, 1, 1);
            e0.name = 'e0';
            controllers.add(e0);

            //TOP,BOTTOM
            var e1 = this.createEdgeCube(size, 0, -1, 1);
            e1.name = 'e1';
            controllers.add(e1);

            //TOP,BACK
            var e2 = this.createEdgeCube(size, 0, 1, -1);
            e2.name = 'e2';
            controllers.add(e2);

            //BOTTOM,BACK
            var e3 = this.createEdgeCube(size, 0, -1, -1);
            e3.name = 'e3';
            controllers.add(e3);

            //FRONT,RIGHT
            var e4 = this.createEdgeCube(size, 1, 0, 1);
            e4.name = 'e4';
            controllers.add(e4);

            //FRONT,LEFT
            var e5 = this.createEdgeCube(size, -1, 0, 1);
            e5.name = 'e5';
            controllers.add(e5);

            //BACK,LEFT
            var e6 = this.createEdgeCube(size, 1, 0, -1);
            e6.name = 'e6';
            controllers.add(e6);

            //BACK,LEFT
            var e7 = this.createEdgeCube(size, -1, 0, -1);
            e7.name = 'e7';
            controllers.add(e7);

            //BACK,LEFT
            var e8 = this.createEdgeCube(size, 1, 1, 0);
            e8.name = 'e8';
            controllers.add(e8);

            //TOP,RIGHT
            var e9 = this.createEdgeCube(size, -1, 1, 0);
            e9.name = 'e9';
            controllers.add(e9);

            //BOTTOM,RIGHT
            var e10 = this.createEdgeCube(size, 1, -1, 0);
            e10.name = 'e10';
            controllers.add(e10);

            //BOTTOM,LEFT
            var e11 = this.createEdgeCube(size, -1, -1, 0);
            e11.name = 'e11';
            controllers.add(e11);

            //RIGHT
            var f0 = this.createFaceCube(size, 1, 0, 0);
            f0.name = 'f0';
            controllers.add(f0);

            //TOP
            var f1 = this.createFaceCube(size, 0, 1, 0);
            f1.name = 'f1';
            controllers.add(f1);

            //FRONT
            var f2 = this.createFaceCube(size, 0, 0, 1);
            f2.name = 'f2';
            controllers.add(f2);

            //LEFT
            var f3 = this.createFaceCube(size, -1, 0, 0);
            f3.name = 'f3';
            controllers.add(f3);

            //BOTTOM
            var f4 = this.createFaceCube(size, 0, -1, 0);
            f4.name = 'f4';
            controllers.add(f4);

            //BACK
            var f5 = this.createFaceCube(size, 0, 0, -1);
            f5.name = 'f5';
            controllers.add(f5);

            scene.add(controllers);
        }
    }, {
        key: 'createFaceCube',
        value: function createFaceCube(size, x, y, z) {
            var c_cube = size / 4; //corner cubes
            var sizex = c_cube;
            var sizey = c_cube;
            var sizez = c_cube;

            if (x == 0) {
                sizey = size / 2;
                sizez = size / 2;
            }
            if (y == 0) {
                sizex = size / 2;
                sizez = size / 2;
            }
            if (z == 0) {
                sizex = size / 2;
                sizey = size / 2;
            }

            var _x = x * 1.01;
            var _y = y * 1.01;
            var _z = z * 1.01;

            /*
            var material = new THREE.ShaderMaterial({
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                visible:true
            });
             //material.transparent = true;
            */

            var material = new THREE.MeshBasicMaterial({ color: this.hoverColor, transparent: true, opacity: 0.5, visible: false }); //change to false later
            var geometry = new THREE.BoxGeometry(sizex, sizey, sizez);

            var edgeCube = new THREE.Mesh(geometry, material);
            if (x > 0) {
                edgeCube.position.x = size / 2 * _x - sizex / 2;
            } else {
                edgeCube.position.x = x == 0 ? 0 : size / 2 * _x + sizex / 2;
            }

            if (y > 0) {
                edgeCube.position.y = size / 2 * _y - sizey / 2;
            } else {
                edgeCube.position.y = y == 0 ? 0 : size / 2 * _y + sizey / 2;
            }

            if (z > 0) {
                edgeCube.position.z = size / 2 * _z - sizez / 2;
            } else {
                edgeCube.position.z = z == 0 ? 0 : size / 2 * _z + sizez / 2;
            }

            return edgeCube;
        }
    }, {
        key: 'createEdgeCube',
        value: function createEdgeCube(size, x, y, z) {

            var c_cube = size / 4; //corner cubes
            var sizex = c_cube;
            var sizey = c_cube;
            var sizez = c_cube;

            if (x == 0) {
                sizex = size / 2;
            }
            if (y == 0) {
                sizey = size / 2;
            }
            if (z == 0) {
                sizez = size / 2;
            }
            var _x = x * 1.01;
            var _y = y * 1.01;
            var _z = z * 1.01;

            var c_cube = size / 4; //corner cubes
            //*creating small cubs
            var material = new THREE.MeshBasicMaterial({ color: this.hoverColor, transparent: true, opacity: 0.5, visible: false, side: THREE.DoubleSide }); //change to false later
            var geometry = new THREE.BoxGeometry(sizex, sizey, sizez);

            var edgeCube = new THREE.Mesh(geometry, material);
            if (x > 0) {
                edgeCube.position.x = size / 2 * _x - sizex / 2;
            } else {
                edgeCube.position.x = x == 0 ? 0 : size / 2 * _x + sizex / 2;
            }

            if (y > 0) {
                edgeCube.position.y = size / 2 * _y - sizey / 2;
            } else {
                edgeCube.position.y = y == 0 ? 0 : size / 2 * _y + sizey / 2;
            }

            if (z > 0) {
                edgeCube.position.z = size / 2 * _z - sizez / 2;
            } else {
                edgeCube.position.z = z == 0 ? 0 : size / 2 * _z + sizez / 2;
            }

            return edgeCube;
        }
    }, {
        key: 'createCornerCube',
        value: function createCornerCube(size, x, y, z) {
            var _x = x * 1.01;
            var _y = y * 1.01;
            var _z = z * 1.01;
            var c_cube = size / 4; //corner cubes
            //*creating small cubs
            var material = new THREE.MeshBasicMaterial({ color: this.hoverColor, transparent: true, opacity: 0.5, visible: false });
            var geometry = new THREE.BoxGeometry(c_cube, c_cube, c_cube);

            var cornerCube = new THREE.Mesh(geometry, material);
            if (x > 0) {
                cornerCube.position.x = size / 2 * _x - c_cube / 2;
            } else {
                cornerCube.position.x = size / 2 * _x + c_cube / 2;
            }
            if (y > 0) {
                cornerCube.position.y = size / 2 * _y - c_cube / 2;
            } else {
                cornerCube.position.y = size / 2 * _y + c_cube / 2;
            }
            if (z > 0) {
                cornerCube.position.z = size / 2 * _z - c_cube / 2;
            } else {
                cornerCube.position.z = size / 2 * _z + c_cube / 2;
            }
            return cornerCube;
        }
    }, {
        key: 'createTexturedPlane',
        value: function createTexturedPlane(size, texturePath) {
            var side = arguments.length <= 2 || arguments[2] === undefined ? THREE.DoubleSide : arguments[2];

            var texture = new THREE.TextureLoader().load(texturePath);
            var material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, visible: true, side: side });
            var geometry = new THREE.PlaneGeometry(size, size);
            var mesh = new THREE.Mesh(geometry, material);
            return mesh;
        }
    }, {
        key: 'hoverHomeOn',
        value: function hoverHomeOn() {
            this.setState({ icon_home: icon_home_hover });
            //this.icon_home = icon_home_hover;
        }
    }, {
        key: 'hoverHomeOff',
        value: function hoverHomeOff() {
            this.setState({ icon_home: icon_home });
        }
    }, {
        key: 'clickHome',
        value: function clickHome() {
            this.controls.setPolarAngle(Math.PI * 0.25);
            this.controls.setAzimuthalAngle(Math.PI * 0.25);
            //this.controls.reset();
            if (this.props.onUpdateAngles) {
                console.log('angles updated');
                this.props.onUpdateAngles(Math.PI * 0.25, Math.PI * 0.25);
            }
        }
    }, {
        key: 'render',
        value: function render() {
            var _props$size3 = this.props.size;
            var width = _props$size3.width;
            var height = _props$size3.height;

            return _react2['default'].createElement(
                'div',
                { className: 'cube-view-container' },
                _react2['default'].createElement('img', { src: this.state.icon_home, className: 'button-home',
                    onMouseOver: this.hoverHomeOn,
                    onMouseOut: this.hoverHomeOff,
                    onClick: this.clickHome
                }),
                _react2['default'].createElement('canvas', { ref: 'threeCanvas' })
            );
        }
    }]);

    return CubeView;
})(_react.Component);

exports['default'] = (0, _reactSizeme2['default'])({ monitorHeight: true, refreshRate: 80, monitorPosition: true })(CubeView);
module.exports = exports['default'];

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./OrbitControls":1,"react-sizeme":undefined,"three":undefined}]},{},[2])(2)
});