import React from "react";
import injectTapEventPlugin from "react-tap-event-plugin";
import MuiThemeProvider from "material-ui/styles/MuiThemeProvider";
import AppBar from "material-ui/AppBar";
import CodeEditor from "./CodeEditor";
import "./App.css";

injectTapEventPlugin();

class App extends React.Component {
    render() {
        return (
            <MuiThemeProvider>
                <div>
                    <AppBar title="Title" iconClassNameRight="muidocs-icon-navigation-expand-more"/>
                    <CodeEditor defaultValue="// No opened file."/>
                </div>
            </MuiThemeProvider>
        );
    }
}

export default App;
