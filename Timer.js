var Timer = {
	increment: 1000,
	maxTime: 30000,
	time: this.maxTime,
	lastTime: -1,
	helduntil: 0,
	hold: function(howlong){
		var now = new Date().getTime();
		if(Timer.helduntil<now)
			Timer.helduntil = now + howlong;
		else
			Timer.helduntil += howlong;
		Timer.gain(howlong);
	},
	tick: function(){
		var newTime = new Date().getTime();
		var delta = newTime - Timer.lastTime;
		Timer.lastTime = newTime;
		Timer.time -= delta;
		//console.log("Time left: " + Timer.time);
		if(Timer.time <= 0){
			Timer.stop();
			if(Timer.onStop)
				Timer.onStop();
		}
		if(Timer.bar && Timer.helduntil < newTime)
			Timer.bar.render(Math.round(Timer.time/Timer.maxTime * 100));
		else
			console.log("timer held for another " + (Timer.helduntil - newTime));
	},
	start: function(bar, onStop){
		Timer.time = Timer.maxTime;
		if(Timer.htmlElement)
			Timer.htmlElement.innerHTML = (Timer.time);
		Timer.onStop = onStop
		Timer.bar = bar;
		Timer.lastTime = new Date().getTime();
		Timer.id = window.setInterval(Timer.tick, Timer.increment);
	},
	stop: function(){
		window.clearInterval(Timer.id);
		Timer.id = undefined;
	},
	isRunning: function(){
		if(Timer.id)
			return true;
		else
			return false;
	},
	gain: function(howmuch){
		Timer.time += howmuch;
	},
	startIfNotRunning: function(bar, onStop){
		if(Timer.id)
			return;
		else
			Timer.start(bar, onStop);
	}
}

function Bar(htmlElement){
	var bar = this;
	this.element = htmlElement;
	this.render = function(percentage){
		console.log("Rendering timer at " + percentage + "%");
		var html = "<div style='width: 100%; height: "+percentage+"%; background:LawnGreen; position: absolute; bottom: 0;'>" +
			"</div>";
		bar.element.innerHTML = html;
	}
}

var Moves = {
	bar: undefined,
	maxMoves: 20,
	movesLeft: this.maxMoves,
	move: function(){
		Moves.movesLeft -= 1;
		if(Moves.movesLeft <= 0){
			Moves.gameOver();
		}
		if(Moves.bar)
			Moves.bar.render(Math.round(Moves.movesLeft / Moves.maxMoves * 100));
	},	
	gain: function(howmuch){
		Moves.movesLeft += 1;
	}
}

var mechanism = undefined

function Go(){

	var gameOver = function(){
		Grid.locks += 1;
		HighScore.enter(Grid.points);
	}
	if(mechanism)
		mechanism.startIfNotRunning(bar, gameOver);
	else
		alert("Game mode not selected");
}