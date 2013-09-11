/*

findNode.js - findNode() test

The MIT License (MIT)

Copyright (c) 2013 Tristan Slominski

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

*/

"use strict";

var net = require('net'),
    TcpTransport = require('../index.js');

var test = module.exports = {};

test['findNode() connects to contact.host:contact.port'] = function (test) {
    test.expect(1);
    var server = net.createServer(function (connection) {
        test.equal(connection.remoteAddress, connection.localAddress);
        connection.on('data', function () {
            connection.end();
            server.close(function () {
                test.done();
            });
        });
    });
    server.listen(11234, function () {
        var tcpTransport = new TcpTransport();
        tcpTransport.findNode(
            {host: '127.0.0.1', port: 11234, id: new Buffer("bar").toString("base64")}, 
            new Buffer("foo").toString("base64"),
            {id: new Buffer("foo").toString("base64")});
    });
};

test['findNode() sends newline terminated base64 encoded findNode request with originator contact info'] = function (test) {
    test.expect(5);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var server = net.createServer(function (connection) {
        connection.on('data', function (data) {
            var data = JSON.parse(data.toString("utf8"));  
            test.equal(data.request.findNode, fooBase64);
            test.equal(data.sender.id, barBase64);
            test.equal(data.sender.host, "127.0.0.1");
            test.equal(data.sender.port, 11111);
            test.equal(data.sender.data, "bar");
            connection.end();
            server.close(function () {
                test.done();
            });
        });
    });
    server.listen(11234, function () {
        var tcpTransport = new TcpTransport();
        tcpTransport.findNode(
            {host: '127.0.0.1', port: 11234, id: barBase64},
            fooBase64,
            {host: '127.0.0.1', port: 11111, id: barBase64, data: 'bar'});
    });
};

test['findNode() emits `node` event with a response Object if node is found'] = function (test) {
    test.expect(6);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var server = net.createServer(function (connection) {
        connection.on('data', function (data) {
            connection.write(
                JSON.stringify({host: '192.168.1.13', port: 1234}) + '\r\n');
            connection.end();
        });
    });
    server.listen(11234, function () {
        var tcpTransport = new TcpTransport();
        tcpTransport.on('node', function (error, contact, nodeId, response) {
            test.ok(!error);
            test.equal(contact.id, barBase64);
            test.equal(contact.host, '127.0.0.1');
            test.equal(contact.port, 11234);
            test.equal(nodeId, fooBase64);
            test.deepEqual(response, {host: '192.168.1.13', port: 1234});
            server.close(function () {
                test.done();
            });
        });
        tcpTransport.findNode(
            {host: '127.0.0.1', port: 11234, id: barBase64}, 
            fooBase64,
            {id: barBase64});
    });
};

test['findNode() emits `node` event with response Array if node is not found'] = function (test) {
    test.expect(6);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var server = net.createServer(function (connection) {
        connection.on('data', function (data) {
            connection.write(
                JSON.stringify([
                    {host: '192.168.1.14', port: 334},
                    {host: '192.168.1.15', port: 33422},
                    {host: '192.168.1.16', port: 7783}
                ]) + '\r\n');
            connection.end();
        });
    });
    server.listen(11234, function () {
        var tcpTransport = new TcpTransport();
        tcpTransport.on('node', function (error, contact, nodeId, response) {
            test.ok(!error);
            test.equal(contact.id, barBase64);
            test.equal(contact.host, '127.0.0.1');
            test.equal(contact.port, 11234);
            test.equal(nodeId, fooBase64);
            test.deepEqual(response, [
                {host: '192.168.1.14', port: 334},
                {host: '192.168.1.15', port: 33422},
                {host: '192.168.1.16', port: 7783}
            ]);
            server.close(function () {
                test.done();
            });
        });
        tcpTransport.findNode(
            {host: '127.0.0.1', port: 11234, id: barBase64}, 
            fooBase64,
            {id: barBase64});
    });
};

test['findNode() does not emit `reached` event on successful connection'] = function (test) {
    test.expect(0);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var server = net.createServer(function (connection) {
        connection.end();
    });
    server.listen(11234, function () {
        var tcpTransport = new TcpTransport();
        tcpTransport.on('reached', function (contact) {
            test.fail('`reached` cannot be determined from connection alone');
        });
        tcpTransport.on('node', function () {
            server.close(function () {
                test.done();
            });
        });
        tcpTransport.findNode(
            {host: '127.0.0.1', port: 11234, id: barBase64},
            fooBase64,
            {id: barBase64});
    });
};

test['findNode() emits `node` event with `unreachable` error on failed connection'] = function (test) {
    test.expect(7);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var tcpTransport = new TcpTransport();
    tcpTransport.on('node', function (error, contact, nodeId, response) {
        test.ok(!response);
        test.equal(contact.id, barBase64);
        test.equal(contact.host, '127.0.0.1');
        test.equal(contact.port, 11000);
        test.equal(nodeId, fooBase64);
        test.ok(error instanceof Error);
        test.equal(error.message, 'unreachable');
        test.done();
    });
    tcpTransport.findNode(
        {host: '127.0.0.1', port: 11000, id: barBase64}, 
        fooBase64,
        {id: barBase64});
};

test['findNode() emits `node` event with `error` error on no-data connection'] = function (test) {
    test.expect(7);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var server = net.createServer(function (connection) {
        connection.on('data', function (data) {
            connection.end(); // close without sending data
        });
    });
    server.listen(11234, function () {
        var tcpTransport = new TcpTransport();
        tcpTransport.on('node', function (error, contact, nodeId, response) {
            test.ok(!response);
            test.equal(contact.id, barBase64);
            test.equal(contact.host, '127.0.0.1');
            test.equal(contact.port, 11234);
            test.equal(nodeId, fooBase64);
            test.ok(error instanceof Error)
            test.equal(error.message, 'error');
            server.close(function () {
                test.done();
            });
        });
        tcpTransport.findNode(
            {host: '127.0.0.1', port: 11234, id: barBase64}, 
            fooBase64,
            {id: barBase64});
    });
};

test['findNode() emits `unreachable` event on failed connection'] = function (test) {
    test.expect(3);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var tcpTransport = new TcpTransport();
    tcpTransport.on('unreachable', function (contact) {
        test.equal(contact.id, barBase64);
        test.equal(contact.host, '127.0.0.1');
        test.equal(contact.port, 11000);
        test.done();
    });
    tcpTransport.findNode({host: '127.0.0.1', port: 11000, id: barBase64}, 
        fooBase64);
};