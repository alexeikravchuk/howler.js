import { setupAudioContext } from './utils/setupAudioContext';

export const BOOLEAN = 'boolean';
export const FUNCTION = 'function';
export const NUMBER = 'number';
export const STRING = 'string';
export const UNDEFINED = 'undefined';

export const DEFAULT = '__default';
export const CANPLAY = 'canplay';
export const CANPLAYTHROUGH = `${CANPLAY}through`;
export const END = 'end';
export const ENDED = `${END}ed`;
export const ERROR = 'error';
export const FADE = 'fade';
export const INTERRUPTED = 'interrupted';
export const LOAD = 'load';
export const LOADING = `${LOAD}ing`;
export const LOADED = `${LOAD}ed`;
export const LOADERROR = `${LOAD}${ERROR}`;
export const ON = '_on';
export const PLAY = 'play';
export const PLAYERROR = `${PLAY}${ERROR}`;
export const POINTERDOWN = 'pointerdown';
export const POINTERUP = 'pointerup';
export const RATE = 'rate';
export const RESUME = 'resume';
export const RUNNING = 'running';
export const SEEK = 'seek';
export const SUSPENDED = 'suspended';
export const SUSPENDING = 'suspending';
export const UNLOADED = 'unloaded';
export const VOLUME = 'volume';

/**
 * Create the global controller. All contained methods and properties apply
 * to all sounds that are currently playing or will be in the future.
 */
export class HowlerGlobal {
	_pos = [0, 0, 0];
	_orientation = [0, 0, -1, 0, 1, 0];

	constructor() {
		this.init();
	}

	/**
	 * Initialize the global Howler object.
	 * @return {HowlerGlobal}
	 */
	init() {
		// Create a global ID counter.
		this._counter = 1000;

		// Pool of unlocked HTML5 Audio objects.
		this._html5AudioPool = [];
		this.html5PoolSize = 10;

		// Internal properties.
		this._codecs = {};
		this._howls = [];
		this._muted = false;
		this._volume = 1;
		this._canPlayEvent = CANPLAYTHROUGH;
		this._navigator = window && window.navigator || null;

		// Public properties.
		this.masterGain = null;
		this.noAudio = false;
		this.usingWebAudio = true;
		this.autoSuspend = true;
		this.ctx = null;

		// Set to false to disable the auto audio unlocker.
		this.autoUnlock = true;

		// Setup the various state values for global tracking.
		this._setup();

		return this;
	}

	/**
	 * Get/set the global volume for all sounds.
	 * @param  { Number } vol Volume from 0.0 to 1.0.
	 * @return { HowlerGlobal | Number }  Returns this or current volume.
	 */
	volume(vol) {
		vol = +vol;

		// If we don't have an AudioContext created yet, run the setup.
		if (!this.ctx) {
			setupAudioContext(this);
		}

		if (typeof vol !== UNDEFINED && vol >= 0 && vol <= 1) {
			this._volume = vol;

			// Don't update any of the nodes if we are muted.
			if (this._muted) {
				return this;
			}

			// When using Web Audio, we just need to adjust the master gain.
			if (this.usingWebAudio) {
				this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
			}

			// Loop through and change volume for all HTML5 audio nodes.
			for (let i = 0; i < this._howls.length; i++) {
				if (!this._howls[i]._webAudio) {
					// Get all of the sounds in this Howl group.
					const ids = this._howls[i]._getSoundIds();

					// Loop through all sounds and change the volumes.
					for (let j = 0; j < ids.length; j++) {
						const sound = this._howls[i]._soundById(ids[j]);

						if (sound && sound._node) {
							sound._node.volume = sound._volume * vol;
						}
					}
				}
			}

			return this;
		}

		return this._volume;
	}


	/**
	 * Helper method to update the stereo panning position of all current Howls.
	 * Future Howls will not use this value unless explicitly set.
	 * @param  {Number} pan A value of -1.0 is all the way left and 1.0 is all the way right.
	 * @return {Howler/Number}     This or current stereo panning value.
	 */
	stereo(pan) {
		// Stop right here if not using Web Audio.
		if (!this.ctx || !this.ctx.listener) {
			return this;
		}

		// Loop through all Howls and update their stereo panning.
		for (let i = this._howls.length - 1; i >= 0; i--) {
			this._howls[i].stereo(pan);
		}

		return this;
	};

