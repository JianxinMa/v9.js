const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const express = require('express');

function printError(error) {
    console.error(`Error's message: ${error.message}`);
    console.error(`Error's stack: ${error.stack}`);
}

function joinPath(root, child) {
    const p = path.join(root, child);
    if (p.indexOf(root) !== 0)
        throw `Rejected path.join('${root}', '${child}').`;
    return p;
}

function runCommand(cmd, args, cb, stdin) {
    const child = child_process.spawn(cmd, args);
    const output = [];
    if (stdin) {
        child.stdin.write(stdin);
        child.stdin.end();
    }
    child.stderr.on('data', buffer => {
        process.stderr.write(buffer.toString());
    });
    child.stdout.on('data', buffer => {
        output.push(buffer.toString());
    });
    child.stdout.on('end', () => {
        cb(output.join(''));
    });
}

class Lab {
    constructor(config, userPath) {
        const {name, files, targets, disk} = config;
        this.name = name;
        this.files = files;
        this.targets = targets;
        this.disk = disk;
        this.labPath = joinPath(userPath, this.name);
    }

    getOsBinPath() {
        return this.targets[0].target;
    }

    getDiskPath() {
        return this.disk;
    }

    readFiles() {
        const promises = this.files.map(name =>
            new Promise(resolve => {
                fs.readFile(joinPath(this.labPath, name), 'utf8', (err, data) => {
                    if (err) throw err;
                    resolve({name: name, content: data});
                });
            }));
        return Promise.all(promises);
    }

    writeFile(file) {
        return new Promise(resolve => {
            const {name, content} = file;
            if (content.length > 512 * 1024) throw 'File too large to write.';
            fs.writeFile(joinPath(this.labPath, name), content, err => {
                if (err) throw err;
                resolve();
            });
        });
    }

    saveFiles(files) {
        const promises = files
            .filter(file => this.files.includes(file.name))
            .map(file => this.writeFile(file));
        return Promise.all(promises);
    }

    preprocess() {
        const promises = this.targets.map(receipt =>
            new Promise(resolve => {
                const {include, sources, target} = receipt;
                const stdin = sources.map(src => `#include "${joinPath(this.labPath, src)}"`).join('\n');
                const args = include.map(dir => `-I${joinPath(this.labPath, dir)}`);
                runCommand('cpp', args, output => {
                    resolve({target: target, preprocessed: output});
                }, stdin);
            }));
        return Promise.all(promises);
    }
}

class User {
    constructor(userId, socket) {
        this.userId = userId;
        this.userPath = joinPath('users', this.userId.toString());
        this.userLab = null;
        this.socket = socket;
        this.bindSocket();
    }

    bindSocket() {
        this.socket.on('x-open', (data, ack) => {
            const {labName} = data;
            this.openLab(labName)
                .then(lab => {
                    this.userLab = lab;
                    return this.userLab.readFiles();
                })
                .then(files => {
                    ack({files: files});
                })
                .catch(printError);  // TODO: won't catch exceptions within node.js modules such as path.join.
        });
        this.socket.on('x-save', (data, ack) => {
            if (this.userLab) {
                this.userLab.saveFiles(data.files)
                    .then(() => this.userLab.preprocess())
                    .then(preprocessedFiles => {
                        ack({
                            preprocessedFiles: preprocessedFiles,
                            diskPath: this.userLab.getDiskPath(),
                            osBinPath: this.userLab.getOsBinPath()
                        });
                    })
                    .catch(printError);
            }
        });
    }

    openLab(lab) {
        return new Promise(resolve => {
            const p = joinPath(this.userPath, lab);
            fs.access(p, fs.constants.F_OK, (err) => {
                if (err) {
                    runCommand('mkdir', ['-p', this.userPath], () => {
                        runCommand('cp', ['-r', joinPath('labs', lab), p], resolve);
                    });
                } else {
                    resolve();
                }
            })
        }).then(() => new Promise(resolve => {
            fs.readFile(
                joinPath(this.userPath, joinPath(lab, 'config.json')),
                'utf8',
                (err, config) => {
                    if (err) throw err;
                    resolve(new Lab(JSON.parse(config), this.userPath));
                });
        }));
    }

    getUserId() {
        return this.userId;
    }
}

class Server {
    constructor(port = 80) {
        this.users = [];
        this.app = express();
        this.server = require('http').Server(this.app);
        this.io = require('socket.io')(this.server);
        this.server.listen(port);
    }

    setupHTTP() {
        this.app.use(express.static(__dirname));
        this.app.get('/', function (req, res) {
            res.sendFile(__dirname + '/index.html');
        });
    }

    bindSocket() {
        this.io.on('connection', socket => {
            const userId = 123456;  // TODO: get id via oauth.
            if (this.users.some(user => (user.getUserId() === userId))) {
                socket.disconnect();
            } else {
                this.users.push(new User(userId, socket));
                socket.on('disconnect', () => {
                    this.users = this.users.filter(user => (user.getUserId() !== userId));
                });
            }
        });
    }
}

const server = new Server(8086);
server.setupHTTP();
server.bindSocket();
