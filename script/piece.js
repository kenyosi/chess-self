/*
 * Piece in board
 * chess@self, Akashic content
*/

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Configuration
var conf                       = require('./content_config');
var board_cell_half_size       = {x: conf.board.cell.size.x / 2, y: conf.board.cell.size.y / 2};
var n_disks0                   = conf.piece.n - 1;
var timeout_delta_frame        = 3 * g.game.fps;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Initialization
var scene;
// var commenting                 = require('./self/commenting');
var process                    = require('./self/process');
var player                     = require('./self/player');
var pointer                    = require('./self/pointer');
var wm                         = require('./window_manager');
var disk_id                    = [];
var index                      = [];
var last                       = [];
var status                     = {};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports.index           = index;
module.exports.last            = last;
module.exports.disk_id         = disk_id;
module.exports.status          = status;

function set_scene(sc) { scene = sc;}
module.exports.set_scene = set_scene;

var boundary = function (object) {
	this.width = object.width;
	this.height = object.height;
	this.x0 = 0;
	this.x1 = g.game.width - 2 * this.width; // <---
	this.y0 = 0;
	this.y1 = g.game.height - this.height;
};
boundary.prototype.set_start = function (xy) {
	this.start = {x: xy.x, y: xy.y};
};
boundary.prototype.force = function (ev, xy) {
	var x = this.start.x + ev.startDelta.x;
	x = (x <= this.x0 ? this.x0 : x);
	x = (x >= this.x1 ? this.x1 : x);
	xy.x = x;
	var y = this.start.y + ev.startDelta.y;
	y = (y <= this.y0 ? this.y0 : y);
	y = (y >= this.y1 ? this.y1 : y);
	xy.y = y;
	return xy;
};

function create(details) {
	var group = new g.E({
		scene: scene,
		x: details.x,
		y: details.y,
		width: details.width,
		height: details.height,
		scaleX: 1,
		scaleY: 1,
		touchable: true,
		tag: {
			type: 'piece',
			bw: details.bw,
			pointer_pressed: 0,
			last: [],
			initial: {
				index: details.initial_index,
				piece: details.piece_index,
				x: details.x,
				y: details.y,
			},
		},
	});
	var ii = 0;
	while (ii < conf.players.max_players) {
		group.tag.last[ii] = {
			ev: undefined,
			timestamp: g.game.age,
			pointer_pressed: 0,
		};
		ii++;
	}
	group.append(
		new g.FilledRect({
			scene: scene,
			cssColor: conf.piece.unselect.background.cssColor,
			opacity: conf.piece.unselect.background.opacity,
			width: details.width,
			height: details.height,
		}));
	group.append(
		new g.Sprite({
			scene: scene,
			src: scene.assets['chess_pieces'],
			opacity: conf.piece.on_board.opacity,
			width: details.width,
			height: details.height,
			angle: 0,
			srcX: conf.piece.src_xy[conf.piece.piece_index[details.bw]][0],
			srcY: conf.piece.src_xy[conf.piece.piece_index[details.bw]][1],
			srcWidth: details.width,
			srcHeight: details.height,
		}));

	group.update.add(function() {
		if (group.tag.pointer_pressed > 0) {
			ii = 0;
			while (ii < conf.players.max_players) {
				if ((group.tag.last[ii].timestamp + g.game.age) % g.game.fps == 0) {
					if(group.tag.last[ii].timestamp + timeout_delta_frame < g.game.age) {
						var ev = group.tag.last[ii].ev;
						place_disk(ev, group, ii, status[group.id]);
					}
				}
				ii++;
			}
		}
	});

	function set_last_status(pointer_pressed, player_index, ev, group) {
		group.tag.pointer_pressed += pointer_pressed;
		group.tag.last[player_index].ev = {
			x: group.x,
			y: group.y,
			pointerId: ev.pointerId,
			startDelta: {//require optimization
				x: (ev.startDelta === undefined ? 0 : ev.startDelta.x),
				y: (ev.startDelta === undefined ? 0 : ev.startDelta.y)
			},
		};
		group.tag.last[player_index].timestamp = g.game.age;
		group.tag.last[player_index].pointer_pressed += pointer_pressed;
	}
	function set_initial_pressed(player_index) {
		++player.current[player_index].player_plate;
		to_top(group.id, scene.children);
		status[group.id].pointdown.processed[player_index].signal();
		status[group.id].pointdown.timestamp[player_index] = g.game.age;
		// if (status[group.id].pointdown.in_board[player_index]) return;
		wm.draw_modified(last[player_index].children[0], conf.piece.unselect.background);
		wm.draw_modified(group.children[0], conf.players.item.operating[player_index]); // <---
		last[player_index] = group;
	}
	group.pointDown.add(function (ev) {
		if ((wm.admin.control && player.get_group(ev.player.id) != 'admin')) return;
		if (!wm.semaphoe.status()) return;
		if (!player.validate_join(ev.player, 0)) return;
		if (!status[group.id].events.process.status()) return;
		var player_index = player.find_index(ev.player.id);
		if (!wm.player_operations[player_index].wait()) return;
		status[group.id].pointdown.in_board[player_index]  = get_address_in_board(group).validate;
		status[group.id].pointdown.boundary[player_index].set_start(group);
		set_last_status(1, player_index, ev, group);// required
		set_initial_pressed(player_index);
	});
	group.pointMove.add(function (ev) {
		if ((wm.admin.control && player.get_group(ev.player.id) != 'admin')) return;
		if (!wm.semaphoe.status()) return;
		if (!player.validate_join(ev.player, 0)) return;
		if (!status[group.id].events.process.status()) return;
		var player_index = player.find_index(ev.player.id);
		//resume process
		if (!status[group.id].pointdown.processed[player_index].status()) { 
			if (!wm.player_operations[player_index].wait()) return;
			set_last_status(1, player_index, ev, group);// required
			set_initial_pressed(player_index);
			return;
		}
		if (!status[group.id].pointdown.processed[player_index].status()) return;
		if (!status[group.id].events.process.status()) return;
		set_last_status(0, player_index, ev, group);
		// force place piece if rapid movement.
		// var dxy = ev.prevDelta.x * ev.prevDelta.x + ev.prevDelta.y * ev.prevDelta.y
		// if (dxy > conf.window.max_prevDelta || true) {
		// place_disk(ev, group, status[group.id]);
		// return
		// }
		if (!wm.view.floating) {
			// group = status[group.id].pointdown.boundary[player_index].force(ev, group);
			var xy = {x: 0, y: 0};
			ii = 0;
			while (ii < conf.players.max_players) {
				if (status[group.id].pointdown.processed[ii].status()) {
					var pxy = {x: 0, y: 0};
					pxy = status[group.id].pointdown.boundary[ii].force(group.tag.last[ii].ev, pxy);
					xy.x += pxy.x;
					xy.y += pxy.y;
				}
				ii++;
			}
			group.x = xy.x / group.tag.pointer_pressed;
			group.y = xy.y / group.tag.pointer_pressed;
		}
		else {
			group.x -= ev.prevDelta.x;
			group.y -= ev.prevDelta.y;
		}
		group.modified();
	});
	group.pointUp.add(function (ev) {
		if (!player.validate(ev.player, 0)) return;
		var player_index = player.find_index(ev.player.id);
		if ((wm.admin.control && player.get_group(ev.player.id) != 'admin')) return;
		if (!wm.semaphoe.status()) return;
		if (!status[group.id].events.process.status()) return;
		if (group.tag.pointer_pressed <=0) return;
		place_disk(ev, group, player_index, status[group.id]);
	});

	function place_disk(ev, group, player_index, status) {
		if (!status.pointdown.processed[player_index].wait()) return;
		if (!wm.player_operations[player_index].signal()) return;
		--player.current[player_index].player_plate;
		if (group.tag.last[player_index].pointer_pressed <= 0) return;
		group.tag.last[player_index].pointer_pressed--;
		group.tag.pointer_pressed--;
		if (group.tag.pointer_pressed > 0) return;
		if (ev.pointerId === pointer.initial_pointer_id[player_index]) {
			wm.draw_modified(group.children[0], conf.players.item.waiting[player_index]);
			last[player_index] = group; // required set here again
		}
		else {
			wm.draw_modified(group.children[0], conf.piece.unselect.background);
		}
	}

	scene.append(group);
	disk_id.push(group.id);
	index.push(scene.children.length - 1);
	status[group.id] = {
		pointdown: {
			in_process: new process.semaphore(1),
			processed: [],
			in_board:  [],
			timestamp: [],
			boundary: [],
			last_timestamp: [],
			pointer_pressed: [],
		},
		events: {
			process: new process.semaphore(1),
		}
	};
	ii = 0;
	while (ii < conf.players.max_players) {
		status[group.id].pointdown.processed[ii] = new process.semaphore(0);
		status[group.id].pointdown.in_board[ii] = get_address_in_board(group).validate;
		status[group.id].pointdown.timestamp[ii] = g.game.age;
		status[group.id].pointdown.boundary[ii] = new boundary(conf.const.unit);
		status[group.id].pointdown.last_timestamp[ii] = g.game.age;
		status[group.id].pointdown.pointer_pressed[ii] = false;
		ii++;
	}

	return group;
}
module.exports.create = create;

