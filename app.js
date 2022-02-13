define(function (require) {
	var $ = require("jquery"),
		_ = require("lodash"),
		monster = require("monster");

		//generate random number/ID
		//const genRandHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');


	var app = {
		name: "switchboard",

		css: ["app"],

		i18n: {
			"en-US": { customCss: false },
		},

		// Defines API requests not included in the SDK
		requests: {},

		// Define the events available for other apps
		subscribe: {},

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		load: function (callback) {
			var self = this;

			self.initApp(function () {
				callback && callback(self);
			});
		},

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		initApp: function (callback) {
			var self = this;

			// Used to init the auth token and account id of this app
			monster.pub("auth.initApp", {
				app: self,
				callback: callback,
			});
		},

		//////////////////////////////////////////////////////////
		// Entry Point of the app
		//////////////////////////////////////////////////////////
		render: function(container) {
			var self = this,
/*
				$container = _.isEmpty(container)
					? $("#monster_content")
					: container,
				$layout = $(
					self.getTemplate({
						name: "layout",
					})
				);
*/
				container = container || $('#monster_content');

			// Get the initial dynamic data we need before displaying the app
			//self.listDevices(function(data) {
			self.getFullDevices(function(data) {
				//console.log(data);
				// Load the data in a Handlebars template
				var switchboardTemplate = $(self.getTemplate({
					name: 'layout',
					data: {
						devices: data
					}
				}));

				// Bind UI and Socket events
				self.bindUIEvents(switchboardTemplate);
				self.bindSocketsEvents(switchboardTemplate, data);

				// Once everything has been attached to the template, we can add it to our main container
				(container)
					.empty()
					.append(switchboardTemplate);
				self.setCurrentCallStatus(switchboardTemplate);
			});
/*
			self.bindEvents({
				template: $layout,
			});
			$container.empty().append($layout); //draw the main part of the page in views/layout.html

*/
		},

		// Binding Events
		bindUIEvents: function(template) {
			var self = this;

			template.find("[data-toggle='toggle']").click(function() {
				var selector = $(this).data('target');
				template.find(selector).toggleClass('smashed-horizontally');
			});

			template.find('#clearEvents').on('click', function() {
				template.find('.table tbody tr:not(.no-events)').remove();
			});

			template.find('.device-item').on('click', function() {
				var isInactive = !$(this).hasClass('active');
				template.find('.device-item').removeClass('active');

				template.find('table tbody tr').removeClass('inactive');

				if (isInactive) {
					var	id = $(this).data('id');

					if (id !== '') {
						$(this).addClass('active');
						template.find('table tbody tr:not([data-deviceid="' + id + '"])').addClass('inactive');
					}
				}
			});
		},

		callStates: {
			"CHANNEL_CREATE": "Ringing...",
			"CHANNEL_ANSWER": "In Call",
			"CHANNEL_DESTROY": "Idle",
			"CHANNEL_HOLD": "Hold",
			"CHANNEL_UNHOLD": "In Call",
			"PARK_PARKED": "Parked",
			"PARK_RETRIEVED": "Retrieved",
			"PARK_ABANDONED": "Abandoned"
		},

		indicatorIcons: {
			standby_icon: 'fa-circle',
			//inbound_icon: 'fa-mail-reply',
			//outbound_icon: 'fa-mail-forward',
			inbound_icon: 'fa-arrow-down',
			outbound_icon: 'fa-arrow-up'
		},

		bindSocketsEvents: function(template) {
			var self = this;

			var	addEvent = function(data) {
				var ev = self.formatEvent(data),
					eventTemplate = $(self.getTemplate({
						name: 'event',
						data: ev
					}));
				if (ev.extra.hasOwnProperty('deviceId')) {
					monster.ui.highlight(template.find('.device-item[data-id="' + ev.extra.deviceId + '"]'));
				}
				template.find('.no-events').css('display', 'none');
				template.find('.list-events tbody').prepend(eventTemplate);
			};

			/*
			var flashing = setInterval(function (id) {
				template.find('.flashing').fadeOut(200);
				template.find('.flashing').fadeIn(200);
			}, 100)
			*/

			var onCalling = function(event) {
				var ev = self.formatEvent(event);
				if (ev.extra.deviceId) {
					var el = template.find('#'+ev.extra.deviceId);
					self.updateDeviceCalling(el, event);
				}
			};

			var onCall = function(event) {
				var ev = self.formatEvent(event);
				if (ev.extra.deviceId) {
					var el = template.find('#'+ev.extra.deviceId);
					//console.log(el);
					self.updateDeviceOnCall(el, event);
				}
			};

			var onHangup = function(event) {
				var ev = self.formatEvent(event);
				if (ev.extra.deviceId) {
					var el = template.find('#'+ev.extra.deviceId);
					self.updateDeviceOffCall(el, event);
				}
			};

			var onHold = function(event) {
				var ev = self.formatEvent(event);
				if (ev.extra.deviceId) {
					var el = template.find('#'+ev.extra.deviceId);
					self.updateDeviceHold_on(el, event);
				}
			};

			var onResume = function(event) {
				var ev = self.formatEvent(event);
				if (ev.extra.deviceId) {
					var el = template.find('#'+ev.extra.deviceId);
					self.updateDeviceHold_off(el, event);
				}
			};

			self.subscribeWebSocket({
				binding: 'call.CHANNEL_CREATE.*',
				requiredElement: template,
				callback: function(event) {
					onCalling(event);
					addEvent(event);
				},
				error: (err) => { console.log("Error in subscribe!"); console.log(err); }
			});
			self.subscribeWebSocket({
				binding: 'call.CHANNEL_ANSWER.*',
				requiredElement: template,
				callback: function(event) {
					onCall(event);
					addEvent(event);
				},
				error: (err) => { console.log("Error in subscribe!"); console.log(err); }
			});
			self.subscribeWebSocket({
				binding: 'call.CHANNEL_DESTROY.*',
				requiredElement: template,
				callback: function(event) {
					onHangup(event);
					addEvent(event);
				},
				error: (err) => { console.log("Error in subscribe!"); console.log(err); }
			});
			self.subscribeWebSocket({
				binding: 'call.CHANNEL_HOLD.*',
				requiredElement: template,
				callback: function(event) {
					onHold(event);
					addEvent(event);
				},
				error: (err) => { console.log("Error in subscribe!"); console.log(err); }
			});
			self.subscribeWebSocket({
				binding: 'call.CHANNEL_UNHOLD.*',
				requiredElement: template,
				callback: function(event) {
					onResume(event);
					addEvent(event);
				},
				error: (err) => { console.log("Error in subscribe!"); console.log(err); }
			});

			/*
			self.subscribeWebSocket({
				binding: 'call.PARK_PARKED.*',
				requiredElement: template,
				callback: function(event) {
					addParkedCall(event);
					addEvent(event);
				}
			});
			self.subscribeWebSocket({
				binding: 'call.PARK_RETRIEVED.*',
				requiredElement: template,
				callback: function(event) {
					retrieveParkedCall(event);
					addEvent(event);
				}
			});
			self.subscribeWebSocket({
				binding: 'call.PARK_ABANDONED.*',
				requiredElement: template,
				callback: function(event) {
					abandonedParkedCall(event);
					addEvent(event);
				}
			});
			*/
			
		}, //bindSocketsEvents

		padTime: function(val) {
			var valString = val + "";
			if (valString.length < 2) {
				return "0" + valString;
			} else {
				return valString;
			}
		},

		updateDeviceCalling: function(el, ev) {
			var self = this;
			el.css('background-color', '#ffeff0');
			el.find('.ringer').css('background-color', 'red');
			el.find('i.indicator_icon').show();
			el.find('i.indicator_icon').css('color', 'royalblue');
			el.find('.ringer').addClass('ringing');
			el.find('div.dev_status').html(self.callStates[ev.event_name]);
			el.find('span.remote_status').html('Calling: ');
			el.find('span.remote_name').html(ev.extra.remote_name);
			el.find('span.remote_number').html(ev.extra.remote_number);
			el.find('i.call_direction').removeClass('fa-circle');
			if (ev.call_direction == 'outbound') {
				el.find('i.call_direction').addClass(self.indicatorIcons.inbound_icon);
			} else {
				el.find('i.call_direction').addClass(self.indicatorIcons.outbound_icon);
			}
		},

		updateDeviceOnCall: function(el, ev) {
			var self = this;
			el.css('background-color', '#ededed');
			el.find('.ringer').css('background-color', 'orange');
			el.find('.ringer').removeClass('ringing');
			el.find('i.indicator_icon').show();
			el.find('i.indicator_icon').addClass('rotation');
			el.find('i.indicator_icon').css('color', 'red');
			el.find('.call_indicator').addClass('oncall');
			el.find('.call_indicator').css('background-color', 'red');
			el.find('.dev_status').html(self.callStates[ev.event_name]);
			el.find('.remote_status').html('Talking: ');
			let callTime = 0;
			if (ev.elapsed_s) { //this is an existing channel, so we set calltime to match
				callTime = ev.elapsed_s;
			}
			el.find('.call_timer_minutes').html('00');
			el.find('.call_timer_seconds').html('00');
			el.find('.call_timer').attr('data-timer',
				setInterval(function() {
					callTime = callTime + 1;
					el.find('.call_timer_seconds').html(self.padTime(callTime % 60));
					el.find('.call_timer_minutes').html(self.padTime(parseInt(callTime / 60)));
				}, 1000));
			el.find('.call_timer').show();
		},

		updateDeviceOffCall: function(el, ev) {
			var self = this;
			clearInterval(el.find('.flasher').attr('data-flasher'));
			clearInterval(el.find('.device-call_indicator').attr('data-flasher'));
			el.css('background-color', 'white');
			el.find('i.indicator_icon').removeClass('rotation');
			el.find('i.indicator_icon').css('color', '#333');
			el.find('.call_indicator').css('background-color', 'royalblue');
			el.find('.call_indicator').removeClass('oncall');
			el.find('.ringer').css('background-color', '#00ef33'); //green
			el.find('.ringer').removeClass('ringing');
			el.find('.dev_status').html(self.callStates[ev.event_name]);
			el.find('i.call_direction').removeClass(self.indicatorIcons.outbound_icon);
			el.find('i.call_direction').removeClass(self.indicatorIcons.inbound_icon);
			el.find('i.call_direction').addClass(self.indicatorIcons.standby_icon);
			el.find('div.to').html('');
			el.find('div.from').html('');
			el.find('.remote_status').html('');
			el.find('.remote_name').html('');
			el.find('.remote_number').html('');
			clearInterval(el.find('.call_timer').attr('data-timer'));
			el.find('.call_timer').hide();
		},

		updateDeviceHold_on: function(el, ev) {
			var self = this;
			el.css('background-color', 'grey');
			el.addClass('on_hold');
			el.find('i.indicator_icon').removeClass('rotation');
			el.find('.call_indicator').css('background-color', 'black');
			el.find('.dev_status').html(self.callStates[ev.event_name]+'<br />');
			el.find('.remote_status').html('On Hold: ');
		},

		updateDeviceHold_off: function(el, ev) {
			var self = this;
			el.css('background-color', '#ededed');
			el.removeClass('on_hold');
			el.find('i.indicator_icon').addClass('rotation');
			el.find('.call_indicator').css('background-color', 'red');
			el.find('.dev_status').html(self.callStates[ev.event_name]+'<br />');
			el.find('.remote_status').html('Talking: ');
		},

		// Formatting data
		formatEvent: function(data) {
			var self = this;
			var	ev = data;
			//console.log(data)
			if (!ev.event_name) { //channels don't have event_name, so we try to create it
				if (!ev.answered) {
					ev.event_name = 'CHANNEL_CREATE';
				}
				if (ev.is_onhold) {
					ev.event_name = 'CHANNEL_HOLD';
				} else {
					ev.event_name = 'CHANNEL_ANSWER';
				}
				if (ev.parked_call) {
					ev.event_name = 'PARK_PARKED';
				}
			}
			ev.extra = {};
			ev.extra.friendlyEvent = self.i18n.active().switchboard.events[data.event_name];
			ev.extra.classEvent = data.event_name === 'CHANNEL_CREATE' ? 'error' : (data.event_name === 'CHANNEL_ANSWER' ? 'warning' : 'success');
			if ('custom_channel_vars' in data && 'authorizing_type' in data.custom_channel_vars && data.custom_channel_vars.authorizing_type === 'device') {
				ev.extra.deviceId = data.custom_channel_vars.authorizing_id;
			} else {
				if ('authorizing_type' in ev && ev.authorizing_type === 'device') {
					ev.extra.deviceId = ev.authorizing_id;
				}
			}
			if (ev.hasOwnProperty('to')) {
				ev.extra.to = data.to.substr(0, data.to.indexOf('@'));
			} else if (ev.destination) {
				ev.extra.to = ev.destination;
			}
			if (!ev.caller_id_name) {
				ev.caller_id_name = "";
			}
			if (!ev.callee_id_name) {
				ev.callee_id_name = "";
			}
			if (!ev.callee_id_number && ev.destination) {
				ev.callee_id_number = ev.destination;
			}
			//set friendly remote end
			if (ev.call_direction == 'outbound') { //incoming call is "outbound" from Kazoo
				ev.extra.remote = ev.caller_id_name+' '+ev.caller_id_number;
				ev.extra.remote_name = ev.caller_id_name;
				ev.extra.remote_number = ev.caller_id_number;
			} else { //outbound call
				ev.extra.remote = ev.callee_id_name+' '+ev.extra.to;
				ev.extra.remote_name = ev.callee_id_name;
				ev.extra.remote_number = ev.extra.to;
			}

			//console.log(ev);
			return ev;
		},

		setCurrentCallStatus: function(template) {
			var self = this;
			self.getChannels( (channels) => {
				//console.log(channels);
				channels.forEach( (chan) => {
					let channel = self.formatEvent(chan);
					//console.log(channel);
					if (channel.extra.deviceId) {
						var el = template.find('#'+channel.extra.deviceId);
						if (!channel.answered) { //ringing
							self.updateDeviceCalling(el, channel);
						} else { //call in progress
							self.updateDeviceOnCall(el, channel);
							if (channel.is_onhold) { //call in progress on hold
								self.updateDeviceHold_on(el, channel);
							}
						}
					}
				});
			});
		},

		getFullDevices: function(callback) {
			var self = this;
			self.listDevices(function(alldevices) {
				self.listRegisteredDevices(alldevices, function(registered_devices) {
					self.addOwnerToDevices(registered_devices, function(devices_with_owners) {
						self.addDetailToDevices(devices_with_owners, function(devices_with_details) {
							self.addHotdeskUsersToDevices(devices_with_details, function(devices) {
								self.addExtensionsToDevices(devices, function(devices_full) {
									//console.log(devices_full.length);
									callback(devices_full);
								});
							});
						});
					});
				});
			});
		},

		getChannels: function(callback) {
			var self = this;
			self.callApi({
				resource: 'channel.list',
				data: {
					accountId: self.accountId
				},
				success: function(channels) {
					callback(channels.data);
				},
				error: function(err) {
					console.log("Error getting account channels:");
					console.log(err);
					callback([]);
				}
			});
		},

		addOwnerToDevices: function(devices, callback) {
			var self = this;
			let outputDevices =	[];
			let done = new Promise((resolve, reject) => {
				if (devices.length == 0) resolve();
				devices.forEach(function(device) {
					self.getUser(device.owner_id, function(user) {
						device.user = user;
						outputDevices.push(device);
						if (outputDevices.length == devices.length) resolve();
					});		
				});
			});
			done.then(() => {
				callback(outputDevices);
			});
		},

		addDetailToDevices: function(devices, callback) {
			var self = this;
			let outputDevices = [];
			let done = new Promise((resolve, reject) => {
				if (devices.length == 0) resolve();
				devices.forEach(function(device) {
						self.getDevice(device.id, function(details) {
						device.detail = details;
						outputDevices.push(device);
						if (outputDevices.length == devices.length) resolve();
					});		
				});
			});
			done.then(() => {
				callback(outputDevices);
			});
		},

		addHotdeskUsersToDevices: function(devices, callback) {
			var self = this;
			let outputDevices = [];
			let done = new Promise((resolve, reject) => {
				if (devices.length == 0) resolve();
				//console.log(devices.length);
				devices.forEach(function(device) {
					self.addHotdeskUsersToDevice(device, function(device_w_hdu) {
						//console.log(device.id);
						outputDevices.push(device_w_hdu);
						if (outputDevices.length == devices.length) resolve();
					});
				});
			});
			done.then(() => {
				callback(outputDevices);
			});
		},

		addHotdeskUsersToDevice: function(device, callback) {
			var self = this;
			let hotdesk_users = [];
			//device.hotdesk_users = [];
			device.hotdesked = false;
			device.current_extension_status = 'ext_active';
			let done = new Promise((resolve, reject) => {
				if (device.detail) {
					if (device.detail.hotdesk) {
						if (device.detail.hotdesk.users) {
							hd_users = Object.keys(device.detail.hotdesk.users);
							//console.log("hd_users length "+hd_users.length+":");
							//console.log(hd_users);
							var targetLength = hd_users.length;
							if (hd_users.length === 0) {
								resolve();
							}
								hd_users.forEach(function(userid, idx) {
									device.hotdesked = true;
									device.current_extension_status = 'ext_override';
									//console.log("Dev ID: "+device.id+" has hotdesk user: "+userid);
									self.getUser(userid, function(user) {
										//device.hotdesk_users.push(user);
										hotdesk_users.push(user);
										//console.log("Added hd user "+userid+" "+(idx+1)+" of "+hd_users.length+" to dev ID: "+device.id);
										//if (device.hotdesk_users.length == hd_users.length ) resolve();
										if (hotdesk_users.length === targetLength ) resolve();
									});
								});
						} else resolve();
					} else resolve();
				} else resolve();
			});
			done.then(() => {
				device.hotdesk_users = hotdesk_users;
				callback(device);
			});
		},

		addExtensionsToDevices: function(devices, callback) {
			var self = this;
			let outputDevices = [];
			let done = new Promise((resolve, reject) => {
				if (devices.length == 0) resolve();
				devices.forEach(function(device) {
					if (device.user) {
						if (device.user.presence_id) {
							device.current_extension = device.user.presence_id;
						}
						if (device.user.caller_id) {
							if (device.user.caller_id.internal) {
								if (device.user.caller_id.internal.number) {
									device.current_extension = device.user.caller_id.internal.number;
								}
							}
						}
					}
					if (device.hotdesked) {
						device.hotdesk_extensions = [];
						device.hotdesk_users.forEach( (user) => {
							let ext;
							if (user.presence_id) {
								ext = user.presence_id;
							}
							if (user.caller_id) {
								if (user.caller_id.internal) {
									if (user.caller_id.internal.number) {
										ext = user.caller_id.internal.number
									}
								}
							}
							device.hotdesk_extensions.push(ext);
						});
						/*
						device.hotdesk_extensions = device.hotdesk_users.map(function(user) {
							let ext;
							if (user.presence_id) {
								ext = user.presence_id;
							}
							if (user.caller_id) {
								if (user.caller_id.internal) {
									if (user.caller_id.internal.number) {
										ext = user.caller_id.internal.number
									}
								}
							}
							return ext;
						});
						*/
					}
					outputDevices.push(device);
					if (outputDevices.length == devices.length) resolve();
				});
			});
			done.then(() => {
				callback(outputDevices);
			});
		},

		listDevices: function(callback) {
			var self = this;
			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId
				},
				success: function(devices) {
					//console.log(devices.data);
					callback(devices.data);
				},
				error: function(err) {
					console.log("Error in listDevices:");
					console.log(err);
					callback([]);
				}
			});
		},

		listRegisteredDevices: function(devices, callback) {
			var self = this;
			let registeredDevices = [];
			let done = new Promise((resolve, reject) => {
				if (devices.length == 0) resolve();
				self.listDevicesStatus(function(rDevices) {	
					if (rDevices.length == 0) resolve();
					devices.forEach( (device) => {
						rDevices.forEach( (rdevice) => {
							if (device.id == rdevice.device_id && rdevice.registered) {
								registeredDevices.push(device);
								if (registeredDevices.length == rDevices.length) resolve();
							}
						});
					});
					/*
					var registeredDevices = devices.filter( (device) => {
						var isMatch = false;
						rDevices.forEach( (rdevice) => {
							if (device.id == rdevice.device_id && rdevice.registered) {
								isMatch = true;
							}
						});
						return isMatch;
					});
					//callback(registeredDevices);
					*/
				});
			});
			done.then(() => {
				callback(registeredDevices);
			});
		},

		listDevicesStatus: function(callback) {
			var self = this;
			self.callApi({
				resource: 'device.getStatus',
				data: {
					accountId: self.accountId
				},
				success: function(devices) {
					//console.log(devices.data);
					//only return registered devices
					callback(devices.data);
				},
				error: function(err) {
					console.log("Error in listDevicesStatus:");
					console.log(err);
					callback([]);
				}
			});
		},

		getDevice: function(d_id, callback) {
			var self = this;
			self.callApi({
				resource: 'device.get',
				data: {
					deviceId: d_id,
					accountId: self.accountId
				},
				success: function(device) {
					//console.log(user.data);
					callback(device.data);
				},
				error: function(err) {
					console.log("Error in getDevice:");
					console.log(err);
					callback({});
				}
			});
		},

		listUsers: function(callback) {
			var self = this;
			self.callApi({
				resource: 'user.list',
				data: {
					accountId: self.accountId
				},
				success: function(users) {
					callback(users.data);
				},
				error: function(err) {
					console.log("Error in listUsers:");
					console.log(err);
					callback([]);
				}
			});
		},

		getUser: function(u_id, callback) {
			var self = this;
			self.callApi({
				resource: 'user.get',
				data: {
					userId: u_id,
					accountId: self.accountId
				},
				success: function(user) {
					//console.log(user.data);
					callback(user.data);
				},
				error: function(err) {
					console.log("Error in getUser:");
					console.log(err);
					callback({});
				}
			});
		}



