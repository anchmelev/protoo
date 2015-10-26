var http = require('http');
var https = require('https');
var parseUrl = require('url').parse;
var path = require('path');
var fs = require('fs');
var W3CWebSocket = require('websocket').w3cwebsocket;

var protoo = require('../../');

module.exports = function(url, requestListener, done)
{
	var useWss = /^wss:/.test(url);
	var parsedUrl = parseUrl(url);
	var httpServer;
	var wsOptions;
	var app = protoo();

	if (useWss)
	{
		httpServer = https.createServer(
			{
				cert : fs.readFileSync(path.resolve(__dirname, 'local.protoo.org.crt.pem')),
				key  : fs.readFileSync(path.resolve(__dirname, 'local.protoo.org.key.pem'))
			});
	}
	else
	{
		httpServer = http.createServer();
	}

	// Don't log the error stack.
	app.set('env', 'test');

	function defaultRequestListener(info, accept)
	{
		var u = parseUrl(info.req.url, true);
		var username = u.query.username;
		var uuid = u.query.uuid;

		accept(username, uuid, null);
	}

	wsOptions =
	{
		keepalive: false
	};

	app.websocket(httpServer, wsOptions, requestListener || defaultRequestListener);
	httpServer.listen(parsedUrl.port, parsedUrl.hostname, function()
	{
		done();
	});

	// Add a custom connect() method to the app for testing.
	app.connect = function(username, uuid, protocol)
	{
		var protocols;
		var options = {};
		var connectUrl;
		var client;

		username = username || Math.round(100000 * Math.random()).toString();
		uuid = uuid || Math.round(100000 * Math.random()).toString();

		if (protocol === undefined)
		{
			protocol = 'protoo';
		}

		protocols = protocol ? [protocol] : [];

		connectUrl = url + '/?username=' + username + '&uuid=' + uuid;

		if (useWss)
		{
			options.rejectUnauthorized = false;
		}

		client = new W3CWebSocket(connectUrl, protocols, null, null, options);

		client.sendRequest = function(method, path, data, id)
		{
			var req =
			{
				method : method,
				id     : id || Math.round(100000 * Math.random()),
				path   : path
			};

			if (data)
			{
				req.data = data;
			}

			client.send(JSON.stringify(req));
		};

		client.sendResponse = function(req, status, reason, data)
		{
			var res =
			{
				status : status,
				reason : reason,
				id     : req.id
			};

			if (data)
			{
				res.data = data;
			}

			client.send(JSON.stringify(res));
		};

		return client;
	};

	return app;
};