	/**
	 * Get/set the position of the listener in 3D cartesian space. Sounds using
	 * 3D position will be relative to the listener's position.
	 * @param  {Number} x The x-position of the listener.
	 * @param  {Number} y The y-position of the listener.
	 * @param  {Number} z The z-position of the listener.
	 * @return {Howler/Array}   This or current listener position.
	 */
	pos(x, y, z) {
		// Stop right here if not using Web Audio.
		if (!this.ctx || !this.ctx.listener) {
			return this;
		}

		// Set the defaults for optional 'y' & 'z'.
		y = (typeof y !== NUMBER) ? this._pos[1] : y;
		z = (typeof z !== NUMBER) ? this._pos[2] : z;

		if (typeof x === NUMBER) {
			this._pos = [x, y, z];
			const {
				listener,
				currentTime
			} = this.ctx;

			if (typeof listener.positionX !== UNDEFINED) {
				listener.positionX.setTargetAtTime(this._pos[0], currentTime, 0.1);
				listener.positionY.setTargetAtTime(this._pos[1], currentTime, 0.1);
				listener.positionZ.setTargetAtTime(this._pos[2], currentTime, 0.1);
			} else {
				listener.setPosition(this._pos[0], this._pos[1], this._pos[2]);
			}
		} else {
			return this._pos;
		}

		return this;
	};

	/**
	 * Get/set the direction the listener is pointing in the 3D cartesian space.
	 * A front and up vector must be provided. The front is the direction the
	 * face of the listener is pointing, and up is the direction the top of the
	 * listener is pointing. Thus, these values are expected to be at right angles
	 * from each other.
	 * @param  {Number} x   The x-orientation of the listener.
	 * @param  {Number} y   The y-orientation of the listener.
	 * @param  {Number} z   The z-orientation of the listener.
	 * @param  {Number} xUp The x-orientation of the top of the listener.
	 * @param  {Number} yUp The y-orientation of the top of the listener.
	 * @param  {Number} zUp The z-orientation of the top of the listener.
	 * @return {Howler/Array}     Returns this or the current orientation vectors.
	 */
	orientation(x, y, z, xUp, yUp, zUp) {
		// Stop right here if not using Web Audio.
		if (!this.ctx || !this.ctx.listener) {
			return this;
		}

		// Set the defaults for optional 'y' & 'z'.
		const or = this._orientation;
		y = (typeof y !== NUMBER) ? or[1] : y;
		z = (typeof z !== NUMBER) ? or[2] : z;
		xUp = (typeof xUp !== NUMBER) ? or[3] : xUp;
		yUp = (typeof yUp !== NUMBER) ? or[4] : yUp;
		zUp = (typeof zUp !== NUMBER) ? or[5] : zUp;

		if (typeof x === NUMBER) {
			this._orientation = [x, y, z, xUp, yUp, zUp];
			const {
				listener,
				currentTime
			} = this.ctx;

			if (typeof listener.forwardX !== UNDEFINED) {
				listener.forwardX.setTargetAtTime(x, currentTime, 0.1);
				listener.forwardY.setTargetAtTime(y, currentTime, 0.1);
				listener.forwardZ.setTargetAtTime(z, currentTime, 0.1);
				listener.upX.setTargetAtTime(xUp, currentTime, 0.1);
				listener.upY.setTargetAtTime(yUp, currentTime, 0.1);
				listener.upZ.setTargetAtTime(zUp, currentTime, 0.1);
			} else {
				listener.setOrientation(x, y, z, xUp, yUp, zUp);
			}
		} else {
			return or;
		}

		return this;
	};

	/**
	 * Handle muting and unmuting globally.
	 * @param  {Boolean} muted Is muted or not.
	 */
	mute(muted) {
		// If we don't have an AudioContext created yet, run the setup.
		if (!this.ctx) {
			setupAudioContext(this);
		}

		this._muted = muted;

		// With Web Audio, we just need to mute the master gain.
		if (this.usingWebAudio) {
			this.masterGain.gain.setValueAtTime(muted ? 0 : this._volume, this.ctx.currentTime);
		}

		// Loop through and mute all HTML5 Audio nodes.
		for (let i = 0; i < this._howls.length; i++) {
			if (!this._howls[i]._webAudio) {
				// Get all of the sounds in this Howl group.
				const ids = this._howls[i]._getSoundIds();

				// Loop through all sounds and mark the audio node as muted.
				for (let j = 0; j < ids.length; j++) {
					const sound = this._howls[i]._soundById(ids[j]);

					if (sound && sound._node) {
						sound._node.muted = (muted) ? true : sound._muted;
					}
				}
			}
		}

		return this;
	}

