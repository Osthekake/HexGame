requestAnimFrame = (function() {
  return window.requestAnimationFrame ||
     window.webkitRequestAnimationFrame ||
     window.mozRequestAnimationFrame ||
     window.oRequestAnimationFrame ||
     window.msRequestAnimationFrame ||
     function(/* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
       window.setTimeout(callback, Animation.secondsPrFrame);
     };
})();

var Constants = {
	shiftAnimationTime: 400,
	rotateAnimationTime: 400,
	vanishAnimationTime: 400,
	textAnimationTime: 600
}

var Animation = {
	secondsPrFrame: 1000/60,
	rotate : function(clockwise, center, onComplete){
		Grid.locks += 1;
		Timer.hold(Constants.rotateAnimationTime);
		//console.log("rotate. locks: " + Grid.locks);
		var hexes = [
			{x:center.x - center.y%2, y:center.y+1}, //bottomleft
			{x:center.x-1, y:center.y}, //left
			{x:center.x - center.y%2, y:center.y-1}, //topleft 
			{x:center.x - center.y%2 + 1, y:center.y-1}, //topright 
			{x:center.x+1, y:center.y}, //right
			{x:center.x - center.y%2 + 1, y:center.y+1} //bottomright
		];
		var r = new Rotate(clockwise, Grid.pixelOf(center.x, center.y), hexes, onComplete);
		requestAnimFrame(r.render);
	},
	vanish : function(hexes, onComplete){
		Grid.locks += 1;
		Timer.hold(Constants.vanishAnimationTime);
		//console.log("vanish. locks: " + Grid.locks);
		//console.log("Creating vanish. hexes = " + hexes);
		var v = new Vanish(hexes, onComplete);
		requestAnimFrame(v.render);
	},
	shiftLeft: function(hexes, onComplete){
		Grid.locks += 1;
		Timer.hold(Constants.shiftAnimationTime);
		//console.log("shift. locks: " + Grid.locks);
		var s = new Shift(hexes, onComplete);
		requestAnimFrame(s.render);
	},
	obnoxiousText: function(chain, kind){
		Grid.locks += 1;
		Timer.hold(Constants.textAnimationTime);
		var t = new Text(chain, kind);
		requestAnimFrame(t.render);
	}
}
function Rotate(clockwise, middle, hexes, onComplete){
	for (var i = 0; i < hexes.length; i++) {
		var coords = hexes[i];
		Grid.shouldDraw[coords.y][coords.x] = false;
	};
	var rotate = this;
	var totalAngle = Math.PI / 3;
	var radius = Grid.canvas.width / Grid.hexes_wide;
	this.hexes = hexes;
	this.center = middle;
	this.onComplete = onComplete;
	this.clockwise = clockwise;
	this.start = -1
	this.complete = function(time){
		return (time - this.start) > Constants.rotateAnimationTime;
	}
	this.render = function(time){	
		if(rotate.start == -1) rotate.start = time;
		//console.log("rendering rotate. lasted: " + (time - rotate.start));
		var angle = (time - rotate.start) / Constants.rotateAnimationTime * totalAngle;
		if(rotate.clockwise)
			angle = -angle;
		angle += Math.PI / 6;
		Grid.render();
		for (var i = hexes.length - 1; i >= 0; i--) {
			var hex = hexes[i];
			var hexX = rotate.center.x + Math.sin(angle)*radius;
			var hexY = rotate.center.y + Math.cos(angle)*radius;
			Grid.renderAHex(hexX, hexY, 1, Grid.colorOf(hex.x, hex.y));
			angle += Math.PI / 3;
		};
		if(!rotate.complete(time))
			requestAnimFrame(rotate.render);
		else{
			//console.log("rotate complete. duration: " + (time - rotate.start));
			for (var i = 0; i < hexes.length; i++) {
				var coords = hexes[i];
				Grid.shouldDraw[coords.y][coords.x] = true;
			};
			rotate.onComplete();
			Grid.locks -= 1;
			Grid.render();
			//console.log("rotate complete. locks: " + Grid.locks);
		}
	}
}
function Shift(hexes, onComplete){
	//console.log("Shift created. Hexes:");
	//console.log(hexes);
	for (var i = 0; i < hexes.length; i++) {
		var coords = hexes[i];
		Grid.shouldDraw[coords.y][coords.x] = false;
	};
	var shift = this;
	var moveBy = (Grid.canvas.height / Grid.hexes_high) ;
	this.hexes = hexes;
	this.onComplete = onComplete;
	this.start = -1
	this.complete = function(time){
		return (time - this.start) > Constants.shiftAnimationTime;
	}
	this.render = function(time){	
		if(shift.start == -1) shift.start = time;
		//console.log("rendering shift. lasted: " + (time - shift.start));
		var offset = (time - shift.start) / Constants.shiftAnimationTime * moveBy;
		Grid.render();
		for (var i = hexes.length - 1; i >= 0; i--) {
			var hex = hexes[i];
			var hexOffset = offset * hex.distance;
			var pixel = Grid.pixelOf(hex.x, hex.y);
			Grid.renderAHex(pixel.x-hexOffset, pixel.y, 1, Grid.colorOf(hex.x, hex.y));
		};
		if(!shift.complete(time))
			requestAnimFrame(shift.render);
		else{
			//console.log("shift complete. duration: " + (time - shift.start));
			for (var i = 0; i < hexes.length; i++) {
				var coords = hexes[i];
				Grid.shouldDraw[coords.y][coords.x] = true;
			};
			shift.onComplete();
			Grid.locks -= 1;
			Grid.render();
			//console.log("shift complete. locks: " + Grid.locks);
		}
	}
}
function Vanish(hexes, onComplete){
	//console.log("Vanish created. hexes = ");
	//console.log(hexes);
	for (var i = 0; i < hexes.length; i++) {
		var coords = hexes[i];
		//console.log("coords.y: " + coords.y);
		Grid.shouldDraw[coords.y][coords.x] = false;
	};
	var vanish = this;
	this.hexes = hexes;
	this.onComplete = onComplete;
	this.start = -1
	this.complete = function(time){
		return (time - this.start) > Constants.vanishAnimationTime;
	}
	this.render = function(time){
		//console.log("start: " + vanish.start);
		if(vanish.start == -1) vanish.start = time;
		//console.log("rendering vanish. lasted: " + (vanish.start - time));
		//console.log("start: " + vanish.start);
		var gradient = 1 - (time - vanish.start) / Constants.vanishAnimationTime;
		Grid.render();
		for (var i = hexes.length - 1; i >= 0; i--) {
			var hex = hexes[i];
			var pixel = Grid.pixelOf(hex.x, hex.y);	
			//console.log("rendering hex at pixel");
			//console.log(pixel);
			Grid.renderAHex(pixel.x, pixel.y, gradient, Grid.colorOf(hex.x, hex.y));
		};
		if(!vanish.complete(time))
			requestAnimFrame(vanish.render);
		else{
			//console.log("vanish complete. duration: " + (time - vanish.start));
			for (var i = 0; i < hexes.length; i++) {
				var coords = hexes[i];
				Grid.shouldDraw[coords.y][coords.x] = true;
			};
			vanish.onComplete();
			Grid.locks -= 1;
			Grid.render();
			//console.log("vanish complete. locks: " + Grid.locks);
		}
	}
}
function Text(chain, info){
	//console.log("Made "+info+" animation: " + chain);
	var text = this;
	this.info = info;
	this.start = -1
	this.animationTime = Constants.textAnimationTime;
	this.complete = function(time){
		return (time - this.start) > text.animationTime;
	}
	var tile_width = Grid.canvas.width / Grid.hexes_wide
	var ctx = Grid.canvas.getContext("2d");
	this.render = function(time){
		if(text.start == -1) text.start = time;
		var gradient = (time - text.start) / text.animationTime;
		//console.log("animation gradient: " + gradient);
		Grid.render();
		
		var textHeight = Math.round(5 + gradient * chain*5);
		var textWidth = textHeight * 2;
		ctx.font= textHeight+"px Verdana";
		//console.log("font: " + ctx.font);
		// Create gradient
		var gradient=ctx.createLinearGradient(0,0,Grid.canvas.width,0);
		gradient.addColorStop("0","magenta");
		gradient.addColorStop("0.5","blue");
		gradient.addColorStop("1.0","red");
		// Fill with gradient
		ctx.fillStyle=gradient;
		ctx.fillText(chain, 300-textWidth*0.4, 200-textHeight*0.1);
		if(!text.complete(time))
			requestAnimFrame(text.render);
		else{
			Grid.locks -= 1;
			Grid.render();
			//console.log("vanish complete. locks: " + Grid.locks);
		}
	}
}
