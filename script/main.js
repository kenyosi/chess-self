/*
 * chess@self
 * Akashic content
*/

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Configuration
var conf                       = require('./content_config');

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Initialization
var piece                      = require('./piece');
// var player                     = require('./self/player');
var wm                         = require('./window_manager');
var help                       = require('./self/help');
var confirm                    = require('./self/confirm');

var cell_size_array            = [];
var i = 0;
while (i < 20) {
	cell_size_array[i] = i * conf.board.cell.size.x;
	i++;
}
var cell_size_x_m_1            = conf.board.cell.size.x - 1;
var cell_size_y_m_1            = conf.board.cell.size.y - 1;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function main() {
	wm.init();
	var scene = new g.Scene({game: g.game, assetIds: 
		['chess_pieces', 'help_screen', 'window_manager_icons']
	});
	wm.set_scene(scene);         		      // set window manager in scene
	piece.set_scene(scene);				      // set disks in scene
	scene.loaded.add(function () { // ev is for future use
		confirm.set_scene(scene);
		help.set_scene(scene, wm.view);				// set disks in scene
		// Help board
		help.create_board(conf.help_board, 0, 0);

		// Board area
		var ii = 0;
		while (ii < conf.board.size.x * conf.board.size.y) {
			var xy = indTo2D(ii, conf.board.size.x);
			scene.append(
				createBoard((xy[0] + xy[1]) % 2,
					cell_size_array[xy[0]] + conf.board.location.x0 + wm.view.position.x,
					cell_size_array[xy[1]] + conf.board.location.y0 + wm.view.position.y,
					cell_size_array[1], cell_size_array[1], scene
				)
			);
			++ii;
		}

		// Piece
		ii            = 0;
		while(ii < conf.piece.n) {
			xy = indTo2D(ii, conf.board.size.x);
			var details = {
				x: conf.piece.initial_location.x_ind[xy[0]] * conf.piece.initial_location.dx + conf.piece.initial_location.x + wm.view.position.x,
				y: conf.piece.initial_location.y_ind[xy[1]] * conf.piece.initial_location.dy + conf.piece.initial_location.y + wm.view.position.y,
				bw: ii,
				width: cell_size_x_m_1,
				height: cell_size_y_m_1,
				initial_index: ii,
				piece_index: conf.piece.piece_index[ii],
			};
			var d = piece.create(details);
			ii++;
		}
		piece.last[0] = d;
		piece.last[1] = d;

		var confirm_window = new confirm.create_window(1); // ci = 1 means checking player 1 only		// confirm = new wm.window_confirm(0); // ci = 1 means checking player 1 only

		// Create window manager
		var wm_create = function() {wm.create(confirm_window);};
		scene.setTimeout(wm_create, 100);
	});
	g.game.pushScene(scene);
}
module.exports = main;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function indTo2D(ii, dim) {
	var cood = [];
	cood[0] = ii % dim;
	cood[1] = (ii -  cood[0]) / dim;
	return cood;
}

function createBoard(index, x, y, w, h, scene) {
	return new g.FilledRect({
		scene: scene,
		cssColor: conf.board.cell.properties[index].cssColor,
		opacity: conf.board.cell.properties[index].opacity,
		x: x,
		y: y,
		width: w,
		height: h
	});
}
