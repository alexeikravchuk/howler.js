import { Howler } from './HowlerGlobal';

/**
 * Setup the sound object, which each node attached to a Howl group is contained in.
 * @param {Object} howl The Howl parent group.
 */
export class Sound {
	constructor(howl) {
		this._parent = howl;
		this.init();
	}

	/**
	 * Initialize a new Sound object.
	 * @return {Sound}
	 */
	init() {
		const parent = this._parent;

		// Setup user-defined default properties.
		this._orientation = parent._orientation;
		this._stereo = parent._stereo;
		this._pos = parent._pos;
		this._pannerAttr = parent._pannerAttr;

		// Setup the default parameters.
		this._muted = parent._muted;
		this._loop = parent._loop;
		this._volume = parent._volume;
		this._rate = parent._rate;
		this._seek = 0;
		this._paused = true;
		this._ended = true;
		this._sprite = '__default';

		// Generate a unique ID for this sound.
		this._id = ++Howler._counter;

		// Add itself to the parent's pool.
		parent._sounds.push(this);

		// Create the new node.
		this.create();

		// If a stereo or position was specified, set it up.
		if (this._stereo) {
			parent.stereo(this._stereo);
		} else if (this._pos) {
			parent.pos(this._pos[0], this._pos[1], this._pos[2], this._id);
		}

		return this;
	}

	/**
	 * Create and setup a new sound object, whether HTML5 Audio or Web Audio.
	 * @return {Sound}
	 */
	create() {
		const parent = this._parent;
		const volume = (Howler._muted || this._muted || this._parent._muted) ? 0 : this._volume;

		if (parent._webAudio) {
			// Create the gain node for controlling volume (the source will connect to this).
			this._node = (typeof Howler.ctx.createGain === 'undefined') ?
						 Howler.ctx.createGainNode() :
						 Howler.ctx.createGain();
			this._node.gain.setValueAtTime(volume, Howler.ctx.currentTime);
			this._node.paused = true;
			this._node.connect(Howler.masterGain);
		} else if (!Howler.noAudio) {
			// Get an unlocked Audio object from the pool.
			this._node = Howler._obtainHtml5Audio();

			// Listen for errors (http://dev.w3.org/html5/spec-author-view/spec.html#mediaerror).
			this._errorFn = () => this._errorListener();
			this._node.addEventListener('error', this._errorFn, false);

			// Listen for 'canplaythrough' event to let us know the sound is ready.
			this._loadFn = () => this._loadListener();
			this._node.addEventListener(Howler._canPlayEvent, this._loadFn, false);

			// Listen for the 'ended' event on the sound to account for edge-case where
			// a finite sound has a duration of Infinity.
			this._endFn = () => this._endListener();
			this._node.addEventListener('ended', this._endFn, false);

			// Setup the new audio node.
			this._node.src = parent._src;
			this._node.preload = parent._preload === true ? 'auto' : parent._preload;
			this._node.volume = volume * Howler.volume();

			// Begin loading the source.
			this._node.load();
		}

		return this;
	}

	/**
	 * Reset the parameters of this sound to the original state (for recycle).
	 * @return {Sound}
	 */
	reset() {
		const parent = this._parent;

		// Reset all spatial plugin properties on this sound.
		this._orientation = parent._orientation;
		this._stereo = parent._stereo;
		this._pos = parent._pos;
		this._pannerAttr = parent._pannerAttr;

		// If a stereo or position was specified, set it up.
		if (this._stereo) {
			parent.stereo(this._stereo);
		} else if (this._pos) {
			parent.pos(this._pos[0], this._pos[1], this._pos[2], this._id);
		} else if (this._panner) {
			// Disconnect the panner.
			this._panner.disconnect(0);
			this._panner = undefined;
			parent._refreshBuffer(this);
		}

		// Reset all of the parameters of this sound.
		this._muted = parent._muted;
		this._loop = parent._loop;
		this._volume = parent._volume;
		this._rate = parent._rate;
		this._seek = 0;
		this._rateSeek = 0;
		this._paused = true;
		this._ended = true;
		this._sprite = '__default';

		// Generate a new ID so that it isn't confused with the previous sound.
		this._id = ++Howler._counter;

		return this;
	}

	/**
	 * HTML5 Audio error listener callback.
	 */
	_errorListener() {
		// Fire an error event and pass back the code.
		this._parent._emit('loaderror', this._id, this._node.error ? this._node.error.code : 0);

		// Clear the event listener.
		this._node.removeEventListener('error', this._errorFn, false);
	}

	/**
	 * HTML5 Audio canplaythrough listener callback.
	 */
	_loadListener() {
		const parent = this._parent;

		// Round up the duration to account for the lower precision in HTML5 Audio.
		parent._duration = Math.ceil(this._node.duration * 10) / 10;

		// Setup a sprite if none is defined.
		if (Object.keys(parent._sprite).length === 0) {
			parent._sprite = { __default: [0, parent._duration * 1000] };
		}

		if (parent._state !== 'loaded') {
			parent._state = 'loaded';
			parent._emit('load');
			parent._loadQueue();
		}

		// Clear the event listener.
		this._node.removeEventListener(Howler._canPlayEvent, this._loadFn, false);
	}

	/**
	 * HTML5 Audio ended listener callback.
	 */
	_endListener() {
		const parent = this._parent;

		// Only handle the `ended`` event if the duration is Infinity.
		if (parent._duration === Infinity) {
			// Update the parent duration to match the real audio duration.
			// Round up the duration to account for the lower precision in HTML5 Audio.
			parent._duration = Math.ceil(this._node.duration * 10) / 10;

			// Update the sprite that corresponds to the real duration.
			if (parent._sprite.__default[1] === Infinity) {
				parent._sprite.__default[1] = parent._duration * 1000;
			}

			// Run the regular ended method.
			parent._ended(this);
		}

		// Clear the event listener since the duration is now correct.
		this._node.removeEventListener('ended', this._endFn, false);
	}
}
