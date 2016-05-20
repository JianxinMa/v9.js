/*jslint white:true browser:true maxlen:80 bitwise:true */
/*global FS */

"use strict";

function mkfs(env_argv, env_print, env_files) {
    var Module = {
        arguments: ["hd", "root"],
        print: env_print,
        preRun: [function() {
            FS.mkdir('root');
            FS.mkdir('root/etc');
            FS.writeFile('root/etc/os.c', 'int main() {return 0;}');
        }],
        postRun: [function() {
            console.log(FS);
            console.log(FS.readFile('os', {
                encoding: 'utf8'
            }));
            console.log(FS.readFile('root/etc/os.d', {
                encoding: 'utf8'
            }));
        }],
    };
}