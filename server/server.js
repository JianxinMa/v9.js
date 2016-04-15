/*jslint white:true node:true*/

'use strict';

var fs = require("fs");

function serve(port) {
    var io;

    io = require('socket.io')(port);
    io.on('connection', function(socket) {
        socket.on('getos', function() {
            fs.readFile('bin/os', function(e, d) {
                if (e) {
                    console.log(e);
                } else {
                    socket.emit('sendos', {
                        os: d
                    });
                }
            });
        });
        socket.on('getfs', function() {
            fs.readFile('bin/fs.img', function(e, d) {
                if (e) {
                    console.log(e);
                } else {
                    socket.emit('sendfs', {
                        fs: d
                    });
                }
            });
        });
        socket.on('getdsym', function() {
            fs.readFile('dsym/bin/c.dsym', 'ascii', function(e, cdsym) {
                fs.readFile('dsym/bin/sh.dsym', 'ascii', function(e, shdsym) {
                    fs.readFile('dsym/etc/os.dsym', 'ascii', function(e, osdsym) {
                        fs.readFile('dsym/etc/init.dsym', 'ascii', function(e, initdsym) {
                            socket.emit('senddsym', {
                                c: cdsym,
                                sh: shdsym,
                                os: osdsym,
                                init: initdsym
                            });
                        });
                    });
                });
            });
        });
    });
}

serve(8080);
