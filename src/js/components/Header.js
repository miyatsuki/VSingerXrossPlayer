import React from "react";

export default class Header extends React.Component {
  render() {
    return (
      <div>
        <h1 style={{ margin: "0px", textAlign: "center", fontSize: "8vw" }}>
          {this.props.title}
        </h1>
      </div>
    );
  }
}
