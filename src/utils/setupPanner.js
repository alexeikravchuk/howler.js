/**
 * Create a new panner node and save it on the sound.
 * @param  {Sound} sound Specific sound to setup panning on.
 * @param {String} type Type of panner to create: 'stereo' or 'spatial'.
 * @param {AudioContext} ctx
 */
export const setupPanner = (sound, type, ctx) => {
	type = type || 'spatial';
	const { currentTime } = ctx;

	// Create the new panner node.
	if (type === 'spatial') {
		sound._panner = ctx.createPanner();
		sound._panner.coneInnerAngle = sound._pannerAttr.coneInnerAngle;
		sound._panner.coneOuterAngle = sound._pannerAttr.coneOuterAngle;
		sound._panner.coneOuterGain = sound._pannerAttr.coneOuterGain;
		sound._panner.distanceModel = sound._pannerAttr.distanceModel;
		sound._panner.maxDistance = sound._pannerAttr.maxDistance;
		sound._panner.refDistance = sound._pannerAttr.refDistance;
		sound._panner.rolloffFactor = sound._pannerAttr.rolloffFactor;
		sound._panner.panningModel = sound._pannerAttr.panningModel;

		if (typeof sound._panner.positionX !== 'undefined') {
			sound._panner.positionX.setValueAtTime(sound._pos[0], currentTime);
			sound._panner.positionY.setValueAtTime(sound._pos[1], currentTime);
			sound._panner.positionZ.setValueAtTime(sound._pos[2], currentTime);
		} else {
			sound._panner.setPosition(sound._pos[0], sound._pos[1], sound._pos[2]);
		}

		if (typeof sound._panner.orientationX !== 'undefined') {
			sound._panner.orientationX.setValueAtTime(sound._orientation[0], currentTime);
			sound._panner.orientationY.setValueAtTime(sound._orientation[1], currentTime);
			sound._panner.orientationZ.setValueAtTime(sound._orientation[2], currentTime);
		} else {
			sound._panner.setOrientation(sound._orientation[0], sound._orientation[1], sound._orientation[2]);
		}
	} else {
		sound._panner = ctx.createStereoPanner();
		sound._panner.pan.setValueAtTime(sound._stereo, currentTime);
	}

	sound._panner.connect(sound._node);

	// Update the connections.
	if (!sound._paused) {
		sound._parent.pause(sound._id, true).play(sound._id, true);
	}
};
