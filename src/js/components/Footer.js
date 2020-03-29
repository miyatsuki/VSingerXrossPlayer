import React from "react";

export default class Footer extends React.Component {
  render() {
    return (
      <footer style={{ display: "flex", justifyContent: "space-around" }}>
        <div>
          <a href="https://twitter.com/miyatsuki_shiku">contact(Twitter)</a>
        </div>
        <div>
          <a href="./license.html">license</a>
        </div>
      </footer>
    );
  }
}
