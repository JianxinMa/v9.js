/*jslint white:true browser:true maxlen:80 */
/*global CodeMirror, Github, $, v9, io */

"use strict";

(function() {
    var files, editor, termtext, terminal, currentFileId = -1,
        usrName, repoName, brName, repo, runBtn;

    editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
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
    editor.on("focus", function() {
        $("#edpanel").removeClass("panel-default").addClass("panel-primary");
    });
    editor.on("blur", function() {
        $("#edpanel").removeClass("panel-primary").addClass("panel-default");
    });

    function editFile(name) {
        var i, j, k;

        j = files.length;
        for (i = 0; i < j; i = i + 1) {
            if (files[i].name === name) {
                if (currentFileId !== -1) {
                    k = editor.getValue();
                    if (k !== files[currentFileId].text) {
                        files[currentFileId].text = k;
                        files[currentFileId].modified = true;
                    }
                }
                currentFileId = i;
                editor.setValue(files[i].text);
                return;
            }
        }
        console.log("cannot find file " + name);
    }

    usrName = "JianxinMa";
    repoName = "v9.js";
    brName = "gh-pages";
    repo = (new Github({
        // username: "v9os",
        // password:
        // auth: "basic"
    })).getRepo(usrName, repoName);
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
                                editFile(files[p].name);
                                $("#file" + p.toString()).addClass(
                                    "active");
                            }
                            if (p + 1 === files.length) {
                                $("#fetchingfiles").remove();
                                $("#files").children().click(function() {
                                    $("#files").children().removeClass("active");
                                    $(this).addClass("active");
                                    editFile($(this).text());
                                });
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

    termtext = $("#termtext");
    v9.inithdr(function(fd, msg) {
        if (fd === 2) {
            console.log(msg);
        }
        termtext.html(termtext.html() +
            msg.replace(/\t/g, '&nbsp;&nbsp;').replace(/\n/g, '<br/>'));
    });

    terminal = $("#terminal");
    terminal.keypress(function(e) {
        var keyCode;

        if (v9.acceptkb()) {
            keyCode = e.keyCode || e.which;
            if (0 <= keyCode && keyCode <= 0x7F) {
                v9.putkbch(keyCode);
            }
        }
    });
    terminal.focus(function() {
        $("#termpanel").removeClass("panel-default").addClass("panel-primary");
    });
    terminal.focusout(function() {
        $("#termpanel").removeClass("panel-primary").addClass("panel-default");
    });


    CodeMirror.fromTextArea(document.getElementById("monitor"), {
        readOnly: true
    });

    runBtn = $("#run");
    runBtn.click(function() {
        var socket;

        if (!v9.running()) {
            alert("Before you start the CPU. " +
                "Do remember to set up a local server with 'node server.js' " +
                "under the 'server' directory. " +
                "And if you use Vimium or something like that, " +
                "please turn it off for a while.");
            socket = io('http://localhost:8080');
            socket.emit('getos');
            socket.on('sendos', function(os) {
                socket.emit('getfs');
                socket.on('sendfs', function(fs) {
                    v9.fillimg(os.os, fs.fs);
                    v9.reset();
                    termtext.text("");
                    v9.run(function() {
                        runBtn.text("Run");
                    });
                    runBtn.text("Kill");
                });
            });
        } else {
            v9.kill();
            runBtn.text("Run");
            termtext.html("No process running.");
        }
    });

}());