	/**
	 * Handle stopping all sounds globally.
	 */
	stop() {
		// Loop through all Howls and stop them.
		for (let i = 0; i < this._howls.length; i++) {
			this._howls[i].stop();
		}

		return this;
	}

	/**
	 * Unload and destroy all currently loaded Howl objects.
	 * @return {Howler}
	 */
	unload() {
		for (let i = this._howls.length - 1; i >= 0; i--) {
			this._howls[i].unload();
		}

		// Create a new AudioContext to make sure it is fully reset.
		if (this.usingWebAudio && this.ctx && typeof this.ctx.close !== UNDEFINED) {
			this.ctx.close();
			this.ctx = null;
			setupAudioContext(this);
		}

		return this;
	}

	/**
	 * Check for codec support of specific extension.
	 * @param  {String} ext Audio file extension.
	 * @return {Boolean}
	 */
	codecs(ext) {
		return this._codecs[ext.replace(/^x-/, '')];
	}

	/**
	 * Setup various state values for global tracking.
	 * @return {HowlerGlobal}
	 */
	_setup() {
		let test;
		// Keeps track of the suspend/resume state of the AudioContext.
		this.state = this.ctx ? this.ctx.state || SUSPENDED : SUSPENDED;

		// Automatically begin the 30-second suspend process
		this._autoSuspend();

		// Check if audio is available.
		if (!this.usingWebAudio) {
			// No audio is available on this system if noAudio is set to true.
			if (typeof Audio !== UNDEFINED) {
				try {
					test = new Audio();

					// Check if the canplaythrough event is available.
					if (typeof test.oncanplaythrough === UNDEFINED) {
						this._canPlayEvent = CANPLAY;
					}
				} catch (e) {
					this.noAudio = true;
				}
			} else {
				this.noAudio = true;
			}
		}

		// Test to make sure audio isn't disabled in Internet Explorer.
		try {
			test = new Audio();
			if (test.muted) {
				this.noAudio = true;
			}
		} catch (e) {
		}

		// Check for supported codecs.
		if (!this.noAudio) {
			this._setupCodecs();
		}

		return this;
	}