/*
		bindEvents: function (args) {
			var self = this,
				$template = args.template;

			//load the parked calls on document ready, and repeat every 15 seconds
			$(document).ready(function (e) {
				loadParkingLot();
				//initWs();
				//setInterval(loadParkingLot, 30000);
			});

			//Refresh parked calls button binding event:
			$template.find("#refresh").on("click", function (e) {
				loadParkingLot();
			});

			//Help Button/Dialog
			$template.find("#help-button").on("click", function (e) {
				var helptemplate = $(app.getTemplate({
					name: 'dialog-help'
				}));

				monster.ui.dialog(helptemplate, {
					title: app.i18n.active().parkinglot.help.title,
					width: '600px',
					onClose: function() {
				    	//doStuff();
					}
				});
			});

			/*
			//generate random number/ID
			const genRandHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

			function initWs() {
			console.log("Opening socket...");
			var socket = new WebSocket("wss://harrier.ruhnet.net:7700");

			socket.onopen = function() {
				console.log("TOKEN: "+monster.util.getAuthToken());
				send({
					action: 'subscribe',
					auth_token: monster.util.getAuthToken(),
					request_id: genRandHex(32),
					data: {
						account_id: self.accountId,
						binding: 'call.CHANNEL_CREATE.*'
					}
				});

				send({
					action: 'subscribe',
					auth_token: monster.util.getAuthToken(),
					request_id: genRandHex(32),
					data: {
						account_id: self.accountId,
						binding: 'conference.event.d1e0abbddc0c51feb8e476c279974840.*'
					}
				});

				send({
					action: 'subscribe',
					auth_token: monster.util.getAuthToken(),
					request_id: genRandHex(32),
					data: {
						account_id: self.accountId,
						binding: 'doc_created.*.user.*'
					}
				});
			}

			socket.onmessage = function(raw_message) {
				var json_data = JSON.parse(raw_message.data);

				console.log("================================");
				console.log(json_data);
				console.log("================================");
			};
			}


			//function to load the parked calls onto the page and set dependent bindings
			function loadParkingLot() {
				self.getParkedCalls(function (listOfParkedCalls) {
					var $results = $(
						self.getTemplate({
							name: "results",
							data: {
								parkedCalls: listOfParkedCalls.slots,
							},
						})
					);

					$template.find(".results").empty().append($results);

					///Pickup a parked call binding
					$template.find(".pickup").on("click", function (e) {
						//var parkNum = parkedUri.substr(0, parkedUri.indexOf('@'));  //strip off the @domain.tld suffix
						var parkedUri = $(this)
							.closest(".parked-call")
							.attr("id"); //get the id, which is the parked call URI
						var parkNum = parkedUri.split("@")[0]; //strip off the @domain.tld if it exists (but doesn't fail if not)
						var parkSlot = parkNum.substring(2); //strip off the first 2 chars in case it's *4 instead of *3.
						self.pickupCall("*3" + parkSlot);
						//console.log(parkNum);
					});
					///////////////////////////////
					///Call the parker (the device who parked the call):
					$template.find(".call-parker").on("click", function (e) {
						var ringbackId = $(this).attr("id"); //get the id, which is the parker device ID
						self.callTheParker(ringbackId);
					});
					///////////////////////////////
				
					$template.find(".parked-call").on("mouseover", function (e) { //load more details about parker when hover
							var clickedItem = $(this);
						if ($(clickedItem).find('.call-parker').html() == '') { //check if the parker info is empty
							self.callApi({
							// Get info on the parker device:
							resource: "device.get",
							data: {
								accountId: self.accountId,
								deviceId: $(this).find('.call-parker').attr('id')
							},
							success: function (deviceData) {
								self.callApi({
									// Get info on the user the parker device belongs to:
									resource: "user.get",
									data: {
										accountId: self.accountId,
										userId: deviceData.data.owner_id
									},
									success: function (userData) {
										var parker_name = userData.data.caller_id.internal.name;
										var parker_number = userData.data.caller_id.internal.number;
										$(clickedItem).find('.call-parker').html(parker_name+' '+parker_number);
										$(clickedItem).find('.call-parker_hidden').css('display', 'inline');
									},
									error: function (parsedError) {
										monster.ui.alert("FAILED to get user info for parking slot #" + slot.parking_slot + ": " + parsedError);
									},
								}); //end get info on user
							},
							error: function (parsedError) {
								monster.ui.alert(
									"FAILED to get device info for device: " + slot.ringback_id + ": " + parsedError
								);
							},
						}); //end get info on parker device
						} //if clickedItem parker info is empty
					}); //end parked-call mouseover binding

				}); //end self.getParkedCalls
			} //end function loadParkingLot();
		}, //bindEvents


		getParkedCalls: function (callback) {
			var self = this;
			self.callApi({
				resource: "parkedCalls.list",
				data: {
					accountId: self.accountId,
				},
				success: function (data) {
					$.each(data.data.slots, function (index, slot) {
						slot.parking_slot = index;
					}); //end $.each
					//console.log(JSON.stringify(data.data));
					callback(data.data);
				},
				error: function (parsedError) {
					//console.log(parsedError);
					if (data.data.error == "401") {
						//if we get a 401 when refreshing parked calls, log out so user can re-auth.
						monster.util.logoutAndReload();
					}
					callback([]);
				},
			}); //end get parked calls list
		}, //end getParkedCalls

		pickupCall: function (dialNumber) {
			var self = this;

			self.callApi({
				resource: "user.quickcall",
				data: {
					accountId: self.accountId,
					userId: monster.apps.auth.currentUser.id,
					//userId: 'd89c34618dc8fa28fc5deead6cc64a4d',
					number: dialNumber,
				},
				success: function (data) {
					console.log(
						"Success creating quickcall! : " + JSON.stringify(data)
					);
					//monster.ui.alert("Success creating quickcall! : "+data);
					//callback(data.data);
				},
				error: function (parsedError) {
					monster.ui.alert(
						"FAILED to create call:" +
							number +
							" for " +
							userID +
							": " +
							parsedError
					);
					//callback([]);
				},
			});
		},

		callTheParker: function (parkerDeviceId) {
			var self = this;

			self.callApi({
				resource: "user.get", //get my extension to use for quickcall
				data: {
					accountId: self.accountId,
					userId: monster.apps.auth.currentUser.id,
				},
				success: function (data) {
					console.log(
						"Success getting user: " +
							data.data.caller_id.internal.number
					);
					self.callApi({
						resource: "device.quickcall",
						data: {
							accountId: self.accountId,
							deviceId: parkerDeviceId,
							number: data.data.caller_id.internal.number,
						},
						success: function (data) {
							console.log(
								"Called: " +
									parkerDeviceId +
									" from " +
									data.data.caller_id.internal.number
							);
						},
						error: function (parsedError) {
							monster.ui.alert(
								"FAILED to create call to " +
									data.data.caller_id.internal.number +
									" for original parker device: " +
									parkerDeviceId +
									": " +
									parsedError
							);
						},
					});
				},
				error: function (parsedError) {
					monster.ui.alert(
						"FAILED to get your extension - userId: " +
							userID +
							": " +
							parsedError
					);
				},
			});
		}, //callTheParker
*/

		////////////////////////////////////////////////////////
	};

	return app;
});
