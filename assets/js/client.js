/*jslint white:true browser:true maxlen:80 */
/*global CodeMirror, Github, $, v9 */

"use strict";
var files;

(function() {
    var editor, terminal, termInner, usrName, repoName, brName, repo, runBtn;

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

    terminal = $("#terminal");
    terminal.console({
        welcomeMessage: "No process running.",
        commandValidate: function() {
            return v9.acceptkb();
        },
        commandHandle: function(line) {
            v9.putkbseq(line + "\n");
            return [{
                msg: ""
            }];
        }
    });
    termInner = terminal.children(".jquery-console-inner");

    v9.inithdr(function(msg) {
        var o;

        o = termInner.children(".jquery-console-message").last();
        o.html(o.html() +
            msg.replace(/\t/g, '&nbsp;&nbsp;').replace(/\n/g, '<br/>'));
    });

    CodeMirror.fromTextArea(document.getElementById("monitor"), {
        readOnly: true
    });

    runBtn = $("#run");
    runBtn.click(function() {
        if (!v9.running()) {
            // ...
            runBtn.text("Kill");
        }
    });
}());
