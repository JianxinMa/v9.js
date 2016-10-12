import React from "react";
import ReactDOM from "react-dom";
import CodeMirror from "codemirror";
import "codemirror/addon/selection/active-line";
import "codemirror/mode/clike/clike";
import "codemirror/lib/codemirror.css";

class CodeEditor extends React.Component {
    componentDidMount() {
        this.editor = CodeMirror.fromTextArea(ReactDOM.findDOMNode(this.refs.textarea), {
            mode: "text/x-csrc",
            styleActiveLine: true,
            lineNumbers: true,
            gutters: ["CodeMirror-linenumbers", "breakPoints"]
        });
    }

    render() {
        return (
            <div>
                <textarea ref="textarea" defaultValue="// No opened file."/>
            </div>
        );
    }
}

export default CodeEditor;
