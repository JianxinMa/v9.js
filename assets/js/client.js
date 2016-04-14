/*jslint white:true browser:true maxlen:80 */
/*global CodeMirror, Github, $, v9, io */

"use strict";

(function() {
    var files, editor, termtext,
        usrName, repoName, brName, repo, runBtn;

    editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
        readOnly: true, // not ready yet
        mode: "text/x-csrc",
        styleActiveLine: true,
        lineNumbers: true,
        gutters: ["CodeMirror-linenumbers", "breakpoints"]
    });
    editor.on("gutterClick", function(cm, ln) {
        var marker;

        if (cm.lineInfo(ln).gutterMarkers) {
            cm.setGutterMarker(ln, "breakpoints", null);
        } else {
            marker = document.createElement("div");
            marker.style.color = "gray";
            marker.innerHTML = "●";
            cm.setGutterMarker(ln, "breakpoints", marker);
        }
    });

    usrName = "JianxinMa";
    repoName = "v9.js";
    brName = "gh-pages";
    repo = (new Github({
        // username: "v9os",
        // password:
        // auth: "basic"
    })).getRepo(usrName, repoName);
    /*
    repo.getTree(brName + "?recursive=true", function(err, tree) {
        var len;

        if (err) {
            console.log(err);
            return;
        }

        function getFiles(i, p) {
            var a;

            if (i < len) {
                a = tree[i].path;
                if (a.startsWith("root/") &&
                    (a.endsWith(".c") || a.endsWith(".h"))) {
                    files.push({
                        name: a.substr(4)
                    });
                    $.get("https://raw.githubusercontent.com/" +
                        usrName + "/" + repoName + "/" + brName + "/" + a,
                        function(data) {
                            files[p].text = data;
                            $("#files").append(
                                "<li id='file" + p.toString() +
                                "'><a href='#'>" +
                                files[p].name + "</a></li>"
                            );
                            if (files[p].name === "/etc/os.c") {
                                editor.setValue(data);
                                $("#file" + p.toString()).addClass(
                                    "active");
                            }
                            if (p + 1 === files.length) {
                                $("#fetchingfiles").remove();
                            }
                        });
                    getFiles(i + 1, p + 1);
                } else {
                    getFiles(i + 1, p);
                }
            }
        }
        files = [];
        len = tree.length;
        getFiles(0, 0);
    });
     */

    termtext = $("#termtext");
    v9.inithdr(function(fd, msg) {
        if (fd == 2) {
            console.log(msg);
        }
        termtext.html(termtext.html() +
            msg.replace(/\t/g, '&nbsp;&nbsp;').replace(/\n/g, '<br/>'));
    });

    CodeMirror.fromTextArea(document.getElementById("monitor"), {
        readOnly: true
    });

    runBtn = $("#run");
    runBtn.click(function() {
        var socket;

        if (!v9.running()) {
            socket = io('http://localhost:8080');
            socket.emit('getos');
            socket.on('sendos', function(os) {
                socket.emit('getfs');
                socket.on('sendfs', function(fs) {
                    v9.fillimg(os.os, fs.fs);
                    v9.reset();
                    v9.run(function() {
                        runBtn.text("Run");
                    });
                    runBtn.text("Kill");
                });
            });
        } else {
            v9.kill();
            runBtn.text("Run");
        }
    });
}());
