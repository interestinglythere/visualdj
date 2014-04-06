var visualDj = new (function() {
	var main = this;
	main.svg = d3.select("#svgContainer").append("svg:svg").style("pointer-events", "all");
	this.colors = d3.scale.category20b();
	this.ci=0;
	this.debug = false;
	this.log = function(msg) {if (this.debug) {console.log(msg);}};

	this.Recorder = function(head, entries) {
		if (this == window) {throw('Can only be called to create new instance, i.e., with `new`.');}
		this.entries = [];
		this.callbacks = {};
		this.bind = function(eventName, func) {this.callbacks[eventName] = func;};
		this.setEntries = function(entries, head) {
			this.entries.splice(0,this.entries.length);
			if (entries) { for (var i = 0; i < entries.length; i++) {
				this.entries.push(entries[i]);
			} }
			if (head !== undefined) {this.segmentStartHead = head;}
			else {
				if (entries && entries.length > 0) {this.segmentStartHead = entries[entries.length-1][0];}
				else {this.segmentStartHead = 0;}
			}
		};
		this.reset = function() {
			this._stop();
			this.setEntries();
			var callback = this.callbacks['reset']; if (callback) {callback();}
			main.log('recording reset.');
		};
		this.start = function() {
			if (!this.segmentStartTime) {this.segmentStartTime = new Date();}
			main.log('recording...');
			var callback = this.callbacks['start']; if (callback) {callback();}
		};
		this.stop = function() {
			this._stop();
			main.log('recording stopped.');
			var callback = this.callbacks['stop']; if (callback) {callback();}
		};
		this._stop = function() {
			this.record(undefined);
			this.segmentStartHead = this.getHead();
			this.segmentStartTime = undefined;
		};
		this.getHead = function() {
			return this.segmentStartHead + (new Date() - this.segmentStartTime);
		};
		this.record = function(entry) {
			if (!this.segmentStartTime) {return;}
			this.entries.push([this.getHead(), entry]);
			var callback = this.callbacks['record']; if (callback) {callback();}
		};
		this.entriesToJSON = function() {
			return JSON.stringify(this.entries);
		};
		this.entriesFromJSON = function(entriesJSON) {
			return this.setEntries(JSON.parse(entriesJSON));
		};
	};

	this.Player = function(entryHandler, entries) {
		var self = this;
		if (this == window) {throw('Can only be called to create new instance, i.e., with `new`.');}
		this.entries = entries || [];
		this.entryHandler = entryHandler;
		this.callbacks = {};
		this.bind = function(eventName, func) {this.callbacks[eventName] = func;};
		this.reset = function() {
			this.stop();
			this.segmentStartHead = 0;
			this.index = -1;
			main.log('playing reset.');
			var callback = this.callbacks['reset']; if (callback) {callback();}
		};
		this.start = function(timeScale) {
			if (!timeScale) {timeScale = 1;}
			this.timeScale = timeScale;
			if (this.timeout) {clearTimeout(this.timeout);}
			if (!this.segmentStartTime) {this.segmentStartTime = new Date();}
			main.log('playing...');
			var callback = this.callbacks['start']; if (callback) {callback();}
			this.play();
		};
		this.play = function(timeScale) {
			// main.log(this.index);
			if (this.index >= 0) {
				var entry = this.entries[this.index][1];
				if (entry !== undefined && entry !== null) {this.entryHandler(entry);}
			}
			this.index++;
			if (this.index >= this.entries.length) {this.stop(); this.reset();}
			else {
				timeUntilHeadOfNextEntry = this.getTimeUntilHeadOfEntry(this.index);
				// main.log(timeUntilHeadOfNextEntry);
				this.timeout = setTimeout( function(){self.play(timeScale);}, timeUntilHeadOfNextEntry*this.timeScale );
			}
			var callback = this.callbacks['play']; if (callback) {callback();}
		};
		this.stop = function() {
			clearTimeout(this.timeout);
			this.segmentStartHead = this.getHead();
			this.segmentStartTime = undefined;
			main.log('playing stopped.');
			var callback = this.callbacks['stop']; if (callback) {callback();}
		};
		this.getHead = function() {
			return this.segmentStartHead + (new Date() - this.segmentStartTime)/this.timeScale;
		};
		this.getTimeUntilHeadOfEntry = function(index) {
			return this.entries[index][0] - this.getHead();
		};
	};

	this.stringConverter = {};

	this.toggleExporter = function() {
		$('#exported, .button-export, .button-record').toggle();
	};

	/*
	this.exportToHash = function() {
		stringConverter.JSON = main.recorder.entriesToJSON();
		stringConverter.LZW = LZW.encode(stringConverter.JSON);
		stringConverter.Base64 = Base64.encode(stringConverter.LZW);
		location.hash = '#' + stringConverter.Base64;
	}
	this.importFromHash = function () {
		if (!location.hash.substring(1)) {return;}
		stringConverter.Base64 = location.hash.substring(1);
		stringConverter.LZW = Base64.decode(stringConverter.Base64);
		stringConverter.JSON = LZW.decode(stringConverter.LZW);
		main.recorder.entriesFromJSON(stringConverter.JSON);
	}*/

	this.exportToTextarea = function() {
		var data = main.recorder.entriesToJSON();
		$('#exported').val(data);
	};
	this.importFromTextarea = function () {
		var data = $('#exported').val();
		main.recorder.entriesFromJSON(data);
	};

	this.mouseHandler = function(visualName) {
		return function() {
			var m = d3.mouse(main.svg[0][0]);
			var w = window.innerWidth, h = window.innerHeight;
			var fmx = m[0]/w, fmy = m[1]/h;
			return main.doVisual(visualName, fmx, fmy);
		};
	};

	this.getTimeScale = function() {
		return parseFloat( $('#input-play-timescale').val() ) || 1;
	};
	this.recordHandler = function(entry) {
		return main.doVisual(entry[0], entry[1], entry[2], main.getTimeScale());
	};


	this.doVisual = function(visualName, fmx, fmy, timeScale) {
		main.recorder.record([visualName, fmx, fmy]);
		if (!timeScale) {timeScale=1;}
		var w = window.innerWidth, h = window.innerHeight;
		var visual = this.visuals[visualName];
		return visual.apply(main, [w*fmx, h*fmy, w, h, timeScale]);
	};

	this.setEventHandler = function(visualName, eventName) {
		// main.log(visualName, eventName);
		main.svg.on(eventName, this.mouseHandler(visualName));
	};

	this.setEventHandlerFromMenuOption = function(element, eventName) {
		var visualName = element.value;
		this.setEventHandler(visualName, eventName);
	};

	this.keyAliases = {

		"`": "#mousemove-yoloswag",
		"1": "#mousemove-circlereverse",
		"2": "#mousemove-basiccircle",
		"3": "#mousemove-triangles",
		"4": "#mousemove-hexagon",
		"5": "#mousemove-fireworks",
		"6": "#mousemove-miniworks",
		"7": "#mousemove-foursquare",
		"8": "#mousemove-jazz",
		"9": "#mousemove-confetti",
		"0": "#mousemove-linestomouse",
		"-": "#mousemove-biglines",
		"=": "#mousemove-drawing",

		"~": "#mousedown-yoloswag",
		"!": "#mousedown-circlereverse",
		"@": "#mousedown-basiccircle",
		"#": "#mousedown-triangles",
		"$": "#mousedown-hexagon",
		"%": "#mousedown-fireworks",
		"^": "#mousedown-miniworks",
		"&": "#mousedown-foursquare",
		"*": "#mousedown-jazz",
		"(": "#mousedown-confetti",
		")": "#mousedown-linestomouse",
		"_": "#mousedown-biglines",
		"+": "#mousedown-drawing",

		"[": "#button-record-start",
		"]": "#button-record-stop",
		"\\":"#button-record-reset",
		" ": "#button-play-start",
		"z": "#button-play-stop",
		"x": "#button-play-reset",
		"e": "#button-export-exporter",

		"/": "#button-controls"
	};

	this.keystrokes = function(event) {
		if ($('textarea:focus, input:focus, select:focus').length>0) {return;}
		var k = event.charCode;
		s = String.fromCharCode(k);
		var $e = $(main.keyAliases[s]);
		if ($e.is('option')) {
			$e.parent().val($e.val());
			$e.change();
		}
		else if ($e.attr('disabled') === undefined) {
			$e.click();
		}
	};

	$('#button-record-start').click(function() {main.recorder.start();});
	$('#button-record-stop').click(function() {main.recorder.stop();});
	$('#button-record-reset').click(function() {main.recorder.reset();});
	$('#button-play-start').click(function() {main.player.start(main.getTimeScale());});
	$('#button-play-stop').click(function() {main.player.stop();});
	$('#button-play-reset').click(function() {main.player.reset();});
	var recorderButtonSelectors = ['#button-record-start', '#button-record-stop', '#button-record-reset'];
	var playerButtonSelectors = ['#button-play-start', '#button-play-stop', '#button-play-reset'];
	var setButtonState = function(buttonSelectors, enableState) {
		for (var i = 0; i < buttonSelectors.length; i++) {
			if (enableState[i]===true) {$(buttonSelectors[i]).removeAttr('disabled');}
			else if (enableState[i]===false) {$(buttonSelectors[i]).attr('disabled', '');}
		}
	};
	this.recorder = new main.Recorder();
	this.recorder.bind('start', function() {$('body').addClass('recording'); setButtonState(recorderButtonSelectors, [false, true, true]);} );
	this.recorder.bind('stop' , function() {$('body').removeClass('recording'); setButtonState(recorderButtonSelectors, [true, false, true]);} );
	this.recorder.bind('reset', function() {$('body').removeClass('recording'); setButtonState(recorderButtonSelectors, [true, false, false]);} );
	this.recorder.reset();
	this.player = new main.Player(main.recordHandler, main.recorder.entries);
	this.player.bind('start', function() {$('body').addClass('playing'); setButtonState(playerButtonSelectors, [false, true, true]);} );
	this.player.bind('stop' , function() {$('body').removeClass('playing'); setButtonState(playerButtonSelectors, [true, false, true]);} );
	this.player.bind('reset', function() {$('body').removeClass('playing'); setButtonState(playerButtonSelectors, [true, false, false]);} );
	this.player.reset();

})();




$(document).ready(function() {
	visualDj.setEventHandler('miniworks', 'mousemove');
	visualDj.setEventHandler('hexagon', 'mousedown');
    $("#mousemoveSelector").change(function() {
        visualDj.setEventHandlerFromMenuOption(this, 'mousemove');
    });
    $("#mousedownSelector").change(function() {
        visualDj.setEventHandlerFromMenuOption(this, 'mousedown');
    });
    $(document).keypress(visualDj.keystrokes);
});
