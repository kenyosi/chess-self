/*
 * Window manager
 * @self, Akashic content
 */
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Configuration
var conf                       = require('./content_config');
var view                       = {
	floating: false,
	position: {x: 0, y: 0},
	zoom: 1.0
};
module.exports.view = view;
// var help                       = {
// 	show: false,
// 	position: {x: 0, y: conf.help_board.height},
// };
var admin                      = {
	control: false,
	status_bottom: {
		true:  {flag: 'on', message: 'メンテナンス中(放送者のみ操作)'},
		false: {flag: 'off', message: ''}
	},
};
// var confirm                    = {
// 	result: false,
// };

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Initialization
var process                    = require('./self/process');
var player                     = require('./self/player');
var pointer                    = require('./self/pointer');
var common_control             = require('./self/common_control');
var help                       = require('./self/help');
var commenting                 = require('./self/commenting');
var piece                      = require('./piece');
var message_event              = require('./self/message_event_manager');
var statusbar                  = require('./self/statusbar');
var confirm                    = require('./self/confirm');
var semaphoe                   = new process.semaphore(1);
var admin_control              = new process.semaphore(1);
var player_operations = [];
var ii = 0;
while (ii < conf.players.max_players) {
	player_operations[ii] = new process.semaphore(conf.window.max_multi_operation);
	ii++;
}
var scene;
var index_pp                   = [];
var cell_size_array            = [];
var i = 0;
while (i < 20) {
	index_pp[i]        = (i + 1).toString();
	cell_size_array[i] = i * conf.board.cell.size.x;
	i++;
}

var login_controls             = [];
var status_bottom;
// var stack_objects              = [];
var player_objects;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports.view              = view;
module.exports.admin             = admin;
module.exports.index_pp          = index_pp;
module.exports.admin_control     = admin_control;
module.exports.semaphoe          = semaphoe;
module.exports.player_operations = player_operations;

function init() {
	player.init();
}
module.exports.init = init;

function set_scene(sc) {
	scene = sc;
	message_event.set_scene(scene);
	common_control.set_scene(sc);
	commenting.set_scene(scene);
	help.set_scene(scene, view);
}
module.exports.set_scene = set_scene;
function set_player_objects(obj) { player_objects = obj;}
module.exports.set_stack_objects = set_player_objects;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function draw_modified(rect, properies) {
	Object.keys(properies).forEach(function(key) {
		rect[key] = this[key];
	}, properies);
	return rect.modified();
}
module.exports.draw_modified = draw_modified;
function createAdminControl(x, y, w, h, style) {
	var group = common_control.create('window_manager_icons', x, y, w, h, style);
	group.pointUp.add(function (ev) {
		if (!player.validate_join(ev.player, 1)) return;
		if ((admin.control && player.get_group(ev.player.id) != 'admin')) return;
		admin.control = !admin.control;
		common_control.update_toggle(admin.status_bottom[admin.control].flag, style, group);
		status_bottom.set_message(admin.status_bottom[admin.control].message, -1);
	});
	return group;
}

function createLoginControl(target_player_index, x, y, w, h, style, confirm_object) {
	var group = common_control.create('window_manager_icons', x, y, w, h, style);
	group.tag = {
		target_player_index: target_player_index,
	};
	var name = new g.Label({
		scene: scene,
		font: conf.default_font,
		text: 'P' + index_pp[group.tag.target_player_index],
		fontSize: 14,
		textColor:  '#000000',
		x: 0,
		y: 0,
		touchable: false,
	});
	group.append(name);
	group.pointUp.add(function (ev) {
		if (!semaphoe.status()) return;
		if (!player.validate_join(ev.player, 1)) return;
		if (!player.is_login(1)) return;
		if (!confirm_object.show('P' + index_pp[group.tag.target_player_index] + 'を退席させます')) return;
		var confirm_interval = scene.setInterval(function () {
			if (semaphoe.status()) {
				// after confirmation
				scene.clearInterval(confirm_interval);
				if (!confirm.point_up.result) return;// commenting.post('操作を取り消します');
				// g.game.raiseEvent(new g.MessageEvent({destination: 'eval', message: 'player.logout(1,"")', souce: 'p2_logout'}));
				// status_bottom.set_message('', 1); // should be called before logout
				var player_index = player.find_index(g.game.player.id);
				if (player_index == group.tag.target_player_index) {
					status_bottom.set_message(admin.status_bottom[admin.control].message, group.tag.target_player_index);// should be called before logout
				}
				player.logout(group.tag.target_player_index, '');

			}// end of  after confirmation
		}, 100);
	});
	return group;
}

