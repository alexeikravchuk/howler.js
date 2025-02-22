/*!
 *  Howler.js Radio Demo
 *  howlerjs.com
 *
 *  (c) 2013-2020, James Simpson of GoldFire Studios
 *  goldfirestudios.com
 *
 *  MIT License
 */

// Cache references to DOM elements.
var elms = ['station0', 'title0', 'live0', 'playing0', 'station1', 'title1', 'live1', 'playing1', 'station2', 'title2', 'live2', 'playing2', 'station3', 'title3', 'live3', 'playing3', 'station4', 'title4', 'live4', 'playing4'];
elms.forEach(function(elm) {
  window[elm] = document.getElementById(elm);
});

/**
 * Radio class containing the state of our stations.
 * Includes all methods for playing, stopping, etc.
 * @param {Array} stations Array of objects with station details ({title, src, howl, ...}).
 */
var Radio = function(stations) {
  var self = this;

  this.stations = stations;
  this.index = 0;
  
  // Setup the display for each station.
  for (var i=0; i<this.stations.length; i++) {
    window['title' + i].innerHTML = '<b>' + this.stations[i].freq + '</b> ' + this.stations[i].title;
    window['station' + i].addEventListener('click', function(index) {
      var isNotPlaying = (this.stations[index].howl && !this.stations[index].howl.playing());
      
      // Stop other sounds or the current one.
      radio.stop();

      // If the station isn't already playing or it doesn't exist, play it.
      if (isNotPlaying || !this.stations[index].howl) {
        radio.play(index);
      }
    }.bind(self, i));
  }
};
Radio.prototype = {
  /**
   * Play a station with a specific index.
   * @param  {Number} index Index in the array of stations.
   */
  play: function(index) {
    var self = this;
    var sound;

    index = typeof index === 'number' ? index : this.index;
    var data = this.stations[index];

    // If we already loaded this track, use the current one.
    // Otherwise, setup and load a new Howl.
    if (data.howl) {
      sound = data.howl;
    } else {
      sound = data.howl = new Howl({
        src: data.src,
        html5: true, // A live stream can only be played through HTML5 Audio.
        format: ['mp3', 'aac']
      });
    }

    // Begin playing the sound.
    sound.play();

    // Toggle the display.
    this.toggleStationDisplay(index, true);

    // Keep track of the index we are currently playing.
    this.index = index;
  },

  /**
   * Stop a station's live stream.
   */
  stop: function() {
    var self = this;

    // Get the Howl we want to manipulate.
    var sound = this.stations[this.index].howl;

    // Toggle the display.
    this.toggleStationDisplay(this.index, false);

    // Stop the sound.
    if (sound) {
      sound.unload();
    }
  },

  /**
   * Toggle the display of a station to off/on.
   * @param  {Number} index Index of the station to toggle.
   * @param  {Boolean} state true is on and false is off.
   */
  toggleStationDisplay: function(index, state) {
    var self = this;

    // Highlight/un-highlight the row.
    window['station' + index].style.backgroundColor = state ? 'rgba(255, 255, 255, 0.33)' : '';

    // Show/hide the "live" marker.
    window['live' + index].style.opacity = state ? 1 : 0;

    // Show/hide the "playing" animation.
    window['playing' + index].style.display = state ? 'block' : 'none';
  }
};

// Setup our new radio and pass in the stations.
var radio = new Radio([
  {
    freq: '81.4',
    title: "BBC Radio 1",
    src: 'http://bbcmedia.ic.llnwd.net/stream/bbcmedia_radio1_mf_q',
    howl: null
  },
  {
    freq: '89.9',
    title: "Hip Hop Hits",
    src: 'https://streaming.radio.co/s97881c7e0/listen',
    howl: null
  },
  {
    freq: '98.9',
    title: "CNN",
    src: 'https://tunein.streamguys1.com/cnn-new',
    howl: null
  },
  {
    freq: '103.3',
    title: "80's Hits",
    src: 'https://rfcmedia.streamguys1.com/80hits.mp3',
    howl: null
  },
  {
    freq: '107.7',
    title: "Today's Hits",
    src: 'https://rfcmedia.streamguys1.com/MusicPulse.mp3',
    howl: null
  }
]);
