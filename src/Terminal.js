import React from "react";
import "./Terminal.css";

class Terminal extends React.Component {
    render() {
        return (
            <div className="terminal" tabindex="1">
                <div className="terminal-inner">
                    <div className="terminal-message">
                        <span>No process running.</span><span className="blinking-cursor">|</span>
                    </div>
                </div>
            </div>
        );
    }
}

export default Terminal;