	/**
	 * Check for browser support for various codecs and cache the results.
	 * @return {HowlerGlobal}
	 */
	_setupCodecs() {
		let audioTest = null;

		// Must wrap in a try/catch because IE11 in server mode throws an error.
		try {
			audioTest = (typeof Audio !== UNDEFINED) ? new Audio() : null;
		} catch (err) {
			return this;
		}

		if (!audioTest || typeof audioTest.canPlayType !== FUNCTION) {
			return this;
		}

		const mpegTest = audioTest.canPlayType('audio/mpeg;').replace(/^no$/, '');

		// Opera version <33 has mixed MP3 support, so we need to check for and block it.
		const checkOpera = this._navigator && this._navigator.userAgent.match(/OPR\/([0-6].)/g);
		const isOldOpera = (checkOpera && parseInt(checkOpera[0].split('/')[1], 10) < 33);

		this._codecs = {
			mp3: !!(!isOldOpera && (mpegTest || audioTest.canPlayType('audio/mp3;').replace(/^no$/, ''))),
			mpeg: !!mpegTest,
			opus: !!audioTest.canPlayType('audio/ogg; codecs="opus"').replace(/^no$/, ''),
			ogg: !!audioTest.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, ''),
			oga: !!audioTest.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, ''),
			wav: !!(audioTest.canPlayType('audio/wav; codecs="1"') || audioTest.canPlayType('audio/wav')).replace(/^no$/, ''),
			aac: !!audioTest.canPlayType('audio/aac;').replace(/^no$/, ''),
			caf: !!audioTest.canPlayType('audio/x-caf;').replace(/^no$/, ''),
			m4a: !!(audioTest.canPlayType('audio/x-m4a;') || audioTest.canPlayType('audio/m4a;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
			m4b: !!(audioTest.canPlayType('audio/x-m4b;') || audioTest.canPlayType('audio/m4b;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
			mp4: !!(audioTest.canPlayType('audio/x-mp4;') || audioTest.canPlayType('audio/mp4;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
			weba: !!audioTest.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/, ''),
			webm: !!audioTest.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/, ''),
			dolby: !!audioTest.canPlayType('audio/mp4; codecs="ec-3"').replace(/^no$/, ''),
			flac: !!(audioTest.canPlayType('audio/x-flac;') || audioTest.canPlayType('audio/flac;')).replace(/^no$/, '')
		};

		return this;
	}

	/**
	 * Some browsers/devices will only allow audio to be played after a user interaction.
	 * Attempt to automatically unlock audio on the first user interaction.
	 * Concept from: http://paulbakaus.com/tutorials/html5/web-audio-on-ios/
	 * @return {HowlerGlobal}
	 */
	_unlockAudio() {
		// Only run this if Web Audio is supported and it hasn't already been unlocked.
		if (this._audioUnlocked || !this.ctx) {
			return;
		}

		this._audioUnlocked = false;
		this.autoUnlock = false;

		// Some mobile devices/platforms have distortion issues when opening/closing tabs and/or web views.
		// Bugs in the browser (especially Mobile Safari) can cause the sampleRate to change from 44100 to 48000.
		// By calling Howler.unload(), we create a new AudioContext with the correct sampleRate.
		if (!this._mobileUnloaded && this.ctx.sampleRate !== 44100) {
			this._mobileUnloaded = true;
			this.unload();
		}

		// Scratch buffer for enabling iOS to dispose of web audio buffers correctly, as per:
		// http://stackoverflow.com/questions/24119684
		this._scratchBuffer = this.ctx.createBuffer(1, 1, 22050);

		// Call this method on touch start to create and play a buffer,
		// then check if the audio actually played to determine if
		// audio has now been unlocked on iOS, Android, etc.
		const unlock = (e) => {
			// Create a pool of unlocked HTML5 Audio objects that can
			// be used for playing sounds without user interaction. HTML5
			// Audio objects must be individually unlocked, as opposed
			// to the WebAudio API which only needs a single activation.
			// This must occur before WebAudio setup or the source.onended
			// event will not fire.
			while (this._html5AudioPool.length < this.html5PoolSize) {
				try {
					const audioNode = new Audio();

					// Mark this Audio object as unlocked to ensure it can get returned
					// to the unlocked pool when released.
					audioNode._unlocked = true;

					// Add the audio node to the pool.
					this._releaseHtml5Audio(audioNode);
				} catch (e) {
					console.log('no audio');
					this.noAudio = true;
					break;
				}
			}

			// Loop through any assigned audio nodes and unlock them.
			for (let i = 0; i < this._howls.length; i++) {
				if (!this._howls[i]._webAudio) {
					// Get all of the sounds in this Howl group.
					const ids = this._howls[i]._getSoundIds();

					// Loop through all sounds and unlock the audio nodes.
					for (let j = 0; j < ids.length; j++) {
						const sound = this._howls[i]._soundById(ids[j]);

						if (sound && sound._node && !sound._node._unlocked) {
							sound._node._unlocked = true;
							sound._node.load();
						}
					}
				}
			}

			// Fix Android can not play in suspend state.
			this._autoResume();

			// Create an empty buffer.
			const source = this.ctx.createBufferSource();
			source.buffer = this._scratchBuffer;
			source.connect(this.ctx.destination);

			// Play the empty buffer.
			if (typeof source.start === UNDEFINED) {
				source.noteOn(0);
			} else {
				source.start(0);
			}

			// Calling resume() on a stack initiated by user gesture is what actually unlocks the audio on Android Chrome >= 55.
			if (typeof this.ctx.resume === FUNCTION) {
				this.ctx.resume();
			}

			// Setup a timeout to check that we are unlocked on the next event loop.
			source.onended = () => {
				source.disconnect(0);

				// Update the unlocked state and prevent this check from happening again.
				this._audioUnlocked = true;

				// Remove the touch start listener.
				document.removeEventListener(POINTERDOWN, unlock, true);
				document.removeEventListener(POINTERUP, unlock, true);

				// Let all sounds know that audio has been unlocked.
				for (let i = 0; i < this._howls.length; i++) {
					this._howls[i]._emit('unlock');
				}
			};
		};

		// Setup a touch start listener to attempt an unlock in.
		document.addEventListener(POINTERDOWN, unlock, true);
		document.addEventListener(POINTERUP, unlock, true);

		return this;
	}

	/**
	 * Get an unlocked HTML5 Audio object from the pool. If none are left,
	 * return a new Audio object and throw a warning.
	 * @return {HTMLAudioElement} HTML5 Audio object.
	 */
	_obtainHtml5Audio() {
		// Return the next object from the pool if one exists.
		if (this._html5AudioPool.length) {
			return this._html5AudioPool.pop();
		}

		// Check if the audio is locked and throw a warning.
		const testPlay = new Audio().play();
		if (testPlay && typeof Promise !== UNDEFINED && (testPlay instanceof Promise || typeof testPlay.then === FUNCTION)) {
			testPlay.catch(() => {
				console.warn('HTML5 Audio pool exhausted, returning potentially locked audio object.');
			});
		}

		return new Audio();
	}

	/**
	 * Return an activated HTML5 Audio object to the pool.
	 * @return {HowlerGlobal}
	 */
	_releaseHtml5Audio(audio) {
		// Don't add audio to the pool if we don't know if it has been unlocked.
		if (audio._unlocked) {
			this._html5AudioPool.push(audio);
		}

		return this;
	}

	/**
	 * Automatically suspend the Web Audio AudioContext after no sound has played for 30 seconds.
	 * This saves processing/energy and fixes various browser-specific bugs with audio getting stuck.
	 * @return {HowlerGlobal}
	 */
	_autoSuspend() {
		if (!this.autoSuspend || !this.ctx || typeof this.ctx.suspend === UNDEFINED || !this.usingWebAudio) {
			return;
		}

		// Check if any sounds are playing.
		for (let i = 0; i < this._howls.length; i++) {
			if (this._howls[i]._webAudio) {
				for (let j = 0; j < this._howls[i]._sounds.length; j++) {
					if (!this._howls[i]._sounds[j]._paused) {
						return this;
					}
				}
			}
		}

		if (this._suspendTimer) {
			clearTimeout(this._suspendTimer);
		}

		// If no sound has played after 30 seconds, suspend the context.
		this._suspendTimer = setTimeout(() => {
			if (!this.autoSuspend) {
				return;
			}

			this._suspendTimer = null;
			this.state = SUSPENDING;

			// Handle updating the state of the audio context after suspending.
			const handleSuspension = () => {
				this.state = SUSPENDED;

				if (this._resumeAfterSuspend) {
					delete this._resumeAfterSuspend;
					this._autoResume();
				}
			};

			// Either the state gets suspended or it is interrupted.
			// Either way, we need to update the state to suspended.
			this.ctx.suspend().then(handleSuspension, handleSuspension);
		}, 30000);

		return this;
	}

	/**
	 * Automatically resume the Web Audio AudioContext when a new sound is played.
	 * @return {HowlerGlobal}
	 */
	_autoResume() {
		if (this.ctx && this.ctx.resume && this.usingWebAudio) {

			if (this.state === RUNNING && this.ctx.state !== INTERRUPTED && this._suspendTimer) {
				clearTimeout(this._suspendTimer);
				this._suspendTimer = null;
			} else if (this.state === SUSPENDED || this.state === RUNNING && this.ctx.state === INTERRUPTED) {
				this.ctx.resume().then(() => {
					this.state = RUNNING;

					// Emit to all Howls that the audio has resumed.
					for (let i = 0; i < this._howls.length; i++) {
						this._howls[i]._emit(RESUME);
					}
				});

				if (this._suspendTimer) {
					clearTimeout(this._suspendTimer);
					this._suspendTimer = null;
				}
			} else if (this.state === SUSPENDING) {
				this._resumeAfterSuspend = true;
			}

			return this;
		}
	}
}

export const Howler = new HowlerGlobal();
