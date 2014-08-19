//console.log("In store: " + localStorage.getItem("highscore"));

var HighScore = {
	list: eval(localStorage.getItem("highscore")),
	renderTarget: undefined,
	makeHTML: function(){
		if(!HighScore.list){
			HighScore.list = [];
			HighScore.list.length = 10;
		}
		var html = "<ol>";
		for (var i = 0; i < HighScore.list.length; i++) {
			if(HighScore.list[i])
				html += "<li>"+HighScore.list[i]+"</li>";
			else
				html += "<li> --- </li>";
		};
		return html + "</ol>";
	},
	enter: function(entry){
		if(!HighScore.list)
			HighScore.list = [];
		var free = HighScore.list.indexOf(undefined)
		if(free > 0)
			HighScore.list[free] = entry;
		else{
			HighScore.list.push(entry);
			HighScore.list.sort(function(a, b){return b-a});
			HighScore.list.splice(10, 1);
		}
		localStorage.setItem("highscore", JSON.stringify(HighScore.list));
		if(HighScore.renderTarget)
			HighScore.renderTarget.innerHTML = HighScore.makeHTML();
	},
	populate: function(target){
		HighScore.renderTarget = target;
		target.innerHTML = HighScore.makeHTML();
//		console.log("rendered high score with " + HighScore.list.length + " elements.");
	},
	clear: function(){
		console.log("Clearing high score.");
		localStorage.setItem('highscore', 'undefined');
		HighScore.list = undefined;
		if(HighScore.renderTarget)
			HighScore.renderTarget.innerHTML = HighScore.makeHTML();
	}
}