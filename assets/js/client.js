/*jslint white:true browser:true maxlen:80 */
/*global CodeMirror, Github, $, v9, io, alert */

"use strict";

(function() {
    var editor, files, currentFileId = -1,
        breakpoints = {};

    function makeMarker() {
        var marker;

        marker = document.createElement("div");
        marker.style.color = "gray";
        marker.innerHTML = "●";
        return marker;
    }

    function editFile(name, line) {
        var i, j, k;

        if (currentFileId === -1 || files[currentFileId].name !== name) {
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
                    break;
                }
                if (i + 1 === j) {
                    console.log("cannot find file " + name);
                    return;
                }
            }
        }
        if (line) {
            editor.setCursor(line - 1);
        }
        k = breakpoints[name];
        for (i in k) {
            if (k.hasOwnProperty(i)) {
                editor.setGutterMarker(Number(i) - 1, "breakpoints",
                    makeMarker());
            }
        }
        k = $("#files").children();
        k.removeClass("active");
        k.each(function() {
            if ($(this).text() === name) {
                $(this).addClass("active");
            }
        });
        $("#edpanel").focus();
    }

    function fetchImage(cb) {
        var runBtn, socket;

        alert("Before you start the CPU. " +
            "Do remember to set up a local server with 'node server.js' " +
            "under the 'server' directory. " +
            "And if you use Vimium or something like that, " +
            "please turn it off for a while.");
        runBtn = $("#runBtn");
        if (runBtn.text() === "Kill" || runBtn.text() === "Quit") {
            runBtn.click();
        }
        socket = io('http://localhost:8080');
        socket.emit('getstuff');
        socket.on('gotstuff', function(stuff) {
            socket.disconnect();
            v9.fillimg(stuff.files[0].data, stuff.files[1].data);
            v9.loadsymbols(stuff.files.slice(2));
            v9.reset();
            $("#termtext").text("");
            cb();
        });
    }

    function updateCpuView(info) {
        if (!v9.running() && !v9.debugging()) {
            alert("End of program reached.");
            v9.reset();
            $("#runBtn").text("Run");
        }
        editFile(info.file, info.line);
    }

    (function() {
        $(".panel").focus(function() {
            $(".panel").removeClass("panel-primary").addClass("panel-default");
            $(this).removeClass("panel-default").addClass("panel-primary");
        });
    }());

    (function() {
        editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
            mode: "text/x-csrc",
            styleActiveLine: true,
            lineNumbers: true,
            gutters: ["CodeMirror-linenumbers", "breakpoints"]
        });
        editor.on("gutterClick", function(cm, ln) {
            var filename;

            filename = files[currentFileId].name;
            if (cm.lineInfo(ln).gutterMarkers) {
                cm.setGutterMarker(ln, "breakpoints", null);
                delete breakpoints[filename][ln + 1];
            } else {
                cm.setGutterMarker(ln, "breakpoints", makeMarker());
                if (!breakpoints[filename]) {
                    breakpoints[filename] = {};
                }
                breakpoints[filename][ln + 1] = true;
            }
        });
        editor.on("focus", function() {
            $("#edpanel").focus();
        });
    }());

    (function() {
        var usrName, repoName, brName, repo;

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

            if (err) {
                console.log(err);
                return;
            }
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

            function getEachFile(i) {
                $.get("https://raw.githubusercontent.com/" +
                    usrName + "/" + repoName + "/" + brName +
                    "/root" + files[i].name,
                    function(d) {
                        var cnt, v;

                        files[i].text = d;
                        $("#files").append(
                            "<li id='file" + i.toString() + "'><a href='#'>" +
                            files[i].name + "</a></li>"
                        );
                        cnt = 0;
                        for (v = 0; v < files.length; v = v + 1) {
                            if (files[v].text) {
                                cnt = cnt + 1;
                            }
                        }
                        if (cnt === files.length) {
                            $("#fetchingfiles").remove();
                            $("#files").children().click(function() {
                                editFile($(this).text());
                            });
                            editFile("/etc/os.c");
                        }
                    });
                if (i + 1 < files.length) {
                    getEachFile(i + 1);
                }
            }
            getEachFile(0);
        });
    }());

    (function() {
        v9.inithdr(function(fd, msg) {
            var termtext;

            if (fd === 2) {
                console.log(msg);
            }
            termtext = $("#termtext");
            termtext.html(termtext.html() +
                msg.replace(/\t/g, '&nbsp;&nbsp;').replace(/\n/g, '<br/>'));
        });

        $("#termpanel").keypress(function(e) {
            var keyCode;

            if (v9.acceptkb()) {
                keyCode = e.keyCode || e.which;
                if (0 <= keyCode && keyCode <= 0x7F) {
                    v9.putkbch(keyCode);
                }
            }
        });
    }());

    (function() {
        var runBtn, stepBtn, contBtn;

        runBtn = $("#runBtn");
        runBtn.click(function() {
            if (runBtn.text() === "Run") {
                fetchImage(function() {
                    runBtn.text("Kill");
                    $("#termpanel").focus();
                    v9.run(function() {
                        runBtn.text("Run");
                    });
                });
            } else if (runBtn.text() === "Kill" ||
                runBtn.text() === "Quit") {
                v9.kill();
                runBtn.text("Run");
                $("#termtext").html("No process running.");
            } else {
                console.log("runBtn.text() === '" + runBtn.text() + "'");
            }
        });

        stepBtn = $("#stepBtn");
        stepBtn.click(function() {
            if (contBtn.text() !== "Running") {
                if (!v9.debugging()) {
                    fetchImage(function() {
                        v9.startdebug();
                        runBtn.text("Quit");
                        stepBtn.click();
                    });
                } else {
                    v9.singlestep(updateCpuView);
                }
            }
        });

        contBtn = $("#contBtn");
        contBtn.click(function() {
            if (contBtn.text() !== "Running") {
                if (contBtn.text() !== "Continue") {
                    console.log("contBtn's text === " + contBtn.text());
                }
                if (!v9.debugging()) {
                    fetchImage(function() {
                        v9.startdebug();
                        runBtn.text("Quit");
                        contBtn.click();
                    });
                } else {
                    contBtn.text("Running");
                    stepBtn.text("Void");
                    v9.untilbreak(breakpoints, function(info) {
                        updateCpuView(info);
                        contBtn.text("Continue");
                        stepBtn.text("Step");
                    });
                }
            }
        });
    }());
}());
