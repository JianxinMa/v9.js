/*jslint white:true node:true */
/*global ArrayBuffer, Uint8Array */

'use strict';

var fs = require("fs");
var sk = require('socket.io');
var sh = require('shelljs');

function toArrayBuffer(buffer) {
    var ab, view, i;
    ab = new ArrayBuffer(buffer.length);
    view = new Uint8Array(ab);
    for (i = 0; i < buffer.length; i += 1) {
        view[i] = buffer[i];
    }
    return ab;
}

function toBuffer(ab) {
    var buffer, view, i;
    buffer = new Buffer(ab.byteLength);
    view = new Uint8Array(ab);
    for (i = 0; i < buffer.length; i += 1) {
        buffer[i] = view[i];
    }
    return buffer;
}

function readFiles(files, cb) {
    var finished, fileNum;
    fileNum = files.length;
    finished = 0;
    files.forEach(function(file, i) {
        fs.readFile(file.filename, file.encoding, function(e, d) {
            if (e) {
                throw e;
            }
            if (Buffer.isBuffer(d)) {
                d = toArrayBuffer(d);
            }
            files[i].content = d;
            finished += 1;
            if (finished === fileNum) {
                cb();
            }
        });
    });
}

function writeFiles(files, cb) {
    var finished, fileNum;
    fileNum = files.length;
    finished = 0;
    files.forEach(function(file) {
        fs.writeFile(file.filename, file.content, file.encoding, function(e) {
            if (e) {
                throw e;
            }
        });
        finished += 1;
        if (finished === fileNum) {
            cb();
        }
    });
}

function listFiles(pathname, encoding, filter) {
    var files;
    files = [];
    sh.ls('-R', pathname).forEach(function(filename) {
        if (filter(filename)) {
            files.push({
                filename: pathname + '/' + filename,
                encoding: encoding
            });
        }
    });
    return files;
}

function handleCompileFiles(socket) {
    var compileFiles, packCompiled, sendCompiled,
        srcFiles, debugFiles, execFiles;
    compileFiles = function() {
        var fileNum, finished, errinfo;
        debugFiles = [];
        execFiles = [];
        srcFiles = listFiles('root', 'utf8', function(n) {
            return n.endsWith('.c');
        });
        srcFiles.forEach(function(file) {
            debugFiles.push(
                file.filename.substr(0, file.filename.length - 1) + 'd');
            execFiles.push(
                file.filename.substr(0, file.filename.length - 2));
        });
        fileNum = srcFiles.length;
        finished = 0;
        errinfo = [];
        srcFiles.forEach(function(file) {
            var filename;
            filename = file.filename;
            sh.exec('./xvcc -Iroot/lib -o ' +
                filename.substr(0, filename.length - 2) + ' ' + filename, {
                    silent: true
                },
                function(code, stdout, stderr) {
                    if (code) {
                        errinfo.push({
                            filename: file.filename,
                            stdout: stdout,
                            stderr: stderr
                        });
                    }
                    finished += 1;
                    if (finished === fileNum) {
                        if (errinfo.length) {
                            sh.rm('-f', debugFiles);
                            sh.rm('-f', execFiles);
                            socket.emit('filesCompiled', {
                                error: errinfo
                            });
                        } else {
                            packCompiled();
                        }
                    }
                });
        });
    };
    packCompiled = function() {
        sh.cat(debugFiles).to('de');
        sh.rm('-f', debugFiles);
        sh.mv('root/etc/os', 'os');
        sh.exec('./mkfs hd root', function() {
            sh.rm('-f', execFiles);
            sendCompiled();
        });
    };
    sendCompiled = function() {
        fs.readFile('hd', function(e, hd) {
            if (e) {
                throw e;
            }
            fs.readFile('os', function(e, os) {
                if (e) {
                    throw e;
                }
                fs.readFile('de', 'utf8', function(e, de) {
                    if (e) {
                        throw e;
                    }
                    hd = toArrayBuffer(hd);
                    os = toArrayBuffer(os);
                    socket.emit('filesCompiled', {
                        hd: hd,
                        os: os,
                        de: de
                    });
                });
            });
        });
    };
    compileFiles();
}

function handleFetchFiles(socket) {
    var files;
    files = listFiles('root', 'utf8', function(n) {
        return n.endsWith('.h') || n.endsWith('.c') ||
            n.endsWith('.txt');
    });
    readFiles(files, function() {
        socket.emit('filesSent', files);
    });
}

function handleSaveFiles(socket, files) {
    var validFiles;
    validFiles = [];
    listFiles('root', 'utf8', function(n) {
        return n.endsWith('.h') || n.endsWith('.c') || n.endsWith('.txt');
    }).forEach(function(file) {
        validFiles.push(file.filename);
    });
    files = files.filter(function(file) {
        return validFiles.indexOf(file.filename) !== -1;
    });
    writeFiles(files, function() {
        socket.emit('filesSaved');
    });
}

function serve(port) {
    sk(port).on('connection', function(socket) {
        socket.on('fetchFiles', function() {
            handleFetchFiles(socket);
        });
        socket.on('saveFiles', function(files) {
            handleSaveFiles(socket, files);
        });
        socket.on('compileFiles', function() {
            handleCompileFiles(socket);
        });
    });
}

serve(8384);
