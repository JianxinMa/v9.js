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
        var i, j, k;

        files = [];
        j = tree.length;
        for (i = 0; i < j; i = i + 1) {
            k = tree[i].path;
            if (k.startsWith("root/") &&
                (k.endsWith(".c") ||
                    k.endsWith(".h") ||
                    k.endsWith(".txt"))) {
                files.push({
                    name: k.substr(4)
                });
            }
        }

        function getFile(i) {
            $.get("https://raw.githubusercontent.com/" +
                usrName + "/" + repoName + "/" + brName + "/root" + files[i].name,
                function(d) {
                    var cnt, j, k;

                    files[i].text = d;
                    $("#files").append(
                        "<li id='file" + i.toString() + "'><a href='#'>" +
                        files[i].name + "</a></li>"
                    );

                    cnt = 0;
                    j = files.length;
                    for (k = 0; k < j; k = k + 1) {
                        if (files[k].text) {
                            cnt = cnt + 1;
                        }
                    }
                    if (cnt === files.length) {
                        $("#fetchingfiles").remove();
                        $("#files").children().click(function() {
                            $("#files").children().removeClass("active");
                            $(this).addClass("active");
                            editFile($(this).text());
                        });
                        editFile("/etc/os.c");
                    }
                });
            if (i + 1 < files.length) {
                getFile(i + 1);
            }
        }
        getFile(0);
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
                    socket.disconnect();
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