function createPlayAgainControl(x, y, w, h, style, confirm_object) {
	var group = common_control.create('window_manager_icons', x, y, w, h, style);
	group.pointUp.add(function (ev) {
		if (!semaphoe.status()) return;
		if (!player.validate_join(ev.player, 1)) return;
		if ((admin.control && player.get_group(ev.player.id) != 'admin')) return;
		if (!confirm_object.show('コマを元に戻します')) return;
		var confirm_interval = scene.setInterval(function () {
			if (semaphoe.status()) {
				scene.clearInterval(confirm_interval);
				// after confirmation
				if (!confirm.point_up.result) return;// commenting.post('操作を取り消します');
				// Initialize all semaphoes
				var jj = 0;
				while (jj < conf.players.max_players) {
					player_operations[jj].set_value(conf.window.max_multi_operation); // inital value
					pointer.pointers_pressed[jj].set_value(0); // inital value
					var ii = 0;
					var length_status = piece.status.length;
					while (ii < length_status) {
						var gid = piece.disk_id[ii];
						piece.status[gid].pointdown.processed[jj].set_value(0);
						ii++;
					}
					jj++;
				}
				piece.set_initial_places();
			}
		}, 100);
	});
	return group;
}


function update_common_style(flag, style, group) {
	draw_modified(group.children[0], style.background[flag]);
	draw_modified(group.children[1], style.icon[flag]);
}
module.exports.update_common_style = update_common_style;

function update_pointer_login(flag, player_index) {
	draw_modified(pointer_login[player_index], conf.window_icon.pointer.background[flag]);
}
module.exports.update_pointer_login = update_pointer_login;

var pointer_login = [];
function create(confirm_object) {
	// var camera_control = createCameraControl(cell_size_array[8], cell_size_array[8], cell_size_array[1], cell_size_array[1], conf.window_icon.camera);
	// scene.append(camera_control);
	var help_control       = help.create_control(g.game.width - cell_size_array[1], g.game.height - cell_size_array[1], cell_size_array[1], cell_size_array[1], conf.window_icon.help, []);
	scene.append(help_control);
	var play_again_control = createPlayAgainControl(g.game.width - cell_size_array[1], g.game.height - cell_size_array[2], cell_size_array[1], cell_size_array[1], conf.window_icon.restart_game, confirm_object);
	scene.append(play_again_control);
	var ii = 1;
	while(ii < conf.players.max_players) {
		var ypos = ii + 2;
		var pind = conf.players.max_players - ii;
		login_controls[pind] = createLoginControl(pind, g.game.width - cell_size_array[1], g.game.height - cell_size_array[ypos], cell_size_array[1], cell_size_array[1], conf.window_icon.login, confirm_object);
		scene.append(login_controls[pind]);
		ii++;
	}
	module.exports.login_controls = login_controls;
	scene.append(
		createAdminControl(g.game.width - cell_size_array[1], g.game.height - cell_size_array[ypos+1], cell_size_array[1], cell_size_array[1], conf.window_icon.admin)
	);

	pointer.set_scene(scene);

	status_bottom = new statusbar.bottom(conf.status_bar, scene);
	module.exports.status_bottom = status_bottom;

	var player_index = 0;
	while (player_index < conf.players.max_players) {
		var jj = conf.window.max_pointers - 1;
		while (jj > 0) {
			var pp = new pointer.user(player_index, jj, conf.players.window_pointer[player_index]);
			pp.pointer.hide();
			jj--;
		}
		var p = new pointer.user(player_index, 0, conf.players.window_pointer[player_index]);
		pointer_login[player_index] = p.pointer.children[1];
		pointer.update_by_operation('on', player_index, undefined);
		++player_index;
	}

	help.create_board(conf.help_board, 0, 0);
	player_index = player.find_index(g.game.player.id);
	pointer.update_by_operation('on', 0, undefined);
	pointer.update_by_operation('on', 1, undefined);
	commenting.post('使い方は右下の[？]アイコンをタップ下さい');
	if (player.caster_joined && !player.current[0].login) {
		status_bottom.set_message('ごめんなさい、P1の環境で動作しません', -1);
	}
}
module.exports.create = create;

function eInE (e0, e1, f) {
	f = (f === undefined ? [0, 0, 0, 0] : f);
	var zf = (view.zooming ? 0.5 : 1);
	var x0 = e0.x + e0.width  * (1 + f[0]) / 2.0 * zf;
	var x1 = e0.x + e0.width  * (1 - f[1]) / 2.0 * zf;
	var y0 = e0.y + e0.height * (1 + f[2]) / 2.0 * zf;
	var y1 = e0.y + e0.height * (1 - f[3]) / 2.0 * zf;
	return (x0 >= e1.x && x1 <= e1.x + e1.width * zf) && (y0 >= e1.y && y1 <= e1.y + e1.height * zf);
}
module.exports.eInE = eInE;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function show_objects(index) {
	var l = player_objects[index].length;
	var i = 0;
	while (i < l) {
		scene.children[player_objects[index][i]].show();
		++i;
	}
}
module.exports.show_objects = show_objects;
function hide_objects(index) {
	var l = player_objects[index].length;
	var i = 0;
	while (i < l) {
		scene.children[player_objects[index][i]].hide();
		++i;
	}
}
module.exports.hide_objects = hide_objects;
