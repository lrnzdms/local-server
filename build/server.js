"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevServer = void 0;
const http_1 = __importDefault(require("http"));
const os_1 = require("os");
const injectListener_1 = require("./injectListener");
const proxy_1 = require("./proxy");
const readFile_1 = require("./readFile");
const utils_1 = require("./utils");
class DevServer {
    constructor(options) {
        this._port = 3000;
        this._root = ".";
        this._hot = true;
        this._identifier = "/dev-proxy-server";
        this.update = () => {
            this._clients.forEach(response => response.write('data: update\n\n'));
            this._clients.length = 0;
        };
        this._start = () => {
            const server = http_1.default.createServer(this._handleRequest);
            server.listen(this._port, () => this._initializationLog(server));
            server.once('error', () => server.removeAllListeners('listening'));
        };
        this._handleRequest = async (req, res) => {
            if (this._proxy.tryProxy(req, res)) {
                return;
            }
            if (this._hot && req.url === this._identifier) {
                this._addClient(res);
                return;
            }
            let result;
            try {
                result = await readFile_1.readFile(this._root, req.url);
            }
            catch (error) {
                utils_1.err(error);
                return;
            }
            const { isHtml, encoding, contentType } = result;
            let content = result.content;
            if (this._hot && isHtml) {
                // Injecting an event source into the html
                // - Creates a request to "source" which will be handled by our listener
                // - our listener will keep this request connection alive with the client
                // - when it is time to update we fullfill the request and trigger a page reload
                content = injectListener_1.injectListener(content, this._identifier);
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, encoding);
        };
        this._initializationLog = (server) => {
            const info = server.address();
            const ip = Object.values(os_1.networkInterfaces()).flat()
                .find(ip => ip.family == 'IPv4' && !ip.internal).address;
            if (info.port != this._port) {
                utils_1.err(`Port ${this._port} was in use.\n`);
            }
            utils_1.wrn(`[ Dev Proxy Server (http://localhost:${info.port}) ]`);
        };
        this._addClient = (response) => {
            response.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive'
            });
            this._clients.push(response);
        };
        this._port = (options === null || options === void 0 ? void 0 : options.port) || this._port;
        this._root = (options === null || options === void 0 ? void 0 : options.root) || this._root;
        this._hot = (options === null || options === void 0 ? void 0 : options.hot) || this._hot;
        this._clients = [];
        this._proxy = new proxy_1.Proxy((options === null || options === void 0 ? void 0 : options.proxies) || []);
        this._start();
    }
}
exports.DevServer = DevServer;