function to_top(id, disks) {
	var this_disk_id_index = disk_id.indexOf(id);
	var this_index = index[this_disk_id_index];

	var b = disks[this_index];
	disks.splice(this_index, 1);
	disks.splice(index[n_disks0], 0, b);

	var c = disk_id[this_disk_id_index];
	disk_id.splice(this_disk_id_index, 1);
	disk_id.splice(n_disks0, 0, c);
}
module.exports.to_top = to_top;

function get_address_in_board(d) {
	var address = {};
	var x = d.x - conf.board.location.x0 - wm.view.position.x;
	var y = d.y - conf.board.location.y0 - wm.view.position.y;
	address.x = parseInt(x / (conf.board.cell.size.x * wm.view.zoom) + 0.5);
	address.y = parseInt(y / (conf.board.cell.size.y * wm.view.zoom) + 0.5);
	address.validate = (
		x >= - board_cell_half_size.x && y >= - board_cell_half_size.y
		&& address.x >= 0 && address.x < conf.board.size.x
		&& address.y >= 0 && address.y < conf.board.size.y
	);
	return address;
}
module.exports.get_address_in_board = get_address_in_board;

function set_initial_places() {
	var ii = 0;
	while(ii < conf.piece.n) {
		var pp = scene.children[index[ii]];
		wm.draw_modified(pp.children[0], conf.piece.unselect.background);
		// var details = conf.initial_pieces[pp.tag.initial_index];
		pp.x = pp.tag.initial.x;
		pp.y = pp.tag.initial.y;
		// pp.children[1].srcX = details.srcX;
		// pp.children[1].srcY = details.srcY;
		// pp.children[1].modified();
		pp.modified();
		ii++;
	}
}
module.exports.set_initial_places = set_initial_places;
