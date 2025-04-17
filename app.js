//Switchboard
//Copyright 2022-2024 RuhNet - All Rights Reserved
//"Switchboard", "Switchboard Pro", and "Switchboard Lite" are trademarks of RuhNet.
//https://ruhnet.co
//
//This software is distributed without warranty.
//
//You may use this software with a valid license from RuhNet, which has been
//distributed to you with this software.
//
//This code can be optimized and cleaned up in many ways. Since Javascript is a
//complex language with a gazillion ways of doing the same processes, as a
//matter of taste I generally try to use the simplest and most obvious ways of
//structuring functions for readability purposes. You may like it or not, for
//various reasons, and you are likely right...
//
//I _hate_ Javascript, so I make no claims of beauty or cleverness. :D
//


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

			self.initConfig(() => {
				console.log("Initialized config.");
				//console.log(self.config);
			});

			// Used to init the auth token and account ID of this app
			monster.pub("auth.initApp", {
				app: self,
				callback: callback,
			});
		},

		////////////////////////////////////////////////////////////////////
		// Initiailize the config object
		////////////////////////////////////////////////////////////////////
		initConfig: function(callback) {
			var self = this;
			if (_.isEmpty(self.config)) {
				if (!_.isEmpty(monster.config.switchboard)) {
					self.config = monster.config.switchboard;
					Object.keys(self.configDefault).forEach((configItem) => {
						if (typeof self.config[configItem] === 'undefined') {
							self.config[configItem] = self.configDefault[configItem];
						}
					});
				} else {
					self.config = self.configDefault;
				}
			}
			return callback();
		},
		
		config: {}, //fill this object up with config from js/config.js switchboard object, or default config
		
		////////////////////////////////////////////////////////////////////
		// DEFAULT APP CONFIGURATION - set 'switchboard' object
		// in {MONSTER-UI-WEB-DIR}/js/config.js to change these defaults.
		////////////////////////////////////////////////////////////////////
		configDefault: {
			features: {},
			deviceNameLengthLimit: 12,
			deviceNameUseExtension: false,
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
			self.getFullDevices(function(data) {
				//console.log(data);
				// Load the devices data in a Handlebars template "layout"
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

			//This disconnect websockets button is helpful when masquerading between accounts, otherwise old connections stay open.
			template.find('#disconnectWS').on('click', function() {
				self.unsubscribeAllWS(self.accountId);
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
		},

		indicatorIcons: {
			standby_icon: 'fa-circle',
			inbound_icon: 'fa-arrow-down',
			outbound_icon: 'fa-arrow-up',
			//Alternate curved arrow icons if you like:
			//inbound_icon: 'fa-mail-reply',
			//outbound_icon: 'fa-mail-forward',
		},

		bindings: [
			'call.CHANNEL_CREATE.*',
			'call.CHANNEL_ANSWER.*',
			'call.CHANNEL_DESTROY.*',
			'call.CHANNEL_HOLD.*',
			'call.CHANNEL_UNHOLD.*',
			'call.PARK_PARKED.*',
			'call.PARK_RETRIEVED.*',
			'call.PARK_ABANDONED.*',
		],

		bindSocketsEvents: function(template) {
			var self = this;

			//Activity Log
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

			//Update device call events:
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

			//Websockets setup:
			console.log('Subscribing to Websockets...');
			self.subscribeWebSocket({
				binding: 'call.CHANNEL_CREATE.*',
				requiredElement: template,
				callback: function(event) {
					onCalling(event);
					addEvent(event);
					console.log(event);
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

			//monster.pub('switchboard.ws_cancel_previous', self.accountId);

		}, //bindSocketsEvents

		unsubscribeAllWS: function(account_id) {
			var self = this;
			console.log('Received unsubscribe WS request for account ID: '+account_id);
			self.unsubscribeWS(account_id, self.bindings);
		},

		unsubscribeWS: function(account_id, bindings) {
			var self = this;
			bindings.forEach( (b) => {
				self.unsubscribeWebSocket({
					accountId: account_id,
					binding: b
				});
			});
		},

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
			el.attr('data-callstate', ev.event_name);
			el.find('.ringer').css('background-color', 'red');
			el.find('i.indicator_icon').show();
			el.find('i.indicator_icon').css('color', 'royalblue');
			el.find('.ringer').css('background-image', 'none'); //remove gradient
			el.find('.ringer').addClass('ringing');
			el.find('.dev_status').html(self.callStates[ev.event_name]);
			el.find('span.remote_status').html('Calling: ');
			el.find('span.remote_name').html(ev.extra.remote_name);
			el.find('span.remote_number').html(ev.extra.remote_number);
			el.find('i.call_direction').removeClass('fa-circle');
			//el.find('i.call_direction').css('color', '#00b7ff');
			el.find('i.call_direction').css('color', 'orange');
			if (ev.call_direction == 'outbound') { //inbound
				el.css('background-color', '#ffc4c4');
				//el.css('background-color', '#ffeff0');
				el.find('i.call_direction').addClass(self.indicatorIcons.inbound_icon);
				el.find('.device_sidepanel').attr('data-extension-real', el.find('.device_sidepanel').attr('data-extension'));
				el.find('.device_sidepanel').attr('data-extension', ev.extra.to); //set current ringing extension to incoming call dest
			} else { //outbound
				el.css('background-color', '#d8c4ff');
				//el.css('background-color', '#f8c4ff');
				el.find('i.call_direction').addClass(self.indicatorIcons.outbound_icon);
			}
		},

		updateDeviceOnCall: function(el, ev) {
			var self = this;
			el.attr('data-callstate', ev.event_name);
			el.attr('data-callid', ev.call_id);
			//el.css('background-color', '#ededed');
			el.css('background-image', 'linear-gradient(#ededed, #cceded');
			el.find('.ringer').removeClass('ringing');
			el.find('.ringer').addClass('on_call');
			el.find('.ringer').css('background-image', 'none'); //remove gradient
			el.find('.device_sidepanel').css('background-image', 'linear-gradient(orange, #fb521a)');
			el.find('i.indicator_icon').show();
			el.find('i.indicator_icon').addClass('rotation');
			el.find('i.indicator_icon').css('color', 'red');
			el.find('.call_indicator').css('background-color', 'red');
			el.find('.dev_status').html(self.callStates[ev.event_name]);
			el.find('.remote_status').html('Talking: ');
			el.find('i.call_direction').removeClass('fa-circle');
			el.find('i.call_direction').css('color', 'orange');
			if (ev.call_direction == 'outbound') { //inbound
				el.find('i.call_direction').addClass(self.indicatorIcons.inbound_icon);
			} else {
				el.find('i.call_direction').addClass(self.indicatorIcons.outbound_icon);
			}
			let callTime = 0; //FIXME: when showing a call in progress via channels API, this will be wrong. Use channels 'timestamp' to fix.
			if (ev.elapsed_s) { //this is an existing channel, so we set calltime to match
				callTime = ev.elapsed_s;
			}
			el.find('.call_timer_minutes').html('00');
			el.find('.call_timer_seconds').html('00');

			clearInterval(el.find('.call_timer').attr('data-timer'));

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
			el.attr('data-callstate', ev.event_name);
			clearInterval(el.find('.flasher').attr('data-flasher'));
			clearInterval(el.find('.device-call_indicator').attr('data-flasher'));
			el.css('background-color', 'white');
			el.css('background-image', 'none'); //remove gradient
			el.find('.ringer').css('background-image', 'none'); //remove gradient
			el.find('i.indicator_icon').removeClass('rotation');
			el.find('i.indicator_icon').css('color', '#333');
			el.find('i.call_direction').css('color', 'royalblue');
			el.find('.call_indicator').css('background-color', 'royalblue');
			el.find('.call_indicator').removeClass('oncall');
			//el.find('.ringer').css('background-color', '#00ef33'); //green
			el.find('.ringer').css('background-image', 'linear-gradient(#00ef33, #00a300)'); //green to darker green
			el.find('.ringer').removeClass('ringing');
			el.find('.ringer').removeClass('on_call');
			el.find('.direction_box').css('background-image', 'none');
			el.find('.direction_box').css('background', 'none');
			el.find('.dev_status').html(self.callStates[ev.event_name]);
			el.find('.device_sidepanel').attr('data-extension', el.find('.device_sidepanel').attr('data-extension-real')); //set back to orig
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
			el.attr('data-callstate', ev.event_name);
			//el.css('background-color', 'grey');
			el.css('background-image', 'linear-gradient(grey, lightgrey');
			el.addClass('on_hold');
			el.find('i.actionbutton').addClass('disabled');
			el.find('i.indicator_icon').removeClass('rotation');
			el.find('.call_indicator').css('background-color', 'black');
			el.find('.dev_status').html(self.callStates[ev.event_name]+'<br />');
			el.find('.remote_status').html('On Hold: ');
		},

		updateDeviceHold_off: function(el, ev) {
			var self = this;
			el.attr('data-callstate', 'CHANNEL_ANSWER');
			//el.css('background-color', '#ededed');
			el.css('background-image', 'linear-gradient(#ededed, #cceded');
			el.removeClass('on_hold');
			el.find('i.indicator_icon').addClass('rotation');
			el.find('.call_indicator').css('background-color', 'red');
			el.find('.dev_status').html(self.callStates[ev.event_name]+'<br />');
			el.find('.remote_status').html('Talking: ');
		},

		// Formatting event data before we use it
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
			if (ev.hasOwnProperty('uuid')) { //channels API has 'uuid' instead of 'call_id'
				ev.call_id = ev.uuid;
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
			if (!ev.call_direction) {
				ev.call_direction = ev.direction;
			}
			if (ev.call_direction == 'outbound') { //incoming call is "outbound" from Kazoo, which is "inbound" for the user/device.
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
			//devices and call status
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

		//Yeah yeah I know this looks goofy like callback h*ll but in fairness
		//the lines aren't too awfully long and it makes sense and is easy to
		//follow... I guess...
		//I reckon using promises would be the hipster-cool-cat way to fix this.
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
					accountId: self.accountId,
					filters: {
						paginate: false
					}
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
							if (device.name.length > self.config.deviceNameLengthLimit || self.config.deviceNameUseExtension) {
								device.name = device.user.presence_id;
							}
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
					accountId: self.accountId,
					filters: {
						paginate: false
					}
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
					accountId: self.accountId,
					filters: {
						paginate: false
					}
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
					accountId: self.accountId,
					filters: {
						paginate: false
					}
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
					accountId: self.accountId,
					filters: {
						paginate: false
					}
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
					accountId: self.accountId,
					filters: {
						paginate: false
					}
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



	}; //app

	return app;
});
