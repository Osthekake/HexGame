function triggerKeyboardOn(what){
	window.addEventListener('keydown', function(event) {
	  switch (event.keyCode) {
	    case 37: // Left
	      	what.moveLeft();
	    	break;
	    case 38: // Up
	      	what.moveUp();
	    	break;
	    case 39: // Right
	      	what.moveRight();
	    	break;
	    case 40: // Down
	      	what.moveDown();
	    	break;
	    case 65: // a
	      	what.rotateCounterClockwise();
	    	break;
	    case 68: // d
	      	what.rotateClockwise();
	    	break;
	  }
	}, false);
}
