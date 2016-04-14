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
    });
}

serve(8080);
