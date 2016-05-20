/*jslint white:true browser:true maxlen:80 bitwise:true */
/*global FS */

"use strict";

function xvcc_all(env_files) {
    env_files.forEach(function(file) {
        if (file.filename.endsWith('.c')) {
            xvcc(file.filename, env_files);
        }
    });
}

function xvcc(env_src, env_files) {
    var env_out, Module;
    env_out = env_src.substr(0, env_src.length - 2);
    Module = {
        arguments: ["-Iroot/lib", "-o", env_out, env_src],
        print: console.log,
        preRun: [function() {
            // TODO: remove hard coded directories.
            FS.mkdir('root');
            FS.mkdir('root/bin');
            FS.mkdir('root/dev');
            FS.mkdir('root/etc');
            FS.mkdir('root/lib');
            FS.mkdir('root/usr');
            env_files.forEach(function(file) {
                if (file.filename.endsWith('.h') || file.filename === env_src) {
                    FS.writeFile(file.filename, file.content);
                }
            });
        }],
        postRun: [function() {
            var env_dbg;
            env_files.push({
                filename: env_out,
                encoding: null,
                content: FS.readFile(env_out, {
                    encoding: 'binary'
                })
            });
            env_dbg = env_out + '.d';
            env_files.push({
                filename: env_dbg,
                encoding: 'utf8',
                content: FS.readFile(env_dbg, {
                    encoding: 'utf8'
                })
            });
        }]
    };
}