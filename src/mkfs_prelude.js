/*jslint white:true browser:true maxlen:80 bitwise:true */
/*global FS */

"use strict";

function mkfs(env_files, env_print) {
    var env_disk, env_root, Module;
    env_disk = 'disk.img';
    env_root = "root"; // TODO: no hard coded root.
    Module = {
        arguments: [env_disk, env_root],
        print: (env_print || console.log),
        preRun: [function() {
            // TODO: remove hard coded directories.
            FS.mkdir('root');
            FS.mkdir('root/bin');
            FS.mkdir('root/dev');
            FS.mkdir('root/etc');
            FS.mkdir('root/lib');
            FS.mkdir('root/usr');
            env_files.forEach(function(file) {
                if (file.filename.startsWith('root/') &&
                    !file.filename.endsWith('.d')) {
                    FS.writeFile(file.filename, file.content, {
                        encoding: file.encoding
                    });
                }
            });
        }],
        postRun: [function() {
            env_files.push({
                filename: env_disk,
                encoding: 'binary',
                content: FS.readFile(env_disk, {
                    encoding: 'binary'
                })
            });
        }]
    };
}