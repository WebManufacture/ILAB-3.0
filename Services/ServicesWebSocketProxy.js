var fs = useSystem('fs');
var http = useSystem('http');
var util = useModule('utils');
var WebSocket = useSystem('ws');
var Service = useRoot("/System/Service.js");
var JsonSocket = useModule('jsonsocket');

function WebSocketProxyService(param1){
    this.nodes = {};
    var self = this;
    this.knownServices = {

    };
    if (typeof param1 == "object"){
        if (typeof param1.port == "number"){
            this.port = param1.port;
        }
    }
    else{
        if (typeof param1 == "number"){
            this.port = param1;
        }
    }
    if (!this.port) this.port = 5700;
    this.proxies = {};

    this.GetConnections = function () {

    };
    this.Broadcast = function(event, message){

    };
    this.OpenPort = function (port) {
        if (typeof port != "number"){
            throw this.serviceId + ": OpenPort - port is not a number: " + port;
        }
        if (this.proxies[port+""]){
            throw this.serviceId + ": OpenPort - port " + port + " already open";
        }
        var wss = new WebSocket.Server({ port: port });
        this.proxies[port + ""] = wss;
        wss.on('connection', this._onSocketConnection.bind(this));
        console.log("WebSocket PROXY ON " + port);
        process.on('exiting', () => {
            wss.close();
        });
        process.on('exit', () => {
            wss.close();
        });
        return true;
    };
    this.ClosePort = function (port) {

    };
    this.StartNode = function(nodePath){
        return new Promise(function (resolve, reject) {
            var node = self.startNode(nodePath);
            if (node.code == ForkMon.STATUS_WORKING) {
                reject("node " + nodePath + " already work")
            }
            else {
                node.once("node-started", function () {
                    node.removeListener("error", reject);
                    resolve();
                });
            }
            node.once("error", reject);
        });
    };
    if (this.port){
        this.OpenPort(this.port)
    }
    return Service.call(this);
}

WebSocketProxyService.serviceId = "WebSocketProxyService";

Inherit(WebSocketProxyService, Service, {
    _onSocketConnection: function connection(ws, req) {
        var self = this;
        var url = req.url;
        //console.log('WSproxy: WSconnection', url);
        var services = null;
        var header = null;

        ws.once('message', function incoming(message) {
            header = message;
        });

        function connectService(serviceId, servicePort){
            if (servicePort) {
                var socket = new JsonSocket(servicePort, "localhost", function () {
                    //console.log("WSproxy:  " + serviceId + " connected to " + servicePort);
                });
                socket.on('error', function (err) {
                    console.log("WSproxy: Socket error at " + serviceId + ":" + servicePort);
                    console.error(err);
                    ws.send(JSON.stringify({type:"external-error", result : err, stack: err.stack}))
                    socket.end();
                    ws.close();
                });
                var messageHandlerFunction = function (message) {
                    ws.send(JSON.stringify(message));
                };
                socket.on("json", messageHandlerFunction);
                socket.once("close", function (isError) {
                    //console.log("WSproxy: Socket Closed at " + serviceId + ":" + servicePort);
                });
                var wsHandler = function (message) {
                    //console.log("WSproxy: calling method: " + message);
                    socket.write(JSON.parse(message));
                };
                if (header){
                    wsHandler(header);
                }
                else{
                    ws.removeAllListeners();
                }
                ws.on("close", function () {
                    socket.end();
                });
                ws.on('message', wsHandler);
            }
            else{
                console.log("WSproxy: Connecting unknown service " + serviceId + ":" + servicePort);
                ws.send(JSON.stringify({type:"error", result : "No service found"}))
                ws.close();
            }
        }

        if (url == "/") {
            ServicesManager.GetServices().then((services) => {
                ws.send(JSON.stringify(services));
                ws.removeAllListeners();
                ws.close();
            }).catch(function (err) {
                throw err;
            });
        }
        else {
            var parts = url.split('/');
            if (parts[0] == "") parts.shift();
            if (parts.length) {
                var serviceId = parts[0];
                var servicePort = self.knownServices[serviceId];
                if (servicePort){
                    connectService(serviceId, servicePort);
                }
                else{
                    ServicesManager.GetServices().then((services) => {
                        servicePort = services[serviceId];
                        self.knownServices[serviceId] = servicePort;
                        connectService(serviceId, servicePort);
                    }).catch(function (err) {
                        throw err;
                    });
                }
            }
        }
        //ws.send('something');
    },

    attachService : function (port, serviceId) {
        if (!port) throw new Error("Unknown port to attach in " + this.serviceId);
        if (!host) host = "127.0.0.1";
        this.host = host;
        var self = this;


        var handshakeFinished = false;
        socket.on('error', function(err){
            console.log("Socker error at " + self.serviceId + ":" + self.port + ":" + self.connectionsCount);
            console.log("Waiting queue " + self.waiting.length);
            console.error(err);
            self.emit('error', err);
            socket.end();
        });
        socket.once("json", function (proxyObj) {
            //console.dir(proxyObj);//debug
            self.serviceId = proxyObj.serviceId;
            //if (self.serviceId != "ServicesManager")
            console.log(Frame.serviceId + ": Service proxy connected to " + self.serviceId);
            for (var item in proxyObj){
                if (proxyObj[item] == "method") {
                    self._createFakeMethod(item, proxyObj[item]);
                }
            }
            if (typeof callback == "function") {
                callback.call(self, proxyObj);
            }
            socket.write({"type": "startup", args : self.startParams});
            self.emit("connected", proxyObj);
            handshakeFinished = true;
        });
        var methodCallFunction = function (obj, onResultFunction) {
            socket.write(obj);
        };
        self.on("external-call", methodCallFunction);

        var messageHandlerFunction = function (message) {
            // console.log(message); // debug

            if (handshakeFinished)
            {
                if(message.then=="event") {
                    self.emit.apply(self, message.args);
                }
                if (message.type == "result" && message.id){
                    self.emit("external-result", message);
                    self.emit("external-result-" + message.id, message.result);
                }
                if (message.type == "error" && message.id){
                    self.emit("external-error", message);
                    self.emit("external-error-" + message.id, message.result, message.stack);
                }
            }
        };
        socket.on("json", messageHandlerFunction);

        socket.once("close", function (isError) {
            //self.removeListener("external-call", methodCallFunction);
            //this.removeListener("json", messageHandlerFunction);
            self.connectionsCount--;
            console.log("Socket Closed at " + self.serviceId + ":" + port + ":" + self.connectionsCount);
            console.log("Waiting queue " + self.waiting.length);
            setImmediate(()=>{self.attach(self.port, self.host)})
        });

        var promise = new Promise(
            function(resolve, reject) {
                var connectedHandler = function () {
                    self.removeListener("error", errorHandler);
                    resolve(self);
                };
                var errorHandler = function (args) {
                    self.removeListener("connected", connectedHandler);
                    reject(args);
                };
                self.once("connected", connectedHandler);
                self.once("error", errorHandler);
            }
        );

        return promise;
    },
});

module.exports = WebSocketProxyService;