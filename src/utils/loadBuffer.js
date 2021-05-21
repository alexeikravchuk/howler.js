import { Howler } from '../HowlerGlobal';

export const cache = {};

/**
 * Buffer a sound from URL, Data URI or cache and decode to audio source (Web Audio API).
 * @param  {Howl} howl
 */
export function loadBuffer(howl) {
	const url = howl._src;

	// Check if the buffer has already been cached and use it instead.
	if (cache[url]) {
		// Set the duration from the cache.
		this._duration = cache[url].duration;

		// Load the sound into this Howl.
		return loadSound(howl);
	}

	if (/^data:[^;]+;base64,/.test(url)) {
		// Decode the base64 data URI without XHR, since some browsers don't support it.
		const data = atob(url.split(',')[1]);
		const dataView = new Uint8Array(data.length);
		for (let i = 0; i < data.length; ++i) {
			dataView[i] = data.charCodeAt(i);
		}

		decodeAudioData(dataView.buffer, howl);
	} else {
		console.error('Loading the buffer from the URL not supported', url);
	}
}

/**
 * Decode audio data from an array buffer.
 * @param  {ArrayBuffer} arraybuffer The audio data.
 * @param  {Howl} howl
 */
function decodeAudioData(arraybuffer, howl) {
	// Fire a load error if something broke.
	const error = () => {
		howl._emit('loaderror', null, 'Decoding audio data failed.');
	};

	// Load the sound on success.
	const success = (buffer) => {
		if (buffer && howl._sounds.length > 0) {
			cache[howl._src] = buffer;
			loadSound(howl, buffer);
		} else {
			error();
		}
	};

	// Decode the buffer into an audio source.
	if (typeof Promise !== 'undefined' && Howler.ctx.decodeAudioData.length === 1) {
		Howler.ctx.decodeAudioData(arraybuffer).then(success).catch(error);
	} else {
		Howler.ctx.decodeAudioData(arraybuffer, success, error);
	}
}

/**
 * Sound is now loaded, so finish setting everything up and fire the loaded event.
 * @param  {Howl} howl
 * @param  {Object} buffer The decoded buffer sound source.
 */
function loadSound(howl, buffer= null) {
	// Set the duration.
	if (buffer && !howl._duration) {
		howl._duration = buffer.duration;
	}

	// Setup a sprite if none is defined.
	if (Object.keys(howl._sprite).length === 0) {
		howl._sprite = { __default: [0, howl._duration * 1000] };
	}

	// Fire the loaded event.
	if (howl._state !== 'loaded') {
		howl._state = 'loaded';
		howl._emit('load');
		howl._loadQueue();
	}
}
