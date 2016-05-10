/*jslint white:true node:true maxlen:80 */

'use strict';

var http = require('http');
var path = require('path');
var sk = require('socket.io');
var sh = require('shelljs');
var fs = require("fs");
var tool = require("./js/tool");
var xvcc = require("./js/xvcc");
var mkfs = require("./js/mkfs");

function textFileFilter(name) {
    return name.endsWith('.h') || name.endsWith('.c') ||
        name.endsWith('.txt');
}

function srcFileFilter(name) {
    return name.endsWith('.c');
}

function listFiles(filter, pathname, encoding, dirpath) {
    var files;
    files = [];
    sh.ls('-R', path.join(dirpath, pathname)).forEach(function(filename) {
        if (filter(filename)) {
            files.push({
                filename: pathname + '/' + filename,
                encoding: encoding,
                content: null
            });
        }
    });
    return files;
}

function readFiles(files, cb, dirpath) {
    var finished;
    finished = 0;
    files.forEach(function(file, i) {
        fs.readFile(path.join(dirpath, file.filename), {
            encoding: file.encoding
        }, function(e, d) {
            if (e) {
                throw e;
            }
            if (Buffer.isBuffer(d)) {
                d = tool.toArrayBuffer(d);
            }
            files[i].content = d;
            finished += 1;
            if (finished === files.length) {
                cb();
            }
        });
    });
}

function writeFiles(files, cb, dirpath) {
    var finished;
    finished = 0;
    files.forEach(function(file) {
        fs.writeFile(path.join(dirpath, file.filename), file.content, {
            encoding: file.encoding
        }, function(e) {
            if (e) {
                throw e;
            }
            finished += 1;
            if (finished === files.length) {
                cb();
            }
        });
    });
}

function startFetchFiles(cb) {
    var files;
    files = listFiles(textFileFilter, 'root', 'utf8', '');
    readFiles(files, function() {
        cb(files);
    }, '');
}

function startCompileFiles(files, cb) {
    var stepSaveFiles, stepCompileFiles, stepPackCompiled, stepSendCompiled,
        srcFiles, debugFiles, execFiles;
    stepSaveFiles = function() {
        var validFiles;
        validFiles = [];
        listFiles(textFileFilter, 'root', 'utf8', '').forEach(function(file) {
            validFiles.push(file.filename);
        });
        files = files.filter(function(file) {
            return validFiles.indexOf(file.filename) !== -1;
        });
        writeFiles(files, function() {
            stepCompileFiles();
        }, '');
    };
    stepCompileFiles = function() {
        var fileNum, finished, errinfo;
        debugFiles = [];
        execFiles = [];
        srcFiles = listFiles(srcFileFilter, 'root', 'utf8', '');
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
                            cb({
                                error: errinfo
                            });
                        } else {
                            stepPackCompiled();
                        }
                    }
                });
        });
    };
    stepPackCompiled = function() {
        sh.cat(debugFiles).to('de');
        sh.rm('-f', debugFiles);
        sh.mv('root/etc/os', 'os');
        sh.exec('./mkfs hd root', function() {
            sh.rm('-f', execFiles);
            stepSendCompiled();
        });
    };
    stepSendCompiled = function() {
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
                    sh.rm('-f', ['hd', 'os', 'de']);
                    hd = tool.toArrayBuffer(hd);
                    os = tool.toArrayBuffer(os);
                    cb({
                        hd: hd,
                        os: os,
                        de: de
                    });
                });
            });
        });
    };
    stepSaveFiles();
}

function httpHandler(req, res) {
    var contentType;
    if (req.url === '/') {
        req.url = '/index.html';
    }
    if (req.url.endsWith(".css")) {
        contentType = 'text/css';
    } else if (req.url.endsWith(".js")) {
        contentType = 'text/javascript';
    } else if (req.url.endsWith(".html")) {
        contentType = 'text/html';
    } else {
        contentType = 'text/plain';
    }
    fs.readFile('..' + req.url, function(err, data) {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
        } else {
            res.writeHead(200, {
                'Content-Type': contentType
            });
            res.end(data);
        }
    });
}

function main(port) {
    var appServer, appSocket;
    appServer = http.createServer(httpHandler);
    appSocket = sk(appServer);
    appServer.listen(port);
    appSocket.on('connection', function(socket) {
        socket.on('fetchFiles', function() {
            startFetchFiles(function(files) {
                socket.emit('filesSent', files);
            });
        });
        socket.on('compileFiles', function(files) {
            startCompileFiles(files, function(result) {
                socket.emit('filesCompiled', result);
            });
        });
    });
}

main(80);
