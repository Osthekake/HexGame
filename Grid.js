var HexColor = [
	"red", "yellow", "green", "blue", "orange", "pink", "gray", "magenta", "cyan", "lime"
]

var Grid = {
	canvas : undefined,
	hexes : [],
	points : 0,
	chain: [],
	combo: 0,
	shouldDraw : [],
	hexes_wide: 7,
	hexes_high: 7,
	cursor: {x:1, y:1},
	locks: 0,
	lock: function(){
		//console.log("locks: " + Grid.locks);
		return Grid.locks > 0;	
	},
	init: function(){
		Grid.hexes = [];
		Grid.shouldDraw = [];
		for (var y = 0; y < Grid.hexes_high; y++) {
			Grid.hexes.push([]);
			Grid.shouldDraw.push([]);
			for (var x = Grid.hexes_wide - 1; x >= 0; x--) {
				Grid.hexes[y].push(Math.floor((Math.random() * HexColor.length)));
				Grid.shouldDraw[y].push(true);
			}
		};
		Grid.points = 0;
		Grid.pointsHTML.innerHTML = 0;
		Grid.render();
		Grid.locks = 0;
	},
	hexAt: function(x, y){
		if(x<0 || x> Grid.hexes_wide-1 || y<0 || y > Grid.hexes_high-1)
			return -1;
		if(!Grid.hexes[y])
			console.log("hexes["+y+"]: "+Grid.hexes[y]);
		return Grid.hexes[y][x];
	},
	setHex: function(x, y, what){
		Grid.hexes[y][x] = what;
	},
	pixelOf: function(x, y){
		var tile_width = Grid.canvas.width / Grid.hexes_wide;
		var tile_height = Grid.canvas.height / Grid.hexes_high;
		var radius = tile_width/2;	
		var centerX =  x*tile_width + radius * (1+ (y+1)%2) ;
		var centerY =  y*tile_height + radius;
		return {x:centerX, y:centerY};		
	},
	colorOf: function(x, y){
		var key = Grid.hexes[y][x];
		if(key < 0){ 
			//console.log("Wanted color of " + x + ", " + y);
			return "transparent";
		}
		else return HexColor[key];
	},
	renderAHex: function(centerX, centerY, radiusfactor, fillStyle){
		var context = Grid.canvas.getContext("2d");
		var tile_width = Grid.canvas.width / Grid.hexes_wide;
		//var tile_height = Grid.canvas.height / Grid.hexes_high;
		
		var radius = tile_width/2;	
		var alteredRadius = radius * radiusfactor;
				
		context.fillStyle = fillStyle;

		context.beginPath();
		context.moveTo(centerX, centerY + alteredRadius);
		for(var i = 0; i < 6; i++){
			var radians = Math.PI*i/3;
			//console.log("radians " + radians);

			//console.log("x " + centerX + Math.sin(radians)*radius + ", y " + centerY + Math.cos(radians)*radius );
			context.lineTo(centerX + Math.sin(radians)*alteredRadius, centerY + Math.cos(radians)*alteredRadius );
		}
		context.closePath();
		context.fill();
	},
	render: function() {
		var context = Grid.canvas.getContext("2d");

		context.lineWidth = 5;
		context.strokeStyle = "black";
		context.save();
		context.clearRect(0, 0, Grid.canvas.width, Grid.canvas.height);
		//console.log("rendering:");
		//console.log(Grid.hexes);
		for (var y = Grid.hexes_high - 1; y >= 0; y--) {
			for (var x = Grid.hexes_wide - 1; x >= 0; x--) {
				if(!Grid.shouldDraw[y][x])
					continue;
				if(Grid.hexAt(x, y) < 0)
					continue;
				var fillStyle = Grid.colorOf(x, y);
				var pixel = Grid.pixelOf(x, y);
				Grid.renderAHex(pixel.x, pixel.y, 1, fillStyle);
				if(Grid.cursor.x == x && Grid.cursor.y == y && ! Grid.lock()){
					context.stroke();
				}
				
			};
		}
		context.restore();
	},
	moveLeft: function(){
		if(Grid.lock())
			return;
		Grid.cursor.x -= 1;
		if(Grid.cursor.x < 1)
			Grid.cursor.x = 1;
		Grid.render();
	},
	moveUp: function(){
		if(Grid.lock())
			return;
		Grid.cursor.y -= 1;
		if(Grid.cursor.y < 1)
			Grid.cursor.y = 1;
		Grid.render();
	},
	moveRight: function(){
		if(Grid.lock())
			return;
		Grid.cursor.x += 1;
		if(Grid.cursor.x > Grid.hexes_wide-2)
			Grid.cursor.x = Grid.hexes_wide-2;
		Grid.render();
	},
	moveDown: function(){
		if(Grid.lock())
			return;
		Grid.cursor.y += 1;
		if(Grid.cursor.y > Grid.hexes_high-2)
			Grid.cursor.y = Grid.hexes_high-2;
		Grid.render();
	},
	rotateCounterClockwise: function(){
		if(Grid.lock())
			return;
		Go();
		Animation.rotate(false, Grid.cursor, function(){
			var right = Grid.hexAt(Grid.cursor.x+1, Grid.cursor.y);
			var left = Grid.hexAt(Grid.cursor.x-1, Grid.cursor.y);
			var topleft = Grid.hexAt(Grid.cursor.x - Grid.cursor.y%2, Grid.cursor.y-1);
			var topright = Grid.hexAt(Grid.cursor.x - Grid.cursor.y%2 + 1, Grid.cursor.y-1);
			var bottomleft = Grid.hexAt(Grid.cursor.x - Grid.cursor.y%2, Grid.cursor.y+1);
			var bottomright = Grid.hexAt(Grid.cursor.x - Grid.cursor.y%2 + 1, Grid.cursor.y+1);
			Grid.setHex(Grid.cursor.x+1, Grid.cursor.y, bottomright);//former right
			Grid.setHex(Grid.cursor.x-1, Grid.cursor.y, topleft);//former left
			Grid.setHex(Grid.cursor.x - Grid.cursor.y%2, Grid.cursor.y-1, topright);//former topleft
			Grid.setHex(Grid.cursor.x - Grid.cursor.y%2 + 1, Grid.cursor.y-1, right);//former topright
			Grid.setHex(Grid.cursor.x - Grid.cursor.y%2, Grid.cursor.y+1, left);//former bottomleft
			Grid.setHex(Grid.cursor.x - Grid.cursor.y%2 + 1, Grid.cursor.y+1, bottomleft);//former bottomright
			Grid.render();
			Grid.checkForThreeInARow();
		});
	},
	rotateClockwise: function(){
		if(Grid.lock())
			return;
		Go();
		Animation.rotate(true, Grid.cursor, function(){
			var right = Grid.hexAt(Grid.cursor.x+1, Grid.cursor.y);
			var left = Grid.hexAt(Grid.cursor.x-1, Grid.cursor.y);
			var topleft = Grid.hexAt(Grid.cursor.x - Grid.cursor.y%2, Grid.cursor.y-1);
			var topright = Grid.hexAt(Grid.cursor.x - Grid.cursor.y%2 + 1, Grid.cursor.y-1);
			var bottomleft = Grid.hexAt(Grid.cursor.x - Grid.cursor.y%2, Grid.cursor.y+1);
			var bottomright = Grid.hexAt(Grid.cursor.x - Grid.cursor.y%2 + 1, Grid.cursor.y+1);
			Grid.setHex(Grid.cursor.x+1, Grid.cursor.y, topright);//former right
			Grid.setHex(Grid.cursor.x-1, Grid.cursor.y, bottomleft);//former left
			Grid.setHex(Grid.cursor.x - Grid.cursor.y%2, Grid.cursor.y-1, left);//former topleft
			Grid.setHex(Grid.cursor.x - Grid.cursor.y%2 + 1, Grid.cursor.y-1, topleft);//former topright
			Grid.setHex(Grid.cursor.x - Grid.cursor.y%2, Grid.cursor.y+1, bottomright);//former bottomleft
			Grid.setHex(Grid.cursor.x - Grid.cursor.y%2 + 1, Grid.cursor.y+1, right);//former bottomright
			Grid.render();	
			Grid.checkForThreeInARow();
		});
	},
	checkForThreeInARow: function(){
		var toBeRemoved = [];
		Grid.locks += 1
		//console.log("threeinarowcheck. locks: " + Grid.locks);
		for (var y = Grid.hexes.length - 1; y >= 0; y--) {
			for (var x = Grid.hexes_wide - 1; x >= 0; x--) {
				var current = Grid.hexAt(x, y);  
				var right = Grid.hexAt(x+1, y);
				var left = Grid.hexAt(x-1, y);
				var topleft = Grid.hexAt(x - y%2, y-1);
				var topright = Grid.hexAt(x - y%2 + 1, y-1);
				var bottomleft = Grid.hexAt(x - y%2, y+1);
				var bottomright = Grid.hexAt(x - y%2 + 1, y+1);	
				if(current == left && current == right){
					Grid.combo += 1;
					toBeRemoved.push({x:x, y:y});
					toBeRemoved.push({x:x+1, y:y});
					toBeRemoved.push({x:x-1, y:y});
				}
				if(current == topleft && current == bottomright){
					Grid.combo += 1;
					toBeRemoved.push({x:x, y:y});
					toBeRemoved.push({x:x - y%2, y:y-1});
					toBeRemoved.push({x:x - y%2 + 1, y:y+1});
				}
				if(current == topright && current == bottomleft){
					Grid.combo += 1;
					toBeRemoved.push({x:x, y:y});
					toBeRemoved.push({x:x - y%2 + 1, y:y-1});
					toBeRemoved.push({x:x - y%2, y:y+1});
				}
			}
		}
		if(Grid.combo > 0)
			Grid.chain.push(Grid.combo*Grid.combo);
		if(Grid.combo > 1){
		//	console.log("Combo! " + Grid.combo);
		//	Animation.obnoxiousText(Grid.combo, "combo");
		}
		Grid.combo = 0;
		var uniq = toBeRemoved.unique();
		if(uniq.length > 0)
			Animation.vanish(uniq, function(){
				Grid.removeAll(uniq);
				Grid.render();
			});
		else{
			var calculatedPoints = 0;
			for (var i = Grid.chain.length - 1; i >= 0; i--) {
				calculatedPoints += Grid.chain[i] + 1;
			}
			calculatedPoints *= Grid.chain.length * Grid.chain.length;
			//console.log("Chain! " + Grid.chain.length);
			if(calculatedPoints >= 6){
				Animation.obnoxiousText(calculatedPoints, "chain");
				Timer.time += 5000;
			}
			Grid.points += calculatedPoints;
			Grid.pointsHTML.innerHTML = Grid.points;
			Grid.chain = [];
		}
		Grid.locks -= 1;
		//console.log("threeinarowcheck complete. locks: " + Grid.locks);
	},
	removeAll : function(dead){
		//console.log("dead:");
		//console.log(dead);
		for (var i = dead.length - 1; i >= 0; i--) {
			var coords = dead[i];
			Grid.setHex(coords.x, coords.y, -1);
			var newhex = Math.floor((Math.random() * HexColor.length));
			//console.log("new hex is " + HexColor[newhex]);
			Grid.hexes[coords.y].push(newhex);
		}
		Grid.shiftAll();
	},	
	shiftAll : function(){
		Grid.locks += 1;
		var shifted = [];
		for (var y = 0; y < Grid.hexes_high; y++) {
			var row = Grid.hexes[y];
			var foundEmpty = false;
			var empties = 0;
			for (var x = 0; x < row.length; x++) {
				if(row[x]==-1){
					foundEmpty = true;
					empties += 1;
					shifted.push({x:x, y:y, distance:empties});
				} else if(foundEmpty)
					shifted.push({x:x, y:y, distance:empties});
			}
		}
		shifted = shifted.unique();
		if(shifted.length > 0){
			//console.log("shifting " + shifted.length + " tiles...");
			Animation.shiftLeft(shifted, function(){
				for (var y = 0; y < Grid.hexes_high; y++) {
					var row = Grid.hexes[y];
					for (var x = 0; x < row.length; x++) {
						if(row[x] < 0){
							//console.log("removing overshifted hex: " + x + ", " + y);
							row.splice(x, 1);
							x-=1;
							//console.log("row length: "+ row.length);
						}
					}
				}
				Grid.checkForThreeInARow();//Grid.shiftAll();
				Grid.locks -= 1;
				//Grid.render();
			});
		}else{
			Grid.checkForThreeInARow();
			Grid.locks -= 1;
			Grid.render();
		}
	}
};

Array.prototype.unique = function () {
    var r = new Array();
    o:for(var i = 0, n = this.length; i < n; i++)
    {
    	for(var x = 0, y = r.length; x < y; x++)
    	{
    		if(JSON.stringify(r[x])==JSON.stringify(this[i]))
    		{
                //alert('this is a DUPE!');
    			continue o;
    		}
    	}
    	r[r.length] = this[i];
    }
    return r;
}
