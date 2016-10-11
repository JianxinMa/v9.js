import React from "react";
import ReactDOM from "react-dom";
import CodeMirror from "codemirror";

require('codemirror/addon/selection/active-line');
require('codemirror/mode/clike/clike');

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
                <textarea ref="textarea" defaultValue={this.props.defaultValue}/>
            </div>
        );
    }
}

export default CodeEditor;
